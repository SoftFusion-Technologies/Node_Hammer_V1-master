/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 14/09/2024
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (CTS_TB_NovedadArchivos.js) contiene controladores para manejar operaciones CRUD en el modelo Sequelize de novedad_archivos.
 * Tema: Controladores - NovedadArchivos
 *
 * Capa: Backend
 *
 * Nomenclatura: OBR_ obtenerRegistro
 *               OBRS_obtenerRegistros(plural)
 *               CR_ crearRegistro
 *               ER_ eliminarRegistro
 */

// Importa el modelo necesario
import MD_TB_NovedadesArchivos from '../Models/MD_TB_NovedadesArchivos.js';

const NovedadesArchivos = MD_TB_NovedadesArchivos.NovedadesArchivos;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'novedad_archivos'
// ----------------------------------------------------------------

// Mostrar todos los registros de la tabla novedad_archivos
export const OBRS_NovedadArchivos_CTS = async (req, res) => {
  try {
    const registros = await NovedadesArchivos.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de novedad_archivos por su ID
export const OBR_NovedadArchivos_CTS = async (req, res) => {
  try {
    const registro = await NovedadesArchivos.findByPk(req.params.id);
    if (registro) {
      res.json(registro);
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en novedad_archivos
export const CR_NovedadArchivos_CTS = async (req, res) => {
  try {
    const { novedad_id, nombre_archivo, ruta_archivo } = req.body; // Asegúrate de que estos campos estén presentes en el body
    const registro = await NovedadesArchivos.create({
      novedad_id,
      nombre_archivo,
      ruta_archivo
    });
    res.json({ message: 'Archivo creado correctamente', registro });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar un registro en novedad_archivos por su ID
export const ER_NovedadArchivos_CTS = async (req, res) => {
  try {
    const numRowsDeleted = await NovedadesArchivos.destroy({
      where: { id: req.params.id }
    });
    if (numRowsDeleted === 1) {
      res.json({ message: 'Archivo eliminado correctamente' });
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar un registro en novedad_archivos por su ID
export const UR_NovedadArchivos_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await NovedadesArchivos.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await NovedadesArchivos.findByPk(id);
      res.json({
        message: 'Archivo actualizado correctamente',
        registroActualizado
      });
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};