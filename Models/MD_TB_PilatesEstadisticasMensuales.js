/*
 * Programador: Sergio Manrique
 * Fecha Creación: 30/01/2026
 * Versión: 1.0
 *
 * Descripción:
 * Modelo Sequelize para estadísticas mensuales de Pilates por sede,
 * incluyendo retención, ocupación y asistencias.
 *
 * Tema: Modelos - Estadísticas Mensuales Pilates
 *
 */

import db from "../DataBase/db.js";
import { DataTypes } from "sequelize";

const PilatesEstadisticasMensuales = db.define(
  "pilates_estadisticas_mensuales",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_sede: { type: DataTypes.INTEGER, allowNull: false },
    anio: { type: DataTypes.INTEGER, allowNull: false },
    mes: { type: DataTypes.INTEGER, allowNull: false },
    cantidad_inicio_mes: { type: DataTypes.INTEGER, defaultValue: 0 },
    cantidad_fin_mes: { type: DataTypes.INTEGER, defaultValue: 0 },
    variacion_porcentual: { type: DataTypes.DECIMAL(5, 2) },
    alumnos_dia_uno_que_siguen: { type: DataTypes.INTEGER, defaultValue: 0 },
    porcentaje_retencion_global: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.0,
    },
    porcentaje_ocupacion_total: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.0,
    },
    // Asistencias del mes (persistidas por sincronizarEstadisticas)
    asistencias_totales_mes: { type: DataTypes.INTEGER, defaultValue: 0 },
    asistencias_presentes_mes: { type: DataTypes.INTEGER, defaultValue: 0 },
    asistencias_ausentes_mes: { type: DataTypes.INTEGER, defaultValue: 0 },
    porcentaje_asistencia_total: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.0,
    },
    porcentaje_ausentismo_total: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.0,
    },
    ltv_promedio_meses: { type: DataTypes.DECIMAL(6, 2), defaultValue: 0.0 },
    ltv_total_bajas: { type: DataTypes.INTEGER, defaultValue: 0 },
    fecha_creacion: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    tableName: "pilates_estadisticas_mensuales",
  },
);

export default PilatesEstadisticasMensuales;
