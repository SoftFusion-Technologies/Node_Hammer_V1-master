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
  'test_classes',
  {
    name: { type: DataTypes.STRING, allowNull: false },
    last_name: { type: DataTypes.STRING, allowNull: false },
    dni: { type: DataTypes.STRING, allowNull: false },
    celular: { type: DataTypes.STRING, allowNull: false },
    sede: { type: DataTypes.STRING, allowNull: false },
    objetivo: { type: DataTypes.STRING, allowNull: false },
    user: { type: DataTypes.STRING },
    observaciones: { type: DataTypes.STRING },
    state: { type: DataTypes.STRING, allowNull: false },

    // CAMPOS NUEVOS PARA INTEGRACIÓN CON VENTAS
    movido_a_ventas: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    usuario_movido_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    fecha_movido: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
);

export default {
  TestClassModel
};
