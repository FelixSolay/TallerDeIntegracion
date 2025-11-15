// Configuración de Mercado Pago SDK
const MercadoPagoSDK = require('mercadopago');

// Inicializar cliente de Mercado Pago con tu ACCESS_TOKEN
// Este debe estar en variables de entorno (.env)
const client = new MercadoPagoSDK.MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'APP_USR-2687564347381969-111022-6200ce21ec9348c4427392afcfd9a28e-2980326675',
    options: {
        timeout: 5000,
        idempotencyKey: 'unique-key'
    }
});

module.exports = client;
