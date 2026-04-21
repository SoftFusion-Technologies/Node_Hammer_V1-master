import dayjs from "dayjs";
import RRHHFeriadosProgramadosModel from "../../Models/RRHH/MD_RB_RRHH_FeriadosProgramados.js";
import UsersModel from "../../Models/MD_TB_Users.js";
import { Op } from "sequelize";

// Validación simplificada
const esFechaValida = (fecha = "") => /^\d{4}-\d{2}-\d{2}$/.test(fecha);

// OBRS: Obtener feriados (Ya no filtra por sede)
export const OBRS_RRHHFeriadosProgramados_CTS = async (req, res) => {
  try {
    // Extraemos el nuevo parámetro opcional
    const { fechahoy } = req.query;
    const where = {};

    // Si viene la fecha, filtramos exactamente por ese valor
    if (fechahoy) {
      where.fecha = fechahoy;
    }

    const registros = await RRHHFeriadosProgramadosModel.findAll({
      where,
      include: [
        { model: UsersModel, as: "usuario", attributes: ["id", "name"] },
      ],
      order: [["fecha", "ASC"]],
    });

    res.json(registros);
  } catch (error) {
    console.error("Error al obtener feriados:", error);
    res.status(500).json({ mensajeError: "Error al obtener feriados" });
  }
};

// CR: Crear feriado (Global)
export const CR_RRHHFeriadosProgramados_CTS = async (req, res) => {
  try {
    const { fecha, usuario_id } = req.body;

    if (!fecha || !esFechaValida(fecha)) {
      return res.status(400).json({ mensajeError: "Fecha inválida" });
    }

    const ahora = dayjs().format("YYYY-MM-DD HH:mm:ss");

    // Buscamos si ya existe
    const existe = await RRHHFeriadosProgramadosModel.findOne({ where: { fecha } });
    if (existe) {
      return res.status(400).json({ mensajeError: "Ya existe un feriado programado para esta fecha." });
    }

    const nuevoFeriado = await RRHHFeriadosProgramadosModel.create({
      fecha,
      usuario_id,
      created_at: ahora,
      updated_at: ahora,
    });

    res.status(201).json({ message: "Feriado global creado", nuevoFeriado });
  } catch (error) {
    res.status(500).json({ mensajeError: "Error al crear feriado" });
  }
};

// UR: Actualizar feriado
export const UR_RRHHFeriadosProgramados_CTS = async (req, res) => {
  try {
    const feriado = await RRHHFeriadosProgramadosModel.findByPk(req.params.id);
    if (!feriado) return res.status(404).json({ mensajeError: "No encontrado" });

    await feriado.update({
      fecha: req.body.fecha ?? feriado.fecha,
      usuario_id: req.body.usuario_id ?? feriado.usuario_id,
      updated_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    });

    res.json({ message: "Feriado actualizado", feriado });
  } catch (error) {
    res.status(500).json({ mensajeError: "Error al actualizar" });
  }
};

// ER: Eliminar feriado
export const ER_RRHHFeriadosProgramados_CTS = async (req, res) => {
  try {
    const feriado = await RRHHFeriadosProgramadosModel.findByPk(req.params.id);
    if (!feriado) return res.status(404).json({ mensajeError: "No encontrado" });
    await feriado.destroy();
    res.json({ message: "Feriado eliminado" });
  } catch (error) {
    res.status(500).json({ mensajeError: "Error al eliminar" });
  }
};