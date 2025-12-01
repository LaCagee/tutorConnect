// services/review-service/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Review } = require('./models/Review');

// Importar shared con ruta absoluta
const sharedPath = path.resolve(__dirname, '../../shared');
const { config, rabbitmq } = require(sharedPath);

const app = express();
const PORT = config.ports.reviewService;

// Middlewares
app.use(cors());
app.use(express.json());

// Almacenar sesiones que pueden ser valoradas
const reviewablesSessions = new Set();

// Conectar a RabbitMQ y escuchar eventos
rabbitmq.connect().then(async () => {
  console.log('🔗 Review Service conectado a RabbitMQ');

  // 👂 ESCUCHAR: session.completed
  // Cuando una sesión se completa, habilitamos dejar review
  await rabbitmq.subscribe(config.events.SESSION_COMPLETED, (data) => {
    const { sessionId, tutorId, estudianteId } = data;
    
    // Agregar a la lista de sesiones que pueden ser valoradas
    reviewablesSessions.add(sessionId);
    
    console.log(`✅ Sesión ${sessionId} ahora puede ser valorada`);
  });
});

// ====== RUTAS ======

// POST /reviews - Crear nueva review
app.post('/reviews', async (req, res) => {
  try {
    const { sessionId, tutorId, estudianteId, rating, comentario, puntualidad, claridad, paciencia } = req.body;

    // Validar campos requeridos
    if (!sessionId || !tutorId || !estudianteId || !rating) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Validar que el rating esté entre 1 y 5
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'El rating debe estar entre 1 y 5' });
    }

    // Verificar que la sesión esté completada (opcional, pero recomendado)
    if (!reviewablesSessions.has(sessionId)) {
      return res.status(400).json({ 
        error: 'Esta sesión aún no puede ser valorada. Debe estar completada primero.' 
      });
    }

    // Verificar que no exista ya una review para esta sesión
    const existingReview = await Review.findOne({ where: { sessionId } });
    if (existingReview) {
      return res.status(400).json({ error: 'Esta sesión ya tiene una valoración' });
    }

    // Crear review
    const review = await Review.create({
      sessionId,
      tutorId,
      estudianteId,
      rating,
      comentario: comentario || '',
      puntualidad: puntualidad || null,
      claridad: claridad || null,
      paciencia: paciencia || null
    });

    // Remover de la lista de sesiones reviewables
    reviewablesSessions.delete(sessionId);

    // 🔥 PUBLICAR EVENTO: review.created
    await rabbitmq.publish(config.events.REVIEW_CREATED, {
      reviewId: review.id,
      sessionId: review.sessionId,
      tutorId: review.tutorId,
      estudianteId: review.estudianteId,
      rating: review.rating
    });

    res.status(201).json({
      message: 'Review creada exitosamente',
      review: review
    });
  } catch (error) {
    console.error('Error creando review:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /reviews - Listar reviews
app.get('/reviews', async (req, res) => {
  try {
    const { tutorId, estudianteId, sessionId } = req.query;

    let where = {};
    
    if (tutorId) where.tutorId = tutorId;
    if (estudianteId) where.estudianteId = estudianteId;
    if (sessionId) where.sessionId = sessionId;

    const reviews = await Review.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    res.json(reviews);
  } catch (error) {
    console.error('Error obteniendo reviews:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /reviews/:id - Obtener review específica
app.get('/reviews/:id', async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);

    if (!review) {
      return res.status(404).json({ error: 'Review no encontrada' });
    }

    res.json(review);
  } catch (error) {
    console.error('Error obteniendo review:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /reviews/tutor/:tutorId/stats - Estadísticas del tutor
app.get('/reviews/tutor/:tutorId/stats', async (req, res) => {
  try {
    const tutorId = req.params.tutorId;

    const reviews = await Review.findAll({ where: { tutorId } });

    if (reviews.length === 0) {
      return res.json({
        tutorId,
        totalReviews: 0,
        ratingPromedio: 0,
        distribucion: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      });
    }

    // Calcular promedio
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const promedio = (totalRating / reviews.length).toFixed(2);

    // Distribución de ratings
    const distribucion = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
      distribucion[r.rating]++;
    });

    res.json({
      tutorId,
      totalReviews: reviews.length,
      ratingPromedio: parseFloat(promedio),
      distribucion,
      reviews: reviews.slice(0, 5) // Últimas 5 reviews
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /reviews/session/:sessionId/can-review - Verificar si se puede valorar
app.get('/reviews/session/:sessionId/can-review', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    
    // Verificar si ya existe una review
    const existingReview = await Review.findOne({ where: { sessionId } });
    if (existingReview) {
      return res.json({
        canReview: false,
        reason: 'Ya existe una valoración para esta sesión'
      });
    }

    // Verificar si la sesión está en la lista de reviewables
    const canReview = reviewablesSessions.has(sessionId);

    res.json({
      canReview,
      reason: canReview ? 'Sesión completada, puede ser valorada' : 'La sesión debe estar completada primero'
    });
  } catch (error) {
    console.error('Error verificando review:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /reviews/:id - Eliminar review
app.delete('/reviews/:id', async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);

    if (!review) {
      return res.status(404).json({ error: 'Review no encontrada' });
    }

    await review.destroy();

    res.json({ message: 'Review eliminada' });
  } catch (error) {
    console.error('Error eliminando review:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'review-service' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Review Service corriendo en http://localhost:${PORT}`);
});