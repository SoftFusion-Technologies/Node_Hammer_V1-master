import { DataTypes } from 'sequelize';
import db from '../DataBase/db.js';

const ClientesPilatesHistorialDetalleModel = db.define(
  'clientes_pilates_historial_detalle',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    historial_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    campo: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    valor_anterior: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    valor_nuevo: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    tableName: 'clientes_pilates_historial_detalle',
    timestamps: false
  }
);

export default ClientesPilatesHistorialDetalleModel;
