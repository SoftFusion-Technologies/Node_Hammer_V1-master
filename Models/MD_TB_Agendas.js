/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 22-10-2024
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (MD_TB_Agendas.js) contiene la definición del modelo Sequelize para la tabla de agendas en la base de datos.
 *
 * Tema: Modelos - Agendas
 *
 * Capa: Backend
 */

// Importa la configuración de la base de datos y los tipos de datos necesarios
import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const AgendasModel = db.define(
  'agendas',
  {
    alumno_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'alumnos', // Nombre de la tabla referenciada
        key: 'id'
      }
    },
    agenda_num: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    contenido: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    mes: {
      type: DataTypes.TINYINT,
      allowNull: false,
      validate: {
        min: 1,
        max: 12 // Asegura que los meses estén en el rango válido
      },
      comment: 'Mes de la asistencia (1-12)'
    },
    anio: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      validate: {
        min: 1900, // Rango mínimo, ajusta según tu caso
        max: 2100 // Rango máximo, ajusta según tu caso
      },
      comment: 'Año de la asistencia (ejemplo: 2024)'
    },
    // Nueva columna fecha_creacion
    fecha_creacion: {
      type: DataTypes.DATE,
      allowNull: true, // Si quieres que sea opcional inicialmente
      defaultValue: DataTypes.NOW,
      comment: 'Fecha en la que se creó la agenda'
    }
  },
  {
    timestamps: false
  }
);

export default {
  AgendasModel
};
