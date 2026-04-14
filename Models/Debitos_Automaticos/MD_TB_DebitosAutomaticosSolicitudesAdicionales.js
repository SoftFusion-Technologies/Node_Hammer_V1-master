/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 12 / 03 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_DebitosAutomaticosSolicitudesAdicionales.js) contiene la definición
 * del modelo Sequelize para la tabla debitos_automaticos_solicitudes_adicionales.
 *
 * Tema: Modelos - Débitos Automáticos Solicitudes Adicionales
 *
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../../DataBase/db.js';
import { DataTypes } from 'sequelize';

// Si no estás en producción, carga las variables de entorno desde el archivo .env
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Define el modelo para la tabla 'debitos_automaticos_solicitudes_adicionales' en la base de datos
const DebitosAutomaticosSolicitudesAdicionalesModel = db.define(
  'debitos_automaticos_solicitudes_adicionales',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    solicitud_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      unique: true
    },
    nombre: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    dni: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: true,
        isEmail: true
      }
    },
    telefono: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    plan_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'debitos_automaticos_solicitudes_adicionales',
    freezeTableName: true,
    timestamps: false
  }
);

export default DebitosAutomaticosSolicitudesAdicionalesModel;
