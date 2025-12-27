/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 25 / 12 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Controladores para la tabla `convenios_mes_acciones`.
 * Registra acciones mensuales por convenio (FINALIZAR_CARGA / ENVIAR_LISTADO),
 * con estado de lectura (leído / leído por) para KPIs del dashboard.
 *
 * Tema: Controladores - ConveniosMesAcciones
 * Capa: Backend
 *
 * Nomenclatura:
 *   OBR_  obtenerRegistro
 *   OBRS_ obtenerRegistros
 *   CR_   crearRegistro
 *   ER_   eliminarRegistro
 */

import db from '../DataBase/db.js';
import { Op } from 'sequelize';

import MD_TB_ConveniosMesAcciones from '../Models/MD_TB_ConveniosMesAcciones.js';
const ConveniosMesAccionesModel =
  MD_TB_ConveniosMesAcciones.ConveniosMesAccionesModel;

import UsersModel from '../Models/MD_TB_Users.js';

// -------------------- Helpers --------------------

const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';

function assertMonthStartFormat(v) {
  const ok = /^\d{4}-\d{2}-01 00:00:00$/.test(String(v || ''));
  if (!ok) {
    const e = new Error('Mes inválido. Debe ser YYYY-MM-01 00:00:00');
    e.statusCode = 400;
    throw e;
  }
}

const ALLOWED_TIPOS = new Set(['FINALIZAR_CARGA', 'ENVIAR_LISTADO']);
function assertTipo(tipo) {
  const t = String(tipo || '').trim();
  if (!ALLOWED_TIPOS.has(t)) {
    const e = new Error(
      "Tipo inválido. Debe ser 'FINALIZAR_CARGA' o 'ENVIAR_LISTADO'."
    );
    e.statusCode = 400;
    throw e;
  }
  return t;
}

const toIntOrNull = (v) => {
  if (isEmpty(v)) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const toBool01OrNull = (v) => {
  if (v === true) return 1;
  if (v === false) return 0;
  if (isEmpty(v)) return null;
  const s = String(v).trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'si' || s === 'sí') return 1;
  if (s === '0' || s === 'false' || s === 'no') return 0;
  return null;
};

async function getConvenioInfo(convenio_id, transaction) {
  const rows = await db.query(
    `
    SELECT id, nameConve, descConve
    FROM adm_convenios
    WHERE id = :convenio_id
    LIMIT 1
    `,
    {
      replacements: { convenio_id },
      type: db.QueryTypes.SELECT,
      transaction
    }
  );
  return rows[0] || null;
}

async function resolveUserInfo({ req, bodyUserId, bodyUserName, transaction }) {
  // 1) Si existe req.user (por middleware), priorizarlo
  if (req?.user && (req.user.id || req.user.name)) {
    return {
      id: toIntOrNull(req.user.id),
      name: isEmpty(req.user.name) ? null : String(req.user.name).trim()
    };
  }

  // 2) Tomar lo que venga en body
  const id = toIntOrNull(bodyUserId);
  const name = isEmpty(bodyUserName) ? null : String(bodyUserName).trim();

  // Si viene nombre, listo
  if (name || !id) return { id, name };

  // 3) Si solo viene id, buscar en users
  const u = await UsersModel.findByPk(id, { transaction });
  if (!u) return { id, name: null };

  return { id, name: u.name || null };
}

function normalizeMetaJson(meta) {
  if (meta === null || meta === undefined) return null;
  if (typeof meta === 'string') {
    const s = meta.trim();
    if (!s) return null;
    // Si ya es string, lo devolvemos (puede ser JSON válido)
    return s;
  }
  try {
    return JSON.stringify(meta);
  } catch {
    return null;
  }
}

// Upsert por UNIQUE (convenio_id, monthStart, tipo)
async function upsertAccion({
  convenio_id,
  monthStart,
  tipo,
  descripcion,
  creado_por_id,
  creado_por_nombre,
  meta_json,
  transaction
}) {
  await db.query(
    `
    INSERT INTO convenios_mes_acciones
      (convenio_id, monthStart, tipo, descripcion, creado_por_id, creado_por_nombre, meta_json)
    VALUES
      (:convenio_id, :monthStart, :tipo, :descripcion, :creado_por_id, :creado_por_nombre, :meta_json)
    ON DUPLICATE KEY UPDATE
      descripcion = VALUES(descripcion),
      meta_json = VALUES(meta_json),
      creado_por_id = VALUES(creado_por_id),
      creado_por_nombre = VALUES(creado_por_nombre),
      updated_at = CURRENT_TIMESTAMP
    `,
    {
      replacements: {
        convenio_id,
        monthStart,
        tipo,
        descripcion: isEmpty(descripcion) ? null : String(descripcion).trim(),
        creado_por_id: creado_por_id ?? null,
        creado_por_nombre: isEmpty(creado_por_nombre)
          ? null
          : String(creado_por_nombre).trim(),
        meta_json
      },
      type: db.QueryTypes.INSERT,
      transaction
    }
  );

  const rows = await db.query(
    `
    SELECT cma.*, ac.nameConve AS convenio_nombre
    FROM convenios_mes_acciones cma
    LEFT JOIN adm_convenios ac ON ac.id = cma.convenio_id
    WHERE cma.convenio_id = :convenio_id
      AND cma.monthStart  = :monthStart
      AND cma.tipo        = :tipo
    LIMIT 1
    `,
    {
      replacements: { convenio_id, monthStart, tipo },
      type: db.QueryTypes.SELECT,
      transaction
    }
  );

  return rows[0] || null;
}

// -------------------- Controladores --------------------

// GET /convenios-mes-acciones
// Filtros: convenio_id, monthStart, tipo, leido, q (busca por descripcion/creado_por/leido_por)
// Paginación: limit, offset
export const OBRS_ConveniosMesAcciones_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const convenio_id = toIntOrNull(req.query.convenio_id);
    const monthStart = isEmpty(req.query.monthStart)
      ? null
      : String(req.query.monthStart).trim();
    const tipo = isEmpty(req.query.tipo) ? null : String(req.query.tipo).trim();
    const leido = toBool01OrNull(req.query.leido);
    const q = isEmpty(req.query.q) ? null : String(req.query.q).trim();

    const limit = Math.min(
      Math.max(toIntOrNull(req.query.limit) || 20, 1),
      200
    );
    const offset = Math.max(toIntOrNull(req.query.offset) || 0, 0);

    if (monthStart) assertMonthStartFormat(monthStart);
    if (tipo) assertTipo(tipo);

    const where = [];
    const repl = { limit, offset };

    if (convenio_id) {
      where.push(`cma.convenio_id = :convenio_id`);
      repl.convenio_id = convenio_id;
    }
    if (monthStart) {
      where.push(`cma.monthStart = :monthStart`);
      repl.monthStart = monthStart;
    }
    if (tipo) {
      where.push(`cma.tipo = :tipo`);
      repl.tipo = tipo;
    }
    if (leido !== null) {
      where.push(`cma.leido = :leido`);
      repl.leido = leido;
    }
    if (q) {
      where.push(
        `(cma.descripcion LIKE :q OR cma.creado_por_nombre LIKE :q OR cma.leido_por_nombre LIKE :q)`
      );
      repl.q = `%${q}%`;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await db.query(
      `
      SELECT
        cma.*,
        ac.nameConve AS convenio_nombre
      FROM convenios_mes_acciones cma
      LEFT JOIN adm_convenios ac ON ac.id = cma.convenio_id
      ${whereSql}
      ORDER BY cma.monthStart DESC, cma.id DESC
      LIMIT :limit OFFSET :offset
      `,
      {
        replacements: repl,
        type: db.QueryTypes.SELECT,
        transaction: t
      }
    );

    const countRows = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM convenios_mes_acciones cma
      ${whereSql}
      `,
      {
        replacements: repl,
        type: db.QueryTypes.SELECT,
        transaction: t
      }
    );

    await t.commit();
    return res.json({
      registros: rows || [],
      meta: {
        total: Number(countRows?.[0]?.total || 0),
        limit,
        offset
      }
    });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// GET /convenios-mes-acciones/:id
export const OBR_ConveniosMesAcciones_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const id = toIntOrNull(req.params.id);
    if (!id || id <= 0) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const rows = await db.query(
      `
      SELECT
        cma.*,
        ac.nameConve AS convenio_nombre
      FROM convenios_mes_acciones cma
      LEFT JOIN adm_convenios ac ON ac.id = cma.convenio_id
      WHERE cma.id = :id
      LIMIT 1
      `,
      {
        replacements: { id },
        type: db.QueryTypes.SELECT,
        transaction: t
      }
    );

    const reg = rows[0] || null;
    if (!reg) {
      await t.commit();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    await t.commit();
    return res.json({ registro: reg });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// POST /convenios-mes-acciones
// Body: convenio_id, monthStart, tipo, descripcion, meta_json, user_id/user_name (opcionales)
// (idempotente por convenio_id+monthStart+tipo)
export const CR_ConveniosMesAcciones_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const convenio_id = toIntOrNull(req.body.convenio_id);
    const monthStart = isEmpty(req.body.monthStart)
      ? null
      : String(req.body.monthStart).trim();
    const tipo = assertTipo(req.body.tipo);

    if (!convenio_id || convenio_id <= 0) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'convenio_id es obligatorio.' });
    }
    if (!monthStart) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'monthStart es obligatorio.' });
    }
    assertMonthStartFormat(monthStart);

    const convenio = await getConvenioInfo(convenio_id, t);
    if (!convenio) {
      const e = new Error('Convenio inexistente.');
      e.statusCode = 404;
      throw e;
    }

    const userInfo = await resolveUserInfo({
      req,
      bodyUserId:
        req.body.user_id ?? req.body.creado_por_id ?? req.body.userId ?? null,
      bodyUserName:
        req.body.user_name ??
        req.body.creado_por_nombre ??
        req.body.userName ??
        null,
      transaction: t
    });

    const meta_json = normalizeMetaJson(req.body.meta_json);

    const registro = await upsertAccion({
      convenio_id,
      monthStart,
      tipo,
      descripcion: req.body.descripcion ?? null,
      creado_por_id: userInfo.id,
      creado_por_nombre: userInfo.name,
      meta_json,
      transaction: t
    });

    await t.commit();
    return res.status(200).json({ registro });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// POST /convenios-mes-acciones/finalizar
// Crea/actualiza acción tipo FINALIZAR_CARGA con descripción default:
// "Avisar a HammerX que finalice la carga"
export const CR_ConveniosMesAcciones_Finalizar_CTS = async (req, res) => {
  req.body.tipo = 'FINALIZAR_CARGA';
  if (isEmpty(req.body.descripcion)) {
    req.body.descripcion = 'Avisar a HammerX que finalice la carga';
  }
  return CR_ConveniosMesAcciones_CTS(req, res);
};

// POST /convenios-mes-acciones/enviar
// Crea/actualiza acción tipo ENVIAR_LISTADO
export const CR_ConveniosMesAcciones_Enviar_CTS = async (req, res) => {
  req.body.tipo = 'ENVIAR_LISTADO';
  if (isEmpty(req.body.descripcion)) {
    req.body.descripcion = 'Enviar listado mensual';
  }
  return CR_ConveniosMesAcciones_CTS(req, res);
};

// POST /convenios-mes-acciones/:id/marcar-leido
// Body: user_id/user_name (opcionales). Si no, intenta req.user.
export const MARCAR_LEIDO_ConveniosMesAcciones_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const id = toIntOrNull(req.params.id);
    if (!id || id <= 0) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const userInfo = await resolveUserInfo({
      req,
      bodyUserId:
        req.body.user_id ?? req.body.leido_por_id ?? req.body.userId ?? null,
      bodyUserName:
        req.body.user_name ??
        req.body.leido_por_nombre ??
        req.body.userName ??
        null,
      transaction: t
    });

    await db.query(
      `
      UPDATE convenios_mes_acciones
      SET
        leido = 1,
        leido_at = CURRENT_TIMESTAMP,
        leido_por_id = :leido_por_id,
        leido_por_nombre = :leido_por_nombre,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = :id
      `,
      {
        replacements: {
          id,
          leido_por_id: userInfo.id ?? null,
          leido_por_nombre: userInfo.name ?? null
        },
        type: db.QueryTypes.UPDATE,
        transaction: t
      }
    );

    const rows = await db.query(
      `
      SELECT cma.*, ac.nameConve AS convenio_nombre
      FROM convenios_mes_acciones cma
      LEFT JOIN adm_convenios ac ON ac.id = cma.convenio_id
      WHERE cma.id = :id
      LIMIT 1
      `,
      {
        replacements: { id },
        type: db.QueryTypes.SELECT,
        transaction: t
      }
    );

    await t.commit();
    return res.json({ registro: rows[0] || null });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// GET /convenios-mes-acciones/pendientes-count?convenio_id=58&monthStart=YYYY-MM-01 00:00:00
export const COUNT_PENDIENTES_ConveniosMesAcciones_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const convenio_id = toIntOrNull(req.query.convenio_id);
    const monthStart = isEmpty(req.query.monthStart)
      ? null
      : String(req.query.monthStart).trim();

    if (!convenio_id || convenio_id <= 0) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'convenio_id es obligatorio.' });
    }
    if (monthStart) assertMonthStartFormat(monthStart);

    const where = [`convenio_id = :convenio_id`, `leido = 0`];
    const repl = { convenio_id };
    if (monthStart) {
      where.push(`monthStart = :monthStart`);
      repl.monthStart = monthStart;
    }

    const rows = await db.query(
      `
      SELECT COUNT(*) AS pendientes
      FROM convenios_mes_acciones
      WHERE ${where.join(' AND ')}
      `,
      {
        replacements: repl,
        type: db.QueryTypes.SELECT,
        transaction: t
      }
    );

    await t.commit();
    return res.json({ pendientes: Number(rows?.[0]?.pendientes || 0) });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};
    