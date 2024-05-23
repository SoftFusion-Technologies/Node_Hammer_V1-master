/*
/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 17 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_TextContents.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - TextContents
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla TextContents
// ----------------------------------------------------------------

// Importa los modelos necesarios desde el archivo 
import MD_TB_TextContents from '../Models/MD_TB_TextContents.js';

// Asigna los modelos a variables para su uso en los controladores
const TextContentsModel = MD_TB_TextContents.TextContentModel;

// Mostrar todos los registros de TextContentsModel
export const OBRS_TextContents_CTS = async (req, res) => {
  try {
    const registros = await TextContentsModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de TextContentsModel por su ID
export const OBR_TextContents_CTS = async (req, res) => {
  try {
    const registro = await TextContentsModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en TextContentsModel
export const CR_TextContents_CTS = async (req, res) => {
 try {
   const registro = await TextContentsModel.create(req.body);
   res.json({ message: 'Registro creado correctamente' });
 } catch (error) {
   res.json({ mensajeError: error.message });
 }
};

// Eliminar un registro en TextContentsModel por su ID
export const ER_TextContents_CTS = async (req, res) => {
  try {
    await TextContentsModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};
