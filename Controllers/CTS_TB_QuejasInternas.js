/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 30/04/2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (CTS_TB_QuejasInternas.js) contiene controladores para manejar operaciones CRUD
 * y acciones especiales en el modelo QuejasInternas.
 * Tema: Controladores - Quejas Internas
 * Capa: Backend
 * Nomenclatura: OBR_ obtenerRegistro
 *               OBRS_obtenerRegistros(plural)
 *               CR_ crearRegistro
 *               UR_ actualizarRegistro
 *               ER_ eliminarRegistro
 */

// Importa el modelo
import MD_TB_QuejasInternas from '../Models/MD_TB_QuejasInternas.js';

// Asigna el modelo a una variable
const QuejasInternasModel = MD_TB_QuejasInternas.QuejasInternasModel;

// Obtener todas las quejas
export const OBRS_Quejas_CTS = async (req, res) => {
  try {
    const registros = await QuejasInternasModel.findAll({
      order: [['created_at', 'DESC']]
    });
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Obtener una queja por ID
export const OBR_Queja_CTS = async (req, res) => {
  try {
    const registro = await QuejasInternasModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear una nueva queja
export const CR_Queja_CTS = async (req, res) => {
  try {
    await QuejasInternasModel.create(req.body);
    res.json({ message: 'Queja registrada correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Actualizar una queja
export const UR_Queja_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await QuejasInternasModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await QuejasInternasModel.findByPk(id);
      res.json({
        message: 'Queja actualizada correctamente',
        registroActualizado
      });
    } else {
      res.status(404).json({ mensajeError: 'Queja no encontrada' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar una queja
export const ER_Queja_CTS = async (req, res) => {
  try {
    await QuejasInternasModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Queja eliminada correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Marcar como resuelto
export const MARCAR_Resuelto_Queja_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const { resuelto_por } = req.body; // nombre del usuario que resolvió

    const [numRowsUpdated] = await QuejasInternasModel.update(
      {
        resuelto: 1,
        resuelto_por,
        fecha_resuelto: new Date()
      },
      {
        where: { id }
      }
    );

    if (numRowsUpdated === 1) {
      res.json({ message: 'Queja marcada como resuelta' });
    } else {
      res.status(404).json({ mensajeError: 'Queja no encontrada' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Marcar como no resuelto (con confirmación desde el frontend)
export const MARCAR_NoResuelto_Queja_CTS = async (req, res) => {
  try {
    const { id } = req.params;

    const [numRowsUpdated] = await QuejasInternasModel.update(
      {
        resuelto: 0,
        resuelto_por: null,
        fecha_resuelto: null
      },
      {
        where: { id }
      }
    );

    if (numRowsUpdated === 1) {
      res.json({ message: 'Queja marcada como no resuelta' });
    } else {
      res.status(404).json({ mensajeError: 'Queja no encontrada' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
