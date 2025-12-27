/*
/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_AdmConve.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - AdmConve
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_AdmConve from '../Models/MD_TB_AdmConvenios.js';

// Asigna los modelos a variables para su uso en los controladores
const AdmConveniosModel = MD_TB_AdmConve.AdmConveniosModel;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'failed_jobs'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla failed_jobs

export const OBRS_AdmConve_CTS = async (req, res) => {
  try {
    const registros = await AdmConveniosModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de AdmConveniosModel por su ID
export const OBR_AdmConve_CTS = async (req, res) => {
  try {
    const registro = await AdmConveniosModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en AdmConveniosModel
export const CR_AdmConve_CTS = async (req, res) => {
  try {
    const registro = await AdmConveniosModel.create(req.body);

    //BENJAMIN ORELLANA - 22-12-2026 */
    // Devuelve el registro creado (incluye id) para que el front pueda abrir el modal de planes
    res.status(201).json({
      message: 'Registro creado correctamente',
      registro
    });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar un registro en AdmConveniosModel por su ID
export const ER_AdmConve_CTS = async (req, res) => {
  try {
    await AdmConveniosModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};


// Actualizar un registro en Users por su ID
export const UR_AdmConve_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await AdmConveniosModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await AdmConveniosModel.findByPk(id);
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
