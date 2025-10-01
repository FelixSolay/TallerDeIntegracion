import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { ButtonComponent } from '../button/button.component';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GlobalService } from '../../services/global.service';

@Component({
  selector: 'app-popupLogin',
  standalone: true,
  imports: [ ButtonComponent, CommonModule ],
  templateUrl: './popupLogin.component.html',
  styleUrl: './popupLogin.component.css'
})
export class PopupLoginComponent implements OnInit {
  @Input() type = '';
  @Output() closePopup = new EventEmitter<void>();
  cantType = 1;
  name = '';
  lastname = '';
  router = inject(Router);
  url = '';

  constructor(private globalService: GlobalService, private routerP: Router) {}

  ngOnInit(): void {
    this.name = sessionStorage.getItem("username")??'';
    this.lastname = sessionStorage.getItem("userlastname")??'';
    this.type = sessionStorage.getItem("type")??'';
    this.globalService.url$.subscribe(url => {
      if (url != "") {
        this.url = url;
      } else {
        if(this.type == 'Administrador')
          this.url = "/productosAdministrador";
        else
          this.url = "/productos";
      }
    });
    
  }

  onClose() {
    this.closePopup.emit();
  }

  setType(type: string) {
    sessionStorage.setItem("type", type);
    this.globalService.url$.subscribe(url => {
      if (url != "") {
        this.router.navigateByUrl(url);
        console.log("hola");
      } else {
        if(type == 'Administrador')
          this.router.navigateByUrl("/inicioAdministrador");
        else
          this.router.navigateByUrl("/inicio");
      }
    });
  }
}
