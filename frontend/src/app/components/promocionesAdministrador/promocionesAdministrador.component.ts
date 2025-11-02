import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PromocionService, Promocion, PromocionProductoRef } from '../../services/promocion.service';
import { ProductoService, Producto } from '../../services/producto.service';
import { GlobalService } from '../../services/global.service';

@Component({
  selector: 'app-promociones-administrador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promocionesAdministrador.component.html',
  styleUrl: './promocionesAdministrador.component.css'
})
export class PromocionesAdministradorComponent implements OnInit {
  productos: Producto[] = [];
  promociones: Promocion[] = [];
  cargando = true;
  error = '';

  // Form creación
  form = {
    productId: '',
    tipo: 'porcentaje' as 'porcentaje' | 'monto',
    valor: 0,
    fechaInicio: '',
    fechaFin: ''
  };

  constructor(
    private promoService: PromocionService,
    private productoService: ProductoService,
    private globalService: GlobalService
  ) {}

  ngOnInit(): void {
    this.globalService.checkLoggedIn('/promocionesAdministrador');
    this.cargarData();
  }

  cargarData(): void {
    this.cargando = true;
    this.error = '';
    this.productoService.obtenerProductos({ activo: true }).subscribe({
      next: (resp) => {
        this.productos = resp.productos || [];
        this.cargarPromociones();
      },
      error: (err) => {
        console.error('Error cargando productos:', err);
        this.error = 'No se pudieron cargar los productos';
        this.cargando = false;
      }
    });
  }

  cargarPromociones(): void {
    this.promoService.listar().subscribe({
      next: (resp) => {
        this.promociones = (resp.promociones || []).map(p => ({ ...p }));
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando promociones:', err);
        this.error = 'No se pudieron cargar las promociones';
        this.cargando = false;
      }
    });
  }

  crearPromocion(): void {
    if (!this.form.productId || !this.form.fechaInicio || !this.form.fechaFin) {
      alert('Completá producto, fecha de inicio y fecha de fin');
      return;
    }
    if (this.form.tipo === 'porcentaje' && (this.form.valor < 0 || this.form.valor > 100)) {
      alert('El porcentaje debe ser entre 0 y 100');
      return;
    }
    if (this.form.tipo === 'monto' && this.form.valor < 0) {
      alert('El monto no puede ser negativo');
      return;
    }

    this.promoService.crear({
      productId: this.form.productId,
      tipo: this.form.tipo,
      valor: this.form.valor,
      fechaInicio: this.form.fechaInicio,
      fechaFin: this.form.fechaFin
    }).subscribe({
      next: (resp) => {
        if (resp.success && resp.promocion) {
          this.promociones.unshift(resp.promocion);
          alert('Promoción creada');
          this.resetForm();
        }
      },
      error: (err) => {
        console.error('Error creando promoción:', err);
        alert('No se pudo crear la promoción');
      }
    });
  }

  resetForm(): void {
    this.form = {
      productId: '',
      tipo: 'porcentaje',
      valor: 0,
      fechaInicio: '',
      fechaFin: ''
    };
  }

  guardarCambios(p: Promocion): void {
    if (!p._id) return;
    const cambios: Partial<Promocion> = {
      tipo: p.tipo,
      valor: p.valor,
      fechaInicio: p.fechaInicio,
      fechaFin: p.fechaFin,
      activo: p.activo
    };
    this.promoService.actualizar(p._id, cambios).subscribe({
      next: (resp) => {
        if (resp.success && resp.promocion) {
          // Actualizar precios recalculados
          p.precioOriginal = resp.promocion.precioOriginal;
          p.precioPromocional = resp.promocion.precioPromocional;
          alert('Promoción modificada');
        }
      },
      error: (err) => {
        console.error('Error modificando promoción:', err);
        alert('No se pudo modificar la promoción');
      }
    });
  }

  eliminar(p: Promocion): void {
    if (!p._id) return;
    if (!confirm('¿Eliminar promoción?')) return;
    this.promoService.eliminar(p._id).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.promociones = this.promociones.filter(x => x._id !== p._id);
          alert('Promoción eliminada');
        }
      },
      error: (err) => {
        console.error('Error eliminando promoción:', err);
        alert('No se pudo eliminar la promoción');
      }
    });
  }

  nombreProducto(id: string | PromocionProductoRef): string {
    if (!id) return '';

    if (typeof id !== 'string') {
      if (id.nombre) return id.nombre;
      id = id._id;
    }

    const prod = this.productos.find(p => p._id === id);
    return prod ? prod.nombre : id;
  }

  // Helpers para inputs type="date"
  toDateInput(value: string | Date | undefined | null): string {
    if (!value) return '';
    if (typeof value === 'string') {
      // Si viene ISO con tiempo, quedarnos con AAAA-MM-DD
      if (value.includes('T')) return value.slice(0, 10);
      return value;
    }
    // Date a ISO y tomar solo fecha
    try {
      return value.toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }

  onFechaChange(p: Promocion, field: 'fechaInicio' | 'fechaFin', value: string): void {
    // Guardamos como string AAAA-MM-DD (el backend puede parsearlo como Date)
    (p as any)[field] = value;
  }
}
