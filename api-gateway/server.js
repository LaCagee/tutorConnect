// api-gateway/server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const path = require('path');

// Importar config
const sharedPath = path.resolve(__dirname, '../shared');
const { config } = require(sharedPath);

const app = express();
const PORT = config.ports.apiGateway;

// Middlewares
app.use(cors());
app.use(express.json());

// ====== MIDDLEWARE DE AUTENTICACIÓN ======

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  jwt.verify(token, config.jwt.secret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.user = user; // Guardar info del usuario en el request
    next();
  });
}

// ====== FUNCIÓN PARA HACER PROXY A MICROSERVICIOS ======

async function proxyRequest(serviceUrl, req, res) {
  try {
    const response = await axios({
      method: req.method,
      url: serviceUrl,
      data: req.body,
      params: req.query,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Error comunicándose con el microservicio' });
    }
  }
}

// ====== RUTAS PÚBLICAS (Sin autenticación) ======

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'api-gateway',
    timestamp: new Date().toISOString()
  });
});

// POST /api/register - Registrar usuario
app.post('/api/register', async (req, res) => {
  await proxyRequest(
    `http://localhost:${config.ports.userService}/register`,
    req,
    res
  );
});

// POST /api/login - Iniciar sesión
app.post('/api/login', async (req, res) => {
  await proxyRequest(
    `http://localhost:${config.ports.userService}/login`,
    req,
    res
  );
});

// GET /api/tutors - Listar tutores (público)
app.get('/api/tutors', async (req, res) => {
  await proxyRequest(
    `http://localhost:${config.ports.userService}/tutors${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`,
    req,
    res
  );
});

// GET /api/users/:id - Ver perfil de usuario (público)
app.get('/api/users/:id', async (req, res) => {
  await proxyRequest(
    `http://localhost:${config.ports.userService}/users/${req.params.id}`,
    req,
    res
  );
});

// ====== RUTAS PROTEGIDAS (Requieren autenticación) ======

// PUT /api/users/:id - Actualizar perfil
app.put('/api/users/:id', verificarToken, async (req, res) => {
  await proxyRequest(
    `http://localhost:${config.ports.userService}/users/${req.params.id}`,
    req,
    res
  );
});

// ====== RUTAS DE SESIONES/TUTORÍAS ======

// POST /api/sessions - Crear sesión
app.post('/api/sessions', verificarToken, async (req, res) => {
  await proxyRequest(
    `http://localhost:${config.ports.tutoringService}/sessions`,
    req,
    res
  );
});

// GET /api/sessions - Listar sesiones
app.get('/api/sessions', verificarToken, async (req, res) => {
  const queryString = new URLSearchParams(req.query).toString();
  await proxyRequest(
    `http://localhost:${config.ports.tutoringService}/sessions${queryString ? '?' + queryString : ''}`,
    req,
    res
  );
});

// GET /api/sessions/:id - Ver sesión específica
app.get('/api/sessions/:id', verificarToken, async (req, res) => {
  await proxyRequest(
    `http://localhost:${config.ports.tutoringService}/sessions/${req.params.id}`,
    req,
    res
  );
});

// PUT /api/sessions/:id/confirm - Confirmar sesión
app.put('/api/sessions/:id/confirm', verificarToken, async (req, res) => {
  await proxyRequest(
    `http://localhost:${config.ports.tutoringService}/sessions/${req.params.id}/confirm`,
    req,
    res
  );
});

// PUT /api/sessions/:id/complete - Completar sesión
app.put('/api/sessions/:id/complete', verificarToken, async (req, res) => {
  await proxyRequest(
    `http://localhost:${config.ports.tutoringService}/sessions/${req.params.id}/complete`,
    req,
    res
  );
});

// PUT /api/sessions/:id/cancel - Cancelar sesión
app.put('/api/sessions/:id/cancel', verificarToken, async (req, res) => {
  await proxyRequest(
    `http://localhost:${config.ports.tutoringService}/sessions/${req.params.id}/cancel`,
    req,
    res
  );
});

// DELETE /api/sessions/:id - Eliminar sesión
app.delete('/api/sessions/:id', verificarToken, async (req, res) => {
  await proxyRequest(
    `http://localhost:${config.ports.tutoringService}/sessions/${req.params.id}`,
    req,
    res
  );
});

// ====== RUTAS DE REVIEWS ======

// POST /api/reviews - Crear review
app.post('/api/reviews', verificarToken, async (req, res) => {
  await proxyRequest(
    `http://localhost:${config.ports.reviewService}/reviews`,
    req,
    res
  );
});

// GET /api/reviews - Listar reviews
app.get('/api/reviews', async (req, res) => {
  const queryString = new URLSearchParams(req.query).toString();
  await proxyRequest(
    `http://localhost:${config.ports.reviewService}/reviews${queryString ? '?' + queryString : ''}`,
    req,
    res
  );
});

// GET /api/reviews/:id - Ver review específica
app.get('/api/reviews/:id', async (req, res) => {
  await proxyRequest(
    `http://localhost:${config.ports.reviewService}/reviews/${req.params.id}`,
    req,
    res
  );
});

// GET /api/reviews/tutor/:tutorId/stats - Estadísticas del tutor
app.get('/api/reviews/tutor/:tutorId/stats', async (req, res) => {
  await proxyRequest(
    `http://localhost:${config.ports.reviewService}/reviews/tutor/${req.params.tutorId}/stats`,
    req,
    res
  );
});

// GET /api/reviews/session/:sessionId/can-review - Verificar si puede valorar
app.get('/api/reviews/session/:sessionId/can-review', verificarToken, async (req, res) => {
  await proxyRequest(
    `http://localhost:${config.ports.reviewService}/reviews/session/${req.params.sessionId}/can-review`,
    req,
    res
  );
});

// DELETE /api/reviews/:id - Eliminar review
app.delete('/api/reviews/:id', verificarToken, async (req, res) => {
  await proxyRequest(
    `http://localhost:${config.ports.reviewService}/reviews/${req.params.id}`,
    req,
    res
  );
});

// ====== MANEJO DE RUTAS NO ENCONTRADAS ======

app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    path: req.originalUrl 
  });
});

// ====== INICIAR SERVIDOR ======

app.listen(PORT, () => {
  console.log(`🚪 API Gateway corriendo en http://localhost:${PORT}`);
  console.log(`📡 Redirigiendo requests a microservicios:`);
  console.log(`   - User Service: :${config.ports.userService}`);
  console.log(`   - Tutoring Service: :${config.ports.tutoringService}`);
  console.log(`   - Review Service: :${config.ports.reviewService}`);
  console.log(`   - Notification Service: :${config.ports.notificationService}`);
});