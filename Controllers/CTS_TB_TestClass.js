/*
/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 17 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_TestClass.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - TestClass
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla TestClassModel
// ----------------------------------------------------------------

// Importa los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_TestClass from '../Models/MD_TB_TestClass.js';

// Asigna los modelos a variables para su uso en los controladores
const TestClassModel = MD_TB_TestClass.TestClassModel;

// Mostrar todos los registros de TestClassModel
export const OBRS_TestClass_CTS = async (req, res) => {
  try {
    const registros = await TestClassModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de TestClassModel por su ID
export const OBR_TestClass_CTS = async (req, res) => {
  try {
    const registro = await TestClassModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en TestClassModel
export const CR_TestClass_CTS = async (req, res) => {
  try {
    const registro = await TestClassModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Eliminar un registro en TestClassModel por su ID
export const ER_TestClass_CTS = async (req, res) => {
  try {
    await TestClassModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};
