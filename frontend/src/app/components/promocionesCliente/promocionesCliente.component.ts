import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PromocionService, Promocion, PromocionResponse } from '../../services/promocion.service';
import { ProductoService, Producto, ProductoResponse } from '../../services/producto.service';
import { FavoritosService, FavoritosResponse } from '../../services/favoritos.service';
import { GlobalService } from '../../services/global.service';

interface PromocionCardItem {
  promocion: Promocion;
  producto: Producto;
  cantidad: number;
  esFavorito: boolean;
  precioVigente: number;
}

@Component({
  selector: 'app-promociones-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promocionesCliente.component.html',
  styleUrl: './promocionesCliente.component.css'
})
export class PromocionesClienteComponent implements OnInit, OnDestroy {
  promociones: PromocionCardItem[] = [];
  cargando = true;
  error = '';
  dniCliente = '';

  private favoritosIds: Set<string> = new Set();
  private favoritosSub?: Subscription;
  private promocionesBase: Promocion[] = [];
  private productosMap: Map<string, Producto> = new Map();

  constructor(
    private promocionService: PromocionService,
    private productoService: ProductoService,
    private favoritosService: FavoritosService,
    private globalService: GlobalService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.globalService.checkLoggedIn('/promociones');
    this.dniCliente = sessionStorage.getItem('dni') ?? '';

    this.favoritosSub = this.favoritosService.favoritosIds$.subscribe(ids => {
      this.favoritosIds = new Set(ids);
      this.actualizarEstadoFavoritos();
    });

    if (this.dniCliente) {
      this.cargarFavoritos();
    }

    this.cargarDatos();
  }

  ngOnDestroy(): void {
    this.favoritosSub?.unsubscribe();
  }

  private cargarFavoritos(): void {
    this.favoritosService.obtenerFavoritos(this.dniCliente).subscribe({
      next: (_resp: FavoritosResponse) => {
        // El BehaviorSubject interno ya se actualiza en el servicio.
      },
      error: (error: unknown) => {
        console.error('Error al cargar favoritos:', error);
      }
    });
  }

  private cargarDatos(): void {
    this.cargando = true;
    this.error = '';
    this.promocionService.listar(true).subscribe({
      next: (resp: PromocionResponse) => {
        this.promocionesBase = resp.promociones ?? [];
        if (this.promocionesBase.length === 0) {
          this.promociones = [];
          this.cargando = false;
          return;
        }
        this.cargarProductosRelacionados();
      },
      error: (err: unknown) => {
        console.error('Error al obtener promociones:', err);
        this.error = 'No pudimos cargar las promociones disponibles.';
        this.cargando = false;
      }
    });
  }

  private cargarProductosRelacionados(): void {
    this.productoService.obtenerProductos({ activo: true }).subscribe({
      next: (resp: ProductoResponse) => {
        const productos = resp.productos ?? [];
        this.productosMap.clear();
        productos.forEach(prod => {
          if (prod._id) {
            this.productosMap.set(prod._id, prod);
          }
        });
        this.construirPromociones();
        this.cargando = false;
      },
      error: (err: unknown) => {
        console.error('Error al cargar productos relacionados:', err);
        this.error = 'No pudimos cargar los productos asociados a las promociones.';
        this.cargando = false;
      }
    });
  }

  private construirPromociones(): void {
    const tarjetas: PromocionCardItem[] = [];

    for (const promo of this.promocionesBase) {
      const productId = typeof promo.productId === 'string' ? promo.productId : promo.productId?._id;
      if (!productId) {
        continue;
      }

      const productoBase = this.productosMap.get(productId) ?? this.crearProductoFallback(promo);
      if (!productoBase || !productoBase._id) {
        continue;
      }

      const precioVigente = promo.precioPromocional ?? productoBase.precio;
      tarjetas.push({
        promocion: promo,
        producto: { ...productoBase },
        cantidad: 1,
        esFavorito: this.favoritosIds.has(productoBase._id),
        precioVigente
      });
    }

    this.promociones = tarjetas;
  }

  private crearProductoFallback(promo: Promocion): Producto | null {
    if (typeof promo.productId === 'object' && promo.productId?._id) {
      return {
        _id: promo.productId._id,
        nombre: promo.productId.nombre ?? 'Producto en promoción',
        precio: promo.productId.precio ?? promo.precioOriginal ?? promo.precioPromocional,
        descripcion: '',
        imagen: promo.productId.imagen,
        activo: true
      };
    }
    return null;
  }

  incrementarCantidad(item: PromocionCardItem): void {
    if (item.producto.stock && item.cantidad >= item.producto.stock) {
      return;
    }
    item.cantidad++;
  }

  decrementarCantidad(item: PromocionCardItem): void {
    if (item.cantidad > 1) {
      item.cantidad--;
    }
  }

  agregarAlCarrito(item: PromocionCardItem): void {
    const dni = this.dniCliente;
    if (!dni) {
      alert('Debes iniciar sesión como cliente para agregar productos al carrito.');
      this.router.navigateByUrl('/login');
      return;
    }

    const productId = item.producto._id;
    if (!productId) {
      alert('No se pudo identificar el producto de la promoción.');
      return;
    }

    const payload = {
      productId,
      nombre: item.producto.nombre,
      precioUnitario: item.precioVigente,
      cantidad: item.cantidad
    };

    this.productoService.addToCart(dni, payload).subscribe({
      next: (response) => {
        if (response && response.success) {
          const total = response.carrito?.total ?? 0;
          this.globalService.setCartTotal(total);
          alert(`${item.producto.nombre} se agregó al carrito con precio promocional.`);
          item.cantidad = 1;
        } else {
          alert('No se pudo agregar la promoción al carrito.');
        }
      },
      error: (err: unknown) => {
        console.error('Error al agregar promoción al carrito:', err);
        alert('No se pudo agregar la promoción al carrito.');
      }
    });
  }

  toggleFavorito(item: PromocionCardItem): void {
    if (!this.dniCliente) {
      alert('Debes iniciar sesión como cliente para gestionar favoritos.');
      this.router.navigateByUrl('/login');
      return;
    }

    const productId = item.producto._id;
    if (!productId) {
      alert('No se pudo identificar el producto para favoritos.');
      return;
    }

    const esFavorito = this.favoritosIds.has(productId);
    const accion = esFavorito
      ? this.favoritosService.eliminarFavorito(this.dniCliente, productId)
      : this.favoritosService.agregarFavorito(this.dniCliente, productId);

    accion.subscribe({
      next: (resp: FavoritosResponse) => {
        if (resp.success) {
          item.esFavorito = !esFavorito;
          const mensaje = esFavorito
            ? `${item.producto.nombre} se eliminó de tus favoritos.`
            : `${item.producto.nombre} se agregó a tus favoritos.`;
          alert(mensaje);
        } else {
          alert('No se pudo actualizar el favorito.');
        }
      },
      error: (err: unknown) => {
        console.error('Error al actualizar favorito:', err);
        alert('Ocurrió un problema al actualizar tus favoritos.');
      }
    });
  }

  formatearPrecio(valor: number): string {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(valor);
  }

  formatearEtiquetaPromocion(item: PromocionCardItem): string {
    const promo = item.promocion;
    const original = this.obtenerPrecioOriginal(item);
    const actual = item.precioVigente;
    if (original > 0 && actual >= 0) {
      const porcentaje = Math.round((1 - actual / original) * 100);
      if (porcentaje > 0) {
        return `-${porcentaje}%`;
      }
    }

    if (promo.tipo === 'porcentaje') {
      return `-${promo.valor}%`;
    }
    return `-${this.formatearPrecio(promo.valor)}`;
  }

  obtenerPrecioOriginal(item: PromocionCardItem): number {
    if (item.promocion.precioOriginal !== undefined) {
      return item.promocion.precioOriginal;
    }
    return item.producto.precio;
  }

  private actualizarEstadoFavoritos(): void {
    if (!this.promociones.length) {
      return;
    }

    this.promociones.forEach(item => {
      const id = item.producto._id ?? '';
      item.esFavorito = id !== '' && this.favoritosIds.has(id);
    });
  }
}
