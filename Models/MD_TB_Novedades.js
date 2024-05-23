/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 17 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (MD_TB_Novedades.js) contiene la definición de modelos Sequelize para las tablas de la base de datos. 
   
  * Tema: Modelos - Novedades
  
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

// Define el modelo para la tabla 'novedades' en la base de datos, tabla 5
const NovedadesModel = db.define(
  'novedades',
  {
    sede: {
      type: DataTypes.STRING,
      allowNull: false
    },
    titulo: {
      type: DataTypes.STRING
    },
    mensaje: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    user: {
      type: DataTypes.BIGINT.UNSIGNED
    },
    vencimiento: {
      type: DataTypes.DATE
    },
    estado: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1
    }
  },
  {
    timestamps: false // Esto evita que Sequelize añada automáticamente los campos createdAt y updatedAt
  }
);

export default {
  NovedadesModel
};
