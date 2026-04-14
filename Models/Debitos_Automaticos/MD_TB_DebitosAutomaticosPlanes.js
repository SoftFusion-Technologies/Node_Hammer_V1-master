/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 12 / 03 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_DebitosAutomaticosPlanes.js) contiene la definición
 * del modelo Sequelize para la tabla debitos_automaticos_planes.
 *
 * Tema: Modelos - Débitos Automáticos Planes
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

// Define el modelo para la tabla 'debitos_automaticos_planes' en la base de datos
const DebitosAutomaticosPlanesModel = db.define(
  'debitos_automaticos_planes',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    codigo: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true
    },
    nombre: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true
    },
    descripcion: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    activo: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1
    },
    orden_visual: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    // Benjamin Orellana - 08/04/2026 - Se amplía la precisión monetaria del plan y se agregan descuento y precio final para soportar cálculo comercial completo
    precio_referencia: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },
    descuento: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0.0
    },
    precio_final: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
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
    tableName: 'debitos_automaticos_planes',
    freezeTableName: true,
    timestamps: false
  }
);

export default DebitosAutomaticosPlanesModel;
