/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 21 / 04 / 2026
 * Versión: 1.0
 *
 */
import dayjs from "dayjs";
import RRHH_VacacionesProgramadas from "../../Models/RRHH/MD_RB_RRHH_VacacionesProgramaciones.js";
import UsersModel from "../../Models/MD_TB_Users.js";
import { SedeModel } from "../../Models/MD_TB_sedes.js";
import { Op } from "sequelize";

// Validación básica
const esFechaValida = (fecha = "") => /^\d{4}-\d{2}-\d{2}$/.test(fecha);

// OBRS: Obtener vacaciones
export const OBRS_RRHHVacacionesProgramadas_CTS = async (req, res) => {
  try {
    const { usuario_emp_id, desde, hasta } = req.query;

    const where = {};

    if (usuario_emp_id) {
      where.usuario_emp_id = usuario_emp_id;
    }

    // filtro por rango (clave para calendario)
    if (desde && hasta) {
      where[Op.and] = [
        { fecha_desde: { [Op.lte]: hasta } },
        { fecha_hasta: { [Op.gte]: desde } },
      ];
    }

    const registros = await RRHH_VacacionesProgramadas.findAll({
      where,
      include: [
        { model: UsersModel, as: "empleado", attributes: ["id", "name"] },
        { model: UsersModel, as: "admin", attributes: ["id", "name"] },
        { model: SedeModel, as: "sede", attributes: ["id", "nombre"] },
      ],
      order: [["fecha_desde", "ASC"]],
    });

    res.json(registros);
  } catch (error) {
    console.error("Error al obtener vacaciones:", error);
    res.status(500).json({ mensajeError: "Error al obtener vacaciones" });
  }
};

// CR: Crear vacaciones
export const CR_RRHHVacacionesProgramadas_CTS = async (req, res) => {
  try {
    const {
      usuario_emp_id,
      usuario_adm_id,
      sede_id,
      fecha_desde,
      fecha_hasta,
    } = req.body;

    if (
      !usuario_emp_id ||
      !usuario_adm_id ||
      !sede_id ||
      !esFechaValida(fecha_desde) ||
      !esFechaValida(fecha_hasta)
    ) {
      return res.status(400).json({ mensajeError: "Datos inválidos" });
    }

    if (fecha_hasta < fecha_desde) {
      return res.status(400).json({
        mensajeError: "La fecha_hasta no puede ser menor a fecha_desde",
      });
    }

    const ahora = dayjs().format("YYYY-MM-DD HH:mm:ss");

    // 🔥 Validación de solapamiento
    const existeSolapamiento = await RRHH_VacacionesProgramadas.findOne({
      where: {
        usuario_emp_id,
        [Op.and]: [
          { fecha_desde: { [Op.lte]: fecha_hasta } },
          { fecha_hasta: { [Op.gte]: fecha_desde } },
        ],
      },
    });

    if (existeSolapamiento) {
      return res.status(400).json({
        mensajeError: "Ya existen vacaciones en ese rango para el empleado",
      });
    }

    const nuevaVacacion = await RRHH_VacacionesProgramadas.create({
      usuario_emp_id,
      usuario_adm_id,
      sede_id,
      fecha_desde,
      fecha_hasta,
      created_at: ahora,
      updated_at: ahora,
    });

    res.status(201).json({
      message: "Vacaciones creadas",
      nuevaVacacion,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensajeError: "Error al crear vacaciones" });
  }
};

// UR: Actualizar vacaciones
export const UR_RRHHVacacionesProgramadas_CTS = async (req, res) => {
  try {
    const vacacion = await RRHH_VacacionesProgramadas.findByPk(req.params.id);

    if (!vacacion)
      return res.status(404).json({ mensajeError: "No encontrado" });

    const nuevaFechaDesde = req.body.fecha_desde ?? vacacion.fecha_desde;
    const nuevaFechaHasta = req.body.fecha_hasta ?? vacacion.fecha_hasta;

    if (!esFechaValida(nuevaFechaDesde) || !esFechaValida(nuevaFechaHasta)) {
      return res.status(400).json({ mensajeError: "Fechas inválidas" });
    }

    if (nuevaFechaHasta < nuevaFechaDesde) {
      return res.status(400).json({
        mensajeError: "La fecha_hasta no puede ser menor a fecha_desde",
      });
    }

    // 🔥 validar solapamiento (excluyendo el actual)
    const existeSolapamiento = await RRHH_VacacionesProgramadas.findOne({
      where: {
        usuario_emp_id: req.body.usuario_emp_id ?? vacacion.usuario_emp_id,
        id: { [Op.ne]: vacacion.id },
        [Op.and]: [
          { fecha_desde: { [Op.lte]: nuevaFechaHasta } },
          { fecha_hasta: { [Op.gte]: nuevaFechaDesde } },
        ],
      },
    });

    if (existeSolapamiento) {
      return res.status(400).json({
        mensajeError: "Se superpone con otras vacaciones",
      });
    }

    await vacacion.update({
      usuario_emp_id: req.body.usuario_emp_id ?? vacacion.usuario_emp_id,
      usuario_adm_id: req.body.usuario_adm_id ?? vacacion.usuario_adm_id,
      sede_id: req.body.sede_id ?? vacacion.sede_id,
      fecha_desde: nuevaFechaDesde,
      fecha_hasta: nuevaFechaHasta,
      updated_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    });

    res.json({ message: "Vacaciones actualizadas", vacacion });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensajeError: "Error al actualizar" });
  }
};

// ER: Eliminar vacaciones
export const ER_RRHHVacacionesProgramadas_CTS = async (req, res) => {
  try {
    const vacacion = await RRHH_VacacionesProgramadas.findByPk(req.params.id);

    if (!vacacion)
      return res.status(404).json({ mensajeError: "No encontrado" });

    await vacacion.destroy();

    res.json({ message: "Vacaciones eliminadas" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensajeError: "Error al eliminar" });
  }
};
