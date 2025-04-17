/*
  * Programador: Benjamin Orellana
  * Fecha Creación:  17 de Abril 2025
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_Sedes.js) contiene controladores para manejar operaciones CRUD en el modelo 'SedeModel'.
   
  * Tema: Controladores - Sedes
  
  * Capa: Backend
  
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla SedeModel
// ----------------------------------------------------------------

// Importa el modelo SedeModel desde el archivo de modelos
import MD_TB_sedes from '../Models/MD_TB_sedes.js';

const SedeModel = MD_TB_sedes.SedeModel;


// Mostrar todos los registros de sedes
export const OBRS_Sede_CTS = async (req, res) => {
  try {
    const registros = await SedeModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de sede por su ID
export const OBR_Sede_CTS = async (req, res) => {
  try {
    const registro = await SedeModel.findByPk(req.params.id);
    if (registro) {
      res.json(registro);
    } else {
      res.status(404).json({ mensajeError: 'Sede no encontrada' });
    }
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en SedeModel
export const CR_Sede_CTS = async (req, res) => {
  try {
    const { nombre, estado } = req.body;
    const registro = await SedeModel.create({ nombre, estado });
    res.json({ message: 'Sede creada correctamente', registro });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Eliminar un registro de SedeModel por su ID
export const ER_Sede_CTS = async (req, res) => {
  try {
    const numRowsDeleted = await SedeModel.destroy({
      where: { id: req.params.id }
    });
    if (numRowsDeleted === 1) {
      res.json({ message: 'Sede eliminada correctamente' });
    } else {
      res.status(404).json({ mensajeError: 'Sede no encontrada' });
    }
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Actualizar un registro de SedeModel por su ID
export const UR_Sede_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await SedeModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await SedeModel.findByPk(id);
      res.json({
        message: 'Sede actualizada correctamente',
        registroActualizado
      });
    } else {
      res.status(404).json({ mensajeError: 'Sede no encontrada' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
;
