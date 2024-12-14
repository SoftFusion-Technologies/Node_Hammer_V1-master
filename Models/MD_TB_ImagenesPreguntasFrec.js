/*
 * Programador: Benjamín Orellana
 * Fecha Creación: 14-12-2024
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (MD_TB_ImagenesPreguntasFrec.js) contiene la definición del modelo Sequelize para la tabla de imágenes de preguntas frecuentes en la base de datos.
 *
 * Tema: Modelos - Imágenes Preguntas Frecuentes
 *
 * Capa: Backend
 */

// Importa la configuración de la base de datos y los tipos de datos necesarios
import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

// Carga las variables de entorno si no estás en producción
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Define el modelo Sequelize para la tabla `imagenes_preguntas_frec`
export const ImagenesPreguntasFrecModel = db.define(
  'imagenes_preguntas_frec', // Nombre de la tabla en la base de datos
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    pregunta_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false, // No permitir valores nulos
      references: {
        model: 'frec_asks', // Relacionado con la tabla frec_asks
        key: 'id' // Clave primaria de frec_asks
      }
    },
    nombre_archivo: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    ruta_archivo: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    fecha_subida: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    timestamps: false, // No usar timestamps automáticos (createdAt, updatedAt)
    tableName: 'imagenes_preguntas_frec' // Nombre exacto de la tabla en la base de datos
  }
);

// Exportar el modelo
export default {
  ImagenesPreguntasFrecModel
};
