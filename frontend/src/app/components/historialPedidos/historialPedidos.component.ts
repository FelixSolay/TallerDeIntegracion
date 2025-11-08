import { CommonModule } from '@angular/common';
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

interface ResumenProductoAgregado {
  productId: string;
  nombre: string;
  cantidadAgregada: number;
  cantidadSolicitada: number;
  stockDisponible: number;
  agregadoCompleto: boolean;
}

interface ResumenProductoOmitido {
  productId: string | null;
  nombre: string;
  motivo: string;
}

interface ResumenRepeticion {
  agregados: ResumenProductoAgregado[];
  omitidos: ResumenProductoOmitido[];
  totalAgregado: number;
}

@Component({
  selector: 'app-historial-pedidos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './historialPedidos.component.html',
  styleUrls: ['./historialPedidos.component.css']
})
export class HistorialPedidosComponent implements OnInit {
  dni = '';
  pedidos: Pedido[] = [];
  cargando = true;
  mensajeError = '';
  mensajeInfo = '';
  resumenUltimaRepeticion: ResumenRepeticion | null = null;
  repeticionEnCurso: string | null = null;

  mostrarDetalle = false;
  pedidoSeleccionado: Pedido | null = null;

  constructor(
    private router: Router,
    private pedidoService: PedidoService,
    private globalService: GlobalService
  ) {}

  ngOnInit(): void {
    this.globalService.checkLoggedIn('/historial-pedidos');
    this.dni = sessionStorage.getItem('dni') || '';

    if (!this.dni) {
      this.router.navigateByUrl('/login');
      return;
    }

    this.obtenerPedidos();
  }

  obtenerPedidos(): void {
    this.cargando = true;
    this.mensajeError = '';
    this.mensajeInfo = '';
    this.resumenUltimaRepeticion = null;

    this.pedidoService.obtenerPedidos(this.dni).subscribe({
      next: (response) => {
        this.cargando = false;
        if (response && response.success && Array.isArray(response.pedidos)) {
          const historicos = (response.pedidos as Pedido[]).filter(
            (pedido) => pedido.estado === 'cancelado' || pedido.estado === 'entregado'
          );
          this.pedidos = historicos;
        } else {
          this.pedidos = [];
          this.mensajeError = 'No pudimos obtener tu historial de pedidos. Intenta nuevamente más tarde.';
        }
      },
      error: (error) => {
        console.error('Error al obtener historial de pedidos:', error);
        this.cargando = false;
        this.pedidos = [];
        this.mensajeError = 'Ocurrió un problema al cargar tu historial de pedidos.';
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
      case 'cancelado':
        return 'estado estado-cancelado';
      case 'entregado':
        return 'estado estado-entregado';
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

  motivoLegible(motivo: string): string {
    switch (motivo) {
      case 'productoInexistente':
        return 'El producto ya no está disponible';
      case 'sinStock':
        return 'Sin stock disponible';
      case 'carritoSinCapacidadPorStock':
        return 'El stock actual no permite agregar más unidades';
      case 'stockParcial':
        return 'Se agregó una parte, pero faltó stock para completar';
      case 'sinCantidadAgregada':
        return 'No fue posible agregar unidades';
      default:
        return 'No se pudo agregar este producto';
    }
  }

  repetirCompra(pedido: Pedido): void {
    if (this.repeticionEnCurso) {
      return;
    }

    this.repeticionEnCurso = pedido._id;
    this.mensajeError = '';
    this.mensajeInfo = '';
    this.resumenUltimaRepeticion = null;

    this.pedidoService.repetirPedido(this.dni, pedido._id).subscribe({
      next: (response) => {
        this.repeticionEnCurso = null;
        if (response && response.success) {
          const resumen = response.resumen || {};
          const agregados: ResumenProductoAgregado[] = resumen.productosAgregados || [];
          const omitidos: ResumenProductoOmitido[] = resumen.productosOmitidos || [];
          const totalAgregado = resumen.totalAgregado ?? agregados.reduce((acc: number, item) => acc + (item.cantidadAgregada || 0), 0);

          this.resumenUltimaRepeticion = {
            agregados,
            omitidos,
            totalAgregado
          };

          if (resumen.sinCambios || totalAgregado === 0) {
            this.mensajeError = 'No se pudieron agregar productos al carrito. Verifica la disponibilidad de stock.';
          } else if (omitidos.length > 0) {
            this.mensajeInfo = `Se agregaron ${totalAgregado} productos al carrito. Algunos artículos no se pudieron sumar por disponibilidad.`;
          } else {
            this.mensajeInfo = `Se agregaron ${totalAgregado} productos al carrito.`;
          }

          if (response.carrito && typeof response.carrito.total === 'number') {
            this.globalService.setCartTotal(response.carrito.total);
          }
        } else {
          this.mensajeError = 'No se pudo repetir la compra. Intenta nuevamente más tarde.';
        }
      },
      error: (error) => {
        this.repeticionEnCurso = null;
        console.error('Error al repetir compra:', error);
        if (error?.error?.error === 'pedidoPendiente') {
          this.mensajeError = 'El pedido aún está pendiente y no puede repetirse.';
        } else {
          this.mensajeError = 'Ocurrió un error al intentar repetir la compra.';
        }
      }
    });
  }

  irAPedidosEnCurso(): void {
    this.router.navigateByUrl('/pedidos-en-curso');
  }

  regresarAlPerfil(): void {
    this.router.navigateByUrl('/perfil');
  }
}
