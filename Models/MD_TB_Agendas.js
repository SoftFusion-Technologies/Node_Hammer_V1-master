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
    }
  },
  {
    timestamps: false
  }
);

export default {
  AgendasModel
};
