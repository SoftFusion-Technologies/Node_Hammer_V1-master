/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 22-10-2024
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (CTS_TB_AgendaImagenes.js) contiene controladores para manejar operaciones CRUD en el modelo de agenda_imagenes.
 *
 * Tema: Controladores - Agenda Imágenes
 *
 * Capa: Backend
 *
 * Nomenclatura: OBR_ obtenerRegistro
 *               OBRS_obtenerRegistros(plural)
 *               CR_ crearRegistro
 *               ER_ eliminarRegistro
 */

// Importa los modelos necesarios desde el archivo de modelos
import MD_TB_AgendaImagenes from '../Models/MD_TB_AgendaImages.js';

// Asigna los modelos a variables para su uso en los controladores
const AgendaImagenesModel = MD_TB_AgendaImagenes.AgendaImagenesModel;

// Controladores para operaciones CRUD en la tabla 'agenda_imagenes'

// Mostrar todos los archivos relacionados con una agenda específica
export const OBRS_AgendaImagenes_CTS = async (req, res) => {
  const { agenda_id } = req.params;
  try {
    const archivos = await AgendaImagenesModel.findAll({
      where: { agenda_id }
    });

    if (archivos.length === 0) {
      return res
        .status(404)
        .json({ message: 'No hay archivos para esta agenda' });
    }

    res.status(200).json(archivos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener los archivos' });
  }
};

export const ER_AgendaImagenes_CTS = async (req, res) => {
  try {
    const { archivoId } = req.params; // Usa archivoId en lugar de id

    // Eliminar el archivo en la base de datos
    await AgendaImagenesModel.destroy({ where: { id: archivoId } });

    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

