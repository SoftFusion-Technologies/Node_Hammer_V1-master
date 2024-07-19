import SchedulerTaskModel from '../Models/MD_TB_SchedulerTask.js';
import SchedulerTaskUserModel from '../Models/MD_TB_SchedulerTaskUser.js';

// Mostrar todos los registros de SchedulerTaskUser
export const OBRS_SchedulerTaskUser_CTS = async (req, res) => {
  try {
    const registros = await SchedulerTaskUserModel.findAll();
    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de SchedulerTaskUser por su ID
export const OBR_SchedulerTaskUser_CTS = async (req, res) => {
  try {
    const registro = await SchedulerTaskUserModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en SchedulerTaskUser
export const CR_SchedulerTaskUser_CTS = async (req, res) => {
  try {
    const registro = await SchedulerTaskUserModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar un registro en SchedulerTaskUser por su ID
export const ER_SchedulerTaskUser_CTS = async (req, res) => {
  try {
    await SchedulerTaskUserModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
