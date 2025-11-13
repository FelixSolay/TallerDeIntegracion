import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ProductoService } from '../../services/producto.service';
import { GlobalService } from '../../services/global.service';
import { PedidoService } from '../../services/pedido.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { CustomerAddress, buildFullAddress, trimAddress, hasAddressData } from '../../models/customer-address.model';

interface CartItem {
  productId?: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
}

@Component({
  selector: 'app-pago-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagoCliente.component.html',
  styleUrls: ['./pagoCliente.component.css']
})
export class PagoClienteComponent implements OnInit {
  dni: string = '';
  carritoItems: CartItem[] = [];
  total: number = 0;
  saldoAFavor: number = 0;
  metodoPago: string = 'tarjeta';
  direccionEntrega: string = '';
  
  // Campos de dirección separados
  calle: string = '';
  altura: string = '';
  piso: string = '';
  departamento: string = '';
  codigoPostal: string = '';
  ciudad: string = '';
  provincia: string = '';
  
  cargando: boolean = true;
  procesandoPago: boolean = false;
  mensajeExito: string = '';
  mensajeError: string = '';
  
  // MERCADO PAGO
  mostrarQR: boolean = false;
  qrImage: SafeUrl | null = null;
  codigoQR: string = '';
  generandoQR: boolean = false;
  preferenceId: string = '';
  linkPago: string = '';
  tiempoExpiracion: number = 0;
  
  // Polling para verificar pago
  pollingInterval: any = null;
  ultimoOrderId: string = '';

  // Para usar Math en template
  Math = Math;

  constructor(
    private router: Router,
    private http: HttpClient,
    private productoService: ProductoService,
    private pedidoService: PedidoService,
    private globalService: GlobalService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.globalService.checkLoggedIn('/pago');
    this.dni = sessionStorage.getItem('dni') || '';

    if (!this.dni) {
      this.router.navigateByUrl('/login');
      return;
    }

    this.cargarSaldoCliente();
    this.cargarCarrito();
  }

  cargarSaldoCliente(): void {
    this.http.get<any>(`${this.globalService.apiUrl}/api/customers/${this.dni}`).subscribe({
      next: (response) => {
        if (response && response.success && response.cliente) {
          const cliente = response.cliente;
          this.saldoAFavor = cliente.saldoAFavor || 0;

          const direccionCruda = cliente && typeof cliente.direccion === 'object' && cliente.direccion !== null
            ? { ...cliente.direccion }
            : {};
          if (!direccionCruda.codigoPostal && cliente.codigoPostal) {
            direccionCruda.codigoPostal = cliente.codigoPostal;
          }
          const direccion = trimAddress(direccionCruda);
          if (hasAddressData(direccion)) {
            this.applyAddress(direccion);
            this.direccionEntrega = buildFullAddress(direccion);
          } else {
            const domicilioPlano = typeof cliente.domicilio === 'string' ? cliente.domicilio.trim() : '';
            this.applyAddress(trimAddress({
              calle: domicilioPlano,
              codigoPostal: cliente.codigoPostal
            }));
            this.direccionEntrega = domicilioPlano;
          }
        }
      },
      error: (error) => {
        console.error('Error al obtener saldo:', error);
      }
    });
  }

  cargarCarrito(): void {
    this.cargando = true;
    this.productoService.getCart(this.dni).subscribe({
      next: (response) => {
        if (response && response.success) {
          this.carritoItems = response.carrito?.items || [];
          this.total = response.carrito?.total || 0;
          this.globalService.setCartTotal(this.total);
        }
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar carrito:', error);
        this.mensajeError = 'No se pudo obtener el carrito. Intenta nuevamente más tarde.';
        this.cargando = false;
      }
    });
  }

  formatearPrecio(valor: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(valor || 0);
  }

  volverAlCarrito(): void {
    this.router.navigateByUrl('/carrito');
  }

  private buildAddressFromFields(): CustomerAddress {
    return trimAddress({
      calle: this.calle,
      altura: this.altura,
      piso: this.piso,
      departamento: this.departamento,
      ciudad: this.ciudad,
      provincia: this.provincia,
      codigoPostal: this.codigoPostal
    });
  }

  private applyAddress(address: CustomerAddress): void {
    this.calle = address.calle;
    this.altura = address.altura;
    this.piso = address.piso;
    this.departamento = address.departamento;
    this.ciudad = address.ciudad;
    this.provincia = address.provincia;
    this.codigoPostal = address.codigoPostal;
  }

  construirDireccionCompleta(): string {
    return buildFullAddress(this.buildAddressFromFields());
  }

  pagar(): void {
    if (this.procesandoPago || this.carritoItems.length === 0) {
      return;
    }

    const direccion = this.buildAddressFromFields();
    const direccionNormalizada = buildFullAddress(direccion);
    this.direccionEntrega = direccionNormalizada;

    if (!direccionNormalizada || !direccion.calle || !direccion.altura || !direccion.ciudad || !direccion.provincia) {
      this.mensajeError = 'Debes completar todos los campos obligatorios de la dirección (calle, altura, ciudad y provincia).';
      return;
    }

    // Si selecciona Mercado Pago con tarjeta, generar QR
    if (this.metodoPago === 'tarjeta') {
      this.generarQRMercadoPago(direccion, direccionNormalizada);
    } else {
      // Para otros métodos, proceder normalmente
      this.procesarPagoTradicional(direccion, direccionNormalizada);
    }
  }

  generarQRMercadoPago(direccion: CustomerAddress, direccionNormalizada: string): void {
    this.generandoQR = true;
    this.mensajeError = '';
    this.mensajeExito = '';

    const datosQR = {
      cantidad: this.total,
      descripcion: `Pedido para ${this.dni} - ${this.carritoItems.length} productos`,
      items: this.carritoItems,
      clienteDni: this.dni,
      direccionEntrega: direccionNormalizada,
      direccion
    };

    this.http.post<any>(`${this.globalService.apiUrl}/api/pagos/generar-qr`, datosQR).subscribe({
      next: (response) => {
        this.generandoQR = false;
        console.log('📡 Response del backend:', response);
        
        if (response && response.success) {
          // Convertir QR base64 a data URI si es necesario
          let qrCode = response.qrCode || '';
          console.log('🔍 QR crudo (primeros 100 chars):', qrCode.substring(0, 100));
          console.log('🔍 Largo del QR:', qrCode.length);
          
          if (qrCode && !qrCode.startsWith('data:')) {
            qrCode = `data:image/png;base64,${qrCode}`;
            console.log('✅ QR convertido a data URI');
          } else {
            console.log('⚠️ QR ya tiene formato correcto o está vacío');
          }
          
          this.codigoQR = qrCode;
          this.preferenceId = response.preferenceId || '';
          // this.linkPago = response.initPoint || response.checkoutUrl || '';
          this.linkPago = response.sandboxUrl || response.checkoutUrl || response.initPoint || '';
          
          console.log('📊 Valores asignados:', {
            codigoQR_length: this.codigoQR.length,
            preferenceId: this.preferenceId,
            linkPago: this.linkPago,
            mostrarQR: true
          });
          
          this.mostrarQR = true;
          this.tiempoExpiracion = 300; // 5 minutos
          this.iniciarContadorExpiracion();
          
          // ✅ INICIAR POLLING para verificar pagos
          this.iniciarPollingPago();
          
          // Verificar que la imagen esté asignada correctamente
          console.log('✅ QR generado correctamente');
          console.log('✅ mostrarQR =', this.mostrarQR);
          console.log('✅ codigoQR asignado =', !!this.codigoQR);
          console.log('🔄 Iniciando polling para verificar pagos cada 2 segundos');
          
          this.mensajeExito = '✅ QR generado. Escanéalo con tu celular o haz clic en el link.';
        } else {
          console.error('❌ Response sin success:', response);
          this.mensajeError = response?.message || 'No se pudo generar el QR.';
        }
      },
      error: (error) => {
        this.generandoQR = false;
        console.error('❌ Error HTTP al generar QR:', error);
        console.error('Error status:', error?.status);
        console.error('Error body:', error?.error);
        this.mensajeError = 'Error al generar QR. Intenta nuevamente.';
      }
    });
  }

  iniciarContadorExpiracion(): void {
    const intervalo = setInterval(() => {
      this.tiempoExpiracion--;
      if (this.tiempoExpiracion <= 0) {
        clearInterval(intervalo);
        this.mostrarQR = false;
        this.mensajeError = 'El QR ha expirado. Genera uno nuevo.';
        this.detenerPolling();
      }
    }, 1000);
  }

  // ✅ POLLING: Verificar cada 2 segundos si el pago fue procesado
  iniciarPollingPago(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(() => {
      this.verificarEstadoPedido();
    }, 2000); // Consulta cada 2 segundos
  }

  verificarEstadoPedido(): void {
    if (!this.dni) return;

    this.http.get<any>(`${this.globalService.apiUrl}/api/customers/${this.dni}/orders`).subscribe({
      next: (response) => {
        if (response && response.success && response.pedidos && response.pedidos.length > 0) {
          // Buscar el pedido más reciente
          const pedidoReciente = response.pedidos[0];

          // Si el pedido está PAGADO o paymentStatus es aprobado, cerrar la modal
          if (pedidoReciente.estado === 'pagado' || pedidoReciente.paymentStatus === 'approved') {
            console.log('✅ PAGO DETECTADO Y APROBADO', pedidoReciente);
            this.detenerPolling();
            this.mostrarQR = false;
            this.mensajeExito = '✅ ¡Pago realizado con éxito! Tu pedido ha sido confirmado.';
            
            // Limpiar carrito después de 3 segundos y redirigir
            setTimeout(() => {
              this.router.navigateByUrl('/perfil');
            }, 3000);
          }
        }
      },
      error: (error) => {
        console.warn('Error al verificar estado del pedido:', error);
      }
    });
  }

  detenerPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  abrirLinkPago(): void {
    if (this.linkPago) {
      window.open(this.linkPago, '_blank');
    }
  }

  procesarPagoTradicional(direccion: CustomerAddress, direccionNormalizada: string): void {
    this.procesandoPago = true;
    this.mensajeError = '';
    this.mensajeExito = '';

    const payload = {
      metodoPago: this.metodoPago,
      direccionEntrega: direccionNormalizada,
      direccion
    };

    this.pedidoService.crearPedido(this.dni, payload).subscribe({
      next: (response) => {
        this.procesandoPago = false;
        if (response && response.success) {
          this.mensajeExito = '¡Pago realizado con éxito! Tu pedido quedó en estado pendiente.';
          this.carritoItems = [];
          this.total = 0;
          this.globalService.setCartTotal(0);
          this.direccionEntrega = direccionNormalizada;
          setTimeout(() => {
            this.router.navigateByUrl('/perfil');
          }, 2000);
        } else {
          this.mensajeError = 'No se pudo procesar el pago. Intenta nuevamente.';
        }
      },
      error: (error) => {
        this.procesandoPago = false;
        console.error('Error al procesar pago:', error);
        if (error?.error?.error === 'carritoVacio') {
          this.mensajeError = 'No hay productos en el carrito para procesar el pago.';
        } else if (error?.error?.error === 'stockInsuficiente') {
          const faltantes = error?.error?.faltantes || [];
          const nombres = faltantes
            .map((detalle: any) => detalle?.nombre)
            .filter((nombre: string | null | undefined) => nombre && typeof nombre === 'string');
          const productosSinStock = nombres.length > 0 ? nombres.join(', ') : 'al menos un producto del carrito';
          this.mensajeError = `No hay stock suficiente para completar la compra. Revisa: ${productosSinStock}.`;
          this.cargarCarrito();
        } else {
          this.mensajeError = 'Ocurrió un error al procesar el pago. Intenta nuevamente.';
        }
      }
    });
  }

  cerrarQR(): void {
    this.mostrarQR = false;
    this.codigoQR = '';
    this.preferenceId = '';
    this.detenerPolling(); // ✅ Detener polling al cerrar modal
  }

  copiarCodigoQR(): void {
    if (this.linkPago) {
      // Si hay link, copia el link
      navigator.clipboard.writeText(this.linkPago).then(() => {
        this.mensajeExito = '✅ Link de pago copiado al portapapeles';
        console.log('✅ Link copiado:', this.linkPago);
        setTimeout(() => {
          this.mensajeExito = '';
        }, 3000);
      }).catch(err => {
        console.error('Error al copiar:', err);
        this.mensajeError = 'No se pudo copiar el link';
      });
    } else if (this.preferenceId) {
      // Si no hay link, copia el ID de preferencia
      navigator.clipboard.writeText(this.preferenceId).then(() => {
        this.mensajeExito = '✅ ID de preferencia copiado al portapapeles';
        console.log('✅ ID copiado:', this.preferenceId);
        setTimeout(() => {
          this.mensajeExito = '';
        }, 3000);
      }).catch(err => {
        console.error('Error al copiar:', err);
        this.mensajeError = 'No se pudo copiar el código';
      });
    } else {
      this.mensajeError = '❌ No hay código para copiar';
    }
  }

}
