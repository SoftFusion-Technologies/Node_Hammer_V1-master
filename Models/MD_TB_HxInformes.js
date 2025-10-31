/* Programador: Benjamin Orellana
 * Fecha Creación: 07/10/2025
 * Versión: 1.0
 *
 * Descripción:
 *  Modelo Sequelize para la tabla `hx_informes` (informes de composición corporal).
 *  Incluye índices y mapeo de timestamps snake_case.
 *
 * Tema: Modelos - HammerX (Informes)
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const HxInformeModel = db.define(
  'hx_informes',
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },

    // FK
    cliente_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      // Opcional: referencia (no crea FK en DB por sí solo, pero documenta la relación)
      references: { model: 'hx_clientes', key: 'id' }
    },

    // Core
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },

    // Contexto del día
    edad_anios: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: true
    },
    altura_m: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: true
    },

    // Resultados principales
    peso_kg: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    imc: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    imc_categoria: {
      type: DataTypes.ENUM('Bajo', 'Normal', 'Alto'),
      allowNull: true
    },

    grasa_pct: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    grasa_kg: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    grasa_visceral: { type: DataTypes.DECIMAL(5, 2), allowNull: true }, // si tu equipo da entero, luego migrar a TINYINT
    masa_muscular_esqueletica_kg: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true
    },
    masa_libre_grasa_kg: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    masa_osea_kg: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    calcio_kg: { type: DataTypes.DECIMAL(6, 3), allowNull: true },
    agua_total_kg: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    proteinas_kg: { type: DataTypes.DECIMAL(6, 2), allowNull: true },

    metabolismo_basal_kcal: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: true
    },
    gasto_energetico_total_kcal: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: true
    },
    edad_metabolica_anios: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: true
    },
    puntaje_fisico_100: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
    ajuste_grasa_kg: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    ajuste_musculo_kg: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    ajuste_peso_kg: { type: DataTypes.DECIMAL(5, 2), allowNull: true },

    // Textos libres
    interpretacion: { type: DataTypes.TEXT, allowNull: true },
    objetivo: { type: DataTypes.TEXT, allowNull: true },
    rec_entrenamiento: { type: DataTypes.TEXT, allowNull: true },
    rec_alimentacion: { type: DataTypes.TEXT, allowNull: true }
  },
  {
    tableName: 'hx_informes',
    freezeTableName: true,
    timestamps: true, // createdAt / updatedAt
    underscored: true, // -> created_at / updated_at
    indexes: [
      { name: 'idx_informes_cliente_fecha', fields: ['cliente_id', 'fecha'] },
      { name: 'idx_informes_fecha', fields: ['fecha'] }
    ]
  }
);

export default HxInformeModel;
