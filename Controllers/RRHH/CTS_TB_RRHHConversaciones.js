/*
 * Programador: Benjamin Orellana / Sergio Gustavo Manrique
 * Fecha Creación: 30 / 04 / 2025
 * Versión: 1.3
 *
 * Descripción:
 * * Gestiona las cabeceras de los hilos de comunicación entre empleados y RRHH.
 * * Maneja apertura/cierre del asunto y trazabilidad del cierre.
 * * Soporta paginación liviana para evitar sobrecarga.
 * Tema: Controladores - RRHH Conversaciones
 * * Capa: Backend
 */

import RRHHConversacionesModel from "../../Models/RRHH/MD_TB_RRHHConversaciones.js";
import UsersModel from "../../Models/MD_TB_Users.js";
import { SedeModel } from "../../Models/MD_TB_sedes.js";
import RRHH_UsuarioSede from "../../Models/RRHH/MD_TB_RRHHUsuarioSede.js";
import RRHHConversacionMensajesModel from "../../Models/RRHH/MD_TB_RRHHConversacionMensajes.js";

const formatearFechaSistema = (fecha) => {
  try {
    return new Date(fecha).toLocaleString("es-AR");
  } catch {
    return "";
  }
};

export const OBRS_RRHHConversaciones_CTS = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    // 1. Capturamos los parámetros dinámicos desde el frontend
    const { usuario_id, sede_id } = req.query;

    // 2. Construimos la cláusula WHERE dinámicamente
    const whereConversacion = { eliminado: 0 };
    
    if (usuario_id) whereConversacion.usuario_id = Number(usuario_id);
    if (sede_id) whereConversacion.sede_id = Number(sede_id);

    // 3. Ejecutamos la consulta (traerá 1 o múltiples tickets según el filtro)
    const { count, rows } = await RRHHConversacionesModel.findAndCountAll({
      where: whereConversacion,
      include: [
        {
          model: SedeModel,
          as: "sede",
          attributes: ["id", "nombre"],
        },
        {
          model: UsersModel,
          as: "usuario",
          attributes: ["id", "name", "email"],
          include: [
            {
              model: RRHH_UsuarioSede,
              as: "sedes_usuario",
              attributes: ["id", "sede_id", "activo"],
              include: [
                {
                  model: SedeModel,
                  as: "sede",
                  attributes: ["id", "nombre"],
                },
              ],
            },
          ],
        },
        {
          model: UsersModel,
          as: "cerrador",
          attributes: ["id", "name"],
          required: false,
        },
      ],
      order: [
        ["estado", "ASC"],                // abiertas primero (alfabéticamente "abierta" < "cerrada")
        ["ultima_fecha_mensaje", "DESC"]  // dentro de cada grupo, más recientes arriba
      ],
      limit,
      offset,
      distinct: true,
    });

    return res.json({
      registros: rows,
      total: count,
      limit,
      offset,
      hay_mas: offset + rows.length < count,
    });
  } catch (error) {
    console.error("OBRS_RRHHConversaciones_CTS:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

export const OBRS_CantidadNoLeidas_RRHHConversaciones_CTS = async (req, res) => {
  try {
    const {
      conversacion_id,
      usuario_id,
      sede_id,
      tipo = "admin",
    } = req.query;

    const campoNoLeidos =
      tipo === "admin"
        ? "tiene_no_leidos_rrhh"
        : "tiene_no_leidos_usuario";

    const whereConversacion = {
      eliminado: 0,
      [campoNoLeidos]: 1, 
    };

    if (conversacion_id) whereConversacion.id = conversacion_id;
    if (usuario_id) whereConversacion.usuario_id = usuario_id;
    if (sede_id) whereConversacion.sede_id = sede_id;

    const cantidad_no_leidas = await RRHHConversacionesModel.count({
      where: whereConversacion,
    });

    return res.json({ cantidad_no_leidas });
  } catch (error) {
    console.error("OBRS_CantidadNoLeidas_RRHHConversaciones_CTS:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

export const OBR_RRHHConversacion_CTS = async (req, res) => {
  // Este controlador se usa cuando hacen clic en un ticket específico
  try {
    const registro = await RRHHConversacionesModel.findOne({
      where: { id: req.params.id, eliminado: 0 },
      include: [
        {
          model: SedeModel,
          as: "sede",
          attributes: ["id", "nombre"],
        },
        {
          model: UsersModel,
          as: "usuario",
          attributes: ["id", "name", "email"],
        },
        {
          model: UsersModel,
          as: "cerrador",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    if (!registro) {
      return res
        .status(404)
        .json({ mensajeError: "Ticket de consulta no encontrado." });
    }

    return res.json(registro);
  } catch (error) {
    console.error("OBR_RRHHConversacion_CTS:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

export const CR_RRHHConversacion_CTS = async (req, res) => {
  try {
    const nuevaConversacion = await RRHHConversacionesModel.create(req.body);
    return res.json({
      mensaje: "Conversación creada con éxito",
      nuevaConversacion,
    });
  } catch (error) {
    console.error("CR_RRHHConversacion_CTS:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

export const UR_RRHHConversacion_CTS = async (req, res) => {
  try {
    const { id } = req.params;

    const conversacion = await RRHHConversacionesModel.findOne({
      where: { id, eliminado: 0 },
      include: [
        {
          model: UsersModel,
          as: "cerrador",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    if (!conversacion) {
      return res.status(404).json({ mensajeError: "Conversación no encontrada" });
    }

    const estadoAnterior = conversacion.estado;
    const nuevoEstado = req.body?.estado;
    const payloadActualizacion = { ...req.body };

    if (nuevoEstado === "abierta") {
      payloadActualizacion.cerrado_por = null;
      payloadActualizacion.cerrado_at = null;
    }

    await conversacion.update(payloadActualizacion);

    if (nuevoEstado === "cerrada" && estadoAnterior !== "cerrada") {
      const nombreCerrador = conversacion.cerrador?.name || "RRHH";
      const fechaTexto = formatearFechaSistema(
        payloadActualizacion.cerrado_at || new Date(),
      );

      await RRHHConversacionMensajesModel.create({
        conversacion_id: conversacion.id,
        emisor_user_id: payloadActualizacion.cerrado_por || conversacion.usuario_id,
        destinatario_tipo: "usuario",
        tipo_mensaje: "sistema",
        mensaje: `Conversación cerrada el ${fechaTexto} por ${nombreCerrador}.`,
      });

      await conversacion.update({
        ultimo_mensaje: `Conversación cerrada el ${fechaTexto} por ${nombreCerrador}.`,
        ultima_fecha_mensaje: new Date(),
      });
    }

    if (nuevoEstado === "abierta" && estadoAnterior === "cerrada") {
      await RRHHConversacionMensajesModel.create({
        conversacion_id: conversacion.id,
        emisor_user_id: conversacion.usuario_id,
        destinatario_tipo: "rrhh",
        tipo_mensaje: "sistema",
        mensaje: "Conversación reabierta.",
      });

      await conversacion.update({
        ultimo_mensaje: "Conversación reabierta.",
        ultima_fecha_mensaje: new Date(),
      });
    }

    const registroActualizado = await RRHHConversacionesModel.findOne({
      where: { id, eliminado: 0 },
      include: [
        {
          model: SedeModel,
          as: "sede",
          attributes: ["id", "nombre"],
        },
        {
          model: UsersModel,
          as: "usuario",
          attributes: ["id", "name", "email"],
        },
        {
          model: UsersModel,
          as: "cerrador",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    return res.json({
      mensaje: "Conversación actualizada correctamente",
      registroActualizado,
    });
  } catch (error) {
    console.error("UR_RRHHConversacion_CTS:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

export const ER_RRHHConversacion_CTS = async (req, res) => {
  try {
    const { id } = req.params;

    const [filasActualizadas] = await RRHHConversacionesModel.update(
      { eliminado: 1 },
      { where: { id } },
    );

    if (filasActualizadas === 1) {
      return res.json({ mensaje: "Conversación eliminada correctamente" });
    }

    return res.status(404).json({ mensajeError: "Conversación no encontrada" });
  } catch (error) {
    console.error("ER_RRHHConversacion_CTS:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};