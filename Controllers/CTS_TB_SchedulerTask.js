import SchedulerTaskModel from '../Models/MD_TB_SchedulerTask.js';
import SchedulerTaskUserModel from '../Models/MD_TB_SchedulerTaskUser.js';
import UsersModel from '../Models/MD_TB_Users.js';

// Obtener todos los registros de SchedulerTask con los usuarios relacionados
export const OBRS_SchedulerTask_CTS = async (req, res) => {
  try {
    const registros = await SchedulerTaskModel.findAll({
      include: {
        model: SchedulerTaskUserModel,
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

// Mostrar un registro específico de SchedulerTask por su ID
export const OBR_SchedulerTask_CTS = async (req, res) => {
  try {
    const registro = await SchedulerTaskModel.findByPk(req.params.id, {
      include: {
        model: SchedulerTaskUserModel,
        as: 'taskUsers',
        include: {
          model: UsersModel,
          as: 'user',
          attributes: ['id', 'name']
        }
      }
    });
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en SchedulerTask
export const CR_SchedulerTask_CTS = async (req, res) => {
  try {
      const { titulo, descripcion, hora, dias, user, state } = req.body;

      if (!user || user.length === 0) {
          return res.status(400).json({ mensajeError: 'El campo user_id es obligatorio y no puede ser nulo.' });
      }

      const registro = await SchedulerTaskModel.create({ titulo, descripcion, hora, dias, user_id: user[0], state });

      await Promise.all(user.map(userId => SchedulerTaskUserModel.create({ schedulertask_id: registro.id, user_id: userId })));

      res.json({ message: 'Registro creado correctamente', registro });
  } catch (error) {
      console.error('Error al crear la tarea:', error.message);
      res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar un registro en SchedulerTask por su ID
export const ER_SchedulerTask_CTS = async (req, res) => {
  try {
    await SchedulerTaskModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Actualizar un registro en SchedulerTask por su ID
export const UR_SchedulerTask_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await SchedulerTaskModel.update(req.body, {
      where: { id },
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await SchedulerTaskModel.findByPk(id);
      res.json({ message: 'Registro actualizado correctamente', registroActualizado });
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
