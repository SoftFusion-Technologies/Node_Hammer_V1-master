/*
 * Programador: [Tu nombre]
 * Fecha Creación: [Fecha actual]
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo contiene controladores para manejar operaciones CRUD en el modelo InscripcionesPilates.
 *
 * Tema: Controladores - Inscripciones Pilates
 *
 * Capa: Backend
 *
 * Nomenclatura: OBR_ obtenerRegistro
 *               OBRS_obtenerRegistros(plural)
 *               CR_ crearRegistro
 *               ER_ eliminarRegistro
 *               UR_ actualizarRegistro
 */

import db from "../DataBase/db.js";
import InscripcionesPilatesModel from '../Models/MD_TB_InscripcionesPilates.js';
import AsistenciasPilatesModel from '../Models/MD_TB_AsistenciasPilates.js';
import ClientesPilatesModel from "../Models/MD_TB_ClientesPilates.js";
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

/**
 * Controlador: CR_InscripcionesPilates_CTS
 * Crea una nueva inscripción en la tabla inscripciones_pilates.
 *
 * Flujo:
 *  1. Valida que los campos requeridos estén presentes en el body.
 *  2. Busca el id del horario en la tabla horarios_pilates a partir de `dia` y `horario`.
 *  3. Si encuentra el horario, crea la inscripción asociando cliente y horario.
 *  4. Devuelve un JSON con la inscripción creada.
 *
 * Request Body esperado:
 *  {
 *    "id_cliente": number,        // ID del cliente a inscribir
 *    "dia": string,               // Día de la semana (ej: "Lunes")
 *    "horario": string,           // Hora en formato HH:mm (ej: "10:00")
 *    "fecha_inscripcion": string  // Fecha en formato YYYY-MM-DD
 *  }
 *
 * Respuestas:
 *  - 201: Inscripción creada con éxito.
 *  - 400: Algún campo requerido está ausente.
 *  - 404: No se encontró un horario válido para el día y hora indicados.
 *  - 500: Error interno del servidor (se incluye stack trace para debugging).
 */
/* export const CR_InscripcionesPilates_CTS = async (req, res) => {
  try {
    const { id_cliente, dia, horario, fecha_inscripcion, id_sede } = req.body;

    // 1) Validaciones iniciales
    if (!id_cliente || !dia || !horario || !fecha_inscripcion || !id_sede) {
      return res.status(400).json({
        mensajeError:
          "id_cliente, dia, horario y fecha_inscripcion son requeridos",
      });
    }

    // 2) Preparar patrón para búsqueda flexible del día (ej: %Lunes%)
    const diaPattern = `%${dia}%`;

    // 3) Buscar el id del horario correspondiente en la tabla horarios_pilates
    const horarioResult = await db.query(
      `SELECT id 
       FROM horarios_pilates
       WHERE dia_semana LIKE :diaPattern
         AND DATE_FORMAT(hora_inicio, '%H:%i') = :horario`,
      {
        replacements: {
          diaPattern: diaPattern,
          horario: horario,
        },
        type: db.QueryTypes.SELECT,
      }
    );

    // Si no encuentra coincidencias, devuelve 404 con info de debugging
    if (!horarioResult || horarioResult.length === 0) {
      return res.status(404).json({
        mensajeError: "No se encontró el horario con ese día y hora",
        debug: { dia, horario, diaPattern },
      });
    }

    // 4) Extraer id_horario encontrado
    const id_horario = horarioResult[0].id;

    // 5) Crear la inscripción en la tabla inscripciones_pilates
    const nuevaInscripcion = await InscripcionesPilatesModel.create({
      id_cliente,
      id_horario,
      fecha_inscripcion,
    });

    // 6) Respuesta exitosa
    res.status(201).json({
      message: "Inscripción creada correctamente",
      inscripcion: nuevaInscripcion,
    });
  } catch (error) {
    // Manejo centralizado de errores
    console.error("Error completo:", error);
    res.status(500).json({
      mensajeError: error.message,
      stack: error.stack, // incluir stack para debugging en desarrollo
    });
  }
};
 */
export const CR_InscripcionesPilates_CTS = async (req, res) => {
  try {
    const { id_cliente, dia, horario, fecha_inscripcion, id_sede } = req.body;

    // Validaciones básicas
    if (!id_cliente || !dia || !horario || !fecha_inscripcion || !id_sede) {
      return res.status(400).json({
        mensajeError: "id_cliente, dia, horario, fecha_inscripcion e id_sede son requeridos",
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
      console.log(`[Asistencia Automática] Creado registro de ausente para el nuevo cliente ID: ${id_cliente}`);
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

// controllers/InscripcionesPilatesController.js
/* export const ER_InscripcionesByCliente_CTS = async (idCliente) => {
  try {
    await InscripcionesPilatesModel.destroy({
      where: { id_cliente: idCliente },
    });
    
  } catch (error) {
    throw new Error("Error al eliminar inscripciones: " + error.message);
  }
}; */

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
