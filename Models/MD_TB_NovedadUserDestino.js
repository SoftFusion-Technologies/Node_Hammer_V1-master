/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 17 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (MD_TB_NovedadUserDestino.js) contiene la definición de modelos Sequelize para las tablas de la base de datos. 
   
  * Tema: Modelos - NovedadUserDestino
  
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


const NovedadUserDestinoModel = db.define(
  'novedad_users_destino',
  {
    novedad_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    }
  },
  {
        timestamps: false, // Esto evita que Sequelize añada automáticamente los campos createdAt y updatedAt
        createdAt: 'created_at', // Nombre personalizado para el campo de fecha de creación
        updatedAt: 'updated_at' // Nombre personalizado para el campo de fecha de actualización
  }
);

export default {
  NovedadUserDestinoModel
};
