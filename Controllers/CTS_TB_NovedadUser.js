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
// Importa el modelo desde el archivo MD_TB_NovedadUser.js
import NovedadUserModel from '../Models/MD_TB_NovedadUser.js';

// Controlador para obtener todos los registros
export const OBRS_NovedadUser_CTS = async (req, res) => {
  try {
    // Verifica si el modelo está correctamente importado
    if (!NovedadUserModel) {
      throw new Error('Modelo NovedadUserModel no está definido.');
    }

    const registros = await NovedadUserModel.findAll();
    res.json(registros);
  } catch (error) {
    console.error('Error al obtener los registros:', error); // Imprime el error en la consola para depuración
    res
      .status(500)
      .json({
        mensajeError: `Error al obtener los registros: ${error.message}`
      });
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

// Controlador para marcar una novedad como leída por un usuario específico
export const UPDATE_NovedadUser_CTS = async (req, res) => {
  const { id } = req.params;

  try {
    // Verifica que el parámetro 'id' esté presente
    if (!id) {
      return res.status(400).json({ mensajeError: 'Falta el parámetro ID.' });
    }

    // Encuentra el registro en la base de datos
    const novedadUser = await NovedadUserModel.findByPk(id);

    // Verifica si el registro existe
    if (!novedadUser) {
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    // Cambia el estado 'leido'
    novedadUser.leido = novedadUser.leido === 1 ? 0 : 1;

    // Guarda los cambios
    await novedadUser.save();

    res.json(novedadUser);
  } catch (error) {
    console.error('Error al actualizar el estado:', error);
    res.status(500).json({
      mensajeError: `Error al actualizar el estado: ${error.message}`
    });
  }
};