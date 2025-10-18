import { Component, Renderer2 } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from './components/navbar/navbar.component';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, FormsModule, RouterLink, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = "Supermercado";
  imageClass = 'defaultStyle';
  private backgroundElementColor: HTMLElement | null = null;
  private backgroundElementImage: HTMLElement | null = null;

  constructor(private renderer: Renderer2, private router: Router) {}

  ngOnInit() {
    this.backgroundElementColor = document.getElementById('backgroundColor');
    this.backgroundElementImage = document.getElementById('backgroundImage');

    // Escuchar cambios de ruta y aplicar fondo correspondiente
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.setBackgroundClass();
    });
    //this.createBackgroundElement();
  }

  // Método para crear el div de fondo en el body
  /*createBackgroundElement() {
    if (!this.backgroundElement) {
      // Crear un nuevo div
      this.backgroundElement = this.renderer.createElement('div');
      this.backgroundElement!.id = 'backgroundColor';  // Asignar id al div

      // Agregarlo al body
      this.renderer.appendChild(document.body, this.backgroundElement);

      // Aplicar el fondo inicial
      this.applyBodyStyles();
    }
  }*/

  setBackgroundClass() {
    const currentRoute = this.router.url;
    const route = (currentRoute || '').toLowerCase();
    if (route === '/') {
      this.imageClass = 'homeStyle';
    } else if (route === '/register' || route.startsWith('/login')) {
      // startWith('/login') covers '/login' and '/LoginAdmin' (case-insensitive via toLowerCase)
      this.imageClass = 'loginStyle';
    } else {
      this.imageClass = 'defaultStyle';
    }
    this.applyBodyStyles();
  }

  applyBodyStyles() {
    if (this.backgroundElementColor && this.backgroundElementImage) {
      // Eliminar cualquier clase anterior del body
      this.renderer.removeClass(this.backgroundElementColor, 'homeStyle');
      this.renderer.removeClass(this.backgroundElementColor, 'loginStyle');
      this.renderer.removeClass(this.backgroundElementColor, 'defaultStyle');
      this.renderer.removeClass(this.backgroundElementImage, 'homeStyle');
      this.renderer.removeClass(this.backgroundElementImage, 'loginStyle');
      this.renderer.removeClass(this.backgroundElementImage, 'defaultStyle');
      
      // Agregar la clase dinámica al body
      this.renderer.addClass(this.backgroundElementColor, this.imageClass);
      this.renderer.addClass(this.backgroundElementImage, this.imageClass);
    }
  }
}
