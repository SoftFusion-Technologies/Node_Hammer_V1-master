/*
/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_FailedJobs.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - FailedJobs
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/



// Importa los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_FailedJobs from '../Models/MD_TB_FailedJobs.js';

// Asigna los modelos a variables para su uso en los controladores
const TrabajoModel = MD_TB_FailedJobs.TrabajoModel;


// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'failed_jobs'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla failed_jobs

export const OBRS_Trabajo_CTS = async (req, res) => {
  try {
    const registros = await TrabajoModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de TrabajoModel por su ID
export const OBR_Trabajo_CTS = async (req, res) => {
  try {
    const registro = await TrabajoModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en TrabajoModel
export const CR_Trabajo_CTS = async (req, res) => {
  try {
    const registro = await TrabajoModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Eliminar un registro en TrabajoModel por su ID
export const ER_Trabajo_CTS = async (req, res) => {
  try {
    await TrabajoModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};