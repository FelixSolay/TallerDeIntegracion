import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductoService, Producto } from '../../services/producto.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  readonly visibleItems = 4;
  private currentIndex = 0;
  private readonly fallbackProductImage =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="240" viewBox="0 0 200 240">
        <rect width="200" height="240" rx="18" fill="#E4EFE9" />
        <g fill="#47B20E" opacity="0.35">
          <path d="M100 60c-30 0-54 24-54 54s24 54 54 54 54-24 54-54-24-54-54-54Zm0 90c-19.9 0-36-16.1-36-36s16.1-36 36-36 36 16.1 36 36-16.1 36-36 36Z"/>
          <path d="M124 52H76c-9.9 0-18 8.1-18 18v100c0 9.9 8.1 18 18 18h48c9.9 0 18-8.1 18-18V70c0-9.9-8.1-18-18-18Zm2 118c0 1.1-.9 2-2 2H76c-1.1 0-2-.9-2-2V70c0-1.1.9-2 2-2h48c1.1 0 2 .9 2 2v100Z"/>
        </g>
      </svg>
    `);

  loading = true;
  error = '';
  products: Producto[] = [];

  constructor(private productoService: ProductoService) {}

  ngOnInit(): void {
    this.cargarProductosDestacados();
  }

  get visibleProducts(): Producto[] {
    if (this.products.length === 0) {
      return [];
    }

    if (this.products.length <= this.visibleItems) {
      return this.products;
    }

    return Array.from({ length: this.visibleItems }, (_, offset) => {
      const index = (this.currentIndex + offset) % this.products.length;
      return this.products[index];
    });
  }

  goNext(): void {
    if (this.products.length > this.visibleItems) {
      this.currentIndex = (this.currentIndex + 1) % this.products.length;
    }
  }

  goPrev(): void {
    if (this.products.length > this.visibleItems) {
      this.currentIndex = (this.currentIndex - 1 + this.products.length) % this.products.length;
    }
  }

  getProductImage(producto: Producto): string {
    return producto.imagen && producto.imagen.trim() !== ''
      ? producto.imagen
      : this.fallbackProductImage;
  }

  private cargarProductosDestacados(): void {
    this.loading = true;
    this.error = '';

    this.productoService.obtenerProductosDestacados().subscribe({
      next: (response) => {
        if (response.success && response.productos && response.productos.length > 0) {
          this.products = response.productos;
          this.currentIndex = 0;
          this.error = '';
        } else {
          this.products = [];
          this.error = 'No tenemos productos destacados cargados todavía.';
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar productos destacados:', err);
        this.loading = false;
        this.error = 'Hubo un problema al cargar los productos. Intenta nuevamente más tarde.';
      }
    });
  }
}
