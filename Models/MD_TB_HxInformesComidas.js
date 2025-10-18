/* Programador: Benjamin Orellana
 * Fecha Creación: 07/10/2025
 * Versión: 1.0
 *
 * Descripción:
 *  Modelo Sequelize para la tabla `hx_informe_comidas`.
 *  Incluye índice único compuesto (informe_id, tipo) y mapeo de timestamps snake_case.
 *
 * Tema: Modelos - HammerX (Informe > Comidas)
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const HxInformeComidaModel = db.define(
  'hx_informe_comidas',
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },

    // FK al informe
    informe_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: 'hx_informes', key: 'id' },
      onDelete: 'CASCADE'
    },

    // Tipo libre (desayuno, almuerzo, etc.) pero puede ser otro valor
    tipo: {
      type: DataTypes.STRING(64),
      allowNull: true // coincide con DDL
    },

    orden: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 1
    },

    // Texto libre con el ejemplo/descrición de la comida
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    tableName: 'hx_informe_comidas',
    freezeTableName: true,
    timestamps: true, // createdAt / updatedAt
    underscored: true, // -> created_at / updated_at
    indexes: [
      { name: 'idx_comidas_informe', fields: ['informe_id'] },
      {
        name: 'uq_informe_tipo_orden',
        unique: true,
        fields: ['informe_id', 'tipo', 'orden']
      }
    ]
  }
);

export default HxInformeComidaModel;
