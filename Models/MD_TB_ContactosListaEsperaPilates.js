/*
 * Descripción:
 * Este archivo contiene la definición del modelo Sequelize para la tabla contactos_lista_espera_pilates.
 * Registra cada intento de contacto con una persona en la lista de espera.
 */

import db from "../DataBase/db.js"; // Asegúrate que la ruta a tu DB sea correcta
import { DataTypes } from "sequelize";

export const ContactosListaEsperaPilatesModel = db.define(
  "contactos_lista_espera_pilates",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // Llave foránea que apunta a la tabla lista_espera_pilates
    id_lista_espera: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "lista_espera_pilates",
        key: "id",
      },
    },
    // Llave foránea que apunta a la tabla users
    id_usuario_contacto: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    fecha_contacto: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW, // Asigna la fecha y hora actual por defecto
    },
    estado_contacto: {
      type: DataTypes.ENUM(
        "Confirmado",
        "Rechazado/Sin Respuesta",
        "Pendiente"
      ),
      allowNull: false,
    },
    notas: {
      type: DataTypes.STRING(255),
      allowNull: true, // Este campo es opcional
    },
  },
  {
    timestamps: false, 
    tableName: "contactos_lista_espera_pilates", // Nombre exacto de la tabla
  }
);


ContactosListaEsperaPilatesModel.associate = (models) => { // <-- Renombrado a 'models'
  ContactosListaEsperaPilatesModel.belongsTo(models.lista_espera_pilates, {
    foreignKey: "id_lista_espera",
    as: "persona_espera",
  });
  ContactosListaEsperaPilatesModel.belongsTo(models.users, {
    foreignKey: "id_usuario_contacto",
    as: "usuario_autor",
  });
};

export default ContactosListaEsperaPilatesModel;