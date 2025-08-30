# Taller De Integración "Catálogo de Productos"
Repositorio para el proyecto de Taller de Integración de la Universidad Nacional de la Matanza. Grupo 121

El objetivo es desarrollar un sistema de **catálogo de productos con carrito de compras**, que contemple tanto la perspectiva del **usuario final** como la del **administrador**.

### Funcionalidades principales
- **Usuarios finales** podrán:
  - Navegar el catálogo de productos.
  - Filtrar por categoría, marca y precio.
  - Marcar productos como favoritos.
  - Agregar productos al carrito y realizar compras.
  - Visualizar historial de compras.

- **Administradores** podrán:
  - Crear, modificar y dar de baja productos.
  - Gestionar categorías y subcategorías.
  - Administrar promociones y descuentos.
  - Controlar pedidos y estados de compra.

### Consultas requeridas
1. Historial de compras por usuario.  
2. Lista de favoritos de un usuario.  
3. Productos más vendidos en un rango de fechas.  
4. Productos con stock bajo o limitado.  
5. Categorías con más ventas acumuladas.  
6. Monto total de ventas por período.  

---

## Stack Tecnológico: **MEAN**
El proyecto se desarrollará utilizando el stack **MEAN**, compuesto por:

- **MongoDB** → Base de datos NoSQL para almacenar información de usuarios, productos, pedidos y promociones de manera flexible.  
- **Express.js** → Framework para Node.js que permitirá crear la API REST, centralizando la lógica de negocio.  
- **Angular** → Framework frontend para construir una interfaz dinámica y modular, con navegación SPA (Single Page Application).  
- **Node.js** → Entorno de ejecución del lado del servidor, que brindará escalabilidad y rapidez en las operaciones.  

### 🚀 ¿Por qué MEAN?
- Permite trabajar con **JavaScript en todas las capas** (frontend, backend y base de datos).  
- **MongoDB** se adapta bien al dominio del problema (productos con atributos variables, promociones dinámicas, historial de compras).  
- **Angular** ofrece una estructura robusta para el frontend, ideal para proyectos académicos con varios integrantes.  
- La integración **Node.js + Express + MongoDB** es natural, y facilita el desarrollo de una API REST escalable.  


