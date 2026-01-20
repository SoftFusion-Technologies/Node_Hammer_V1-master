/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 10 / 01 / 2025
 * Versión: 1.1
 *
 * Descripción:
 * Modelo Sequelize actualizado para la tabla de horarios seleccionados de prospectos de clase de prueba.
 */

import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';
import VentasRemarketingModel from './MD_TB_VentasRemarketing.js';

export const VentasRemarketingHorariosModel = db.define(
  'ventas_remarketing_horarios',
  {
    prospecto_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: VentasRemarketingModel,
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    hhmm: {
      type: DataTypes.TIME,
      allowNull: false,
      get() {
        // Devuelve solo HH:MM
        const raw = this.getDataValue('hhmm');
        return raw ? raw.substring(0,5) : null;
      }
    },
    grp: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    clase_num: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1
    }
  },
  {
    timestamps: false
  }
);

// Asociación
VentasRemarketingHorariosModel.belongsTo(VentasRemarketingModel, {
  foreignKey: 'prospecto_id',
  as: 'prospecto'
});

export default { VentasRemarketingHorariosModel };
