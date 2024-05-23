/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_PassReset.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - PassReset
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_PassReset from '../Models/MD_TB_PassReset.js';

// Asigna los modelos a variables para su uso en los controladores
const PassResetModel =  MD_TB_PassReset.PassResetModel;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'password_reset'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla password_reset

export const OBRS_PassReset_CTS = async (req, res) => {
  try {
    const registros = await PassResetModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de PassResetModel por su ID
export const OBR_PassReset_CTS = async (req, res) => {
  try {
    const registro = await PassResetModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en PassResetModel
export const CR_PassReset_CTS = async (req, res) => {
  try {
    const registro = await PassResetModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Eliminar un registro en PassResetModel por su ID
export const ER_PassReset_CTS = async (req, res) => {
  try {
    await PassResetModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};
