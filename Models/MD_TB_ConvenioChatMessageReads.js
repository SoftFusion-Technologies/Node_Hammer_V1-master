/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 28 / 12 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_ConvenioChatMessageReads.js) contiene la definición del modelo Sequelize
 * para la tabla `convenio_chat_message_reads`, que registra la lectura de mensajes por usuario
 * del gimnasio (users). Sirve para calcular no-leídos/badges de forma normalizada.
 *
 * Tema: Modelos - ConvenioChatMessageReads
 *
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const ConvenioChatMessageReadsModel = db.define(
  'convenio_chat_message_reads',
  {
    // FK a convenio_chat_messages.id
    message_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },

    // FK a users.id (BIGINT UNSIGNED)
    reader_user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },

    // Fecha/hora de lectura (la tabla lo maneja con DEFAULT CURRENT_TIMESTAMP)
    read_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'convenio_chat_message_reads',
    // Esta tabla NO tiene created_at / updated_at
    timestamps: false
  }
);

export default {
  ConvenioChatMessageReadsModel
};
