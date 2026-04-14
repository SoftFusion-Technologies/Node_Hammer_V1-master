/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 12 / 03 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Controladores CRUD internos para la tabla 'debitos_automaticos_solicitudes_adicionales'.
 * Este controlador está orientado a soporte administrativo/mantenimiento.
 * La lógica principal de alta/edición de adicional se resuelve desde Solicitudes.
 *
 * Tema: Controladores - Débitos Automáticos Solicitudes Adicionales
 * Capa: Backend
 *
 * Nomenclatura: OBR_  obtenerRegistro
 *              OBRS_ obtenerRegistros(plural)
 *              CR_   crearRegistro
 *              ER_   eliminarRegistro
 *              UR_   updateRegistro
 */

import db from '../../DataBase/db.js';
import DebitosAutomaticosSolicitudesAdicionalesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosSolicitudesAdicionales.js';
import DebitosAutomaticosSolicitudesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosSolicitudes.js';
import DebitosAutomaticosPlanesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPlanes.js';
import DebitosAutomaticosBancosModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosBancos.js';
import DebitosAutomaticosTerminosModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosTerminos.js';

/* =========================
   Constantes
========================= */
const ESTADOS_EDITABLES = ['PENDIENTE', 'OBSERVADA'];
const MODALIDADES_CON_ADICIONAL = ['AMBOS', 'SOLO_ADICIONAL'];

/* =========================
   Helpers
========================= */
const toIntOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
};

const cleanStringOrNull = (v, max = null) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (max && s.length > max) return s.slice(0, max);
  return s;
};

const canEditSolicitud = (solicitud) => {
  return solicitud && ESTADOS_EDITABLES.includes(String(solicitud.estado));
};

const solicitudInclude = [
  {
    model: DebitosAutomaticosBancosModel,
    as: 'banco'
  },
  {
    model: DebitosAutomaticosPlanesModel,
    as: 'plan_titular'
  },
  {
    model: DebitosAutomaticosTerminosModel,
    as: 'terminos',
    attributes: [
      'id',
      'version',
      'titulo',
      'activo',
      'publicado_desde',
      'publicado_hasta'
    ]
  }
];

const adicionalInclude = [
  {
    model: DebitosAutomaticosSolicitudesModel,
    as: 'solicitud',
    include: solicitudInclude
  },
  {
    model: DebitosAutomaticosPlanesModel,
    as: 'plan'
  }
];

const findSolicitudById = async (id, transaction) => {
  return DebitosAutomaticosSolicitudesModel.findByPk(id, {
    transaction
  });
};

const findPlanActivoById = async (id, transaction) => {
  return DebitosAutomaticosPlanesModel.findOne({
    where: { id, activo: 1 },
    transaction
  });
};

/* =========================
   OBRS - listar
   Filtros:
   ?solicitud_id=1
   ?dni=123
   ?plan_id=2
========================= */
export const OBRS_DebitosAutomaticosSolicitudesAdicionales_CTS = async (
  req,
  res
) => {
  try {
    const { solicitud_id, dni, plan_id } = req.query;

    const where = {};

    if (solicitud_id !== undefined) {
      const solicitudId = toIntOrNull(solicitud_id);
      if (!solicitudId) {
        return res.status(400).json({ mensajeError: 'solicitud_id inválido.' });
      }
      where.solicitud_id = solicitudId;
    }

    if (dni) {
      where.dni = cleanStringOrNull(dni, 20);
    }

    if (plan_id !== undefined) {
      const planId = toIntOrNull(plan_id);
      if (!planId) {
        return res.status(400).json({ mensajeError: 'plan_id inválido.' });
      }
      where.plan_id = planId;
    }

    const registros =
      await DebitosAutomaticosSolicitudesAdicionalesModel.findAll({
        where,
        include: adicionalInclude,
        order: [['id', 'DESC']]
      });

    return res.json(registros);
  } catch (error) {
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   OBR - por ID
========================= */
export const OBR_DebitosAutomaticosSolicitudesAdicionales_CTS = async (
  req,
  res
) => {
  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const registro =
      await DebitosAutomaticosSolicitudesAdicionalesModel.findByPk(id, {
        include: adicionalInclude
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
   Regla:
   - solicitud debe existir
   - solicitud debe estar editable
   - solicitud.modalidad_adhesion debe permitir adicional
   - plan debe existir y estar activo
   - una sola adicional por solicitud
========================= */
export const CR_DebitosAutomaticosSolicitudesAdicionales_CTS = async (
  req,
  res
) => {
  const t = await db.transaction();

  try {
    const solicitud_id = toIntOrNull(req.body?.solicitud_id);
    const nombre = cleanStringOrNull(req.body?.nombre, 150);
    const dni = cleanStringOrNull(req.body?.dni, 20);
    const plan_id = toIntOrNull(req.body?.plan_id);

    if (!solicitud_id) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'solicitud_id es obligatorio.' });
    }

    if (!nombre) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'nombre es obligatorio.' });
    }

    if (!dni) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'dni es obligatorio.' });
    }

    if (!plan_id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'plan_id es obligatorio.' });
    }

    const solicitud = await findSolicitudById(solicitud_id, t);

    if (!solicitud) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'La solicitud no existe.' });
    }

    if (!canEditSolicitud(solicitud)) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'No se puede crear adicional porque la solicitud no está en estado editable.'
      });
    }

    if (
      !MODALIDADES_CON_ADICIONAL.includes(String(solicitud.modalidad_adhesion))
    ) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'La modalidad de la solicitud no permite persona adicional.'
      });
    }

    const plan = await findPlanActivoById(plan_id, t);

    if (!plan) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'El plan_id no existe o está inactivo.'
      });
    }

    const existente =
      await DebitosAutomaticosSolicitudesAdicionalesModel.findOne({
        where: { solicitud_id },
        transaction: t
      });

    if (existente) {
      await t.rollback();
      return res.status(409).json({
        mensajeError: 'La solicitud ya tiene una persona adicional registrada.'
      });
    }

    const creado = await DebitosAutomaticosSolicitudesAdicionalesModel.create(
      {
        solicitud_id,
        nombre,
        dni,
        plan_id
      },
      { transaction: t }
    );

    await t.commit();

    const detalle =
      await DebitosAutomaticosSolicitudesAdicionalesModel.findByPk(creado.id, {
        include: adicionalInclude
      });

    return res.status(201).json({
      message: 'Persona adicional creada correctamente',
      registro: detalle
    });
  } catch (error) {
    await t.rollback();

    if (
      error?.name === 'SequelizeUniqueConstraintError' ||
      String(error?.original?.code || '').includes('ER_DUP_ENTRY')
    ) {
      return res.status(409).json({
        mensajeError: 'La solicitud ya posee una persona adicional.'
      });
    }

    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   UR - update
   Regla:
   - solo si la solicitud asociada está editable
   - solo si la modalidad permite adicional
========================= */
export const UR_DebitosAutomaticosSolicitudesAdicionales_CTS = async (
  req,
  res
) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const current =
      await DebitosAutomaticosSolicitudesAdicionalesModel.findByPk(id, {
        transaction: t
      });

    if (!current) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    const solicitud = await findSolicitudById(current.solicitud_id, t);

    if (!solicitud) {
      await t.rollback();
      return res.status(404).json({
        mensajeError: 'La solicitud asociada no existe.'
      });
    }

    if (!canEditSolicitud(solicitud)) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'No se puede editar la persona adicional porque la solicitud no está en estado editable.'
      });
    }

    if (
      !MODALIDADES_CON_ADICIONAL.includes(String(solicitud.modalidad_adhesion))
    ) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'La modalidad de la solicitud no permite persona adicional.'
      });
    }

    const body = req.body || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

    const updateBody = {};

    if (has('nombre')) {
      const nombre = cleanStringOrNull(body.nombre, 150);
      if (!nombre) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'nombre no puede ser vacío.'
        });
      }
      updateBody.nombre = nombre;
    }

    if (has('dni')) {
      const dni = cleanStringOrNull(body.dni, 20);
      if (!dni) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'dni no puede ser vacío.'
        });
      }
      updateBody.dni = dni;
    }

    if (has('plan_id')) {
      const planId = toIntOrNull(body.plan_id);

      if (!planId) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'plan_id inválido.'
        });
      }

      const plan = await findPlanActivoById(planId, t);

      if (!plan) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'El plan_id no existe o está inactivo.'
        });
      }

      updateBody.plan_id = planId;
    }

    const [numRowsUpdated] =
      await DebitosAutomaticosSolicitudesAdicionalesModel.update(updateBody, {
        where: { id },
        transaction: t
      });

    if (numRowsUpdated !== 1) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    await t.commit();

    const registroActualizado =
      await DebitosAutomaticosSolicitudesAdicionalesModel.findByPk(id, {
        include: adicionalInclude
      });

    return res.json({
      message: 'Persona adicional actualizada correctamente',
      registroActualizado
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   ER - eliminar
   Regla:
   - solo si la solicitud está editable
   - delete físico permitido porque la tabla es dependiente
========================= */
export const ER_DebitosAutomaticosSolicitudesAdicionales_CTS = async (
  req,
  res
) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const current =
      await DebitosAutomaticosSolicitudesAdicionalesModel.findByPk(id, {
        transaction: t
      });

    if (!current) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    const solicitud = await findSolicitudById(current.solicitud_id, t);

    if (!solicitud) {
      await t.rollback();
      return res.status(404).json({
        mensajeError: 'La solicitud asociada no existe.'
      });
    }

    if (!canEditSolicitud(solicitud)) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'No se puede eliminar la persona adicional porque la solicitud no está en estado editable.'
      });
    }

    const num = await DebitosAutomaticosSolicitudesAdicionalesModel.destroy({
      where: { id },
      transaction: t
    });

    if (num !== 1) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    await t.commit();

    return res.json({
      message: 'Persona adicional eliminada correctamente'
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({ mensajeError: error.message });
  }
};
