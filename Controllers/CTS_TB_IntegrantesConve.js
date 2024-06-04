/*
/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_IntegrantesConve.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - IntegrantesConve
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_IntegrantesConve from '../Models/MD_TB_IntegrantesConve.js';

// Asigna los modelos a variables para su uso en los controladores
const IntegrantesConveModel = MD_TB_IntegrantesConve.IntegrantesConveModel;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'failed_jobs'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla failed_jobs

export const OBRS_IntegrantesConve_CTS = async (req, res) => {
  try {
    const registros = await IntegrantesConveModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de IntegrantesConveModel por su ID
export const OBR_IntegrantesConve_CTS = async (req, res) => {
  try {
    const registro = await IntegrantesConveModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en IntegrantesConveModel
export const CR_IntegrantesConve_CTS = async (req, res) => {
  try {
    const registro = await IntegrantesConveModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Eliminar un registro en IntegrantesConveModel por su ID
export const ER_IntegrantesConve_CTS = async (req, res) => {
  try {
    await IntegrantesConveModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};
