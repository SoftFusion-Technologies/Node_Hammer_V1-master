/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 15 / 04 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_DebitosAutomaticosPlanesSedes.js) contiene la definición
 * del modelo Sequelize para la tabla debitos_automaticos_planes_sedes.
 *
 * Tema: Modelos - Débitos Automáticos Planes por Sede
 *
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../../DataBase/db.js';
import { DataTypes } from 'sequelize';

// Si no estás en producción, carga las variables de entorno desde el archivo .env
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Define el modelo para la tabla 'debitos_automaticos_planes_sedes' en la base de datos
const DebitosAutomaticosPlanesSedesModel = db.define(
  'debitos_automaticos_planes_sedes',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    plan_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    sede_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    precio_base: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
      defaultValue: null
    },
    activo: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'debitos_automaticos_planes_sedes',
    freezeTableName: true,
    timestamps: false
  }
);

export default DebitosAutomaticosPlanesSedesModel;
