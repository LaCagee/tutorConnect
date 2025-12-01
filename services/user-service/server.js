// services/user-service/server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('./models/User');
const config = require('../../shared/config');
const rabbitmq = require('../../shared/rabbitmq');

const app = express();
const PORT = config.ports.userService;

// Middlewares
app.use(cors());
app.use(express.json());

// Conectar a RabbitMQ
rabbitmq.connect().then(async () => {
  // Escuchar evento de review creada para actualizar rating
  await rabbitmq.subscribe(config.events.REVIEW_CREATED, async (data) => {
    try {
      const { tutorId, rating } = data;
      
      // Buscar tutor
      const tutor = await User.findByPk(tutorId);
      if (tutor) {
        // Calcular nuevo rating promedio
        const totalReviews = tutor.totalReviews + 1;
        const newRating = ((tutor.rating * tutor.totalReviews) + rating) / totalReviews;
        
        // Actualizar tutor
        await tutor.update({
          rating: newRating.toFixed(2),
          totalReviews: totalReviews
        });
        
        console.log(`⭐ Rating actualizado para tutor ${tutorId}: ${newRating.toFixed(2)}`);
      }
    } catch (error) {
      console.error('Error actualizando rating:', error);
    }
  });
});

// ====== RUTAS ======

// POST /register - Registrar nuevo usuario
app.post('/register', async (req, res) => {
  try {
    const { nombre, email, password, rol, asignaturas, precioPorHora, bio } = req.body;

    // Validar campos requeridos
    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Verificar si el email ya existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const user = await User.create({
      nombre,
      email,
      password: hashedPassword,
      rol,
      asignaturas: asignaturas || [],
      precioPorHora: precioPorHora || 0,
      bio: bio || ''
    });

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol
      }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /login - Iniciar sesión
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token
    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /users/:id - Obtener perfil de usuario
app.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] } // No enviar contraseña
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /tutors - Listar todos los tutores
app.get('/tutors', async (req, res) => {
  try {
    const { asignatura } = req.query;

    let where = { rol: 'tutor' };
    
    // Filtrar por asignatura si se especifica
    if (asignatura) {
      where.asignaturas = { [require('sequelize').Op.contains]: [asignatura] };
    }

    const tutors = await User.findAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['rating', 'DESC']]
    });

    res.json(tutors);
  } catch (error) {
    console.error('Error obteniendo tutores:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /users/:id - Actualizar perfil
app.put('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { nombre, asignaturas, precioPorHora, bio } = req.body;
    
    await user.update({
      nombre: nombre || user.nombre,
      asignaturas: asignaturas || user.asignaturas,
      precioPorHora: precioPorHora || user.precioPorHora,
      bio: bio || user.bio
    });

    res.json({
      message: 'Perfil actualizado',
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        asignaturas: user.asignaturas,
        precioPorHora: user.precioPorHora,
        bio: user.bio
      }
    });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'user-service' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 User Service corriendo en http://localhost:${PORT}`);
});