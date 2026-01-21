/*
 * Programador: Sergio Manrique
 * Fecha Creación: 19/01/2026
 * Versión: 1.0
 * Descripción: Modelo para la tabla de imágenes de quejas internas
 */

import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

const QuejasInternasImagenesModel = db.define(
  'quejas_internas_imagenes',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    id_queja: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    tipo: {
      type: DataTypes.STRING,
      defaultValue: 'QR-PAGINA'
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  },
  {
    timestamps: false,
    tableName: 'quejas_internas_imagenes'
  }
);

export default {
  QuejasInternasImagenesModel
};