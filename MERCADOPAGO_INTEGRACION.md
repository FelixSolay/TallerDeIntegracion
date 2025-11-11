# 🛒 Integración Mercado Pago - Guía Completa

## 📋 Índice
1. [Configuración Inicial](#configuración-inicial)
2. [Endpoints Disponibles](#endpoints-disponibles)
3. [Ejemplos de Uso](#ejemplos-de-uso)
4. [Generación de QR](#generación-de-qr)
5. [Manejo de Webhooks](#manejo-de-webhooks)
6. [Troubleshooting](#troubleshooting)

---

## ⚙️ Configuración Inicial

### 1. Obtener ACCESS TOKEN

1. Ve a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers/panel)
2. Inicia sesión o crea una cuenta
3. Ve a **Credenciales** en el panel
4. Copia tu **Access Token** (modo TEST para pruebas, PRODUCTION para producción)

### 2. Configurar variables de entorno

Crea un archivo `.env` en la carpeta `backend/`:

```env
MERCADOPAGO_ACCESS_TOKEN=TEST-tu-token-aqui
MERCADOPAGO_WEBHOOK_URL=https://tu-api.com/api/pagos/webhook
FRONTEND_URL=http://localhost:4200
MP_SUCCESS_URL=http://localhost:4200/pago-exitoso
MP_FAILURE_URL=http://localhost:4200/pago-fallido
MP_PENDING_URL=http://localhost:4200/pago-pendiente
```

### 3. Instalar dependencias

```bash
cd backend
npm install mercadopago
```

Ya debe estar instalado, pero confirma que esté en `package.json`:
```json
{
  "dependencies": {
    "mercadopago": "^2.9.0"
  }
}
```

---

## 📡 Endpoints Disponibles

### 1. Crear Preferencia de Pago

**Endpoint:** `POST /api/pagos/crear-preferencia`

**Descripción:** Crea una preferencia de pago que genera un checkout URL

**Body:**
```json
{
  "orderId": "order-123",
  "dni": "12345678",
  "items": [
    {
      "productId": "607d1f4c7d4b5e2f8a3b6c1d",
      "nombre": "Producto 1",
      "precioUnitario": 100.50,
      "cantidad": 2,
      "image": "https://url-imagen.com/producto.jpg"
    }
  ],
  "total": 201.00,
  "notificationUrl": "https://tu-api.com/api/pagos/webhook"
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "preferenceId": "202809963-920c288b-4ebb-40be-966f-700250fa5370",
  "checkoutUrl": "https://www.mercadopago.com/mla/checkout/start?pref_id=...",
  "sandboxUrl": "https://sandbox.mercadopago.com/mla/checkout/pay?pref_id=...",
  "qrCode": null,
  "total": 201.00
}
```

---

### 2. Generar QR para POS (Punto de Venta)

**Endpoint:** `POST /api/pagos/generar-qr`

**Descripción:** Genera un QR para escanear en punto de venta

**Body:**
```json
{
  "cantidad": 500.00,
  "descripcion": "Compra en tienda",
  "title": "Pago QR",
  "reference": "POS-001-2024",
  "items": [
    {
      "nombre": "Laptop",
      "cantidad": 1,
      "precioUnitario": 500.00
    }
  ]
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "preferenceId": "...",
  "qrCode": "data:image/png;base64,...",
  "checkoutUrl": "https://www.mercadopago.com/...",
  "sandboxUrl": "https://sandbox.mercadopago.com/...",
  "totalAmount": 500.00
}
```

---

### 3. Obtener Información de Preferencia

**Endpoint:** `GET /api/pagos/preferencia/:preferenceId`

**Descripción:** Obtiene el estado actual de una preferencia de pago

**Ejemplo:**
```bash
GET /api/pagos/preferencia/202809963-920c288b-4ebb-40be-966f-700250fa5370
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "preference": {
    "id": "202809963-920c288b-4ebb-40be-966f-700250fa5370",
    "init_point": "https://www.mercadopago.com/...",
    "items": [...],
    "payer": {...},
    "status": "active"
  }
}
```

---

### 4. Confirmar Pago

**Endpoint:** `PUT /api/pagos/confirmar-pago`

**Descripción:** Actualiza el estado del pedido después del pago

**Body:**
```json
{
  "orderId": "order-123",
  "dni": "12345678",
  "paymentId": "payment-456",
  "preferenceId": "202809963-920c288b-4ebb-40be-966f-700250fa5370",
  "status": "approved"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Pago confirmado",
  "pedido": {
    "_id": "order-123",
    "estado": "pendiente",
    "paymentStatus": "approved",
    "total": 201.00
  }
}
```

---

### 5. Webhook (Notificaciones)

**Endpoint:** `POST /api/pagos/webhook`

**Descripción:** Recibe notificaciones de cambios de estado de pagos desde Mercado Pago

**Webhook Body (ejemplo):**
```json
{
  "type": "payment",
  "data": {
    "id": "payment-id-123"
  }
}
```

---

## 💻 Ejemplos de Uso

### JavaScript/TypeScript Frontend (Angular)

**1. Crear preferencia y redirigir al checkout:**

```typescript
// pago.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PagoService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  crearPreferenciaPago(ordenData: any) {
    return this.http.post(`${this.apiUrl}/pagos/crear-preferencia`, ordenData);
  }

  generarQR(qrData: any) {
    return this.http.post(`${this.apiUrl}/pagos/generar-qr`, qrData);
  }

  obtenerPreferencia(preferenceId: string) {
    return this.http.get(`${this.apiUrl}/pagos/preferencia/${preferenceId}`);
  }

  confirmarPago(pagoData: any) {
    return this.http.put(`${this.apiUrl}/pagos/confirmar-pago`, pagoData);
  }
}
```

**2. Usar en un componente:**

```typescript
// pago-cliente.component.ts
export class PagoClienteComponent {
  constructor(private pagoService: PagoService) { }

  procesarPago() {
    const ordenData = {
      orderId: 'ORDER-123',
      dni: this.clienteDni,
      items: this.carritoItems,
      total: this.totalCarrito,
      notificationUrl: 'https://tu-api.com/api/pagos/webhook'
    };

    this.pagoService.crearPreferenciaPago(ordenData).subscribe(
      (response: any) => {
        if (response.success) {
          // Redirigir al checkout de Mercado Pago
          window.location.href = response.checkoutUrl;
        }
      },
      error => {
        console.error('Error al crear preferencia:', error);
      }
    );
  }
}
```

### cURL (para pruebas)

```bash
# 1. Crear preferencia
curl -X POST http://localhost:3000/api/pagos/crear-preferencia \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-123",
    "dni": "12345678",
    "items": [{
      "nombre": "Producto",
      "precioUnitario": 100,
      "cantidad": 1
    }],
    "total": 100
  }'

# 2. Generar QR
curl -X POST http://localhost:3000/api/pagos/generar-qr \
  -H "Content-Type: application/json" \
  -d '{
    "cantidad": 500,
    "descripcion": "Compra en tienda"
  }'
```

---

## 🔲 Generación de QR

### Flujo de QR en Punto de Venta

1. **Cliente genera compra en sistema** → Sistema calcula total
2. **Generar QR** → `/api/pagos/generar-qr`
3. **Mostrar QR en pantalla** → Cliente escanea con su celular
4. **Cliente completa pago** → Mercado Pago procesa
5. **Webhook notifica resultado** → Sistema actualiza estado

### Mostrar QR en HTML

```html
<!-- En tu componente Angular -->
<div *ngIf="qrCode">
  <h2>Escanea para pagar</h2>
  <img [src]="qrCode" alt="Código QR de pago">
  <p>Total: ${{ totalAmount }}</p>
</div>
```

```typescript
// En el componente
generarQRPago() {
  const qrData = {
    cantidad: this.total,
    descripcion: 'Compra',
    title: 'Pago en Tienda'
  };

  this.pagoService.generarQR(qrData).subscribe(
    (response: any) => {
      if (response.success) {
        this.qrCode = response.qrCode;
      }
    }
  );
}
```

---

## 🔔 Manejo de Webhooks

### Configurar Webhook en Mercado Pago

1. Ve a [Panel de Integraciones](https://www.mercadopago.com.ar/developers/panel/app/edit-app-data)
2. En **Webhooks**, agrega: `https://tu-dominio.com/api/pagos/webhook`
3. Selecciona los eventos a monitorear:
   - `payment.created`
   - `payment.updated`
   - `merchant_order.updated`

### Procesar Notificaciones

El endpoint `/api/pagos/webhook` ya está configurado para:

```javascript
// En server.js - línea webhook
if (type === 'payment') {
  // Manejar cambio de pago
  // Actualizar estado del pedido
  // Registrar en BD
}
```

### Estados de Pago

```
pending       → En proceso
approved      → Pagado ✓
rejected      → Rechazado ✗
cancelled     → Cancelado
refunded      → Reembolsado
in_process    → En análisis
chargeback    → Contracargo
```

---

## 🐛 Troubleshooting

### Error: "invalid_access_token"
**Solución:** Verifica que tu `MERCADOPAGO_ACCESS_TOKEN` sea correcto en `.env`

### Error: "collector_does_not_comply"
**Solución:** Completa tu perfil en Mercado Pago y verifica tu identidad

### Error: CORS
**Solución:** Asegúrate de que `cors` está habilitado en `server.js`

### QR no se genera
**Solución:** Verifica que los items tengan `unit_price` > 0

### Webhook no llega
**Solución:** 
1. Tu servidor debe estar expuesto a internet
2. Usa ngrok para testing local: `ngrok http 3000`
3. Verifica que el endpoint responda con 200 OK

### Pruebas en Sandbox

Usa credenciales de prueba:

```env
MERCADOPAGO_ACCESS_TOKEN=TEST-XXXX
```

Tarjetas de prueba (Sandbox):
- **VISA:** 4111 1111 1111 1111
- **MASTERCARD:** 5555 5555 5555 4444
- **AMEX:** 3782 822463 10005

---

## 📚 Recursos Adicionales

- [Documentación Oficial MP](https://www.mercadopago.com.ar/developers/es/reference/preferences/_checkout_preferences/post)
- [SDK Python/JavaScript](https://www.mercadopago.com.ar/developers/es/docs/sdks-library/landing)
- [Códigos de Error](https://www.mercadopago.com.ar/developers/es/reference)
- [Estado de Sistema MP](https://status.mercadopago.com)

---

## 🚀 Próximos Pasos

1. **Integrar UI de QR** en componente de cobro
2. **Configurar webhooks** en tu panel de Mercado Pago
3. **Hacer pruebas** en modo Sandbox
4. **Pasar a producción** cuando esté todo listo
5. **Monitorear pagos** en el panel de Mercado Pago

---

¡Tu integración está lista! 🎉
