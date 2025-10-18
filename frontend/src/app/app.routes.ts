import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { LoginComponent } from './components/login/login.component';
import { ErrorComponent } from './components/error/error.component';
import { AdminLoginComponent } from './components/adminLogin/adminLogin.component';
import { AdminHomeComponent } from './components/adminHome/adminHome.component';
import { AdminProfileComponent } from './components/adminProfile/adminProfile.component';
import { RegisterComponent } from './components/register/register.component';
import { ProfileComponent } from './components/profile/profile.component';
import { ProductsComponent } from './components/products/products.component';
import { CategoryListComponent } from './components/category-list/category-list.component';
import { CategoryFormComponent } from './components/category-form/category-form.component';

export const routes: Routes = [
    { path: '', component: HomeComponent, title: 'Supermercado' },
    { path: 'inicioAdministrador', component: AdminHomeComponent, title: 'Supermercado - Panel de Administración' },
    { path: 'productos', component: ProductsComponent, title: 'Supermercado - Productos' },
    { path: 'productosAdministrador', component: ProductsComponent, title: 'Supermercado - Productos Admin' },
    { path: 'promociones', component: HomeComponent, title: 'Supermercado - Promociones' },
    { path: 'promocionesAdministrador', component: HomeComponent, title: 'Supermercado - Promociones Admin' },
    { path: 'favoritos', component: HomeComponent, title: 'Supermercado - Favoritos' },
    { path: 'ventasAdministrador', component: AdminHomeComponent, title: 'Supermercado - Ventas' },
    { path: 'perfil', component: ProfileComponent, title: 'Supermercado - Mi Perfil' },
    { path: 'perfilAdministrador', component: AdminProfileComponent, title: 'Supermercado - Perfil Administrador' },
    { path: 'login', component: LoginComponent, title: 'Supermercado - Iniciar Sesión' },
    { path: 'loginAdmin', component: AdminLoginComponent, title: 'Supermercado - Iniciar Sesión Admin' },
    { path: 'register', component: RegisterComponent, title: 'Supermercado - Registrarse' },
    { path: 'admin/categorias', component: CategoryListComponent, title: 'Supermercado - Categorías' },
    { path: 'admin/categorias/nueva', component: CategoryFormComponent, title: 'Supermercado - Nueva Categoría' },
    { path: 'admin/categorias/editar/:id', component: CategoryFormComponent, title: 'Supermercado - Editar Categoría' },
    { path: '**', component: ErrorComponent, title: 'Supermercado - Error' }
];
