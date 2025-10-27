import { DataTypes } from "sequelize";
import db from "../DataBase/db.js";


const ListaEsperaPilates = db.define(
  "lista_espera_pilates",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    contacto: {
      type: DataTypes.STRING(100),
    },
    tipo: {
      type: DataTypes.ENUM("Espera", "Cambio de turno"),
      allowNull: false,
    },
    plan_interes: {
      type: DataTypes.ENUM("L-M-V", "M-J", "Cualquier dia"),
      allowNull: false,
    },
    horarios_preferidos: {
      type: DataTypes.STRING(255),
    },
    observaciones: {
      type: DataTypes.TEXT,
    },
    fecha_carga: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    id_sede: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    id_usuario_cargado: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
  },
  {
    tableName: "lista_espera_pilates",
    timestamps: false,
  }
);

ListaEsperaPilates.associate = (models) => { // <-- Renombrado a 'models'
  // Un registro de lista de espera puede tener muchos contactos de seguimiento.
  ListaEsperaPilates.hasMany(models.contactos_lista_espera_pilates, {
    foreignKey: "id_lista_espera",
    as: "contacto_cliente",
  });

  // Un registro de lista de espera es cargado por un usuario.
  ListaEsperaPilates.belongsTo(models.UsersModel, { // <-- Asumo que tu modelo de users se llama 'UsersModel'
    foreignKey: "id_usuario_cargado",
    as: "usuario_cargado",
  });
};

export default ListaEsperaPilates;
