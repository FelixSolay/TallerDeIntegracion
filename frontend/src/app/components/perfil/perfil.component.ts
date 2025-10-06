import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { GlobalService } from '../../services/global.service';
import { ButtonComponent } from '../button/button.component';
import { PopupErrorComponent } from '../popupError/popupError.component';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, ButtonComponent, PopupErrorComponent],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css'
})
export class PerfilComponent implements OnInit {
  
  perfilForm = new FormGroup({
    nombre: new FormControl('', Validators.required),
    apellido: new FormControl('', Validators.required),
    telefono: new FormControl('', [Validators.pattern(/^[\d\s\-\(\)\+]{8,15}$/)]), // No obligatorio
    mail: new FormControl('', [Validators.email]), // Solo validar formato, no obligatorio
    domicilio: new FormControl(''),
    codigoPostal: new FormControl('', Validators.pattern(/^\d{4,8}$/))
  });

  constructor(private http: HttpClient, private globalService: GlobalService) {}

  router = inject(Router);
  popup = '';
  userDni = sessionStorage.getItem("dni") || '43573399';
  userSaldo = 2000.00; // Valor por defecto
  
  ngOnInit(): void {
    // Verificar que el usuario esté logueado
    if (sessionStorage.getItem("isLoggedIn") !== "true") {
      this.router.navigateByUrl("/login");
      return;
    }

    // Cargar los datos del usuario
    this.loadUserData();
  }

  loadUserData(): void {
    // Obtener datos básicos del sessionStorage
    const nombre = sessionStorage.getItem("username") || '';
    const apellido = sessionStorage.getItem("userlastname") || '';
    const dni = sessionStorage.getItem("dni") || '';
    
    console.log('=== CARGANDO DATOS DEL USUARIO ===');
    console.log('SessionStorage - Nombre:', nombre);
    console.log('SessionStorage - Apellido:', apellido);
    console.log('SessionStorage - DNI:', dni);
    
    this.userDni = dni;
    
    // Inicializar formulario con datos básicos del sessionStorage
    this.perfilForm.setValue({
      nombre: nombre,
      apellido: apellido,
      telefono: '',
      mail: '',
      domicilio: '',
      codigoPostal: ''
    });
    
    console.log('Formulario inicializado con datos básicos');

    // OBTENER DATOS COMPLETOS DESDE EL BACKEND
    if (dni && dni.trim() !== '') {
      console.log('=== LLAMANDO AL BACKEND PARA OBTENER DATOS COMPLETOS ===');
      console.log('URL del backend:', `${this.globalService.apiUrl}/api/clientes/${dni}`);
      this.getUserDetails(dni);
    } else {
      console.error('❌ No hay DNI disponible para cargar datos del usuario');
    }
  }

  getUserDetails(dni: string): void {
    console.log('=== INTENTANDO OBTENER DATOS REALES ===');
    console.log('DNI del usuario:', dni);
    console.log('URL que se va a llamar:', `${this.globalService.apiUrl}/api/clientes/${dni}`);
    
    this.http.get<any>(`${this.globalService.apiUrl}/api/clientes/${dni}`)
      .subscribe({
        next: (result) => {
          console.log('=== ¡RESPUESTA EXITOSA DEL BACKEND! ===');
          console.log('Respuesta completa:', result);
          
          if (result && result.success && result.cliente) {
            const cliente = result.cliente;
            console.log('=== DATOS REALES DEL USUARIO ===');
            console.log('Nombre:', cliente.nombre);
            console.log('Apellido:', cliente.apellido);
            console.log('Teléfono:', cliente.telefono, '← ¡ESTE DEBE SER TU NÚMERO REAL!');
            console.log('Mail:', cliente.mail);
            console.log('Domicilio:', cliente.domicilio);
            console.log('Código Postal:', cliente.codigoPostal);
            
            // Actualizar el formulario con TODOS los datos del backend
            this.perfilForm.setValue({
              nombre: cliente.nombre || '',
              apellido: cliente.apellido || '',
              telefono: cliente.telefono || '',
              mail: cliente.mail || '',
              domicilio: cliente.domicilio || '',
              codigoPostal: cliente.codigoPostal || ''
            });
            
            console.log('✅ DATOS CARGADOS EXITOSAMENTE DESDE EL BACKEND');
            console.log('Teléfono real:', cliente.telefono);
            console.log('Email real:', cliente.mail);
            
            this.userSaldo = cliente.saldo || 0.00;
            
            console.log('=== DATOS CARGADOS EN EL FORMULARIO ===');
            console.log(this.perfilForm.value);
            console.log('¡Los campos deberían mostrar TUS datos reales ahora!');
            
          } else {
            console.error('❌ La respuesta del servidor no tiene el formato esperado:', result);
          }
        },
        error: (err) => {
          console.error('=== ❌ ERROR AL CONECTAR CON EL BACKEND ===');
          console.error('¿Está el servidor backend ejecutándose en puerto 3000?');
          console.error('Error:', err);
          console.error('Status:', err.status);
          if (err.status === 0) {
            console.error('🔥 Error de conexión: El servidor backend NO está corriendo');
          }
        }
      });
  }

  onSubmit(): void {
    // Validar solo los campos obligatorios (nombre y apellido)
    if (!this.perfilForm.value.nombre?.trim() || !this.perfilForm.value.apellido?.trim()) {
      this.popup = 'missingRequired';
      return;
    }

    // Crear formData solo con los campos que tienen valor
    const formData: any = {
      dni: this.userDni,
      nombre: this.perfilForm.value.nombre?.trim(),
      apellido: this.perfilForm.value.apellido?.trim()
    };

    // Agregar campos opcionales solo si tienen valor
    if (this.perfilForm.value.telefono?.trim()) {
      formData.telefono = this.perfilForm.value.telefono.trim();
    }
    if (this.perfilForm.value.mail?.trim()) {
      formData.mail = this.perfilForm.value.mail.trim();
    }
    if (this.perfilForm.value.domicilio?.trim()) {
      formData.domicilio = this.perfilForm.value.domicilio.trim();
    }
    if (this.perfilForm.value.codigoPostal?.trim()) {
      formData.codigoPostal = this.perfilForm.value.codigoPostal.trim();
    }

    console.log('Datos a enviar al servidor:', formData);

    this.http.put<any>(`${this.globalService.apiUrl}/api/clientes/update`, formData)
      .subscribe({
        next: (result) => {
          console.log('Respuesta del servidor al actualizar:', result);
          if (result.success) {
            // Actualizar sessionStorage con los nuevos datos
            sessionStorage.setItem("username", formData.nombre as string);
            sessionStorage.setItem("userlastname", formData.apellido as string);
            
            this.popup = 'success';
          } else {
            console.log('Error del servidor:', result);
            if (result.reason === "mailExists") {
              this.popup = 'mailExists';
            } else if (result.reason === "badEmail") {
              this.popup = 'badEmail';
            } else if (result.reason === "badTelefono") {
              this.popup = 'badTelefono';
            } else if (result.reason === "badCodigoPostal") {
              this.popup = 'badCodigoPostal';
            } else if (result.reason === "missingFields") {
              this.popup = 'missingRequired';
            } else if (result.reason === "serverError") {
              this.popup = 'serverError';
            } else {
              this.popup = 'error';
            }
          }
        },
        error: (err) => {
          console.error('Error HTTP al actualizar perfil:', err);
          this.popup = 'networkError';
        }
      });
  }

  pedidosEnCurso(): void {
    // Funcionalidad para pedidos en curso
    console.log('Navegando a pedidos en curso...');
    // this.router.navigateByUrl("/pedidos-curso");
  }

  historialCompras(): void {
    // Funcionalidad para historial de compras
    console.log('Navegando a historial de compras...');
    // this.router.navigateByUrl("/historial-compras");
  }

  eliminarCuenta(): void {
    this.popup = 'confirmarEliminar';
  }

  confirmarEliminacion(): void {
    this.popup = '';
    this.http.delete<any>(`${this.globalService.apiUrl}/api/clientes/${this.userDni}`)
      .subscribe({
        next: (result) => {
          if (result.success) {
            this.cerrarSesion();
          } else {
            this.popup = 'errorEliminar';
          }
        },
        error: (err) => {
          console.error('Error al eliminar cuenta:', err);
          this.popup = 'errorEliminar';
        }
      });
  }

  cerrarSesion(): void {
    sessionStorage.clear();
    this.router.navigateByUrl("/");
  }

  close(): void {
    this.popup = '';
  }
}