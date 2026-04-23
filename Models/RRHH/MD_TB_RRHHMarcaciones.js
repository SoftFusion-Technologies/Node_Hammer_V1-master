/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 24 / 02 / 2026
 * Versión: 1.3
 *
 * Descripción:
 * * Registro central de entradas, salidas y ubicación geográfica del personal.
 * * Gestiona la lógica de minutos tarde, extras autorizadas y el proceso de aprobación.
 * Tema: Modelos - RRHH Marcaciones
 * * Capa: Backend 
 */
import db from '../../DataBase/db.js';
import { DataTypes } from "sequelize";

const RRHHMarcacionesModel = db.define(
  "rrhh_marcaciones",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    usuario_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },

    sede_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    horario_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    hora_entrada: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    hora_salida: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    estado: {
      type: DataTypes.ENUM(
        "pendiente",
        "normal",
        "tarde",
        "extra",
        "ausente",
        "justificado",
      ),
      allowNull: false,
    },

    estado_aprobacion: {
      type: DataTypes.ENUM("pendiente", "aprobada", "rechazada"),
      allowNull: false,
      defaultValue: "pendiente",
    },

    estado_justificacion: {
      type: DataTypes.ENUM("justificado", "injustificado"),
      allowNull: false,
      defaultValue: "injustificado",
    },

    origen: {
      type: DataTypes.ENUM(
        "app",
        "web",
        "lector",
        "manual",
        "facial",
        "automatico",
      ),
      allowNull: false,
      defaultValue: "manual",
    },

    minutos_tarde: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    minutos_extra_pendientes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    minutos_extra_autorizados: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    minutos_extra_no_autorizados: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    minutos_descuento: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    minutos_salida_anticipada: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    latitud: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },

    longitud: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },

    reconocimiento_valido: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
    },

    reemplaza_a: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    eliminado: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
    },

    comentarios: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    aprobado_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },

    fecha_aprobacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    liquidacion_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "rrhh_marcaciones",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default RRHHMarcacionesModel;
