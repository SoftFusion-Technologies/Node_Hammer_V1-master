/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 12 / 03 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_DebitosAutomaticosPeriodos.js) contiene la definición
 * del modelo Sequelize para la tabla debitos_automaticos_periodos.
 *
 * Tema: Modelos - Débitos Automáticos Períodos
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

// Define el modelo para la tabla 'debitos_automaticos_periodos' en la base de datos
const DebitosAutomaticosPeriodosModel = db.define(
  'debitos_automaticos_periodos',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    cliente_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },

    periodo_anio: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false
    },
    periodo_mes: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false
    },

    estado_envio: {
      type: DataTypes.ENUM('PENDIENTE', 'ENVIADO', 'NO_ENVIADO'),
      allowNull: false,
      defaultValue: 'PENDIENTE'
    },
    estado_cobro: {
      type: DataTypes.ENUM(
        'PENDIENTE',
        'COBRADO',
        'RECHAZADO',
        'PAGO_MANUAL',
        'BAJA'
      ),
      allowNull: false,
      defaultValue: 'PENDIENTE'
    },

    accion_requerida: {
      type: DataTypes.ENUM(
        'NINGUNA',
        'CAMBIO_TARJETA',
        'COBRO_MANUAL',
        'BAJA',
        'REINTENTO'
      ),
      allowNull: false,
      defaultValue: 'NINGUNA'
    },

    motivo_codigo: {
      type: DataTypes.ENUM(
        'MAL_NUMERO_TARJETA',
        'TIPO_TARJETA_ERRONEO',
        'TARJETA_DEBITO',
        'SIN_MARGEN',
        'INHABILITADA',
        'OTRO'
      ),
      allowNull: true
    },

    motivo_detalle: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    // Benjamin Orellana - 10/04/2026 - Snapshot comercial del cliente aplicado al período: monto inicial y descuento porcentual
    monto_inicial_cliente_aplicado: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },
    descuento_cliente_pct_aplicado: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0
    },
    monto_bruto: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },
    descuento_off_pct_aplicado: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0
    },
    reintegro_pct_aplicado: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0
    },
    monto_neto_estimado: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },

    fecha_envio: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    fecha_resultado: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },

    archivo_banco_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true
    },

    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    creado_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true
    },
    updated_by: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true
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
    tableName: 'debitos_automaticos_periodos',
    freezeTableName: true,
    timestamps: false
  }
);

export default DebitosAutomaticosPeriodosModel;
