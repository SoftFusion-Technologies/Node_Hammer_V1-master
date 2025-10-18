/* Programador: Benjamin Orellana
 * Fecha Creación: 07/10/2025
 * Versión: 1.0
 *
 * Descripción:
 *  Definición del modelo Sequelize para la tabla `hx_clientes`.
 *  Nomenclatura simple y clara, con índices y timestamps mapeados a snake_case.
 *
 * Tema: Modelos - HammerX (Clientes)
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const HxClienteModel = db.define(
  'hx_clientes',
  {
    id: {
      type: DataTypes.BIGINT, // UNSIGNED en DB; Sequelize no lo requiere explícito
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    dni: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true
    },

    sexo: {
      type: DataTypes.ENUM('M', 'F', 'X'),
      allowNull: true
    },
    fecha_nacimiento: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    altura_m: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: true
    }
    // NOTA: no declares created_at / updated_at aquí: Sequelize los maneja con timestamps+underscored
  },
  {
    tableName: 'hx_clientes',
    freezeTableName: true,
    timestamps: true, // crea/actualiza createdAt/updatedAt
    underscored: true, // mapea a created_at / updated_at en la DB
    indexes: [{ name: 'idx_nombre', fields: ['nombre'] }]
  }
);

export default HxClienteModel;
