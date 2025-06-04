/* Programador: Benjamin Orellana
 * Fecha Creación: 03/06/2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo contiene la definición del modelo Sequelize para la tabla `daily_tasks`,
 * que gestiona las tareas diarias del sistema.
 *
 * Tema: Modelos - Tareas Diarias
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const DailyTaskModel = db.define(
  'daily_tasks',
  {
    titulo: { type: DataTypes.STRING, allowNull: false },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    activa: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 }
  },
  { timestamps: false }
);

export default DailyTaskModel;
