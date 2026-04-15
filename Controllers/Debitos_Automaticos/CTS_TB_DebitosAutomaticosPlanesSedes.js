/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 15 / 04 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Controladores CRUD para la tabla 'debitos_automaticos_planes_sedes'.
 * Incluye listado con filtros, obtención por ID, creación, actualización
 * y eliminación mediante baja lógica.
 *
 * Tema: Controladores - Débitos Automáticos Planes por Sede
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
import DebitosAutomaticosPlanesSedesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPlanesSedes.js';
import DebitosAutomaticosPlanesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPlanes.js';
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

const toDecOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(2));
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

/* Benjamin Orellana - 2026/04/15 - Normaliza el payload de precios por sede para crear o actualizar registros con validaciones reutilizables. */
const pickPlanSedePayload = (body = {}) => {
  return {
    plan_id: toIntOrNull(body.plan_id),
    sede_id: toIntOrNull(body.sede_id),
    precio_base: toDecOrNull(body.precio_base),
    activo: toFlagOrUndefined(body.activo)
  };
};

/* Benjamin Orellana - 2026/04/15 - Include centralizado para resolver plan y sede en listados y detalles del módulo. */
const buildInclude = () => [
  {
    model: DebitosAutomaticosPlanesModel,
    as: 'plan',
    attributes: [
      'id',
      'codigo',
      'nombre',
      'descripcion',
      'activo',
      'orden_visual'
    ]
  },
  {
    model: SedeModel,
    as: 'sede',
    attributes: ['id', 'nombre', 'estado', 'es_ciudad']
  }
];

/* =========================
   OBRS - listar
   Filtros:
   ?activo=1
   ?plan_id=1
   ?sede_id=2
   ?q=texto
========================= */
export const OBRS_DebitosAutomaticosPlanesSedes_CTS = async (req, res) => {
  try {
    const { activo, plan_id, sede_id, q } = req.query;

    const where = {};
    const include = buildInclude();

    if (activo !== undefined) {
      const activoInt = toIntOrNull(activo);

      if (activoInt === null || ![0, 1].includes(activoInt)) {
        return res.status(400).json({
          mensajeError: 'La query activo es inválida. Use 0 o 1.'
        });
      }

      where.activo = activoInt;
    }

    if (plan_id !== undefined) {
      const planIdInt = toIntOrNull(plan_id);

      if (!planIdInt) {
        return res.status(400).json({
          mensajeError: 'La query plan_id es inválida.'
        });
      }

      where.plan_id = planIdInt;
    }

    if (sede_id !== undefined) {
      const sedeIdInt = toIntOrNull(sede_id);

      if (!sedeIdInt) {
        return res.status(400).json({
          mensajeError: 'La query sede_id es inválida.'
        });
      }

      where.sede_id = sedeIdInt;
    }

    /* Benjamin Orellana - 2026/04/15 - Se permite búsqueda textual por código/nombre del plan y nombre de la sede usando includes requeridos. */
    if (q && String(q).trim()) {
      const search = String(q).trim();

      include[0].required = true;
      include[1].required = true;

      where[Op.or] = [
        { '$plan.codigo$': { [Op.like]: `%${search}%` } },
        { '$plan.nombre$': { [Op.like]: `%${search}%` } },
        { '$sede.nombre$': { [Op.like]: `%${search}%` } }
      ];
    }

    const registros = await DebitosAutomaticosPlanesSedesModel.findAll({
      where,
      include,
      order: [
        ['activo', 'DESC'],
        [
          { model: DebitosAutomaticosPlanesModel, as: 'plan' },
          'orden_visual',
          'ASC'
        ],
        [{ model: DebitosAutomaticosPlanesModel, as: 'plan' }, 'nombre', 'ASC'],
        [{ model: SedeModel, as: 'sede' }, 'nombre', 'ASC']
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
export const OBR_DebitosAutomaticosPlanesSedes_CTS = async (req, res) => {
  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const registro = await DebitosAutomaticosPlanesSedesModel.findByPk(id, {
      include: buildInclude()
    });

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
export const CR_DebitosAutomaticosPlanesSedes_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const payload = pickPlanSedePayload(req.body);

    if (!payload.plan_id) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'plan_id es obligatorio.'
      });
    }

    if (!payload.sede_id) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'sede_id es obligatorio.'
      });
    }

    if (payload.precio_base === null) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'precio_base es obligatorio y debe ser numérico.'
      });
    }

    if (payload.precio_base < 0) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'precio_base no puede ser negativo.'
      });
    }

    const plan = await DebitosAutomaticosPlanesModel.findByPk(payload.plan_id, {
      transaction: t
    });

    if (!plan) {
      await t.rollback();
      return res.status(404).json({
        mensajeError: 'El plan indicado no existe.'
      });
    }

    const sede = await SedeModel.findByPk(payload.sede_id, {
      transaction: t
    });

    if (!sede) {
      await t.rollback();
      return res.status(404).json({
        mensajeError: 'La sede indicada no existe.'
      });
    }

    const creado = await DebitosAutomaticosPlanesSedesModel.create(
      {
        plan_id: payload.plan_id,
        sede_id: payload.sede_id,
        precio_base: payload.precio_base,
        activo: payload.activo ?? 1
      },
      { transaction: t }
    );

    await t.commit();

    const registro = await DebitosAutomaticosPlanesSedesModel.findByPk(
      creado.id,
      {
        include: buildInclude()
      }
    );

    return res.status(201).json({
      message: 'Registro creado correctamente',
      registro
    });
  } catch (error) {
    await t.rollback();

    if (
      error?.name === 'SequelizeUniqueConstraintError' ||
      String(error?.original?.code || '').includes('ER_DUP_ENTRY')
    ) {
      return res.status(409).json({
        mensajeError:
          'Ya existe una configuración de precio para ese plan en esa sede.'
      });
    }

    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   UR - update
========================= */
export const UR_DebitosAutomaticosPlanesSedes_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const current = await DebitosAutomaticosPlanesSedesModel.findByPk(id, {
      transaction: t
    });

    if (!current) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    const body = req.body || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

    const updateBody = {};

    if (has('plan_id')) {
      const planId = toIntOrNull(body.plan_id);

      if (!planId) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'plan_id debe ser numérico.'
        });
      }

      const plan = await DebitosAutomaticosPlanesModel.findByPk(planId, {
        transaction: t
      });

      if (!plan) {
        await t.rollback();
        return res.status(404).json({
          mensajeError: 'El plan indicado no existe.'
        });
      }

      updateBody.plan_id = planId;
    }

    if (has('sede_id')) {
      const sedeId = toIntOrNull(body.sede_id);

      if (!sedeId) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'sede_id debe ser numérico.'
        });
      }

      const sede = await SedeModel.findByPk(sedeId, {
        transaction: t
      });

      if (!sede) {
        await t.rollback();
        return res.status(404).json({
          mensajeError: 'La sede indicada no existe.'
        });
      }

      updateBody.sede_id = sedeId;
    }

    if (has('precio_base')) {
      const precioBase = toDecOrNull(body.precio_base);

      if (
        body.precio_base !== null &&
        body.precio_base !== '' &&
        precioBase === null
      ) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'precio_base debe ser numérico.'
        });
      }

      if (precioBase === null) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'precio_base no puede ser null.'
        });
      }

      if (precioBase < 0) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'precio_base no puede ser negativo.'
        });
      }

      updateBody.precio_base = precioBase;
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

    const [numRowsUpdated] = await DebitosAutomaticosPlanesSedesModel.update(
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
      await DebitosAutomaticosPlanesSedesModel.findByPk(id, {
        include: buildInclude()
      });

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
        mensajeError:
          'Ya existe una configuración de precio para ese plan en esa sede.'
      });
    }

    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   ER - eliminar (baja lógica)
========================= */
export const ER_DebitosAutomaticosPlanesSedes_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const registro = await DebitosAutomaticosPlanesSedesModel.findByPk(id, {
      transaction: t
    });

    if (!registro) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    await DebitosAutomaticosPlanesSedesModel.update(
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
