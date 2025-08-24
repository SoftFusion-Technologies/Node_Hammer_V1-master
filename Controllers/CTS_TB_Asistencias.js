/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 22-10-2024
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (CTS_TB_Asistencias.js) contiene controladores para manejar operaciones CRUD en el modelo de asistencias.
 *
 * Tema: Controladores - Asistencias
 *
 * Capa: Backend
 *
 * Nomenclatura: OBR_ obtenerRegistro
 *               OBRS_obtenerRegistros(plural)
 *               CR_ crearRegistro
 *               ER_ eliminarRegistro
 */

// Importa los modelos necesarios desde el archivo de modelos
import MD_TB_Asistencias from '../Models/MD_TB_Asistencias.js';

// Asigna los modelos a variables para su uso en los controladores
const AsistenciasModel = MD_TB_Asistencias.AsistenciasModel;
import moment from 'moment'; // Asegúrate de que esta librería esté instalada
import { AlumnosModel } from '../Models/MD_TB_Alumnos.js';
// Controladores para operaciones CRUD en la tabla 'asistencias'

// Mostrar todos los registros de la tabla asistencias con filtro opcional
export const OBRS_Asistencias_CTS = async (req, res) => {
  try {
    const { mes, anio } = req.query;

    const filtros = {};
    if (mes) filtros.mes = mes;
    if (anio) filtros.anio = anio;

    const registros = await AsistenciasModel.findAll({
      where: filtros
    });

    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de Asistencias por su ID
export const OBR_Asistencias_CTS = async (req, res) => {
  try {
    const registro = await AsistenciasModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Agregar este nuevo endpoint
export const GET_Asistencia = async (req, res) => {
  const { alumno_id, dia, mes, anio } = req.params; // Deberías acceder a los parámetros de la URL

  try {
    const existingRecord = await AsistenciasModel.findOne({
      where: {
        alumno_id: alumno_id,
        dia: dia,
        mes: mes,
        anio: anio
      }
    });

    if (existingRecord) {
      return res.json({
        existe: true,
        id: existingRecord.id,
        estado: existingRecord.estado
      });
    }

    return res.json({ existe: false });
  } catch (error) {
    return res.status(500).json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en Asistencias
export const CR_Asistencias_CTS = async (req, res) => {
  try {
    const { alumno_id, dia, estado } = req.body;

    // Verificar si ya existe un registro con el mismo alumno_id y día (mes/año actuales)
    const existingRecord = await AsistenciasModel.findOne({
      where: {
        alumno_id: alumno_id,
        dia: dia,
        mes: new Date().getMonth() + 1, // Mes actual
        anio: new Date().getFullYear()   // Año actual
      }
    });

    if (existingRecord) {
      return res.status(400).json({ mensajeError: 'El registro ya existe' });
    }

    // Crear el registro
    const registro = await AsistenciasModel.create(req.body);

    // === Regla: prospecto con 2 'P' en el mes => SOLO setear c='c' (SIN amarillo aquí) ===
    try {
      if (estado === 'P') {
        const mesIns  = registro.mes;   // del registro creado
        const anioIns = registro.anio;

        // 1) Contar 'P' del mes/año
        const totalP = await AsistenciasModel.count({
          where: { alumno_id, estado: 'P', mes: mesIns, anio: anioIns }
        });

        if (totalP >= 2) {
          // 2) Traer el alumno del mismo mes/año
          const alumnoMes = await AlumnosModel.findOne({
            where: { id: alumno_id, mes: mesIns, anio: anioIns }
          });

          if (alumnoMes &&
              alumnoMes.prospecto === 'prospecto' &&
              (!alumnoMes.c || alumnoMes.c === '')) {
            // 3) Setear c='c' (solo este mes). NO marcar amarillo aquí.
            await alumnoMes.update({ c: 'c' });
          }
        }
      }
    } catch (reglaErr) {
      console.error('[Regla Prospecto P->C] Error:', reglaErr);
      // No rompemos la creación si falla la regla
    }

    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar un registro en Asistencias por su ID
export const ER_Asistencias_CTS = async (req, res) => {
  try {
    await AsistenciasModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Actualizar un registro de Asistencias (A -> P) y, si corresponde, setear c='c' (SIN amarillo)
export const UR_Asistencias_CTS = async (req, res) => {
  try {
    const { id } = req.params;     // ID de la asistencia
    const { estado } = req.body;   // Nuevo estado (ej: 'P')

    // 1) Buscar la asistencia
    const registroExistente = await AsistenciasModel.findByPk(id);
    if (!registroExistente) {
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }

    // 2) Si no hay cambios, devolvemos OK sin tocar nada
    if (registroExistente.estado === estado) {
      return res.status(200).json({ mensaje: 'No hay cambios en el estado' });
    }

    // 3) Actualizar estado
    registroExistente.estado = estado;
    await registroExistente.save();

    // 4) Regla: si quedó en 'P', evaluar si ya tiene 2 'P' en el mes ⇒ c='c' si es prospecto
    if (estado === 'P') {
      const { alumno_id, mes, anio } = registroExistente;

      // contar cuántas 'P' lleva en ese mes/año
      const totalP = await AsistenciasModel.count({
        where: { alumno_id, estado: 'P', mes, anio }
      });

      if (totalP >= 2) {
        // traer el alumno del mismo mes/año
        const alumnoMes = await AlumnosModel.findOne({
          where: { id: alumno_id, mes, anio }
        });

        // si es prospecto y aún no tiene 'c', setear c='c' (no marcamos amarillo aquí)
        if (alumnoMes &&
            alumnoMes.prospecto === 'prospecto' &&
            (!alumnoMes.c || alumnoMes.c === '')) {
          await alumnoMes.update({ c: 'c' });
        }
      }
    }

    return res.json({
      message: 'Registro actualizado correctamente',
      registroActualizado: registroExistente
    });
  } catch (error) {
    return res.status(500).json({ mensajeError: error.message });
  }
};

