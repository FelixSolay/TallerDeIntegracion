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
import { PromocionesAdministradorComponent } from './components/promocionesAdministrador/promocionesAdministrador.component';
import { PromocionesClienteComponent } from './components/promocionesCliente/promocionesCliente.component';
import { CategoryFormComponent } from './components/category-form/category-form.component';
import { ProductsAdminComponent } from './components/productsAdmin/productsAdmin.component';
import { ProductFormComponent } from './components/product-form/product-form.component';
import { CarritoClienteComponent } from './components/carritoCliente/carritoCliente.component';
import { PagoClienteComponent } from './components/pagoCliente/pagoCliente.component';
import { PedidosEnCursoComponent } from './components/pedidosEnCurso/pedidosEnCurso.component';
import { HistorialPedidosComponent } from './components/historialPedidos/historialPedidos.component';
import { FavoritosComponent } from './components/favoritos/favoritos.component';
import { VentasAdministradorComponent } from './components/ventasAdministrador/ventasAdministrador.component';

export const routes: Routes = [
    { path: '', component: HomeComponent, title: 'Supermercado' },
    { path: 'inicioAdministrador', component: AdminHomeComponent, title: 'Supermercado - Panel de Administración' },
    { path: 'productos', component: ProductsComponent, title: 'Supermercado - Productos' },
    { path: 'carrito', component: CarritoClienteComponent, title: 'Supermercado - Mi Carrito' },
    { path: 'pago', component: PagoClienteComponent, title: 'Supermercado - Pago' },
    { path: 'pedidos-en-curso', component: PedidosEnCursoComponent, title: 'Supermercado - Pedidos en curso' },
    { path: 'historial-pedidos', component: HistorialPedidosComponent, title: 'Supermercado - Historial de pedidos' },
    { path: 'admin/productosAdministrador', component: ProductsAdminComponent, title: 'Supermercado - Productos Admin' },
    { path: 'admin/productos', component: ProductsAdminComponent, title: 'Supermercado - Productos Admin' },
    { path: 'admin/productos/nuevo', component: ProductFormComponent, title: 'Supermercado - Nuevo Producto' },
    { path: 'admin/productos/editar/:id', component: ProductFormComponent, title: 'Supermercado - Editar Producto' },
    { path: 'promociones', component: PromocionesClienteComponent, title: 'Supermercado - Promociones' },
    { path: 'promocionesAdministrador', component: PromocionesAdministradorComponent, title: 'Supermercado - Promociones Admin' },
    { path: 'favoritos', component: FavoritosComponent, title: 'Supermercado - Favoritos' },
    { path: 'ventasAdministrador', component: VentasAdministradorComponent, title: 'Supermercado - Ventas' },
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
