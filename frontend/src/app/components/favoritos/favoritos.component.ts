import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
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

type OrdenFavoritos = 'relevancia' | 'nombre-asc' | 'nombre-desc' | 'precio-asc' | 'precio-desc';

@Component({
  selector: 'app-favoritos',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './favoritos.component.html',
  styleUrl: './favoritos.component.css'
})
export class FavoritosComponent implements OnInit {
  favoritos: FavoritoConCantidad[] = [];
  favoritosOrdenados: FavoritoConCantidad[] = [];
  ordenSeleccionado: OrdenFavoritos = 'relevancia';
  cargando = true;
  dniCliente = '';
  errorMensaje = '';

  private promocionesActivas: Map<string, Promocion> = new Map();

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
      error: (error: unknown) => {
        console.error('Error al obtener favoritos:', error);
        this.errorMensaje = 'Ocurrió un error al obtener tus favoritos.';
        this.favoritos = [];
        this.favoritosOrdenados = [];
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
          producto.cantidad = 1;
        } else {
          console.warn('No se pudo agregar el producto al carrito.');
        }
      },
      error: (error: unknown) => {
        console.error('Error al agregar al carrito desde favoritos:', error);
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
          this.refrescarListado(response);
        } else {
          console.warn('No se pudo eliminar el producto de favoritos.');
        }
      },
      error: (error: unknown) => {
        console.error('Error al eliminar favorito:', error);
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

  onOrdenChange(): void {
    this.aplicarOrdenamiento();
  }

  private refrescarListado(response: FavoritosResponse): void {
    if (!response.favoritos || response.favoritos.length === 0) {
      this.favoritos = [];
      this.favoritosOrdenados = [];
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
      this.favoritosOrdenados = [];
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
    this.aplicarOrdenamiento();
  }

  private aplicarOrdenamiento(): void {
    if (!this.favoritos.length) {
      this.favoritosOrdenados = [];
      return;
    }

    this.favoritosOrdenados = [...this.favoritos].sort((a, b) => this.compararFavoritos(a, b));
  }

  private compararFavoritos(a: FavoritoConCantidad, b: FavoritoConCantidad): number {
    switch (this.ordenSeleccionado) {
      case 'nombre-asc':
        return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
      case 'nombre-desc':
        return b.nombre.localeCompare(a.nombre, 'es', { sensitivity: 'base' });
      case 'precio-asc':
        return a.precioVigente - b.precioVigente;
      case 'precio-desc':
        return b.precioVigente - a.precioVigente;
      case 'relevancia':
      default:
        return this.compararPorRelevancia(a, b);
    }
  }

  private compararPorRelevancia(a: FavoritoConCantidad, b: FavoritoConCantidad): number {
    const ahorroA = this.calcularAhorro(a);
    const ahorroB = this.calcularAhorro(b);

    if (ahorroA !== ahorroB) {
      return ahorroB - ahorroA;
    }

    if (!!a.promocion !== !!b.promocion) {
      return a.promocion ? -1 : 1;
    }

    return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
  }

  private calcularAhorro(producto: FavoritoConCantidad): number {
    const original = this.obtenerPrecioOriginal(producto);
    const ahorro = original - producto.precioVigente;
    return ahorro > 0 ? ahorro : 0;
  }
}
