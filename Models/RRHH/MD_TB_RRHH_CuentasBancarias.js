/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 08 / 04 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * * Almacena la información bancaria de los empleados (CBU, Alias, Banco).
 * * Permite identificar la cuenta principal para el procesamiento automático de pagos.
 * Tema: Modelos - RRHH Cuentas Bancarias
 * * Capa: Backend 
 */
import db from '../../DataBase/db.js';
import { DataTypes } from 'sequelize';

const RRHHCuentasBancariasModel = db.define(
  'rrhh_cuentas_bancarias',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    usuario_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    banco: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    cbu: {
      type: DataTypes.STRING(22),
      allowNull: false
    },
    alias: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    titular_nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    titular_apellido: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    titular_dni: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    es_principal: {
      type: DataTypes.TINYINT,
      defaultValue: 1
    },
    activa: {
      type: DataTypes.TINYINT,
      defaultValue: 1
    },
    fecha_vigencia_desde: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    fecha_vigencia_hasta: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    eliminado: {
      type: DataTypes.TINYINT,
      defaultValue: 0
    }
  },
  {
    timestamps: false
  }
);

export default RRHHCuentasBancariasModel;