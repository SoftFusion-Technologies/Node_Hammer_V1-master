/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 30 may 2024
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (MD_TB_AdmConveniosImages.js) contiene la definición del modelo Sequelize para la tabla de la base de datos.
 *
 * Tema: Modelos - AdmConveniosImages
 *
 * Capa: Backend
 */

// Importa la configuración de la base de datos y los tipos de datos necesarios
import dotenv from 'dotenv'; // Importa el módulo dotenv para cargar variables de entorno desde un archivo .env
import db from '../DataBase/db.js'; // Importa la conexión a la base de datos
import { DataTypes } from 'sequelize'; // Importa el módulo DataTypes de Sequelize para definir tipos de datos
import AdmConveniosModel from './MD_TB_AdmConvenios.js';
// Si no estás en producción, carga las variables de entorno desde el archivo .env
if (process.env.NODE_ENV !== 'production') {
  dotenv.config(); // Carga las variables de entorno desde el archivo .env
}

// Define el modelo para la tabla 'adm_convenios' en la base de datos
const AdmConveniosImages = db.define(
  // Define los campos y sus tipos de datos correspondientes
  'adm_convenio_images',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    convenio_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: AdmConveniosModel, // El nombre del modelo relacionado
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    image_path: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'adm_convenio_images',
    timestamps: false // Si solo tienes created_at y no updated_at, puedes desactivar timestamps
  }
);

export default {
  AdmConveniosImages
};
