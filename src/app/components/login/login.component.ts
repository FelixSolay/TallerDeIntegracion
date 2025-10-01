import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppComponent } from '../../app.component';
import { ButtonComponent } from '../button/button.component';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PopupLoginComponent } from '../popupLogin/popupLogin.component';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { PopupErrorComponent } from '../popupError/popupError.component';
import { ParticleEffectSquare } from '../../extras/particle-effect-square';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ RouterOutlet, AppComponent, ReactiveFormsModule, ButtonComponent, PopupLoginComponent, CommonModule, PopupErrorComponent ],
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

  onSubmit() {
    (async () => {    
      const formData = {
        mail: this.loginForm.value.mail,
        password: this.loginForm.value.password
      };
    
      try {
        const response = await fetch('/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });
    
        const result = await response.json();
    
        if(result.success) {
          this.type = result.type;
          this.name = result.name;
          this.lastname = result.lastname;
          this.popup = 'success';
          sessionStorage.setItem("username", this.name);
          sessionStorage.setItem("userlastname", this.lastname);
          sessionStorage.setItem("mail", formData.mail as string);
          sessionStorage.setItem("isLoggedIn", "true");
        } else if(result.success == false && result.error == "contraseñaIncorrecta"){
          this.popup = 'contraseñaIncorrecta';
        } else {
          this.popup = 'fail';
        }
      } catch (error) {
        console.error('Error en el inicio de sesión:', error);
      }
    })();
  }

  close() {
    this.popup = '';
  }
}
