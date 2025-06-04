/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 03/06/2025
 * Versión: 1.0
 *
 * Descripción:
 * Controladores para manejar asignaciones entre usuarios y tareas diarias.
 *
 * Tema: Controladores - Asignaciones de Tareas
 * Capa: Backend
 */

import UserDailyTaskModel from '../Models/MD_TB_UserDailyTasks.js';
import DailyTaskModel from '../Models/MD_TB_DailyTasks.js';
import UsersModel from '../Models/MD_TB_Users.js';

// Obtener todas las asignaciones
export const OBRS_UserDailyTasks_CTS = async (req, res) => {
  try {
    const asignaciones = await UserDailyTaskModel.findAll({
      include: [
        {
          model: DailyTaskModel,
          attributes: ['id', 'titulo', 'descripcion']
        },
        {
          model: UsersModel,
          as: 'user',
          attributes: ['id', 'name']
        }
      ]
    });
    res.json(asignaciones);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear una nueva asignación usuario <-> tarea diaria
export const CR_UserDailyTask_CTS = async (req, res) => {
  const { user_id, daily_task_id } = req.body;

  try {
    const nuevaAsignacion = await UserDailyTaskModel.create({
      user_id,
      daily_task_id
    });
    res.json({
      message: 'Asignación creada correctamente',
      data: nuevaAsignacion
    });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar una asignación específica
export const ER_UserDailyTask_CTS = async (req, res) => {
  const { user_id, daily_task_id } = req.params;
  try {
    const deleted = await UserDailyTaskModel.destroy({
      where: { user_id, daily_task_id }
    });

    if (deleted) {
      res.json({ message: 'Asignación eliminada correctamente' });
    } else {
      res.status(404).json({ mensajeError: 'Asignación no encontrada' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener todas las tareas asignadas a un usuario
export const OBRS_TasksByUser_CTS = async (req, res) => {
  const { user_id } = req.params;

  try {
    const tareas = await UserDailyTaskModel.findAll({
      where: { user_id },
      include: {
        model: DailyTaskModel,
        attributes: ['id', 'titulo', 'descripcion']
      }
    });

    res.json(tareas);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear múltiples asignaciones usuario <-> tarea diaria
export const CR_BulkUserDailyTasks_CTS = async (req, res) => {
  const asignaciones = req.body; // array de objetos { user_id, daily_task_id }

  if (!Array.isArray(asignaciones) || asignaciones.length === 0) {
    return res.status(400).json({ mensajeError: 'Se esperaba un array de asignaciones.' });
  }

  try {
    const nuevasAsignaciones = await UserDailyTaskModel.bulkCreate(asignaciones);
    res.status(201).json({
      message: 'Asignaciones múltiples creadas correctamente.',
      data: nuevasAsignaciones
    });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
