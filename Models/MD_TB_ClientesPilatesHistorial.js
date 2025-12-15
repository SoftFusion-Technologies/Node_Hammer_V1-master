import { DataTypes } from 'sequelize';
import db from '../DataBase/db.js';

const ClientesPilatesHistorialModel = db.define(
  'clientes_pilates_historial',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    cliente_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    tipo_evento: {
      type: DataTypes.ENUM(
        'ALTA',
        'CAMBIO_PLAN',
        'MODIFICACION',
        'BAJA',
        'CAMBIO_TURNO'
      ),
      allowNull: false
    },
    fecha_evento: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    usuario_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true
    },
    es_instructor: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0
    },
    resumen: {
      type: DataTypes.STRING(255),
      allowNull: false
    }
  },
  {
    tableName: 'clientes_pilates_historial',
    timestamps: false
  }
);

export default ClientesPilatesHistorialModel;
