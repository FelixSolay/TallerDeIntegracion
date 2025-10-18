import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { CommonModule, NgIf } from '@angular/common';
import { filter } from 'rxjs';
import { ButtonComponent } from '../button/button.component';
import { CategoriaService, Categoria } from '../../services/categoria.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [ RouterModule, NgIf, CommonModule, ButtonComponent ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit {
  validRoute = false;
  image = '';
  type = '';
  name='';
  color='blanco';
  isMobile: boolean = false;
  showUserMenu: boolean = false;
  showCategoriesMenu: boolean = false;
  categorias: any[] = [];
  private categoryMenuTimeout: any;
  
  comprobarRuta() {
    const currentUrl = this.router.url;

    if(currentUrl == '/login' || currentUrl == '/register')
      return this.validRoute = false;
    else
      return this.validRoute = true;
  }

  conseguirDatos() {
    this.type = sessionStorage.getItem("type")??'';
    this.name = sessionStorage.getItem("username")??'Usuario';
    const dni = {
      dni: sessionStorage.getItem("dni")
    };
    if(dni.dni != null) {
      (async () => {    
        try {
          const response = await fetch('/getImage', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(dni)
          });
      
          const result = await response.json();
          this.image = result.base64;
        } catch (error) {
          console.error('Error', error);
        }
      })();
    }
  }

  constructor(private router: Router, private categoriaService: CategoriaService) {};

  ngOnInit() {
    this.checkScreenSize();
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.comprobarRuta();
        this.conseguirDatos();
      });

    this.comprobarRuta();
    this.conseguirDatos();
    this.cargarCategorias();
  }

  cargarCategorias(): void {
    this.categoriaService.obtenerNavbar().subscribe({
      next: (response) => {
        if (response.success && response.categorias) {
          this.categorias = response.categorias;
          console.log('Categorías cargadas:', this.categorias);
        }
      },
      error: (error) => {
        console.error('Error al cargar categorías:', error);
      }
    });
  }

  // Escucha los cambios de tamaño de la ventana
  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  checkScreenSize() {
    this.isMobile = window.innerWidth <= 600;
  }

  isActive(route: string): boolean {
    if(this.router.url === `/${route}`) {
      this.color = 'azul';
      return true;
    } else {
      this.color = 'blanco';
      return false;
    }
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
    this.showCategoriesMenu = false;
  }

  toggleCategoriesMenu(): void {
    console.log('Toggle categories menu', this.showCategoriesMenu);
    this.showCategoriesMenu = !this.showCategoriesMenu;
    this.showUserMenu = false;
  }

  closeUserMenu(): void {
    this.showUserMenu = false;
  }

  closeCategoriesMenu(): void {
    this.showCategoriesMenu = false;
  }

  openCategoriesMenu(): void {
    if (this.categoryMenuTimeout) {
      clearTimeout(this.categoryMenuTimeout);
    }
    this.showCategoriesMenu = true;
    console.log('Menú abierto:', this.showCategoriesMenu, 'Categorías:', this.categorias.length);
  }

  closeCategoriesMenuDelayed(): void {
    this.categoryMenuTimeout = setTimeout(() => {
      this.showCategoriesMenu = false;
      console.log('Menú cerrado');
    }, 200);
  }

  setActiveCategory(category: any): void {
    // Desactivar todas las categorías
    this.categorias.forEach(cat => cat.hover = false);
    // Activar solo la categoría sobre la que pasó el mouse
    category.hover = true;
  }

  goToProfile(): void {
    this.closeUserMenu();
    if (this.type === 'Administrador') {
      this.router.navigate(['/perfilAdministrador']);
    } else {
      this.router.navigate(['/perfil']);
    }
  }

  logout(): void {
    this.closeUserMenu();
    sessionStorage.clear();
    // Limpiar variables locales inmediatamente
    this.type = '';
    this.name = '';
    this.image = '';
    // Recargar la página completamente para asegurar que se actualice todo
    window.location.href = '/';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-container')) {
      this.closeUserMenu();
    }
    if (!target.closest('.categories-menu-container')) {
      this.closeCategoriesMenu();
    }
  }
}
