// MD_LastExecution.js
import dotenv from 'dotenv';
import db from '../DataBase/db.js'; // Importa la conexión a la base de datos
import { DataTypes } from 'sequelize'; // Importa el módulo DataTypes de Sequelize para definir tipos de datos

if (process.env.NODE_ENV !== 'production') {
  dotenv.config(); // Carga las variables de entorno desde el archivo .env
}

// Definir el modelo para almacenar la fecha de la última ejecución
const Meses = db.define(
  'meses',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true // Se incrementará automáticamente
    },
    fecha: {
      type: DataTypes.DATE, // Guardará la fecha de la última ejecución
      allowNull: false
    }
  },
  {
    tableName: 'meses', // Nombre de la tabla
    timestamps: false // No es necesario que tenga campos `createdAt` ni `updatedAt`
  }
);

export default Meses;
