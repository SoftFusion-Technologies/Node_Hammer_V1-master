/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 30 / 03 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Modelo Sequelize para auditoría de emails enviados desde el módulo
 * de Débitos Automáticos.
 *
 * Tema: Débitos Automáticos - Envíos Email
 * Capa: Backend
 */

import { DataTypes } from 'sequelize';
import db from '../../DataBase/db.js';

export const DebitosAutomaticosEnviosEmailModel = db.define(
  'debitos_automaticos_envios_email',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    solicitud_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    solicitud_adicional_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true
    },
    destinatario_tipo: {
      type: DataTypes.ENUM('TITULAR', 'ADICIONAL', 'INTERNO'),
      allowNull: false
    },
    email_destino: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    evento: {
      type: DataTypes.ENUM(
        'SOLICITUD_RECIBIDA',
        'SOLICITUD_APROBADA',
        'SOLICITUD_OBSERVADA',
        'SOLICITUD_RECHAZADA',
        'SOLICITUD_CANCELADA'
      ),
      allowNull: false,
      defaultValue: 'SOLICITUD_RECIBIDA'
    },
    estado: {
      type: DataTypes.ENUM('PENDIENTE', 'ENVIADO', 'ERROR'),
      allowNull: false,
      defaultValue: 'PENDIENTE'
    },
    asunto: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    error_texto: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    intentos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    message_id: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    enviado_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'debitos_automaticos_envios_email',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
);

export default {
  DebitosAutomaticosEnviosEmailModel
};
