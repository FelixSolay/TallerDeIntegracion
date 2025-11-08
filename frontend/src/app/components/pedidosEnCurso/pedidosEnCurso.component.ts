import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GlobalService } from '../../services/global.service';
import { PedidoService } from '../../services/pedido.service';

interface PedidoItem {
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
}

interface Pedido {
  _id: string;
  creadoEl: string;
  actualizadoEl?: string;
  estado: 'pendiente' | 'entregado' | 'cancelado';
  total: number;
  metodoPago?: string;
  direccionEntrega: string;
  fechaEntrega?: string | null;
  items: PedidoItem[];
}

@Component({
  selector: 'app-pedidos-en-curso',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pedidosEnCurso.component.html',
  styleUrls: ['./pedidosEnCurso.component.css']
})
export class PedidosEnCursoComponent implements OnInit {
  dni = '';
  pedidos: Pedido[] = [];
  cargando = true;
  cargandoCancelacion = false;
  mensajeError = '';
  mensajeInfo = '';
  saldoAFavor = 0;

  mostrarDetalle = false;
  pedidoSeleccionado: Pedido | null = null;

  mostrarConfirmacion = false;
  pedidoPendienteCancelacion: Pedido | null = null;

  constructor(
    private router: Router,
    private pedidoService: PedidoService,
    private globalService: GlobalService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.globalService.checkLoggedIn('/pedidos-en-curso');
    this.dni = sessionStorage.getItem('dni') || '';

    if (!this.dni) {
      this.router.navigateByUrl('/login');
      return;
    }

    this.cargarSaldoCliente();
    this.obtenerPedidos();
  }

  obtenerPedidos(): void {
    this.cargando = true;
    this.mensajeError = '';

    this.pedidoService.obtenerPedidos(this.dni).subscribe({
      next: (response) => {
        this.cargando = false;
        if (response && response.success) {
          const pedidos = (response.pedidos || []) as Pedido[];
          this.pedidos = pedidos.filter((pedido) => pedido.estado === 'pendiente');
        } else {
          this.pedidos = [];
          this.mensajeError = 'No pudimos obtener tus pedidos. Intenta nuevamente más tarde.';
        }
      },
      error: (error) => {
        console.error('Error al obtener pedidos:', error);
        this.cargando = false;
        this.pedidos = [];
        this.mensajeError = 'Ocurrió un problema al cargar tus pedidos.';
      }
    });
  }

  cargarSaldoCliente(): void {
    this.http.get<any>(`${this.globalService.apiUrl}/api/customers/${this.dni}`).subscribe({
      next: (response) => {
        if (response && response.success && response.cliente) {
          this.saldoAFavor = response.cliente.saldoAFavor || 0;
        }
      },
      error: (error) => {
        console.error('Error al obtener saldo del cliente:', error);
      }
    });
  }

  formatearPrecio(valor: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(valor || 0);
  }

  formatearFecha(fechaIso?: string | null): string {
    if (!fechaIso) {
      return '-';
    }

    const fecha = new Date(fechaIso);
    if (Number.isNaN(fecha.getTime())) {
      return '-';
    }

    return fecha.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  estadoClase(estado: Pedido['estado']): string {
    switch (estado) {
      case 'pendiente':
        return 'estado estado-pendiente';
      case 'entregado':
        return 'estado estado-entregado';
      case 'cancelado':
        return 'estado estado-cancelado';
      default:
        return 'estado';
    }
  }

  verDetalle(pedido: Pedido): void {
    this.pedidoSeleccionado = pedido;
    this.mostrarDetalle = true;
  }

  cerrarDetalle(): void {
    this.pedidoSeleccionado = null;
    this.mostrarDetalle = false;
  }

  confirmarCancelacion(pedido: Pedido): void {
    if (pedido.estado !== 'pendiente') {
      return;
    }
    this.pedidoPendienteCancelacion = pedido;
    this.mostrarConfirmacion = true;
    this.mensajeInfo = '';
    this.mensajeError = '';
  }

  cancelarConfirmacion(): void {
    this.pedidoPendienteCancelacion = null;
    this.mostrarConfirmacion = false;
  }

  cancelarPedido(): void {
    if (!this.pedidoPendienteCancelacion) {
      return;
    }

    this.cargandoCancelacion = true;
    this.mensajeInfo = '';
    this.mensajeError = '';

    const pedido = this.pedidoPendienteCancelacion;
    this.pedidoService.cancelarPedido(this.dni, pedido._id).subscribe({
      next: (response) => {
        this.cargandoCancelacion = false;
        this.mostrarConfirmacion = false;
        this.pedidoPendienteCancelacion = null;

        if (response && response.success && response.pedido) {
          const actualizado = response.pedido as Pedido;
          const index = this.pedidos.findIndex((p) => p._id === actualizado._id);
          if (index !== -1) {
            this.pedidos[index] = {
              ...this.pedidos[index],
              estado: actualizado.estado,
              actualizadoEl: actualizado.actualizadoEl
            };
          }
          this.saldoAFavor = response.saldoAFavor ?? this.saldoAFavor;
          this.mensajeInfo = 'Pedido cancelado correctamente. Se acreditó el total a tu saldo a favor.';
        } else {
          this.mensajeError = 'No pudimos cancelar el pedido. Intenta nuevamente.';
        }
      },
      error: (error) => {
        this.cargandoCancelacion = false;
        this.mostrarConfirmacion = false;
        this.pedidoPendienteCancelacion = null;
        console.error('Error al cancelar pedido:', error);

        if (error?.error?.error === 'pedidoEntregado') {
          this.mensajeError = 'El pedido ya fue entregado y no puede cancelarse.';
        } else if (error?.error?.error === 'pedidoYaCancelado') {
          this.mensajeError = 'El pedido ya fue cancelado previamente.';
        } else {
          this.mensajeError = 'Ocurrió un error al cancelar el pedido.';
        }
      }
    });
  }

  regresarAlPerfil(): void {
    this.router.navigateByUrl('/perfil');
  }
}
