/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 30 may 2024
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (MD_TB_ImagesConve.js) contiene la definición del modelo Sequelize para la tabla de la base de datos.
 *
 * Tema: Modelos - ImagesConve
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

// Define el modelo para la tabla 'MD_TB_ImagesConve' en la base de datos
const ImagesConveModel = db.define(
  'imagenes_conve',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    id_conv: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    imagen_path: {
      type: DataTypes.STRING,
      allowNull: false
    },
    mes: {
      type: DataTypes.STRING
    }
  },
  {
    timestamps: false // Desactiva las marcas de tiempo
  }
);

export default {
  ImagesConveModel
};
