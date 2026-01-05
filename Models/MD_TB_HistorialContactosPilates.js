import { DataTypes } from "sequelize";
import db from "../DataBase/db.js";

const HistorialContactosPilatesModel = db.define(
  "historial_contactos_pilates",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id_cliente: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    id_usuario: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true, 
    },
    fecha_contacto: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    contacto_realizado: {
      type: DataTypes.STRING(45), 
      allowNull: true,
    },
    esperando_respuesta: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    }
  },
  {
    tableName: "historial_contactos_pilates",
    timestamps: false,
  }
);

export default HistorialContactosPilatesModel;
