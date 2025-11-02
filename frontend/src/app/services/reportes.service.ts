import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GlobalService } from './global.service';

export interface TopProductoReporte {
  productId: string | null;
  nombre: string;
  categoria: string;
  cantidadVendida: number;
  totalRecaudado: number;
  vendidosHistorico: number;
  stockActual?: number;
}

export interface CategoriaReporte {
  categoriaId?: string;
  categoria: string;
  cantidadVendida: number;
  totalRecaudado: number;
}

export interface PeriodoReporteFila {
  fecha: string;
  cantidadPedidos: number;
  cantidadProductos: number;
  totalRecaudado: number;
}

export interface PeriodoResumen {
  cantidadPedidos: number;
  cantidadProductos: number;
  totalRecaudado: number;
}

export interface ReporteResponse<T> {
  success: boolean;
  data: T;
  resumen?: PeriodoResumen;
  reason?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  constructor(private http: HttpClient, private global: GlobalService) {}

  getTopProductos(limit: number, fechaInicio?: string, fechaFin?: string): Observable<ReporteResponse<TopProductoReporte[]>> {
    let params = new HttpParams().set('limit', limit);
    if (fechaInicio) params = params.set('fechaInicio', fechaInicio);
    if (fechaFin) params = params.set('fechaFin', fechaFin);
    return this.http.get<ReporteResponse<TopProductoReporte[]>>(`${this.global.apiUrl}/api/reports/top-products`, { params });
  }

  getProductosPorCategoria(fechaInicio?: string, fechaFin?: string): Observable<ReporteResponse<CategoriaReporte[]>> {
    let params = new HttpParams();
    if (fechaInicio) params = params.set('fechaInicio', fechaInicio);
    if (fechaFin) params = params.set('fechaFin', fechaFin);
    return this.http.get<ReporteResponse<CategoriaReporte[]>>(`${this.global.apiUrl}/api/reports/products-by-category`, { params });
  }

  getVentasPorPeriodo(fechaInicio: string, fechaFin: string): Observable<ReporteResponse<PeriodoReporteFila[]>> {
    let params = new HttpParams();
    if (fechaInicio) params = params.set('fechaInicio', fechaInicio);
    if (fechaFin) params = params.set('fechaFin', fechaFin);
    return this.http.get<ReporteResponse<PeriodoReporteFila[]>>(`${this.global.apiUrl}/api/reports/sales-by-period`, { params });
  }
}
