/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_FrecAsk.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - FrecAsk
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/
import MD_TB_FrecAsk from '../Models/MD_TB_FrecAsk.js';

const FrecAskModel = MD_TB_FrecAsk.FrecAskModel;

import NotificationModel from '../Models/MD_TB_Notifications.js'; // Asegúrate de importar tu modelo de notificación

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'frec_asks'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla FrecAskModel
export const OBRS_FrecAsk_CTS = async (req, res) => {
  try {
    const registros = await FrecAskModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de FrecAskModel por su ID
export const OBR_FrecAsk_CTS = async (req, res) => {
  try {
    const registro = await FrecAskModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en FrecAskModel y disparar la notificación
export const CR_FrecAsk_CTS = async (req, res) => {
  const { titulo, descripcion, userName } = req.body;

  try {
    // 1. Crear el registro de la pregunta frecuente
    const registro = await FrecAskModel.create(req.body); // Se utiliza req.body como ya funciona

    // 2. Crear la notificación relacionada usando Sequelize
    const notiTitle = 'Nueva pregunta frecuente registrada';
    const notiMessage = `Pregunta frecuente: ${titulo}. Descripción: ${descripcion}`;
    const module = 'frecuentes'; // El módulo de preguntas frecuentes
    const reference_id = registro.id; // ID de la nueva pregunta frecuente
    const seen_by = []; // Lista de usuarios que han visto la notificación (vacío por ahora)
    const created_by = 'admin'; // Usuario que creó la pregunta frecuente

    // 3. Crear la notificación en la base de datos
    await NotificationModel.create({
      title: notiTitle,
      message: notiMessage,
      module: module,
      reference_id: reference_id,
      seen_by: seen_by,
      created_by: created_by
    });

    // Responder con un mensaje de éxito
    res.json({
      message:
        'Pregunta frecuente registrada y notificación enviada correctamente'
    });
  } catch (error) {
    // Manejo de errores
    console.error(error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar un registro en TrabajoModel por su ID
export const ER_FrecAsk_CTS = async (req, res) => {
  try {
    await FrecAskModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Actualizar un registro en SchedulerTaskModel por su ID
export const UR_FrecAsk_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await FrecAskModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await FrecAskModel.findByPk(id);
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
