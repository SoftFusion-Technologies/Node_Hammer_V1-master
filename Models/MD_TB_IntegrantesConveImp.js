import dotenv from 'dotenv';
import db from '../DataBase/db.js'; // Importa la conexión a la base de datos
import { DataTypes } from 'sequelize'; // Importa el módulo DataTypes de Sequelize para definir tipos de datos

if (process.env.NODE_ENV !== 'production') {
  dotenv.config(); // Carga las variables de entorno desde el archivo .env
}

const IntegrantesConveModelImp = db.define(
  'integrantes_conve',
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true
    },
    id_conv: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: true
    },
    dni: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    sede: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notas: {
      type: DataTypes.STRING,
      allowNull: true
    },
    precio: {
      type: DataTypes.STRING,
      allowNull: true
    },
    descuento: {
      type: DataTypes.STRING,
      allowNull: true
    },
    preciofinal: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userName: {
      type: DataTypes.STRING,
      allowNull: true // Este campo puede ser nulo
    },
    fechaCreacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW // Asigna la fecha y hora actuales por defecto
    }
  },
  {
    timestamps: false // Esto evita que Sequelize añada automáticamente los campos createdAt y updatedAt
  }
);

export default IntegrantesConveModelImp;
