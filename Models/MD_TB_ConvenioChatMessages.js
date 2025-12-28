/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 28 / 12 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_ConvenioChatMessages.js) contiene la definición del modelo Sequelize
 * para la tabla `convenio_chat_messages`, que almacena el historial de mensajes del chat
 * entre Gimnasio y Convenio, incluyendo contexto mensual (monthStart), emisor, auditoría,
 * edición y soft-delete.
 *
 * Tema: Modelos - ConvenioChatMessages
 *
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const ConvenioChatMessagesModel = db.define(
  'convenio_chat_messages',
  {
    // FK a convenio_chat_threads.id
    thread_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },

    // Inicio de mes: YYYY-MM-01 00:00:00
    monthStart: {
      type: DataTypes.DATE,
      allowNull: false
    },

    // Quién envía el mensaje
    sender_tipo: {
      type: DataTypes.ENUM('CONVENIO', 'GIMNASIO'),
      allowNull: false
    },

    // Para mensajes del gimnasio: FK a users.id (BIGINT UNSIGNED)
    sender_user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true
    },

    // Snapshot del nombre visible (convenio: ingresado; gimnasio: users.name)
    sender_nombre: {
      type: DataTypes.STRING(120),
      allowNull: false
    },

    // Contenido del mensaje
    mensaje: {
      type: DataTypes.TEXT,
      allowNull: false
    },

    // Edición
    edited_at: {
      type: DataTypes.DATE,
      allowNull: true
    },

    // Soft delete + auditoría
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deleted_by_user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true
    },
    delete_reason: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  },
  {
    tableName: 'convenio_chat_messages',
    // La tabla tiene created_at / updated_at (snake_case)
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
);

export default {
  ConvenioChatMessagesModel
};
