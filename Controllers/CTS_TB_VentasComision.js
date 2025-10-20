/*
 * Archivo: controllers/CTS_TB_VentasComision.js
 * Programador: Benjamin Orellana
 * Creación: 19/10/2025
 * Versión: 1.0
 *
 * Responsabilidad:
 * - CRUD y flujo de aprobación/rechazo de ventas_comisiones
 * - Sincronización con ventas_prospectos (comision, comision_estado, comision_id)
 */

import db from '../DataBase/db.js';
import { Op, fn, col } from 'sequelize';
import { VentasComisionesModel } from '../Models/MD_TB_ventas_comisiones.js';
import { VentasProspectosModel } from '../Models/MD_TB_ventas_prospectos.js';
import UserModel from '../Models/MD_TB_Users.js';

// ========================= Helpers =========================

// Fallbacks sin auth
function getActingRole(req) {
  return (
    req.headers['x-user-role'] ||
    req.body?.userLevel ||
    req.body?.role ||
    'admin'
  )
    .toString()
    .toLowerCase();
}
function getActingUserId(req) {
  const v =
    req.headers['x-user-id'] ||
    req.body?.user_id ||
    req.body?.aprobado_por ||
    req.body?.rechazado_por;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function hasRoleLoose(req, roles = []) {
  if (!roles?.length) return true;
  const role = getActingRole(req);
  return roles.some((r) => r.toLowerCase() === role);
}

const ESTADOS = new Set(['en_revision', 'aprobado', 'rechazado']);

function hasRole(user, roles = []) {
  if (!user) return false;
  // Ajusta a tu realidad: admin/gerenteetc.
  const role = (user.role || user.level || '').toString().toLowerCase();
  const name = (user.name || '').toString();
  // Permitir también por user flags si los tuvieras (is_admin, etc.)
  if (roles.length === 0) return true;
  return roles.some((r) => r.toLowerCase() === role);
}

function toBigIntOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function sanitizeStr(v, max = 255) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s.slice(0, max) : null;
}

function positiveMoneyOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n >= 0 ? n : null;
}

function normalizePlanFields({ tipo_plan, tipo_plan_custom }) {
  const plan = sanitizeStr(tipo_plan, 80);
  const custom = sanitizeStr(tipo_plan_custom, 120);
  if (!plan) throw new Error('Debe indicar el tipo de plan');
  // Si plan es "Otros", exigir custom; si no, ignorar custom
  if (plan.toLowerCase() === 'otros' && !custom) {
    throw new Error('Debe completar el detalle cuando el plan es "Otros"');
  }
  return { plan, custom: plan.toLowerCase() === 'otros' ? custom : null };
}

function normalizeMoneda(m) {
  const x = (m || 'ARS').toString().trim().toUpperCase();
  return x.slice(0, 3); // 'ARS', 'USD', etc.
}

// ========================= Controllers =========================

/**
 * POST /ventas-prospectos/:id/convertir
 * Crea una solicitud de comisión (en_revision) y sincroniza el prospecto
 * Body:
 *  - esComision: boolean
 *  - tipo_plan, tipo_plan_custom, observacion (solo si esComision = true)
 * Nota: si esComision = false, solo marca convertido en el prospecto (y no crea comisión).
 */
export const POST_convertirProspecto_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const prospecto_id = Number(req.params.id);
    if (!prospecto_id) throw new Error('ID de prospecto inválido');

    const prospecto = await VentasProspectosModel.findByPk(prospecto_id, {
      transaction: t
    });
    if (!prospecto) throw new Error('Prospecto no encontrado');

    const esComision = !!req.body?.esComision;

    // 1) Siempre marcamos convertido
    const camposProspecto = {
      convertido: true
    };

    // 2) Si NO es comisión, limpiar datos de comisión del prospecto
    if (!esComision) {
      camposProspecto.comision = false;
      camposProspecto.comision_registrada_at = null;
      camposProspecto.comision_usuario_id = null;
      camposProspecto.comision_estado = null;
      camposProspecto.comision_id = null;

      await VentasProspectosModel.update(camposProspecto, {
        where: { id: prospecto_id },
        transaction: t
      });

      const data = await VentasProspectosModel.findByPk(prospecto_id, {
        transaction: t
      });
      await t.commit();
      return res.json({
        message: 'Prospecto convertido sin comisión',
        prospecto: data
      });
    }

    // 3) Es comisión: validar plan/observación
    const { plan, custom } = normalizePlanFields({
      tipo_plan: req.body?.tipo_plan,
      tipo_plan_custom: req.body?.tipo_plan_custom
    });
    const observacion = sanitizeStr(req.body?.observacion, 255);

    // 4) chequear que NO exista ya una comisión en_revision para este prospecto
    const yaPendiente = await VentasComisionesModel.findOne({
      where: { prospecto_id, estado: 'en_revision' },
      transaction: t
    });
    if (yaPendiente)
      throw new Error('Ya existe una comisión en revisión para este prospecto');

    // 5) vendedor_id: por defecto el usuario logueado
    const vendedor_id =
      toBigIntOrNull(req.user?.id) ||
      toBigIntOrNull(req.body?.vendedor_id) ||
      prospecto.usuario_id;
    if (!vendedor_id) throw new Error('No se pudo determinar el vendedor');

    // 6) sede: tomamos la del prospecto
    const sede =
      String(prospecto.sede || '')
        .trim()
        .toLowerCase() || 'monteros';

    // 7) crear comisión en revisión
    const comision = await VentasComisionesModel.create(
      {
        prospecto_id,
        vendedor_id,
        sede,
        tipo_plan: plan,
        tipo_plan_custom: custom,
        observacion,
        estado: 'en_revision',
        moneda: 'ARS'
      },
      { transaction: t }
    );

    // 8) sincronizar prospecto
    camposProspecto.comision = true;
    camposProspecto.comision_registrada_at = new Date();
    camposProspecto.comision_usuario_id = vendedor_id;
    camposProspecto.comision_estado = 'en_revision';
    camposProspecto.comision_id = comision.id;

    await VentasProspectosModel.update(camposProspecto, {
      where: { id: prospecto_id },
      transaction: t
    });

    const prospectoRefresco = await VentasProspectosModel.findByPk(
      prospecto_id,
      { transaction: t }
    );
    await t.commit();
    return res.status(201).json({
      message: 'Prospecto convertido y comisión creada en revisión',
      prospecto: prospectoRefresco,
      comision
    });
  } catch (err) {
    await t.rollback();
    return res.status(400).json({ mensajeError: err.message });
  }
};

/**
 * GET /ventas-comisiones
 * Filtros: estado, sede, vendedor_id, prospecto_id, q (nombre/dni), fecha_desde, fecha_hasta
 * Paginación: page (1..N), pageSize (default 20)
 * Orden: orderBy (created_at|estado|monto_comision|...), orderDir (ASC|DESC)
 */
export const GET_listarVentasComisiones_CTS = async (req, res) => {
  try {
    const {
      estado,
      sede,
      vendedor_id,
      prospecto_id,
      q,
      fecha_desde,
      fecha_hasta,
      page = 1,
      pageSize = 20,
      orderBy = 'created_at',
      orderDir = 'DESC'
    } = req.query;

    const where = {};
    if (estado) {
      if (!ESTADOS.has(String(estado))) {
        return res.status(400).json({ mensajeError: 'Estado inválido' });
      }
      where.estado = String(estado);
    }
    if (sede) where.sede = String(sede).trim().toLowerCase();
    if (vendedor_id) where.vendedor_id = toBigIntOrNull(vendedor_id);
    if (prospecto_id) where.prospecto_id = toBigIntOrNull(prospecto_id);

    if (fecha_desde || fecha_hasta) {
      where.created_at = {};
      if (fecha_desde) where.created_at[Op.gte] = new Date(fecha_desde);
      if (fecha_hasta) where.created_at[Op.lte] = new Date(fecha_hasta);
    }

    // Búsqueda por nombre/dni del prospecto
    const include = [
      { model: UserModel, as: 'vendedor', attributes: ['id', 'name'] },
      {
        model: VentasProspectosModel,
        as: 'prospecto',
        attributes: ['id', 'nombre', 'dni', 'sede', 'comision_estado']
      }
    ];

    // Ordenamiento seguro
    const ALLOWED_ORDER = new Set([
      'created_at',
      'estado',
      'monto_comision',
      'vendedor_id',
      'prospecto_id'
    ]);
    const order = [
      [
        ALLOWED_ORDER.has(orderBy) ? orderBy : 'created_at',
        String(orderDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
      ]
    ];

    const limit = Math.max(1, Math.min(Number(pageSize) || 20, 200));
    const offset = (Math.max(1, Number(page) || 1) - 1) * limit;

    // Consulta
    const { rows, count } = await VentasComisionesModel.findAndCountAll({
      where,
      include,
      limit,
      offset,
      order
    });

    // Si hay q, filtrar por prospecto en memoria (para no complicar el where con nested LIKE)
    let data = rows;
    if (q) {
      const qq = String(q).toLowerCase();
      data = rows.filter((r) => {
        const p = r.prospecto;
        const nombre = (p?.nombre || '').toLowerCase();
        const dni = (p?.dni || '').toLowerCase();
        return nombre.includes(qq) || dni.includes(qq);
      });
    }

    return res.json({
      total: count,
      page: Number(page),
      pageSize: limit,
      items: data
    });
  } catch (err) {
    return res.status(500).json({ mensajeError: err.message });
  }
};

/**
 * GET /ventas-comisiones/:id
 */
export const GET_obtenerVentaComision_CTS = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ mensajeError: 'ID inválido' });

    const item = await VentasComisionesModel.findByPk(id, {
      include: [
        { model: UserModel, as: 'vendedor', attributes: ['id', 'name'] },
        { model: UserModel, as: 'aprobador', attributes: ['id', 'name'] },
        { model: UserModel, as: 'rechazador', attributes: ['id', 'name'] },
        {
          model: VentasProspectosModel,
          as: 'prospecto',
          attributes: [
            'id',
            'nombre',
            'dni',
            'sede',
            'comision_estado',
            'comision_id'
          ]
        }
      ]
    });
    if (!item)
      return res.status(404).json({ mensajeError: 'Comisión no encontrada' });
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ mensajeError: err.message });
  }
};

/**
 * PUT /ventas-comisiones/:id
 * Permite editar SOLO si está en_revision:
 *  - tipo_plan, tipo_plan_custom, observacion, sede
 */
export const PUT_actualizarVentaComision_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const id = Number(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido' });
    }

    const com = await VentasComisionesModel.findByPk(id, { transaction: t });
    if (!com) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Comisión no encontrada' });
    }
    if (com.estado !== 'en_revision') {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'Solo se puede editar una comisión en revisión'
      });
    }

    const updates = {};

    // ✅ Chequear contra undefined (no “truthy”) para permitir strings vacíos y updates parciales
    if (
      req.body?.tipo_plan !== undefined ||
      req.body?.tipo_plan_custom !== undefined
    ) {
      const { plan, custom } = normalizePlanFields({
        tipo_plan: req.body?.tipo_plan ?? com.tipo_plan,
        tipo_plan_custom: req.body?.tipo_plan_custom ?? com.tipo_plan_custom
      });
      updates.tipo_plan = plan;
      updates.tipo_plan_custom = custom;
    }

    if (req.body?.observacion !== undefined) {
      updates.observacion = sanitizeStr(req.body?.observacion, 255);
    }

    if (req.body?.sede !== undefined) {
      updates.sede = String(req.body?.sede || '')
        .trim()
        .toLowerCase();
    }

    if (Object.keys(updates).length === 0) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'Sin campos válidos para actualizar' });
    }

    await VentasComisionesModel.update(updates, {
      where: { id },
      transaction: t
    });
    const data = await VentasComisionesModel.findByPk(id, { transaction: t });

    await t.commit();
    return res.json({ message: 'Comisión actualizada', data });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ mensajeError: err.message });
  }
};

/**
 * PUT /ventas-comisiones/:id/aprobar
 * Body: { monto_comision, moneda }
 * Requiere roldmin
 */
export const PUT_aprobarVentaComision_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    // ✅ Sin auth: intentamos rol desde headers/body; por default “admin”
    if (!hasRoleLoose(req, ['admin', 'gerente'])) {
      await t.rollback();
      return res.status(403).json({ mensajeError: 'No autorizado' });
    }

    const id = Number(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido' });
    }

    const com = await VentasComisionesModel.findByPk(id, { transaction: t });
    if (!com) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Comisión no encontrada' });
    }
    if (!['en_revision', 'rechazado'].includes(com.estado)) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'Solo se puede aprobar si está en revisión o rechazada'
      });
    }

    const monto = positiveMoneyOrNull(req.body?.monto_comision);
    if (monto === null) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'monto_comision inválido' });
    }
    const moneda = normalizeMoneda(req.body?.moneda);
    const aprobadorId = getActingUserId(req);

    await VentasComisionesModel.update(
      {
        estado: 'aprobado',
        monto_comision: monto,
        moneda,
        aprobado_por: aprobadorId,
        aprobado_at: new Date(),
        // limpiar rechazo anterior (si lo había)
        rechazado_por: null,
        rechazado_at: null,
        motivo_rechazo: null
      },
      { where: { id }, transaction: t }
    );

    // sync prospecto
    await VentasProspectosModel.update(
      {
        comision_estado: 'aprobado',
        comision: true,
        comision_registrada_at: com.aprobado_at ?? new Date(),
        comision_usuario_id: com.vendedor_id,
        comision_id: com.id
      },
      { where: { id: com.prospecto_id }, transaction: t }
    );

    // Sincronizar prospecto
    const p = await VentasProspectosModel.findByPk(com.prospecto_id, {
      transaction: t
    });
    if (p) {
      await VentasProspectosModel.update(
        {
          comision_estado: 'aprobado',
          comision: true,
          comision_registrada_at: p.comision_registrada_at ?? new Date(),
          comision_usuario_id: p.comision_usuario_id ?? com.vendedor_id,
          comision_id: com.id
        },
        { where: { id: p.id }, transaction: t }
      );
    }

    const data = await VentasComisionesModel.findByPk(id, {
      transaction: t,
      include: [
        { model: UserModel, as: 'vendedor', attributes: ['id', 'name'] },
        { model: UserModel, as: 'aprobador', attributes: ['id', 'name'] },
        {
          model: VentasProspectosModel,
          as: 'prospecto',
          attributes: ['id', 'nombre', 'dni', 'sede', 'comision_estado']
        }
      ]
    });

    await t.commit();
    return res.json({ message: 'Comisión aprobada', data });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ mensajeError: err.message });
  }
};

/**
 * PUT /ventas-comisiones/:id/rechazar
 * Body: { motivo_rechazo }
 * Requiere roldmin
 */
export const PUT_rechazarVentaComision_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    if (!hasRoleLoose(req, ['admin', 'gerente'])) {
      await t.rollback();
      return res.status(403).json({ mensajeError: 'No autorizado' });
    }

    const id = Number(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido' });
    }

    const com = await VentasComisionesModel.findByPk(id, { transaction: t });
    if (!com) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Comisión no encontrada' });
    }
  if (!['en_revision', 'aprobado'].includes(com.estado)) {
    await t.rollback();
    return res
      .status(400)
      .json({
        mensajeError: 'Solo se puede rechazar si está en revisión o aprobada'
      });
  }

  const motivo =
    sanitizeStr(req.body?.motivo_rechazo, 255) || 'Rechazada por coordinación';
  const rechezId = getActingUserId(req);

  await VentasComisionesModel.update(
    {
      estado: 'rechazado',
      rechazado_por: rechezId,
      rechazado_at: new Date(),
      motivo_rechazo: motivo
      // NO tocamos monto_comision: podés decidir si lo querés preservar para auditoría.
    },
    { where: { id }, transaction: t }
  );

  // sync prospecto
  await VentasProspectosModel.update(
    {
      comision_estado: 'rechazado',
      comision: true, // lo mantenemos visible como caso de comisión
      comision_id: com.id
    },
    { where: { id: com.prospecto_id }, transaction: t }
  );

    const p = await VentasProspectosModel.findByPk(com.prospecto_id, {
      transaction: t
    });
    if (p) {
      await VentasProspectosModel.update(
        {
          comision_estado: 'rechazado',
          comision: p.comision,
          comision_id: com.id
        },
        { where: { id: p.id }, transaction: t }
      );
    }

    const data = await VentasComisionesModel.findByPk(id, {
      transaction: t,
      include: [
        { model: UserModel, as: 'vendedor', attributes: ['id', 'name'] },
        { model: UserModel, as: 'rechazador', attributes: ['id', 'name'] },
        {
          model: VentasProspectosModel,
          as: 'prospecto',
          attributes: ['id', 'nombre', 'dni', 'sede', 'comision_estado']
        }
      ]
    });

    await t.commit();
    return res.json({ message: 'Comisión rechazada', data });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ mensajeError: err.message });
  }
};

/**
 * DELETE /ventas-comisiones/:id
 * Solo permite eliminar si está en_revision. Limpia el vínculo en el prospecto.
 * Requiere roldmin
 */
export const DEL_eliminarVentaComision_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    if (!hasRole(req.user, ['admin', 'gerente'])) {
      await t.rollback();
      return res.status(403).json({ mensajeError: 'No autorizado' });
    }

    const id = Number(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido' });
    }

    const com = await VentasComisionesModel.findByPk(id, { transaction: t });
    if (!com) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Comisión no encontrada' });
    }
    if (com.estado !== 'en_revision') {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'Solo se pueden eliminar comisiones en revisión'
      });
    }

    // limpiar prospecto si apuntaba a esta comisión
    const p = await VentasProspectosModel.findByPk(com.prospecto_id, {
      transaction: t
    });
    if (p && p.comision_id === com.id) {
      await VentasProspectosModel.update(
        {
          comision_estado: null,
          comision_id: null
          // si querés además limpiar metadatos:
          // comision: false,
          // comision_registrada_at: null,
          // comision_usuario_id: null
        },
        { where: { id: p.id }, transaction: t }
      );
    }

    await VentasComisionesModel.destroy({ where: { id }, transaction: t });

    await t.commit();
    return res.json({ message: 'Comisión eliminada' });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ mensajeError: err.message });
  }
};

// GET /ventas-comisiones/resumen?vendedor_id=...&mes=..&anio=..
export const GET_resumenComisionesVendedor_CTS = async (req, res) => {
  try {
    const vendedor_id = Number(req.query.vendedor_id);
    if (!vendedor_id) {
      return res.status(400).json({ mensajeError: 'vendedor_id requerido' });
    }

    const ahora = new Date();
    const mes = Number(req.query.mes ?? (ahora.getMonth() + 1));
    const anio = Number(req.query.anio ?? ahora.getFullYear());

    const desde = new Date(anio, mes - 1, 1, 0, 0, 0, 0);
    const hasta = new Date(anio, mes, 0, 23, 59, 59, 999);

    // total mensual (solo aprobadas; usamos aprobado_at para rango)
    const totalMensual = await VentasComisionesModel.findOne({
      attributes: [[fn('COALESCE', fn('SUM', col('monto_comision')), 0), 'total']],
      where: {
        vendedor_id,
        estado: 'aprobado',
        aprobado_at: { [Op.between]: [desde, hasta] }
      },
      raw: true
    });

    // total histórico (solo aprobadas)
    const totalHistorico = await VentasComisionesModel.findOne({
      attributes: [[fn('COALESCE', fn('SUM', col('monto_comision')), 0), 'total']],
      where: { vendedor_id, estado: 'aprobado' },
      raw: true
    });

    return res.json({
      vendedor_id,
      periodo: { mes, anio },
      total_mensual_aprobado: Number(totalMensual?.total || 0),
      total_historico_aprobado: Number(totalHistorico?.total || 0)
    });
  } catch (err) {
    return res.status(500).json({ mensajeError: err.message });
  }
};

// GET /ventas-comisiones/vendedor?vendedor_id=...&estado=aprobado&mes=..&anio=..&page=1&limit=15
export const GET_listarComisionesVendedor_CTS = async (req, res) => {
  try {
    const vendedor_id = Number(req.query.vendedor_id);
    if (!vendedor_id) {
      return res.status(400).json({ mensajeError: 'vendedor_id requerido' });
    }

    const estado = req.query.estado || 'aprobado'; // default
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 15)));
    const offset = (page - 1) * limit;

    const ahora = new Date();
    const mes = req.query.mes ? Number(req.query.mes) : (ahora.getMonth() + 1);
    const anio = req.query.anio ? Number(req.query.anio) : ahora.getFullYear();

    const desde = new Date(anio, mes - 1, 1, 0, 0, 0, 0);
    const hasta = new Date(anio, mes, 0, 23, 59, 59, 999);

    // Para aprobadas filtramos por aprobado_at; para otros estados, por created_at
    const dateField = estado === 'aprobado' ? 'aprobado_at' : 'created_at';

    const where = { vendedor_id, estado };
    // Si por algún motivo el campo de fecha es nulo, este filtro lo excluye (esperable)
    where[dateField] = { [Op.between]: [desde, hasta] };

    const { rows, count } = await VentasComisionesModel.findAndCountAll({
      where,
      order: [[dateField, 'DESC']],
      limit,
      offset,
      include: [
        { model: UserModel, as: 'vendedor', attributes: ['id', 'name'] },
        { model: VentasProspectosModel, as: 'prospecto', attributes: ['id', 'nombre', 'dni', 'sede'] }
      ]
    });

    return res.json({ page, limit, total: count, items: rows });
  } catch (err) {
    return res.status(500).json({ mensajeError: err.message });
  }
};
