/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 14/06/2025
 * Versión: 1.1
 * Descripción: Modelo Sequelize para la tabla 'recaptacion'
 */

import { DataTypes } from 'sequelize';
import db from '../DataBase/db.js';

export const RecaptacionModel = db.define(
  'recaptacion',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW // MySQL: curdate()
    },
    usuario_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    nombre: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    tipo_contacto: {
      type: DataTypes.ENUM(
        'Socios que no asisten',
        'Inactivo 10 dias',
        'Inactivo 30 dias',
        'Inactivo 60 dias',
        'Prospectos inc. Socioplus',
        'Prosp inc Entrenadores',
        'Leads no convertidos',
        'Otro',
        'Cambio de plan'
      ),
      allowNull: true,
      defaultValue: null
    },
    // 🔹 NUEVO
    canal_contacto: {
      type: DataTypes.TEXT, // WhatsApp, Llamada, IG, Meta Ads, etc.
      allowNull: true,
      defaultValue: null
    },

    // 🔹 ACTUALIZADO (antes STRING(255))
    detalle_contacto: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null
    },
    enviado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    respondido: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    agendado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    convertido: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },

    // 🔹 mapeo de columnas generadas por MySQL (STORED)
    mes: {
      type: DataTypes.INTEGER,
      allowNull: true // la DB lo calcula desde 'fecha'
    },
    anio: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  },
  {
    tableName: 'recaptacion',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    freezeTableName: true
  }
);

export default { RecaptacionModel };
