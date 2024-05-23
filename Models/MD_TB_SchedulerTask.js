/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 17 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (MD_TB_SchedulerTask.js) contiene la definición de modelos Sequelize para las tablas de la base de datos. 
   
  * Tema: Modelos - SchedulerTask
  
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

// Define el modelo para la tabla 'table_schedulertask' en la base de datos
const SchedulerTaskModel = db.define(
  'table_schedulertask',
  {
    titulo: {
      type: DataTypes.STRING,
      allowNull: false
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    hora: {
      type: DataTypes.TIME,
      allowNull: false
    },
    state: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true // Puedes ajustar esto según tus requisitos
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true // Puedes ajustar esto según tus requisitos
    },
    dias: {
      type: DataTypes.STRING,
      allowNull: true // Puedes ajustar esto según tus requisitos
    },
    id_user: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true // Puedes ajustar esto según tus requisitos
    }
  },
  {
    timestamps: false // Esto evita que Sequelize añada automáticamente los campos createdAt y updatedAt
  }
);
export default {
  SchedulerTaskModel
};
