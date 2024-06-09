/*
/*
  * Programador: Benjamin Orellana
  * Fecha Creación: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_FamIntegrante.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - FamIntegrante
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_FamIntegrante from '../Models/MD_TB_FamIntegrante.js';

// Asigna los modelos a variables para su uso en los controladores
const FamIntegranteModel = MD_TB_FamIntegrante.FamIntegranteModel;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'failed_jobs'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla failed_jobs

export const OBRS_FamIntegrante_CTS = async (req, res) => {
  try {
    const registros = await FamIntegranteModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de FamIntegranteModel por su ID
export const OBR_FamIntegrante_CTS = async (req, res) => {
  try {
    const registro = await FamIntegranteModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en FamIntegranteModel
export const CR_FamIntegrante_CTS = async (req, res) => {
  try {
    const registro = await FamIntegranteModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Eliminar un registro en FamIntegranteModel por su ID
export const ER_FamIntegrante_CTS = async (req, res) => {
  try {
    await FamIntegranteModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Actualizar un registro en Integrante por su ID
export const UR_FamIntegrante_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await FamIntegranteModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await FamIntegranteModel.findByPk(id);
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
