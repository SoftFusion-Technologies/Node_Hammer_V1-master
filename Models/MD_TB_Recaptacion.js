/*
  * Programador: Benjamin Orellana
  * Fecha Creación: 14 / 06 / 2025
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (MD_TB_recaptacion.js) contiene la definición del modelo Sequelize para la tabla de recaptación de contactos.
   
  * Tema: Modelos - Recaptación
  
  * Capa: Backend 
*/

// Importaciones
import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Definición del modelo de la tabla 'recaptacion'
export const RecaptacionModel = db.define(
  'recaptacion',
  {
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    usuario_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    nombre: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    tipo_contacto: {
      type: DataTypes.ENUM(
        'Socios que no asisten',
        'Inactivo 10 dias',
        'Inactivo 30 dias',
        'Inactivo 60 dias',
        'Prospectos inc. Socioplus',
        'Prosp inc Entrenadores',
        'Leads no convertidos'
      ),
      allowNull: false
    },
    enviado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    respondido: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    agendado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    convertido: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    mes: {
      type: DataTypes.VIRTUAL,
      get() {
        const fecha = this.getDataValue('fecha');
        return fecha ? new Date(fecha).getMonth() + 1 : null;
      }
    },
    anio: {
      type: DataTypes.VIRTUAL,
      get() {
        const fecha = this.getDataValue('fecha');
        return fecha ? new Date(fecha).getFullYear() : null;
      }
    }
  },
  {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
);


export default {
  RecaptacionModel
};
