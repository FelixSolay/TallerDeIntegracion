# 🎓 MEJORES PRÁCTICAS - INTEGRACIÓN MERCADO PAGO

## 🔐 Seguridad

### ✅ HACER

```javascript
// ✓ Usar variables de entorno para credenciales
const token = process.env.MERCADOPAGO_ACCESS_TOKEN;

// ✓ Validar datos en backend SIEMPRE
app.post('/api/pagos/crear-preferencia', (req, res) => {
  const { items, total } = req.body;
  
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Validación fallida' });
  }
  
  // Validar que total coincida con items
  const calculatedTotal = items.reduce((sum, item) => 
    sum + (item.precioUnitario * item.cantidad), 0
  );
  
  if (Math.abs(total - calculatedTotal) > 0.01) {
    return res.status(400).json({ error: 'Total no coincide' });
  }
  
  // Continuar...
});

// ✓ Usar HTTPS en producción
if (process.env.NODE_ENV === 'production') {
  // Forzar HTTPS
}

// ✓ Limitar rate limiting
const rateLimit = require('express-rate-limit');
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // máximo 100 requests
});
app.post('/api/pagos/**', paymentLimiter);
```

### ❌ NO HACER

```javascript
// ✗ No exponer tokens en cliente
const token = 'TEST-1234567890'; // ¡NUNCA!

// ✗ No confiar en el total del cliente
const total = req.body.total; // ¿Y si lo modifican?

// ✗ No guardar datos sensibles sin encriptar
user.creditCard = '4111111111111111'; // ¡PELIGRO!

// ✗ No ignoras webhooks
// Siempre procesar notificaciones
```

---

## 💾 Base de Datos

### ✅ Estructura recomendada

```javascript
// Schema de pago
const pagoSchema = {
  orderId: String,           // Tu ID de orden
  preferenceId: String,      // ID de Mercado Pago
  paymentId: String,         // ID del pago
  amount: Number,            // Monto exacto
  currency: String,          // ARS, USD, etc
  status: String,            // approved, pending, rejected
  paymentMethod: String,     // visa, mastercard, etc
  payerEmail: String,        // Email del pagador
  payerName: String,         // Nombre del pagador
  paymentDate: Date,         // Cuando se procesó
  webhookReceived: Boolean,  // Confirmación de webhook
  metadata: Object           // Datos adicionales
};

// Índices importantes
db.pagos.createIndex({ preferenceId: 1 });
db.pagos.createIndex({ paymentId: 1 });
db.pagos.createIndex({ orderId: 1 });
db.pagos.createIndex({ status: 1 });
db.pagos.createIndex({ paymentDate: -1 });
```

---

## 🔔 Webhooks

### ✅ HACER

```javascript
// ✓ Verificar origen del webhook
app.post('/api/pagos/webhook', (req, res) => {
  // Responder rápido con 200 OK
  res.status(200).json({ received: true });
  
  // Procesar asincronicamente
  procesarWebhook(req.body).catch(err => {
    console.error('Error procesando webhook:', err);
    // Guardar para reintentar después
  });
});

// ✓ Almacenar webhooks recibidos
const webhookLog = new Schema({
  type: String,
  data: Object,
  processedAt: { type: Date, default: Date.now },
  status: String // processed, failed, retry
});

// ✓ Implementar retry logic
async function procesarWebhook(data) {
  let reintentos = 0;
  const maxReintentos = 3;
  
  while (reintentos < maxReintentos) {
    try {
      await actualizarEstadoPago(data);
      return;
    } catch (error) {
      reintentos++;
      if (reintentos < maxReintentos) {
        await esperar(1000 * Math.pow(2, reintentos)); // Backoff exponencial
      }
    }
  }
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### ❌ NO HACER

```javascript
// ✗ No confiar ciegamente en webhooks
// Siempre verificar estado con query

// ✗ No procesar webhooks bloqueante
app.post('/webhook', async (req, res) => {
  await actualizarTodo(req.body); // ¡Lento!
  res.json({ ok: true });
});

// ✗ No ignorar fallos
try {
  procesarWebhook();
} catch {
  // ¡NO HACER NADA! Siempre loguear y reintentar
}
```

---

## 💳 Manejo de Pagos

### Estados de pago

```
pending     → Esperando confirmación
approved    → ✓ Pagado exitosamente
rejected    → ✗ Rechazado por banco
cancelled   → Cancelado por usuario
refunded    → Dinero devuelto
in_process  → En análisis
chargeback  → Disputa
```

### Transiciones válidas

```javascript
const transiciones = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['refunded'],
  rejected: ['cancelled'],
  cancelled: [],
  refunded: [],
  in_process: ['approved', 'rejected'],
  chargeback: []
};

function esTransicionValida(de, hacia) {
  return transiciones[de]?.includes(hacia) || false;
}
```

---

## 🧪 Testing

### Unit Tests

```javascript
describe('Mercado Pago Service', () => {
  it('debería crear preferencia válida', async () => {
    const datos = {
      items: [{ nombre: 'test', precioUnitario: 100, cantidad: 1 }],
      payer: { nombre: 'Test' }
    };
    
    const result = await createPaymentPreference(datos);
    expect(result.success).toBe(true);
    expect(result.preferenceId).toBeDefined();
  });

  it('debería rechazar items sin precio', async () => {
    const datos = {
      items: [{ nombre: 'test', precioUnitario: 0 }]
    };
    
    expect(() => createPaymentPreference(datos))
      .toThrow('Precio inválido');
  });
});
```

### E2E Tests

```javascript
// Test con tarjeta de sandbox
describe('Pago End-to-End', () => {
  it('debería procesar pago completo', async () => {
    // 1. Crear preferencia
    const pref = await crearPreferencia({...});
    expect(pref.preferenceId).toBeDefined();
    
    // 2. Simular pago
    const payment = await simularPagoSandbox({
      preferenceId: pref.preferenceId,
      card: '4111111111111111'
    });
    
    // 3. Verificar webhook
    await esperar(5000);
    const actualizado = await obtenerOrder();
    expect(actualizado.estado).toBe('approved');
  });
});
```

---

## 📊 Monitoreo

### Métricas importantes

```javascript
// Dasboard de métricas
{
  pagosExitosos: 0,
  pagosRechazados: 0,
  pagosPendientes: 0,
  montoTotal: 0,
  montoPromedio: 0,
  tiempoPromesoProcesamiento: 0,
  tasaConversion: 0,
  tasaRechazo: 0
}

// Logging
logger.info('Pago procesado', {
  paymentId,
  amount,
  status,
  timestamp: new Date(),
  duration: Date.now() - startTime
});

// Alertas
if (payment.status === 'rejected') {
  alertar('Pago rechazado', { paymentId, reason });
}

if (demoraWebhook > 30000) {
  alertar('Webhook lento', { paymentId, delay: demoraWebhook });
}
```

---

## 🚀 Despliegue a Producción

### Checklist pre-producción

```javascript
// ✓ Cambiar a credenciales de producción
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxx // NO TEST-

// ✓ Configurar HTTPS
MERCADOPAGO_WEBHOOK_URL=https://tu-dominio.com/api/pagos/webhook

// ✓ Configurar URLs correctas
FRONTEND_URL=https://tu-tienda.com
MP_SUCCESS_URL=https://tu-tienda.com/pago-exitoso

// ✓ Validar base de datos
- Backups automáticos activados
- Índices creados en tablas de pago

// ✓ Monitoreo
- Logs centralizados
- Alertas configuradas
- Métricas en dashboard

// ✓ Documentación
- Runbook de incidentes
- Contacto de soporte MP
- Procedimiento de rollback
```

---

## 🎯 Recomendaciones Finales

1. **Siempre valida en el backend**
   - Nunca confíes en datos del cliente

2. **Maneja errores gracefully**
   - El usuario debe saber qué pasó

3. **Implementa reintentos**
   - La red falla, prepárate

4. **Usa transacciones**
   - Consistencia de datos

5. **Audita todo**
   - Logs de cada pago importante

6. **Comunica claramente**
   - Mostrar estado real del pago

7. **Cumple normativas**
   - PCI-DSS para datos de tarjeta

8. **Prueba en sandbox**
   - Antes de lanzar a producción

---

*Última actualización: $(date)*
