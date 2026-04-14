/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 12 / 03 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_DebitosAutomaticosClientesAdicionales.js) contiene la definición
 * del modelo Sequelize para la tabla debitos_automaticos_clientes_adicionales.
 *
 * Tema: Modelos - Débitos Automáticos Clientes Adicionales
 *
 * Capa: Backend
 */

// Importa la configuración de la base de datos y los tipos de datos necesarios
import dotenv from 'dotenv';
import db from '../../DataBase/db.js';
import { DataTypes } from 'sequelize';

// Si no estás en producción, carga las variables de entorno desde el archivo .env
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Define el modelo para la tabla 'debitos_automaticos_clientes_adicionales' en la base de datos
const DebitosAutomaticosClientesAdicionalesModel = db.define(
  'debitos_automaticos_clientes_adicionales',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    cliente_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      unique: true
    },
    nombre: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    dni: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    plan_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    tableName: 'debitos_automaticos_clientes_adicionales',
    freezeTableName: true,
    timestamps: false
  }
);

export default DebitosAutomaticosClientesAdicionalesModel;
