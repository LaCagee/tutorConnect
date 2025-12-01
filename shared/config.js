// shared/config.js
module.exports = {
  // Base de datos PostgreSQL
  database: {
    host: 'localhost',
    port: 5433,
    database: 'tutorconnect',
    username: 'admin',
    password: 'admin123',
    dialect: 'postgres',
    logging: false // Cambia a console.log para ver queries SQL
  },

  // RabbitMQ
  rabbitmq: {
    url: 'amqp://admin:admin123@localhost:5672'
  },

  // JWT para autenticación
  jwt: {
    secret: 'tutorconnect_secret_key_2024', 
    expiresIn: '24h'
  },

  // Nodemailer (Gmail)
  email: {
    service: 'gmail',
    user: 'matiaseduardocaceresrojas09@gmail.com',
    pass: 'nnoyvfukanhensnc'      
  },

  // Puertos de servicios
  ports: {
    apiGateway: 3000,
    userService: 3001,
    tutoringService: 3002,
    reviewService: 3003,
    notificationService: 3004
  },

  // Eventos RabbitMQ
  events: {
    SESSION_CREATED: 'session.created',
    SESSION_COMPLETED: 'session.completed',
    REVIEW_CREATED: 'review.created'
  }
};