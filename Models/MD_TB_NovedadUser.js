import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';
import NovedadesModel from './MD_TB_Novedades.js';
import UsersModel from './MD_TB_Users.js';

const NovedadUserModel = db.define('novedad_user', {
  novedad_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  leido: {
    type: DataTypes.INTEGER,
    allowNull: false
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
