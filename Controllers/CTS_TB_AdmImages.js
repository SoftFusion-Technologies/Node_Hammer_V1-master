/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 25   /08/2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_AdmConveniosImages.js) contiene controladores para manejar operaciones CRUD en el modelo Sequelize de adm_convenio_images.
  * Tema: Controladores - AdmConveniosImages
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa el modelo necesario
import MD_TB_AdmConveniosImages from '../Models/MT_TB_AdmImages.js';

const AdmConveniosImages = MD_TB_AdmConveniosImages.AdmConveniosImages;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'adm_convenio_images'
// ----------------------------------------------------------------

// Mostrar todos los registros de la tabla adm_convenio_images
export const OBRS_AdmConveniosImages_CTS = async (req, res) => {
  try {
    const registros = await AdmConveniosImages.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de adm_convenio_images por su ID
export const OBR_AdmConveniosImages_CTS = async (req, res) => {
  try {
    const registro = await AdmConveniosImages.findByPk(req.params.id);
    if (registro) {
      res.json(registro);
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en adm_convenio_images
export const CR_AdmConveniosImages_CTS = async (req, res) => {
  try {
    const registro = await AdmConveniosImages.create(req.body);
    res.json({ message: 'Imagen creada correctamente', registro });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar un registro en adm_convenio_images por su ID
export const ER_AdmConveniosImages_CTS = async (req, res) => {
  try {
    const numRowsDeleted = await AdmConveniosImages.destroy({
      where: { id: req.params.id }
    });
    if (numRowsDeleted === 1) {
      res.json({ message: 'Imagen eliminada correctamente' });
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar un registro en adm_convenio_images por su ID
export const UR_AdmConveniosImages_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await AdmConveniosImages.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await AdmConveniosImages.findByPk(id);
      res.json({
        message: 'Imagen actualizada correctamente',
        registroActualizado
      });
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
