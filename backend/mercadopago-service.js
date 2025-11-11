// Servicio de Mercado Pago
const MercadoPagoSDK = require('mercadopago');
const QRCode = require('qrcode');

const client = new MercadoPagoSDK.MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-YOUR_ACCESS_TOKEN_HERE'
});

const preferenceClient = new MercadoPagoSDK.Preference(client);
const paymentClient = new MercadoPagoSDK.Payment ? new MercadoPagoSDK.Payment(client) : null;

/**
 * Crear una preferencia de pago para Mercado Pago
 * @param {Object} orderData - Datos del pedido
 * @returns {Promise<Object>} - Objeto con la preferencia creada
 */
async function createPaymentPreference(orderData) {
    try {
        const {
            items,
            payer,
            notificationUrl,
            backUrls = {},
            externalReference,
            autoReturn = true
        } = orderData;

        const preferenceBody = {
            items: items.map(item => ({
                id: item.productId || item.id || 'item',
                title: item.nombre || item.title,
                description: item.descripcion || item.description || '',
                picture_url: item.image || '',
                category_id: item.categoriaId || 'product',
                quantity: item.cantidad || item.quantity || 1,
                currency_id: 'ARS',
                unit_price: parseFloat(item.precioUnitario || item.price || 0)
            })),
            payer: {
                name: payer.nombre || payer.name || '',
                surname: payer.apellido || payer.surname || '',
                email: payer.email || payer.mail || '',
                phone: {
                    area_code: payer.areaCode || '11',
                    number: payer.phoneNumber || 0
                },
                identification: {
                    type: payer.idType || 'DNI',
                    number: payer.dni || payer.identification || ''
                },
                address: {
                    zip_code: payer.zipCode || payer.codigoPostal || '',
                    street_name: payer.street || payer.domicilio || '',
                    street_number: payer.streetNumber || 0
                }
            },
            back_urls: {
                success: backUrls.success || process.env.MP_SUCCESS_URL || 'http://localhost:4200/pago-exitoso',
                failure: backUrls.failure || process.env.MP_FAILURE_URL || 'http://localhost:4200/pago-fallido',
                pending: backUrls.pending || process.env.MP_PENDING_URL || 'http://localhost:4200/pago-pendiente'
            },
            notification_url: notificationUrl || process.env.MERCADOPAGO_WEBHOOK_URL || '',
            external_reference: externalReference || '',
            auto_return: autoReturn === true ? 'approved' : 'all',
            marketplace: 'NONE',
            binary_mode: false,
            statement_descriptor: 'SUPERMERCADO'
        };

        const preference = await preferenceClient.create({ body: preferenceBody });
        
        return {
            success: true,
            preferenceId: preference.id,
            checkoutUrl: preference.init_point,
            sandboxUrl: preference.sandbox_init_point,
            qrCode: preference.qr_code || null,
            preference: preference
        };
    } catch (error) {
        console.error('Error al crear preferencia de Mercado Pago:', error);
        throw {
            success: false,
            error: error.message || 'Error al crear la preferencia de pago'
        };
    }
}

/**
 * Obtener información de una preferencia existente
 * @param {string} preferenceId - ID de la preferencia
 * @returns {Promise<Object>}
 */
async function getPreference(preferenceId) {
    try {
        const preference = await preferenceClient.get(preferenceId);
        return {
            success: true,
            preference: preference
        };
    } catch (error) {
        console.error('Error al obtener preferencia:', error);
        throw {
            success: false,
            error: error.message || 'Error al obtener la preferencia'
        };
    }
}

/**
 * Generar QR para pago en punto de venta
 * @param {Object} qrData - Datos del QR
 * @returns {Promise<Object>}
 */
async function generateQRCode(qrData) {
    // Esta es la URL del QR que se escaneará
    const qrUrl = `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id={preferenceId}`;
    
    try {
        const {
            title,
            description,
            amount,
            externalReference,
            items = []
        } = qrData;

        // Crear items con información detallada
        const qrItems = items.length > 0 ? items : [
            {
                title: title || 'Pago',
                description: description || '',
                quantity: 1,
                unit_price: amount || 0,
                currency_id: 'ARS'
            }
        ];

        const preferenceBody = {
            items: qrItems.map(item => ({
                id: item.productId || item.id || 'qr-item',
                title: item.title || item.nombre || 'Producto',
                description: item.description || item.descripcion || '',
                quantity: item.quantity || item.cantidad || 1,
                currency_id: 'ARS',
                unit_price: parseFloat(item.unit_price || item.precioUnitario || 0)
            })),
            payer: {
                name: 'Cliente',
                surname: 'Punto de Venta'
            },
            external_reference: externalReference || `QR-${Date.now()}`,
            notification_url: process.env.MERCADOPAGO_WEBHOOK_URL || '',
            marketplace: 'NONE',
            binary_mode: true // Modo binario para POS
        };

        const preference = await preferenceClient.create({ body: preferenceBody });

        // ✅ GENERAR QR CODE CON LA URL DE PREFERENCIA
        let qrCodeBase64 = null;
        try {
            const qrPaymentUrl = preference.sandbox_init_point || preference.init_point;
            console.log('🔗 URL para generar QR:', qrPaymentUrl);
            
            // Generar imagen QR en base64
            qrCodeBase64 = await QRCode.toDataURL(qrPaymentUrl, {
                errorCorrectionLevel: 'H',
                type: 'image/png',
                width: 250,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });
            
            // Remover el prefijo "data:image/png;base64," para guardar solo el base64
            if (qrCodeBase64 && qrCodeBase64.startsWith('data:')) {
                qrCodeBase64 = qrCodeBase64.replace('data:image/png;base64,', '');
            }
            
            console.log('✅ QR generado correctamente');
        } catch (qrError) {
            console.warn('⚠️ Error generando imagen QR:', qrError.message);
            qrCodeBase64 = null;
        }

        return {
            success: true,
            preferenceId: preference.id,
            qrCode: qrCodeBase64, // ✅ QR CODE COMO BASE64
            checkoutUrl: preference.init_point,
            sandboxUrl: preference.sandbox_init_point,
            totalAmount: qrItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0),
            preference: preference
        };
    } catch (error) {
        console.error('Error al generar QR:', error);
        throw {
            success: false,
            error: error.message || 'Error al generar el código QR'
        };
    }
}

module.exports = {
    createPaymentPreference,
    getPreference,
    generateQRCode
    ,
    getPayment: async function(paymentId) {
        if (!paymentClient) {
            // Fallback: intentar usar fetch a la API de Mercado Pago
            try {
                const fetch = global.fetch || require('node-fetch');
                const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;
                const resp = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` }
                });
                const payment = await resp.json();
                return { success: true, payment };
            } catch (err) {
                console.error('Error en fallback getPayment:', err);
                return { success: false, error: err.message || err };
            }
        }

        try {
            const payment = await paymentClient.get(paymentId);
            return { success: true, payment };
        } catch (error) {
            console.error('Error al obtener payment desde SDK:', error);
            return { success: false, error: error.message || error };
        }
    }
};
