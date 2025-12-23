/*
 * Programador: [Tu nombre]
 * Fecha Creación: [Fecha actual]
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_ClientesPilates.js) contiene la definición del modelo Sequelize para la tabla clientes_pilates.
 *
 * Tema: Modelos - Clientes Pilates
 *
 * Capa: Backend
 */

import dotenv from "dotenv";
import db from "../DataBase/db.js";
import { DataTypes } from "sequelize";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

export const ClientesPilatesModel = db.define(
  "clientes_pilates",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    telefono: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    fecha_prometido_pago: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    estado: {
      type: DataTypes.ENUM("Plan", "Clase de prueba", "Renovacion programada"),
      allowNull: false,
    },
    fecha_inicio: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    fecha_fin: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    observaciones: {
      type: DataTypes.STRING(255),
      allowNull: true,
    }
  },
  {
    timestamps: false,
    tableName: "clientes_pilates",
  }
);

export default ClientesPilatesModel;
