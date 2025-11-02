import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GlobalService } from './global.service';

export interface Producto {
  _id?: string;
  nombre: string;
  slug?: string;
  descripcion?: string;
  precio: number;
  precioAnterior?: number | null;
  stock?: number;
  categoriaId?: string | null;
  imagen?: string;
  imagenes?: string[];
  marca?: string;
  codigo?: string;
  unidadMedida?: string;
  destacado?: boolean;
  enOferta?: boolean;
  activo?: boolean;
  fechaCreacion?: Date;
}

export interface ProductoResponse {
  success: boolean;
  producto?: Producto;
  productos?: Producto[];
  reason?: string;
  message?: string;
}

export interface ImageUploadResponse {
  success: boolean;
  imageUrl?: string;
  reason?: string;
}

export interface FiltrosProducto {
  categoriaId?: string;
  destacado?: boolean;
  enOferta?: boolean;
  activo?: boolean;
  buscar?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductoService {
  private apiUrl: string;

  constructor(private http: HttpClient, private globalService: GlobalService) {
    this.apiUrl = `${this.globalService.apiUrl}/api/productos`;
  }

  // Obtener todos los productos con filtros opcionales
  obtenerProductos(filtros?: FiltrosProducto): Observable<ProductoResponse> {
    let params = new HttpParams();
    
    if (filtros) {
      if (filtros.categoriaId) params = params.set('categoriaId', filtros.categoriaId);
      if (filtros.destacado !== undefined) params = params.set('destacado', filtros.destacado.toString());
      if (filtros.enOferta !== undefined) params = params.set('enOferta', filtros.enOferta.toString());
      if (filtros.activo !== undefined) params = params.set('activo', filtros.activo.toString());
      if (filtros.buscar) params = params.set('buscar', filtros.buscar);
    }
    
    return this.http.get<ProductoResponse>(this.apiUrl, { params });
  }

  // Obtener un producto por ID
  obtenerProducto(id: string): Observable<ProductoResponse> {
    return this.http.get<ProductoResponse>(`${this.apiUrl}/${id}`);
  }

  // Obtener producto por slug
  obtenerProductoPorSlug(slug: string): Observable<ProductoResponse> {
    return this.http.get<ProductoResponse>(`${this.apiUrl}/slug/${slug}`);
  }

  // Obtener productos destacados
  obtenerProductosDestacados(): Observable<ProductoResponse> {
    return this.http.get<ProductoResponse>(`${this.apiUrl}/destacados`);
  }

  // Obtener productos en oferta
  obtenerProductosEnOferta(): Observable<ProductoResponse> {
    return this.http.get<ProductoResponse>(`${this.apiUrl}/ofertas`);
  }

  // Crear nuevo producto
  crearProducto(producto: Producto): Observable<ProductoResponse> {
    return this.http.post<ProductoResponse>(this.apiUrl, producto);
  }

  // Actualizar producto
  actualizarProducto(id: string, producto: Partial<Producto>): Observable<ProductoResponse> {
    return this.http.put<ProductoResponse>(`${this.apiUrl}/${id}`, producto);
  }

  // Eliminar producto
  eliminarProducto(id: string): Observable<ProductoResponse> {
    return this.http.delete<ProductoResponse>(`${this.apiUrl}/${id}`);
  }

  // Actualizar stock
  actualizarStock(id: string, stock: number): Observable<ProductoResponse> {
    return this.http.patch<ProductoResponse>(`${this.apiUrl}/${id}/stock`, { stock });
  }

  // Subir imagen
  subirImagen(file: File): Observable<ImageUploadResponse> {
    const formData = new FormData();
    formData.append('imagen', file);
    return this.http.post<ImageUploadResponse>(`${this.apiUrl}/upload-imagen`, formData);
  }

  // CART API
  // Añadir al carrito para un cliente (dni)
  addToCart(dni: string, payload: { productId?: string | null; nombre?: string; precioUnitario: number; cantidad?: number }) {
    return this.http.post<any>(`${this.globalService.apiUrl}/api/customers/${dni}/cart/add`, payload);
  }

  getCart(dni: string) {
    return this.http.get<any>(`${this.globalService.apiUrl}/api/customers/${dni}/cart`);
  }

  updateCartItem(dni: string, payload: { productId?: string | null; nombre?: string; cantidad: number }) {
    return this.http.put<any>(`${this.globalService.apiUrl}/api/customers/${dni}/cart/update`, payload);
  }

  removeCartItem(dni: string, payload: { productId?: string | null; nombre?: string }) {
    // Backend expects body even for DELETE; using post won't be RESTy but we'll use request
    return this.http.request<any>('delete', `${this.globalService.apiUrl}/api/customers/${dni}/cart/remove`, { body: payload });
  }
}

