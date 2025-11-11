# 🐛 Diagnóstico: Error 500 al Generar QR

## ❌ Problema

```
Error al generar QR: 500 Internal Server Error
POST http://localhost:3000/api/pagos/generar-qr
```

---

## 🔍 Diagnóstico

### Posibles Causas (en orden de probabilidad):

#### 1. **Credenciales de Mercado Pago no configuradas** ⭐ MÁS PROBABLE
El backend intenta usar `mercadopago-sdk` pero las credenciales no están cargadas correctamente.

**Comprueba:**
```bash
# Backend debe mostrar esto al iniciar:
# ✅ "Conectado a MongoDB Atlas"
# ✅ Las credenciales deben estar en .env
```

#### 2. **Mercado Pago SDK no instalado**
```bash
npm ls mercadopago
# Debe mostrar: mercadopago@2.9.0 (o similar)
```

#### 3. **Error en la librería qrcode**
```bash
npm ls qrcode
# Debe estar instalado
```

#### 4. **Variables de entorno no cargadas**
El archivo `.env` no está siendo leído por Node.js.

---

## ✅ Solución Paso a Paso

### Paso 1: Verificar instalación de paquetes
```bash
cd backend
npm install mercadopago@2.9.0 --save
npm install qrcode --save
npm install dotenv --save
```

### Paso 2: Verificar/Crear archivo .env
```bash
# En: backend/.env

MERCADOPAGO_ACCESS_TOKEN=APP_USR-3201752196282454-110113-729a47a82a7478337eb2b6e16046508c-2959473633
MERCADOPAGO_PUBLIC_KEY=APP_USR-9dacaaee-9cb2-421d-b824-1ecadefa6564
MERCADOPAGO_WEBHOOK_URL=http://localhost:3000/api/pagos/webhook
```

### Paso 3: Verificar que server.js carga dotenv
Al inicio del archivo `backend/server.js`, debe estar:

```javascript
// ✅ DEBE ESTAR AL INICIO
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
// ... resto de imports
```

### Paso 4: Verificar mercadopago-service.js
El archivo debe comenzar con:

```javascript
// ✅ DEBE ESTAR AL INICIO
const MercadoPagoSDK = require('mercadopago');

const client = new MercadoPagoSDK.MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-YOUR_ACCESS_TOKEN_HERE'
});

const preferenceClient = new MercadoPagoSDK.Preference(client);
// ... resto del código
```

### Paso 5: Reiniciar Backend
```bash
cd backend
npm run dev
# O
node server.js
```

**Debe mostrar:**
```
✅ Conectado a MongoDB Atlas
✅ Servidor corriendo en puerto 3000
```

---

## 🔧 Troubleshooting Avanzado

Si el error persiste, agrega logging adicional al backend:

### Edita: backend/server.js (línea ~2735)

Reemplaza:
```javascript
app.post('/api/pagos/generar-qr', async (req, res) => {
    try {
        const { cantidad, descripcion, items, reference, title } = req.body;
        // ... resto del código
    }
}
```

Por:
```javascript
app.post('/api/pagos/generar-qr', async (req, res) => {
    try {
        console.log('📥 Solicitud QR recibida:', {
            cantidad: req.body.cantidad,
            descripcion: req.body.descripcion,
            items: req.body.items?.length || 0,
            accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ? '✅ Configurado' : '❌ No existe'
        });

        const { cantidad, descripcion, items, reference, title } = req.body;
        
        if (!cantidad && (!items || items.length === 0)) {
            return res.status(400).json({ success: false, error: 'cantidadOItemsRequeridos' });
        }

        console.log('✅ Validación pasada, generando QR...');

        const qrData = {
            title: title || descripcion || 'Compra en tienda',
            description: descripcion || 'Pago en punto de venta',
            amount: cantidad,
            externalReference: reference || `QR-${Date.now()}`,
            items: items || []
        };

        console.log('📦 Datos QR:', qrData);

        const qrResult = await mercadopagoService.generateQRCode(qrData);

        console.log('✅ QR generado exitosamente');

        return res.status(201).json({
            success: true,
            preferenceId: qrResult.preferenceId,
            qrCode: qrResult.qrCode,
            checkoutUrl: qrResult.checkoutUrl,
            sandboxUrl: qrResult.sandboxUrl,
            totalAmount: qrResult.totalAmount
        });

    } catch (error) {
        console.error('❌ Error COMPLETO al generar QR:', {
            message: error.message,
            stack: error.stack,
            errorObject: error
        });
        res.status(500).json({ 
            success: false, 
            error: error.error || error.message || 'serverError',
            details: error.message // ← Esto ayudará a debuggear
        });
    }
});
```

Luego reinicia el backend y mira la consola para ver exactamente dónde falla.

---

## 📋 Checklist de Verificación

- [ ] `npm install mercadopago@2.9.0` instalado
- [ ] `npm install qrcode` instalado
- [ ] `npm install dotenv` instalado
- [ ] `.env` tiene `MERCADOPAGO_ACCESS_TOKEN`
- [ ] `.env` tiene `MERCADOPAGO_PUBLIC_KEY`
- [ ] `server.js` tiene `require('dotenv').config()` al inicio
- [ ] `mercadopago-service.js` carga correctamente el token
- [ ] Backend se reinició después de cambios
- [ ] Consola del backend muestra "Conectado a MongoDB"
- [ ] Frontend hace POST a `http://localhost:3000/api/pagos/generar-qr`

---

## 🚀 Próximos Pasos

1. **Aplica las soluciones del Paso 1-4**
2. **Reinicia el backend**
3. **Revisa la consola del backend** (debe mostrar logs de DEBUG)
4. **Intenta generar QR nuevamente**
5. **Si aún falla, comparte la consola del backend completa**

---

## 📞 Si Persiste el Error

Por favor comparte:

```bash
# 1. Salida de la consola del backend
# Captura todo lo que dice cuando intentas generar QR

# 2. Contenido de backend/.env
cat backend/.env

# 3. Salida de:
npm ls mercadopago
npm ls qrcode
npm ls dotenv

# 4. El objeto error exacto de la consola del navegador (F12)
```

---

## ✨ Solución Rápida (copia-pega)

Si quieres una solución rápida, ejecuta esto en terminal backend:

```bash
cd backend

# Instalar todas las dependencias necesarias
npm install mercadopago@2.9.0 qrcode dotenv --save

# Verificar que estén instaladas
npm ls mercadopago qrcode dotenv

# Reiniciar
npm run dev
```

Si aún da error 500, entonces es un problema de configuración de variables de entorno.

---

**Estado:** 🔴 Requiere acción
**Prioridad:** 🔴 Alta
**Impacto:** 🔴 Sin poder generar QR

Resuelve esto y el QR funcionará perfecto. 🚀
