/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 4 mayo 2025
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (MD_TB_NotificationsUsers.js) contiene la definición del modelo Sequelize para la tabla 'notifications_users' del sistema.
 *
 * Tema: Modelos - Notificaciones de Usuarios
 *
 * Capa: Backend
 */

// Importa la configuración de la base de datos y los tipos de datos necesarios
import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

// Carga variables de entorno si no está en producción
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Define el modelo para la tabla 'notifications_users'
const NotificationUserModel = db.define(
  'notifications_users',
  {
    notification_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'notifications', // Nombre de la tabla referenciada
        key: 'id'
      }
    },
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users', // Nombre de la tabla referenciada
        key: 'id'
      }
    },
    leido: {
      type: DataTypes.TINYINT,
      defaultValue: 0 // 0 = No leído, 1 = Leído
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  },
  {
    timestamps: false
  }
);

export default NotificationUserModel;
