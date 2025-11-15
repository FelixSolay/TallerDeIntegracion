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
        
        if (response && response.success) {
          // Convertir QR base64 a data URI si es necesario
          let qrCode = response.qrCode || '';
          
          if (qrCode && !qrCode.startsWith('data:')) {
            qrCode = `data:image/png;base64,${qrCode}`;
          }
          
          this.codigoQR = qrCode;
          this.preferenceId = response.preferenceId || '';
          this.linkPago = response.sandboxUrl || response.checkoutUrl || response.initPoint || '';
          
          this.mostrarQR = true;
          this.tiempoExpiracion = 300;
          this.iniciarContadorExpiracion();
          this.iniciarPollingPago();
        } else {
          this.mensajeError = response?.message || 'No se pudo generar el QR.';
        }
      },
      error: (error) => {
        this.generandoQR = false;
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

    console.log('🔍 Polling - Verificando pedidos para DNI:', this.dni);

    this.http.get<any>(`${this.globalService.apiUrl}/api/customers/${this.dni}/orders`).subscribe({
      next: (response) => {
        console.log('📡 Response polling:', response);
        
        if (response && response.success && response.pedidos && response.pedidos.length > 0) {
          const pedidoReciente = response.pedidos[0];
          console.log('📦 Pedido más reciente:', {
            id: pedidoReciente._id,
            estado: pedidoReciente.estado,
            paymentStatus: pedidoReciente.paymentStatus
          });

          // Si el pedido fue pagado con tarjeta (paymentStatus approved), mostrar confirmación
          if (pedidoReciente.paymentStatus === 'approved') {
            console.log('✅ PAGO CONFIRMADO - Cerrando modal');
            this.detenerPolling();
            this.mostrarQR = false;
            this.procesandoPago = false;
            this.mensajeError = '';
            this.mensajeExito = '¡Pago confirmado exitosamente! Tu compra ha sido registrada.';
            
            this.carritoItems = [];
            this.total = 0;
            this.globalService.setCartTotal(0);
          } else {
            console.log('⏳ Pedido aún pendiente');
          }
        } else {
          console.log('⚠️ No hay pedidos o response vacío');
        }
      },
      error: (error) => {
        console.error('❌ Error en polling:', error);
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
          // Mostrar modal de éxito
          this.mensajeExito = '¡Pedido confirmado exitosamente! Tu compra ha sido registrada.';
          this.carritoItems = [];
          this.total = 0;
          this.globalService.setCartTotal(0);
          this.direccionEntrega = direccionNormalizada;
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

  irAPedidos(): void {
    // Forzar recarga agregando timestamp
    this.router.navigateByUrl('/pedidos-en-curso?t=' + Date.now());
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
