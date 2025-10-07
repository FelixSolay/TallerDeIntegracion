const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');
const crypto = require('crypto');
const { type } = require('os');


const app = express();
const port = 3000;


// Middleware
app.use(cors()); // Permite conexiones desde Angular
app.use(express.json()); // Para procesar JSON en las peticiones

// Conectar a MongoDB Atlas

mongoose.connect('mongodb+srv://pololo5007:Playa1820@cluster0.qlomp8b.mongodb.net/SupermercadoDB?retryWrites=true&w=majority&appName=Cluster0')
.then(() => console.log('Conectado a MongoDB Atlas'))
.catch(err => console.error('Error al conectar a MongoDB:', err));

// Validar email
function validateEmail(email) {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}

// Validar teléfono
function validateTelefono(telefono) {
  const regex = /^[\d\s\-\(\)\+]{8,15}$/;
  return regex.test(telefono);
}

// Validar código postal
function validateCodigoPostal(codigoPostal) {
  const regex = /^\d{4,8}$/;
  return regex.test(codigoPostal);
}

// Registrar cliente
// Definir un esquema y modelo para clientes
const clienteSchema = new mongoose.Schema({
  nombre: String,
  apellido: String,
  dni: String,
  mail: String,
  password: String,
  telefono: String,
  domicilio: { type: String, default: '' },
  codigoPostal: { type: String, default: '' }
});

const Cliente = mongoose.model('clientes', clienteSchema);

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
app.post('/api/clientes/register', async (req, res) => {
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

        if (!validateTelefono(telefono)) {
            return res.json({ success: false, reason: "badTelefono" });
        }

        // Verificar si ya existe el cliente por mail
        const user = await Cliente.findOne({ mail: mail });

        if (user) {
            return res.json({ success: false, reason: "alreadyExists" });
        }

        const hashedPassword = hashPassword(password1);

        await Cliente.create({
            nombre,
            apellido,
            dni,
            mail,
            telefono,
            password: hashedPassword,
            domicilio: '', // Campo vacío por defecto
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
        if (telefono && !validateTelefono(telefono)) {
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

app.post('/api/clientes/login', async (req, res) => {
    const { mail, password } = req.body;
    try {
        const cliente = await Cliente.findOne({ mail: mail});
        if (!cliente) {
            return res.status(401).json({ success: false, error: 'mailIncorrecto' });
        }
        const hashedPassword = hashPassword(password);
        if (cliente.password !== hashedPassword) {
            return res.status(401).json({ success: false, error: 'contraseñaIncorrecta' });
        }
        //necesito que devuelva los datos del cliente en el response incluyendo el DNI
        res.status(200).json({ 
            success: true, 
            type: "cliente", 
            name: cliente.nombre, 
            lastname: cliente.apellido,
            dni: cliente.dni 
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Obtener datos completos del cliente por DNI
app.get('/api/clientes/:dni', async (req, res) => {
    const { dni } = req.params;
    console.log('=== GET CLIENTE REQUEST ===');
    console.log('DNI recibido:', dni);
    
    // Validar que el DNI no esté vacío
    if (!dni || dni.trim() === '') {
        console.log('DNI vacío o inválido');
        return res.status(400).json({ success: false, error: 'dniRequerido' });
    }
    
    try {
        console.log('Buscando cliente con DNI:', dni.trim());
        const cliente = await Cliente.findOne({ dni: dni.trim() });
        
        if (!cliente) {
            console.log('Cliente no encontrado en la base de datos');
            return res.status(404).json({ success: false, error: 'clienteNoEncontrado' });
        }
        
        console.log('Cliente encontrado en DB:', cliente);
        
        // Devolver datos REALES del cliente sin la contraseña
        const clienteData = {
            nombre: cliente.nombre,
            apellido: cliente.apellido,
            dni: cliente.dni,
            mail: cliente.mail,
            telefono: cliente.telefono,
            domicilio: cliente.domicilio,
            codigoPostal: cliente.codigoPostal,
            saldo: 2000.00 // Valor por defecto, aquí puedes implementar lógica de saldo real
        };
        
        console.log('Datos a enviar al frontend:', clienteData);
        res.status(200).json({ success: true, cliente: clienteData });
    } catch (error) {
        console.error('Error al obtener cliente:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Actualizar datos del cliente
app.put('/api/clientes/update', async (req, res) => {
    console.log('Datos recibidos para actualizar:', req.body);
    
    let { dni, nombre, apellido, telefono, mail, domicilio, codigoPostal } = req.body;
    
    // Trim and basic validation - solo nombre, apellido y DNI son obligatorios
    nombre = nombre ? nombre.trim() : '';
    apellido = apellido ? apellido.trim() : '';
    telefono = telefono ? telefono.trim() : '';
    mail = mail ? mail.trim() : '';
    domicilio = domicilio ? domicilio.trim() : '';
    codigoPostal = codigoPostal ? codigoPostal.trim() : '';
    
    console.log('Datos después del trim:', { dni, nombre, apellido, telefono, mail, domicilio, codigoPostal });
    
    // Solo validar campos obligatorios
    if (!nombre || !apellido || !dni) {
        console.log('Campos obligatorios faltantes');
        return res.status(400).json({ success: false, reason: "missingFields" });
    }
    
    try {
        // Validar email solo si se proporciona
        if (mail && !validateEmail(mail)) {
            console.log('Email inválido:', mail);
            return res.json({ success: false, reason: "badEmail" });
        }
        
        // Validar teléfono solo si se proporciona
        if (telefono && !validateTelefono(telefono)) {
            console.log('Teléfono inválido:', telefono);
            return res.json({ success: false, reason: "badTelefono" });
        }
        
        // Validar código postal solo si se proporciona
        if (codigoPostal && !validateCodigoPostal(codigoPostal)) {
            console.log('Código postal inválido:', codigoPostal);
            return res.json({ success: false, reason: "badCodigoPostal" });
        }
        
        // Verificar si el email ya existe en otro usuario solo si se proporciona email
        if (mail) {
            const existingUser = await Cliente.findOne({ mail: mail, dni: { $ne: dni } });
            if (existingUser) {
                console.log('Email ya existe en otro usuario');
                return res.json({ success: false, reason: "mailExists" });
            }
        }
        
        // Crear objeto de actualización más simple
        const updateData = {
            nombre,
            apellido
        };
        
        if (telefono) updateData.telefono = telefono;
        if (mail) updateData.mail = mail;
        if (domicilio) updateData.domicilio = domicilio;
        if (codigoPostal) updateData.codigoPostal = codigoPostal;
        
        console.log('Datos a actualizar:', updateData);
        
        // Actualizar el cliente
        const updatedCliente = await Cliente.findOneAndUpdate(
            { dni: dni },
            updateData,
            { new: true }
        );
        
        if (!updatedCliente) {
            console.log('Cliente no encontrado para actualizar');
            return res.status(404).json({ success: false, reason: "clienteNoEncontrado" });
        }
        
        console.log('Cliente actualizado exitosamente');
        res.json({ success: true, message: "Cliente actualizado correctamente" });
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        res.status(500).json({ success: false, reason: "serverError" });
    }
});

// Eliminar cuenta del cliente
app.delete('/api/clientes/:dni', async (req, res) => {
    const { dni } = req.params;
    
    try {
        const deletedCliente = await Cliente.findOneAndDelete({ dni: dni });
        
        if (!deletedCliente) {
            return res.status(404).json({ success: false, error: 'clienteNoEncontrado' });
        }
        
        res.json({ success: true, message: "Cuenta eliminada correctamente" });
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
