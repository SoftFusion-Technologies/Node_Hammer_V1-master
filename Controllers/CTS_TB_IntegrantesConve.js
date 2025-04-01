/*
/*
  * Programador: Benjamin Orellana
  * Fecha Creación: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_IntegrantesConve.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - IntegrantesConve
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_IntegrantesConve from '../Models/MD_TB_IntegrantesConve.js';

// Asigna los modelos a variables para su uso en los controladores
const IntegrantesConveModel = MD_TB_IntegrantesConve.IntegrantesConveModel;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'failed_jobs'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla failed_jobs

export const OBRS_IntegrantesConve_CTS = async (req, res) => {
  try {
    const registros = await IntegrantesConveModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de IntegrantesConveModel por su ID
export const OBR_IntegrantesConve_CTS = async (req, res) => {
  try {
    const registro = await IntegrantesConveModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en IntegrantesConveModel
export const CR_IntegrantesConve_CTS = async (req, res) => {
  try {
    const registro = await IntegrantesConveModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Eliminar un registro en IntegrantesConveModel por su ID
export const ER_IntegrantesConve_CTS = async (req, res) => {
  try {
    await IntegrantesConveModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Actualizar un registro en Integrante por su ID
export const UR_IntegrantesConve_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await IntegrantesConveModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await IntegrantesConveModel.findByPk(id);
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

// R6-AutorizarIntegrantes - Benjamin Orellana 15-09-24 - Inicio
// Actualizar el estado de autorización de un integrante
export const Autorizar_Integrante_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado_autorizacion } = req.body;

    // Validar que el estado de autorización sea correcto
    const validStates = ['sin_autorizacion', 'pendiente', 'autorizado'];
    if (!validStates.includes(estado_autorizacion)) {
      return res.status(400).json({ mensajeError: 'Estado de autorización no válido' });
    }

    const [numRowsUpdated] = await IntegrantesConveModel.update(
      { estado_autorizacion },
      { where: { id } }
    );

    if (numRowsUpdated === 1) {
      const registroActualizado = await IntegrantesConveModel.findByPk(id);
      res.json({
        message: 'Estado de autorización actualizado correctamente',
        registroActualizado
      });
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
// R6-AutorizarIntegrantes - Benjamin Orellana 15-09-24 - Final

// Autorizar todos los integrantes de un convenio específico
export const Autorizar_Integrantes_Por_Convenio = async (req, res) => {
  try {
    const { id_conv } = req.params; // Obtener el ID del convenio desde la URL
    const estado_autorizacion = 'autorizado';

    // Verificar si existen integrantes en ese convenio
    const integrantes = await IntegrantesConveModel.findAll({ where: { id_conv } });
    if (integrantes.length === 0) {
      return res.status(404).json({ mensajeError: 'No se encontraron integrantes para este convenio' });
    }

    // Actualizar el estado de autorización
    await IntegrantesConveModel.update(
      { estado_autorizacion },
      { where: { id_conv } }
    );

    // Obtener los registros actualizados
    const registrosActualizados = await IntegrantesConveModel.findAll({ where: { id_conv } });

    res.json({
      message: `Se autorizaron ${registrosActualizados.length} integrantes del convenio ${id_conv}`,
      registrosActualizados
    });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
