import { DataTypes } from "sequelize";
import db from "../DataBase/db.js";
import { SedeModel } from "./MD_TB_sedes.js";

const UsuarioPilates = db.define("usuarios_pilates", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  apellido: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  telefono: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(120),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  estado: {
    type: DataTypes.ENUM("activo", "inactivo"),
    defaultValue: "activo"
  },
  rol: {
    type: DataTypes.ENUM("Administrador", "Vendedor", "Instructor", "Recepcionista"),
    allowNull: false
  },
  sede_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 2
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: "usuarios_pilates",
  timestamps: false
});

// Relación: Un usuario pertenece a una sede
UsuarioPilates.belongsTo(SedeModel, { foreignKey: "sede_id", as: "sede" });

export default UsuarioPilates;