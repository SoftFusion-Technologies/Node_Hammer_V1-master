/*
 * Controlador: CTS_TB_QuejasPilates
 * Descripción: Lógica de negocio para las quejas de Pilates.
 * Creado por: Sergio Gustavo Manrique (basado en la solicitud)
 * Fecha: 15/11/2025
 */

import QuejasPilatesModel from '../Models/MD_TB_QuejasPilates.js';
import { SedeModel } from "../Models/MD_TB_sedes.js";

// Helper para normalizar
const toCanonical = (str = "") =>
  str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

// Helper para saber si es Admin/Gerente
const isCoordinator = (level = "") => {
  const L = toCanonical(level);
  return L === "ADMIN" || L === "ADMINISTRADOR" || L === "GERENTE";
};

// Helper para normalizar tipo de usuario según ENUM de BD
const normalizeTipoUsuario = (tipo = "") => {
  const value = toCanonical(tipo);

  if (value.includes("INSTRUCTOR")) {
    return 'instructor';
  }

  return 'cliente';
};


// Crear una nueva queja de Pilates
export const CR_QuejaPilates_CTS = async (req, res) => {
  const { cargado_por, nombre, contacto, motivo, sede, tipo_usuario} = req.body;

  try {
    const tipoUsuarioNormalizado = normalizeTipoUsuario(tipo_usuario);
    let nombreSede = 'Sede no especificada';

    // --- LÓGICA DE VERIFICACIÓN DE TIPO DE CAMPO 'SEDE' ---
    const sedeEsId = sede && !isNaN(sede) && Number.isInteger(Number(sede));

    if (sede) {
      if (sedeEsId) {
        // 1. Si es un ID numérico, intentamos buscar el nombre en la BD
        const sedeEncontrada = await SedeModel.findByPk(sede);

        if (sedeEncontrada) {
          nombreSede = sedeEncontrada.nombre;
        } else {
          console.warn(
            `Sede con ID ${sede} no encontrada. Se guardará como 'Sede no especificada'.`
          );
          // Si no se encuentra, se mantiene 'Sede no especificada'
        }
      } else {
        // 2. Si NO es un ID numérico (es texto), lo usamos directamente
        nombreSede = sede;
      }
    }
    const nuevaQueja = await QuejasPilatesModel.create({
      cargado_por,
      nombre,
      tipo_usuario: tipoUsuarioNormalizado,
      contacto,
      motivo,
      resuelto: 0,
      sede: nombreSede
    });

    res.status(201).json(nuevaQueja);
  } catch (error) {
    console.error('Error al crear queja de Pilates:', error);
    res.status(500).json({
      mensajeError: 'Error al crear la queja de Pilates',
      error: error.message
    });
  }
};

// Actualizar una queja de Pilates
export const UR_QuejaPilates_CTS = async (req, res) => {
  try {
    const queja = await QuejasPilatesModel.findByPk(req.params.id);
    if (!queja) {
      return res
        .status(404)
        .json({ mensajeError: 'Queja de Pilates no encontrada' });
    }

    const { nombre, contacto, motivo, sede } = req.body;

    let nombreSedeActualizada = sede;

    if (sede) {
      const sedeEncontrada = await SedeModel.findByPk(sede);
      if (sedeEncontrada) {
        nombreSedeActualizada = sedeEncontrada.nombre;
      } else {
        nombreSedeActualizada = sede;
      }
    }

    await queja.update({
      nombre,
      contacto,
      motivo,
      sede: nombreSedeActualizada
    });

    res.json(queja);
  } catch (error) {
    res.status(500).json({
      mensajeError: 'Error al actualizar la queja de Pilates',
      error: error.message
    });
  }
};

// Eliminar una queja de Pilates (Borrado Lógico o Físico)
export const ER_QuejaPilates_CTS = async (req, res) => {
  try {
    const queja = await QuejasPilatesModel.findByPk(req.params.id);
    if (!queja) {
      return res
        .status(404)
        .json({ mensajeError: 'Queja de Pilates no encontrada' });
    }

    // Realiza el borrado físico (DELETE FROM)
    await queja.destroy();
    res.status(200).json({ message: 'Queja de Pilates eliminada' });
  } catch (error) {
    res.status(500).json({
      mensajeError: 'Error al eliminar la queja de Pilates',
      error: error.message
    });
  }
};

// Marcar como resuelta
export const MARCAR_Resuelto_QuejaPilates = async (req, res) => {
  const { resuelto_por } = req.body; // El email/nombre del usuario que resuelve
  try {
    const queja = await QuejasPilatesModel.findByPk(req.params.id);
    if (!queja) {
      return res
        .status(404)
        .json({ mensajeError: 'Queja de Pilates no encontrada' });
    }

    // Actualización de estado
    queja.resuelto = 1;
    queja.resuelto_por = resuelto_por || 'Sistema';
    queja.fecha_resuelto = new Date();
    await queja.save();

    res.json({ message: 'Queja de Pilates marcada como resuelta', queja });
  } catch (error) {
    res.status(500).json({
      mensajeError: 'Error al resolver la queja de Pilates',
      error: error.message
    });
  }
};

// Marcar como NO resuelta (reabrir)
export const MARCAR_NoResuelto_QuejaPilates = async (req, res) => {
  try {
    const queja = await QuejasPilatesModel.findByPk(req.params.id);
    if (!queja) {
      return res
        .status(404)
        .json({ mensajeError: 'Queja de Pilates no encontrada' });
    }

    // Actualización de estado
    queja.resuelto = 0;
    queja.resuelto_por = null;
    queja.fecha_resuelto = null;
    await queja.save();

    res.json({ message: 'Queja de Pilates reabierta', queja });
  } catch (error) {
    res.status(500).json({
      mensajeError: 'Error al reabrir la queja de Pilates',
      error: error.message
    });
  }
};