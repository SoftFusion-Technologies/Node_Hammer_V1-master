/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 12/12/2024
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (CTS_TB_AgendaMotivos.js) contiene controladores para manejar operaciones CRUD en el modelo Sequelize AgendaMotivosModel.
 *
 * Tema: Controladores - Agenda Motivos
 *
 * Capa: Backend
 *
 * Nomenclatura: OBR_ obtenerRegistro
 *               OBRS_obtenerRegistros (plural)
 *               CR_ crearRegistro
 *               ER_ eliminarRegistro
 *               UR_ actualizarRegistro
 */

// Importa los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_AgendaMotivos from '../Models/MD_TB_AgendaMotivos.js';

// Asigna los modelos a variables para su uso en los controladores
const AgendaMotivosModel = MD_TB_AgendaMotivos.AgendaMotivosModel;
// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla agenda_motivos
// ----------------------------------------------------------------

// Mostrar todos los registros de la tabla agenda_motivos
export const OBRS_AgendaMotivos_CTS = async (req, res) => {
  try {
    const registros = await AgendaMotivosModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de agenda_motivos por su ID
export const OBR_AgendaMotivos_CTS = async (req, res) => {
  try {
    const registro = await AgendaMotivosModel.findByPk(req.params.id);
    if (registro) {
      res.json(registro);
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en agenda_motivos
export const CR_AgendaMotivos_CTS = async (req, res) => {
  try {
    console.log('Datos recibidos en el backend:', req.body);
    const registro = await AgendaMotivosModel.create(req.body);
    res.json({ message: 'Registro creado correctamente', registro });
  } catch (error) {
    console.error('Error al crear el registro:', error);
    res.json({ mensajeError: error.message });
  }
};

// Eliminar un registro en agenda_motivos por su ID
export const ER_AgendaMotivos_CTS = async (req, res) => {
  try {
    const deleted = await AgendaMotivosModel.destroy({
      where: { id: req.params.id }
    });
    if (deleted) {
      res.json({ message: 'Registro eliminado correctamente' });
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Actualizar un registro en agenda_motivos por su ID
export const UR_AgendaMotivos_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await AgendaMotivosModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await AgendaMotivosModel.findByPk(id);
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
