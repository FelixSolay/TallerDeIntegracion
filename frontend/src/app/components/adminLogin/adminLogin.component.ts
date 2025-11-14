import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ButtonComponent } from '../button/button.component';
import { ErrorPopupComponent } from '../errorPopup/errorPopup.component';
import { LoginPopupComponent } from '../loginPopup/loginPopup.component';
import { GlobalService } from '../../services/global.service';

interface AdminLoginResponse {
  success: boolean;
  name?: string;
  mail?: string;
  error?: string;
}

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ ReactiveFormsModule, CommonModule, ErrorPopupComponent, LoginPopupComponent ],
  templateUrl: './adminLogin.component.html',
  styleUrl: './adminLogin.component.css'
})
export class AdminLoginComponent implements OnInit {
  loginForm = new FormGroup({
    mail: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', Validators.required)
  });

  popup = '';
  name = '';

  constructor(private http: HttpClient, private globalService: GlobalService) {}

  ngOnInit(): void {}

  onSubmit() {
    const formData = {
      mail: this.loginForm.get('mail')?.value || '',
      password: this.loginForm.get('password')?.value || ''
    };

  this.http.post<AdminLoginResponse>(`${this.globalService.apiUrl}/api/admins/login`, formData).subscribe({
      next: (result) => {
        console.log('Respuesta del backend (admin):', result);
        if (result && result.success) {
          this.name = result.name || '';
          this.popup = 'success';
          sessionStorage.setItem('username', this.name);
          // guardamos el mail en lugar del dni
          sessionStorage.setItem('mail', formData.mail);
          sessionStorage.setItem('isLoggedIn', 'true');
          sessionStorage.setItem('type', 'Administrador');
        } else if (result && result.error === 'contraseñaIncorrecta') {
          this.popup = 'contraseñaIncorrecta';
        } else {
          this.popup = 'fail';
        }
      },
      error: (err) => {
        console.error('Error en login admin:', err);
        this.popup = 'fail';
      }
    });
  }

  close() {
    this.popup = '';
  }
}
