/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 17 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_SchedulerTask.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - SchedulerTask
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa los modelos necesarios desde el archivo
import MD_TB_SchedulerTask from '../Models/MD_TB_SchedulerTask.js';

const SchedulerTaskModel = MD_TB_SchedulerTask.SchedulerTaskModel;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'SchedulerTask'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla SchedulerTask

export const OBRS_SchedulerTask_CTS = async (req, res) => {
  try {
    const registros = await SchedulerTaskModel.findAll();
    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

export const OBR_SchedulerTask_CTS = async (req, res) => {
  try {
    const registro = await SchedulerTaskModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

export const CR_SchedulerTask_CTS = async (req, res) => {
  try {
    const registro = await SchedulerTaskModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

export const ER_SchedulerTask_CTS = async (req, res) => {
  try {
    await SchedulerTaskModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar un registro en SchedulerTaskModel por su ID
export const UR_SchedulerTask_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await SchedulerTaskModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await SchedulerTaskModel.findByPk(id);
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
