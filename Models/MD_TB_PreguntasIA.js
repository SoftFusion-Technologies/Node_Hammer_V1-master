/*
  * Programador: Benjamin Orellana
  * Fecha Creación: 06 / 08 / 2025
  * Versión: 1.0
  *
  * Descripción:
    * Este archivo (MD_TB_PreguntasIA.js) contiene la definición del modelo Sequelize para la tabla preguntas_ia.
    * Se utiliza para registrar las preguntas realizadas a la IA y sus respectivas respuestas.
   
  * Tema: Modelos - Preguntas IA
  
  * Capa: Backend 
*/

// Importa la configuración de la base de datos y los tipos de datos necesarios
import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

// Carga variables de entorno si no estás en producción
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Define el modelo para la tabla 'preguntas_ia'
export const PreguntaIAModel = db.define(
  'preguntas_ia', // Nombre de la tabla
  {
    pregunta: { type: DataTypes.TEXT, allowNull: false }, // Pregunta realizada por el usuario
    respuesta: { type: DataTypes.TEXT, allowNull: false }, // Respuesta generada por la IA
    user_id: { type: DataTypes.INTEGER, allowNull: true }, // ID del usuario que preguntó (opcional)
    fuente: {
      type: DataTypes.ENUM('openai', 'manual'),
      defaultValue: 'openai'
    }, // Origen de la respuesta
    contexto: { type: DataTypes.TEXT, allowNull: true } // Información contextual (opcional)
  },
  {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false // No necesitamos updatedAt en este caso
  }
);
export default PreguntaIAModel;
