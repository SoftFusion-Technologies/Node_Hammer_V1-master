/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 21 / 12 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Modelo Sequelize para la tabla 'integrantes_conve_notas'.
 * Historial de notas por integrante de convenio, guardando autor y fecha.
 *
 * Tema: Modelos - IntegrantesConveNotas
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const IntegrantesConveNotasModel = db.define(
  'integrantes_conve_notas',
  {
    integrante_conve_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },

    // Nombre de quien registró la nota (obligatorio por requerimiento).
    autor_nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },

    // Nota larga (hasta 655 chars según DDL).
    nota: {
      type: DataTypes.STRING(655),
      allowNull: false
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
  },
  {
    timestamps: false
  }
);

export default {
  IntegrantesConveNotasModel
};
