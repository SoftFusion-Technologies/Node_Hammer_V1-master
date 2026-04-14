/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 12 / 03 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_DebitosAutomaticosTerminos.js) contiene la definición
 * del modelo Sequelize para la tabla debitos_automaticos_terminos.
 *
 * Tema: Modelos - Débitos Automáticos Términos
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

// Define el modelo para la tabla 'debitos_automaticos_terminos' en la base de datos
const DebitosAutomaticosTerminosModel = db.define(
  'debitos_automaticos_terminos',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    version: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true
    },
    titulo: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    contenido_html: {
      type: DataTypes.TEXT('long'),
      allowNull: false
    },
    activo: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1
    },
    publicado_desde: {
      type: DataTypes.DATE,
      allowNull: true
    },
    publicado_hasta: {
      type: DataTypes.DATE,
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
    tableName: 'debitos_automaticos_terminos',
    freezeTableName: true,
    timestamps: false
  }
);

export default DebitosAutomaticosTerminosModel;
