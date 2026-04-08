/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 08 / 04 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * * Cabecera principal de pagos y resúmenes de haberes del personal.
 * * Consolida horas trabajadas, adelantos, deudas y saldos finales por período.
 * Tema: Modelos - RRHH Liquidaciones
 * * Capa: Backend 
 */
import db from "../../DataBase/db.js";
import { DataTypes } from "sequelize";

const RRHHLiquidacionesModel = db.define(
  "rrhh_liquidaciones",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    usuario_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    sede_id: { type: DataTypes.INTEGER, allowNull: false },
    fecha_desde: { type: DataTypes.DATEONLY, allowNull: false },
    fecha_hasta: { type: DataTypes.DATEONLY, allowNull: false },
    fecha_liquidacion: { type: DataTypes.DATEONLY, allowNull: false },
    fecha_pago: { type: DataTypes.DATEONLY, allowNull: true },
    estado: {
      type: DataTypes.ENUM("borrador", "confirmada", "anulada"),
      allowNull: false,
      defaultValue: "borrador",
    },

    // --- NUESTROS CAMPOS SIMPLIFICADOS ---
    horas_trabajadas_periodo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    saldo_adelantos_previos: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    horas_descontadas: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    horas_adelanto_futuro: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    horas_liquidadas: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    // --------------------------------------

    tipo_liquidacion: {
      type: DataTypes.ENUM("normal", "adelanto", "ajuste_manual"),
      allowNull: false,
      defaultValue: "normal",
    },
    subtipo_adelanto: {
      type: DataTypes.ENUM("horas_futuras", "horas_trabajadas"),
      allowNull: true,
    },
    observacion: { type: DataTypes.TEXT, allowNull: true },
    cuenta_bancaria_id: { type: DataTypes.INTEGER, allowNull: true },
    liquidado_por: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    eliminado: { type: DataTypes.TINYINT, defaultValue: 0 },
  },
  {
    tableName: "rrhh_liquidaciones",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default RRHHLiquidacionesModel;
