// Configuración de Mercado Pago SDK
const MercadoPagoSDK = require('mercadopago');

// Inicializar cliente de Mercado Pago con tu ACCESS_TOKEN
// Este debe estar en variables de entorno (.env)
const client = new MercadoPagoSDK.MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-YOUR_ACCESS_TOKEN_HERE',
    options: {
        timeout: 5000,
        idempotencyKey: 'unique-key'
    }
});

module.exports = client;
