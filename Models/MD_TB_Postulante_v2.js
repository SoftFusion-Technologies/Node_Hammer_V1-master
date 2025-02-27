/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 26 /02 / 2025
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (MD_TB_Postulante_v2.js) contiene la definición de modelos Sequelize para las tablas de la base de datos. 
   
  * Tema: Modelos - Postulantes
  
  * Capa: Backend 
*/


import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const PostulanteV2Model = db.define(
  'postulantes_v2',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    celular: { type: DataTypes.STRING, allowNull: false },
    edad: { type: DataTypes.INTEGER, allowNull: false },
    puesto: { type: DataTypes.STRING, allowNull: false },
    sede: { type: DataTypes.STRING },
    info: { type: DataTypes.STRING(100) },
    redes: { type: DataTypes.STRING, defaultValue: 'instagram' },
    observaciones: { type: DataTypes.STRING, defaultValue: 'sin valoracion' },
    valoracion: { type: DataTypes.INTEGER },
    state: { type: DataTypes.BOOLEAN, defaultValue: true },
    sexo: { type: DataTypes.STRING },
    cv_url: { type: DataTypes.STRING, allowNull: false }
  },
  {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
);

export default {
  PostulanteV2Model
};
