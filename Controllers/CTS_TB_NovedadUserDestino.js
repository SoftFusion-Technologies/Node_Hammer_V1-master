/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_NovedadUserDestino.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - NovedadUserDestino
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_NovedadUserDestino from '../Models/MD_TB_NovedadUserDestino.js';

// Asigna los modelos a variables para su uso en los controladores
const NovedadUserDestinoModel = MD_TB_NovedadUserDestino.NovedadUserDestinoModel;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'novedad_user'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla NovedadesUser

export const OBRS_NovedadUserDestino_CTS = async (req, res) => {
  try {
    const registros = await NovedadUserDestinoModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de NovedadUserDestinoModel por su ID
export const OBR_NovedadUserDestino_CTS = async (req, res) => {
  try {
    const registro = await NovedadUserDestinoModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en NovedadUserDestinoModel
export const CR_NovedadUserDestino_CTS = async (req, res) => {
  try {
    const registro = await NovedadUserDestinoModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Eliminar un registro en NovedadUserDestinoModel por su ID
export const ER_NovedadUserDestino_CTS = async (req, res) => {
  try {
    await NovedadUserDestinoModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};
