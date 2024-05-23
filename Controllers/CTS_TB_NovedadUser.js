/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_NovedadUser.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - NovedadUser
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_NovedadUser from '../Models/MD_TB_NovedadUser.js';

// Asigna los modelos a variables para su uso en los controladores
const NovedadUserModel = MD_TB_NovedadUser.NovedadUserModel;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'novedad_user'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla NovedadesUser

export const OBRS_NovedadUser_CTS = async (req, res) => {
  try {
    const registros = await NovedadUserModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de NovedadUserModel por su ID
export const OBR_NovedadUser_CTS = async (req, res) => {
  try {
    const registro = await NovedadUserModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en NovedadUserModel
export const CR_NovedadUser_CTS = async (req, res) => {
   try {
     const registro = await NovedadUserModel.create(req.body);
     res.json({ message: 'Registro creado correctamente' });
   } catch (error) {
     res.json({ mensajeError: error.message });
   }
};

// Eliminar un registro en NovedadUserModel por su ID
export const ER_NovedadUser_CTS = async (req, res) => {
  try {
    await NovedadUserModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};
