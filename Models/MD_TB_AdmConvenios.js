/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 30 may 2024
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (MD_TB_AdmConvenios.js) contiene la definición del modelo Sequelize para la tabla de la base de datos.
 *
 * Tema: Modelos - AdmConvenios
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

// Define el modelo para la tabla 'adm_convenios' en la base de datos
const AdmConveniosModel = db.define(
  // Define los campos y sus tipos de datos correspondientes
  'adm_convenios',
  {
    nameConve: {
      type: DataTypes.STRING,
      allowNull: false
    },
    descConve: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tipoConve: {
      type: DataTypes.STRING,
      allowNull: true
    },
    ultima_actualizacion: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    timestamps: false // Esto evita que Sequelize añada automáticamente los campos createdAt y updatedAt
  }
);

export default {
  AdmConveniosModel
};
