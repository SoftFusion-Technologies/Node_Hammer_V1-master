/*
 * Programador: [Tu nombre]
 * Fecha Creación: [Fecha actual]
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo contiene la definición del modelo Sequelize para la tabla inscripciones_pilates.
 *
 * Tema: Modelos - Inscripciones Pilates
 *
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const InscripcionesPilatesModel = db.define(
  'inscripciones_pilates',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    id_cliente: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    id_horario: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    fecha_inscripcion: {
      type: DataTypes.DATEONLY,
      allowNull: false
    }
  },
  {
    timestamps: false,
    tableName: 'inscripciones_pilates'
  }
);
export default InscripcionesPilatesModel;