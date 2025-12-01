// services/review-service/models/Review.js
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Importar config con ruta absoluta
const sharedPath = path.resolve(__dirname, '../../../shared');
const { config } = require(sharedPath);

// Conexión a la base de datos
const sequelize = new Sequelize(
  config.database.database,
  config.database.username,
  config.database.password,
  {
    host: config.database.host,
    port: config.database.port,
    dialect: config.database.dialect,
    logging: config.database.logging
  }
);

// Modelo de Review/Valoración
const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sessionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true, // Una sesión solo puede tener una review
    field: 'session_id'
  },
  tutorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'tutor_id'
  },
  estudianteId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'estudiante_id'
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  comentario: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  // Valoraciones específicas (opcional)
  puntualidad: {
    type: DataTypes.INTEGER,
    validate: {
      min: 1,
      max: 5
    }
  },
  claridad: {
    type: DataTypes.INTEGER,
    validate: {
      min: 1,
      max: 5
    }
  },
  paciencia: {
    type: DataTypes.INTEGER,
    validate: {
      min: 1,
      max: 5
    }
  }
}, {
  tableName: 'reviews',
  timestamps: true
});

// Sincronizar modelo con la base de datos
sequelize.sync({ alter: true })
  .then(() => console.log('✅ Tabla Reviews sincronizada'))
  .catch(err => console.error('❌ Error sincronizando Reviews:', err));

module.exports = { Review, sequelize };