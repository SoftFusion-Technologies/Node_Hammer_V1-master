// MD_TB_ventas_comisiones_vigentes.js
/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 19 / 10 / 2025
 * Versión: 1.0
 * Descripción: Modelo de comisiones vigentes por período (mes) para vendedores.
 */

import db from '../DataBase/db.js';
import { DataTypes, Model } from 'sequelize';

export class VentasComisionesVigentesRemarketingModel extends Model {}

VentasComisionesVigentesRemarketingModel.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },

    // Identificador lógico de la regla de comisión (estable y reutilizable entre meses)
    codigo: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: 'Ej: NUEVO_SEMESTRAL, NUEVO_ANUAL, DEBITO_AUTOMATICO'
    },

    // Título visible
    titulo: {
      type: DataTypes.STRING(160),
      allowNull: false
    },

    // Tipo de valor
    tipo_valor: {
      type: DataTypes.ENUM('PORCENTAJE', 'MONTO_FIJO'),
      allowNull: false
    },

    // Valor numérico (porcentaje o monto)
    valor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },

    // Moneda (solo aplica cuando es MONTO_FIJO)
    moneda: {
      type: DataTypes.STRING(3),
      allowNull: true,
      validate: { len: [3, 3] },
      comment: 'Ej: ARS cuando tipo_valor = MONTO_FIJO'
    },

    // Texto con oferta/recomendación
    detalle_texto: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    // Primer día del mes de vigencia (convención: YYYY-MM-01)
    periodo_inicio: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },

    // Opcional: cierre de vigencia
    periodo_fin: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },

    // Flag rápido
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    sequelize: db,
    modelName: 'ventas_comisiones_vigentes_remarketing',
    tableName: 'ventas_comisiones_vigentes_remarketing',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    indexes: [
      // Único por combinación de mes y código de regla
      {
        name: 'uq_periodo_codigo_remarketing',
        unique: true,
        fields: ['periodo_inicio', 'codigo']
      },
      { name: 'idx_activo_periodo_remarketing', fields: ['activo', 'periodo_inicio'] },
      { name: 'idx_codigo_remarketing', fields: ['codigo'] }
    ],

    defaultScope: {
      order: [
        ['periodo_inicio', 'DESC'],
        ['codigo', 'ASC']
      ]
    },

    scopes: {
      activos: { where: { activo: true } },
      // Registros vigentes del mes de una fecha dada (por defecto hoy)
      mesDe(fechaISO) {
        // fechaISO formato 'YYYY-MM-DD'
        return {
          where: db.where(
            db.fn('DATE_FORMAT', db.col('periodo_inicio'), '%Y-%m-01'),
            '=',
            db.fn(
              'DATE_FORMAT',
              fechaISO ? fechaISO : db.fn('CURDATE'),
              '%Y-%m-01'
            )
          )
        };
      }
    }
  }
);

export default { VentasComisionesVigentesRemarketingModel };
