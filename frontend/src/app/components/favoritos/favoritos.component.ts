import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GlobalService } from '../../services/global.service';
import { FavoritosService, FavoritosResponse } from '../../services/favoritos.service';
import { Producto, ProductoService } from '../../services/producto.service';
import { PromocionService, Promocion, PromocionResponse } from '../../services/promocion.service';
import { CategoriaService, Categoria, CategoriaResponse } from '../../services/categoria.service';

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
  favoritosFiltrados: FavoritoConCantidad[] = [];
  ordenSeleccionado: OrdenFavoritos = 'relevancia';
  categoriaSeleccionada = '';
  cargando = true;
  cargandoCategorias = true;
  dniCliente = '';
  errorMensaje = '';

  categorias: Categoria[] = [];
  gruposCategorias: Array<{ padre: Categoria; hijos: Array<Categoria & { disabled?: boolean }> }> = [];
  huerfanos: Categoria[] = [];

  private promocionesActivas: Map<string, Promocion> = new Map();

  constructor(
    private globalService: GlobalService,
    private favoritosService: FavoritosService,
    private productoService: ProductoService,
    private promocionService: PromocionService,
    private categoriaService: CategoriaService
  ) {}

  ngOnInit(): void {
    this.globalService.checkLoggedIn('/favoritos');
    this.dniCliente = sessionStorage.getItem('dni') ?? '';

    if (!this.dniCliente) {
      this.cargando = false;
      this.errorMensaje = 'No se encontró la información del cliente. Inicia sesión nuevamente.';
      return;
    }

    this.cargarCategorias();
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

    // Eliminación optimista: actualizar UI inmediatamente
    this.favoritos = this.favoritos.filter(f => f._id !== producto._id);
    this.aplicarOrdenamiento();

    // Luego hacer la llamada al servidor
    this.favoritosService.eliminarFavorito(this.dniCliente, producto._id).subscribe({
      next: (response: FavoritosResponse) => {
        if (!response.success) {
          console.warn('No se pudo eliminar el producto de favoritos en el servidor.');
          // Recargar desde el servidor si falló
          this.cargarFavoritos();
        }
      },
      error: (error: unknown) => {
        console.error('Error al eliminar favorito:', error);
        // Recargar desde el servidor si hubo error
        this.cargarFavoritos();
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

  private cargarCategorias(): void {
    this.cargandoCategorias = true;
    this.categoriaService.obtenerCategorias().subscribe({
      next: (resp: CategoriaResponse) => {
        this.categorias = resp.categorias ?? [];
        this.organizarCategorias();
        this.cargandoCategorias = false;
      },
      error: (err: unknown) => {
        console.error('Error al cargar categorías:', err);
        this.cargandoCategorias = false;
      }
    });
  }

  private organizarCategorias(): void {
    const nivel0 = this.categorias.filter(c => c.nivel === 0).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const nivel1 = this.categorias.filter(c => c.nivel === 1).sort((a, b) => a.nombre.localeCompare(b.nombre));
    const nivel2 = this.categorias.filter(c => c.nivel === 2).sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Mapas de hijos por padre
    const hijos1PorPadre0 = new Map<string, Categoria[]>();
    for (const h of nivel1) {
      const padreId = (h.categoriaPadreId as unknown as string) || '';
      if (!hijos1PorPadre0.has(padreId)) hijos1PorPadre0.set(padreId, []);
      hijos1PorPadre0.get(padreId)!.push(h);
    }

    const hijos2PorPadre1 = new Map<string, Categoria[]>();
    for (const h of nivel2) {
      const padreId = (h.categoriaPadreId as unknown as string) || '';
      if (!hijos2PorPadre1.has(padreId)) hijos2PorPadre1.set(padreId, []);
      hijos2PorPadre1.get(padreId)!.push(h);
    }

    // Construir grupos jerárquicos (todas las categorías son seleccionables)
    this.gruposCategorias = [];
    for (const cat0 of nivel0) {
      const subcats1 = hijos1PorPadre0.get(cat0._id!) || [];
      const todosHijos: any[] = [cat0]; // Nivel 0 también es seleccionable

      for (const cat1 of subcats1) {
        todosHijos.push(cat1); // Nivel 1 seleccionable
        const subcats2 = hijos2PorPadre1.get(cat1._id!) || [];
        todosHijos.push(...subcats2); // Nivel 2 seleccionable
      }

      if (todosHijos.length > 1) {
        this.gruposCategorias.push({
          padre: cat0,
          hijos: todosHijos
        });
      }
    }

    // Detectar huérfanos
    const incluidos = new Set<string>();
    for (const g of this.gruposCategorias) {
      for (const h of g.hijos) incluidos.add(h._id!);
    }
    this.huerfanos = [...nivel0, ...nivel1, ...nivel2]
      .filter(h => !incluidos.has(h._id!))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  onCategoriaChange(): void {
    this.aplicarFiltros();
  }

  limpiarFiltros(): void {
    this.categoriaSeleccionada = '';
    this.aplicarFiltros();
  }

  private aplicarFiltros(): void {
    if (!this.categoriaSeleccionada) {
      this.favoritosFiltrados = [...this.favoritosOrdenados];
    } else {
      this.favoritosFiltrados = this.favoritosOrdenados.filter(fav => {
        const catId = typeof fav.categoriaId === 'string' 
          ? fav.categoriaId 
          : (fav.categoriaId as any)?._id;
        return catId === this.categoriaSeleccionada;
      });
    }
  }

  getNombreCategoria(catId: string): string {
    const cat = this.categorias.find(c => c._id === catId);
    return cat?.nombre ?? 'Categoría desconocida';
  }

  getEtiquetaCategoriaOption(cat: any): string {
    if (cat.nivel === 0) {
      return cat.nombre;
    }
    if (cat.nivel === 1) {
      return `\u00A0\u00A0${cat.nombre}`;
    }
    if (cat.nivel === 2) {
      return `\u00A0\u00A0\u00A0\u00A0${cat.nombre}`;
    }
    return cat.nombre;
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
      this.favoritosFiltrados = [];
      return;
    }

    this.favoritosOrdenados = [...this.favoritos].sort((a, b) => this.compararFavoritos(a, b));
    this.aplicarFiltros();
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
