import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { GlobalService } from './global.service';
import { Producto } from './producto.service';

export interface FavoritosResponse {
  success: boolean;
  favoritos?: Producto[];
  favoritosIds?: string[];
  message?: string;
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FavoritosService {
  private apiUrl: string;
  private favoritosIdsSubject = new BehaviorSubject<string[]>([]);
  favoritosIds$ = this.favoritosIdsSubject.asObservable();

  constructor(private http: HttpClient, private globalService: GlobalService) {
    this.apiUrl = `${this.globalService.apiUrl}/api/customers`;
  }

  obtenerFavoritos(dni: string): Observable<FavoritosResponse> {
    return this.http.get<FavoritosResponse>(`${this.apiUrl}/${dni}/favorites`).pipe(
      tap(response => this.syncFavoritos(response))
    );
  }

  agregarFavorito(dni: string, productId: string): Observable<FavoritosResponse> {
    return this.http.post<FavoritosResponse>(`${this.apiUrl}/${dni}/favorites`, { productId }).pipe(
      tap(response => this.syncFavoritos(response))
    );
  }

  eliminarFavorito(dni: string, productId: string): Observable<FavoritosResponse> {
    return this.http.delete<FavoritosResponse>(`${this.apiUrl}/${dni}/favorites/${productId}`).pipe(
      tap(response => this.syncFavoritos(response))
    );
  }

  updateFavoritosCache(ids: string[]): void {
    this.favoritosIdsSubject.next(ids);
  }

  getFavoritosIdsSnapshot(): string[] {
    return this.favoritosIdsSubject.getValue();
  }

  private syncFavoritos(response: FavoritosResponse): void {
    if (response && response.success) {
      if (response.favoritosIds) {
        this.updateFavoritosCache(response.favoritosIds);
        return;
      }

      if (response.favoritos) {
        const ids = response.favoritos
          .filter(producto => !!producto && !!producto._id)
          .map(producto => producto._id!) as string[];
        this.updateFavoritosCache(ids);
      }
    }
  }
}
