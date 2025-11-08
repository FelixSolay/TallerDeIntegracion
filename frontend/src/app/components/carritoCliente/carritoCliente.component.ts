import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProductoService } from '../../services/producto.service';
import { GlobalService } from '../../services/global.service';

interface CartItem {
  productId?: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
}

@Component({
  selector: 'app-carrito-cliente',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carritoCliente.component.html',
  styleUrls: ['./carritoCliente.component.css']
})
export class CarritoClienteComponent implements OnInit {
  items: CartItem[] = [];
  total: number = 0;
  cargando: boolean = true;
  dni: string = '';

  constructor(
    private productoService: ProductoService,
    private globalService: GlobalService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.globalService.checkLoggedIn('/carrito');
    this.dni = sessionStorage.getItem('dni') || '';
    
    if (!this.dni) {
      alert('Debes iniciar sesión para ver tu carrito');
      this.router.navigateByUrl('/login');
      return;
    }

    this.cargarCarrito();
  }

  cargarCarrito(): void {
    this.cargando = true;
    this.productoService.getCart(this.dni).subscribe({
      next: (response) => {
        if (response && response.success) {
          this.items = response.carrito?.items || [];
          this.total = response.carrito?.total || 0;
          this.globalService.setCartTotal(this.total);
        }
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar carrito:', error);
        this.cargando = false;
        alert('Error al cargar el carrito');
      }
    });
  }

  incrementarCantidad(item: CartItem): void {
    const nuevaCantidad = item.cantidad + 1;
    this.actualizarCantidad(item, nuevaCantidad);
  }

  decrementarCantidad(item: CartItem): void {
    if (item.cantidad > 1) {
      const nuevaCantidad = item.cantidad - 1;
      this.actualizarCantidad(item, nuevaCantidad);
    }
  }

  actualizarCantidad(item: CartItem, nuevaCantidad: number): void {
    const payload = {
      productId: item.productId || null,
      nombre: item.nombre,
      cantidad: nuevaCantidad
    };

    this.productoService.updateCartItem(this.dni, payload).subscribe({
      next: (response) => {
        if (response && response.success) {
          this.items = response.carrito?.items || [];
          this.total = response.carrito?.total || 0;
          this.globalService.setCartTotal(this.total);
        }
      },
      error: (error) => {
        console.error('Error al actualizar cantidad:', error);
        alert('Error al actualizar la cantidad');
      }
    });
  }

  eliminarItem(item: CartItem): void {
    if (!confirm(`¿Eliminar "${item.nombre}" del carrito?`)) {
      return;
    }

    const payload = {
      productId: item.productId || null,
      nombre: item.nombre
    };

    this.productoService.removeCartItem(this.dni, payload).subscribe({
      next: (response) => {
        if (response && response.success) {
          this.items = response.carrito?.items || [];
          this.total = response.carrito?.total || 0;
          this.globalService.setCartTotal(this.total);
        }
      },
      error: (error) => {
        console.error('Error al eliminar item:', error);
        alert('Error al eliminar el producto');
      }
    });
  }

  vaciarCarrito(): void {
    if (!confirm('¿Estás seguro de que deseas vaciar el carrito?')) {
      return;
    }

    // Eliminar todos los items uno por uno
    const promises = this.items.map(item => {
      const payload = {
        productId: item.productId || null,
        nombre: item.nombre
      };
      return this.productoService.removeCartItem(this.dni, payload).toPromise();
    });

    Promise.all(promises).then(() => {
      this.items = [];
      this.total = 0;
      this.globalService.setCartTotal(0);
      alert('Carrito vaciado correctamente');
    }).catch(error => {
      console.error('Error al vaciar carrito:', error);
      alert('Error al vaciar el carrito');
      this.cargarCarrito(); // Recargar para sincronizar
    });
  }

  irAPago(): void {
    if (this.items.length === 0) {
      alert('El carrito está vacío');
      return;
    }
    this.router.navigateByUrl('/pago');
  }

  formatearPrecio(precio: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(precio);
  }

  volverAProductos(): void {
    this.router.navigateByUrl('/productos');
  }

  // Cantidad total de items (suma de cantidades)
  getCantidadTotal(): number {
    if (!this.items || this.items.length === 0) return 0;
    return this.items.reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0);
  }
}
