/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 30 abril 2025
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (MD_TB_QuejasInternas.js) contiene la definición del modelo Sequelize para la tabla de la base de datos.
 *
 * Tema: Modelos - Quejas Internas
 *
 * Capa: Backend
 */

// Importa la configuración de la base de datos y los tipos de datos necesarios
import dotenv from 'dotenv'; // Importa dotenv para variables de entorno
import db from '../DataBase/db.js'; // Conexión a la base de datos
import { DataTypes } from 'sequelize'; // Tipos de datos de Sequelize

// Carga variables de entorno si no está en producción
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Define el modelo para la tabla 'quejas_internas' en la base de datos
const QuejasInternasModel = db.define(
  'quejas_internas',
  {
    fecha: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    cargado_por: {
      type: DataTypes.STRING,
      allowNull: false
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tipo_usuario: {
      type: DataTypes.ENUM('socio', 'colaborador', 'cliente'),
      allowNull: false
    },
    contacto: {
      type: DataTypes.STRING,
      allowNull: true
    },
    motivo: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    resuelto: {
      type: DataTypes.TINYINT,
      defaultValue: 0
    },
    resuelto_por: {
      type: DataTypes.STRING,
      allowNull: true
    },
    fecha_resuelto: {
      type: DataTypes.DATE,
      allowNull: true
    },
    sede: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'monteros'
    },
    creado_desde_qr: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  },
  {
    timestamps: false // Ya se manejan los campos created_at y updated_at manualmente
  }
);

export default {
  QuejasInternasModel
};
