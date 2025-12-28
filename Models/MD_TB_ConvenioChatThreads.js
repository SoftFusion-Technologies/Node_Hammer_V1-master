/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 28 / 12 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_ConvenioChatThreads.js) contiene la definición del modelo Sequelize
 * para la tabla `convenio_chat_threads`, que representa el hilo de chat (1 por convenio)
 * entre el Gimnasio y el Convenio. Guarda el nombre de contacto del convenio (primera vez),
 * el estado del chat y la fecha del último mensaje.
 *
 * Tema: Modelos - ConvenioChatThreads
 *
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const ConvenioChatThreadsModel = db.define(
  'convenio_chat_threads',
  {
    // FK a adm_convenios.id
    convenio_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },

    // Se completa la primera vez que el convenio inicia el chat
    convenio_nombre_contacto: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    // Estado del hilo
    estado: {
      type: DataTypes.ENUM('ABIERTO', 'CERRADO'),
      allowNull: false,
      defaultValue: 'ABIERTO'
    },

    // Fecha del último mensaje del hilo (para ordenar listados y badges)
    last_message_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    tableName: 'convenio_chat_threads',
    // La tabla tiene created_at / updated_at (snake_case)
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
);

export default {
  ConvenioChatThreadsModel
};
