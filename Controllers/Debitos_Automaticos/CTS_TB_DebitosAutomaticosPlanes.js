/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 12 / 03 / 2026
 * Versión: 1.1
 *
 * Descripción:
 * Controladores CRUD para la tabla 'debitos_automaticos_planes'.
 * Incluye listado con filtros, obtención por ID, creación, actualización
 * y eliminación mediante baja lógica.
 *
 * Tema: Controladores - Débitos Automáticos Planes
 * Capa: Backend
 *
 * Nomenclatura: OBR_  obtenerRegistro
 *              OBRS_ obtenerRegistros(plural)
 *              CR_   crearRegistro
 *              ER_   eliminarRegistro
 *              UR_   updateRegistro
 */

import { Op } from 'sequelize';
import db from '../../DataBase/db.js';
import DebitosAutomaticosPlanesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPlanes.js';
import DebitosAutomaticosPlanesSedesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPlanesSedes.js';
import { SedeModel } from '../../Models/MD_TB_sedes.js';

/* =========================
   Helpers
========================= */
const toIntOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
};

const toFlagOrUndefined = (v) => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;

  const s = String(v).trim().toLowerCase();

  if (
    v === 1 ||
    v === true ||
    s === '1' ||
    s === 'true' ||
    s === 'si' ||
    s === 'sí'
  ) {
    return 1;
  }

  if (v === 0 || v === false || s === '0' || s === 'false' || s === 'no') {
    return 0;
  }

  return null;
};

const cleanStringOrNull = (v, max = null) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (max && s.length > max) return s.slice(0, max);
  return s;
};

/* Benjamin Orellana - 2026/04/15 - Se simplifica el payload de planes eliminando campos de precio y descuento, ya que ahora el precio depende de plan+sede y el beneficio del banco. */
const pickPlanPayload = (body = {}) => {
  return {
    codigo: cleanStringOrNull(body.codigo, 30),
    nombre: cleanStringOrNull(body.nombre, 120),
    descripcion: cleanStringOrNull(body.descripcion, 255),
    activo: toFlagOrUndefined(body.activo),
    orden_visual: toIntOrNull(body.orden_visual)
  };
};

/* =========================
   OBRS - listar planes disponibles por sede
   Filtros:
   ?sede_id=15
========================= */
export const OBRS_DebitosAutomaticosPlanesPorSede_CTS = async (req, res) => {
  try {
    const { sede_id, q } = req.query;

    const sedeId = toIntOrNull(sede_id);

    if (!sedeId) {
      return res.status(400).json({
        mensajeError: 'La query sede_id es obligatoria y debe ser numérica.'
      });
    }

    /* Benjamin Orellana - 2026/04/15 - Se valida la sede antes de exponer el catálogo público filtrado para evitar combinaciones inválidas en el formulario público. */
    const sede = await SedeModel.findByPk(sedeId);

    if (!sede) {
      return res.status(404).json({
        mensajeError: 'La sede indicada no existe.'
      });
    }

    const includePlanSede = {
      model: DebitosAutomaticosPlanesSedesModel,
      as: 'planes_sedes',
      required: true,
      where: {
        sede_id: sedeId,
        activo: 1,
        precio_base: {
          [Op.ne]: null
        }
      },
      attributes: ['id', 'sede_id', 'precio_base', 'activo', 'created_at', 'updated_at']
    };

    const where = {
      activo: 1
    };

    if (q && String(q).trim()) {
      const search = String(q).trim();

      where[Op.or] = [
        { codigo: { [Op.like]: `%${search}%` } },
        { nombre: { [Op.like]: `%${search}%` } },
        { descripcion: { [Op.like]: `%${search}%` } }
      ];
    }

    /* Benjamin Orellana - 2026/04/15 - Se devuelven únicamente planes activos que tengan configuración activa y precio_base válido en la sede solicitada. */
    const registros = await DebitosAutomaticosPlanesModel.findAll({
      where,
      include: [includePlanSede],
      order: [
        ['orden_visual', 'ASC'],
        ['nombre', 'ASC']
      ]
    });

    const respuesta = registros.map((plan) => {
      const configuracion = Array.isArray(plan?.planes_sedes)
        ? plan.planes_sedes[0] || null
        : null;

      return {
        id: plan.id,
        codigo: plan.codigo,
        nombre: plan.nombre,
        descripcion: plan.descripcion,
        activo: plan.activo,
        orden_visual: plan.orden_visual,
        created_at: plan.created_at,
        updated_at: plan.updated_at,
        plan_sede_id: configuracion?.id || null,
        sede_id: configuracion?.sede_id || sedeId,
        sede_nombre: sede?.nombre || null,
        precio_base: configuracion?.precio_base ?? null,
        precio_configuracion_activa: configuracion?.activo ?? 0
      };
    });

    return res.json(respuesta);
  } catch (error) {
    return res.status(500).json({
      mensajeError: error.message
    });
  }
};

/* =========================
   OBRS - listar
   Filtros:
   ?activo=1
   ?q=plan
========================= */
export const OBRS_DebitosAutomaticosPlanes_CTS = async (req, res) => {
  try {
    const { activo, q } = req.query;

    const where = {};

    if (activo !== undefined) {
      const activoInt = toIntOrNull(activo);

      if (activoInt === null || ![0, 1].includes(activoInt)) {
        return res.status(400).json({
          mensajeError: 'La query activo es inválida. Use 0 o 1.'
        });
      }

      where.activo = activoInt;
    }

    if (q && String(q).trim()) {
      const search = String(q).trim();

      where[Op.or] = [
        { codigo: { [Op.like]: `%${search}%` } },
        { nombre: { [Op.like]: `%${search}%` } },
        { descripcion: { [Op.like]: `%${search}%` } }
      ];
    }

    const registros = await DebitosAutomaticosPlanesModel.findAll({
      where,
      order: [
        ['activo', 'DESC'],
        ['orden_visual', 'ASC'],
        ['nombre', 'ASC']
      ]
    });

    return res.json(registros);
  } catch (error) {
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   OBR - por ID
========================= */
export const OBR_DebitosAutomaticosPlanes_CTS = async (req, res) => {
  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const registro = await DebitosAutomaticosPlanesModel.findByPk(id);

    if (!registro) {
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    return res.json(registro);
  } catch (error) {
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   CR - crear
========================= */
export const CR_DebitosAutomaticosPlanes_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const payload = pickPlanPayload(req.body);

    if (!payload.codigo) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'codigo es obligatorio.' });
    }

    if (!payload.nombre) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'nombre es obligatorio.' });
    }

    const creado = await DebitosAutomaticosPlanesModel.create(
      {
        codigo: payload.codigo,
        nombre: payload.nombre,
        descripcion: payload.descripcion,
        activo: payload.activo ?? 1,
        orden_visual: payload.orden_visual ?? 0
      },
      { transaction: t }
    );

    await t.commit();

    return res.status(201).json({
      message: 'Registro creado correctamente',
      registro: creado
    });
  } catch (error) {
    await t.rollback();

    if (
      error?.name === 'SequelizeUniqueConstraintError' ||
      String(error?.original?.code || '').includes('ER_DUP_ENTRY')
    ) {
      return res.status(409).json({
        mensajeError: 'Ya existe un plan con el mismo código o nombre.'
      });
    }

    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   UR - update
========================= */
export const UR_DebitosAutomaticosPlanes_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const current = await DebitosAutomaticosPlanesModel.findByPk(id, {
      transaction: t
    });

    if (!current) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    const body = req.body || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

    const updateBody = {};

    if (has('codigo')) {
      const codigo = cleanStringOrNull(body.codigo, 30);

      if (!codigo) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'codigo no puede ser vacío.'
        });
      }

      updateBody.codigo = codigo;
    }

    if (has('nombre')) {
      const nombre = cleanStringOrNull(body.nombre, 120);

      if (!nombre) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'nombre no puede ser vacío.'
        });
      }

      updateBody.nombre = nombre;
    }

    if (has('descripcion')) {
      updateBody.descripcion = cleanStringOrNull(body.descripcion, 255);
    }

    if (has('activo')) {
      const activo = toFlagOrUndefined(body.activo);

      if (activo === null) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'activo debe ser 0 o 1.'
        });
      }

      updateBody.activo = activo;
    }

    if (has('orden_visual')) {
      const ordenVisual = toIntOrNull(body.orden_visual);

      if (ordenVisual === null) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'orden_visual debe ser numérico.'
        });
      }

      updateBody.orden_visual = ordenVisual;
    }

    const [numRowsUpdated] = await DebitosAutomaticosPlanesModel.update(
      updateBody,
      {
        where: { id },
        transaction: t
      }
    );

    if (numRowsUpdated !== 1) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    await t.commit();

    const registroActualizado =
      await DebitosAutomaticosPlanesModel.findByPk(id);

    return res.json({
      message: 'Registro actualizado correctamente',
      registroActualizado
    });
  } catch (error) {
    await t.rollback();

    if (
      error?.name === 'SequelizeUniqueConstraintError' ||
      String(error?.original?.code || '').includes('ER_DUP_ENTRY')
    ) {
      return res.status(409).json({
        mensajeError: 'Ya existe un plan con el mismo código o nombre.'
      });
    }

    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   ER - eliminar (baja lógica)
========================= */
export const ER_DebitosAutomaticosPlanes_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const registro = await DebitosAutomaticosPlanesModel.findByPk(id, {
      transaction: t
    });

    if (!registro) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    await DebitosAutomaticosPlanesModel.update(
      { activo: 0 },
      { where: { id }, transaction: t }
    );

    await t.commit();

    return res.json({
      message: 'Registro dado de baja correctamente'
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({ mensajeError: error.message });
  }
};
