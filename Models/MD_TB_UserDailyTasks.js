/* Programador: Benjamin Orellana
 * Fecha Creación: 03/06/2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo contiene la definición del modelo Sequelize para la tabla `user_daily_tasks`,
 * que vincula tareas diarias con usuarios.
 *
 * Tema: Modelos - Asignaciones de Tareas
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

import DailyTaskModel from './MD_TB_DailyTasks.js';
import UsersModel from './MD_TB_Users.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const UserDailyTaskModel = db.define(
  'user_daily_tasks',
  {
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    daily_task_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    }
  },
  { timestamps: false }
);

// Asociaciones
DailyTaskModel.hasMany(UserDailyTaskModel, {
  foreignKey: 'daily_task_id',
  as: 'taskUsers'
});
UserDailyTaskModel.belongsTo(DailyTaskModel, {
  foreignKey: 'daily_task_id'
});

UsersModel.hasMany(UserDailyTaskModel, {
  foreignKey: 'user_id',
  as: 'userTasks'
});
UserDailyTaskModel.belongsTo(UsersModel, {
  foreignKey: 'user_id',
  as: 'user'
});

export default UserDailyTaskModel;
