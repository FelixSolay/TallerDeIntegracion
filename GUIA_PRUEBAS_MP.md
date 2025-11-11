# 🧪 GUÍA DE PRUEBAS - MERCADO PAGO QR

## Prueba Local con ngrok (para testing de webhooks)

### 1. Instalar ngrok (si no lo tienes)

**Windows:**
```powershell
choco install ngrok
# o descargar desde https://ngrok.com/download
```

**macOS:**
```bash
brew install ngrok
```

**Linux:**
```bash
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.zip
unzip ngrok-v3-stable-linux-amd64.zip
```

### 2. Configurar ngrok

```bash
# Autenticarse (crear cuenta en ngrok.com primero)
ngrok config add-authtoken tu-token-aqui
```

### 3. Exponer tu servidor

En una terminal:

```bash
ngrok http 3000
```

Output:
```
Session Status  online
Account         tu-email@example.com
Version         3.x.x
Region          us (United States)
Latency         -
Web Interface   http://127.0.0.1:4040

Forwarding      https://1234-56-78-90-12.ngrok.io -> http://localhost:3000
```

### 4. Copiar tu URL pública

```
https://1234-56-78-90-12.ngrok.io
```

### 5. Actualizar .env

```env
# Cambiar en .env:
MERCADOPAGO_WEBHOOK_URL=https://1234-56-78-90-12.ngrok.io/api/pagos/webhook
FRONTEND_URL=http://localhost:4200
```

---

## Pruebas con cURL

### Test 1: Generar QR

```bash
curl -X POST http://localhost:3000/api/pagos/generar-qr \
  -H "Content-Type: application/json" \
  -d '{
    "cantidad": 500.50,
    "descripcion": "Compra de test",
    "title": "QR de Prueba",
    "reference": "TEST-001-2024"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "preferenceId": "202809963-xxxxx",
  "qrCode": "data:image/png;base64,...",
  "checkoutUrl": "https://www.mercadopago.com/...",
  "totalAmount": 500.50
}
```

### Test 2: Crear Preferencia de Pago

```bash
curl -X POST http://localhost:3000/api/pagos/crear-preferencia \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-12345",
    "dni": "12345678",
    "items": [
      {
        "nombre": "Producto Test",
        "precioUnitario": 100,
        "cantidad": 2
      }
    ],
    "total": 200
  }'
```

### Test 3: Obtener Preferencia

```bash
curl -X GET http://localhost:3000/api/pagos/preferencia/202809963-xxxxx
```

### Test 4: Confirmar Pago

```bash
curl -X PUT http://localhost:3000/api/pagos/confirmar-pago \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-12345",
    "dni": "12345678",
    "paymentId": "payment-12345",
    "preferenceId": "202809963-xxxxx",
    "status": "approved"
  }'
```

---

## Prueba Completa en Navegador

### Paso 1: Ir a la página de pago

```
http://localhost:4200/pago
```

### Paso 2: Generar QR

Hacer clic en botón "Generar Código QR"

### Paso 3: Ver QR en pantalla

Debería mostrar un código QR scaneable

### Paso 4: Simular pago (en Sandbox)

**Opción A: Con tu celular**
1. Abre tu billetera virtual (Mercado Pago app)
2. Escanea el QR
3. Completa el pago con tarjeta de prueba

**Opción B: Simular en postman/Thunder Client**

Enviar request simulando pago:

```bash
POST /api/pagos/webhook
Content-Type: application/json

{
  "type": "payment",
  "data": {
    "id": "payment-12345"
  }
}
```

### Paso 5: Verificar confirmación

La página debería mostrar "Pago confirmado" o ir a página de éxito.

---

## Debugging

### Ver logs del servidor

En la terminal donde corre el server:

```bash
# Ver requests
POST /api/pagos/generar-qr
200 OK - 245ms

POST /api/pagos/webhook  
200 OK - 12ms
```

### Ver logs en browser

F12 → Console → Ver requests de red

### Ver transacciones en Mercado Pago

1. Ve a https://www.mercadopago.com.ar/activities
2. En Sandbox verás tus transacciones de prueba
3. Puedes ver estado, detalles, etc.

---

## Checklist de Pruebas

### Backend ✓

- [ ] Servidor inicia sin errores
- [ ] `npm list mercadopago` muestra 2.9.0
- [ ] Archivos creados: `mercadopago-service.js`, `mercadopago-config.js`
- [ ] `.env` tiene `MERCADOPAGO_ACCESS_TOKEN` válido
- [ ] Endpoints responden (GET /api/pagos/preferencia/:id)

### QR ✓

- [ ] POST /api/pagos/generar-qr devuelve QR válido
- [ ] Imagen QR es escaneable
- [ ] preferenceId no es null

### Webhook ✓

- [ ] ngrok expone puerto 3000
- [ ] POST /api/pagos/webhook responde 200
- [ ] Se registran logs de notificaciones

### Seguridad ✓

- [ ] Token NO está en cliente
- [ ] Token está en .env
- [ ] CORS configurado correctamente
- [ ] Datos validados en backend

---

## Tarjetas de Prueba Sandbox

### VISA ✓ Aprobada
```
Número:       4111 1111 1111 1111
Vencimiento:  11/25
CVV:          123
Titular:      APRO
```

### MASTERCARD ✗ Rechazada
```
Número:       5555 5555 5555 4444
Vencimiento:  11/25
CVV:          123
Titular:      OTHE
```

### Pruebas Pendientes
```
Número:       4000 0000 0000 0002
Vencimiento:  11/25
CVV:          123
Titular:      CONT
```

---

## Tabla de Estados

| Status | Significado | Acción |
|--------|-------------|--------|
| pending | Esperando | Seguir esperando |
| approved | ✓ Aprobado | Actualizar orden a "entregada" |
| rejected | ✗ Rechazado | Mostrar error, permitir reintentar |
| cancelled | Cancelado | Liberar items del carrito |
| in_process | En análisis | Esperar notificación |

---

## Errores Comunes y Soluciones

### ❌ "invalid_access_token"

**Causa:** Token incorrecto en .env

**Solución:**
```bash
1. Ve a https://www.mercadopago.com.ar/developers/panel/app
2. Copia el token TEST-xxxx completo
3. Reemplaza en .env
4. Reinicia servidor
```

### ❌ "collector_does_not_comply_with_current_regulation"

**Causa:** Perfil de Mercado Pago incompleto

**Solución:**
```bash
1. Ve a https://www.mercadopago.com.ar/profile
2. Completa datos personales
3. Valida identidad
4. Intenta de nuevo
```

### ❌ "preference_not_found"

**Causa:** ID de preferencia inválido

**Solución:**
```bash
# Verificar que preferenceId sea correcto
echo $preferenceId

# Regenerar QR/preferencia
```

### ❌ Webhook no llega

**Causa:** 
- Servidor no expuesto
- URL incorrecta en .env
- Firewall

**Solución:**
```bash
1. Usar ngrok para exponer
2. Actualizar .env con URL de ngrok
3. Verificar firewall permite puerto 3000
4. Probar con curl: curl https://ngrok-url/api/pagos/webhook
```

### ❌ CORS error

**Causa:** Headers de CORS no configurados

**Solución:**
```javascript
// Ya configurado en server.js
app.use(cors()); // ✓ está ahí
```

---

## Monitoreo Durante Testing

### Terminal 1: Servidor

```bash
cd backend
npm run dev

# Output esperado:
# 🚀 Servidor corriendo en http://localhost:3000
```

### Terminal 2: ngrok

```bash
ngrok http 3000

# Output esperado:
# Forwarding https://xxxx.ngrok.io -> http://localhost:3000
```

### Terminal 3: Tests

```bash
# Ejecutar pruebas
curl -X POST http://localhost:3000/api/pagos/generar-qr ...
```

### Panel ngrok

Abrir en navegador:
```
http://127.0.0.1:4040
```

Aquí verás:
- Todas las requests recibidas
- Headers
- Body
- Response
- Timing

---

## Próximas Pruebas

- [ ] Prueba end-to-end completa
- [ ] Probar rechazos de tarjeta
- [ ] Probar reembolsos
- [ ] Probar múltiples items
- [ ] Probar webhook de actualización
- [ ] Probar timeout de preferencia
- [ ] Probar error handling

---

*¡Listo para hacer pruebas! 🚀*
