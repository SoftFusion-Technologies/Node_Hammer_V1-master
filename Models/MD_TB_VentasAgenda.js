/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 15 / 06 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Modelo Sequelize para la tabla ventas_agenda (seguimiento post clase de prueba).
 *
 * Tema: Modelos - Ventas Agenda
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';
import { VentasProspectosModel } from './MD_TB_ventas_prospectos.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const VentasAgendaModel = db.define(
  'ventas_agenda',
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
      allowNull: false
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
    tableName: 'ventas_agenda',
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
VentasAgendaModel.belongsTo(VentasProspectosModel, {
  foreignKey: 'prospecto_id',
  as: 'prospecto'
});

// (Opcional) si tenés Users:
// import UserModel from './MD_TB_Users.js';
// VentasAgendaModel.belongsTo(UserModel, { foreignKey: 'usuario_id', as: 'asesor' });

export default {
  VentasAgendaModel
};
