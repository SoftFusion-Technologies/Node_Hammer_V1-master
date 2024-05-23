/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 17 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (MD_TB_Postulantes.js) contiene la definición de modelos Sequelize para las tablas de la base de datos. 
   
  * Tema: Modelos - Postulantes
  
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

// Define el modelo para la tabla 'postulantes' en la base de datos
export const PostulanteModel = db.define(
  'postulantes', // Nombre de la tabla en la base de datos
  {
    // Define los campos y sus tipos de datos correspondientes
    name: { type: DataTypes.STRING }, // Nombre del postulante
    email: { type: DataTypes.STRING }, // Correo electrónico del postulante
    celular: { type: DataTypes.STRING }, // Número de teléfono celular del postulante
    edad: { type: DataTypes.STRING }, // Edad del postulante
    puesto: { type: DataTypes.STRING }, // Puesto al que postula el candidato
    sede: { type: DataTypes.STRING }, // Sede de la empresa a la que postula el candidato
    info: { type: DataTypes.CHAR(100) }, // Información adicional sobre el postulante (máximo 100 caracteres)
    redes: { type: DataTypes.STRING, defaultValue: 'instagram' }, // Redes sociales del postulante (valor por defecto: 'instagram')
    observaciones: { type: DataTypes.STRING, defaultValue: 'sin valoracion' }, // Observaciones sobre el postulante (valor por defecto: 'sin valoracion')
    valoracion: { type: DataTypes.INTEGER }, // Valoración del postulante (número entero)
    state: { type: DataTypes.BOOLEAN }, // Estado del postulante (booleano)
    sexo: { type: DataTypes.STRING } // Se agrega nuevo campo Sexo
  },
  {
    timestamps: true, // Habilita la creación automática de los campos createdAt y updatedAt en la tabla
    createdAt: 'created_at', // Nombre personalizado para el campo de fecha de creación
    updatedAt: 'updated_at' // Nombre personalizado para el campo de fecha de actualización
  }
);

export default {
  PostulanteModel
};
