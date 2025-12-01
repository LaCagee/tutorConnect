// services/tutoring-service/models/Session.js
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

// Modelo de Sesión de Tutoría
const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
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
  asignatura: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  hora: {
    type: DataTypes.TIME,
    allowNull: false
  },
  duracion: {
    type: DataTypes.INTEGER, // en minutos
    defaultValue: 60
  },
  precio: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  estado: {
    type: DataTypes.ENUM('pendiente', 'confirmada', 'completada', 'cancelada'),
    defaultValue: 'pendiente'
  },
  modalidad: {
    type: DataTypes.ENUM('presencial', 'online'),
    defaultValue: 'online'
  },
  notas: {
    type: DataTypes.TEXT,
    defaultValue: ''
  }
}, {
  tableName: 'sessions',
  timestamps: true
});

// Sincronizar modelo con la base de datos
sequelize.sync({ alter: true })
  .then(() => console.log('✅ Tabla Sessions sincronizada'))
  .catch(err => console.error('❌ Error sincronizando Sessions:', err));

module.exports = { Session, sequelize };