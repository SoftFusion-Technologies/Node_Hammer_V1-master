/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_PersonalAccessTokens.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - PersonalAccessTokens
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa los modelos necesarios desde el archivo 
import MD_TB_PersonalAccessTokens from '../Models/MD_TB_PersonalAccessTokens.js';

const PersonalAccessTokensModel = MD_TB_PersonalAccessTokens;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'PersonalAccessTokens'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla PersonalAccessTokens

export const OBRS_PersonalAccessTokens_CTS = async (req, res) => {
  try {
    const registros = await PersonalAccessTokensModel.findAll();
    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

export const OBR_PersonalAccessTokens_CTS = async (req, res) => {
  try {
    const registro = await PersonalAccessTokensModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

export const CR_PersonalAccessTokens_CTS = async (req, res) => {
  try {
    const registro = await PersonalAccessTokensModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

export const ER_PersonalAccessTokens_CTS = async (req, res) => {
  try {
    await PersonalAccessTokensModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
