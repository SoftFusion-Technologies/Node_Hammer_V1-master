/*
 * Programador: Benjamin Orellana
 * Fecha: 08/08/2025
 * Descripción: Modelo Sequelize para chunks IA embebidos
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const ChunkIAModel = db.define(
  'chunks_ia',
  {
    titulo: { type: DataTypes.STRING },
    texto: { type: DataTypes.TEXT, allowNull: false },
    embedding: { type: DataTypes.JSON, allowNull: false }
  },
  {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  }
);

export default ChunkIAModel;
