/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 17 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (MD_TB_PassReset.js) contiene la definición de modelos Sequelize para las tablas de la base de datos. 
   
  * Tema: Modelos - PassReset
  
  * Capa: Backend 
*/

// Importa la configuración de la base de datos y los tipos de datos necesarios
// Importa la configuración de la base de datos y los tipos de datos necesarios
import dotenv from 'dotenv'; // Importa el módulo dotenv para cargar variables de entorno desde un archivo .env
import db from '../DataBase/db.js'; // Importa la conexión a la base de datos
import { DataTypes } from 'sequelize'; // Importa el módulo DataTypes de Sequelize para definir tipos de datos

// Si no estás en producción, carga las variables de entorno desde el archivo .env
if (process.env.NODE_ENV !== 'production') {
  dotenv.config(); // Carga las variables de entorno desde el archivo .env
}


const PassResetModel = db.define(
  'password_resets',
  {
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true // Definir la columna 'email' como clave primaria  
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false
    }
  },
  {
    timestamps: false, // Esto evita que Sequelize añada automáticamente los campos createdAt y updatedAt
    createdAt: 'created_at' // Nombre personalizado para el campo de fecha de creación
  }
);


export default {
  PassResetModel
};
