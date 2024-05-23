/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 17 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (MD_TB_NovedadUser.js) contiene la definición de modelos Sequelize para las tablas de la base de datos. 
   
  * Tema: Modelos - NovedadUser
  
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

const NovedadUserModel = db.define('novedad_user', {
  novedad_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  }
}, {
  timestamps: false // Esto evita que Sequelize añada automáticamente los campos createdAt y updatedAt
});

// Define la asociación entre NovedadesUserModel y NovedadesModel
// NovedadesUserModel.belongsTo(NovedadesModel, { foreignKey: 'novedad_id' }); // Un novedad_user pertenece a una novedad

export default {
  NovedadUserModel
};
