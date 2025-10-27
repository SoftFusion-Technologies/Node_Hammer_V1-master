/*
 * Programador: [Tu nombre]
 * Fecha Creación: [Fecha actual]
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_HorariosPilates.js) contiene la definición del modelo Sequelize para la tabla horarios_pilates.
 *
 * Tema: Modelos - Horarios Pilates
 *
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const HorariosPilatesModel = db.define(
  'horarios_pilates',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    id_sede: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'sedes',
        key: 'id'
      }
    },
    dia_semana: {
      type: DataTypes.ENUM('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'),
      allowNull: false
    },
    hora_inicio: {
      type: DataTypes.TIME,
      allowNull: false
    },
    id_instructor: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'instructores_pilates',
        key: 'id'
      }
    },
  },
  {
    timestamps: false, // La tabla no tiene created_at ni updated_at
    tableName: 'horarios_pilates'
  }
);

export default {
  HorariosPilatesModel
};