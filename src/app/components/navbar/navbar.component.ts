import { AfterViewInit, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { CommonModule, NgIf } from '@angular/common';
import { filter } from 'rxjs';
import { ButtonComponent } from '../button/button.component';
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

  constructor(private router: Router) {};

  ngOnInit() {
    this.checkScreenSize();
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.comprobarRuta();
        this.conseguirDatos();
      });

    this.comprobarRuta();
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
}
