import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GlobalService } from './global.service';

export interface PedidoItem {
  productId?: string | null;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
}

export interface Pedido {
  _id: string;
  customer: string;
  dni: string;
  nombre?: string;
  direccionEntrega: string;
  items: PedidoItem[];
  total: number;
  estado: 'pendiente' | 'entregado' | 'cancelado';
  metodoPago?: string;
  paymentStatus?: string;
  fechaEntrega?: string | null;
  creadoEl?: string;
  actualizadoEl?: string;
}

export interface PedidosResponse {
  success: boolean;
  pedidos?: Pedido[];
  pedido?: Pedido;
  error?: string;
  saldoAFavor?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminPedidosService {
  constructor(private http: HttpClient, private globalService: GlobalService) {}

  listarPedidos(filtros?: { estado?: string; dni?: string; fechaDesde?: string; fechaHasta?: string }): Observable<PedidosResponse> {
    let params = new HttpParams();
    if (filtros?.estado) params = params.set('estado', filtros.estado);
    if (filtros?.dni) params = params.set('dni', filtros.dni);
    if (filtros?.fechaDesde) params = params.set('fechaDesde', filtros.fechaDesde);
    if (filtros?.fechaHasta) params = params.set('fechaHasta', filtros.fechaHasta);
    return this.http.get<PedidosResponse>(`${this.globalService.apiUrl}/api/orders`, { params });
  }

  despacharPedido(orderId: string): Observable<PedidosResponse> {
    return this.http.put<PedidosResponse>(`${this.globalService.apiUrl}/api/orders/${orderId}/dispatch`, {});
  }

  cancelarPedido(orderId: string): Observable<PedidosResponse> {
    return this.http.put<PedidosResponse>(`${this.globalService.apiUrl}/api/orders/${orderId}/cancel`, {});
  }
}
