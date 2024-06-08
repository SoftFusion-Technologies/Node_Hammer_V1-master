/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    * Este archivo (CTS_TB_ImagenesConve.js) contiene controladores para manejar operaciones CRUD en la tabla de imágenes relacionadas con los convenios.
  * Tema: Controladores - Imágenes de Convenios
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_ImagenesConve from '../Models/MD_TB_ImagesConve.js';

// Asigna los modelos a variables para su uso en los controladores
const ImagenesConveModel = MD_TB_ImagenesConve.ImagesConveModel;

// Controladores para operaciones CRUD en la tabla de imágenes relacionadas con los convenios
// ----------------------------------------------------------------

// Controlador para cargar una imagen
export const cargarImagen = async (req, res) => {
  try {
    // Obtiene los datos de la imagen y el ID del convenio del cuerpo de la solicitud
    const { imagen, id_conv } = req.body;

    // Guarda la imagen en la base de datos
    const nuevaImagen = await ImagesConveModel.create({
      imagen,
      id_conv
    });

    // Si la inserción fue exitosa, devuelve una respuesta con el ID de la imagen
    res.status(200).json({ id_imagen: nuevaImagen.id });
  } catch (error) {
    // Si hay un error, devuelve una respuesta de error
    console.error('Error al cargar la imagen:', error);
    res.status(500).json({ mensaje: 'Error al cargar la imagen.' });
  }
};

// Mostrar todas las imágenes relacionadas con un convenio
export const OBRS_ImagenConve_CTS = async (req, res) => {
 try {
     const registros = await ImagenesConveModel.findAll();
     res.json(registros);
   } catch (error) {
     res.json({ mensajeError: error.message });
  }
};

// Mostrar una imagen específica por su ID
export const OBR_ImagenConve_CTS = async (req, res) => {
  try {
    const imagen = await ImagenesConveModel.findByPk(req.params.id);
    res.json(imagen);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la imagen' });
  }
};

// Crear un nuevo registro en AdmConveniosModel
export const CR_ImagenConve_CTS = async (req, res) => {
  try {
    const registro = await AdmConveniosModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Eliminar una imagen por su ID
export const ER_ImagenConve_CTS = async (req, res) => {
  try {
    await ImagenesConveModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Imagen eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la imagen' });
  }
};
