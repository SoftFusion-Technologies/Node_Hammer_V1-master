/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 14 sep 2024
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (MD_TB_NovedadesArchivos.js) contiene la definición del modelo Sequelize para la tabla novedad_archivos en la base de datos.
 *
 * Tema: Modelos - NovedadesArchivos
 *
 * Capa: Backend
 */

// Importa la configuración de la base de datos y los tipos de datos necesarios
import dotenv from 'dotenv'; // Importa dotenv para cargar variables de entorno
import db from '../DataBase/db.js'; // Importa la conexión a la base de datos
import { DataTypes } from 'sequelize'; // Importa el módulo DataTypes de Sequelize para definir tipos de datos
import NovedadModel from './MD_TB_Novedades.js'; // Importa el modelo de la tabla novedades

// Si no estás en producción, carga las variables de entorno desde el archivo .env
if (process.env.NODE_ENV !== 'production') {
  dotenv.config(); // Carga las variables de entorno
}

// Define el modelo para la tabla 'novedad_archivos' en la base de datos
const NovedadesArchivos = db.define(
  'novedad_archivos', // Nombre de la tabla
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED, // Clave primaria autoincremental
      autoIncrement: true,
      primaryKey: true
    },
    novedad_id: {
      type: DataTypes.BIGINT.UNSIGNED, // Relación con la tabla novedades
      allowNull: false,
      references: {
        model: NovedadModel, // Referencia al modelo de Novedades
        key: 'id'
      },
      onDelete: 'CASCADE' // Elimina los archivos si la novedad es eliminada
    },
    nombre_archivo: {
      type: DataTypes.STRING(255), // Nombre del archivo
      allowNull: false
    },
    ruta_archivo: {
      type: DataTypes.STRING(255), // Ruta donde se almacenará el archivo
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE, // Fecha de creación
      defaultValue: DataTypes.NOW // Valor por defecto: fecha actual
    }
  },
  {
    tableName: 'novedad_archivos', // Nombre de la tabla en la base de datos
    timestamps: false // Si no necesitas updated_at, desactiva timestamps
  }
);

// Exporta el modelo
export default {
  NovedadesArchivos
};
