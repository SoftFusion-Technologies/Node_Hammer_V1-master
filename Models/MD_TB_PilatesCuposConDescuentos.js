/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 06/02/2026
 * Versión: 1.0
 *
 * Descripción:
 * Modelo Sequelize para la tabla 'pilates_cupos_con_descuentos'.
 * Gestiona las reglas de descuentos por cupo, horario y grupo de días.
 *
 * Tema: Modelos - Pilates
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const PilatesCuposConDescuentosModel = db.define(
  'pilates_cupos_con_descuentos',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    sede_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'sedes',
        key: 'id'
      }
    },
    creado_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    hora: {
      type: DataTypes.STRING(5),
      allowNull: false,
      comment: 'Formato HH:mm'
    },
    grupo_dias: {
      type: DataTypes.ENUM('L-M-V', 'M-J', 'Todos'),
      allowNull: false
    },
    cantidad_cupos: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    porcentaje_descuento: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false
    },
    fecha_inicio: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    fecha_fin: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    estado: {
      type: DataTypes.ENUM('vencido', 'programado', 'vigente'),
      allowNull: false,
      defaultValue: 'programado'
    },
    // Auditoría
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'pilates_cupos_con_descuentos',
    timestamps: true,      
    underscored: true      
  }
);

export default {
    PilatesCuposConDescuentosModel
};