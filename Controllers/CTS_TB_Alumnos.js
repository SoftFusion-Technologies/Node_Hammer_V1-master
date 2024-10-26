/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 22-10-2024
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (CTS_TB_Alumnos.js) contiene controladores para manejar operaciones CRUD en el modelo de alumnos.
 *
 * Tema: Controladores - Alumnos
 *
 * Capa: Backend
 *
 * Nomenclatura: OBR_ obtenerRegistro
 *               OBRS_obtenerRegistros(plural)
 *               CR_ crearRegistro
 *               ER_ eliminarRegistro
 */

// Importa los modelos necesarios desde el archivo de modelos
import MD_TB_Alumnos from '../Models/MD_TB_Alumnos.js';

// Asigna los modelos a variables para su uso en los controladores
const AlumnosModel = MD_TB_Alumnos.AlumnosModel;


// Controladores para operaciones CRUD en la tabla 'alumnos'

// Mostrar todos los registros de la tabla alumnos
export const OBRS_Alumnos_CTS = async (req, res) => {
  try {
    const registros = await AlumnosModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de Alumnos por su ID
export const OBR_Alumnos_CTS = async (req, res) => {
  try {
    const registro = await AlumnosModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en Alumnos
export const CR_Alumnos_CTS = async (req, res) => {
  try {
    const registro = await AlumnosModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};


// Eliminar un registro en Alumnos por su ID
export const ER_Alumnos_CTS = async (req, res) => {
  try {
    await AlumnosModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Actualizar un registro en Alumnos por su ID
export const UR_Alumnos_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await AlumnosModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await AlumnosModel.findByPk(id);
      res.json({
        message: 'Registro actualizado correctamente',
        registroActualizado
      });
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
