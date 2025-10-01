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
const port = 5000;


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

const Cliente = mongoose.model('Cliente', clienteSchema);

// Ruta /register corregida
app.post('/api/clientes', async (req, res) => {
  const { nombre, apellido, dni, mail, password1, password2 } = req.body;

  try {
    const hashedPassword1 = hashPassword(password1);
    const hashedPassword2 = hashPassword(password2);

    // Verificar si ya existe el cliente
    const user = await Cliente.findOne({ dni: dni });

    if (!user) {
      if (hashedPassword1 === hashedPassword2) {
        if (validateEmail(mail)) {
          await Cliente.create({
            nombre,
            apellido,
            dni,
            mail,
            password: hashedPassword1
          });
          return res.json({ success: true, type: "cliente" });
        } else {
          return res.json({ success: false, reason: "badEmail" });
        }
      } else {
        return res.json({ success: false, reason: "wrongPassword" });
      }
    } else {
      return res.json({ success: false, reason: "alreadyExists" });
    }
  } catch (error) {
    console.error('Error al registrar el usuario:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});


function hashPassword(password) {
    const hash = crypto.createHash('sha256');
    hash.update(password);
    return hash.digest('hex');
}

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






// Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
