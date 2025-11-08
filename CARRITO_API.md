# API del Carrito - Documentación

## Estructura del Carrito

Cada cliente (`Customer`) tiene un objeto `carrito` con:
```json
{
  "items": [
    {
      "productId": "ObjectId | null",
      "nombre": "string",
      "precioUnitario": "number",
      "cantidad": "number (>=1)",
      "subtotal": "number (precioUnitario * cantidad)"
    }
  ],
  "total": "number (suma de todos los subtotales)"
}
```

## Endpoints

### 1. Obtener el carrito de un cliente
```
GET /api/customers/:dni/cart
```
**Response:**
```json
{
  "success": true,
  "carrito": {
    "items": [...],
    "total": 149.7
  }
}
```

### 2. Añadir un producto al carrito
```
POST /api/customers/:dni/cart/add
Content-Type: application/json

{
  "productId": "optional_ObjectId_or_null",
  "nombre": "Leche Entera 1L",
  "precioUnitario": 49.9,
  "cantidad": 1
}
```
**Response:**
```json
{
  "success": true,
  "carrito": {
    "items": [...],
    "total": 199.6
  }
}
```

**Nota:** Si el producto ya existe (por `productId` o `nombre`), incrementa la cantidad.

### 3. Actualizar cantidad de un item
```
PUT /api/customers/:dni/cart/update
Content-Type: application/json

{
  "productId": "optional_ObjectId_or_null",
  "nombre": "optional_string",
  "cantidad": 3
}
```
**Response:** igual que añadir.

**Nota:** Si `cantidad: 0`, elimina el item.

### 4. Eliminar un item del carrito
```
DELETE /api/customers/:dni/cart/remove
Content-Type: application/json

{
  "productId": "optional_ObjectId_or_null",
  "nombre": "optional_string"
}
```
**Response:**
```json
{
  "success": true,
  "carrito": {
    "items": [...],
    "total": 49.9
  }
}
```

## Ejemplos PowerShell (curl)

### Añadir producto:
```powershell
Invoke-RestMethod -Method POST -Uri 'http://localhost:3000/api/customers/12345678/cart/add' -ContentType 'application/json' -Body (@{ nombre='Leche'; precioUnitario=49.9; cantidad=1 } | ConvertTo-Json)
```

### Obtener carrito:
```powershell
Invoke-RestMethod -Method GET -Uri 'http://localhost:3000/api/customers/12345678/cart'
```

### Actualizar cantidad:
```powershell
Invoke-RestMethod -Method PUT -Uri 'http://localhost:3000/api/customers/12345678/cart/update' -ContentType 'application/json' -Body (@{ nombre='Leche'; cantidad=3 } | ConvertTo-Json)
```

### Eliminar item:
```powershell
Invoke-RestMethod -Method DELETE -Uri 'http://localhost:3000/api/customers/12345678/cart/remove' -ContentType 'application/json' -Body (@{ nombre='Leche' } | ConvertTo-Json)
```

## Frontend: Integración

- **GlobalService:** Expone `cartTotal$` (Observable<number>) para sincronizar el total del carrito.
- **ProductoService:** Métodos `addToCart`, `getCart`, `updateCartItem`, `removeCartItem`.
- **NavbarComponent:** Se suscribe a `cartTotal$` y muestra el total a la izquierda del nombre del cliente (solo para clientes).
- **ProductsComponent:** Al pulsar "Agregar al carrito", llama `addToCart` y actualiza el total global.

## Próximos pasos (opcionales)

- **Página del carrito:** Crear una ruta `/carrito` que muestre todos los items con botones para editar cantidad o eliminar.
- **CSS para navbar:** Estilar el `<span class="cart-total">` para que resalte el total.
- **Validaciones adicionales:** Comprobar stock del producto antes de añadir (backend puede consultar la colección de productos).
