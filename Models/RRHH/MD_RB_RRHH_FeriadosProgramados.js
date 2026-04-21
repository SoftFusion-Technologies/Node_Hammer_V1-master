/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 21 / 04 / 2026
 * Versión: 1.0
 *
 */

import db from '../../DataBase/db.js';
import { DataTypes } from 'sequelize';

const RRHH_FeriadosProgramados = db.define(
  'rrhh_feriados_programados',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    usuario_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      unique: true 
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    timestamps: false,
    tableName: 'rrhh_feriados_programados'
  }
);

export default RRHH_FeriadosProgramados;