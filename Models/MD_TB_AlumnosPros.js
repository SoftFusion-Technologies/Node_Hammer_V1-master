import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export const AlumnosProspectoModel = db.define(
  'alumnos_prospecto',
  {
    nombre: { type: DataTypes.STRING, allowNull: true },
    prospecto: {
      type: DataTypes.ENUM('prospecto', 'socio'),
      allowNull: false,
      defaultValue: 'prospecto'
    },
    c: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    email: { type: DataTypes.STRING, allowNull: true },
    celular: { type: DataTypes.STRING, allowNull: true },
    punto_d: { type: DataTypes.TEXT, allowNull: true },
    motivo: { type: DataTypes.TEXT, allowNull: true },
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },
    fecha_creacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    timestamps: false
  }
);

export default { AlumnosProspectoModel };
