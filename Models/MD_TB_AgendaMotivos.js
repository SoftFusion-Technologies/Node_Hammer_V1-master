/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 12-12-2024
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (MD_TB_AgendaMotivos.js) contiene la definición del modelo Sequelize para la tabla de motivos de la agenda en la base de datos.
 *
 * Tema: Modelos - Agenda Motivos
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

export const AgendaMotivosModel = db.define(
  'agenda_motivos', // Nombre de la tabla en la base de datos
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
    motivo: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    fecha_creacion: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    }
  },
  {
    timestamps: false, // No usar timestamps automáticos
    tableName: 'agenda_motivos' // Nombre explícito de la tabla
  }
);

export default {
  AgendaMotivosModel
};
