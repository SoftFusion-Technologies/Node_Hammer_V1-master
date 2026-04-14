/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 12 / 03 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_DebitosAutomaticosBancos.js) contiene la definición
 * del modelo Sequelize para la tabla debitos_automaticos_bancos.
 *
 * Tema: Modelos - Débitos Automáticos Bancos
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

// Define el modelo para la tabla 'debitos_automaticos_bancos' en la base de datos
const DebitosAutomaticosBancosModel = db.define(
  'debitos_automaticos_bancos',
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
    activo: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1
    },
    descuento_off_pct: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 25.0,
      validate: {
        min: 0,
        max: 100
      }
    },
    reintegro_pct: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
      validate: {
        min: 0,
        max: 100
      }
    },
    reintegro_desde_mes: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: true
    },
    reintegro_duracion_meses: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: true
    },
    beneficio_permanente: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1
    },
    descripcion_publica: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '25% off (permanente)'
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
    tableName: 'debitos_automaticos_bancos',
    freezeTableName: true,
    timestamps: false
  }
);

export default DebitosAutomaticosBancosModel;
