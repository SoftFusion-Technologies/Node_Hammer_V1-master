/*
 * Programador: Matias Pallero
 * Fecha Cración: 20 / 10 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_VentasRemarketing.js) es el modelo de la tabla de ventas de remarketing.
 *
 * Tema: Modelos - Ventas Remarketing
 * Capa: Backend
 *
 */

import dotenv from "dotenv"; // Importa el módulo dotenv para cargar variables de entorno desde un archivo .env
import db from "../DataBase/db.js"; // Importa la conexión a la base de datos
import { DataTypes } from "sequelize"; // Importa el módulo DataTypes de Sequelize para definir tipos de datos

dotenv.config(); // Carga las variables de entorno

const VentasRemarketingModel = db.define(
  "ventas_remarketing",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    ventas_prospecto_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true, // Cambiado a true según la tabla
      references: {
        model: "ventas_prospectos",
        key: "id",
      },
    },
    recaptacion_id: {
      // Corregido el nombre del campo
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true, // Cambiado a true según la tabla
    },
    usuario_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    sede: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    nombre_socio: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    dni: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    canal_contacto: {
      type: DataTypes.ENUM(
        "Mostrador",
        "Whatsapp",
        "Instagram",
        "Facebook",
        "Google",
        "Llamada",
        "Otro",
        "Pagina web",      
        "Campaña",       
        "Comentarios/Stickers",
        "Baja Pilates"
      ),
      allowNull: false,
    },
    contacto: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    actividad: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    tipo_prospecto: {
      type: DataTypes.ENUM("Nuevo", "ExSocio"),
      allowNull: false,
      defaultValue: "Nuevo",
    },
    contactado: {
      type: DataTypes.TINYINT(1),
      allowNull: false,
      defaultValue: 0,
    },
    visitas: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    observacion: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    n_contacto_1: {
    type: DataTypes.TINYINT(1),
    allowNull: true, // O false con defaultValue: 0
    defaultValue: 0,
   },
   n_contacto_2: {
    type: DataTypes.TINYINT(1),
    allowNull: true,
    defaultValue: 0,
   },
   n_contacto_3: {
    type: DataTypes.TINYINT(1),
    allowNull: true,
    defaultValue: 0,
   },
    enviado: {
      type: DataTypes.TINYINT(1),
      allowNull: false,
      defaultValue: 0,
    },
    enviado_by_user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    enviado_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    respondido: {
      type: DataTypes.TINYINT(1),
      allowNull: false,
      defaultValue: 0,
    },
    respondido_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    agendado: {
      type: DataTypes.TINYINT(1),
      allowNull: false,
      defaultValue: 0,
    },
    agendado_for_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    agendado_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    convertido: {
      type: DataTypes.TINYINT(1),
      allowNull: false,
      defaultValue: 0,
    },
    convertido_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clase_prueba_1_fecha: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clase_prueba_1_tipo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    clase_prueba_1_obs: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    clase_prueba_2_fecha: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clase_prueba_2_tipo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    clase_prueba_2_obs: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    clase_prueba_3_fecha: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clase_prueba_3_tipo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    clase_prueba_3_obs: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    comision_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: "ventas_comisiones_remarketing",
        key: "id",
      },
    },
    comision_estado: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    comision_registrada_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    comision_usuario_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    mes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    anio: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "ventas_remarketing",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
});

export default VentasRemarketingModel;
