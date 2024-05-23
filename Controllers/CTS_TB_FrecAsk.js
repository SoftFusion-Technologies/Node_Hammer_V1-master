  /*
  * Programador: Benjamin Orellana
  * Fecha Cración: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_FrecAsk.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - FrecAsk
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/
import MD_TB_FrecAsk from '../Models/MD_TB_FrecAsk.js';

const FrecAskModel = MD_TB_FrecAsk.FrecAskModel;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'frec_asks'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla FrecAskModel
export const OBRS_FrecAsk_CTS = async (req, res) => {
  try {
    const registros = await FrecAskModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de FrecAskModel por su ID
export const OBR_FrecAsk_CTS = async (req, res) => {
  try {
    const registro = await FrecAskModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en FrecAskModel
export const CR_FrecAsk_CTS = async (req, res) => {
  try {
    const registro = await FrecAskModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Eliminar un registro en TrabajoModel por su ID
export const ER_FrecAsk_CTS = async (req, res) => {
  try {
    await FrecAskModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};


// Actualizar un registro en SchedulerTaskModel por su ID
export const UR_FrecAsk_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await FrecAskModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await FrecAskModel.findByPk(id);
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
