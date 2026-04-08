/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 08 / 04 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * * Define la relación entre los usuarios y las sedes físicas de trabajo.
 * * Gestiona la vigencia de la vinculación, el estado activo y la modalidad remota.
 * Tema: Modelos - RRHH Usuario Sede
 * * Capa: Backend 
 */
import db from '../../DataBase/db.js';
import { DataTypes } from "sequelize";

const RRHH_UsuarioSede = db.define('rrhh_usuario_sede', { 
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  usuario_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false
  },
  sede_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  fecha_desde: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  fecha_hasta: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  activo: {
    type: DataTypes.TINYINT,
    defaultValue: 1
  },
  remoto: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0
  },

  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  eliminado: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  }
}, {
  tableName: 'rrhh_usuario_sede',
  timestamps: false
});

export default RRHH_UsuarioSede;