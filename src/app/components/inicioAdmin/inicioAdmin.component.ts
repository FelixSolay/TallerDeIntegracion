import { AfterViewInit, Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AppComponent } from '../../app.component';
import { ButtonComponent } from '../button/button.component';
import { GlobalService } from '../../services/global.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-inicioAdmin',
  standalone: true,
  imports: [ AppComponent, ButtonComponent, CommonModule ],
  templateUrl: './inicioAdmin.component.html',
  styleUrl: './inicioAdmin.component.css',
})
export class InicioAdminComponent implements OnInit, AfterViewInit, OnDestroy{
  @ViewChild('viewport') viewport!: ElementRef;
  router = inject(Router);
  urlsImagenes: string[] = [];
  currentIndex = 0;
  autoplayInterval: any;
  autoplayDelay = 3000; // 3 segundos
  isHovered = false;
  shouldAnimate = true;
  itemWidth = 0;


  constructor(private globalService: GlobalService, private http: HttpClient) {}

  ngOnInit(): void {
    this.globalService.checkLoggedIn("/inicioAdministrador");
    this.obtenerProductos();
    this.startAutoplay();
  }

  ngAfterViewInit() {
    this.calculateItemWidth();
    window.addEventListener('resize', this.calculateItemWidth.bind(this));
  }
  ngOnDestroy(): void {
    this.stopAutoplay();
  }

  obtenerProductos() {
    this.http.get<any[]>('http://localhost:5000/api/pulseras')
      .subscribe(data => {
        this.urlsImagenes = data.map(p => p.imagenUrl);
        this.currentIndex = 0;
      });
  }

  calculateItemWidth() {
    if (this.viewport) {
      const viewportWidth = this.viewport.nativeElement.clientWidth;
      this.itemWidth = (viewportWidth / 3) - 20; // margen total 20px (10px a cada lado)
    }
  }

  previous() {
    this.pauseAutoplay();
    this.shouldAnimate = true;
    if (this.currentIndex === 0) {
      this.currentIndex = this.urlsImagenes.length - 1;
    } else {
      this.currentIndex--;
    }
  }

  next() {
    this.pauseAutoplay();
    this.shouldAnimate = true;
    if (this.currentIndex === this.urlsImagenes.length - 1) {
      this.currentIndex = 0;
    } else {
      this.currentIndex++;
    }
  }

  startAutoplay() {
    this.autoplayInterval = setInterval(() => {
      if (!this.isHovered) {
        this.next();
      }
    }, this.autoplayDelay);
  }

  stopAutoplay() {
    clearInterval(this.autoplayInterval);
  }

  pauseAutoplay() {
    this.stopAutoplay();
    // Reiniciar autoplay luego de 5 segundos sin interacción
    setTimeout(() => this.startAutoplay(), 5000);
  }

  onMouseEnter() {
    this.isHovered = true;
    this.pauseAutoplay();
  }

  onMouseLeave() {
    this.isHovered = false;
  }

  getTrackStyles(): any {
    const offset = this.currentIndex * (this.itemWidth + 20); // ancho + margen total
    return {
      transform: `translateX(-${offset}px)`,
      transition: this.shouldAnimate ? 'transform 1.2s ease-in-out' : 'none'
    };
  }
}