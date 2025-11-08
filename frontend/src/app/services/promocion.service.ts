import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GlobalService } from './global.service';

export interface PromocionProductoRef {
  _id: string;
  nombre: string;
  precio: number;
  imagen?: string;
}

export interface Promocion {
  _id?: string;
  productId: string | PromocionProductoRef;
  tipo: 'porcentaje' | 'monto';
  valor: number;
  precioOriginal?: number;
  precioPromocional?: number;
  fechaInicio: string | Date;
  fechaFin: string | Date;
  activo?: boolean;
  creadoEl?: string;
  actualizadoEl?: string;
}

export interface PromocionResponse {
  success: boolean;
  promociones?: Promocion[];
  promocion?: Promocion;
  reason?: string;
}

@Injectable({ providedIn: 'root' })
export class PromocionService {
  constructor(private http: HttpClient, private global: GlobalService) {}

  listar(activos?: boolean): Observable<PromocionResponse> {
    let params = new HttpParams();
    if (activos !== undefined) params = params.set('activas', String(activos));
    return this.http.get<PromocionResponse>(`${this.global.apiUrl}/api/promociones`, { params });
  }

  crear(promo: { productId: string; tipo: 'porcentaje'|'monto'; valor: number; fechaInicio: string|Date; fechaFin: string|Date }): Observable<PromocionResponse> {
    return this.http.post<PromocionResponse>(`${this.global.apiUrl}/api/promociones`, promo);
  }

  actualizar(id: string, cambios: Partial<Promocion>): Observable<PromocionResponse> {
    return this.http.put<PromocionResponse>(`${this.global.apiUrl}/api/promociones/${id}`, cambios);
  }

  eliminar(id: string): Observable<PromocionResponse> {
    return this.http.delete<PromocionResponse>(`${this.global.apiUrl}/api/promociones/${id}`);
  }
}
