// ✅ CARGAR VARIABLES DE ENTORNO AL INICIO
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ 
    dest: 'uploads/',
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB máximo
    }
});
const fs = require('fs');
const crypto = require('crypto');
const { type } = require('os');
const mercadopagoService = require('./mercadopago-service');


const app = express();
const port = 3000;


// Middleware
app.use(cors()); // Permite conexiones desde Angular
app.use(express.json({ limit: '10mb' })); // Para procesar JSON en las peticiones, aumentado a 10MB
app.use(express.urlencoded({ limit: '10mb', extended: true })); // Para datos de formularios

mongoose.connect('mongodb+srv://pololo5007:Playa1820@cluster0.qlomp8b.mongodb.net/SupermercadoDB?retryWrites=true&w=majority&appName=Cluster0')
.then(() => console.log('Conectado a MongoDB Atlas'))
.catch(err => console.error('Error al conectar a MongoDB:', err));

function validateEmail(email) {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}

function validatePhone(telefono) {
  const regex = /^[\d\s\-\(\)\+]{8,15}$/;
  return regex.test(telefono);
}

function validatePostalCode(codigoPostal) {
  const regex = /^\d{4,8}$/;
  return regex.test(codigoPostal);
}

function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function sanitizeDireccion(rawDireccion) {
    const base = {
        calle: '',
        altura: '',
        piso: '',
        departamento: '',
        ciudad: '',
        provincia: '',
        codigoPostal: ''
    };

    if (!rawDireccion || typeof rawDireccion !== 'object') {
        return { ...base };
    }

    return {
        calle: normalizeString(rawDireccion.calle),
        altura: normalizeString(rawDireccion.altura),
        piso: normalizeString(rawDireccion.piso),
        departamento: normalizeString(rawDireccion.departamento),
        ciudad: normalizeString(rawDireccion.ciudad),
        provincia: normalizeString(rawDireccion.provincia),
        codigoPostal: normalizeString(rawDireccion.codigoPostal)
    };
}

function direccionTieneDatos(direccion) {
    if (!direccion || typeof direccion !== 'object') {
        return false;
    }
    return Object.values(direccion).some(value => typeof value === 'string' && value.trim() !== '');
}

function buildDireccionCompleta(direccion) {
    const dir = sanitizeDireccion(direccion);
    const partes = [];

    if (dir.calle) {
        const principal = dir.altura ? `${dir.calle} ${dir.altura}` : dir.calle;
        partes.push(principal);
    }

    const complementos = [];
    if (dir.piso) {
        complementos.push(`Piso ${dir.piso}`);
    }
    if (dir.departamento) {
        complementos.push(`Depto ${dir.departamento}`);
    }
    if (complementos.length > 0) {
        partes.push(complementos.join(', '));
    }

    const ciudadPartes = [];
    if (dir.ciudad) {
        ciudadPartes.push(dir.ciudad);
    }
    if (dir.codigoPostal) {
        ciudadPartes.push(`(${dir.codigoPostal})`);
    }
    if (ciudadPartes.length > 0) {
        partes.push(ciudadPartes.join(' '));
    }

    if (dir.provincia) {
        partes.push(dir.provincia);
    }

    return partes.join(', ').trim();
}

function customerTieneDireccionGuardada(customer) {
    if (!customer) {
        return false;
    }

    if (customer.direccion && typeof customer.direccion === 'object') {
        const direccionObj = typeof customer.direccion.toObject === 'function'
            ? customer.direccion.toObject()
            : customer.direccion;
        if (direccionTieneDatos(direccionObj)) {
            return true;
        }
    }

    return !!(customer.domicilio && customer.domicilio.trim() !== '');
}

function maybePersistDireccion(customer, direccion, direccionCompleta) {
    if (!customer) {
        return false;
    }

    if (customerTieneDireccionGuardada(customer)) {
        return false;
    }

    const direccionSanitizada = sanitizeDireccion(direccion);
    const tieneDatos = direccionTieneDatos(direccionSanitizada);
    const completa = direccionCompleta || buildDireccionCompleta(direccionSanitizada);

    if (!tieneDatos && !completa) {
        return false;
    }

    if (tieneDatos) {
        customer.direccion = direccionSanitizada;
        customer.domicilio = completa || buildDireccionCompleta(direccionSanitizada);
        customer.codigoPostal = direccionSanitizada.codigoPostal || customer.codigoPostal || '';
    } else if (completa) {
        customer.direccion = {
            calle: completa,
            altura: '',
            piso: '',
            departamento: '',
            ciudad: '',
            provincia: '',
            codigoPostal: customer.codigoPostal || ''
        };
        customer.domicilio = completa;
    }

    return true;
}

// Registrar cliente
// Definir un esquema y modelo para clientes (ahora con carrito)
const cartItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'productos', required: false },
    nombre: { type: String, required: true },
    precioUnitario: { type: Number, required: true, min: 0 },
    cantidad: { type: Number, required: true, min: 1, default: 1 },
    subtotal: { type: Number, required: true, min: 0 }
}, { _id: false }); // evitar id adicional por cada item si no es necesario

const customerSchema = new mongoose.Schema({
    nombre: String,
    apellido: String,
    dni: { type: String, index: true },
    mail: String,
    password: String,
    telefono: String,
    domicilio: { type: String, default: '' },
    direccion: {
        calle: { type: String, default: '' },
        altura: { type: String, default: '' },
        piso: { type: String, default: '' },
        departamento: { type: String, default: '' },
        ciudad: { type: String, default: '' },
        provincia: { type: String, default: '' },
        codigoPostal: { type: String, default: '' }
    },
    codigoPostal: { type: String, default: '' },
    saldoAFavor: { type: Number, default: 0, min: 0 },
    carrito: {
        items: { type: [cartItemSchema], default: [] },
        total: { type: Number, default: 0, min: 0 }
    },
    favoritos: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'productos' }],
        default: []
    }
});

const Customer = mongoose.model('clientes', customerSchema);

// Esquema de pedidos
const orderItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'productos', required: false },
    nombre: { type: String, required: true },
    precioUnitario: { type: Number, required: true, min: 0 },
    cantidad: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'clientes', required: true },
    dni: { type: String, required: true },
    nombre: { type: String, default: '' },
    direccionEntrega: { type: String, required: true },
    items: { type: [orderItemSchema], default: [] },
    total: { type: Number, required: true, min: 0 },
    estado: { type: String, enum: ['pendiente', 'pagado', 'entregado', 'cancelado'], default: 'pendiente' },
    fechaEntrega: { type: Date, default: null },
    metodoPago: { type: String, default: 'carrito' },
    stockAjustado: { type: Boolean, default: false },
    // Campos para integración Mercado Pago
    paymentId: { type: String, default: null },
    preferenceId: { type: String, default: null },
    paymentStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled', 'refunded'], default: null },
    paymentMethod: { type: String, default: null }, // visa, mastercard, efectivo, etc
    paymentDate: { type: Date, default: null },
    externalReference: { type: String, default: null }
}, { timestamps: { createdAt: 'creadoEl', updatedAt: 'actualizadoEl' } });

const Order = mongoose.model('orders', orderSchema);

// Definir esquema y modelo para admins (necesario antes de usar Admin)
const adminSchema = new mongoose.Schema({
    nombre: String,
    telefono: { type: String, default: '' },
    mail: { type: String, default: '' },
    password: String
});

const Admin = mongoose.model('admins', adminSchema);

function hashPassword(password) {
    const hash = crypto.createHash('sha256');
    hash.update(password);
    return hash.digest('hex');
}
// Ruta /register corregida
app.post('/api/customers/register', async (req, res) => {
    let { nombre, apellido, dni, mail, telefono, password1, password2 } = req.body;

    // Trim and basic validation
    nombre = nombre ? nombre.trim() : '';
    apellido = apellido ? apellido.trim() : '';
    dni = dni ? dni.trim() : '';
    mail = mail ? mail.trim() : '';
    telefono = telefono ? telefono.trim() : '';

    if (!nombre || !apellido || !dni || !mail || !telefono || !password1 || !password2) {
        return res.status(400).json({ success: false, reason: "missingFields" });
    }

    try {
        // Check passwords before hashing
        if (password1 !== password2) {
            return res.json({ success: false, reason: "wrongPassword" });
        }

        if (!validateEmail(mail)) {
            return res.json({ success: false, reason: "badEmail" });
        }

        if (!validatePhone(telefono)) {
            return res.json({ success: false, reason: "badTelefono" });
        }

        // Verificar si ya existe el cliente por mail
        const user = await Customer.findOne({ mail: mail });

        if (user) {
            return res.json({ success: false, reason: "alreadyExists" });
        }

        const hashedPassword = hashPassword(password1);

        await Customer.create({
            nombre,
            apellido,
            dni,
            mail,
            telefono,
            password: hashedPassword,
            domicilio: '', // Campo vacío por defecto
            direccion: sanitizeDireccion({}),
            codigoPostal: '' // Campo vacío por defecto
        });
        return res.json({ success: true, type: "cliente" });
    } catch (error) {
        console.error('Error al registrar el usuario:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});



// Login
app.post('/api/admins', async (req, res) => {
    const { dni, password } = req.body;
  
    try {
        const admin = await Admin.findOne({ dni: dni.toString() });
        if (!admin) {
            return res.status(401).json({ success: false, error: 'dniIncorrecto' });
        }
    
        const hashedPassword = hashPassword(password);
        if (admin.password !== hashedPassword) {
            return res.status(401).json({ success: false, error: 'contraseñaIncorrecta' });
        }
  
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// New admin login route that supports login by mail or dni
app.post('/api/admins/login', async (req, res) => {
    const { mail, dni, password } = req.body;
    
    try {
        let admin = null;
        if (mail && mail.trim() !== '') {
            admin = await Admin.findOne({ mail: mail.trim() });
        } else if (dni) {
            admin = await Admin.findOne({ dni: dni.toString() });
        } else {
            return res.status(400).json({ success: false, error: 'missingCredentials' });
        }

        if (!admin) {
            return res.status(401).json({ success: false, error: 'adminNotFound' });
        }

        const hashedPassword = hashPassword(password);
        
        if (admin.password !== hashedPassword) {
            return res.status(401).json({ success: false, error: 'contraseñaIncorrecta' });
        }

        // Return useful info so frontend can store session data
        res.status(200).json({ success: true,type: "administrador", name: admin.nombre || '', mail: admin.mail || '', dni: admin.dni || '' });
    } catch (error) {
        console.error('Error en admin login (mail/dni):', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Actualizar datos del admin (por mail)
app.put('/api/admins/update', async (req, res) => {
    let { mail, nombre, telefono, password } = req.body;

    mail = mail ? mail.trim() : '';
    nombre = nombre ? nombre.trim() : '';
    telefono = telefono ? telefono.trim() : '';

    if (!mail) {
        return res.status(400).json({ success: false, reason: 'missingMail' });
    }

    try {
        // Validaciones opcionales
        if (telefono && !validatePhone(telefono)) {
            return res.status(400).json({ success: false, reason: 'badTelefono' });
        }

        if (nombre === '') {
            // allow empty nombre? we'll not force it, just leave existing if not provided
        }

        const updateData = {};
        if (nombre) updateData.nombre = nombre;
        if (telefono) updateData.telefono = telefono;
        if (password) updateData.password = hashPassword(password);

        const updatedAdmin = await Admin.findOneAndUpdate({ mail: mail }, updateData, { new: true });
        if (!updatedAdmin) {
            return res.status(404).json({ success: false, reason: 'adminNotFound' });
        }

        return res.json({ success: true, admin: { nombre: updatedAdmin.nombre, mail: updatedAdmin.mail, dni: updatedAdmin.dni } });
    } catch (error) {
        console.error('Error actualizando admin:', error);
        return res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Eliminar admin por mail
app.delete('/api/admins/:mail', async (req, res) => {
    const { mail } = req.params;
    if (!mail || mail.trim() === '') {
        return res.status(400).json({ success: false, reason: 'missingMail' });
    }

    try {
        const deleted = await Admin.findOneAndDelete({ mail: mail.trim() });
        if (!deleted) {
            return res.status(404).json({ success: false, reason: 'adminNotFound' });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('Error eliminando admin:', error);
        return res.status(500).json({ success: false, reason: 'serverError' });
    }
});

app.post('/api/customers/login', async (req, res) => {
    const { mail, password } = req.body;
    try {
        const customer = await Customer.findOne({ mail: mail});
        if (!customer) {
            return res.status(401).json({ success: false, error: 'mailIncorrecto' });
        }
        const hashedPassword = hashPassword(password);
        if (customer.password !== hashedPassword) {
            return res.status(401).json({ success: false, error: 'contraseñaIncorrecta' });
        }
        //necesito que devuelva los datos del cliente en el response incluyendo el DNI
        res.status(200).json({ 
            success: true, 
            type: "cliente", 
            name: customer.nombre, 
            lastname: customer.apellido,
            dni: customer.dni 
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Helper: recalcula totales del carrito a partir de los items
function recalculateCart(cart) {
    if (!cart || !Array.isArray(cart.items)) return { items: [], total: 0 };
    let total = 0;
    cart.items.forEach(item => {
        // asegurarse de que subtotal esté consistente
        item.subtotal = Number((item.precioUnitario * item.cantidad).toFixed(2));
        total += item.subtotal;
    });
    cart.total = Number(total.toFixed(2));
    return cart;
}

// Obtener carrito completo por DNI
app.get('/api/customers/:dni/cart', async (req, res) => {
    const { dni } = req.params;
    if (!dni || dni.trim() === '') {
        return res.status(400).json({ success: false, error: 'dniRequerido' });
    }
    try {
        const customer = await Customer.findOne({ dni: dni.trim() });
        if (!customer) return res.status(404).json({ success: false, error: 'clienteNoEncontrado' });

        // Garantizar estructura y totales actualizados (inicializar si no existe)
        if (!customer.carrito || !customer.carrito.items) {
            customer.carrito = { items: [], total: 0 };
        }
        customer.carrito = recalculateCart(customer.carrito);
        await customer.save();

        res.status(200).json({ success: true, carrito: customer.carrito });
    } catch (error) {
        console.error('Error al obtener carrito:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Añadir un producto al carrito (o aumentar cantidad si ya existe)
// Body: { productId?, nombre, precioUnitario, cantidad }
app.post('/api/customers/:dni/cart/add', async (req, res) => {
    const { dni } = req.params;
    let { productId, nombre, precioUnitario, cantidad } = req.body;

    cantidad = Number(cantidad) || 1;
    precioUnitario = Number(precioUnitario);

    if (!dni || dni.trim() === '') return res.status(400).json({ success: false, error: 'dniRequerido' });
    if (!nombre && !productId) return res.status(400).json({ success: false, error: 'productoInvalido' });
    if (isNaN(precioUnitario) || precioUnitario < 0) return res.status(400).json({ success: false, error: 'precioInvalido' });
    if (cantidad <= 0) return res.status(400).json({ success: false, error: 'cantidadInvalida' });

    try {
        const customer = await Customer.findOne({ dni: dni.trim() });
        if (!customer) return res.status(404).json({ success: false, error: 'clienteNoEncontrado' });

        // Garantizar que el carrito existe
        if (!customer.carrito || !customer.carrito.items) {
            customer.carrito = { items: [], total: 0 };
        }

        // Buscar si ya existe el item (por productId si viene, si no por nombre)
        let existingIndex = -1;
        if (productId) {
            existingIndex = customer.carrito.items.findIndex(i => i.productId && i.productId.toString() === productId.toString());
        }
        if (existingIndex === -1 && nombre) {
            existingIndex = customer.carrito.items.findIndex(i => i.nombre === nombre);
        }

        if (existingIndex > -1) {
            // aumentar cantidad
            customer.carrito.items[existingIndex].cantidad += cantidad;
            customer.carrito.items[existingIndex].precioUnitario = precioUnitario; // actualizar precio por si cambió
            customer.carrito = recalculateCart(customer.carrito);
        } else {
            const newItem = {
                productId: productId || null,
                nombre: nombre,
                precioUnitario: precioUnitario,
                cantidad: cantidad,
                subtotal: Number((precioUnitario * cantidad).toFixed(2))
            };
            customer.carrito.items.push(newItem);
            customer.carrito = recalculateCart(customer.carrito);
        }

        await customer.save();
        res.status(200).json({ success: true, carrito: customer.carrito });
    } catch (error) {
        console.error('Error añadiendo al carrito:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Actualizar cantidad de un item en el carrito
// Body: { productId? , nombre?, cantidad }
app.put('/api/customers/:dni/cart/update', async (req, res) => {
    const { dni } = req.params;
    let { productId, nombre, cantidad } = req.body;
    cantidad = Number(cantidad);
    if (!dni || dni.trim() === '') return res.status(400).json({ success: false, error: 'dniRequerido' });
    if (!productId && !nombre) return res.status(400).json({ success: false, error: 'productoInvalido' });
    if (!Number.isFinite(cantidad) || cantidad < 0) return res.status(400).json({ success: false, error: 'cantidadInvalida' });

    try {
        const customer = await Customer.findOne({ dni: dni.trim() });
        if (!customer) return res.status(404).json({ success: false, error: 'clienteNoEncontrado' });

        // Garantizar que el carrito existe
        if (!customer.carrito || !customer.carrito.items) {
            customer.carrito = { items: [], total: 0 };
        }

        let idx = -1;
        if (productId) idx = customer.carrito.items.findIndex(i => i.productId && i.productId.toString() === productId.toString());
        if (idx === -1 && nombre) idx = customer.carrito.items.findIndex(i => i.nombre === nombre);

        if (idx === -1) return res.status(404).json({ success: false, error: 'itemNoEncontrado' });

        if (cantidad === 0) {
            // remover item
            customer.carrito.items.splice(idx, 1);
        } else {
            customer.carrito.items[idx].cantidad = cantidad;
        }

        customer.carrito = recalculateCart(customer.carrito);
        await customer.save();
        res.status(200).json({ success: true, carrito: customer.carrito });
    } catch (error) {
        console.error('Error actualizando carrito:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Eliminar un item del carrito por productId o nombre
app.delete('/api/customers/:dni/cart/remove', async (req, res) => {
    const { dni } = req.params;
    const { productId, nombre } = req.body || {};
    if (!dni || dni.trim() === '') return res.status(400).json({ success: false, error: 'dniRequerido' });
    if (!productId && !nombre) return res.status(400).json({ success: false, error: 'productoInvalido' });

    try {
        const customer = await Customer.findOne({ dni: dni.trim() });
        if (!customer) return res.status(404).json({ success: false, error: 'clienteNoEncontrado' });

        // Garantizar que el carrito existe
        if (!customer.carrito || !customer.carrito.items) {
            customer.carrito = { items: [], total: 0 };
        }

        let idx = -1;
        if (productId) idx = customer.carrito.items.findIndex(i => i.productId && i.productId.toString() === productId.toString());
        if (idx === -1 && nombre) idx = customer.carrito.items.findIndex(i => i.nombre === nombre);

        if (idx === -1) return res.status(404).json({ success: false, error: 'itemNoEncontrado' });

        customer.carrito.items.splice(idx, 1);
        customer.carrito = recalculateCart(customer.carrito);
        await customer.save();

        res.status(200).json({ success: true, carrito: customer.carrito });
    } catch (error) {
        console.error('Error eliminando item carrito:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Crear pedido a partir del carrito
app.post('/api/customers/:dni/orders', async (req, res) => {
    const { dni } = req.params;
    const { metodoPago, direccionEntrega } = req.body || {};
    const direccionPayload = Object.prototype.hasOwnProperty.call(req.body || {}, 'direccion')
        ? sanitizeDireccion(req.body.direccion)
        : sanitizeDireccion({});

    if (!dni || dni.trim() === '') {
        return res.status(400).json({ success: false, error: 'dniRequerido' });
    }

    const direccionTexto = normalizeString(direccionEntrega);
    const direccionNormalizada = buildDireccionCompleta(direccionPayload) || direccionTexto;

    if (!direccionNormalizada) {
        return res.status(400).json({ success: false, error: 'direccionRequerida' });
    }

    try {
        const customer = await Customer.findOne({ dni: dni.trim() });
        if (!customer) {
            return res.status(404).json({ success: false, error: 'clienteNoEncontrado' });
        }

        if (!customer.carrito || !Array.isArray(customer.carrito.items) || customer.carrito.items.length === 0) {
            return res.status(400).json({ success: false, error: 'carritoVacio' });
        }

        customer.carrito = recalculateCart(customer.carrito);

        const totalPedido = customer.carrito.total;
        const metodoSeleccionado = (metodoPago || '').trim().toLowerCase() || 'carrito';

        if (metodoSeleccionado === 'saldo') {
            const saldoDisponible = Number(customer.saldoAFavor || 0);
            if (saldoDisponible < totalPedido) {
                return res.status(400).json({
                    success: false,
                    error: 'saldoInsuficiente',
                    saldoAFavor: saldoDisponible
                });
            }

            // Descontar el saldo disponible con precisión de dos decimales
            const nuevoSaldo = Number((saldoDisponible - totalPedido).toFixed(2));
            customer.saldoAFavor = nuevoSaldo >= 0 ? nuevoSaldo : 0;
        }

        const orderPayload = {
            customer: customer._id,
            dni: customer.dni,
            nombre: `${customer.nombre || ''} ${customer.apellido || ''}`.trim(),
            direccionEntrega: direccionNormalizada,
            items: customer.carrito.items.map(item => ({
                productId: item.productId || null,
                nombre: item.nombre,
                precioUnitario: item.precioUnitario,
                cantidad: item.cantidad,
                subtotal: item.subtotal
            })),
            total: totalPedido,
            estado: 'pendiente',
            metodoPago: metodoSeleccionado
        };

        const resultadoStock = await verificarYDescontarStock(orderPayload.items);
        if (resultadoStock.faltantes.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'stockInsuficiente',
                faltantes: resultadoStock.faltantes
            });
        }

        orderPayload.stockAjustado = resultadoStock.descontado;

        let nuevaOrden = null;
        try {
            nuevaOrden = await Order.create(orderPayload);

            customer.carrito = { items: [], total: 0 };
            const guardoDireccion = maybePersistDireccion(customer, direccionPayload, direccionNormalizada);
            // El saldo ya fue actualizado si correspondía al método "saldo"
            await customer.save();

            res.status(201).json({
                success: true,
                pedido: nuevaOrden,
                carrito: customer.carrito,
                saldoAFavor: customer.saldoAFavor,
                direccionActualizada: guardoDireccion
            });
        } catch (creationError) {
            if (orderPayload.stockAjustado) {
                try {
                    await restaurarStockDeItems(orderPayload.items);
                } catch (restoreError) {
                    console.error('Error al restaurar stock tras fallo al crear pedido:', restoreError);
                }
            }

            if (nuevaOrden && nuevaOrden._id) {
                try {
                    await Order.findByIdAndDelete(nuevaOrden._id);
                } catch (cleanupError) {
                    console.error('Error al eliminar pedido creado tras fallo posterior:', cleanupError);
                }
            }

            throw creationError;
        }
    } catch (error) {
        console.error('Error al crear pedido:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Listar pedidos de un cliente
app.get('/api/customers/:dni/orders', async (req, res) => {
    const { dni } = req.params;

    if (!dni || dni.trim() === '') {
        return res.status(400).json({ success: false, error: 'dniRequerido' });
    }

    try {
        const orders = await Order.find({ dni: dni.trim() }).sort({ creadoEl: -1 });
        res.status(200).json({ success: true, pedidos: orders });
    } catch (error) {
        console.error('Error al obtener pedidos:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Cancelar pedido pendiente
app.put('/api/customers/:dni/orders/:orderId/cancel', async (req, res) => {
    const { dni, orderId } = req.params;

    if (!dni || dni.trim() === '') {
        return res.status(400).json({ success: false, error: 'dniRequerido' });
    }

    if (!orderId || orderId.trim() === '') {
        return res.status(400).json({ success: false, error: 'pedidoRequerido' });
    }

    try {
        const order = await Order.findOne({ _id: orderId, dni: dni.trim() });
        if (!order) {
            return res.status(404).json({ success: false, error: 'pedidoNoEncontrado' });
        }

        if (order.estado === 'entregado') {
            return res.status(400).json({ success: false, error: 'pedidoEntregado' });
        }

        if (order.estado === 'cancelado') {
            return res.status(400).json({ success: false, error: 'pedidoYaCancelado' });
        }

        const customer = await Customer.findOne({ dni: dni.trim() });
        if (!customer) {
            return res.status(404).json({ success: false, error: 'clienteNoEncontrado' });
        }

        if (order.stockAjustado) {
            await restaurarStockDeItems(order.items);
            order.stockAjustado = false;
        }

        order.estado = 'cancelado';
        await order.save();

        const saldoActual = customer.saldoAFavor || 0;
        customer.saldoAFavor = Number((saldoActual + order.total).toFixed(2));
        await customer.save();

        res.status(200).json({ success: true, pedido: order, saldoAFavor: customer.saldoAFavor });
    } catch (error) {
        console.error('Error al cancelar pedido:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// ============================================
// ADMIN - Gestión de pedidos (ventas)
// ============================================

// Listar todos los pedidos con filtros opcionales (estado, dni)
app.get('/api/orders', async (req, res) => {
    try {
        const { estado, dni, fechaDesde, fechaHasta } = req.query;
        const filtros = {};
        if (estado) filtros.estado = estado;
        if (dni) filtros.dni = dni;

        const fechaInicio = parseDateParam(fechaDesde, false);
        const fechaFin = parseDateParam(fechaHasta, true);
        if (fechaInicio || fechaFin) {
            filtros.creadoEl = {};
            if (fechaInicio) filtros.creadoEl.$gte = fechaInicio;
            if (fechaFin) filtros.creadoEl.$lte = fechaFin;
        }

        const pedidos = await Order.find(filtros)
            .sort({ creadoEl: -1 })
            .populate('customer', 'nombre apellido dni');
        res.json({ success: true, pedidos });
    } catch (error) {
        console.error('Error al listar pedidos (admin):', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Marcar pedido como despachado/entregado
app.put('/api/orders/:orderId/dispatch', async (req, res) => {
    const { orderId } = req.params;
    if (!orderId || orderId.trim() === '') {
        return res.status(400).json({ success: false, error: 'pedidoRequerido' });
    }
    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, error: 'pedidoNoEncontrado' });
        }

        if (order.estado === 'cancelado') {
            return res.status(400).json({ success: false, error: 'pedidoCancelado' });
        }

        if (order.estado === 'entregado') {
            return res.status(400).json({ success: false, error: 'pedidoYaEntregado' });
        }

        order.estado = 'entregado';
        order.fechaEntrega = new Date();
        await order.save();
    await registrarVentaProductos(order);
    res.json({ success: true, pedido: order });
    } catch (error) {
        console.error('Error al despachar pedido (admin):', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Cancelar pedido (admin) y devolver el total al saldo del cliente
app.put('/api/orders/:orderId/cancel', async (req, res) => {
    const { orderId } = req.params;
    if (!orderId || orderId.trim() === '') {
        return res.status(400).json({ success: false, error: 'pedidoRequerido' });
    }

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, error: 'pedidoNoEncontrado' });
        }

        if (order.estado === 'entregado') {
            return res.status(400).json({ success: false, error: 'pedidoEntregado' });
        }

        if (order.estado === 'cancelado') {
            return res.status(400).json({ success: false, error: 'pedidoYaCancelado' });
        }

        if (order.stockAjustado) {
            await restaurarStockDeItems(order.items);
            order.stockAjustado = false;
        }

        // Actualizar estado
        order.estado = 'cancelado';
        await order.save();

        // Devolver al saldo del cliente
        const customer = await Customer.findOne({ dni: order.dni });
        if (customer) {
            const saldoActual = customer.saldoAFavor || 0;
            customer.saldoAFavor = Number((saldoActual + order.total).toFixed(2));
            await customer.save();
        }

        res.json({ success: true, pedido: order, saldoAFavor: customer ? customer.saldoAFavor : undefined });
    } catch (error) {
        console.error('Error al cancelar pedido (admin):', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Repetir compra desde un pedido histórico (cancelado o entregado)
app.post('/api/customers/:dni/orders/:orderId/repeat', async (req, res) => {
    const { dni, orderId } = req.params;

    if (!dni || dni.trim() === '') {
        return res.status(400).json({ success: false, error: 'dniRequerido' });
    }

    if (!orderId || orderId.trim() === '') {
        return res.status(400).json({ success: false, error: 'pedidoRequerido' });
    }

    try {
        const order = await Order.findOne({ _id: orderId, dni: dni.trim() });
        if (!order) {
            return res.status(404).json({ success: false, error: 'pedidoNoEncontrado' });
        }

        if (order.estado === 'pendiente') {
            return res.status(400).json({ success: false, error: 'pedidoPendiente' });
        }

        if (!order.items || order.items.length === 0) {
            return res.status(400).json({ success: false, error: 'pedidoSinItems' });
        }

        const customer = await Customer.findOne({ dni: dni.trim() });
        if (!customer) {
            return res.status(404).json({ success: false, error: 'clienteNoEncontrado' });
        }

        if (!customer.carrito || !Array.isArray(customer.carrito.items)) {
            customer.carrito = { items: [], total: 0 };
        }

        const agregados = [];
        const omitidos = [];

        for (const orderItem of order.items) {
            const cantidadSolicitada = Number(orderItem.cantidad) || 0;
            if (cantidadSolicitada <= 0) {
                continue;
            }

            let producto = null;
            if (orderItem.productId) {
                producto = await Producto.findById(orderItem.productId);
            }

            if (!producto) {
                producto = await Producto.findOne({ nombre: orderItem.nombre });
            }

            if (!producto || producto.activo === false) {
                omitidos.push({
                    productId: orderItem.productId || null,
                    nombre: orderItem.nombre,
                    motivo: 'productoInexistente'
                });
                continue;
            }

            const stockDisponible = Number.isFinite(producto.stock) ? Number(producto.stock) : 0;
            if (stockDisponible <= 0) {
                omitidos.push({
                    productId: producto._id,
                    nombre: producto.nombre,
                    motivo: 'sinStock'
                });
                continue;
            }

            const existingIndex = customer.carrito.items.findIndex(item => {
                if (orderItem.productId && item.productId) {
                    return item.productId.toString() === orderItem.productId.toString();
                }
                return item.nombre === orderItem.nombre;
            });

            const cantidadActualEnCarrito = existingIndex > -1 ? Number(customer.carrito.items[existingIndex].cantidad) || 0 : 0;
            const maxAgregable = Math.max(stockDisponible - cantidadActualEnCarrito, 0);

            if (maxAgregable <= 0) {
                omitidos.push({
                    productId: producto._id,
                    nombre: producto.nombre,
                    motivo: 'carritoSinCapacidadPorStock'
                });
                continue;
            }

            const cantidadAAgregar = Math.min(cantidadSolicitada, maxAgregable);

            if (cantidadAAgregar <= 0) {
                omitidos.push({
                    productId: producto._id,
                    nombre: producto.nombre,
                    motivo: 'sinCantidadAgregada'
                });
                continue;
            }

            // Obtener precio actual considerando promociones activas
            const precioUnitario = await obtenerPrecioActualConPromocion(producto._id, producto.precio);

            if (existingIndex > -1) {
                customer.carrito.items[existingIndex].cantidad += cantidadAAgregar;
                customer.carrito.items[existingIndex].precioUnitario = precioUnitario;
                customer.carrito.items[existingIndex].subtotal = Number((customer.carrito.items[existingIndex].cantidad * precioUnitario).toFixed(2));
            } else {
                customer.carrito.items.push({
                    productId: producto._id,
                    nombre: producto.nombre,
                    precioUnitario,
                    cantidad: cantidadAAgregar,
                    subtotal: Number((precioUnitario * cantidadAAgregar).toFixed(2))
                });
            }

            agregados.push({
                productId: producto._id,
                nombre: producto.nombre,
                cantidadAgregada: cantidadAAgregar,
                cantidadSolicitada,
                stockDisponible,
                agregadoCompleto: cantidadAAgregar === cantidadSolicitada
            });

            if (cantidadAAgregar < cantidadSolicitada) {
                omitidos.push({
                    productId: producto._id,
                    nombre: producto.nombre,
                    motivo: 'stockParcial'
                });
            }
        }

        customer.carrito = recalculateCart(customer.carrito);
        await customer.save();

        const totalAgregado = agregados.reduce((acc, item) => acc + item.cantidadAgregada, 0);
        const resumen = {
            productosAgregados: agregados,
            productosOmitidos: omitidos,
            totalAgregado,
            sinCambios: agregados.length === 0
        };

        let mensaje = 'Productos agregados al carrito correctamente.';
        if (resumen.sinCambios || totalAgregado === 0) {
            mensaje = 'No se pudieron agregar productos al carrito. Verifica el stock disponible.';
        } else if (omitidos.length > 0) {
            mensaje = 'Se agregaron productos al carrito. Algunos artículos no pudieron agregarse por stock o disponibilidad.';
        }

        res.status(200).json({
            success: true,
            carrito: customer.carrito,
            resumen,
            mensaje
        });
    } catch (error) {
        console.error('Error al repetir pedido:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Obtener datos completos del cliente por DNI
app.get('/api/customers/:dni', async (req, res) => {
    const { dni } = req.params;
    
    // Validar que el DNI no esté vacío
    if (!dni || dni.trim() === '') {
        return res.status(400).json({ success: false, error: 'dniRequerido' });
    }
    
    try {
        const customer = await Customer.findOne({ dni: dni.trim() });
        
        if (!customer) {
            return res.status(404).json({ success: false, error: 'clienteNoEncontrado' });
        }
        
        // Devolver datos REALES del cliente sin la contraseña
        const customerData = {
            nombre: customer.nombre,
            apellido: customer.apellido,
            dni: customer.dni,
            mail: customer.mail,
            telefono: customer.telefono,
            domicilio: customer.domicilio,
            codigoPostal: customer.codigoPostal,
            direccion: sanitizeDireccion({
                ...(customer.direccion && typeof customer.direccion === 'object'
                    ? (typeof customer.direccion.toObject === 'function'
                        ? customer.direccion.toObject()
                        : customer.direccion)
                    : {}),
                codigoPostal: customer.direccion && customer.direccion.codigoPostal
                    ? customer.direccion.codigoPostal
                    : customer.codigoPostal
            }),
            saldoAFavor: customer.saldoAFavor || 0
        };
        
        res.status(200).json({ success: true, cliente: customerData });
    } catch (error) {
        console.error('Error al obtener cliente:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Actualizar datos del cliente
app.put('/api/customers/update', async (req, res) => {
    let { dni, nombre, apellido, telefono, mail, domicilio, codigoPostal, direccion } = req.body;

    nombre = normalizeString(nombre);
    apellido = normalizeString(apellido);
    telefono = normalizeString(telefono);
    mail = normalizeString(mail);
    domicilio = normalizeString(domicilio);
    codigoPostal = normalizeString(codigoPostal);

    const direccionEnviada = Object.prototype.hasOwnProperty.call(req.body, 'direccion');
    const direccionSanitizada = direccionEnviada ? sanitizeDireccion(direccion) : null;
    const direccionCompleta = direccionSanitizada ? buildDireccionCompleta(direccionSanitizada) : '';

    if (!nombre || !apellido || !dni) {
        return res.status(400).json({ success: false, reason: "missingFields" });
    }

    try {
        if (mail && !validateEmail(mail)) {
            return res.json({ success: false, reason: "badEmail" });
        }

        if (telefono && !validatePhone(telefono)) {
            return res.json({ success: false, reason: "badTelefono" });
        }

        const codigoPostalEvaluar = direccionSanitizada ? direccionSanitizada.codigoPostal : codigoPostal;
        if (codigoPostalEvaluar && !validatePostalCode(codigoPostalEvaluar)) {
            return res.json({ success: false, reason: "badCodigoPostal" });
        }

        if (mail) {
            const existingUser = await Customer.findOne({ mail: mail, dni: { $ne: dni } });
            if (existingUser) {
                return res.json({ success: false, reason: "mailExists" });
            }
        }

        const updateData = {
            nombre,
            apellido
        };

        if (telefono) updateData.telefono = telefono;
        if (mail) updateData.mail = mail;

        if (direccionEnviada) {
            updateData.direccion = direccionSanitizada;
            const domicilioFinal = direccionCompleta || domicilio;
            updateData.domicilio = domicilioFinal;
            const codigoPostalFinal = direccionSanitizada.codigoPostal || codigoPostal;
            updateData.codigoPostal = codigoPostalFinal || '';
        } else {
            if (Object.prototype.hasOwnProperty.call(req.body, 'domicilio')) {
                updateData.domicilio = domicilio;
            }
            if (Object.prototype.hasOwnProperty.call(req.body, 'codigoPostal')) {
                updateData.codigoPostal = codigoPostal;
            }
        }

        const updatedCustomer = await Customer.findOneAndUpdate(
            { dni: dni },
            updateData,
            { new: true }
        );

        if (!updatedCustomer) {
            return res.status(404).json({ success: false, reason: "clienteNoEncontrado" });
        }

        res.json({ success: true, message: "Cliente actualizado correctamente" });
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        res.status(500).json({ success: false, reason: "serverError" });
    }
});

// Eliminar cuenta del cliente
app.delete('/api/customers/:dni', async (req, res) => {
    const { dni } = req.params;
    
    try {
        const deletedCustomer = await Customer.findOneAndDelete({ dni: dni });
        
        if (!deletedCustomer) {
            return res.status(404).json({ success: false, error: 'clienteNoEncontrado' });
        }
        
        res.json({ success: true, message: "Cuenta eliminada correctamente" });
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// ============================================
// CATEGORÍAS
// ============================================

// Función auxiliar para generar slug
function generateSlug(nombre) {
    return nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
        .replace(/[^a-z0-9\s-]/g, '') // Eliminar caracteres especiales
        .replace(/\s+/g, '-') // Reemplazar espacios con guiones
        .replace(/-+/g, '-') // Reemplazar múltiples guiones con uno solo
        .trim();
}

// Definir esquema para categorías
const categoriaSchema = new mongoose.Schema({
    nombre: { 
        type: String, 
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    descripcion: { 
        type: String, 
        default: '' 
    },
    nivel: { 
        type: Number, 
        required: true,
        enum: [0, 1, 2],  // 0=Principal, 1=Subcategoría, 2=Sub-subcategoría
        default: 0
    },
    categoriaPadreId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'categorias',
        default: null
    },
    icono: {
        type: String,
        default: ''
    },
    imagen: { 
        type: String,
        default: '' 
    },
    activa: { 
        type: Boolean, 
        default: true 
    },
    orden: { 
        type: Number,
        default: 0 
    },
    mostrarEnNavbar: {
        type: Boolean,
        default: true
    },
    fechaCreacion: { 
        type: Date, 
        default: Date.now 
    }
});

categoriaSchema.index({ nombre: 1, categoriaPadreId: 1 }, { unique: true }); // Índice compuesto para evitar duplicados en el mismo nivel

const Categoria = mongoose.model('categorias', categoriaSchema);

// Subir imagen de categoría
app.post('/api/categorias/upload-imagen', upload.single('imagen'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, reason: 'noImagenProporcionada' });
        }
        
        // Leer el archivo y convertirlo a Base64
        const imageBuffer = fs.readFileSync(req.file.path);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = req.file.mimetype;
        
        // Crear la URL de datos (data URL) para Base64
        const imageUrl = `data:${mimeType};base64,${base64Image}`;

        // Eliminar archivo temporal
        fs.unlinkSync(req.file.path);
        
        res.json({ 
            success: true, 
            imageUrl: imageUrl
        });

    } catch (error) {
        console.error('Error al procesar imagen:', error);
        
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ success: false, reason: 'errorSubidaImagen', error: error.message });
    }
});

// Crear nueva categoría
app.post('/api/categorias', async (req, res) => {
    try {
        let { nombre, descripcion, nivel, categoriaPadreId, icono, imagen, orden } = req.body;
        
        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ success: false, reason: 'nombreRequerido' });
        }
        
        nombre = nombre.trim();

        if (nivel === undefined || nivel === null) {
            return res.status(400).json({ success: false, reason: 'nivelRequerido' });
        }
        
        if (![0, 1, 2].includes(nivel)) {
            return res.status(400).json({ success: false, reason: 'nivelInvalido' });
        }

        if (nivel > 0 && !categoriaPadreId) {
            return res.status(400).json({ success: false, reason: 'padreRequerido' });
        }
    
        if (categoriaPadreId) {
            const padre = await Categoria.findById(categoriaPadreId);
            if (!padre) {
                return res.status(404).json({ success: false, reason: 'padreNoEncontrado' });
            }

            if (padre.nivel !== nivel - 1) {
                return res.status(400).json({ success: false, reason: 'nivelPadreIncorrecto' });
            }
        }

        let slug = generateSlug(nombre);
        let slugFinal = slug;
        let contador = 1;
 
        while (await Categoria.findOne({ slug: slugFinal })) {
            slugFinal = `${slug}-${contador}`;
            contador++;
        }

        const existente = await Categoria.findOne({ 
            nombre: nombre, 
            categoriaPadreId: categoriaPadreId || null 
        });
        
        if (existente) {
            return res.status(400).json({ success: false, reason: 'categoriaExiste' });
        }
        
        const nuevaCategoria = await Categoria.create({
            nombre,
            slug: slugFinal,
            descripcion: descripcion || '',
            nivel,
            categoriaPadreId: categoriaPadreId || null,
            icono: icono || '',
            imagen: imagen || '',
            orden: orden || 0,
            activa: true,
            mostrarEnNavbar: nivel <= 1
        });
        
        console.log('✅ Categoría creada:', nuevaCategoria.nombre);
        res.status(201).json({ success: true, categoria: nuevaCategoria });
        
    } catch (error) {
        console.error('Error al crear categoría:', error);
        res.status(500).json({ success: false, reason: 'serverError', error: error.message });
    }
});

// Obtener todas las categorías
app.get('/api/categorias', async (req, res) => {
    try {
        const categorias = await Categoria.find()
            .sort({ nivel: 1, orden: 1, nombre: 1 });
        
        res.json({ success: true, categorias });
    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Obtener categorías principales (nivel 0) para navbar
app.get('/api/categorias/principales', async (req, res) => {
    try {
        const principales = await Categoria.find({ nivel: 0, activa: true })
            .sort({ orden: 1, nombre: 1 });
        
        res.json({ success: true, categorias: principales });
    } catch (error) {
        console.error('Error al obtener categorías principales:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Obtener estructura completa para navbar (con subcategorías anidadas)
app.get('/api/categorias/navbar', async (req, res) => {
    try {
        const principales = await Categoria.find({ nivel: 0, activa: true })
            .sort({ orden: 1, nombre: 1 })
            .lean();
        
        for (let principal of principales) {
            const subcategorias = await Categoria.find({ 
                categoriaPadreId: principal._id, 
                activa: true,
                nivel: 1
            })
            .sort({ orden: 1, nombre: 1 })
            .lean();
            
            for (let sub of subcategorias) {
                const subSubs = await Categoria.find({ 
                    categoriaPadreId: sub._id, 
                    activa: true,
                    nivel: 2
                })
                .sort({ orden: 1, nombre: 1 })
                .lean();
                
                sub.subcategorias = subSubs;
            }
            
            principal.subcategorias = subcategorias;
        }
        
        res.json({ success: true, categorias: principales });
    } catch (error) {
        console.error('Error al obtener navbar:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Obtener subcategorías de una categoría específica
app.get('/api/categorias/:id/subcategorias', async (req, res) => {
    try {
        const { id } = req.params;
        
        const subcategorias = await Categoria.find({ categoriaPadreId: id, activa: true })
            .sort({ orden: 1, nombre: 1 });
        
        res.json({ success: true, subcategorias });
    } catch (error) {
        console.error('Error al obtener subcategorías:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Obtener árbol completo desde una categoría
app.get('/api/categorias/:id/arbol', async (req, res) => {
    try {
        const { id } = req.params;
        
        const categoria = await Categoria.findById(id).lean();
        if (!categoria) {
            return res.status(404).json({ success: false, reason: 'categoriaNoEncontrada' });
        }
        
        async function obtenerSubcategorias(categoriaId) {
            const subs = await Categoria.find({ categoriaPadreId: categoriaId, activa: true })
                .sort({ orden: 1, nombre: 1 })
                .lean();
            
            for (let sub of subs) {
                sub.subcategorias = await obtenerSubcategorias(sub._id);
            }
            
            return subs;
        }
        
        categoria.subcategorias = await obtenerSubcategorias(categoria._id);
        
        res.json({ success: true, categoria });
    } catch (error) {
        console.error('Error al obtener árbol:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Obtener una categoría por ID
app.get('/api/categorias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const categoria = await Categoria.findById(id)
            .populate('categoriaPadreId', 'nombre nivel');
        
        if (!categoria) {
            return res.status(404).json({ success: false, reason: 'categoriaNoEncontrada' });
        }
        
        res.json({ success: true, categoria });
    } catch (error) {
        console.error('Error al obtener categoría:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Obtener categoría por slug
app.get('/api/categorias/slug/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        const categoria = await Categoria.findOne({ slug: slug })
            .populate('categoriaPadreId', 'nombre slug');
        
        if (!categoria) {
            return res.status(404).json({ success: false, reason: 'categoriaNoEncontrada' });
        }
        
        res.json({ success: true, categoria });
    } catch (error) {
        console.error('Error al obtener categoría por slug:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Actualizar categoría
app.put('/api/categorias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let { nombre, descripcion, icono, imagen, orden, activa } = req.body;
        
        const categoria = await Categoria.findById(id);
        if (!categoria) {
            return res.status(404).json({ success: false, reason: 'categoriaNoEncontrada' });
        }
        
        if (nombre !== undefined) {
            nombre = nombre.trim();
            if (nombre === '') {
                return res.status(400).json({ success: false, reason: 'nombreRequerido' });
            }
            
            const existente = await Categoria.findOne({ 
                nombre: nombre, 
                categoriaPadreId: categoria.categoriaPadreId,
                _id: { $ne: id }
            });
            
            if (existente) {
                return res.status(400).json({ success: false, reason: 'categoriaExiste' });
            }
            
            categoria.nombre = nombre;
            categoria.slug = generateSlug(nombre);
        }
        
        if (descripcion !== undefined) categoria.descripcion = descripcion;
        if (icono !== undefined) categoria.icono = icono;
        if (imagen !== undefined) categoria.imagen = imagen;
        if (orden !== undefined) categoria.orden = orden;
        if (activa !== undefined) categoria.activa = activa;
        
        await categoria.save();
        
        console.log('✅ Categoría actualizada:', categoria.nombre);
        res.json({ success: true, categoria });
        
    } catch (error) {
        console.error('Error al actualizar categoría:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Eliminar categoría
app.delete('/api/categorias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const categoria = await Categoria.findById(id);
        if (!categoria) {
            return res.status(404).json({ success: false, reason: 'categoriaNoEncontrada' });
        }
        
        const tieneSubcategorias = await Categoria.findOne({ categoriaPadreId: id });
        if (tieneSubcategorias) {
            return res.status(400).json({ 
                success: false, 
                reason: 'tieneSubcategorias',
                message: 'No se puede eliminar una categoría que tiene subcategorías' 
            });
        }
        
        // TODO: Verificar que no tenga productos asignados
        
        await Categoria.findByIdAndDelete(id);
        
        console.log('✅ Categoría eliminada:', categoria.nombre);
        res.json({ success: true, message: 'Categoría eliminada correctamente' });
        
    } catch (error) {
        console.error('Error al eliminar categoría:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// ============================================
// PRODUCTOS
// ============================================

// Definir esquema para productos
const productoSchema = new mongoose.Schema({
    nombre: { 
        type: String, 
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    descripcion: { 
        type: String, 
        default: '' 
    },
    precio: { 
        type: Number, 
        required: true,
        min: 0
    },
    precioAnterior: {
        type: Number,
        default: null
    },
    stock: { 
        type: Number, 
        default: 0,
        min: 0
    },
    vendidos: {
        type: Number,
        default: 0,
        min: 0
    },
    categoriaId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'categorias',
        required: true
    },
    imagen: { 
        type: String,
        default: '' 
    },
    imagenes: [{ 
        type: String 
    }],
    marca: {
        type: String,
        default: ''
    },
    codigo: {
        type: String,
        default: ''
    },
    unidadMedida: {
        type: String,
        default: 'unidad'
    },
    destacado: { 
        type: Boolean, 
        default: false 
    },
    enOferta: {
        type: Boolean,
        default: false
    },
    activo: { 
        type: Boolean, 
        default: true 
    },
    fechaCreacion: { 
        type: Date, 
        default: Date.now 
    }
});

productoSchema.index({ nombre: 1 });
productoSchema.index({ categoriaId: 1 });
productoSchema.index({ activo: 1 });

const Producto = mongoose.model('productos', productoSchema);

async function registrarVentaProductos(order) {
    if (!order || !Array.isArray(order.items) || order.items.length === 0) {
        return;
    }

    const bulkOps = [];

    for (const item of order.items) {
        const rawId = item.productId || null;
        const cantidad = Number(item.cantidad) || 0;
        if (!rawId || cantidad <= 0) {
            continue;
        }

        const idString = rawId.toString();
        if (!mongoose.Types.ObjectId.isValid(idString)) {
            continue;
        }

        const productId = new mongoose.Types.ObjectId(idString);

        bulkOps.push({
            updateOne: {
                filter: { _id: productId },
                update: { $inc: { vendidos: cantidad } }
            }
        });
    }

    if (bulkOps.length > 0) {
        try {
            await Producto.bulkWrite(bulkOps, { ordered: false });
        } catch (error) {
            console.error('Error incrementando vendidos de productos:', error);
        }
    }
}

async function verificarYDescontarStock(items) {
    const cantidadesPorProducto = new Map();

    if (Array.isArray(items)) {
        for (const rawItem of items) {
            if (!rawItem || !rawItem.productId) {
                continue;
            }

            const idString = rawItem.productId.toString();
            if (!mongoose.Types.ObjectId.isValid(idString)) {
                continue;
            }

            const cantidad = Number(rawItem.cantidad) || 0;
            if (cantidad <= 0) {
                continue;
            }

            const acumulado = cantidadesPorProducto.get(idString) || 0;
            cantidadesPorProducto.set(idString, acumulado + cantidad);
        }
    }

    if (cantidadesPorProducto.size === 0) {
        return { descontado: false, faltantes: [] };
    }

    const objectIds = Array.from(cantidadesPorProducto.keys()).map(id => new mongoose.Types.ObjectId(id));
    const productos = await Producto.find({ _id: { $in: objectIds } }).select('nombre stock');

    const encontrados = new Set(productos.map(prod => prod._id.toString()));
    const faltantes = [];

    for (const [productId, cantidadSolicitada] of cantidadesPorProducto.entries()) {
        if (!encontrados.has(productId)) {
            faltantes.push({
                productId,
                nombre: null,
                stockDisponible: 0,
                cantidadSolicitada,
                motivo: 'productoNoEncontrado'
            });
        }
    }

    for (const producto of productos) {
        const productId = producto._id.toString();
        const cantidadSolicitada = cantidadesPorProducto.get(productId) || 0;
        const stockDisponible = Number(producto.stock) || 0;

        if (stockDisponible < cantidadSolicitada) {
            faltantes.push({
                productId,
                nombre: producto.nombre,
                stockDisponible,
                cantidadSolicitada,
                motivo: 'stockInsuficiente'
            });
        }
    }

    if (faltantes.length > 0) {
        return { descontado: false, faltantes };
    }

    const bulkOps = [];
    for (const producto of productos) {
        const productId = producto._id.toString();
        const cantidad = cantidadesPorProducto.get(productId) || 0;
        if (cantidad <= 0) {
            continue;
        }

        bulkOps.push({
            updateOne: {
                filter: { _id: producto._id },
                update: { $inc: { stock: -cantidad } }
            }
        });
    }

    if (bulkOps.length > 0) {
        await Producto.bulkWrite(bulkOps, { ordered: false });
        return { descontado: true, faltantes: [] };
    }

    return { descontado: false, faltantes: [] };
}

async function restaurarStockDeItems(items) {
    const cantidadesPorProducto = new Map();

    if (Array.isArray(items)) {
        for (const rawItem of items) {
            if (!rawItem || !rawItem.productId) {
                continue;
            }

            const idString = rawItem.productId.toString();
            if (!mongoose.Types.ObjectId.isValid(idString)) {
                continue;
            }

            const cantidad = Number(rawItem.cantidad) || 0;
            if (cantidad <= 0) {
                continue;
            }

            const acumulado = cantidadesPorProducto.get(idString) || 0;
            cantidadesPorProducto.set(idString, acumulado + cantidad);
        }
    }

    if (cantidadesPorProducto.size === 0) {
        return;
    }

    const bulkOps = [];
    for (const [productId, cantidad] of cantidadesPorProducto.entries()) {
        if (cantidad <= 0) {
            continue;
        }

        const objectId = new mongoose.Types.ObjectId(productId);
        bulkOps.push({
            updateOne: {
                filter: { _id: objectId },
                update: { $inc: { stock: cantidad } }
            }
        });
    }

    if (bulkOps.length > 0) {
        await Producto.bulkWrite(bulkOps, { ordered: false });
    }
}

function parseDateParam(value, endOfDay = false) {
    if (!value) return null;
    const fecha = new Date(value);
    if (isNaN(fecha.getTime())) return null;
    if (endOfDay) {
        fecha.setHours(23, 59, 59, 999);
    } else {
        fecha.setHours(0, 0, 0, 0);
    }
    return fecha;
}

function buildFechaMatch(fechaInicio, fechaFin) {
    const rango = {};
    if (fechaInicio) rango.$gte = fechaInicio;
    if (fechaFin) rango.$lte = fechaFin;
    return Object.keys(rango).length ? rango : undefined;
}

// ============================================
// PROMOCIONES
// ============================================

const promocionSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'productos', required: true },
    tipo: { type: String, enum: ['porcentaje', 'monto'], required: true },
    valor: { type: Number, required: true, min: 0 },
    precioOriginal: { type: Number, required: true, min: 0 },
    precioPromocional: { type: Number, required: true, min: 0 },
    fechaInicio: { type: Date, required: true },
    fechaFin: { type: Date, required: true },
    activo: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'creadoEl', updatedAt: 'actualizadoEl' } });

promocionSchema.index({ productId: 1, fechaInicio: 1, fechaFin: 1 });

const Promocion = mongoose.model('promociones', promocionSchema);

function calcularPrecioPromocional(precioBase, tipo, valor) {
    let precio = Number(precioBase) || 0;
    let resultado = precio;
    if (tipo === 'porcentaje') {
        const pct = Math.min(Math.max(Number(valor) || 0, 0), 100);
        resultado = precio * (1 - pct / 100);
    } else if (tipo === 'monto') {
        resultado = precio - (Number(valor) || 0);
    }
    return Number(Math.max(0, resultado).toFixed(2));
}

async function actualizarPromocionesPorCambioDePrecio(productId, nuevoPrecio) {
    if (!productId || !mongoose.Types.ObjectId.isValid(productId.toString())) {
        return 0;
    }

    const precioNormalizado = Number(Number(nuevoPrecio).toFixed(2));
    if (!Number.isFinite(precioNormalizado) || precioNormalizado < 0) {
        return 0;
    }

    const promociones = await Promocion.find({ productId: productId });
    if (!promociones || promociones.length === 0) {
        return 0;
    }

    const bulkOps = promociones.map(promocion => {
        const precioPromocional = calcularPrecioPromocional(precioNormalizado, promocion.tipo, promocion.valor);
        return {
            updateOne: {
                filter: { _id: promocion._id },
                update: {
                    $set: {
                        precioOriginal: precioNormalizado,
                        precioPromocional
                    }
                }
            }
        };
    });

    if (bulkOps.length === 0) {
        return 0;
    }

    const resultado = await Promocion.bulkWrite(bulkOps, { ordered: false });
    return resultado.modifiedCount || 0;
}

// Obtener el precio actual de un producto considerando promociones activas
async function obtenerPrecioActualConPromocion(productId, precioBase) {
    try {
        const ahora = new Date();
        
        // Buscar promoción activa para este producto
        const promocionActiva = await Promocion.findOne({
            productId: productId,
            activo: true,
            fechaInicio: { $lte: ahora },
            fechaFin: { $gte: ahora }
        }).sort({ fechaInicio: -1 }); // La más reciente si hay varias
        
        if (promocionActiva) {
            // Si hay promoción activa, devolver el precio promocional
            return Number(promocionActiva.precioPromocional || precioBase);
        }
        
        // Si no hay promoción, devolver el precio base
        return Number(precioBase);
    } catch (error) {
        console.error('Error al obtener precio con promoción:', error);
        return Number(precioBase);
    }
}

// Crear promoción
app.post('/api/promociones', async (req, res) => {
    try {
        let { productId, tipo, valor, fechaInicio, fechaFin } = req.body;

        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, reason: 'productoInvalido' });
        }
        if (!tipo || !['porcentaje', 'monto'].includes(tipo)) {
            return res.status(400).json({ success: false, reason: 'tipoInvalido' });
        }
        valor = Number(valor);
        if (isNaN(valor) || valor < 0) {
            return res.status(400).json({ success: false, reason: 'valorInvalido' });
        }
        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({ success: false, reason: 'fechasRequeridas' });
        }
        const ini = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        if (isNaN(ini.getTime()) || isNaN(fin.getTime()) || fin < ini) {
            return res.status(400).json({ success: false, reason: 'rangoFechasInvalido' });
        }

        const producto = await Producto.findById(productId);
        if (!producto) {
            return res.status(404).json({ success: false, reason: 'productoNoEncontrado' });
        }

        const precioPromocional = calcularPrecioPromocional(producto.precio, tipo, valor);

        const promo = await Promocion.create({
            productId,
            tipo,
            valor,
            precioOriginal: producto.precio,
            precioPromocional,
            fechaInicio: ini,
            fechaFin: fin,
            activo: true
        });

        res.status(201).json({ success: true, promocion: promo });
    } catch (error) {
        console.error('Error al crear promoción:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Listar promociones
app.get('/api/promociones', async (req, res) => {
    try {
        const { activas } = req.query;
        const filtros = {};
        if (activas === 'true') {
            const ahora = new Date();
            filtros.$and = [
                { fechaInicio: { $lte: ahora } },
                { fechaFin: { $gte: ahora } },
                { activo: true }
            ];
        }
        const promociones = await Promocion.find(filtros)
            .sort({ creadoEl: -1 })
            .populate('productId', 'nombre precio imagen');
        res.json({ success: true, promociones });
    } catch (error) {
        console.error('Error al listar promociones:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Actualizar promoción
app.put('/api/promociones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let { tipo, valor, fechaInicio, fechaFin, activo } = req.body;

        const promo = await Promocion.findById(id);
        if (!promo) return res.status(404).json({ success: false, reason: 'promocionNoEncontrada' });

        if (tipo !== undefined) {
            if (!['porcentaje', 'monto'].includes(tipo)) {
                return res.status(400).json({ success: false, reason: 'tipoInvalido' });
            }
            promo.tipo = tipo;
        }
        if (valor !== undefined) {
            const v = Number(valor);
            if (isNaN(v) || v < 0) return res.status(400).json({ success: false, reason: 'valorInvalido' });
            promo.valor = v;
        }
        if (fechaInicio !== undefined) {
            const ini = new Date(fechaInicio);
            if (isNaN(ini.getTime())) return res.status(400).json({ success: false, reason: 'fechaInicioInvalida' });
            promo.fechaInicio = ini;
        }
        if (fechaFin !== undefined) {
            const fin = new Date(fechaFin);
            if (isNaN(fin.getTime())) return res.status(400).json({ success: false, reason: 'fechaFinInvalida' });
            promo.fechaFin = fin;
        }
        if (promo.fechaFin < promo.fechaInicio) {
            return res.status(400).json({ success: false, reason: 'rangoFechasInvalido' });
        }
        if (activo !== undefined) promo.activo = !!activo;

        // Recalcular en base al precio actual del producto
        const producto = await Producto.findById(promo.productId);
        if (!producto) return res.status(404).json({ success: false, reason: 'productoNoEncontrado' });
        promo.precioOriginal = producto.precio;
        promo.precioPromocional = calcularPrecioPromocional(producto.precio, promo.tipo, promo.valor);

        await promo.save();
        res.json({ success: true, promocion: promo });
    } catch (error) {
        console.error('Error al actualizar promoción:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Eliminar promoción
app.delete('/api/promociones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Promocion.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ success: false, reason: 'promocionNoEncontrada' });
        res.json({ success: true });
    } catch (error) {
        console.error('Error al eliminar promoción:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

async function buildFavoritosResponse(customer) {
    if (!customer) {
        return { favoritos: [], favoritosIds: [] };
    }

    const productoIds = Array.isArray(customer.favoritos)
        ? customer.favoritos.map(id => id.toString())
        : [];

    if (productoIds.length === 0) {
        return { favoritos: [], favoritosIds: [] };
    }

    const productos = await Producto.find({ _id: { $in: productoIds } }).lean();
    const productosMap = new Map(productos.map(prod => [prod._id.toString(), prod]));

    const favoritosOrdenados = [];
    const idsValidos = [];

    for (const id of productoIds) {
        const producto = productosMap.get(id);
        if (producto && producto.activo !== false) {
            favoritosOrdenados.push(producto);
            idsValidos.push(id);
        }
    }

    if (idsValidos.length !== productoIds.length) {
        customer.favoritos = idsValidos;
        await customer.save();
    }

    return { favoritos: favoritosOrdenados, favoritosIds: idsValidos };
}

// ============================================
// FAVORITOS DE CLIENTES
// ============================================

app.get('/api/customers/:dni/favorites', async (req, res) => {
    const { dni } = req.params;

    if (!dni || dni.trim() === '') {
        return res.status(400).json({ success: false, reason: 'dniRequerido' });
    }

    try {
        const customer = await Customer.findOne({ dni: dni.trim() });
        if (!customer) {
            return res.status(404).json({ success: false, reason: 'clienteNoEncontrado' });
        }

        const data = await buildFavoritosResponse(customer);
        return res.json({ success: true, ...data });
    } catch (error) {
        console.error('Error al obtener favoritos:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

app.post('/api/customers/:dni/favorites', async (req, res) => {
    const { dni } = req.params;
    const { productId } = req.body;

    if (!dni || dni.trim() === '') {
        return res.status(400).json({ success: false, reason: 'dniRequerido' });
    }

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ success: false, reason: 'productoInvalido' });
    }

    try {
        const customer = await Customer.findOne({ dni: dni.trim() });
        if (!customer) {
            return res.status(404).json({ success: false, reason: 'clienteNoEncontrado' });
        }

        const producto = await Producto.findById(productId).lean();
        if (!producto) {
            return res.status(404).json({ success: false, reason: 'productoNoEncontrado' });
        }

        if (producto.activo === false) {
            return res.status(400).json({ success: false, reason: 'productoInactivo' });
        }

        if (!Array.isArray(customer.favoritos)) {
            customer.favoritos = [];
        }

        const yaFavorito = customer.favoritos.some(id => id.toString() === productId);
        if (!yaFavorito) {
            customer.favoritos.push(productId);
            await customer.save();
        }

        const data = await buildFavoritosResponse(customer);
        return res.json({
            success: true,
            message: 'Producto agregado a favoritos',
            ...data
        });
    } catch (error) {
        console.error('Error al agregar favorito:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

app.delete('/api/customers/:dni/favorites/:productId', async (req, res) => {
    const { dni, productId } = req.params;

    if (!dni || dni.trim() === '') {
        return res.status(400).json({ success: false, reason: 'dniRequerido' });
    }

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ success: false, reason: 'productoInvalido' });
    }

    try {
        const customer = await Customer.findOne({ dni: dni.trim() });
        if (!customer) {
            return res.status(404).json({ success: false, reason: 'clienteNoEncontrado' });
        }

        if (!Array.isArray(customer.favoritos) || customer.favoritos.length === 0) {
            return res.json({ success: true, favoritos: [], favoritosIds: [] });
        }

        const indice = customer.favoritos.findIndex(id => id.toString() === productId);
        if (indice > -1) {
            customer.favoritos.splice(indice, 1);
            await customer.save();
        }

        const data = await buildFavoritosResponse(customer);
        return res.json({
            success: true,
            message: 'Producto eliminado de favoritos',
            ...data
        });
    } catch (error) {
        console.error('Error al eliminar favorito:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Subir imagen de producto
app.post('/api/productos/upload-imagen', upload.single('imagen'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, reason: 'noImagenProporcionada' });
        }
        
        const imageBuffer = fs.readFileSync(req.file.path);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = req.file.mimetype;
        const imageUrl = `data:${mimeType};base64,${base64Image}`;

        fs.unlinkSync(req.file.path);
        
        res.json({ 
            success: true, 
            imageUrl: imageUrl
        });

    } catch (error) {
        console.error('Error al procesar imagen:', error);
        
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ success: false, reason: 'errorSubidaImagen', error: error.message });
    }
});

// Crear nuevo producto
app.post('/api/productos', async (req, res) => {
    try {
        let { nombre, descripcion, precio, precioAnterior, stock, categoriaId, imagen, imagenes, 
              marca, codigo, unidadMedida, destacado, enOferta } = req.body;
        
        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ success: false, reason: 'nombreRequerido' });
        }
        
        nombre = nombre.trim();

        if (precio === undefined || precio === null || precio < 0) {
            return res.status(400).json({ success: false, reason: 'precioInvalido' });
        }

        // Verificar que la categoría fue proporcionada y existe
        if (!categoriaId) {
            return res.status(400).json({ success: false, reason: 'categoriaRequerida' });
        }
        const categoria = await Categoria.findById(categoriaId);
        if (!categoria) {
            return res.status(404).json({ success: false, reason: 'categoriaNoEncontrada' });
        }
        // Solo permitir nivel 1 o 2 (subcategorías)
        if (categoria.nivel === 0) {
            return res.status(400).json({ success: false, reason: 'categoriaNivelInvalido' });
        }

        // Generar slug único
        let slug = generateSlug(nombre);
        let slugFinal = slug;
        let contador = 1;
 
        while (await Producto.findOne({ slug: slugFinal })) {
            slugFinal = `${slug}-${contador}`;
            contador++;
        }

        // Verificar si ya existe un producto con el mismo nombre
        const existente = await Producto.findOne({ nombre: nombre });
        if (existente) {
            return res.status(400).json({ success: false, reason: 'productoExiste' });
        }
        
        const nuevoProducto = await Producto.create({
            nombre,
            slug: slugFinal,
            descripcion: descripcion || '',
            precio: parseFloat(precio),
            precioAnterior: precioAnterior ? parseFloat(precioAnterior) : null,
            stock: stock !== undefined ? parseInt(stock) : 0,
            categoriaId: categoriaId,
            imagen: imagen || '',
            imagenes: imagenes || [],
            marca: marca || '',
            codigo: codigo || '',
            unidadMedida: unidadMedida || 'unidad',
            destacado: destacado || false,
            enOferta: enOferta || false,
            activo: true
        });
        
        console.log('✅ Producto creado:', nuevoProducto.nombre);
        res.status(201).json({ success: true, producto: nuevoProducto });
        
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ success: false, reason: 'serverError', error: error.message });
    }
});

// Obtener todos los productos (con filtros opcionales)
app.get('/api/productos', async (req, res) => {
    try {
        const { categoriaId, destacado, enOferta, activo, buscar } = req.query;
        
        let filtros = {};
        
        if (categoriaId) filtros.categoriaId = categoriaId;
        if (destacado !== undefined) filtros.destacado = destacado === 'true';
        if (enOferta !== undefined) filtros.enOferta = enOferta === 'true';
        if (activo !== undefined) filtros.activo = activo === 'true';
        
        if (buscar) {
            filtros.$or = [
                { nombre: { $regex: buscar, $options: 'i' } },
                { descripcion: { $regex: buscar, $options: 'i' } },
                { marca: { $regex: buscar, $options: 'i' } }
            ];
        }
        
        const productos = await Producto.find(filtros)
            .populate('categoriaId', 'nombre slug')
            .sort({ fechaCreacion: -1 });
        
        res.json({ success: true, productos });
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Obtener productos destacados
app.get('/api/productos/destacados', async (req, res) => {
    try {
        const productos = await Producto.find({ destacado: true, activo: true })
            .populate('categoriaId', 'nombre slug')
            .limit(10)
            .sort({ fechaCreacion: -1 });
        
        res.json({ success: true, productos });
    } catch (error) {
        console.error('Error al obtener productos destacados:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Obtener productos en oferta
app.get('/api/productos/ofertas', async (req, res) => {
    try {
        const productos = await Producto.find({ enOferta: true, activo: true })
            .populate('categoriaId', 'nombre slug')
            .sort({ fechaCreacion: -1 });
        
        res.json({ success: true, productos });
    } catch (error) {
        console.error('Error al obtener productos en oferta:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Obtener un producto por ID
app.get('/api/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const producto = await Producto.findById(id)
            .populate('categoriaId', 'nombre slug nivel');
        
        if (!producto) {
            return res.status(404).json({ success: false, reason: 'productoNoEncontrado' });
        }
        
        res.json({ success: true, producto });
    } catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Obtener producto por slug
app.get('/api/productos/slug/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        const producto = await Producto.findOne({ slug: slug })
            .populate('categoriaId', 'nombre slug');
        
        if (!producto) {
            return res.status(404).json({ success: false, reason: 'productoNoEncontrado' });
        }
        
        res.json({ success: true, producto });
    } catch (error) {
        console.error('Error al obtener producto por slug:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Actualizar producto
app.put('/api/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let { nombre, descripcion, precio, precioAnterior, stock, categoriaId, imagen, imagenes,
              marca, codigo, unidadMedida, destacado, enOferta, activo } = req.body;
        
        const producto = await Producto.findById(id);
        if (!producto) {
            return res.status(404).json({ success: false, reason: 'productoNoEncontrado' });
        }

        const precioAnteriorProducto = Number(producto.precio);
        let nuevoPrecioAsignado = null;
        
        if (nombre !== undefined) {
            nombre = nombre.trim();
            if (nombre === '') {
                return res.status(400).json({ success: false, reason: 'nombreRequerido' });
            }
            
            const existente = await Producto.findOne({ 
                nombre: nombre, 
                _id: { $ne: id }
            });
            
            if (existente) {
                return res.status(400).json({ success: false, reason: 'productoExiste' });
            }
            
            producto.nombre = nombre;
            producto.slug = generateSlug(nombre);
        }
        
        if (descripcion !== undefined) producto.descripcion = descripcion;
        if (precio !== undefined) {
            const precioNumerico = Number(parseFloat(precio).toFixed(2));
            if (!Number.isFinite(precioNumerico) || precioNumerico < 0) {
                return res.status(400).json({ success: false, reason: 'precioInvalido' });
            }
            producto.precio = precioNumerico;
            nuevoPrecioAsignado = precioNumerico;
        }
        if (precioAnterior !== undefined) {
            const precioAnteriorNormalizado = precioAnterior ? Number(parseFloat(precioAnterior).toFixed(2)) : null;
            if (precioAnteriorNormalizado !== null && (!Number.isFinite(precioAnteriorNormalizado) || precioAnteriorNormalizado < 0)) {
                return res.status(400).json({ success: false, reason: 'precioAnteriorInvalido' });
            }
            producto.precioAnterior = precioAnteriorNormalizado;
        }
        if (stock !== undefined) producto.stock = parseInt(stock);
        if (categoriaId !== undefined) {
            // No permitir dejar la categoría en null
            if (!categoriaId) {
                return res.status(400).json({ success: false, reason: 'categoriaRequerida' });
            }
            const categoria = await Categoria.findById(categoriaId);
            if (!categoria) {
                return res.status(404).json({ success: false, reason: 'categoriaNoEncontrada' });
            }
            if (categoria.nivel === 0) {
                return res.status(400).json({ success: false, reason: 'categoriaNivelInvalido' });
            }
            producto.categoriaId = categoriaId;
        }
        if (imagen !== undefined) producto.imagen = imagen;
        if (imagenes !== undefined) producto.imagenes = imagenes;
        if (marca !== undefined) producto.marca = marca;
        if (codigo !== undefined) producto.codigo = codigo;
        if (unidadMedida !== undefined) producto.unidadMedida = unidadMedida;
        if (destacado !== undefined) producto.destacado = destacado;
        if (enOferta !== undefined) producto.enOferta = enOferta;
        if (activo !== undefined) producto.activo = activo;
        
        await producto.save();

        if (nuevoPrecioAsignado !== null) {
            const cambioPrecio = Math.abs((precioAnteriorProducto ?? 0) - nuevoPrecioAsignado);
            if (cambioPrecio > 0.009) {
                try {
                    const promocionesActualizadas = await actualizarPromocionesPorCambioDePrecio(producto._id, nuevoPrecioAsignado);
                    if (promocionesActualizadas > 0) {
                        console.log(`🔄 Promociones actualizadas (${promocionesActualizadas}) para producto ${producto.nombre}`);
                    }
                } catch (promoError) {
                    console.error('Error al actualizar promociones tras cambio de precio:', promoError);
                }
            }
        }

        console.log('✅ Producto actualizado:', producto.nombre);
        res.json({ success: true, producto });
        
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Eliminar producto
app.delete('/api/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const producto = await Producto.findById(id);
        if (!producto) {
            return res.status(404).json({ success: false, reason: 'productoNoEncontrado' });
        }
        
        // TODO: Verificar que no esté en pedidos activos o carritos
        
        await Producto.findByIdAndDelete(id);
        
        console.log('✅ Producto eliminado:', producto.nombre);
        res.json({ success: true, message: 'Producto eliminado correctamente' });
        
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// Actualizar stock de producto
app.patch('/api/productos/:id/stock', async (req, res) => {
    try {
        const { id } = req.params;
        const { stock } = req.body;
        
        if (stock === undefined || stock < 0) {
            return res.status(400).json({ success: false, reason: 'stockInvalido' });
        }
        
        const producto = await Producto.findByIdAndUpdate(
            id,
            { stock: parseInt(stock) },
            { new: true }
        );
        
        if (!producto) {
            return res.status(404).json({ success: false, reason: 'productoNoEncontrado' });
        }
        
        console.log('✅ Stock actualizado:', producto.nombre, '- Stock:', producto.stock);
        res.json({ success: true, producto });
        
    } catch (error) {
        console.error('Error al actualizar stock:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// ============================================
// REPORTES DE VENTAS
// ============================================

app.get('/api/reports/top-products', async (req, res) => {
    try {
        const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
        const fechaInicio = parseDateParam(req.query.fechaInicio);
        const fechaFin = parseDateParam(req.query.fechaFin, true);

        const match = { estado: 'entregado' };
        const rango = buildFechaMatch(fechaInicio, fechaFin);
        if (rango) {
            match.creadoEl = rango;
        }

        const pipeline = [
            { $match: match },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.productId',
                    cantidadVendida: { $sum: '$items.cantidad' },
                    totalRecaudado: { $sum: '$items.subtotal' },
                    nombreFallback: { $first: '$items.nombre' }
                }
            },
            { $sort: { cantidadVendida: -1, totalRecaudado: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'productos',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'producto'
                }
            },
            { $unwind: { path: '$producto', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'categorias',
                    localField: 'producto.categoriaId',
                    foreignField: '_id',
                    as: 'categoria'
                }
            },
            { $unwind: { path: '$categoria', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    productId: '$_id',
                    nombre: { $ifNull: ['$producto.nombre', '$nombreFallback'] },
                    cantidadVendida: 1,
                    totalRecaudado: 1,
                    categoria: { $ifNull: ['$categoria.nombre', 'Sin categoría'] },
                    vendidosHistorico: { $ifNull: ['$producto.vendidos', 0] },
                    stockActual: '$producto.stock'
                }
            }
        ];

        const resultados = await Order.aggregate(pipeline);
        res.json({ success: true, data: resultados });
    } catch (error) {
        console.error('Error generando reporte de top productos:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

app.get('/api/reports/products-by-category', async (req, res) => {
    try {
        const fechaInicio = parseDateParam(req.query.fechaInicio);
        const fechaFin = parseDateParam(req.query.fechaFin, true);

        const match = { estado: 'entregado' };
        const rango = buildFechaMatch(fechaInicio, fechaFin);
        if (rango) {
            match.creadoEl = rango;
        }

        const pipeline = [
            { $match: match },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'productos',
                    localField: 'items.productId',
                    foreignField: '_id',
                    as: 'producto'
                }
            },
            { $unwind: { path: '$producto', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'categorias',
                    localField: 'producto.categoriaId',
                    foreignField: '_id',
                    as: 'categoria'
                }
            },
            { $unwind: { path: '$categoria', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: {
                        categoriaId: '$categoria._id',
                        nombre: { $ifNull: ['$categoria.nombre', 'Sin categoría'] }
                    },
                    cantidadVendida: { $sum: '$items.cantidad' },
                    totalRecaudado: { $sum: '$items.subtotal' }
                }
            },
            {
                $project: {
                    _id: 0,
                    categoriaId: '$_id.categoriaId',
                    categoria: '$_id.nombre',
                    cantidadVendida: 1,
                    totalRecaudado: 1
                }
            },
            { $sort: { cantidadVendida: -1, categoria: 1 } }
        ];

        const resultados = await Order.aggregate(pipeline);
        res.json({ success: true, data: resultados });
    } catch (error) {
        console.error('Error generando reporte por categoría:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

app.get('/api/reports/sales-by-period', async (req, res) => {
    try {
        const fechaInicio = parseDateParam(req.query.fechaInicio);
        const fechaFin = parseDateParam(req.query.fechaFin, true);

        if (!fechaInicio && !fechaFin) {
            return res.status(400).json({ success: false, reason: 'fechasRequeridas' });
        }

        const match = { estado: 'entregado' };
        const rango = buildFechaMatch(fechaInicio, fechaFin);
        if (rango) {
            match.creadoEl = rango;
        }

        const pipeline = [
            { $match: match },
            { $unwind: '$items' },
            {
                $addFields: {
                    fechaClave: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$creadoEl',
                            timezone: 'UTC'
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { fecha: '$fechaClave', pedido: '$_id' },
                    fecha: { $first: '$fechaClave' },
                    totalPedido: { $first: '$total' },
                    cantidadProductos: { $sum: '$items.cantidad' }
                }
            },
            {
                $group: {
                    _id: '$_id.fecha',
                    fecha: { $first: '$fecha' },
                    cantidadPedidos: { $sum: 1 },
                    cantidadProductos: { $sum: '$cantidadProductos' },
                    totalRecaudado: { $sum: '$totalPedido' }
                }
            },
            { $sort: { fecha: 1 } }
        ];

        const resultados = await Order.aggregate(pipeline);

        const resumen = resultados.reduce((acc, fila) => {
            acc.cantidadPedidos += fila.cantidadPedidos;
            acc.cantidadProductos += fila.cantidadProductos;
            acc.totalRecaudado += fila.totalRecaudado;
            return acc;
        }, { cantidadPedidos: 0, cantidadProductos: 0, totalRecaudado: 0 });

        res.json({ success: true, data: resultados, resumen });
    } catch (error) {
        console.error('Error generando reporte por periodo:', error);
        res.status(500).json({ success: false, reason: 'serverError' });
    }
});

// ============================================
// INTEGRACIÓN MERCADO PAGO - PAGOS CON QR
// ============================================

/**
 * Crear preferencia de pago para un pedido
 * POST /api/pagos/crear-preferencia
 * Body: { orderId, dni, items, ... }
 */
app.post('/api/pagos/crear-preferencia', async (req, res) => {
    try {
        const { orderId, dni, items, total, notificationUrl, backUrls } = req.body;

        if (!dni || dni.trim() === '') {
            return res.status(400).json({ success: false, error: 'dniRequerido' });
        }

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, error: 'itemsRequeridos' });
        }

        if (total === undefined || total <= 0) {
            return res.status(400).json({ success: false, error: 'totalInvalido' });
        }

        // Obtener datos del cliente
        const customer = await Customer.findOne({ dni: dni.trim() });
        if (!customer) {
            return res.status(404).json({ success: false, error: 'clienteNoEncontrado' });
        }

        // Preparar datos para Mercado Pago
        const paymentData = {
            items: items.map(item => ({
                productId: item.productId,
                nombre: item.nombre,
                descripcion: item.nombre,
                precioUnitario: item.precioUnitario,
                cantidad: item.cantidad,
                image: item.image || ''
            })),
            payer: {
                nombre: customer.nombre,
                apellido: customer.apellido,
                dni: customer.dni,
                mail: customer.mail,
                telefono: customer.telefono,
                domicilio: customer.domicilio,
                codigoPostal: customer.codigoPostal
            },
            notificationUrl: notificationUrl,
            backUrls: backUrls || {
                success: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/pago-exitoso`,
                failure: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/pago-fallido`,
                pending: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/pago-pendiente`
            },
            externalReference: orderId || `ORDER-${Date.now()}`
        };

        const preference = await mercadopagoService.createPaymentPreference(paymentData);

        return res.status(201).json({
            success: true,
            preferenceId: preference.preferenceId,
            checkoutUrl: preference.checkoutUrl,
            sandboxUrl: preference.sandboxUrl,
            qrCode: preference.qrCode,
            total: total
        });

    } catch (error) {
        console.error('Error al crear preferencia de pago:', error);
        res.status(500).json({ success: false, error: error.error || error.message || 'serverError' });
    }
});

/**
 * Generar código QR para pago en punto de venta
 * POST /api/pagos/generar-qr
 * Body: { cantidad, descripcion, items, reference, ... }
 */
app.post('/api/pagos/generar-qr', async (req, res) => {
    try {
        const { cantidad, descripcion, items, reference, title } = req.body;

        if (!cantidad && (!items || items.length === 0)) {
            return res.status(400).json({ success: false, error: 'cantidadOItemsRequeridos' });
        }

        const qrData = {
            title: title || descripcion || 'Compra en tienda',
            description: descripcion || 'Pago en punto de venta',
            amount: cantidad,
            externalReference: reference || `QR-${Date.now()}`,
            items: items || []
        };

        const qrResult = await mercadopagoService.generateQRCode(qrData);

        // Si se proporcionó clienteDni, crear un pedido pendiente asociado a esta preference
        try {
            const clienteDni = req.body.clienteDni || req.body.dni || null;
            if (clienteDni) {
                const customer = await Customer.findOne({ dni: clienteDni.toString() });
                if (customer) {
                    // Mapear items para el pedido (si vienen desde el frontend)
                    const itemsForOrder = (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0)
                        ? req.body.items.map(it => ({
                            productId: it.productId || null,
                            nombre: it.nombre || it.title || 'Producto',
                            precioUnitario: Number(it.precioUnitario || it.unit_price || it.price || 0),
                            cantidad: Number(it.cantidad || it.quantity || 1),
                            subtotal: Number((Number(it.precioUnitario || it.unit_price || it.price || 0) * Number(it.cantidad || it.quantity || 1)).toFixed(2))
                        }))
                        : [];

                    const totalOrder = itemsForOrder.reduce((s, it) => s + (it.subtotal || 0), 0) || qrResult.totalAmount || Number(req.body.cantidad || 0);

                    const direccionQrPayload = Object.prototype.hasOwnProperty.call(req.body, 'direccion')
                        ? sanitizeDireccion(req.body.direccion)
                        : sanitizeDireccion({});
                    const direccionQrTexto = normalizeString(req.body.direccionEntrega);
                    const direccionQrCompleta = buildDireccionCompleta(direccionQrPayload)
                        || direccionQrTexto
                        || customer.domicilio
                        || '';

                    const newOrderPayload = {
                        customer: customer._id,
                        dni: customer.dni,
                        nombre: `${customer.nombre || ''} ${customer.apellido || ''}`.trim(),
                        direccionEntrega: direccionQrCompleta,
                        items: itemsForOrder,
                        total: Number(totalOrder),
                        estado: 'pendiente',
                        metodoPago: 'tarjeta',
                        preferenceId: qrResult.preferenceId || null,
                        externalReference: qrResult.preferenceId || qrData.externalReference || null
                    };

                    try {
                        const createdOrder = await Order.create(newOrderPayload);
                        const guardoDireccion = maybePersistDireccion(customer, direccionQrPayload, direccionQrCompleta);
                        if (guardoDireccion) {
                            await customer.save();
                        }
                        console.log('✅ Pedido creado para preferenceId:', qrResult.preferenceId, 'orderId:', createdOrder._id);
                    } catch (orderCreateErr) {
                        console.warn('No se pudo crear el pedido automáticamente:', orderCreateErr.message || orderCreateErr);
                    }
                }
            }
        } catch (orderLinkErr) {
            console.error('Error al intentar crear pedido asociado al QR:', orderLinkErr);
        }

        return res.status(201).json({
            success: true,
            preferenceId: qrResult.preferenceId,
            qrCode: qrResult.qrCode,
            checkoutUrl: qrResult.checkoutUrl,
            sandboxUrl: qrResult.sandboxUrl,
            totalAmount: qrResult.totalAmount
        });

    } catch (error) {
        console.error('Error al generar QR:', error);
        res.status(500).json({ success: false, error: error.error || error.message || 'serverError' });
    }
});

/**
 * Obtener información de una preferencia de pago
 * GET /api/pagos/preferencia/:preferenceId
 */
app.get('/api/pagos/preferencia/:preferenceId', async (req, res) => {
    try {
        const { preferenceId } = req.params;

        if (!preferenceId || preferenceId.trim() === '') {
            return res.status(400).json({ success: false, error: 'preferenceIdRequerido' });
        }

        const preferenceInfo = await mercadopagoService.getPreference(preferenceId);

        return res.json({
            success: true,
            preference: preferenceInfo.preference
        });

    } catch (error) {
        console.error('Error al obtener preferencia:', error);
        res.status(500).json({ success: false, error: error.error || error.message || 'serverError' });
    }
});

/**
 * Webhook para notificaciones de Mercado Pago
 * POST /api/pagos/webhook
 * Mercado Pago enviará notificaciones con { type, data: { id } } o { topic, resource }
 */
app.post('/api/pagos/webhook', async (req, res) => {
    try {
        const body = req.body || {};
        const query = req.query || {};

        console.log('📩 WEBHOOK RECIBIDO');

        // Extraer payment ID de cualquier formato
        let paymentId = body.data?.id || body.id || query.id || query['data.id'] || null;

        if (!paymentId) {
            console.log('⚠️ Webhook sin payment ID, ignorando');
            return res.status(200).json({ success: true });
        }

        console.log('💳 Payment ID:', paymentId);

        // Buscar el pedido más reciente (últimos 2 minutos) para evitar marcar pedidos viejos
        const hace2Minutos = new Date(Date.now() - 2 * 60 * 1000);
        
        const pedidosPendientes = await Order.find({ 
            estado: 'pendiente',
            metodoPago: 'tarjeta',
            $or: [
                { createdAt: { $gte: hace2Minutos } },
                { createdAt: { $exists: false } }  // Por si hay pedidos sin createdAt
            ]
        }).sort({ _id: -1 }).limit(1);  // Ordenar por _id (que incluye timestamp)

        if (pedidosPendientes.length === 0) {
            console.log('⚠️ No hay pedidos pendientes recientes');
            return res.status(200).json({ success: true });
        }

        const order = pedidosPendientes[0];
        
        console.log('📦 Marcando pedido - ID:', order._id, 'Preference:', order.preferenceId);
        
        order.paymentId = paymentId;
        order.paymentStatus = 'approved';
        order.paymentMethod = 'mercadopago';
        order.paymentDate = new Date();
        // NO cambiar el estado, sigue en "pendiente" hasta que el admin lo despache

        await order.save();

        console.log('✅ PEDIDO MARCADO COMO PAGADO');

        // Vaciar el carrito del cliente
        if (order.dni) {
            try {
                const customer = await Customer.findOne({ dni: order.dni.toString() });
                if (customer && customer.carrito) {
                    customer.carrito.items = [];
                    customer.carrito.total = 0;
                    await customer.save();
                    console.log('🛒 Carrito vaciado para DNI:', order.dni);
                }
            } catch (cartError) {
                console.error('Error vaciando carrito:', cartError.message);
            }
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('❌ Error webhook:', error.message);
        return res.status(200).json({ success: true });
    }
});

/**
 * Confirmar pago y actualizar estado del pedido
 * PUT /api/pagos/confirmar-pago
 * Body: { orderId, dni, paymentId, preferenceId, status }
 */
app.put('/api/pagos/confirmar-pago', async (req, res) => {
    try {
        const { orderId, dni, paymentId, preferenceId, status } = req.body;

        if (!orderId || !dni) {
            return res.status(400).json({ success: false, error: 'datosRequeridos' });
        }

        // Buscar la orden
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, error: 'pedidoNoEncontrado' });
        }

        // Actualizar información del pago
        order.metodoPago = 'mercadopago';
        order.paymentId = paymentId;
        order.preferenceId = preferenceId;
        order.paymentStatus = status || 'pending';

        // Si el pago fue aprobado
        if (status === 'approved') {
            order.estado = 'pendiente'; // Cambiar a pendiente de envío
        }

        await order.save();

        return res.json({
            success: true,
            message: 'Pago confirmado',
            pedido: order
        });

    } catch (error) {
        console.error('Error al confirmar pago:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// ⚠️ ENDPOINT DE MIGRACIÓN: Cambiar todos los pedidos "pagado" a "pendiente"
app.post('/api/admin/migrar-estados', async (req, res) => {
    try {
        const result = await Order.updateMany(
            { estado: 'pagado' },
            { $set: { estado: 'pendiente' } }
        );
        
        console.log('🔄 Estados migrados:', result.modifiedCount, 'pedidos actualizados');
        
        res.json({
            success: true,
            message: `Se actualizaron ${result.modifiedCount} pedidos de "pagado" a "pendiente"`
        });
    } catch (error) {
        console.error('Error en migración:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
