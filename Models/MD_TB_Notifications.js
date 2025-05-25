/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 3 mayo 2025
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (MD_TB_Notifications.js) contiene la definición del modelo Sequelize para la tabla de notificaciones del sistema.
 *
 * Tema: Modelos - Notificaciones
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

// Define el modelo para la tabla 'notifications'
const NotificationModel = db.define(
  'notifications',
  {
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    module: {
      type: DataTypes.STRING,
      allowNull: false // Ej: 'quejas', 'novedades'
    },
    reference_id: {
      type: DataTypes.INTEGER,
      allowNull: true // ID de la queja o novedad relacionada
    },
    seen_by: {
      type: DataTypes.JSON, // Cambiado a JSON para permitir arrays u objetos
      allowNull: true,
      defaultValue: [] // Usamos un array vacío como valor predeterminado
    },
    created_by: {
      type: DataTypes.STRING,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
    // is_read: {
    //   type: DataTypes.BOOLEAN,
    //   defaultValue: false
    // }
  },
  {
    timestamps: false
  }
);

export default NotificationModel;
