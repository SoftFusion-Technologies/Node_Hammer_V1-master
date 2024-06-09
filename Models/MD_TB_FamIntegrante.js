/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 16 /03 / 2024
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_FamIntegrante.js) contiene la definición del modelo Sequelize para la tabla de la base de datos.
 *
 * Tema: Modelos - fam_integrante
 *
 * Capa: Backend
 */

// Importa la configuración de la base de datos y los tipos de datos necesarios
import dotenv from 'dotenv'; // Importa el módulo dotenv para cargar variables de entorno desde un archivo .env
import db from '../DataBase/db.js'; // Importa la conexión a la base de datos
import { DataTypes } from 'sequelize'; // Importa el módulo DataTypes de Sequelize para definir tipos de datos

// Si no estás en producción, carga las variables de entorno desde el archivo .env
if (process.env.NODE_ENV !== 'production') {
  dotenv.config(); // Carga las variables de entorno desde el archivo .env
}

// Define el modelo para la tabla 'fam_integrante' en la base de datos
const FamIntegranteModel = db.define(
  // Define los campos y sus tipos de datos correspondientes
  'fam_integrante',
  {
    id_integrante: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    dni: {
      type: DataTypes.STRING,
      allowNull: true
    },
    telefono: {
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
    }
  },
  {
    timestamps: false // Esto evita que Sequelize añada automáticamente los campos createdAt y updatedAt
  }
);

export default {
  FamIntegranteModel
};
