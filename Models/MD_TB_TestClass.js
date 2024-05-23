/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 17 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (MD_TB_test_classes.js) contiene la definición de modelos Sequelize para las tablas de la base de datos. 
   
  * Tema: Modelos - test_classes
  
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

// Define el modelo para la tabla 'test_classes' en la base de datos
export const TestClassModel = db.define(
  'test_classes', // Nombre de la tabla en la base de datos
  {
    // Define los campos y sus tipos de datos correspondientes
    name: { type: DataTypes.STRING, allowNull: false }, // Nombre de la clase de prueba (no nulo)
    last_name: { type: DataTypes.STRING, allowNull: false }, // Apellido de la clase de prueba (no nulo)
    dni: { type: DataTypes.STRING, allowNull: false }, // Número de documento de identidad de la clase de prueba (no nulo)
    celular: { type: DataTypes.STRING, allowNull: false }, // Número de teléfono celular de la clase de prueba (no nulo)
    sede: { type: DataTypes.STRING, allowNull: false }, // Sede de la empresa para la clase de prueba (no nulo)
    objetivo: { type: DataTypes.STRING, allowNull: false }, // Objetivo de la clase de prueba (no nulo)
    user: { type: DataTypes.STRING }, // Usuario asociado a la clase de prueba
    observaciones: { type: DataTypes.STRING }, // Observaciones sobre la clase de prueba
    state: { type: DataTypes.STRING, allowNull: false } // Estado de la clase de prueba (no nulo)
  },
  {
    timestamps: true, // Habilita la creación automática de los campos createdAt y updatedAt en la tabla
    createdAt: 'created_at', // Nombre personalizado para el campo de fecha de creación
    updatedAt: 'updated_at' // Nombre personalizado para el campo de fecha de actualización
  }
);


export default {
  TestClassModel
};
