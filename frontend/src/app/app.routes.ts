import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { LoginComponent } from './components/login/login.component';
import { ErrorComponent } from './components/error/error.component';
import { AdminLoginComponent } from './components/adminLogin/adminLogin.component';
import { AdminHomeComponent } from './components/adminHome/adminHome.component';
import { AdminProfileComponent } from './components/adminProfile/adminProfile.component';
import { RegisterComponent } from './components/register/register.component';
import { ProfileComponent } from './components/profile/profile.component';

export const routes: Routes = [
    { path: '', component: HomeComponent, title: 'Supermercado' },
    { path: 'productos', component: AdminHomeComponent, title: 'Supermercado - Productos' },
    { path: 'productosAdministrador', component: AdminHomeComponent, title: 'Supermercado - Productos' },
    { path: 'promociones', component: AdminHomeComponent, title: 'Supermercado - Promociones' },
    { path: 'promocionesAdministrador', component: AdminHomeComponent, title: 'Supermercado - Promociones' },
    { path: 'favoritos', component: AdminHomeComponent, title: 'Supermercado - Favoritos' },
    { path: 'ventasAdministrador', component: AdminHomeComponent, title: 'Supermercado - Ventas' },
    { path: 'perfil', component: ProfileComponent, title: 'Supermercado - Mi Perfil' },
    { path: 'perfilAdministrador', component: AdminProfileComponent, title: 'Supermercado - Perfil Administrador' },
    { path: 'login', component: LoginComponent, title: 'Supermercado - Iniciar Sesión' },
    { path: 'loginAdmin', component: AdminLoginComponent, title: 'Supermercado - Iniciar Sesión Admin' },
    { path: 'register', component: RegisterComponent, title: 'Supermercado - Registrarse' },
    { path: '**', component: ErrorComponent, title: 'Supermercado - Error' }
];
