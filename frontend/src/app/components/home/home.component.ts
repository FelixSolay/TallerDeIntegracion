import { Component, OnInit } from '@angular/core';
import { AppComponent } from '../../app.component';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ AppComponent, ButtonComponent ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit{
  link = '';
  logged = '';
  type = '';

  linkBoton() {
    if(this.logged === 'false' || this.logged === '') {
      this.link = '/login';
    } else {
      if(this.type == 'Administrador')
        this.link = '/productosAdministrador';
      else 
        this.link = '/productos';
    }

  }

  ngOnInit(): void {
    this.logged = sessionStorage.getItem("isLoggedIn")??'';
    this.type = sessionStorage.getItem("type")??'';
    this.linkBoton();
  }
}
