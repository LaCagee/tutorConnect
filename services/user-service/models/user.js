// services/user-service/models/User.js
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

// Modelo de Usuario
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
    /*,
    validate: {
      isEmail: true,
      isInstitutional(value) {
        if (!value.endsWith('@santotomas.cl')) {
          throw new Error('Debe usar email institucional @santotomas.cl');
        }
      }
    }*/
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  rol: {
    type: DataTypes.ENUM('estudiante', 'tutor'),
    allowNull: false,
    defaultValue: 'estudiante'
  },
  // Campos específicos para tutores
  asignaturas: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  precioPorHora: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0,
    validate: {
      min: 0,
      max: 5
    }
  },
  totalReviews: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  bio: {
    type: DataTypes.TEXT,
    defaultValue: ''
  }
}, {
  tableName: 'users',
  timestamps: true
});

// Sincronizar modelo con la base de datos
sequelize.sync({ alter: true })
  .then(() => console.log('✅ Tabla Users sincronizada'))
  .catch(err => console.error('❌ Error sincronizando Users:', err));

module.exports = { User, sequelize };