/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 08 / 04 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * * Desglose granular de cada ítem que compone una liquidación final.
 * * Clasifica horas por tipo (ajustes, adelantos, feriados, etc.) vinculándolos a marcaciones.
 * Tema: Modelos - RRHH Liquidación Detalle
 * * Capa: Backend 
 */
import db from '../../DataBase/db.js';
import { DataTypes } from 'sequelize';

const RRHHLiquidacionDetalleModel = db.define(
  'rrhh_liquidacion_detalle',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    liquidacion_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },

    tipo_detalle: {
      type: DataTypes.ENUM(
        'marcacion_aprobada',
        'ajuste_manual',
        'adelanto',
        'correccion',
        'feriado_forzado',
        'horas_forzadas',
        'saldo_anterior'
      ),
      allowNull: false
    },

    marcacion_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    horas: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },

    observacion: {
      type: DataTypes.STRING(255),
      allowNull: true
    },

    eliminado: {
      type: DataTypes.TINYINT,
      defaultValue: 0
    }
  },
  {
    tableName: 'rrhh_liquidacion_detalle',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  }
);

export default RRHHLiquidacionDetalleModel;