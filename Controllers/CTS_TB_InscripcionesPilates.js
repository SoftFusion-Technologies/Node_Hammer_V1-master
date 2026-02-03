/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 23/10/2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo contiene controladores para gestionar el registro de alumnos
 * (inscripciones) en los diferentes horarios de clase, incluyendo la
 * creación de asistencias automáticas si el plan inicia hoy.
 *
 * Capa: Backend
 */

import db from "../DataBase/db.js";
import InscripcionesPilatesModel from "../Models/MD_TB_InscripcionesPilates.js";
import AsistenciasPilatesModel from "../Models/MD_TB_AsistenciasPilates.js";
import ClientesPilatesModel from "../Models/MD_TB_ClientesPilates.js";
import dayjs from "dayjs";
const AsistenciasModel = AsistenciasPilatesModel.AsistenciasPilatesModel;

// Obtener todas las inscripciones
export const OBRS_InscripcionesPilates_CTS = async (req, res) => {
  try {
    const registros = await InscripcionesPilatesModel.findAll({
      order: [["id", "DESC"]],
    });
    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener inscripción por ID
export const OBR_InscripcionesPilates_CTS = async (req, res) => {
  try {
    const registro = await InscripcionesPilatesModel.findByPk(req.params.id);
    if (!registro) {
      return res
        .status(404)
        .json({ mensajeError: "Inscripción no encontrada" });
    }
    res.json(registro);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear nueva inscripción
export const CR_InscripcionesPilates_CTS = async (req, res) => {
  try {
    const { id_cliente, dia, horario, fecha_inscripcion, id_sede } = req.body;

    // Validaciones básicas
    if (!id_cliente || !dia || !horario || !fecha_inscripcion || !id_sede) {
      return res.status(400).json({
        mensajeError:
          "id_cliente, dia, horario, fecha_inscripcion e id_sede son requeridos",
      });
    }

    console.log("Datos recibidos para la inscripcion:", req.body);

    // Buscar el id del horario correspondiente en la sede correcta
    const horarioResult = await db.query(
      `SELECT id 
       FROM horarios_pilates
       WHERE id_sede = :id_sede
         AND dia_semana = :dia
         AND DATE_FORMAT(hora_inicio, '%H:%i') = :horario`,
      {
        replacements: {
          id_sede,
          dia,
          horario,
        },
        type: db.QueryTypes.SELECT,
      }
    );

    if (!horarioResult || horarioResult.length === 0) {
      return res.status(404).json({
        mensajeError: "No se encontró el horario en la sede indicada",
        debug: { dia, horario, id_sede },
      });
    }

    const id_horario = horarioResult[0].id;

    // Crear inscripción
    const nuevaInscripcion = await InscripcionesPilatesModel.create({
      id_cliente,
      id_horario,
      fecha_inscripcion,
    });

    const hoy = new Date().toISOString().slice(0, 10);
    const cliente = await ClientesPilatesModel.findByPk(id_cliente);

    // Solo creamos la asistencia si el cliente existe y su fecha de inicio es HOY.
    if (cliente && cliente.fecha_inicio === hoy) {
      await AsistenciasPilatesModel.create({
        id_inscripcion: nuevaInscripcion.id,
        fecha: hoy,
        presente: false, // Por defecto, se crea como ausente
      });
      console.log(
        `[Asistencia Automática] Creado registro de ausente para el nuevo cliente ID: ${id_cliente}`
      );
    }

    res.status(201).json({
      message: "Inscripción creada correctamente en la sede indicada",
      inscripcion: nuevaInscripcion,
    });
  } catch (error) {
    console.error("Error completo:", error);
    res.status(500).json({
      mensajeError: error.message,
      stack: error.stack,
    });
  }
};

// Actualizar inscripción
export const UR_InscripcionesPilates_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_cliente, id_horario, fecha_inscripcion } = req.body;

    const inscripcion = await InscripcionesPilatesModel.findByPk(id);
    if (!inscripcion) {
      return res
        .status(404)
        .json({ mensajeError: "Inscripción no encontrada" });
    }

    await inscripcion.update({
      id_cliente:
        id_cliente !== undefined ? id_cliente : inscripcion.id_cliente,
      id_horario:
        id_horario !== undefined ? id_horario : inscripcion.id_horario,
      fecha_inscripcion:
        fecha_inscripcion !== undefined
          ? fecha_inscripcion
          : inscripcion.fecha_inscripcion,
    });

    res.json({
      message: "Inscripción actualizada correctamente",
      inscripcion,
    });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar el horario de una inscripción existente (Cambio de Turno)
export const UR_CambiarTurnoInscripcion_CTS = async (req, res) => {
  try {
    // 1. Obtenemos los datos que nos manda el frontend.
    const { id_estudiante, id_horario_nuevo, fecha_nueva_fin } = req.body;

    // 2. Verificamos que tengamos toda la información necesaria.
    if (!id_estudiante || !id_horario_nuevo) {
      return res.status(400).json({
        mensajeError:
          "Faltan datos. Se requiere id_estudiante e id_horario_nuevo.",
      });
    }

    // 3. Buscar la inscripción actual del alumno (la más reciente)
    const inscripcionActual = await InscripcionesPilatesModel.findOne({
      where: { id_cliente: id_estudiante },
      order: [['fecha_inscripcion', 'DESC']],
    });
    if (!inscripcionActual) {
      return res.status(404).json({
        mensajeError: "No se encontró inscripción actual para el alumno.",
      });
    }

    // 4. Actualizar la inscripción al nuevo horario
    const [numeroDeFilasActualizadas] = await InscripcionesPilatesModel.update(
      { id_horario: id_horario_nuevo },
      {
        where: {
          id: inscripcionActual.id,
        },
      }
    );

    if (numeroDeFilasActualizadas === 0) {
      return res.status(404).json({
        mensajeError: "No se pudo actualizar la inscripción actual.",
      });
    }

    // 5. Si fecha_nueva_fin no es null, actualizar fechas en clientes_pilates
    if (fecha_nueva_fin !== null && fecha_nueva_fin !== undefined) {
      const nuevaFechaInicio = dayjs(fecha_nueva_fin).format('YYYY-MM-DD');
      const nuevaFechaFin = dayjs(fecha_nueva_fin).add(1, 'day').format('YYYY-MM-DD');

      await ClientesPilatesModel.update(
        {
          fecha_inicio: nuevaFechaInicio,
          fecha_fin: nuevaFechaFin,
        },
        {
          where: { id: id_estudiante },
        }
      );
    }

    res.status(200).json({
      message: "¡Cambio de turno realizado con éxito!",
    });
  } catch (error) {
    // En caso de cualquier otro error, lo capturamos y lo mostramos.
    console.error("Error al cambiar el turno:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};

export const ER_InscripcionesByCliente_CTS = async (idCliente) => {
  try {
    // 1) Buscar inscripciones del cliente
    const inscripciones = await InscripcionesPilatesModel.findAll({
      where: { id_cliente: idCliente },
    });

    // 2) Eliminar asistencias e inscripciones
    for (const inscripcion of inscripciones) {
      // Eliminar asistencias ligadas a la inscripción
      await AsistenciasModel.destroy({
        where: { id_inscripcion: inscripcion.id },
      });
      // Eliminar la inscripción
      await inscripcion.destroy();
    }

    return {
      success: true,
      message: "Inscripciones y asistencias eliminadas correctamente",
    };
  } catch (error) {
    console.error("Error al eliminar inscripciones/asistencias:", error);
    throw new Error(
      "Error al eliminar inscripciones/asistencias: " + error.message
    );
  }
};
// Eliminar inscripción
export const ER_InscripcionesPilates_CTS = async (req, res) => {
  try {
    const { id } = req.params;

    const inscripcion = await InscripcionesPilatesModel.findByPk(id);
    if (!inscripcion) {
      return res
        .status(404)
        .json({ mensajeError: "Inscripción no encontrada" });
    }

    await inscripcion.destroy();
    res.json({ message: "Inscripción eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
