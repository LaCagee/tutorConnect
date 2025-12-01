// services/notification-service/server.js
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const axios = require('axios');
const path = require('path');

// Importar shared con ruta absoluta
const sharedPath = path.resolve(__dirname, '../../shared');
const { config, rabbitmq } = require(sharedPath);

const app = express();
const PORT = config.ports.notificationService;

// Middlewares
app.use(cors());
app.use(express.json());

// ====== CONFIGURAR NODEMAILER ======
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.email.user,
    pass: config.email.pass
  }
});

// Verificar conexión al iniciar
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Error conectando al servidor de email:', error);
  } else {
    console.log('✅ Servidor de email listo');
  }
});

// ====== FUNCIONES DE ENVÍO DE EMAIL ======

async function enviarEmail(to, subject, html) {
  try {
    const info = await transporter.sendMail({
      from: '"TutorConnect" <noreply@tutorconnect.cl>',
      to: to,
      subject: subject,
      html: html
    });

    console.log('📧 Email enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return { success: false, error: error.message };
  }
}

// ====== TEMPLATES DE EMAILS ======

function templateSesionCreada(tutorNombre, estudiante, asignatura, fecha, hora) {
  return `
    <h2>🎓 Nueva Sesión de Tutoría Agendada</h2>
    <p>Hola <strong>${tutorNombre}</strong>,</p>
    <p>Tienes una nueva sesión de tutoría agendada:</p>
    <ul>
      <li><strong>Estudiante:</strong> ${estudiante}</li>
      <li><strong>Asignatura:</strong> ${asignatura}</li>
      <li><strong>Fecha:</strong> ${fecha}</li>
      <li><strong>Hora:</strong> ${hora}</li>
    </ul>
    <p>Por favor confirma tu disponibilidad en la plataforma.</p>
    <br>
    <p>Saludos,<br>Equipo TutorConnect</p>
  `;
}

function templateSesionCompletada(estudianteNombre, tutor, asignatura) {
  return `
    <h2>✅ Sesión de Tutoría Completada</h2>
    <p>Hola <strong>${estudianteNombre}</strong>,</p>
    <p>Tu sesión de <strong>${asignatura}</strong> con ${tutor} ha sido completada.</p>
    <p>¿Te gustaría dejar una valoración? Tu opinión ayuda a otros estudiantes.</p>
    <br>
    <p><a href="http://localhost:3000/reviews" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Dejar Valoración</a></p>
    <br>
    <p>Saludos,<br>Equipo TutorConnect</p>
  `;
}

function templateReviewCreada(tutorNombre, rating, comentario) {
  const estrellas = '⭐'.repeat(rating);
  return `
    <h2>🌟 Nueva Valoración Recibida</h2>
    <p>Hola <strong>${tutorNombre}</strong>,</p>
    <p>Has recibido una nueva valoración:</p>
    <p style="font-size: 24px;">${estrellas} (${rating}/5)</p>
    ${comentario ? `<p><em>"${comentario}"</em></p>` : ''}
    <p>¡Sigue con el excelente trabajo!</p>
    <br>
    <p>Saludos,<br>Equipo TutorConnect</p>
  `;
}

// ====== OBTENER DATOS DE USUARIOS ======

async function obtenerUsuario(userId) {
  try {
    const response = await axios.get(`http://localhost:${config.ports.userService}/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error(`Error obteniendo usuario ${userId}:`, error.message);
    return null;
  }
}

// ====== ESCUCHAR EVENTOS DE RABBITMQ ======

rabbitmq.connect().then(async () => {
  console.log('🔗 Notification Service conectado a RabbitMQ');

  // 👂 EVENTO 1: session.created
  await rabbitmq.subscribe(config.events.SESSION_CREATED, async (data) => {
    console.log('📩 Procesando evento: session.created');
    
    const { tutorId, estudianteId, asignatura, fecha, hora } = data;

    // Obtener datos del tutor y estudiante
    const tutor = await obtenerUsuario(tutorId);
    const estudiante = await obtenerUsuario(estudianteId);

    if (tutor && estudiante) {
      // Enviar email al tutor
      const html = templateSesionCreada(
        tutor.nombre,
        estudiante.nombre,
        asignatura,
        fecha,
        hora
      );

      await enviarEmail(
        tutor.email,
        '🎓 Nueva Sesión de Tutoría Agendada',
        html
      );
    }
  });

  // 👂 EVENTO 2: session.completed
  await rabbitmq.subscribe(config.events.SESSION_COMPLETED, async (data) => {
    console.log('📩 Procesando evento: session.completed');
    
    const { tutorId, estudianteId, asignatura } = data;

    // Obtener datos del tutor y estudiante
    const tutor = await obtenerUsuario(tutorId);
    const estudiante = await obtenerUsuario(estudianteId);

    if (tutor && estudiante) {
      // Enviar email al estudiante pidiendo review
      const html = templateSesionCompletada(
        estudiante.nombre,
        tutor.nombre,
        asignatura
      );

      await enviarEmail(
        estudiante.email,
        '✅ Sesión Completada - Deja tu Valoración',
        html
      );
    }
  });

  // 👂 EVENTO 3: review.created
  await rabbitmq.subscribe(config.events.REVIEW_CREATED, async (data) => {
    console.log('📩 Procesando evento: review.created');
    
    const { tutorId, rating } = data;

    // Obtener datos del tutor
    const tutor = await obtenerUsuario(tutorId);

    if (tutor) {
      // Enviar email al tutor notificando la nueva review
      const html = templateReviewCreada(
        tutor.nombre,
        rating,
        data.comentario || ''
      );

      await enviarEmail(
        tutor.email,
        '🌟 Nueva Valoración Recibida',
        html
      );
    }
  });
});

// ====== RUTAS API (opcional, para envío manual) ======

// POST /send-email - Enviar email manual
app.post('/send-email', async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const result = await enviarEmail(to, subject, html);

    if (result.success) {
      res.json({ message: 'Email enviado exitosamente', messageId: result.messageId });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error en envío de email:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /test-email - Enviar email de prueba
app.get('/test-email', async (req, res) => {
  const result = await enviarEmail(
    'test@ejemplo.com',
    '🧪 Test Email',
    '<h1>Este es un email de prueba</h1><p>Si ves esto, Nodemailer funciona correctamente.</p>'
  );

  if (result.success) {
    res.json({ message: 'Email de prueba enviado', messageId: result.messageId });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'notification-service' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Notification Service corriendo en http://localhost:${PORT}`);
});