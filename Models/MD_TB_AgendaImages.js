/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 22-10-2024
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (MD_TB_AgendaImagenes.js) contiene la definición del modelo Sequelize para la tabla de imágenes de la agenda en la base de datos.
 *
 * Tema: Modelos - Agenda Imágenes
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

export const AgendaImagenesModel = db.define(
  'agenda_imagenes', // Nombre de la tabla en la base de datos
  {
    agenda_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'agendas', // Relación con la tabla 'agendas'
        key: 'id'
      }
    },
    agenda_num: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    alumno_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'alumnos', // Relación con la tabla 'alumnos'
        key: 'id'
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
    timestamps: false // No usar timestamps en esta tabla
  }
);

export default {
  AgendaImagenesModel
};
