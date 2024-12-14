/*
  * Programador: Benjamín Orellana
  * Fecha Creación: 14/12/2024
  * Versión: 1.0
  *
  * Descripción:
    * Este archivo (CTS_TB_ImagenesPreguntasFrec.js) contiene controladores para manejar operaciones CRUD en el modelo Sequelize de imagenes_preguntas_frec.
  * Tema: Controladores - ImagenesPreguntasFrec
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
  *               UR_ actualizarRegistro
*/

// Importa el modelo necesario
import MD_TB_ImagenesPreguntasFrec from '../Models/MD_TB_ImagenesPreguntasFrec.js';

const ImagenesPreguntasFrecModel =
  MD_TB_ImagenesPreguntasFrec.ImagenesPreguntasFrecModel;

import MD_TB_FrecAsk from '../Models/MD_TB_FrecAsk.js';

const FrecAskModel = MD_TB_FrecAsk.FrecAskModel;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'imagenes_preguntas_frec'
// ----------------------------------------------------------------

// Mostrar todos los registros de la tabla imagenes_preguntas_frec
// Controlador para obtener imágenes y preguntas
// Obtener imágenes asociadas a una pregunta filtrando por el ID de la pregunta
export const OBRS_ImagenesPreguntasFrec_CTS = async (req, res) => {
  try {
    const { pregunta_id } = req.params; // Obtén el ID de la pregunta desde los parámetros

    const registros = await ImagenesPreguntasFrecModel.findAll({
      where: { pregunta_id }, // Filtra las imágenes por el ID de la pregunta
      include: {
        model: FrecAskModel, // Relaciona con la tabla de preguntas
        as: 'pregunta', // Alias para la relación
        attributes: ['id'] // Solo obtenemos el ID de la pregunta
      }
    });

    if (registros) {
      res.json(registros); // Devuelve las imágenes asociadas a esa pregunta
    } else {
      res.status(404).json({
        mensajeError: 'No se encontraron imágenes para esta pregunta'
      });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener una imagen por el ID de la pregunta
export const OBR_ImagenPorPregunta_CTS = async (req, res) => {
  try {
    const { pregunta_id } = req.params;

    // Busca la imagen asociada al `pregunta_id`
    const imagen = await ImagenesPreguntasFrecModel.findOne({
      where: { pregunta_id },
      attributes: ['nombre_archivo', 'ruta_archivo']
    });

    if (imagen) {
      res.json({
        id: imagen.id, // Devuelve el id junto con el nombre del archivo
        imagen: `${imagen.nombre_archivo}`
      });
    } else {
      res
        .status(404)
        .json({ mensajeError: 'Imagen no encontrada para esta pregunta' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar un registro en imagenes_preguntas_frec por su ID
export const ER_ImagenesPreguntasFrec_CTS = async (req, res) => {
  try {
    const numRowsDeleted = await ImagenesPreguntasFrecModel.destroy({
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

// Modelo ImagenesPreguntasFrecModel
ImagenesPreguntasFrecModel.belongsTo(FrecAskModel, {
  foreignKey: 'pregunta_id',
  as: 'pregunta' // Aquí defines el alias 'pregunta'
});

// Modelo FrecAskModel
FrecAskModel.hasMany(ImagenesPreguntasFrecModel, {
  foreignKey: 'pregunta_id',
  as: 'imagenes'
});
