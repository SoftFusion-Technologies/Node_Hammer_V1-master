/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 03 / 10 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Controlador para manejar ABM de horarios de prospectos.
 */

import MD_TB_VentasProspectosHorarios from '../Models/MD_TB_VentasProspectosHorarios.js';
const { VentasProspectosHorariosModel } = MD_TB_VentasProspectosHorarios;

import { VentasProspectosModel } from '../Models/MD_TB_ventas_prospectos.js';

// Crear horario de prospecto
export const CR_VentasProspectosHorario_CTS = async (req, res) => {
  const { prospecto_id, hhmm, grp, clase_num } = req.body;

  if (!prospecto_id || !hhmm || !grp) {
    return res.status(400).json({ mensajeError: 'Faltan datos obligatorios' });
  }

  try {
    const prospecto = await VentasProspectosModel.findByPk(prospecto_id);
    if (!prospecto) return res.status(404).json({ mensajeError: 'Prospecto no encontrado' });

    const nuevoHorario = await VentasProspectosHorariosModel.create({
      prospecto_id,
      hhmm,
      grp,
      clase_num: clase_num || 1
    });

    res.json({ message: 'Horario creado correctamente', data: nuevoHorario });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener horario por prospecto y clase_num opcional
export const OBRS_VentasProspectosHorario_CTS = async (req, res) => {
  const { prospecto_id } = req.params;

  if (!prospecto_id) return res.status(400).json({ mensajeError: 'Faltan parámetros' });

  try {
    const horario = await VentasProspectosHorariosModel.findAll({
      where: { prospecto_id },
      order: [['clase_num', 'ASC']]
    });

    if (!horario || horario.length === 0)
      return res.status(404).json({ mensajeError: 'Horario no encontrado' });

    res.json(horario);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar horario de prospecto
export const PUT_VentasProspectosHorarioPorProspecto_CTS = async (req, res) => {
  const { prospecto_id, clase_num } = req.body;
  const { hhmm, grp } = req.body;

  if (!prospecto_id || !clase_num || !hhmm || !grp) {
    return res.status(400).json({ mensajeError: 'Faltan datos obligatorios para modificar' });
  }

  try {
    const horario = await VentasProspectosHorariosModel.findOne({
      where: { prospecto_id, clase_num }
    });
    if (!horario) return res.status(404).json({ mensajeError: 'Horario no encontrado' });

    horario.hhmm = hhmm;
    horario.grp = grp;
    await horario.save();

    res.json({ message: 'Horario modificado correctamente', data: horario });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
// Eliminar horario
export const ER_VentasProspectosHorario_CTS = async (req, res) => {
  const { id } = req.params;
  try {
    const eliminado = await VentasProspectosHorariosModel.destroy({ where: { id } });
    if (!eliminado) return res.status(404).json({ mensajeError: 'Horario no encontrado' });
    res.json({ message: 'Horario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};