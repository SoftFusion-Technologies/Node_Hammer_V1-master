/*
 * Programador: Sergio Manrique
 * Fecha Creación: 30/01/2026
 * Versión: 1.0
 *
 * Descripción:
 * Modelo Sequelize para estadísticas mensuales de planes de Pilates,
 * con cantidades iniciales/finales y variación porcentual.
 *
 * Tema: Modelos - Estadísticas Planes Pilates
 *
 */

import db from "../DataBase/db.js";
import { DataTypes } from "sequelize";

const PilatesEstadisticasPlanes = db.define(
  "pilates_estadisticas_planes",
  {
    id_sede: { type: DataTypes.INTEGER, allowNull: false },
    anio: { type: DataTypes.INTEGER, allowNull: false },
    mes: { type: DataTypes.INTEGER, allowNull: false },
    nombre_plan: { type: DataTypes.STRING, allowNull: false }, 
    cantidad_inicial: { type: DataTypes.INTEGER, defaultValue: 0 },
    cantidad_final: { type: DataTypes.INTEGER, defaultValue: 0 },
    variacion_porcentual: { type: DataTypes.DECIMAL(5, 2) },
    fecha_creacion: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    tableName: "pilates_estadisticas_planes",
  },
);

export default PilatesEstadisticasPlanes;
