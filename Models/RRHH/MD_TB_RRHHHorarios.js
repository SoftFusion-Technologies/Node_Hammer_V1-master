/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 08 / 04 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * * Definición de los turnos fijos asignados por día de la semana para cada empleado.
 * * Base de comparación para el cálculo automático de tardanzas y horas extra.
 * Tema: Modelos - RRHH Horarios
 * * Capa: Backend 
 */
import db from '../../DataBase/db.js';
import { DataTypes } from 'sequelize';

const RRHHHorariosModel = db.define(
  'rrhh_horarios',
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
    sede_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    dia_semana: {
      type: DataTypes.TINYINT,
      allowNull: false
    },
    hora_entrada: {
      type: DataTypes.TIME,
      allowNull: false
    },
    hora_salida: {
      type: DataTypes.TIME,
      allowNull: false
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

export default RRHHHorariosModel;