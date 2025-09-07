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
  const { usuario_id, sede, mes, anio } = req.query;

  try {
    let whereClause = {};
    if (usuario_id) whereClause.usuario_id = usuario_id;
    if (sede) whereClause.sede = sede;

    // Si mes y año están presentes, filtramos por rango de fechas
    if (mes && anio) {
      const startDate = new Date(anio, mes - 1, 1); // Primer día del mes
      const endDate = new Date(anio, mes, 1); // Primer día del mes siguiente

      whereClause.fecha = {
        [Op.gte]: startDate,
        [Op.lt]: endDate
      };
    }

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
// controllers/VentasProspectosController.js
export const UR_VentasProspecto_CTS = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ mensajeError: 'ID inválido' });

    // 🔒 Lista blanca de campos actualizables
    const ALLOWED = new Set([
      'usuario_id',
      'nombre',
      'dni',
      'tipo_prospecto',
      'canal_contacto',
      'contacto',
      'actividad',
      'sede',
      'fecha',
      'asesor_nombre',
      'n_contacto_1',
      'n_contacto_2',
      'n_contacto_3',
      'clase_prueba_1_fecha',
      'clase_prueba_1_obs',
      'clase_prueba_1_tipo',
      'clase_prueba_2_fecha',
      'clase_prueba_2_obs',
      'clase_prueba_2_tipo',
      'clase_prueba_3_fecha',
      'clase_prueba_3_obs',
      'clase_prueba_3_tipo',
      'convertido',
      'observacion',
      'campania_origen',
      // comisión
      'comision',
      'comision_usuario_id'
    ]);

    const body = req.body ?? {};
    const campos = {};

    // Copiamos sólo lo permitido con normalizaciones simples
    for (const k of Object.keys(body)) {
      if (!ALLOWED.has(k)) continue;

      const v = body[k];

      if (['n_contacto_1', 'n_contacto_2', 'n_contacto_3'].includes(k)) {
        campos[k] = Number(v ?? 0);
      } else if (['convertido', 'comision'].includes(k)) {
        campos[k] = !!v; // boolean
      } else if (
        [
          'fecha',
          'clase_prueba_1_fecha',
          'clase_prueba_2_fecha',
          'clase_prueba_3_fecha'
        ].includes(k)
      ) {
        campos[k] = v ? new Date(v) : null;
      } else if (k === 'comision_usuario_id') {
        // Sólo setear si viene definido; casteado a número
        if (typeof v !== 'undefined' && v !== null && v !== '') {
          campos[k] = Number(v) || null;
        }
      } else {
        campos[k] = v;
      }
    }

    // --------- Reglas especiales convertido / comisión ---------

    // Si explícitamente desmarcan convertido → anular comisión y su metadata
    if (
      Object.prototype.hasOwnProperty.call(body, 'convertido') &&
      body.convertido === false
    ) {
      campos.comision = false;
      campos.comision_registrada_at = null;
      campos.comision_usuario_id = null;
    }

    // Si vino 'comision' (true/false), setear/limpiar metadata
    if (Object.prototype.hasOwnProperty.call(body, 'comision')) {
      if (body.comision) {
        campos.comision_registrada_at = new Date();
        // Sólo tomar comision_usuario_id si vino
        if (Object.prototype.hasOwnProperty.call(body, 'comision_usuario_id')) {
          campos.comision_usuario_id = Number(body.comision_usuario_id) || null;
        }
      } else {
        campos.comision_registrada_at = null;
        campos.comision_usuario_id = null;
      }
    }

    // Si no hay nada que actualizar, avisar
    if (Object.keys(campos).length === 0) {
      return res
        .status(400)
        .json({ mensajeError: 'Sin campos válidos para actualizar' });
    }

    const [n] = await VentasProspectosModel.update(campos, { where: { id } });
    if (!n)
      return res.status(404).json({ mensajeError: 'Prospecto no encontrado' });

    const data = await VentasProspectosModel.findByPk(id);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ mensajeError: err.message });
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
