/*
 * Modelo: MD_TB_QuejasPilates
 * Descripción: Define la estructura de la tabla 'quejas_pilates' para Sequelize.
 * Creado por: Sergio Gustavo Manrique (basado en la solicitud)
 * Fecha: 15/11/2025
 * MODIFICACIÓN: Eliminado campo 'cliente_pilates_id' (11/20/2025)
 */

import { DataTypes } from 'sequelize';
import db from '../DataBase/db.js'; // Ajusta la ruta si es necesario

const QuejasPilatesModel = db.define('quejas_pilates', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // fecha: { campo dropeado por Benjamin Orellana
  //   type: DataTypes.DATE,
  //   defaultValue: DataTypes.NOW
  // },
  cargado_por: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  tipo_usuario: {
    type: DataTypes.ENUM('cliente', 'instructor'),
    allowNull: false,
    defaultValue: 'cliente'
  },
  contacto: {
    type: DataTypes.STRING(30),
    allowNull: true
  },
  motivo: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  resuelto: {
    type: DataTypes.TINYINT,
    defaultValue: 0
  },
  resuelto_por: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  fecha_resuelto: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sede: {
    type: DataTypes.STRING(50),
    allowNull: false
  }
}, {
  tableName: 'quejas_pilates',
  timestamps: true, // Sequelize manejará created_at y updated_at
  updatedAt: 'updated_at',
  createdAt: 'created_at'
});

export default QuejasPilatesModel;