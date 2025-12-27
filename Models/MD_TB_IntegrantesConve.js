/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 16 /03 / 2024
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (MD_TB_IntegrantesConve.js) contiene la definición del modelo Sequelize para la tabla de la base de datos.
 *
 * Tema: Modelos - IntegrantesConve
 *
 * Capa: Backend
 */

// Importa la configuración de la base de datos y los tipos de datos necesarios
import dotenv from 'dotenv'; // Importa el módulo dotenv para cargar variables de entorno desde un archivo .env
import db from '../DataBase/db.js'; // Importa la conexión a la base de datos
import { DataTypes } from 'sequelize'; // Importa el módulo DataTypes de Sequelize para definir tipos de datos

// Si no estás en producción, carga las variables de entorno desde el archivo .env
if (process.env.NODE_ENV !== 'production') {
  dotenv.config(); // Carga las variables de entorno desde el archivo .env
}

// Define el modelo para la tabla 'integrantes_conve' en la base de datos
const IntegrantesConveModel = db.define(
  // Define los campos y sus tipos de datos correspondientes
  'integrantes_conve',
  {
    id_conv: {
      type: DataTypes.BIGINT,
      allowNull: false
    },

    // Plan asociado al integrante dentro del convenio (FK a convenios_planes_disponibles.id).
    // Puede ser NULL si el integrante no tiene plan asignado (compatibilidad hacia atrás).
    // Benjamin Orellana - Dic/2025
    convenio_plan_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },

    nombre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    dni: {
      type: DataTypes.STRING,
      allowNull: true
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    sede: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notas: {
      type: DataTypes.STRING,
      allowNull: true
    },
    precio: {
      type: DataTypes.STRING,
      allowNull: true
    },
    descuento: {
      type: DataTypes.STRING,
      allowNull: true
    },
    preciofinal: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    fechaCreacion: {
      type: DataTypes.DATE
    },

    // Fecha de vencimiento calculada según el plan (duracion_dias) o lógica del sistema.
    // Se usa para determinar vigencia y para “grisado” en el front.
    // Benjamin Orellana - Dic/2025
    fecha_vencimiento: {
      type: DataTypes.DATE,
      allowNull: true
    },

    estado_autorizacion: {
      type: DataTypes.ENUM('sin_autorizacion', 'pendiente', 'autorizado'),
      defaultValue: 'sin_autorizacion'
    }
  },
  {
    timestamps: false // Esto evita que Sequelize añada automáticamente los campos createdAt y updatedAt
  }
);

export default {
  IntegrantesConveModel
};
