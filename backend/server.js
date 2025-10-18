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

// Registrar cliente
// Definir un esquema y modelo para clientes
const customerSchema = new mongoose.Schema({
  nombre: String,
  apellido: String,
  dni: String,
  mail: String,
  password: String,
  telefono: String,
  domicilio: { type: String, default: '' },
  codigoPostal: { type: String, default: '' }
});

const Customer = mongoose.model('clientes', customerSchema);

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
            saldo: 2000.00 // Valor por defecto, aquí puedes implementar lógica de saldo real
        };
        
        res.status(200).json({ success: true, cliente: customerData });
    } catch (error) {
        console.error('Error al obtener cliente:', error);
        res.status(500).json({ success: false, error: 'serverError' });
    }
});

// Actualizar datos del cliente
app.put('/api/customers/update', async (req, res) => {
    let { dni, nombre, apellido, telefono, mail, domicilio, codigoPostal } = req.body;
    
    // Trim and basic validation - solo nombre, apellido y DNI son obligatorios
    nombre = nombre ? nombre.trim() : '';
    apellido = apellido ? apellido.trim() : '';
    telefono = telefono ? telefono.trim() : '';
    mail = mail ? mail.trim() : '';
    domicilio = domicilio ? domicilio.trim() : '';
    codigoPostal = codigoPostal ? codigoPostal.trim() : '';
    
    // Solo validar campos obligatorios
    if (!nombre || !apellido || !dni) {
        return res.status(400).json({ success: false, reason: "missingFields" });
    }
    
    try {
        // Validar email solo si se proporciona
        if (mail && !validateEmail(mail)) {
            return res.json({ success: false, reason: "badEmail" });
        }
        
        // Validar teléfono solo si se proporciona
        if (telefono && !validatePhone(telefono)) {
            return res.json({ success: false, reason: "badTelefono" });
        }
        
        // Validar código postal solo si se proporciona
        if (codigoPostal && !validatePostalCode(codigoPostal)) {
            return res.json({ success: false, reason: "badCodigoPostal" });
        }
        
        // Verificar si el email ya existe en otro usuario solo si se proporciona email
        if (mail) {
            const existingUser = await Customer.findOne({ mail: mail, dni: { $ne: dni } });
            if (existingUser) {
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
        
        // Actualizar el cliente
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

// Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
