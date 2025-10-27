import { DataTypes } from "sequelize";
import db from "../DataBase/db.js";

const AuditoriaFechaFinModificadaPilatesModel = db.define(
  "auditoria_fecha_fin_modificada_pilates",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cliente_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true, // Corresponde al UNIQUE KEY de la DB
    },
    usuario_id: {
      type: DataTypes.BIGINT.UNSIGNED,
    },
    fecha_modificacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    motivo: {
      type: DataTypes.TEXT,
    },
  },
  {
    tableName: "auditoria_fecha_fin_modificada_pilates",
    timestamps: false,
  }
);

export default AuditoriaFechaFinModificadaPilatesModel;