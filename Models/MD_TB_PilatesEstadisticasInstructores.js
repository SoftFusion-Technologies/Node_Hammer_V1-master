/*
 * Programador: Sergio Manrique
 * Fecha Creación: 30/01/2026
 * Versión: 1.0
 *
 * Descripción:
 * Modelo Sequelize para estadísticas mensuales por instructor de Pilates,
 * incluyendo retención, asistencia y conversión de pruebas.
 *
 * Tema: Modelos - Estadísticas Instructores Pilates
 *
 */

import db from "../DataBase/db.js";
import { DataTypes } from "sequelize";

const PilatesEstadisticasInstructores = db.define(
  "pilates_estadisticas_instructores",
  {
    usuario_id: { type: DataTypes.INTEGER, allowNull: false },
    id_sede: { type: DataTypes.INTEGER, allowNull: false },
    anio: { type: DataTypes.INTEGER, allowNull: false },
    mes: { type: DataTypes.INTEGER, allowNull: false },
    alumnos_iniciales: { type: DataTypes.INTEGER, defaultValue: 0 },
    alumnos_actuales: { type: DataTypes.INTEGER, defaultValue: 0 },
    alumnos_perdidos: { type: DataTypes.INTEGER, defaultValue: 0 },
    alumnos_nuevos: { type: DataTypes.INTEGER, defaultValue: 0 },
    porcentaje_retencion_profe: { type: DataTypes.DECIMAL(5, 2) },
    porcentaje_asistencia_clases: { type: DataTypes.DECIMAL(5, 2) },
    pruebas_asignadas: { type: DataTypes.INTEGER, defaultValue: 0 },
    pruebas_convertidas: { type: DataTypes.INTEGER, defaultValue: 0 },
    porcentaje_conversion: { type: DataTypes.DECIMAL(5, 2) },
    fecha_creacion: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    tableName: "pilates_estadisticas_instructores",
  },
);

export default PilatesEstadisticasInstructores;
