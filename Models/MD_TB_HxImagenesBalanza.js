/* Programador: Benjamin Orellana
 * Fecha Creación: 11/10/2025
 * Versión: 1.0
 *
 * Descripción:
 *  Definición del modelo Sequelize para la tabla `hx_imagenes_balanza`.
 *  Soporta subidas en lote (2..4 imágenes) mediante batch_id + orden,
 *  metadatos de archivo, vínculo opcional a cliente/informe y storage local/cloud.
 *
 * Tema: Modelos - HammerX (Imágenes de balanza)
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../DataBase/db.js';
import { DataTypes } from 'sequelize';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const HxImagenBalanzaModel = db.define(
  'hx_imagenes_balanza',
  {
    id: {
      type: DataTypes.BIGINT, // UNSIGNED en DB
      primaryKey: true,
      autoIncrement: true
    },

    // vínculos (opcionales)
    cliente_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    informe_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },

    // agrupación del lote
    batch_id: {
      type: DataTypes.STRING(36), // UUID textual
      allowNull: false,
      comment: 'Identificador del lote (drag&drop).'
    },
    orden: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      validate: {
        min: 1,
        max: 4
      },
      comment: 'Posición dentro del lote (1..4).'
    },

    // metadatos de captura/archivo
    fecha_captura: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    filename_original: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    size_bytes: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    width_px: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: true
    },
    height_px: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: true
    },
    sha256_hex: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: 'Hash para deduplicar subidas.'
    },

    // almacenamiento
    storage_path: {
      type: DataTypes.STRING(512),
      allowNull: true,
      comment: 'Ruta local o key del bucket.'
    },
    storage_url: {
      type: DataTypes.STRING(1024),
      allowNull: true,
      comment: 'URL pública o pre-firmada (si aplica).'
    },

    // notas libres
    notas: {
      type: DataTypes.TEXT,
      allowNull: true
    }

    // NOTA: no declares created_at / updated_at aquí: Sequelize los maneja con timestamps + underscored
  },
  {
    tableName: 'hx_imagenes_balanza',
    freezeTableName: true,
    timestamps: true, // createdAt / updatedAt
    underscored: true, // mapea a created_at / updated_at
    indexes: [
      // búsquedas frecuentes
      { name: 'idx_informe', fields: ['informe_id'] },
      { name: 'idx_cliente', fields: ['cliente_id'] },
      { name: 'idx_fecha', fields: ['fecha_captura'] },
      { name: 'idx_sha256', fields: ['sha256_hex'] },
      // único por lote+orden
      { name: 'uq_batch_orden', unique: true, fields: ['batch_id', 'orden'] }
    ]
  }
);

export default HxImagenBalanzaModel;
