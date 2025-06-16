/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 15 / 06 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_ventas_prospectos.js) contiene la definición del modelo Sequelize para la tabla de prospectos en el módulo de Ventas.
 *
 * Tema: Modelos - Ventas Prospectos
 *
 * Capa: Backend
 */

// Importaciones
import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Definición del modelo de la tabla 'ventas_prospectos'
export const VentasProspectosModel = db.define(
  'ventas_prospectos',
  {
    usuario_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    dni: {
      type: DataTypes.STRING(20)
    },
    tipo_prospecto: {
      type: DataTypes.ENUM('Nuevo', 'ExSocio'),
      allowNull: false
    },
    canal_contacto: {
      type: DataTypes.ENUM(
        'Mostrador',
        'Whatsapp',
        'Instagram',
        'Facebook',
        'Pagina web',
        'Campaña',
        'Comentarios/Stickers'
      ),
      allowNull: false
    },
    contacto: {
      type: DataTypes.STRING(50)
    },
    actividad: {
      type: DataTypes.ENUM(
        'No especifica',
        'Musculacion',
        'Pilates',
        'Clases grupales',
        'Pase full'
      ),
      allowNull: false
    },
    sede: {
      type: DataTypes.ENUM('monteros', 'concepcion', 'barrio sur'),
      allowNull: false
    },
    fecha: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    asesor_nombre: {
      type: DataTypes.STRING(100)
    },
    n_contacto_1: {
      type: DataTypes.TINYINT,
      defaultValue: 1
    },
    n_contacto_2: {
      type: DataTypes.TINYINT,
      defaultValue: 0
    },
    n_contacto_3: {
      type: DataTypes.TINYINT,
      defaultValue: 0
    },
    clase_prueba_1_fecha: {
      type: DataTypes.DATE,
      allowNull: true
    },
    clase_prueba_1_obs: {
      type: DataTypes.TEXT
    },
    clase_prueba_2_fecha: {
      type: DataTypes.DATE,
      allowNull: true
    },
    clase_prueba_2_obs: {
      type: DataTypes.TEXT
    },
    clase_prueba_3_fecha: {
      type: DataTypes.DATE,
      allowNull: true
    },
    clase_prueba_3_obs: {
      type: DataTypes.TEXT
    },
    convertido: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    mes: {
      type: DataTypes.VIRTUAL,
      get() {
        const fecha = this.getDataValue('fecha');
        return fecha ? new Date(fecha).getMonth() + 1 : null;
      }
    },
    anio: {
      type: DataTypes.VIRTUAL,
      get() {
        const fecha = this.getDataValue('fecha');
        return fecha ? new Date(fecha).getFullYear() : null;
      }
    }
  },
  {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
);

export default {
  VentasProspectosModel
};
