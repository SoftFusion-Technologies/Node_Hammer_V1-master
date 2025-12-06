/*
 * Descripción: Modelo Sequelize para la tabla 'horarios_deshabilitados_pilates'.
 * Permite gestionar qué horarios están deshabilitados visualmente en la grilla.
 * Tema: Modelos - Horarios Ocultos
 * Capa: Backend
 * Fecha: 2025-12-03
 * Autor: Sergio Manrique
 */

import { DataTypes } from 'sequelize';
import db from '../DataBase/db.js';
import UsersModel from './MD_TB_Users.js';
import { SedeModel } from './MD_TB_sedes.js';

export const HorariosDeshabilitadosPilatesModel = db.define(
  'horarios_deshabilitados_pilates',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    sede_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'sedes',
        key: 'id'
      }
    },
    hora_label: {
      type: DataTypes.STRING(5), // Ej: "08:00"
      allowNull: false
    },
    creado_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    creado_en: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'horarios_deshabilitados_pilates',
    timestamps: false // Usamos 'creado_en' manualmente o por default
  }
);

// --- Asociaciones ---

// Para saber quién lo ocultó
HorariosDeshabilitadosPilatesModel.belongsTo(UsersModel, {
  foreignKey: 'creado_por',
  as: 'usuario'
});

// Para relacionarlo con la sede (opcional, pero buena práctica)
HorariosDeshabilitadosPilatesModel.belongsTo(SedeModel, {
  foreignKey: 'sede_id',
  as: 'sede'
});

export default HorariosDeshabilitadosPilatesModel;