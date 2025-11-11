import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ProductoService } from '../../services/producto.service';
import { GlobalService } from '../../services/global.service';
import { PedidoService } from '../../services/pedido.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

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
          this.saldoAFavor = response.cliente.saldoAFavor || 0;
          this.direccionEntrega = response.cliente.domicilio || '';
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

  pagar(): void {
    if (this.procesandoPago || this.carritoItems.length === 0) {
      return;
    }

    const direccionNormalizada = (this.direccionEntrega || '').trim();
    if (!direccionNormalizada) {
      this.mensajeError = 'Debes ingresar una dirección de entrega para continuar.';
      return;
    }

    // Si selecciona Mercado Pago con tarjeta, generar QR
    if (this.metodoPago === 'tarjeta') {
      this.generarQRMercadoPago();
    } else {
      // Para otros métodos, proceder normalmente
      this.procesarPagoTradicional(direccionNormalizada);
    }
  }

  generarQRMercadoPago(): void {
    this.generandoQR = true;
    this.mensajeError = '';
    this.mensajeExito = '';

    const datosQR = {
      cantidad: this.total,
      descripcion: `Pedido para ${this.dni} - ${this.carritoItems.length} productos`,
      items: this.carritoItems,
      clienteDni: this.dni,
      direccionEntrega: this.direccionEntrega
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
          this.linkPago = response.initPoint || response.checkoutUrl || '';
          
          console.log('📊 Valores asignados:', {
            codigoQR_length: this.codigoQR.length,
            preferenceId: this.preferenceId,
            linkPago: this.linkPago,
            mostrarQR: true
          });
          
          this.mostrarQR = true;
          this.tiempoExpiracion = 300; // 5 minutos
          this.iniciarContadorExpiracion();
          
          // Verificar que la imagen esté asignada correctamente
          console.log('✅ QR generado correctamente');
          console.log('✅ mostrarQR =', this.mostrarQR);
          console.log('✅ codigoQR asignado =', !!this.codigoQR);
          
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
      }
    }, 1000);
  }

  abrirLinkPago(): void {
    if (this.linkPago) {
      window.open(this.linkPago, '_blank');
    }
  }

  procesarPagoTradicional(direccionNormalizada: string): void {
    this.procesandoPago = true;
    this.mensajeError = '';
    this.mensajeExito = '';

    const payload = {
      metodoPago: this.metodoPago,
      direccionEntrega: direccionNormalizada
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
