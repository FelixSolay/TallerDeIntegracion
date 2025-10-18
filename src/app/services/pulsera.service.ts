import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PulseraService {
  private apiUrl = 'http://localhost:5000/api/pulseras'; // URL del backend

  constructor(private http: HttpClient) { }

  // Obtener todas las pulseras
  getPulseras(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  // Guardar una nueva pulsera
  addPulsera(pulsera: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, pulsera);
  }
}
