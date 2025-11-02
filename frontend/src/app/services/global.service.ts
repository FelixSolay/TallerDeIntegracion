import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GlobalService {
  router = inject(Router);
  
  // Variables globales
  private _url = new BehaviorSubject<string>('');
  private _imageClass = new BehaviorSubject<string>('default-style');
  
  // URL base del servidor
  public apiUrl = 'http://localhost:3000';
  
  // Observable para que los componentes puedan suscribirse
  url$ = this._url.asObservable();
  imageClass$ = this._imageClass.asObservable();

  // BehaviorSubject para el total del carrito
  private _cartTotal = new BehaviorSubject<number>(0);
  cartTotal$ = this._cartTotal.asObservable();

  setCartTotal(total: number): void {
    this._cartTotal.next(total);
  }

  checkLoggedIn(url: string) {
    if(sessionStorage.getItem("isLoggedIn") != "true") {
      this._url.next(url);
      this.router.navigateByUrl("/login");
    }
  }

  updateUrl(newUrl: string): void {
    this._url.next(newUrl);
  }
}
