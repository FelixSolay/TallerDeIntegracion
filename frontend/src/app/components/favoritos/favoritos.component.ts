import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GlobalService } from '../../services/global.service';
import { FavoritosService, FavoritosResponse } from '../../services/favoritos.service';
import { Producto, ProductoService } from '../../services/producto.service';
import { PromocionService, Promocion, PromocionResponse } from '../../services/promocion.service';

interface FavoritoConCantidad extends Producto {
  cantidad: number;
  precioVigente: number;
  promocion?: Promocion;
  esFavorito?: boolean;
}

@Component({
  selector: 'app-favoritos',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './favoritos.component.html',
  styleUrl: './favoritos.component.css'
})
export class FavoritosComponent implements OnInit {
  favoritos: FavoritoConCantidad[] = [];
  cargando = true;
  dniCliente = '';
  errorMensaje = '';

  constructor(
    private globalService: GlobalService,
    private favoritosService: FavoritosService,
    private productoService: ProductoService,
    private promocionService: PromocionService
  ) {}

  ngOnInit(): void {
    this.globalService.checkLoggedIn('/favoritos');
    this.dniCliente = sessionStorage.getItem('dni') ?? '';

    if (!this.dniCliente) {
      this.cargando = false;
      this.errorMensaje = 'No se encontró la información del cliente. Inicia sesión nuevamente.';
      return;
    }

    this.cargarPromocionesActivas();
    this.cargarFavoritos();
  }

  cargarFavoritos(): void {
    this.cargando = true;
    this.errorMensaje = '';
    this.favoritosService.obtenerFavoritos(this.dniCliente).subscribe({
      next: (response: FavoritosResponse) => {
        if (!response.success) {
          this.errorMensaje = 'No se pudieron cargar tus favoritos en este momento.';
        }
        this.refrescarListado(response);
        this.cargando = false;
      },
      error: (error: any) => {
        console.error('Error al obtener favoritos:', error);
        this.errorMensaje = 'Ocurrió un error al obtener tus favoritos.';
        this.favoritos = [];
        this.cargando = false;
      }
    });
  }

  incrementarCantidad(producto: FavoritoConCantidad): void {
    if (producto.stock && producto.cantidad < producto.stock) {
      producto.cantidad++;
    }
  }

  decrementarCantidad(producto: FavoritoConCantidad): void {
    if (producto.cantidad > 1) {
      producto.cantidad--;
    }
  }

  agregarAlCarrito(producto: FavoritoConCantidad): void {
    const payload = {
      productId: producto._id ?? null,
      nombre: producto.nombre,
      precioUnitario: producto.precioVigente,
      cantidad: producto.cantidad
    };

    this.productoService.addToCart(this.dniCliente, payload).subscribe({
      next: (response) => {
        if (response && response.success) {
          const total = response.carrito?.total ?? 0;
          this.globalService.setCartTotal(total);
          alert(`Se agregaron ${producto.cantidad} unidad(es) de ${producto.nombre} al carrito`);
          producto.cantidad = 1;
        } else {
          alert('No se pudo agregar el producto al carrito.');
        }
      },
      error: (error: any) => {
        console.error('Error al agregar al carrito desde favoritos:', error);
        alert('Ocurrió un error al agregar el producto al carrito.');
      }
    });
  }

  removerFavorito(producto: FavoritoConCantidad): void {
    if (!producto._id) {
      return;
    }

    this.favoritosService.eliminarFavorito(this.dniCliente, producto._id).subscribe({
      next: (response: FavoritosResponse) => {
        if (response.success) {
          alert(`${producto.nombre} se eliminó de tus favoritos.`);
          this.refrescarListado(response);
        } else {
          alert('No se pudo eliminar el producto de favoritos.');
        }
      },
      error: (error: any) => {
        console.error('Error al eliminar favorito:', error);
        alert('Ocurrió un error al eliminar el producto de favoritos.');
      }
    });
  }

  formatearPrecio(precio: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(precio);
  }

  formatearEtiquetaPromocion(producto: FavoritoConCantidad): string {
    const promocion = producto.promocion;
    if (!promocion) return '';

    const original = this.obtenerPrecioOriginal(producto);
    const actual = producto.precioVigente;
    if (original > 0 && actual >= 0) {
      const porcentaje = Math.round((1 - actual / original) * 100);
      if (porcentaje > 0) {
        return `-${porcentaje}%`;
      }
    }

    if (promocion.tipo === 'porcentaje') {
      return `-${promocion.valor}%`;
    }
    return `-${this.formatearPrecio(promocion.valor)}`;
  }

  obtenerPrecioOriginal(producto: FavoritoConCantidad): number {
    if (producto.promocion?.precioOriginal !== undefined) {
      return producto.promocion.precioOriginal;
    }
    return producto.precio;
  }

  private refrescarListado(response: FavoritosResponse): void {
    if (!response.favoritos || response.favoritos.length === 0) {
      this.favoritos = [];
      return;
    }

    this.favoritos = response.favoritos
      .filter(producto => producto.activo !== false)
      .map(producto => ({
        ...producto,
        cantidad: 1,
        precioVigente: producto.precio,
        esFavorito: true
      }));
    this.errorMensaje = '';
    this.aplicarPromocionesAFavoritos();
  }

  private cargarPromocionesActivas(): void {
    this.promocionService.listar(true).subscribe({
      next: (resp: PromocionResponse) => {
        this.promocionesActivas.clear();
        const promos = resp.promociones ?? [];
        promos.forEach((promo: Promocion) => {
          const productId = typeof promo.productId === 'string' ? promo.productId : promo.productId?._id;
          if (productId) {
            this.promocionesActivas.set(productId, promo);
          }
        });
        this.aplicarPromocionesAFavoritos();
      },
      error: (err: unknown) => {
        console.error('Error al cargar promociones activas:', err);
      }
    });
  }

  private aplicarPromocionesAFavoritos(): void {
    if (!this.favoritos.length) {
      return;
    }

    this.favoritos = this.favoritos.map(fav => {
      const promo = fav._id ? this.promocionesActivas.get(fav._id) : undefined;
      const precioVigente = promo?.precioPromocional ?? fav.precio;
      return {
        ...fav,
        promocion: promo,
        precioVigente
      };
    });
  }

  private promocionesActivas: Map<string, Promocion> = new Map();
}
