/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 15 / 06 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (CTS_TB_VentasProspectos.js) contiene controladores para manejar operaciones CRUD sobre la tabla ventas_prospectos.
 *
 * Tema: Controladores - Ventas Prospectos
 *
 * Capa: Backend
 */

// Importar modelo
import MD_TB_VentasProspectos from '../Models/MD_TB_ventas_prospectos.js';
const { VentasProspectosModel } = MD_TB_VentasProspectos;

import UserModel from '../Models/MD_TB_Users.js';
import { Op } from 'sequelize';

// Obtener todos los registros (puede filtrar por usuario_id o sede)
export const OBRS_VentasProspectos_CTS = async (req, res) => {
  const { usuario_id, sede } = req.query;

  try {
    let whereClause = {};
    if (usuario_id) whereClause.usuario_id = usuario_id;
    if (sede) whereClause.sede = sede;

    const registros = await VentasProspectosModel.findAll({
      where: whereClause
    });
    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener un solo prospecto por ID
export const OBR_VentasProspecto_CTS = async (req, res) => {
  try {
    const prospecto = await VentasProspectosModel.findByPk(req.params.id);
    if (!prospecto)
      return res.status(404).json({ mensajeError: 'Prospecto no encontrado' });
    res.json(prospecto);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear un nuevo prospecto
export const CR_VentasProspecto_CTS = async (req, res) => {
  const {
    usuario_id,
    nombre,
    dni,
    tipo_prospecto,
    canal_contacto,
    campania_origen, // <--- AGREGAR AQUÍ
    contacto,
    actividad,
    sede,
    observacion
  } = req.body;

  if (
    !usuario_id ||
    !nombre ||
    !tipo_prospecto ||
    !canal_contacto ||
    !actividad ||
    !sede
  ) {
    return res.status(400).json({
      mensajeError: 'Faltan datos obligatorios para crear el prospecto'
    });
  }

  // Validación PRO: si es campaña, debe venir el origen
  if (canal_contacto === 'Campaña' && !campania_origen) {
    return res.status(400).json({
      mensajeError: 'Debe especificar el origen de la campaña'
    });
  }

  try {
    const usuario = await UserModel.findByPk(usuario_id);
    if (!usuario)
      return res.status(404).json({ mensajeError: 'Usuario no válido' });

    // Validación de sede: solo puede crear en su sede
    // if (usuario.sede !== sede) {
    //   return res
    //     .status(403)
    //     .json({ mensajeError: 'No puede crear prospectos en otra sede' });
    // }

    const nuevoProspecto = await VentasProspectosModel.create({
      usuario_id,
      nombre,
      dni,
      tipo_prospecto,
      canal_contacto,
      campania_origen: canal_contacto === 'Campaña' ? campania_origen : '', // <--- AGREGAR AQUÍ
      contacto,
      actividad,
      sede,
      asesor_nombre: usuario.name,
      n_contacto_1: 1,
      observacion
    });

    res.json({
      message: 'Prospecto creado correctamente',
      data: nuevoProspecto
    });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar un prospecto (para editar nombre, dni, contacto, etc.)
export const UR_VentasProspecto_CTS = async (req, res) => {
  const { id } = req.params;

  try {
    const [updated] = await VentasProspectosModel.update(req.body, {
      where: { id }
    });

    if (updated === 1) {
      const actualizado = await VentasProspectosModel.findByPk(id);
      res.json({ message: 'Prospecto actualizado', actualizado });
    } else {
      res.status(404).json({ mensajeError: 'Prospecto no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar un prospecto
export const ER_VentasProspecto_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const eliminado = await VentasProspectosModel.destroy({ where: { id } });

    if (!eliminado)
      return res.status(404).json({ mensajeError: 'Prospecto no encontrado' });

    res.json({ message: 'Prospecto eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener usuarios que hayan cargado al menos un prospecto
export const OBRS_ColaboradoresConVentasProspectos = async (req, res) => {
  try {
    const registros = await VentasProspectosModel.findAll({
      attributes: ['usuario_id'],
      group: ['usuario_id'],
      include: [
        {
          model: UserModel,
          as: 'usuario',
          attributes: ['id', 'name']
        }
      ]
    });

    const colaboradores = registros.map((r) => r.usuario).filter((u) => u);

    res.json(colaboradores);
  } catch (error) {
    res.status(500).json({
      mensajeError: 'Error al obtener colaboradores',
      error: error.message
    });
  }
};

// Asociación con UserModel
VentasProspectosModel.belongsTo(UserModel, {
  foreignKey: 'usuario_id',
  as: 'usuario'
});
