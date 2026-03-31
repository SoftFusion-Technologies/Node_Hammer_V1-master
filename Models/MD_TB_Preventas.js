/*
  * Programador: Sergio Gustavo Manrique
  * Fecha Creación: 25 de Marzo 2026
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (MD_TB_Preventas.js) contiene la definición del modelo Sequelize para la tabla 'preventas'.
   
  * Tema: Modelos - Preventas
  
  * Capa: Backend 
*/

import db from "../DataBase/db.js";
import { DataTypes } from "sequelize";

export const PreventaModel = db.define(
  "preventas",
  {
    id_sede: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    nombre_apellido: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dni: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fecha_nacimiento: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    correo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    domicilio: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    celular: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    plan_seleccionado: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    duracion_plan: {
      type: DataTypes.ENUM("SEMESTRAL", "ANUAL"),
      allowNull: false,
    },

    modalidad_pago: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    monto_pactado: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    metodo_inscripcion: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    comprobante_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    turno_seleccionado: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    estado_contacto: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pendiente",
    },
    id_usuario_contacto: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    fecha_contacto: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default PreventaModel;
