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
  confirmacionVisible = false;
  itemPendienteEliminar: CartItem | null = null;
  eliminando = false;
  confirmacionVaciarVisible = false;
  vaciando = false;

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
          // Crear nuevas referencias para evitar problemas de caché
          this.items = [...(response.carrito?.items || [])];
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
          // Actualizar con nuevas referencias para evitar caché
          this.items = [...(response.carrito?.items || [])];
          this.total = response.carrito?.total || 0;
          this.globalService.setCartTotal(this.total);
        }
      },
      error: (error) => {
        console.error('Error al actualizar cantidad:', error);
        alert('Error al actualizar la cantidad');
        // Recargar para sincronizar
        this.cargarCarrito();
      }
    });
  }

  solicitarEliminarItem(item: CartItem): void {
    this.itemPendienteEliminar = { ...item };
    this.confirmacionVisible = true;
  }

  cancelarEliminacion(): void {
    this.confirmacionVisible = false;
    this.itemPendienteEliminar = null;
  }

  confirmarEliminacion(): void {
    if (!this.itemPendienteEliminar || this.eliminando) {
      return;
    }

    this.eliminando = true;
    const payload = {
      productId: this.itemPendienteEliminar.productId || null,
      nombre: this.itemPendienteEliminar.nombre
    };

    this.productoService.removeCartItem(this.dni, payload).subscribe({
      next: (response) => {
        if (response && response.success) {
          // Forzar actualización limpia del estado
          this.items = [...(response.carrito?.items || [])];
          this.total = response.carrito?.total || 0;
          this.globalService.setCartTotal(this.total);
        }
        this.eliminando = false;
        this.cancelarEliminacion();
      },
      error: (error) => {
        console.error('Error al eliminar item:', error);
        this.eliminando = false;
        this.cancelarEliminacion();
        // Recargar el carrito para sincronizar
        this.cargarCarrito();
      }
    });
  }

  vaciarCarrito(): void {
    if (this.items.length === 0 || this.vaciando) {
      return;
    }
    this.confirmacionVaciarVisible = true;
  }

  cancelarVaciadoCarrito(): void {
    if (this.vaciando) {
      return;
    }
    this.confirmacionVaciarVisible = false;
  }

  confirmarVaciadoCarrito(): void {
    if (this.items.length === 0 || this.vaciando) {
      this.confirmacionVaciarVisible = false;
      return;
    }

    this.vaciando = true;
    const itemsActuales = [...this.items];
    
    // Eliminar items secuencialmente para evitar race conditions
    this.eliminarItemsSecuencialmente(itemsActuales, 0);
  }

  private eliminarItemsSecuencialmente(items: CartItem[], index: number): void {
    if (index >= items.length) {
      // Todos los items fueron eliminados
      this.items = [];
      this.total = 0;
      this.globalService.setCartTotal(0);
      this.vaciando = false;
      this.confirmacionVaciarVisible = false;
      // Recargar para asegurar sincronización
      this.cargarCarrito();
      return;
    }

    const item = items[index];
    const payload = {
      productId: item.productId || null,
      nombre: item.nombre
    };

    this.productoService.removeCartItem(this.dni, payload).subscribe({
      next: (response) => {
        if (response && response.success) {
          // Actualizar el estado con la respuesta del servidor
          this.items = [...(response.carrito?.items || [])];
          this.total = response.carrito?.total || 0;
          this.globalService.setCartTotal(this.total);
        }
        // Continuar con el siguiente item
        this.eliminarItemsSecuencialmente(items, index + 1);
      },
      error: (error) => {
        console.error('Error al eliminar item durante vaciado:', error);
        // Intentar recargar el carrito y terminar
        this.cargarCarrito();
        this.vaciando = false;
        this.confirmacionVaciarVisible = false;
      }
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
