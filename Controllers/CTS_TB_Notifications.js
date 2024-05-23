/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_Notifications.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - Notifications
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_Notifications from '../Models/MD_TB_Notifications.js';

// Asigna los modelos a variables para su uso en los controladores
const NotificationsModel = MD_TB_Notifications.NotificationsModel;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'notifications'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla notifications


export const OBRS_Notifications_CTS = async (req, res) => {
  try {
    const registros = await NotificationsModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de NotificationsModel por su ID
export const OBR_Notifications_CTS = async (req, res) => {
  try {
    const registro = await NotificationsModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en NotificationsModel
export const CR_Notifications_CTS = async (req, res) => {
   try {
     const registro = await NotificationsModel.create(req.body);
     res.json({ message: 'Registro creado correctamente' });
   } catch (error) {
     res.json({ mensajeError: error.message });
   }
};

// Eliminar un registro en NotificationsModel por su ID
export const ER_Notifications_CTS = async (req, res) => {
  try {
    await NotificationsModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};