/*
  * Programador: Benjamin Orellana
  * Fecha Creación: 03/06/2025
  * Versión: 1.0
  *
  * Descripción:
    * Este archivo contiene controladores para manejar operaciones CRUD en los modelos:
      - DailyTaskModel
      - UserDailyTaskModel
      - Notificaciones relacionadas
  * Tema: Controladores - Tareas Diarias
  * Capa: Backend
  * Nomenclatura: OBR_ obtenerRegistro
                  OBRS_obtenerRegistros
                  CR_ crearRegistro
                  ER_ eliminarRegistro
*/

import DailyTaskModel from '../Models/MD_TB_DailyTasks.js';
import UserDailyTaskModel from '../Models/MD_TB_UserDailyTasks.js';
import UsersModel from '../Models/MD_TB_Users.js';

import NotificationModel from '../Models/MD_TB_Notifications.js';
import NotificationUserModel from '../Models/MD_TB_NotificationsUsers.js';

// Mostrar todos los registros con usuarios asignados
export const OBRS_TareasDiarias_CTS = async (req, res) => {
  try {
    const registros = await DailyTaskModel.findAll({
      include: {
        model: UserDailyTaskModel,
        as: 'taskUsers',
        include: {
          model: UsersModel,
          as: 'user',
          attributes: ['id', 'name']
        }
      }
    });
    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Mostrar una tarea diaria por ID
export const OBR_TareaDiaria_CTS = async (req, res) => {
  try {
    const registro = await DailyTaskModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear tarea diaria con asignación de usuarios y notificación
export const CR_TareaDiaria_CTS = async (req, res) => {
    const { titulo, descripcion, activa, userName, user } = req.body;
  
    try {
      // 1. Crear la tarea diaria
      const nuevaTarea = await DailyTaskModel.create({
        titulo,
        descripcion,
        activa: activa !== undefined ? activa : 1
      });
  
      // 2. Crear la notificación
      const notiTitle = 'Nueva tarea diaria registrada';
      const notiMessage = `Tarea: ${titulo}.`;
      const module = 'tareasdiarias';
      const reference_id = nuevaTarea.id;
      const seen_by = []; // arreglo vacío, o adaptalo a tu lógica
      const created_by = userName || 'Sistema';
  
      const nuevaNotificacion = await NotificationModel.create({
        title: notiTitle,
        message: notiMessage,
        module,
        reference_id,
        seen_by,
        created_by
      });
  
      // 3. Asociar usuarios con la tarea y la notificación
      if (user && Array.isArray(user) && user.length > 0) {
        const userPromises = user.map((userId) =>
          UserDailyTaskModel.create({
            daily_task_id: nuevaTarea.id,
            user_id: userId
          }).then(() =>
            NotificationUserModel.create({
              notification_id: nuevaNotificacion.id,
              user_id: userId
            })
          )
        );
  
        await Promise.all(userPromises);
      }
  
      // 4. Responder con el id de la tarea para que el frontend lo use
      res.json({
        message: 'Tarea diaria registrada y notificación enviada correctamente',
        id: nuevaTarea.id
      });
    } catch (error) {
      res.status(500).json({ mensajeError: error.message });
    }
  };
  

// Eliminar tarea diaria
export const ER_TareaDiaria_CTS = async (req, res) => {
  try {
    await DailyTaskModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar tarea diaria
export const UR_TareaDiaria_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await DailyTaskModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await DailyTaskModel.findByPk(id);
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
