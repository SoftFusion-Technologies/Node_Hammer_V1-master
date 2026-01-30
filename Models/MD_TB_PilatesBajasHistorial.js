/*
 * Programador: Sergio Manrique
 * Fecha Creación: 30/01/2026
 * Versión: 1.0
 *
 * Descripción:
 * Modelo Sequelize para el historial de bajas de Pilates, con datos del
 * cliente, sede, motivo y estado al momento de la baja.
 *
 * Tema: Modelos - Bajas Pilates
 *
 */

import db from "../DataBase/db.js";
import { DataTypes } from "sequelize";

const PilatesBajasHistorial = db.define(
  "pilates_bajas_historial",
  {
    nombre_cliente: { type: DataTypes.STRING, allowNull: false },
    telefono: { type: DataTypes.STRING },
    id_sede: { type: DataTypes.INTEGER, allowNull: false },
    fecha_alta_original: { type: DataTypes.DATEONLY },
    fecha_baja: { type: DataTypes.DATEONLY, allowNull: false },
    cantidad_renovaciones: { type: DataTypes.INTEGER, defaultValue: 0 },
    meses_entrenados: { type: DataTypes.INTEGER, defaultValue: 0 },
    motivo: { type: DataTypes.STRING },
    id_usuario_gestion: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    fecha_creacion: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    contactado_remarketing: { type: DataTypes.BOOLEAN, defaultValue: false },
    recuperado: { type: DataTypes.BOOLEAN, defaultValue: false },
    estado: { 
      type: DataTypes.ENUM('Plan', 'Clase de prueba', 'Renovacion programada'),
      allowNull: true 
    },
  },
  {
    timestamps: false,
    tableName: "pilates_bajas_historial",
  },
);

export default PilatesBajasHistorial;
