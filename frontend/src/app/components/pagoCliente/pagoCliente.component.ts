import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ProductoService } from '../../services/producto.service';
import { GlobalService } from '../../services/global.service';
import { PedidoService } from '../../services/pedido.service';

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

  constructor(
    private router: Router,
    private http: HttpClient,
    private productoService: ProductoService,
    private pedidoService: PedidoService,
    private globalService: GlobalService
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
}
