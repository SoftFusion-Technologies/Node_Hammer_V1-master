/*
 * Programador: Benjamin Orellana / Sergio Gustavo Manrique
 * Fecha Creación: 30 / 04 / 2025
 * Versión: 1.4
 *
 * Descripción:
 * * Maneja el flujo de mensajes individuales y respuestas de RRHH.
 * * Soporta carga incremental del chat:
 * * - últimos mensajes
 * * - mensajes anteriores
 * * - mensajes nuevos desde el último id
 * * Permite editar mensajes propios hasta 5 horas y eliminar mensajes propios sin quitarlos del chat.
 * Tema: Controladores - RRHH Conversacion Mensajes
 * * Capa: Backend
 */

import { Op } from "sequelize";
import RRHHConversacionMensajesModel from "../../Models/RRHH/MD_TB_RRHHConversacionMensajes.js";
import RRHHConversacionesModel from "../../Models/RRHH/MD_TB_RRHHConversaciones.js";
import RRHHMarcacionesModel from "../../Models/RRHH/MD_TB_RRHHMarcaciones.js";
import UsersModel from "../../Models/MD_TB_Users.js";
import Sedes from "../../Models/MD_TB_sedes.js";
const RRHH_UPLOAD_PREFIX = "uploads/ticket_consultas_rrhh/";
import { eliminarArchivoRRHH } from "../../utils/uploadTicketConsultaRRHHConfig.js";
const { SedeModel } = Sedes;
const HORAS_MAXIMAS_EDICION = 5;

const obtenerArchivoAdjunto = (req) => {
  if (req.file) return req.file;
  if (req.files?.archivo_adjunto?.[0]) return req.files.archivo_adjunto[0];
  return null;
};

const construirUrlPublica = (nombreArchivo) => {
  if (!nombreArchivo) return null;
  const limpia = String(nombreArchivo).trim();
  if (/^https?:\/\//i.test(limpia)) return limpia;
  const normalizada = limpia.replace(/\\/g, "/").replace(/^\/+/, "");
  return `/${normalizada}`;
};

const obtenerMensajeVisible = (mensaje) => {
  if (!mensaje) return "";
  if (Number(mensaje.mensaje_eliminado) === 1) return "Mensaje eliminado";
  if (mensaje.tipo_mensaje === "sistema") return mensaje.mensaje || "";
  return String(mensaje.mensaje || "").substring(0, 250);
};

const actualizarCabeceraConversacion = async (conversacion_id) => {
  const ultimoMensaje = await RRHHConversacionMensajesModel.findOne({
    where: {
      conversacion_id,
      eliminado: 0,
    },
    order: [["id", "DESC"]],
  });

  if (!ultimoMensaje) {
    await RRHHConversacionesModel.update(
      {
        ultimo_mensaje: null,
        ultima_fecha_mensaje: null,
      },
      {
        where: { id: conversacion_id, eliminado: 0 },
      },
    );
    return;
  }

  await RRHHConversacionesModel.update(
    {
      ultimo_mensaje: obtenerMensajeVisible(ultimoMensaje),
      ultima_fecha_mensaje: ultimoMensaje.created_at,
    },
    {
      where: { id: conversacion_id, eliminado: 0 },
    },
  );
};

const mapearMensajePlano = (data) => {
  const archivo_adjunto_url_publica = construirUrlPublica(data.archivo_adjunto_url);
  const es_imagen = /\.(jpg|jpeg|png|webp|heic)$/i.test(data.archivo_adjunto_url || "");

  return {
    ...data,
    archivo_adjunto_url_publica, // URL lista para el src del front
    es_imagen,                  // Para saber si mostrar miniatura
    resulto_por_id: data.resuelto_por,
    resuelto_por: data.resolutor?.name || null,
    emisor_nombre: data.emisor?.name || null,
    emisor_email: data.emisor?.email || null,
    resolutor: undefined,
    emisor: undefined,
  };
};

const mapearMensaje = (registro) => mapearMensajePlano(registro.toJSON());

export const OBRS_RRHHConversacionMensajes_CTS = async (req, res) => {
  try {
    const {
      conversacion_id,
      limit,
      before_id,
      after_id,
    } = req.query;

    const filtros = { eliminado: 0 };

    if (conversacion_id) filtros.conversacion_id = Number(conversacion_id);
    if (before_id) filtros.id = { ...(filtros.id || {}), [Op.lt]: Number(before_id) };
    if (after_id) filtros.id = { ...(filtros.id || {}), [Op.gt]: Number(after_id) };

    const limite = Math.max(1, Math.min(Number(limit) || (after_id ? 100 : 20), 100));

    const orderBase = after_id
      ? [["id", "ASC"]]
      : [["id", "DESC"]];

    let registros = await RRHHConversacionMensajesModel.findAll({
      where: filtros,
      include: [
        {
          model: UsersModel,
          as: "resolutor",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: UsersModel,
          as: "emisor",
          attributes: ["id", "name", "email"],
          required: false,
        },
        {
          model: RRHHMarcacionesModel,
          as: "marcacion",
          attributes: [
            "id",
            "usuario_id",
            "sede_id",
            "fecha",
            "hora_entrada",
            "hora_salida",
            "estado",
            "estado_aprobacion",
            "origen",
            "minutos_tarde",
            "minutos_extra_pendientes",
            "minutos_extra_autorizados",
            "minutos_extra_no_autorizados",
            "minutos_descuento",
            "minutos_salida_anticipada",
            "comentarios",
            "aprobado_por",
            "fecha_aprobacion",
            "horario_id",
            "liquidacion_id",
          ],
          required: false,
        },
      ],
      order: orderBase,
      limit: after_id ? undefined : limite,
    });

    if (!after_id) {
      registros = registros.reverse();
    }

    const mensajes = registros.map(mapearMensaje);

    return res.json({
      registros: mensajes,
      hay_mas: !after_id && registros.length === limite,
      limit: limite,
    });
  } catch (error) {
    console.error("OBRS_RRHHConversacionMensajes_CTS:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

export const OBRS_RRHHConversacionMensajesPorUsuarioSede_CTS = async (
  req,
  res,
) => {
  try {
    const usuario_id =
      req.query.usuario_id ?? req.body?.usuario_id ?? req.params?.usuario_id;
    const sede_id =
      req.query.sede_id ?? req.body?.sede_id ?? req.params?.sede_id;

    if (!usuario_id || !sede_id) {
      return res.status(400).json({
        mensajeError: "usuario_id y sede_id son obligatorios.",
      });
    }

    const conversaciones = await RRHHConversacionesModel.findAll({
      where: {
        usuario_id,
        sede_id,
        eliminado: 0,
      },
      include: [
        {
          model: RRHHConversacionMensajesModel,
          as: "mensajes",
          where: { eliminado: 0 },
          include: [
            {
              model: UsersModel,
              as: "resolutor",
              attributes: ["id", "name"],
              required: false,
            },
            {
              model: UsersModel,
              as: "emisor",
              attributes: ["id", "name", "email"],
              required: false,
            },
          ],
          required: false,
        },
        {
          model: UsersModel,
          as: "usuario",
          attributes: ["id", "name", "email"],
          required: false,
        },
        {
          model: SedeModel,
          as: "sede",
          attributes: ["id", "nombre"],
          required: false,
        },
        {
          model: UsersModel,
          as: "cerrador",
          attributes: ["id", "name"],
          required: false,
        },
      ],
      order: [
        ["id", "ASC"],
        [{ model: RRHHConversacionMensajesModel, as: "mensajes" }, "id", "ASC"],
      ],
    });

    const conversacionesFormateadas = conversaciones.map((conversacion) => {
      const data = conversacion.toJSON();

      data.mensajes = (data.mensajes || []).map(mapearMensajePlano);

      return data;
    });

    return res.json(conversacionesFormateadas);
  } catch (error) {
    console.error("OBRS_RRHHConversacionMensajesPorUsuarioSede_CTS:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

export const OBR_RRHHConversacionMensaje_CTS = async (req, res) => {
  try {
    const registro = await RRHHConversacionMensajesModel.findOne({
      where: { id: req.params.id, eliminado: 0 },
      include: [
        {
          model: UsersModel,
          as: "resolutor",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: UsersModel,
          as: "emisor",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
    });

    if (!registro) {
      return res.status(404).json({ mensajeError: "Mensaje no encontrado." });
    }

    return res.json(mapearMensaje(registro));
  } catch (error) {
    console.error("OBR_RRHHConversacionMensaje_CTS:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

export const CR_RRHHConversacionMensaje_CTS = async (req, res) => {
  try {
    const {
      conversacion_id, // 👈 Recibimos el ID si es una respuesta a un ticket existente
      usuario_id,
      mensaje,
      destinatario_tipo,
      sede_id,
      emisor_user_id,
      marcacion_id,
      tipo_mensaje, // 👈 Usamos esto para guardar el asunto si el ticket es nuevo
    } = req.body;
    
    const archivo_adjunto_url = req.file 
    ? `uploads/ticket_consultas_rrhh/${req.file.filename}` 
    : null;

    let conversacion;

    // 1. Verificamos si es una respuesta a un ticket existente
    if (conversacion_id) {
      conversacion = await RRHHConversacionesModel.findOne({
        where: { id: conversacion_id, eliminado: 0 }
      });

      if (!conversacion) {
        return res.status(404).json({ mensajeError: "Conversación no encontrada." });
      }

      // Si el ticket estaba cerrado, lo reabrimos automáticamente
      if (conversacion.estado === "cerrada") {
        await conversacion.update({
          estado: "abierta",
          cerrado_por: null,
          cerrado_at: null,
        });

        await RRHHConversacionMensajesModel.create({
          conversacion_id: conversacion.id,
          emisor_user_id,
          destinatario_tipo: destinatario_tipo === "rrhh" ? "usuario" : "rrhh",
          tipo_mensaje: "sistema",
          mensaje: "Ticket reabierto por un nuevo mensaje.",
          marcacion_id: marcacion_id || null,
        });
      }
    } else {
      // 2. Si NO hay conversacion_id, creamos un TICKET NUEVO
      conversacion = await RRHHConversacionesModel.create({
        usuario_id,
        sede_id,
        asunto: tipo_mensaje || 'aclaracion', // 👈 Guardamos el motivo como asunto del ticket
        estado: "abierta",
        tiene_no_leidos_rrhh: 0,
        tiene_no_leidos_usuario: 0,
        cerrado_por: null,
        cerrado_at: null,
      });
    }

    // 3. Creamos el mensaje y lo asociamos a la conversación (nueva o existente)
    const nuevoMensaje = await RRHHConversacionMensajesModel.create({
      ...req.body,
      conversacion_id: conversacion.id,
      marcacion_id: marcacion_id || null,
      archivo_adjunto_url,
      leido: 0,
      leido_at: null,
      editado: 0,
      editado_at: null,
      mensaje_eliminado: 0,
      mensaje_eliminado_at: null,
    });

    // 4. Actualizamos la cabecera del ticket con la alerta de "no leído"
    await conversacion.update({
      ultimo_mensaje: String(mensaje || "").substring(0, 250),
      ultima_fecha_mensaje: new Date(),
      tiene_no_leidos_rrhh:
        destinatario_tipo === "rrhh" ? 1 : conversacion.tiene_no_leidos_rrhh,
      tiene_no_leidos_usuario:
        destinatario_tipo === "usuario" ? 1 : conversacion.tiene_no_leidos_usuario,
    });

    return res.json({
      mensaje: conversacion_id ? "Respuesta registrada con éxito" : "Ticket creado con éxito",
      nuevoMensaje,
    });
  } catch (error) {
    console.error("CR_RRHHConversacionMensaje_CTS:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

export const CR_RRHHMensajeDesdeAdmin_CTS = async (req, res) => {
  try {
    const {
      conversacion_id,    // 👈 Recibimos el ID si RRHH responde a un ticket existente
      usuario_id,         
      sede_id,            
      emisor_user_id,     
      mensaje,
      tipo_mensaje,       // 'tu_cobro', 'otras_consultas', etc. (Se usa como asunto si es nuevo)
      marcacion_id,       
      fecha_referencia
    } = req.body;
    
    const archivo_adjunto_url = req.file 
    ? `uploads/ticket_consultas_rrhh/${req.file.filename}` 
    : null;

    let conversacion;

    // 1. Verificamos si RRHH está respondiendo a un ticket o creando uno nuevo
    if (conversacion_id) {
      conversacion = await RRHHConversacionesModel.findOne({
        where: { id: conversacion_id, eliminado: 0 }
      });

      if (!conversacion) {
        return res.status(404).json({ mensajeError: "Conversación no encontrada." });
      }

      if (conversacion.estado === "cerrada") {
        await conversacion.update({
          estado: "abierta",
          cerrado_por: null,
          cerrado_at: null,
        });
      }
    } else {
      // Si RRHH crea un ticket de cero para el empleado
      conversacion = await RRHHConversacionesModel.create({
        usuario_id,
        sede_id,
        asunto: tipo_mensaje || 'otras_consultas', // 👈 Asunto del ticket creado por RRHH
        estado: "abierta",
        tiene_no_leidos_rrhh: 0,
        tiene_no_leidos_usuario: 0,
        cerrado_por: null,
        cerrado_at: null,
      });
    }

    // 2. Crear el mensaje (Destinatario siempre será 'usuario')
    const nuevoMensaje = await RRHHConversacionMensajesModel.create({
      conversacion_id: conversacion.id,
      emisor_user_id,
      destinatario_tipo: "usuario", 
      tipo_mensaje: conversacion_id ? "respuesta_rrhh" : (tipo_mensaje || "respuesta_rrhh"),
      mensaje: mensaje.trim(),
      archivo_adjunto_url,
      marcacion_id: marcacion_id || null,
      fecha_referencia: fecha_referencia || null,
      leido: 0,
    });

    // 3. Actualizar la conversación: marcamos no leídos para el USUARIO
    await conversacion.update({
      ultimo_mensaje: String(mensaje || "").substring(0, 250),
      ultima_fecha_mensaje: new Date(),
      tiene_no_leidos_usuario: 1, 
    });

    return res.json({
      mensaje: conversacion_id ? "Respuesta de RRHH enviada" : "Ticket de RRHH creado",
      nuevoMensaje,
    });
  } catch (error) {
    console.error("Error en CR_RRHHMensajeDesdeAdmin_CTS:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

export const UR_RRHHConversacionMensaje_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const { emisor_user_id, mensaje, sin_horas_maxima_edicion, tipo_mensaje, eliminar_imagen } = req.body;

    const registro = await RRHHConversacionMensajesModel.findOne({
      where: { id, eliminado: 0 },
    });

    if (!registro) {
      return res.status(404).json({ mensajeError: "Mensaje no encontrado" });
    }

    if (registro.tipo_mensaje === "sistema") {
      return res.status(400).json({
        mensajeError: "Los mensajes del sistema no se pueden editar.",
      });
    }

    if (Number(registro.mensaje_eliminado) === 1) {
      return res.status(400).json({
        mensajeError: "Un mensaje eliminado no se puede editar.",
      });
    }

    if (Number(registro.emisor_user_id) !== Number(emisor_user_id)) {
      return res.status(403).json({
        mensajeError: "Solo podés editar tus propios mensajes.",
      });
    }

    const ahora = new Date();
    const creado = new Date(registro.created_at);
    const horasTranscurridas = (ahora.getTime() - creado.getTime()) / (1000 * 60 * 60);

    if (!sin_horas_maxima_edicion && horasTranscurridas > HORAS_MAXIMAS_EDICION) {
      return res.status(400).json({
        mensajeError: `Solo podés editar mensajes dentro de las primeras ${HORAS_MAXIMAS_EDICION} horas.`,
      });
    }

    let archivo_adjunto_url;
    if (req.file) {
      archivo_adjunto_url = `${RRHH_UPLOAD_PREFIX}${req.file.filename}`;
    } else if (eliminar_imagen === 'true' || eliminar_imagen === true) {
        eliminarArchivoRRHH(registro.archivo_adjunto_url);
      archivo_adjunto_url = null;
    } else {
      archivo_adjunto_url = registro.archivo_adjunto_url;
    }

    registro.mensaje = String(mensaje || registro.mensaje || "").trim();
    registro.tipo_mensaje = tipo_mensaje || registro.tipo_mensaje;
    registro.archivo_adjunto_url = archivo_adjunto_url;
    registro.editado = 1;
    registro.editado_at = new Date();

    await registro.save();
    await actualizarCabeceraConversacion(registro.conversacion_id);

    const registroActualizado = await RRHHConversacionMensajesModel.findOne({
      where: { id, eliminado: 0 },
      include: [
        {
          model: UsersModel,
          as: "resolutor",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: UsersModel,
          as: "emisor",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
    });

    return res.json({
      mensaje: "Mensaje actualizado correctamente",
      registroActualizado: mapearMensaje(registroActualizado),
    });
  } catch (error) {
    console.error("UR_RRHHConversacionMensaje_CTS:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

export const ER_RRHHConversacionMensaje_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const emisor_user_id =
      req.body?.emisor_user_id ?? req.query?.emisor_user_id;

    const registro = await RRHHConversacionMensajesModel.findOne({
      where: { id, eliminado: 0 },
    });

    if (!registro) {
      return res.status(404).json({ mensajeError: "Mensaje no encontrado" });
    }

    if (registro.tipo_mensaje === "sistema") {
      return res.status(400).json({
        mensajeError: "Los mensajes del sistema no se pueden eliminar.",
      });
    }

    if (Number(registro.emisor_user_id) !== Number(emisor_user_id)) {
      return res.status(403).json({
        mensajeError: "Solo podés eliminar tus propios mensajes.",
      });
    }

    if (Number(registro.mensaje_eliminado) === 1) {
      return res.status(400).json({
        mensajeError: "El mensaje ya fue eliminado.",
      });
    }

    await registro.update({
      mensaje: "Mensaje eliminado",
      mensaje_eliminado: 1,
      mensaje_eliminado_at: new Date(),
      editado: 0,
      editado_at: null,
    });

    await actualizarCabeceraConversacion(registro.conversacion_id);

    const registroActualizado = await RRHHConversacionMensajesModel.findOne({
      where: { id, eliminado: 0 },
      include: [
        {
          model: UsersModel,
          as: "resolutor",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: UsersModel,
          as: "emisor",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
    });

    return res.json({
      mensaje: "Mensaje eliminado correctamente",
      registroActualizado: mapearMensaje(registroActualizado),
    });
  } catch (error) {
    console.error("ER_RRHHConversacionMensaje_CTS:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};