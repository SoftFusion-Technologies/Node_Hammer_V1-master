/*
/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_AdmPrecio.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - AdmPrecio
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_AdmPrecio from '../Models/MD_TB_AdmPrecio.js';

// Asigna los modelos a variables para su uso en los controladores
const AdmPrecioModel = MD_TB_AdmPrecio.AdmPrecioModel;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'failed_jobs'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla failed_jobs

export const OBRS_AdmPrecio_CTS = async (req, res) => {
  try {
    const registros = await AdmPrecioModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de AdmPrecioModel por su ID
export const OBR_AdmPrecio_CTS = async (req, res) => {
  try {
    const registro = await AdmPrecioModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en AdmPrecioModel
export const CR_AdmPrecio_CTS = async (req, res) => {
  try {
    const registro = await AdmPrecioModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Eliminar un registro en AdmPrecioModel por su ID
export const ER_AdmPrecio_CTS = async (req, res) => {
  try {
    await AdmPrecioModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};
