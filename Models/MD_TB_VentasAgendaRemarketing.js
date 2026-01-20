/*
 * Programador: Sergio Manrique
 * Fecha Creación: 12 / 01 / 2026
 * Versión: 1.0
 */


import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';
import VentasRemarketingModel from './MD_TB_VentasRemarketing.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const VentasAgendaRemarketingModel = db.define(
  'ventas_agenda_remarketing',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    prospecto_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    usuario_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true
    },
    clase_num: {
      type: DataTypes.TINYINT, // 1 | 2 | 3
      allowNull: false,
      validate: { min: 1, max: 3 }
    },
    fecha_clase: {
      type: DataTypes.DATEONLY, // yyyy-mm-dd
      allowNull: false
    },
    followup_date: {
      type: DataTypes.DATEONLY, // yyyy-mm-dd
      allowNull: false
    },
    mensaje: {
      type: DataTypes.STRING(180),
      allowNull: false
    },
    done: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    done_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'ventas_agenda_remarketing',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      // Evita duplicados por (prospecto, clase#, fecha_clase)
      { unique: true, fields: ['prospecto_id', 'clase_num', 'fecha_clase'] },
      // Para listar rápido por asesor/fecha/estado
      { fields: ['usuario_id', 'followup_date', 'done'] }
    ]
  }
);

// Asociaciones
VentasAgendaRemarketingModel.belongsTo(VentasRemarketingModel, {
  foreignKey: 'prospecto_id',
  as: 'prospecto'
});

export default {
  VentasAgendaRemarketingModel
};
