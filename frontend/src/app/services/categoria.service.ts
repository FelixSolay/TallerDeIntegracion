import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GlobalService } from './global.service';

export interface Categoria {
  _id?: string;
  nombre: string;
  slug?: string;
  descripcion?: string;
  nivel: number; // 0: Principal, 1: Subcategoría, 2: Sub-subcategoría
  categoriaPadreId?: string | null;
  imagen?: string;
  icono?: string;
  orden?: number;
  activa?: boolean;
  mostrarEnNavbar?: boolean;
  fechaCreacion?: Date;
  subcategorias?: Categoria[]; // Para respuestas de árbol/navbar
}

export interface CategoriaResponse {
  success: boolean;
  categoria?: Categoria;
  categorias?: Categoria[];
  subcategorias?: Categoria[];
  message?: string;
  error?: string;
  reason?: string;
}

export interface ImageUploadResponse {
  success: boolean;
  imageUrl?: string;
  url?: string;
  error?: string;
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CategoriaService {
  constructor(
    private http: HttpClient,
    private globalService: GlobalService
  ) {}

  // Obtener todas las categorías
  obtenerCategorias(): Observable<CategoriaResponse> {
    return this.http.get<CategoriaResponse>(`${this.globalService.apiUrl}/api/categorias`);
  }

  // Obtener categorías principales (nivel 0)
  obtenerPrincipales(): Observable<CategoriaResponse> {
    return this.http.get<CategoriaResponse>(`${this.globalService.apiUrl}/api/categorias/principales`);
  }

  // Obtener estructura completa para navbar
  obtenerNavbar(): Observable<CategoriaResponse> {
    return this.http.get<CategoriaResponse>(`${this.globalService.apiUrl}/api/categorias/navbar`);
  }

  // Obtener una categoría por ID
  obtenerCategoria(id: string): Observable<CategoriaResponse> {
    return this.http.get<CategoriaResponse>(`${this.globalService.apiUrl}/api/categorias/${id}`);
  }

  // Obtener categoría por slug
  obtenerPorSlug(slug: string): Observable<CategoriaResponse> {
    return this.http.get<CategoriaResponse>(`${this.globalService.apiUrl}/api/categorias/slug/${slug}`);
  }

  // Obtener subcategorías de una categoría
  obtenerSubcategorias(id: string): Observable<CategoriaResponse> {
    return this.http.get<CategoriaResponse>(`${this.globalService.apiUrl}/api/categorias/${id}/subcategorias`);
  }

  // Obtener árbol completo desde una categoría
  obtenerArbol(id: string): Observable<CategoriaResponse> {
    return this.http.get<CategoriaResponse>(`${this.globalService.apiUrl}/api/categorias/${id}/arbol`);
  }

  // Crear nueva categoría
  crearCategoria(categoria: Categoria): Observable<CategoriaResponse> {
    return this.http.post<CategoriaResponse>(`${this.globalService.apiUrl}/api/categorias`, categoria);
  }

  // Actualizar categoría
  actualizarCategoria(id: string, categoria: Partial<Categoria>): Observable<CategoriaResponse> {
    return this.http.put<CategoriaResponse>(`${this.globalService.apiUrl}/api/categorias/${id}`, categoria);
  }

  // Eliminar categoría
  eliminarCategoria(id: string): Observable<CategoriaResponse> {
    return this.http.delete<CategoriaResponse>(`${this.globalService.apiUrl}/api/categorias/${id}`);
  }

  // Subir imagen de categoría
  subirImagen(file: File): Observable<ImageUploadResponse> {
    const formData = new FormData();
    formData.append('imagen', file);
    return this.http.post<ImageUploadResponse>(`${this.globalService.apiUrl}/api/categorias/upload-imagen`, formData);
  }
}
