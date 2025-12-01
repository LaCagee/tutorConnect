// services/tutoring-service/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Session } = require('./models/Session');

// Importar shared con ruta absoluta
const sharedPath = path.resolve(__dirname, '../../shared');
const { config, rabbitmq } = require(sharedPath);

const app = express();
const PORT = config.ports.tutoringService;

// Middlewares
app.use(cors());
app.use(express.json());

// Conectar a RabbitMQ
rabbitmq.connect().then(() => {
  console.log('🔗 Tutoring Service conectado a RabbitMQ');
});

// ====== RUTAS ======

// POST /sessions - Crear nueva sesión de tutoría
app.post('/sessions', async (req, res) => {
  try {
    const { tutorId, estudianteId, asignatura, fecha, hora, duracion, precio, modalidad, notas } = req.body;

    // Validar campos requeridos
    if (!tutorId || !estudianteId || !asignatura || !fecha || !hora || !precio) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Crear sesión
    const session = await Session.create({
      tutorId,
      estudianteId,
      asignatura,
      fecha,
      hora,
      duracion: duracion || 60,
      precio,
      estado: 'pendiente',
      modalidad: modalidad || 'online',
      notas: notas || ''
    });

    // 🔥 PUBLICAR EVENTO: session.created
    await rabbitmq.publish(config.events.SESSION_CREATED, {
      sessionId: session.id,
      tutorId: session.tutorId,
      estudianteId: session.estudianteId,
      asignatura: session.asignatura,
      fecha: session.fecha,
      hora: session.hora
    });

    res.status(201).json({
      message: 'Sesión de tutoría creada exitosamente',
      session: session
    });
  } catch (error) {
    console.error('Error creando sesión:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /sessions - Listar todas las sesiones
app.get('/sessions', async (req, res) => {
  try {
    const { tutorId, estudianteId, estado } = req.query;

    let where = {};
    
    if (tutorId) where.tutorId = tutorId;
    if (estudianteId) where.estudianteId = estudianteId;
    if (estado) where.estado = estado;

    const sessions = await Session.findAll({
      where,
      order: [['fecha', 'DESC'], ['hora', 'DESC']]
    });

    res.json(sessions);
  } catch (error) {
    console.error('Error obteniendo sesiones:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /sessions/:id - Obtener sesión específica
app.get('/sessions/:id', async (req, res) => {
  try {
    const session = await Session.findByPk(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error obteniendo sesión:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /sessions/:id/confirm - Confirmar sesión
app.put('/sessions/:id/confirm', async (req, res) => {
  try {
    const session = await Session.findByPk(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    await session.update({ estado: 'confirmada' });

    res.json({
      message: 'Sesión confirmada',
      session: session
    });
  } catch (error) {
    console.error('Error confirmando sesión:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /sessions/:id/complete - Completar sesión
app.put('/sessions/:id/complete', async (req, res) => {
  try {
    const session = await Session.findByPk(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    await session.update({ estado: 'completada' });

    // 🔥 PUBLICAR EVENTO: session.completed
    await rabbitmq.publish(config.events.SESSION_COMPLETED, {
      sessionId: session.id,
      tutorId: session.tutorId,
      estudianteId: session.estudianteId,
      asignatura: session.asignatura
    });

    res.json({
      message: 'Sesión completada',
      session: session
    });
  } catch (error) {
    console.error('Error completando sesión:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /sessions/:id/cancel - Cancelar sesión
app.put('/sessions/:id/cancel', async (req, res) => {
  try {
    const session = await Session.findByPk(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    await session.update({ estado: 'cancelada' });

    res.json({
      message: 'Sesión cancelada',
      session: session
    });
  } catch (error) {
    console.error('Error cancelando sesión:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /sessions/:id - Eliminar sesión
app.delete('/sessions/:id', async (req, res) => {
  try {
    const session = await Session.findByPk(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    await session.destroy();

    res.json({ message: 'Sesión eliminada' });
  } catch (error) {
    console.error('Error eliminando sesión:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'tutoring-service' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Tutoring Service corriendo en http://localhost:${PORT}`);
});