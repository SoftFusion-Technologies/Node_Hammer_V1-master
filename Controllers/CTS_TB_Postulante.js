/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_Postulante.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - Postulante
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa los modelos necesarios desde el archivo
import MD_TB_Postulante from '../Models/MD_TB_Postulante.js';

const PostulanteModel = MD_TB_Postulante.PostulanteModel;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'Postulante'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla Postulante

export const OBRS_Postulante_CTS = async (req, res) => {
  try {
    const registros = await PostulanteModel.findAll();
    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

export const OBR_Postulante_CTS = async (req, res) => {
  try {
    const registro = await PostulanteModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

export const CR_Postulante_CTS = async (req, res) => {
  try {
    const registro = await PostulanteModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};


export const ER_Postulante_CTS = async (req, res) => {
  try {
    await PostulanteModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar un registro en SchedulerTaskModel por su ID
export const UR_Postulante_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await PostulanteModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await PostulanteModel.findByPk(id);
      res.json({
        message: 'Registro actualizado correctamente',
        registroActualizado
      });
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};


