import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ProductoService, Producto, ProductoResponse, ImageUploadResponse } from '../../services/producto.service';
import { CategoriaService, Categoria, CategoriaResponse } from '../../services/categoria.service';
import { ErrorPopupComponent } from '../errorPopup/errorPopup.component';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ErrorPopupComponent],
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.css']
})
export class ProductFormComponent implements OnInit {
  productoForm = new FormGroup({
    nombre: new FormControl('', Validators.required),
    descripcion: new FormControl(''),
    precio: new FormControl(0, [Validators.required, Validators.min(0)]),
    stock: new FormControl(0, [Validators.required, Validators.min(0)]),
    categoriaId: new FormControl<string | null>(null, Validators.required)
  });

  imagenSeleccionada: File | null = null;
  imagenPreview: string | null = null;
  imagenUrl: string = '';
  popup = '';
  cargando = false;
  subiendoImagen = false;
  esEdicion = false;
  productoId: string | null = null;
  categorias: Categoria[] = [];
  padres: Categoria[] = [];
  grupos: Array<{ padre: Categoria; hijos: Array<Categoria & { disabled?: boolean }> }> = [];
  huerfanos: Categoria[] = [];
  private leafCategoryIds: Set<string> = new Set();

  constructor(
    private productoService: ProductoService,
    private categoriaService: CategoriaService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Verificar que el usuario sea administrador
    if (sessionStorage.getItem('type') !== 'Administrador') {
      this.router.navigateByUrl('/');
      return;
    }

    // Verificar si es edición
    this.productoId = this.route.snapshot.paramMap.get('id');
    if (this.productoId) {
      this.esEdicion = true;
      this.cargarProducto();
    }

    this.cargarCategorias();
  }

  cargarCategorias(): void {
    this.categoriaService.obtenerCategorias().subscribe({
      next: (response: CategoriaResponse) => {
        if (response.success && response.categorias) {
          const todas = response.categorias;
          const nivel0 = todas.filter(c => c.nivel === 0).sort((a, b) => a.nombre.localeCompare(b.nombre));
          const nivel1 = todas.filter(c => c.nivel === 1).sort((a, b) => a.nombre.localeCompare(b.nombre));
          const nivel2 = todas.filter(c => c.nivel === 2);

          // Mapa de hijos por padre
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

          // Ordenar hijos
          for (const arr of hijos1PorPadre0.values()) {
            arr.sort((a, b) => a.nombre.localeCompare(b.nombre));
          }
          for (const arr of hijos2PorPadre1.values()) {
            arr.sort((a, b) => a.nombre.localeCompare(b.nombre));
          }

          // Construir grupos jerárquicos: nivel 0 -> nivel 1 -> nivel 2
          this.grupos = [];
          
          for (const cat0 of nivel0) {
            const subcats1 = hijos1PorPadre0.get(cat0._id!) || [];
            
            // Agregar todas las subcategorías y sub-subcategorías bajo esta categoría principal
            const hijosCompletos: any[] = [];
            
            for (const cat1 of subcats1) {
              // Agregar nivel 1 como no seleccionable (solo visual)
              hijosCompletos.push({ ...cat1, disabled: true });
              
              // Agregar las sub-subcategorías de esta subcategoría (seleccionables)
              const subcats2 = hijos2PorPadre1.get(cat1._id!) || [];
              hijosCompletos.push(...subcats2);
            }
            
            this.grupos.push({
              padre: cat0,
              hijos: hijosCompletos
            });
          }

          // Detectar huérfanos (categorías sin padre válido)
          const incluidos = new Set<string>();
          for (const g of this.grupos) {
            for (const h of g.hijos) incluidos.add(h._id!);
          }
          this.huerfanos = [...nivel1, ...nivel2]
            .filter(h => !incluidos.has(h._id!))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));

          this.categorias = todas;

          // Solo las categorías de nivel 2 son seleccionables
          this.leafCategoryIds = new Set(nivel2.map(c => c._id!));
          
          const categoriaCtrl = this.productoForm.get('categoriaId');
          if (categoriaCtrl) {
            const categoriaValidator = (control: any) => {
              const val = control.value as string | null;
              if (!val) return null;
              if (!this.leafCategoryIds || this.leafCategoryIds.size === 0) return null;
              return this.leafCategoryIds.has(val) ? null : { categoriaNoHoja: true };
            };
            categoriaCtrl.setValidators([Validators.required, categoriaValidator]);
            categoriaCtrl.updateValueAndValidity({ emitEvent: false });
          }
        }
      },
      error: (error: any) => {
        console.error('Error al cargar categorías:', error);
      }
    });
  }

  cargarProducto(): void {
    if (!this.productoId) return;

    this.productoService.obtenerProducto(this.productoId).subscribe({
      next: (response: ProductoResponse) => {
        if (response.success && response.producto) {
          const producto = response.producto;
          this.productoForm.patchValue({
            nombre: producto.nombre,
            descripcion: producto.descripcion || '',
            precio: producto.precio,
            stock: producto.stock || 0,
            categoriaId: (producto as any).categoriaId?._id || (producto as any).categoriaId || null
          });
          
          if (producto.imagen) {
            this.imagenUrl = producto.imagen;
            this.imagenPreview = producto.imagen;
          }
        }
      },
      error: (error: any) => {
        console.error('Error al cargar producto:', error);
        this.popup = 'errorCargar';
      }
    });
  }

  onImageSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validar que sea una imagen
      if (!file.type.startsWith('image/')) {
        this.popup = 'archivoInvalido';
        return;
      }

      // Validar tamaño (máximo 10MB)
      if (file.size > 10 * 1024 * 1024) {
        this.popup = 'archivoGrande';
        return;
      }

      this.imagenSeleccionada = file;

      // Crear preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagenPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  eliminarImagen(): void {
    this.imagenSeleccionada = null;
    this.imagenPreview = null;
    this.imagenUrl = '';
  }

  async onSubmit(): Promise<void> {
    if (this.productoForm.invalid) {
      this.popup = 'formularioInvalido';
      return;
    }

    this.cargando = true;

    try {
      // Subir imagen si hay una seleccionada
      if (this.imagenSeleccionada) {
        try {
          this.subiendoImagen = true;
          const uploadResponse = await this.productoService.subirImagen(this.imagenSeleccionada).toPromise();
          
          if (uploadResponse && uploadResponse.success && uploadResponse.imageUrl) {
            this.imagenUrl = uploadResponse.imageUrl;
          } else {
            console.error('Error al subir imagen:', uploadResponse);
            this.popup = 'errorSubirImagen';
            this.cargando = false;
            this.subiendoImagen = false;
            return;
          }
          this.subiendoImagen = false;
        } catch (uploadError) {
          console.error('Excepción al subir imagen:', uploadError);
          this.popup = 'errorSubirImagen';
          this.cargando = false;
          this.subiendoImagen = false;
          return;
        }
      }

      // Crear objeto del producto
      const productoData: any = {
        nombre: this.productoForm.value.nombre,
        descripcion: this.productoForm.value.descripcion || '',
        precio: parseFloat(this.productoForm.value.precio?.toString() || '0'),
        stock: parseInt(this.productoForm.value.stock?.toString() || '0'),
        imagen: this.imagenUrl || '',
        categoriaId: this.productoForm.value.categoriaId
      };

      if (this.esEdicion && this.productoId) {
        // Actualizar producto
        this.productoService.actualizarProducto(this.productoId, productoData).subscribe({
          next: (response: ProductoResponse) => {
            if (response.success) {
              this.popup = 'exitoActualizar';
              setTimeout(() => {
                this.router.navigateByUrl('/admin/productos');
              }, 1500);
            } else {
              this.manejarError(response.reason || 'error');
            }
            this.cargando = false;
          },
          error: (error: any) => {
            console.error('Error al actualizar:', error);
            this.popup = 'error';
            this.cargando = false;
          }
        });
      } else {
        // Crear nuevo producto
        this.productoService.crearProducto(productoData).subscribe({
          next: (response: ProductoResponse) => {
            if (response.success) {
              this.popup = 'exito';
              setTimeout(() => {
                this.router.navigateByUrl('/admin/productos');
              }, 1500);
            } else {
              this.manejarError(response.reason || 'error');
            }
            this.cargando = false;
          },
          error: (error: any) => {
            console.error('Error al crear:', error);
            const reason = error.error?.reason;
            this.manejarError(reason || 'error');
            this.cargando = false;
          }
        });
      }

    } catch (error) {
      console.error('Error:', error);
      this.popup = 'error';
      this.cargando = false;
      this.subiendoImagen = false;
    }
  }

  manejarError(reason: string): void {
    const errores: { [key: string]: string } = {
      'nombreRequerido': 'nombreRequerido',
      'precioInvalido': 'precioInvalido',
      'productoExiste': 'productoExiste',
      'categoriaRequerida': 'categoriaRequerida',
      'categoriaNoEncontrada': 'categoriaNoEncontrada',
      'categoriaNivelInvalido': 'categoriaNivelInvalido'
    };

    this.popup = errores[reason] || 'error';
  }

  cancelar(): void {
    this.router.navigateByUrl('/admin/productos');
  }

  close(): void {
    this.popup = '';
  }
}
