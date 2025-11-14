import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PromocionService, Promocion, PromocionResponse } from '../../services/promocion.service';
import { ProductoService, Producto, ProductoResponse } from '../../services/producto.service';
import { FavoritosService, FavoritosResponse } from '../../services/favoritos.service';
import { GlobalService } from '../../services/global.service';
import { CategoriaService, Categoria, CategoriaResponse } from '../../services/categoria.service';

interface PromocionCardItem {
  promocion: Promocion;
  producto: Producto;
  cantidad: number;
  esFavorito: boolean;
  precioVigente: number;
}

type OrdenPromos = 'relevancia' | 'nombre-asc' | 'nombre-desc' | 'precio-asc' | 'precio-desc';

@Component({
  selector: 'app-promociones-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promocionesCliente.component.html',
  styleUrl: './promocionesCliente.component.css'
})
export class PromocionesClienteComponent implements OnInit, OnDestroy {
  promociones: PromocionCardItem[] = [];
  promocionesOrdenadas: PromocionCardItem[] = [];
  promocionesFiltradas: PromocionCardItem[] = [];
  cargando = true;
  cargandoCategorias = true;
  error = '';
  dniCliente = '';
  ordenSeleccionado: OrdenPromos = 'relevancia';
  categoriaSeleccionada = '';
  
  categorias: Categoria[] = [];
  gruposCategorias: Array<{ padre: Categoria; hijos: Array<Categoria & { disabled?: boolean }> }> = [];
  huerfanos: Categoria[] = [];

  private favoritosIds: Set<string> = new Set();
  private favoritosSub?: Subscription;
  private promocionesBase: Promocion[] = [];
  private productosMap: Map<string, Producto> = new Map();

  constructor(
    private promocionService: PromocionService,
    private productoService: ProductoService,
    private favoritosService: FavoritosService,
    private globalService: GlobalService,
    private categoriaService: CategoriaService,
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

    this.cargarCategorias();
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
          this.promocionesOrdenadas = [];
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
    this.aplicarOrdenamiento();
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
      this.promocionesFiltradas = [...this.promocionesOrdenadas];
    } else {
      this.promocionesFiltradas = this.promocionesOrdenadas.filter(item => {
        const catId = typeof item.producto.categoriaId === 'string' 
          ? item.producto.categoriaId 
          : (item.producto.categoriaId as any)?._id;
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
    this.aplicarOrdenamiento();
  }

  onOrdenChange(): void {
    this.aplicarOrdenamiento();
  }

  private aplicarOrdenamiento(): void {
    if (!this.promociones.length) {
      this.promocionesOrdenadas = [];
      this.promocionesFiltradas = [];
      return;
    }

    this.promocionesOrdenadas = [...this.promociones].sort((a, b) => this.compararPromociones(a, b));
    this.aplicarFiltros();
  }

  private compararPromociones(a: PromocionCardItem, b: PromocionCardItem): number {
    switch (this.ordenSeleccionado) {
      case 'nombre-asc':
        return a.producto.nombre.localeCompare(b.producto.nombre, 'es', { sensitivity: 'base' });
      case 'nombre-desc':
        return b.producto.nombre.localeCompare(a.producto.nombre, 'es', { sensitivity: 'base' });
      case 'precio-asc':
        return a.precioVigente - b.precioVigente;
      case 'precio-desc':
        return b.precioVigente - a.precioVigente;
      case 'relevancia':
      default:
        return this.compararPorRelevancia(a, b);
    }
  }

  private compararPorRelevancia(a: PromocionCardItem, b: PromocionCardItem): number {
    const ahorroA = this.calcularAhorro(a);
    const ahorroB = this.calcularAhorro(b);

    if (ahorroA !== ahorroB) {
      return ahorroB - ahorroA;
    }

    if (!!a.promocion !== !!b.promocion) {
      return a.promocion ? -1 : 1;
    }

    return a.producto.nombre.localeCompare(b.producto.nombre, 'es', { sensitivity: 'base' });
  }

  private calcularAhorro(item: PromocionCardItem): number {
    const original = this.obtenerPrecioOriginal(item);
    const ahorro = original - item.precioVigente;
    return ahorro > 0 ? ahorro : 0;
  }
}
