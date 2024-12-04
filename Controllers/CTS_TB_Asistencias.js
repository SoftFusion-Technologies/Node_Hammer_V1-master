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

// Controladores para operaciones CRUD en la tabla 'asistencias'

// Mostrar todos los registros de la tabla asistencias
export const OBRS_Asistencias_CTS = async (req, res) => {
  try {
    const registros = await AsistenciasModel.findAll();
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
  const { alumno_id, dia, mes, anio} = req.params; // Deberías acceder a los parámetros de la URL

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
    const { alumno_id, dia, estado} = req.body;

    // Verificar si ya existe un registro con el mismo alumno_id, dia y estado
    const existingRecord = await AsistenciasModel.findOne({
      where: {
        alumno_id: alumno_id,
        dia: dia,
        mes: new Date().getMonth() + 1, // Mes actual (ten en cuenta que en JavaScript los meses van de 0 a 11)
        anio: new Date().getFullYear() // Año actual
      }
    });

    // Si existe, retornar un mensaje de error
    if (existingRecord) {
      return res.status(400).json({ mensajeError: 'El registro ya existe' });
    }

    // Si no existe, crear un nuevo registro
    const registro = await AsistenciasModel.create(req.body);
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

// Actualizar un registro en Asistencias por su ID
export const UR_Asistencias_CTS = async (req, res) => {
  try {
    const { id } = req.params; // Obtener el ID del registro a actualizar
    const { estado } = req.body; // Extraer solo el estado del cuerpo de la solicitud

    // Buscar el registro existente
    const registroExistente = await AsistenciasModel.findByPk(id);
    if (!registroExistente) {
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }

    // Verificar si el estado ha cambiado
    if (registroExistente.estado !== estado) {
      // Actualizar el registro
      registroExistente.estado = estado; // Actualiza el estado
      await registroExistente.save(); // Guarda los cambios

      return res.json({
        message: 'Registro actualizado correctamente',
        registroActualizado: registroExistente
      });
    } else {
      return res.status(200).json({ mensaje: 'No hay cambios en el estado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
