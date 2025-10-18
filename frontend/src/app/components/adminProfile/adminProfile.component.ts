import { Component, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { GlobalService } from '../../services/global.service';
import { ErrorPopupComponent } from '../errorPopup/errorPopup.component';

@Component({
	selector: 'app-admin-profile',
	standalone: true,
	imports: [ReactiveFormsModule, CommonModule, ErrorPopupComponent],
	templateUrl: './adminProfile.component.html',
	styleUrls: ['./adminProfile.component.css']
})
export class AdminProfileComponent implements OnInit {
	perfilForm = new FormGroup({
		nombre: new FormControl('', Validators.required),
		mail: new FormControl('', [Validators.email]),
		telefono: new FormControl(''),
		password: new FormControl('')
	});

	popup = '';
	admin: any = { dni: sessionStorage.getItem('dni') || '' };
	router = inject(Router);

	constructor(private http: HttpClient, private globalService: GlobalService) {}

	ngOnInit(): void {
		// Verificar que el usuario esté logueado y sea administrador
		if (sessionStorage.getItem('isLoggedIn') !== 'true') {
			this.router.navigateByUrl('/loginAdmin');
			return;
		}

		// Opcional: verificar que sea administrador
		if (sessionStorage.getItem('type') !== 'Administrador') {
			this.router.navigateByUrl('/');
            this.popup = 'errorAcceso';
			return;
		}

		// Cargar datos desde sessionStorage si existen
		const nombre = sessionStorage.getItem('username') || '';
		const mail = sessionStorage.getItem('mail') || '';

		this.perfilForm.setValue({
			nombre: nombre,
			mail: mail,
			telefono: '',
			password: ''
		});
	}

	onSubmit(): void {
		// Enviar datos al backend si es necesario; por ahora mostramos popup de success
		const formData: any = {
			nombre: this.perfilForm.value.nombre,
			mail: this.perfilForm.value.mail,
			telefono: this.perfilForm.value.telefono
		};

		// Intentamos llamar al endpoint de admins si existe
		try {
			this.http.put<any>(`${this.globalService.apiUrl}/api/admins/update`, formData).subscribe({
				next: (res) => {
					if (res && res.success) {
						this.popup = 'success';
					} else {
						this.popup = 'error';
					}
				},
				error: () => this.popup = 'error'
			});
		} catch (e) {
			this.popup = 'error';
		}
	}

	eliminarCuenta(): void {
		this.popup = 'confirmarEliminar';
	}

	confirmarEliminacion(): void {
		this.popup = '';
		// Llamada al backend para eliminar administrador (si existe)
		const mail = this.perfilForm.get('mail')?.value || sessionStorage.getItem('mail') || '';
		if (!mail) {
			this.popup = 'errorEliminar';
			return;
		}

		this.http.delete<any>(`${this.globalService.apiUrl}/api/admins/${encodeURIComponent(mail)}`).subscribe({
			next: (res) => {
				if (res && res.success) {
					sessionStorage.clear();
					window.location.href = '/';
				} else {
					this.popup = 'errorEliminar';
				}
			},
			error: () => this.popup = 'errorEliminar'
		});
	}

	close(): void { this.popup = ''; }
}
