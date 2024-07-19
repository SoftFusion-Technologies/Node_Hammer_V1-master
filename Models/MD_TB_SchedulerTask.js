import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';
import UsersModel from './MD_TB_Users.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const SchedulerTaskModel = db.define('schedulertask', {
  titulo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  hora: {
    type: DataTypes.TIME,
    allowNull: false
  },
  dias: {
    type: DataTypes.STRING,
    allowNull: true
  },
  user_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    references: {
      model: UsersModel,
      key: 'id'
    }
  },
  state: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: false
});

SchedulerTaskModel.belongsTo(UsersModel, { foreignKey: 'user_id', as: 'user' });
UsersModel.hasMany(SchedulerTaskModel, { foreignKey: 'user_id', as: 'schedulertasks' });

export default SchedulerTaskModel;
