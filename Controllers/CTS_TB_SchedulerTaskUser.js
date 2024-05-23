/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 17 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_SchedulerTaskUser.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - SchedulerTaskUser
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
  * Contacto: 3863531891
*/

// Importa los modelos necesarios desde el archivo
import MD_TB_SchedulerTaskUser from '../Models/MD_TB_SchedulerTaskUser.js';

const SchedulerTaskUserModel = MD_TB_SchedulerTaskUser.SchedulerTaskUserModel;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'SchedulerTaskUser'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla SchedulerTaskUser

export const OBRS_SchedulerTaskUser_CTS = async (req, res) => {
  try {
    const registros = await SchedulerTaskUserModel.findAll();
    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

export const OBR_SchedulerTaskUser_CTS = async (req, res) => {
  try {
    const registro = await SchedulerTaskUserModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

export const CR_SchedulerTaskUser_CTS = async (req, res) => {
   try {
     const registro = await SchedulerTaskUserModel.create(req.body);
     res.json({ message: 'Registro creado correctamente' });
   } catch (error) {
     res.json({ mensajeError: error.message });
   }
};

export const ER_SchedulerTaskUser_CTS = async (req, res) => {
  try {
    await SchedulerTaskUserModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
