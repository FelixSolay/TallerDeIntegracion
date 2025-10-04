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

// Registrar cliente
// Definir un esquema y modelo para clientes
const clienteSchema = new mongoose.Schema({
  nombre: String,
  apellido: String,
  dni: String,
  mail: String,
  password: String
});

const Cliente = mongoose.model('clientes', clienteSchema);

// Definir esquema y modelo para admins (necesario antes de usar Admin)
const adminSchema = new mongoose.Schema({
  nombre: String,
  dni: String,
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
    let { nombre, apellido, dni, mail, password1, password2 } = req.body;

    // Trim and basic validation
    nombre = nombre ? nombre.trim() : '';
    apellido = apellido ? apellido.trim() : '';
    dni = dni ? dni.trim() : '';
    mail = mail ? mail.trim() : '';

    if (!nombre || !apellido || !dni || !mail || !password1 || !password2) {
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
            password: hashedPassword
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
        //necesito que devuelva los datos del cliente en el response
        res.status(200).json({ success: true, type: "cliente", name: cliente.nombre, lastname: cliente.apellido });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
