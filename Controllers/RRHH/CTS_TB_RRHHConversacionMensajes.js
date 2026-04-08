/*
 * Programador: Benjamin Orellana / Sergio Gustavo Manrique
 * Fecha Creación: 30 / 04 / 2025
 * Versión: 1.1
 *
 * Descripción:
 * * Maneja el flujo de mensajes individuales y respuestas de RRHH.
 * * Gestiona la creación de conversaciones automáticas al enviar el primer mensaje y actualiza
 * * los flags de lectura y última actividad en la cabecera de la charla.
 * Tema: Controladores - RRHH Conversacion Mensajes
 * * Capa: Backend 
 *
 * Nomenclatura: 
 * * OBRS_ obtenerRegistros (Historial completo)
 * * OBRS_ obtenerRegistrosPorUsuarioSede (Vista agrupada)
 * * CR_ crearRegistro (Crea cabecera si no existe)
 * * UR_ actualizarRegistro
 * * ER_ eliminarRegistro
 */
import RRHHConversacionMensajesModel from "../../Models/RRHH/MD_TB_RRHHConversacionMensajes.js";
import RRHHConversacionesModel from "../../Models/RRHH/MD_TB_RRHHConversaciones.js";
import UsersModel from "../../Models/MD_TB_Users.js";
import Sedes from "../../Models/MD_TB_sedes.js";

const { SedeModel } = Sedes;

export const OBRS_RRHHConversacionMensajes_CTS = async (req, res) => {
  try {
    const { conversacion_id } = req.query;

    let filtros = { eliminado: 0 };
    if (conversacion_id) {
      filtros.conversacion_id = conversacion_id;
    }

    const registros = await RRHHConversacionMensajesModel.findAll({
      where: filtros,
      include: [
        {
          model: UsersModel,
          as: "resolutor",
          attributes: ["id", "name"],
          required: false,
        },
      ],
      order: [["created_at", "ASC"]],
    });

    const mensajesConResolutor = registros.map((registro) => {
      const data = registro.toJSON();
      const resolutorId = data.resuelto_por;
      return {
        ...data,
        resulto_por_id: resolutorId,
        resuelto_por: data.resolutor?.name || null,
        resolutor: undefined,
      };
    });

    return res.json(mensajesConResolutor);
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
    const sede_id = req.query.sede_id ?? req.body?.sede_id ?? req.params?.sede_id;

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
      ],
      order: [
        ["id", "ASC"],
        [{ model: RRHHConversacionMensajesModel, as: "mensajes" }, "created_at", "ASC"],
      ],
    });

    const conversacionesConNotificaciones = conversaciones.map((conversacion) => {
      const data = conversacion.toJSON();
      data.mensajes = (data.mensajes || []).map((mensaje) => {
        const resolutorId = mensaje.resuelto_por;
        return {
          ...mensaje,
          resulto_por_id: resolutorId,
          resuelto_por: mensaje.resolutor?.name || null,
          resolutor: undefined,
        };
      });

      data.notificaciones_sin_resolver = (data.mensajes || []).filter(
        (mensaje) => Number(mensaje.resuelto) === 0,
      ).length;
      return data;
    });

    return res.json(conversacionesConNotificaciones);
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
      ],
    });

    if (!registro)
      return res.status(404).json({ mensajeError: "Mensaje no encontrado." });

    const data = registro.toJSON();
    const resolutorId = data.resuelto_por;
    const mensajeFormateado = {
      ...data,
      resulto_por_id: resolutorId,
      resuelto_por: data.resolutor?.name || null,
      resolutor: undefined,
    };

    return res.json(mensajeFormateado);
  } catch (error) {
    console.error("OBR_RRHHConversacionMensaje_CTS:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

export const CR_RRHHConversacionMensaje_CTS = async (req, res) => {
  try {
    const { usuario_id, mensaje, destinatario_tipo, sede_id } = req.body;

    const [conversacion] = await RRHHConversacionesModel.findOrCreate({
      where: { usuario_id, eliminado: 0, sede_id},
      defaults: {
        estado: "abierta",
        tiene_no_leidos_rrhh: 0,
        tiene_no_leidos_usuario: 0,
      },
    });

    const nuevoMensaje = await RRHHConversacionMensajesModel.create({
      ...req.body,
      conversacion_id: conversacion.id,
    });

    await conversacion.update({
      ultimo_mensaje: mensaje.substring(0, 250),
      ultima_fecha_mensaje: new Date(),
      tiene_no_leidos_rrhh:
        destinatario_tipo === "rrhh" ? 1 : conversacion.tiene_no_leidos_rrhh,
      tiene_no_leidos_usuario:
        destinatario_tipo === "usuario"
          ? 1
          : conversacion.tiene_no_leidos_usuario,
    });

    res.json({ mensaje: "Mensaje registrado con éxito", nuevoMensaje });
  } catch (error) {
    console.error("CR_RRHHConversacionMensaje_CTS:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};

export const UR_RRHHConversacionMensaje_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [filasActualizadas] = await RRHHConversacionMensajesModel.update(
      req.body,
      {
        where: { id, eliminado: 0 },
      },
    );

    if (filasActualizadas === 1) {
      const registroActualizado =
        await RRHHConversacionMensajesModel.findByPk(id);
      res.json({
        mensaje: "Mensaje actualizado correctamente",
        registroActualizado,
      });
    } else {
      res.status(404).json({ mensajeError: "Mensaje no encontrado" });
    }
  } catch (error) {
    console.error("UR_RRHHConversacionMensaje_CTS:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};

export const ER_RRHHConversacionMensaje_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [filasActualizadas] = await RRHHConversacionMensajesModel.update(
      { eliminado: 1 },
      { where: { id } },
    );

    if (filasActualizadas === 1) {
      res.json({ mensaje: "Mensaje eliminado correctamente" });
    } else {
      res.status(404).json({ mensajeError: "Mensaje no encontrado" });
    }
  } catch (error) {
    console.error("ER_RRHHConversacionMensaje_CTS:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};
