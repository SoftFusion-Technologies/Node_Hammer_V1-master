/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 21 / 12 / 2025
 * Versión: 1.1
 *
 * Descripción:
 * Modelo Sequelize para la tabla 'convenios_planes_disponibles'.
 * Permite definir múltiples planes por convenio (mensual/trimestral/anual, etc.)
 * y opcionalmente segmentarlos por sede (sede_id).
 *
 * Tema: Modelos - ConveniosPlanesDisponibles
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const ConveniosPlanesDisponiblesModel = db.define(
  'convenios_planes_disponibles',
  {
    convenio_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },

    // FK a sedes.id (INT). Puede ser NULL si aún hay datos legacy o si la sede
    // se definirá luego. Si ya lo querés obligatorio, pasalo a allowNull: false.
    sede_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    nombre_plan: {
      type: DataTypes.STRING(60),
      allowNull: false
    },

    // Duración del plan en días (30/90/180/365). Puede ser NULL si no aplica.
    duracion_dias: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1
      }
    },

    // Precio de lista del plan (monto real numérico).
    precio_lista: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },

    // DECIMAL(18,2) y puede ser NULL si no hay descuento.
    descuento_valor: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
      validate: {
        min: 0
      }
    },

    // Precio final del plan (opcional). Si viene NULL, se puede calcular en backend.
    precio_final: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
      validate: {
        min: 0
      }
    },

    activo: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    }
  },
  {
    timestamps: false
  }
);

export default {
  ConveniosPlanesDisponiblesModel
};
