import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppComponent } from '../../app.component';
import { ButtonComponent } from '../button/button.component';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LoginPopupComponent } from '../loginPopup/loginPopup.component';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ErrorPopupComponent } from '../errorPopup/errorPopup.component';
import { ParticleEffectSquare } from '../../extras/particle-effect-square';
import { GlobalService } from '../../services/global.service';

interface LoginResponse {
  success: boolean;
  type: string;
  name: string;
  lastname: string;
  dni?: string;
  error?: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ RouterOutlet, AppComponent, ReactiveFormsModule, ButtonComponent, LoginPopupComponent, CommonModule, ErrorPopupComponent ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  loginForm = new FormGroup({
    mail: new FormControl('', Validators.required),
    password: new FormControl('', Validators.required),
  });
  
  popup = '';
  type = '';
  name = '';
  lastname = '';

  ngOnInit(): void {}

  constructor(private http: HttpClient, private globalService: GlobalService) {}

  onSubmit() {
    const formData = {
      mail: this.loginForm.get('mail')?.value || '',
      password: this.loginForm.get('password')?.value || ''
    };

  this.http.post<LoginResponse>(`${this.globalService.apiUrl}/api/customers/login`, formData).subscribe({
      next: (result) => {
        console.log("Respuesta del backend:", result);
        if (result && result.success) {
          this.type = result.type;
          this.name = result.name;
          this.lastname = result.lastname;
          this.popup = 'success';
          sessionStorage.setItem('username', this.name);
          sessionStorage.setItem('userlastname', this.lastname);
          sessionStorage.setItem('mail', formData.mail);
          if (result.dni) {
            sessionStorage.setItem('dni', result.dni);
          }
          sessionStorage.setItem('isLoggedIn', 'true');
          sessionStorage.setItem('type', this.type);
        } else if (result && result.success === false && result.error === 'contraseñaIncorrecta') {
          this.popup = 'contraseñaIncorrecta';
        } else {
          this.popup = 'fail';
        }
      },
      error: (err) => {
        console.error('Error en el inicio de sesión:', err);
        this.popup = 'fail';
      }
    });
  }

  close() {
    this.popup = '';
  }
}
