/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 12 / 03 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_DebitosAutomaticosClientes.js) contiene la definición
 * del modelo Sequelize para la tabla debitos_automaticos_clientes.
 *
 * Tema: Modelos - Débitos Automáticos Clientes
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

// Define el modelo para la tabla 'debitos_automaticos_clientes' en la base de datos
const DebitosAutomaticosClientesModel = db.define(
  'debitos_automaticos_clientes',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    solicitud_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      unique: true
    },
    estado_general: {
      type: DataTypes.ENUM(
        'PENDIENTE_INICIO',
        'ACTIVO',
        'PAUSADO',
        'BAJA',
        'BLOQUEADO'
      ),
      allowNull: false,
      defaultValue: 'PENDIENTE_INICIO'
    },

    sede_id: {
      type: DataTypes.BIGINT.UNSIGNED,
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

    fecha_aprobacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    fecha_inicio_cobro: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    fecha_baja: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },

    titular_nombre: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    titular_dni: {
      type: DataTypes.STRING(20),
      allowNull: false
    },

    banco_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    marca_tarjeta: {
      type: DataTypes.ENUM('VISA', 'MASTER'),
      allowNull: false
    },
    confirmo_tarjeta_credito: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0
    },

    tarjeta_numero_cifrado: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    tarjeta_ultimos4: {
      type: DataTypes.CHAR(4),
      allowNull: true
    },
    tarjeta_mascara: {
      type: DataTypes.STRING(30),
      allowNull: true
    },

    modalidad_adhesion: {
      type: DataTypes.ENUM('TITULAR_SOLO', 'AMBOS', 'SOLO_ADICIONAL'),
      allowNull: false,
      defaultValue: 'TITULAR_SOLO'
    },
    titular_plan_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true
    },

    beneficio_descripcion_snapshot: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    beneficio_descuento_off_pct_snapshot: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0
    },
    beneficio_reintegro_pct_snapshot: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0
    },
    beneficio_reintegro_desde_mes_snapshot: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: true
    },
    beneficio_reintegro_duracion_meses_snapshot: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: true
    },

    // Benjamin Orellana - 08/04/2026 - monto_base_vigente pasa a representar el monto final vigente del cliente con precisión monetaria ampliada
    monto_base_vigente: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },

    // Benjamin Orellana - 08/04/2026 - Se agregan monto inicial y descuento vigente como snapshot comercial del cliente
    monto_inicial_vigente: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true
    },
    descuento_vigente: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0.0
    },

    // Benjamin Orellana - 08/04/2026 - Campo manual para promociones o condiciones especiales particulares del cliente
    especial: {
      type: DataTypes.STRING(255),
      allowNull: true
    },

    moneda: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'ARS'
    },

    observaciones_internas: {
      type: DataTypes.TEXT,
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
    tableName: 'debitos_automaticos_clientes',
    freezeTableName: true,
    timestamps: false
  }
);

export default DebitosAutomaticosClientesModel;
