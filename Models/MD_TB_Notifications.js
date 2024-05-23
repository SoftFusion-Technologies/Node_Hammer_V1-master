/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (MD_TB_Notifications.js) contiene la definición de modelos Sequelize para las tablas de la base de datos. 
   
  * Tema: Modelos - Notifications
  
  * Capa: Backend 
*/
// Importa la configuración de la base de datos y los tipos de datos necesarios
import dotenv from 'dotenv'; // Importa el módulo dotenv para cargar variables de entorno desde un archivo .env
import db from '../DataBase/db.js'; // Importa la conexión a la base de datos
import { DataTypes } from 'sequelize'; // Importa el módulo DataTypes de Sequelize para definir tipos de datos

// Si no estás en producción, carga las variables de entorno desde el archivo .env
if (process.env.NODE_ENV !== 'production') {
  dotenv.config(); // Carga las variables de entorno desde el archivo .env
}

// Define el modelo para la tabla 'notifications' en la base de datos, tabla 4

export const NotificationsModel = db.define(
  'notifications', // Nombre de la tabla en la base de datos
  {
    // Define los campos y sus tipos de datos correspondientes
    type: {
      type: DataTypes.STRING,
      allowNull: false
    }, 
    notifiable_type: {
      type: DataTypes.STRING,
      allowNull: false
    }, 
    notifiable_id: {
      type: DataTypes.BIGINT
    }, 
    data: {
      type: DataTypes.STRING,
      allowNull: false
    }, 
    read_at: {
      type: DataTypes.TIME
    }
  },
  {
    timestamps: true, // Habilita la creación automática de los campos createdAt y updatedAt en la tabla
    createdAt: 'created_at', // Nombre personalizado para el campo de fecha de creación
    updatedAt: 'updated_at' // Nombre personalizado para el campo de fecha de actualización
  }
);

export default {
  NotificationsModel
};
