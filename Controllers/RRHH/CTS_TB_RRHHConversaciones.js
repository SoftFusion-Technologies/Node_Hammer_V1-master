/*
 * Programador: Benjamin Orellana / Sergio Gustavo Manrique
 * Fecha Creación: 30 / 04 / 2025
 * Versión: 1.1
 *
 * Descripción:
 * * Gestiona las cabeceras de los hilos de comunicación entre empleados y RRHH.
 * * Calcula dinámicamente el conteo de mensajes sin resolver y notificaciones pendientes por hilo.
 * Tema: Controladores - RRHH Conversaciones
 * * Capa: Backend 
 *
 * Nomenclatura: 
 * * OBRS_ obtenerRegistros (con conteo de pendientes)
 * * OBRS_ CantidadNoLeidas (Contador global para badges)
 * * OBR_ obtenerRegistro
 * * CR_ crearRegistro
 * * UR_ actualizarRegistro
 * * ER_ eliminarRegistro
 */
import RRHHConversacionesModel from "../../Models/RRHH/MD_TB_RRHHConversaciones.js";
import UsersModel from "../../Models/MD_TB_Users.js";
import { SedeModel } from "../../Models/MD_TB_sedes.js";
import RRHH_UsuarioSede from "../../Models/RRHH/MD_TB_RRHHUsuarioSede.js";
import RRHHConversacionMensajesModel from "../../Models/RRHH/MD_TB_RRHHConversacionMensajes.js";
import { Op } from "sequelize";

export const OBRS_RRHHConversaciones_CTS = async (req, res) => {
  try {
    const registros = await RRHHConversacionesModel.findAll({
      where: { eliminado: 0 },
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
      ],
    });

    const conversacionesIds = registros.map((registro) => registro.id);

    if (!conversacionesIds.length) {
      return res.json(registros);
    }

    const conteosSinResolver = await RRHHConversacionMensajesModel.findAll({
      attributes: [
        "conversacion_id",
        [
          RRHHConversacionMensajesModel.sequelize.fn(
            "COUNT",
            RRHHConversacionMensajesModel.sequelize.col("id"),
          ),
          "notificaciones_sin_resolver",
        ],
      ],
      where: {
        conversacion_id: { [Op.in]: conversacionesIds },
        eliminado: 0,
        resuelto: 0,
        destinatario_tipo: "rrhh",
      },
      group: ["conversacion_id"],
      raw: true,
    });

    const mapaConteos = new Map(
      conteosSinResolver.map((item) => [
        Number(item.conversacion_id),
        Number(item.notificaciones_sin_resolver) || 0,
      ]),
    );

    const registrosConConteo = registros.map((registro) => ({
      ...registro.toJSON(),
      notificaciones_sin_resolver: mapaConteos.get(registro.id) || 0,
    }));

    return res.json(registrosConConteo);
  } catch (error) {
    console.error("OBRS_RRHHConversaciones_CTS:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

export const OBRS_CantidadNoLeidas_RRHHConversaciones_CTS = async (
  req,
  res,
) => {
  try {
    const { conversacion_id, usuario_id, sede_id } = req.query;

    const whereConversacion = {
      eliminado: 0,
      tiene_no_leidos_rrhh: 1,
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
      ],
    });

    if (!registro)
      return res
        .status(404)
        .json({ mensajeError: "Conversación no encontrada." });

    const notificacionesSinResolver = await RRHHConversacionMensajesModel.count({
      where: {
        conversacion_id: registro.id,
        eliminado: 0,
        resuelto: 0,
        destinatario_tipo: "rrhh",
      },
    });

    return res.json({
      ...registro.toJSON(),
      notificaciones_sin_resolver: notificacionesSinResolver,
    });
  } catch (error) {
    console.error("OBR_RRHHConversacion_CTS:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

export const CR_RRHHConversacion_CTS = async (req, res) => {
  try {
    
    const nuevaConversacion = await RRHHConversacionesModel.create(req.body);
    res.json({ mensaje: "Conversación creada con éxito", nuevaConversacion });
  } catch (error) {
    console.error("CR_RRHHConversacion_CTS:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};

export const UR_RRHHConversacion_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [filasActualizadas] = await RRHHConversacionesModel.update(req.body, {
      where: { id, eliminado: 0 },
    });

    if (filasActualizadas === 1) {
      const registroActualizado = await RRHHConversacionesModel.findByPk(id);
      res.json({
        mensaje: "Conversación actualizada correctamente",
        registroActualizado,
      });
    } else {
      res.status(404).json({ mensajeError: "Conversación no encontrada" });
    }
  } catch (error) {
    console.error("UR_RRHHConversacion_CTS:", error);
    res.status(500).json({ mensajeError: error.message });
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
      res.json({ mensaje: "Conversación eliminada correctamente" });
    } else {
      res.status(404).json({ mensajeError: "Conversación no encontrada" });
    }
  } catch (error) {
    console.error("ER_RRHHConversacion_CTS:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};