import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PromocionService, Promocion, PromocionProductoRef } from '../../services/promocion.service';
import { ProductoService, Producto } from '../../services/producto.service';
import { GlobalService } from '../../services/global.service';
import { ErrorPopupComponent } from '../errorPopup/errorPopup.component';

@Component({
  selector: 'app-promociones-administrador',
  standalone: true,
  imports: [CommonModule, FormsModule, ErrorPopupComponent],
  templateUrl: './promocionesAdministrador.component.html',
  styleUrl: './promocionesAdministrador.component.css'
})
export class PromocionesAdministradorComponent implements OnInit {
  productos: Producto[] = [];
  promociones: Promocion[] = [];
  cargando = true;
  error = '';
  popup = '';
  promocionAEliminar: Promocion | null = null;

  // Form creación
  form = {
    productId: '',
    tipo: 'porcentaje' as 'porcentaje' | 'monto',
    valor: 0,
    fechaInicio: '',
    fechaFin: ''
  };
  formMensaje = '';
  formMensajeTipo: 'error' | 'success' | '' = '';

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
    this.resetFormMensaje();
    if (!this.form.productId || !this.form.fechaInicio || !this.form.fechaFin) {
      this.setFormMensaje('error', 'Completá producto, fecha de inicio y fecha de fin.');
      return;
    }
    if (this.form.tipo === 'porcentaje' && (this.form.valor < 0 || this.form.valor > 100)) {
      this.setFormMensaje('error', 'El porcentaje debe ser entre 0 y 100.');
      return;
    }
    if (this.form.tipo === 'monto' && this.form.valor < 0) {
      this.setFormMensaje('error', 'El monto no puede ser negativo.');
      return;
    }

    // Validar que no haya superposición de fechas
    const fechaInicio = new Date(this.form.fechaInicio);
    const fechaFin = new Date(this.form.fechaFin);

    if (fechaFin < fechaInicio) {
      this.setFormMensaje('error', 'La fecha de fin debe ser posterior a la fecha de inicio.');
      return;
    }

    const promocionConflicto = this.promociones.find(promo => {
      // Solo verificar promociones del mismo producto
      const promoProductId = typeof promo.productId === 'string' 
        ? promo.productId 
        : promo.productId._id;
      
      if (promoProductId !== this.form.productId) {
        return false;
      }

      // Verificar si las fechas se superponen
      const promoInicio = new Date(promo.fechaInicio);
      const promoFin = new Date(promo.fechaFin);

      // Hay superposición si:
      // - La nueva promoción empieza durante una existente
      // - La nueva promoción termina durante una existente
      // - La nueva promoción envuelve completamente a una existente
      const seSuperponen = (
        (fechaInicio >= promoInicio && fechaInicio <= promoFin) ||
        (fechaFin >= promoInicio && fechaFin <= promoFin) ||
        (fechaInicio <= promoInicio && fechaFin >= promoFin)
      );

      return seSuperponen;
    });

    if (promocionConflicto) {
      const productoNombre = this.nombreProducto(this.form.productId);
      const conflictoInicio = new Date(promocionConflicto.fechaInicio).toLocaleDateString('es-AR');
      const conflictoFin = new Date(promocionConflicto.fechaFin).toLocaleDateString('es-AR');
      this.setFormMensaje(
        'error', 
        `Ya existe una promoción para "${productoNombre}" del ${conflictoInicio} al ${conflictoFin}. Las fechas no pueden superponerse.`
      );
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
          this.resetForm();
          this.setFormMensaje('success', 'Promoción creada correctamente.');
        }
      },
      error: (err) => {
        console.error('Error creando promoción:', err);
        this.setFormMensaje('error', 'No se pudo crear la promoción. Intentá nuevamente.');
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
    this.resetFormMensaje();
  }

  guardarCambios(p: Promocion): void {
    if (!p._id) return;

    // Validar que las fechas sean coherentes
    const fechaInicio = new Date(p.fechaInicio);
    const fechaFin = new Date(p.fechaFin);

    if (fechaFin < fechaInicio) {
      this.popup = 'errorFechas';
      return;
    }

    // Validar que no haya superposición con otras promociones del mismo producto
    const productoId = typeof p.productId === 'string' ? p.productId : p.productId._id;
    
    const promocionConflicto = this.promociones.find(promo => {
      // No comparar consigo misma
      if (promo._id === p._id) {
        return false;
      }

      // Solo verificar promociones del mismo producto
      const promoProductId = typeof promo.productId === 'string' 
        ? promo.productId 
        : promo.productId._id;
      
      if (promoProductId !== productoId) {
        return false;
      }

      // Verificar si las fechas se superponen
      const promoInicio = new Date(promo.fechaInicio);
      const promoFin = new Date(promo.fechaFin);

      const seSuperponen = (
        (fechaInicio >= promoInicio && fechaInicio <= promoFin) ||
        (fechaFin >= promoInicio && fechaFin <= promoFin) ||
        (fechaInicio <= promoInicio && fechaFin >= promoFin)
      );

      return seSuperponen;
    });

    if (promocionConflicto) {
      this.popup = 'errorSuperposicion';
      return;
    }

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
          this.popup = 'modificadoExito';
        }
      },
      error: (err) => {
        console.error('Error modificando promoción:', err);
        this.popup = 'errorModificar';
      }
    });
  }

  confirmarEliminar(p: Promocion): void {
    this.promocionAEliminar = p;
    this.popup = 'confirmarEliminar';
  }

  eliminar(): void {
    if (!this.promocionAEliminar || !this.promocionAEliminar._id) return;
    
    this.promoService.eliminar(this.promocionAEliminar._id).subscribe({
      next: (resp) => {
        if (resp.success) {
          this.promociones = this.promociones.filter(x => x._id !== this.promocionAEliminar!._id);
          this.popup = 'eliminadoExito';
          this.promocionAEliminar = null;
        }
      },
      error: (err) => {
        console.error('Error eliminando promoción:', err);
        this.popup = 'errorEliminar';
        this.promocionAEliminar = null;
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

  private setFormMensaje(tipo: 'error' | 'success', mensaje: string): void {
    this.formMensajeTipo = tipo;
    this.formMensaje = mensaje;
  }

  resetFormMensaje(): void {
    this.formMensaje = '';
    this.formMensajeTipo = '';
  }

  closePopup(): void {
    this.popup = '';
    this.promocionAEliminar = null;
  }
}
