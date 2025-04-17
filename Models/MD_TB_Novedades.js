/* Programador: Benjamin Orellana
  * Fecha Cración: 17 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (MD_TB_Novedades.js) contiene la definición de modelos Sequelize para las tablas de la base de datos. 
   
  * Tema: Modelos - Novedades
  
  * Capa: Backend 
*/
// Importa la configuración de la base de datos y los tipos de datos necesarios
// Importa la configuración de la base de datos y los tipos de datos necesarios
import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const NovedadesModel = db.define(
  'novedades',
  {
    sede: { type: DataTypes.STRING, allowNull: false },
    titulo: { type: DataTypes.STRING },
    mensaje: { type: DataTypes.TEXT, allowNull: false },
    vencimiento: { type: DataTypes.DATE },
    estado: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
    userName: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  },
  { timestamps: false }
);

export default NovedadesModel;
