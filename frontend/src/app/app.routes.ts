import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { LoginComponent } from './components/login/login.component';
import { ErrorComponent } from './components/error/error.component';
import { LoginAdminComponent } from './components/loginAdmin/loginAdmin.component';
import { InicioAdminComponent } from './components/inicioAdmin/inicioAdmin.component';
import { PerfilAdministradorComponent } from './components/perfilAdministrador/perfilAdministrador.component';
import { RegisterComponent } from './components/register/register.component';
import { PerfilComponent } from './components/perfil/perfil.component';

export const routes: Routes = [
    { path: '', component: HomeComponent, title: 'Supermercado' },
    { path: 'productos', component: InicioAdminComponent, title: 'Supermercado - Productos' },
    { path: 'productosAdministrador', component: InicioAdminComponent, title: 'Supermercado - Productos' },
    { path: 'promociones', component: InicioAdminComponent, title: 'Supermercado - Promociones' },
    { path: 'promocionesAdministrador', component: InicioAdminComponent, title: 'Supermercado - Promociones' },
    { path: 'favoritos', component: InicioAdminComponent, title: 'Supermercado - Favoritos' },
    { path: 'ventasAdministrador', component: InicioAdminComponent, title: 'Supermercado - Ventas' },
    { path: 'perfil', component: PerfilComponent, title: 'Supermercado - Mi Perfil' },
    { path: 'perfilAdministrador', component: PerfilAdministradorComponent, title: 'Supermercado - Perfil Administrador' },
    { path: 'login', component: LoginComponent, title: 'Supermercado - Iniciar Sesión' },
    { path: 'loginAdmin', component: LoginAdminComponent, title: 'Supermercado - Iniciar Sesión Admin' },
    { path: 'register', component: RegisterComponent, title: 'Supermercado - Registrarse' },
    { path: '**', component: ErrorComponent, title: 'Supermercado - Error' }
];
