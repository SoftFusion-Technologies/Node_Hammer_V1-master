/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 17 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (MD_TB_NovedadUser.js) contiene la definición de modelos Sequelize para las tablas de la base de datos. 
   
  * Tema: Modelos - NovedadUser
  
  * Capa: Backend 
*/

// Importa la configuración de la base de datos y los tipos de datos necesarios
// Importa la configuración de la base de datos y los tipos de datos necesarios
import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';
import NovedadesModel from './MD_TB_Novedades.js';
import UsersModel from './MD_TB_Users.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const NovedadUserModel = db.define('novedad_user', {
  novedad_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    references: {
      model: NovedadesModel,
      key: 'id'
    }
  },
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    references: {
      model: UsersModel,
      key: 'id'
    }
  }
}, {
  timestamps: false
});

// Definir asociaciones
NovedadesModel.hasMany(NovedadUserModel, { foreignKey: 'novedad_id', as: 'novedadUsers' });
NovedadUserModel.belongsTo(NovedadesModel, { foreignKey: 'novedad_id' });

NovedadUserModel.belongsTo(UsersModel, { foreignKey: 'user_id', as: 'user' });
UsersModel.hasMany(NovedadUserModel, { foreignKey: 'user_id', as: 'novedadUsers' });

export default NovedadUserModel;
