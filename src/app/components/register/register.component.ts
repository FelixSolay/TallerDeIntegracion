import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterOutlet, Router } from '@angular/router';
import { ButtonComponent } from '../button/button.component';
import { PopupLoginComponent } from '../popupLogin/popupLogin.component';
import { PopupErrorComponent } from '../popupError/popupError.component';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { GlobalService } from '../../services/global.service';


@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ RouterOutlet, ReactiveFormsModule, ButtonComponent, PopupLoginComponent, PopupErrorComponent, CommonModule ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit {
  registerForm = new FormGroup({
    nombre: new FormControl('', Validators.required),
    apellido: new FormControl('', Validators.required),
    dni: new FormControl('', Validators.required),
    mail: new FormControl('', [Validators.required, Validators.email]),
    password1: new FormControl('', Validators.required),
    password2: new FormControl('', Validators.required),
  });
  constructor(private http: HttpClient, private globalService: GlobalService) {}

  router = inject(Router);
  popup = '';
  type = '';
  name = '';
  lastname = '';
  errorMessage = '';

  ngOnInit(): void {}
  
  onSubmit() {
  const formData = {
    nombre: this.registerForm.value.nombre,
    apellido: this.registerForm.value.apellido,
    dni: this.registerForm.value.dni,
    mail: this.registerForm.value.mail,
    password1: this.registerForm.value.password1,
    password2: this.registerForm.value.password2
  };
  



    this.http.post<any>(`${this.globalService.apiUrl}/api/clientes/register`, formData)
    .subscribe({
      next: (result) => {
        console.log('Respuesta del servidor:', result);
        
        if (result.success) {
          this.type = result.type;
          this.popup = 'success';
          
          sessionStorage.setItem("username", formData.nombre as string);
          sessionStorage.setItem("userlastname", formData.apellido as string);
          sessionStorage.setItem("dni", formData.dni as string);
          sessionStorage.setItem("isLoggedIn", "true");
          sessionStorage.setItem("type", this.type as string);

          this.registerForm.reset();
        } else {
          if (result.reason === "alreadyExists") {
            this.popup = 'alreadyExists';
          } else if (result.reason === "wrongPassword") {
            this.popup = 'wrongPassword';
          } else if (result.reason === "badEmail") {
            this.popup = 'badEmail';
          }
        }
      },
      error: (err) => {
        console.error('Error en el registro:', err);
      }
    });
  
  }
  
  close() {
    this.popup = '';
  }
}
