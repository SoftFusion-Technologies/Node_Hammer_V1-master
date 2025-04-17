/*
  * Programador: Benjamin Orellana
  * Fecha Creación:  17 de Abril 2025
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (MD_TB_sedes.js) contiene la definición del modelo Sequelize para la tabla 'sedes' en la base de datos.
   
  * Tema: Modelos - sedes
  
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

// Define el modelo para la tabla 'sedes' en la base de datos
export const SedeModel = db.define(
  'sedes', // Nombre de la tabla en la base de datos
  {
    // Define los campos y sus tipos de datos correspondientes
    nombre: {
      type: DataTypes.STRING,
      allowNull: false, // No se permite nulo
      unique: true // No se permiten nombres duplicados
    },
    estado: {
      type: DataTypes.STRING,
      allowNull: false, // No se permite nulo
      defaultValue: 'activo' // Estado por defecto es 'activo'
    }
  },
  {
    timestamps: true, // Habilita la creación automática de los campos createdAt y updatedAt en la tabla
    createdAt: 'created_at', // Nombre personalizado para el campo de fecha de creación
    updatedAt: 'updated_at' // Nombre personalizado para el campo de fecha de actualización
  }
);

export default {
  SedeModel
};
