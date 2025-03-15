/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 15-03-2025
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (MD_TB_PlanillasCerradas.js) contiene la definición del modelo Sequelize para la tabla de planillas cerradas en la base de datos.
 *
 * Tema: Modelos - Planillas Cerradas
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

export const PlanillasCerradasModel = db.define(
  'planillas_cerradas',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    mes: {
      type: DataTypes.TINYINT,
      allowNull: false,
      validate: {
        min: 1,
        max: 12
      },
      comment: 'Mes que se ha cerrado (1-12)'
    },
    anio: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      validate: {
        min: 1900,
        max: 2100
      },
      comment: 'Año correspondiente al mes cerrado'
    },
    fecha_cierre: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Fecha y hora en que se cerró la planilla'
    }
  },
  {
    timestamps: false
  }
);

export default {
  PlanillasCerradasModel
};
