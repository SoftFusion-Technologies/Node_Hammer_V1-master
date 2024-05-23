/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 15 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_Migrations.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - Migrations
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_Migrations from '../Models/MD_TB_Migrations.js';

// Asigna los modelos a variables para su uso en los controladores
const MigrationModel = MD_TB_Migrations.MigrationModel;


// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'migrations'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla MigrationModel
export const OBRS_Migration_CTS = async (req, res) => {
  try {
    const registros = await MigrationModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de MigrationModel por su ID
export const OBR_Migration_CTS = async (req, res) => {
  try {
    const registro = await MigrationModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en MigrationModel
export const CR_Migration_CTS = async (req, res) => {
  try {
    const registro = await MigrationModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Eliminar un registro en TrabajoModel por su ID
export const ER_Migration_CTS = async (req, res) => {
  try {
    await MigrationModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};