import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GlobalService } from './global.service';

export interface CrearPedidoPayload {
  metodoPago?: string;
  direccionEntrega: string;
}

@Injectable({ providedIn: 'root' })
export class PedidoService {
  constructor(private http: HttpClient, private globalService: GlobalService) {}

  crearPedido(dni: string, payload: CrearPedidoPayload): Observable<any> {
    return this.http.post(`${this.globalService.apiUrl}/api/customers/${dni}/orders`, payload);
  }

  obtenerPedidos(dni: string): Observable<any> {
    return this.http.get(`${this.globalService.apiUrl}/api/customers/${dni}/orders`);
  }

  cancelarPedido(dni: string, orderId: string): Observable<any> {
    return this.http.put(`${this.globalService.apiUrl}/api/customers/${dni}/orders/${orderId}/cancel`, {});
  }

  repetirPedido(dni: string, orderId: string): Observable<any> {
    return this.http.post(`${this.globalService.apiUrl}/api/customers/${dni}/orders/${orderId}/repeat`, {});
  }
}
