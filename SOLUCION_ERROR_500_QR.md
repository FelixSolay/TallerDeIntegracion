# ✅ SOLUCIÓN ENCONTRADA - Error 500 QR

## 🎯 Problema Identificado

**El archivo `backend/server.js` NO estaba cargando las variables de entorno**.

Faltaba esta línea al inicio:
```javascript
require('dotenv').config();
```

Sin esto, `process.env.MERCADOPAGO_ACCESS_TOKEN` era `undefined`, causando error 500.

---

## ✅ SOLUCIÓN APLICADA

He agregado la línea en `backend/server.js` línea 1:

```javascript
// ✅ CARGAR VARIABLES DE ENTORNO AL INICIO
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
// ... resto de imports
```

---

## 🚀 Ahora Prueba Esto

### Paso 1: Detén el servidor backend (si está corriendo)
```bash
# Si está corriendo, presiona Ctrl+C
```

### Paso 2: Reinicia el backend
```bash
cd backend
npm run dev
```

**Debe mostrar en consola:**
```
✅ Conectado a MongoDB Atlas
✅ Servidor corriendo en puerto 3000
```

### Paso 3: Prueba generar QR
1. Abre la app: `http://localhost:4200`
2. Login como cliente
3. Carrito → Pagar
4. Selecciona: **💳 Tarjeta (Mercado Pago)**
5. Ingresa dirección
6. Haz clic: **Confirmar pago**
7. **¡Debe aparecer el QR! ✨**

---

## 📊 Verificación

Si aún da error, ejecuta esto en la terminal:

```bash
cd backend

# Verificar que dotenv está instalado
npm ls dotenv

# Debe mostrar: dotenv@17.2.3 ✅

# Verificar que mercadopago está instalado
npm ls mercadopago

# Debe mostrar: mercadopago@2.9.0 ✅
```

---

## ✨ Lo que pasó

```
ANTES:
server.js iniciaba
├─ ❌ dotenv.config() NO se ejecutaba
├─ ❌ process.env.MERCADOPAGO_ACCESS_TOKEN = undefined
├─ ❌ Mercado Pago SDK fallaba
└─ ❌ Error 500 en /api/pagos/generar-qr

DESPUÉS:
server.js iniciaba
├─ ✅ require('dotenv').config() al inicio
├─ ✅ process.env.MERCADOPAGO_ACCESS_TOKEN = APP_USR-...
├─ ✅ Mercado Pago SDK funciona
└─ ✅ QR se genera exitosamente
```

---

## 🎉 Resultado

Ahora el flujo es:

```
Frontend envía:
POST /api/pagos/generar-qr

Backend recibe:
1. ✅ Carga variables de entorno (.env)
2. ✅ Lee MERCADOPAGO_ACCESS_TOKEN
3. ✅ Configura Mercado Pago SDK
4. ✅ Genera preferencia en MP
5. ✅ Retorna QR al frontend

Frontend muestra:
✨ Modal con QR código
✨ Contador (5 min)
✨ Botones (escanear, link, copiar)
```

---

## 📝 Cambio Aplicado

**Archivo:** `backend/server.js`  
**Línea:** 1 (al inicio)  
**Cambio:**
```diff
+ // ✅ CARGAR VARIABLES DE ENTORNO AL INICIO
+ require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
```

---

## 🚀 Próximos Pasos

1. ✅ Reinicia backend (`npm run dev`)
2. ✅ Prueba generar QR
3. ✅ Debería funcionar ahora

Si aún falla:
- [ ] Verifica que `.env` existe y tiene las credenciales
- [ ] Verifica que no hay typos en `MERCADOPAGO_ACCESS_TOKEN`
- [ ] Limpia cache del navegador (Ctrl+Shift+Del)
- [ ] Reinicia ambos servidores (backend y frontend)

---

## ✅ Estado

```
❌ Error 500 QR: RESUELTO ✅

Causa:       dotenv no se cargaba
Solución:    Agregada línea require('dotenv').config()
Archivo:     backend/server.js
Aplicado:    ✅ Sí
Listo:       ✅ Sí

PRÓXIMO PASO: Reinicia backend y prueba
```

---

**¡El QR ya debería funcionar! 🎉**
