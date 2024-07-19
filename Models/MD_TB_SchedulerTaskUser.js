import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';
import SchedulerTaskModel from './MD_TB_SchedulerTask.js';
import UsersModel from './MD_TB_Users.js';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const SchedulerTaskUserModel = db.define('schedulertask_user', {
  schedulertask_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    references: {
      model: SchedulerTaskModel,
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

SchedulerTaskUserModel.belongsTo(SchedulerTaskModel, { foreignKey: 'schedulertask_id', as: 'schedulertask' });
SchedulerTaskModel.hasMany(SchedulerTaskUserModel, { foreignKey: 'schedulertask_id', as: 'taskUsers' });

SchedulerTaskUserModel.belongsTo(UsersModel, { foreignKey: 'user_id', as: 'user' });
UsersModel.hasMany(SchedulerTaskUserModel, { foreignKey: 'user_id', as: 'taskUsers' });

export default SchedulerTaskUserModel;