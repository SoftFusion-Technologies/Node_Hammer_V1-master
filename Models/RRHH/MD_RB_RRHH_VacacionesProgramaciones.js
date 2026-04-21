import db from '../../DataBase/db.js';
import { DataTypes } from 'sequelize';

const RRHH_VacacionesProgramadas = db.define(
  'rrhh_vacaciones_programadas',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    usuario_emp_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },

    usuario_adm_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },

    sede_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    fecha_desde: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },

    fecha_hasta: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: true
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    timestamps: false, // igual que tu modelo actual
    tableName: 'rrhh_vacaciones_programadas'
  }
);

export default RRHH_VacacionesProgramadas;