/*
 * Programador: Sergio Manrique
 * Fecha Creación: 12 / 01 / 2026
 * Versión: 1.0
 */

import db from '../DataBase/db.js';
import { DataTypes, Model } from 'sequelize';

export class VentasComisionesRemarketingModel extends Model {}

VentasComisionesRemarketingModel.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },

    prospecto_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    vendedor_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    sede: { type: DataTypes.STRING(50), allowNull: false },

    tipo_plan: { type: DataTypes.STRING(80), allowNull: false },
    tipo_plan_custom: { type: DataTypes.STRING(120) },
    observacion: { type: DataTypes.STRING(255) },

    estado: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'en_revision'
    },
    monto_comision: { type: DataTypes.DECIMAL(12, 2) },
    moneda: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'ARS'
    },

    aprobado_por: { type: DataTypes.BIGINT.UNSIGNED },
    aprobado_at: { type: DataTypes.DATE },
    rechazado_por: { type: DataTypes.BIGINT.UNSIGNED },
    rechazado_at: { type: DataTypes.DATE },
    motivo_rechazo: { type: DataTypes.STRING(255) }
  },
  {
    sequelize: db,
    modelName: 'ventas_comisiones_remarketing',
    tableName: 'ventas_comisiones_remarketing',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['estado'] },
      { fields: ['vendedor_id', 'created_at'] },
      { fields: ['prospecto_id'] },
    ]
  }
);

export default { VentasComisionesRemarketingModel };
