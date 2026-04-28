/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 08 / 04 / 2026
 * Versión: 1.1
 *
 * Descripción:
 * * Cabecera de los hilos de comunicación entre empleados y el departamento de RRHH.
 * * Controla los estados de lectura, la última actividad del canal de comunicación
 * * y la trazabilidad del cierre de la conversación.
 * Tema: Modelos - RRHH Conversaciones
 * * Capa: Backend
 */

import db from "../../DataBase/db.js";
import { DataTypes } from "sequelize";

const RRHHConversacionesModel = db.define(
  "rrhh_conversaciones",
  {
    usuario_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    sede_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    asunto: {
      type: DataTypes.ENUM(
        "aclaracion",
        "hora_extra",
        "olvido_ingreso",
        "olvido_salida",
        "inconveniente_acceso",
        "consulta",
        "tu_cobro",
        "otras_consultas",
      ),
      defaultValue: "aclaracion",
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM("abierta", "cerrada"),
      defaultValue: "abierta",
      allowNull: false,
    },
    cerrado_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    cerrado_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ultima_fecha_mensaje: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ultimo_mensaje: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    tiene_no_leidos_rrhh: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
      allowNull: false,
    },
    tiene_no_leidos_usuario: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
      allowNull: false,
    },
    eliminado: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
      allowNull: false,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default RRHHConversacionesModel;
