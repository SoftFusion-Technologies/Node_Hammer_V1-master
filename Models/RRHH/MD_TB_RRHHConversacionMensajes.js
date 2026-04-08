/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 08 / 04 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * * Detalle de mensajes, aclaraciones y respuestas dentro de una conversación.
 * * Gestiona la trazabilidad de resolución de incidencias (resuelto por, fecha y observación).
 * Tema: Modelos - RRHH Conversacion Mensajes
 * * Capa: Backend 
 */

import db from '../../DataBase/db.js';
import { DataTypes } from "sequelize";

const RRHHConversacionMensajesModel = db.define(
  "rrhh_conversacion_mensajes",
  {
    conversacion_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    emisor_user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    destinatario_tipo: {
      type: DataTypes.ENUM("rrhh", "usuario"),
      allowNull: false,
    },
    tipo_mensaje: {
      type: DataTypes.ENUM(
        "aclaracion",
        "hora_extra",
        "olvido_ingreso",
        "olvido_salida",
        "inconveniente_acceso",
        "consulta",
        "respuesta_rrhh",
        "sistema",
      ),
      defaultValue: "aclaracion",
      allowNull: false,
    },
    mensaje: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    fecha_referencia: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    marcacion_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    leido: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
      allowNull: false,
    },
    leido_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    resuelto: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
      allowNull: false,
    },
    resuelto_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    resuelto_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    observacion_resolucion: {
      type: DataTypes.STRING(255),
      allowNull: true,
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

export default RRHHConversacionMensajesModel;
