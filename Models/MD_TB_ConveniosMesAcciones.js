/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 25 / 12 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_ConveniosMesAcciones.js) contiene la definición del modelo Sequelize
 * para la tabla `convenios_mes_acciones`, que registra acciones mensuales por convenio
 * (p.ej. FINALIZAR_CARGA, ENVIAR_LISTADO), junto con estado de lectura y auditoría.
 *
 * Tema: Modelos - ConveniosMesAcciones
 *
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const ConveniosMesAccionesModel = db.define(
  'convenios_mes_acciones',
  {
    // FK a adm_convenios.id
    convenio_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },

    // Inicio de mes: YYYY-MM-01 00:00:00
    monthStart: {
      type: DataTypes.DATE,
      allowNull: false
    },

    // Acción registrada
    tipo: {
      type: DataTypes.ENUM('FINALIZAR_CARGA', 'ENVIAR_LISTADO', 'CHAT_MENSAJE'),
      allowNull: false
    },

    descripcion: {
      type: DataTypes.STRING(255),
      allowNull: true
    },

    // Auditoría de creación (quién presionó)
    creado_por_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    creado_por_nombre: {
      type: DataTypes.STRING(120),
      allowNull: true
    },

    // Lectura (para dashboard)
    leido: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0
    },
    leido_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    leido_por_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    leido_por_nombre: {
      type: DataTypes.STRING(120),
      allowNull: true
    },

    // Metadata flexible (JSON)
    meta_json: {
      type: DataTypes.JSON,
      allowNull: true
    }
  },
  {
    tableName: 'convenios_mes_acciones',
    // La tabla tiene created_at / updated_at (snake_case)
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
);

export default {
  ConveniosMesAccionesModel
};
