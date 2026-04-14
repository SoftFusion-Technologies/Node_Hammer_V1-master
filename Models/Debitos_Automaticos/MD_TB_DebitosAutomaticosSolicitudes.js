/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 12 / 03 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_DebitosAutomaticosSolicitudes.js) contiene la definición
 * del modelo Sequelize para la tabla debitos_automaticos_solicitudes.
 *
 * Tema: Modelos - Débitos Automáticos Solicitudes
 *
 * Capa: Backend
 */

import dotenv from 'dotenv';
import db from '../../DataBase/db.js';
import { DataTypes } from 'sequelize';

// Si no estás en producción, carga las variables de entorno desde el archivo .env
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Define el modelo para la tabla 'debitos_automaticos_solicitudes' en la base de datos
const DebitosAutomaticosSolicitudesModel = db.define(
  'debitos_automaticos_solicitudes',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true
    },
    canal_origen: {
      type: DataTypes.ENUM('PUBLICO', 'INTERNO'),
      allowNull: false,
      defaultValue: 'PUBLICO'
    },
    rol_carga_origen: {
      type: DataTypes.ENUM(
        'CLIENTE',
        'RECEPCION',
        'VENDEDOR',
        'COORDINADOR',
        'ADMIN'
      ),
      allowNull: false,
      defaultValue: 'CLIENTE'
    },
    usuario_carga_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true
    },
    /* Benjamin Orellana - 07/04/2026 - Se agrega sede_id al modelo de solicitudes para persistir la sede elegida desde el inicio del flujo */
    sede_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'sedes',
        key: 'id'
      }
    },
    estado: {
      type: DataTypes.ENUM(
        'PENDIENTE',
        'APROBADA',
        'RECHAZADA',
        'OBSERVADA',
        'CANCELADA'
      ),
      allowNull: false,
      defaultValue: 'PENDIENTE'
    },

    titular_nombre: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    titular_dni: {
      type: DataTypes.STRING(20),
      allowNull: false
    },

    titular_email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: true,
        isEmail: true
      }
    },
    titular_telefono: {
      type: DataTypes.STRING(30),
      allowNull: true
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

    /* Benjamin Orellana - 2026/04/13 - Snapshot legal del término vigente aceptado al momento de crear la solicitud */
    termino_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true
    },
    termino_version: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    termino_titulo: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    termino_html_snapshot: {
      type: DataTypes.TEXT('long'),
      allowNull: true
    },

    terminos_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },
    terminos_aceptados: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1
    },
    terminos_aceptados_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    terminos_ip: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    terminos_user_agent: {
      type: DataTypes.STRING(500),
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

    observaciones_cliente: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    observaciones_internas: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    revisado_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true
    },
    revisado_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    motivo_rechazo: {
      type: DataTypes.STRING(500),
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
    tableName: 'debitos_automaticos_solicitudes',
    freezeTableName: true,
    timestamps: false
  }
);

export default DebitosAutomaticosSolicitudesModel;
