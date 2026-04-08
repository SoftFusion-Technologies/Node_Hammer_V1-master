/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 06 / 03 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * * Almacena los descriptores faciales (JSON) generados por el sistema de IA.
 * * Utilizado para la validación biométrica en el proceso de marcación de asistencia.
 * Tema: Modelos - RRHH Credenciales Faciales
 * * Capa: Backend 
 */
import dotenv from 'dotenv';
import db from '../../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// 1. CAMBIO AQUI: Definición del modelo para la tabla rrhh_credenciales_faciales
const RRHHCredencialesFacialesModel = db.define(
  'rrhh_credenciales_faciales',
  {
    // 2. CAMBIO AQUI: Se define id_credencial como llave primaria autoincrementable
    id_credencial: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    id_usuario: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    descriptor_facial: {
      type: DataTypes.JSON,
      allowNull: false
    },
    fecha_registro: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    fecha_modificacion: {
      type: DataTypes.DATE,
      allowNull: true
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  },
  {
    timestamps: false // Se mantiene falso ya que manejamos los campos manualmente en el SQL
  }
);

export default RRHHCredencialesFacialesModel;