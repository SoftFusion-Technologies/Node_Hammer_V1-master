/*
/*
  * Programador: Benjamin Orellana
  * Fecha Creación: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_IntegrantesConve.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - IntegrantesConve
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importar los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_IntegrantesConve from '../Models/MD_TB_IntegrantesConve.js';
import db from '../DataBase/db.js';

// Asignar los modelos a variables para su uso en los controladores
const IntegrantesConveModel = MD_TB_IntegrantesConve.IntegrantesConveModel;

import MD_TB_ConveniosPlanesDisponibles from '../Models/MD_TB_ConveniosPlanesDisponibles.js';
const ConveniosPlanesDisponiblesModel =
  MD_TB_ConveniosPlanesDisponibles.ConveniosPlanesDisponiblesModel;

// Modelo Convenios (adm_convenios)
import MD_TB_AdmConvenios from '../Models/MD_TB_AdmConvenios.js';
const AdmConveniosModel = MD_TB_AdmConvenios.AdmConveniosModel;
import puppeteer from 'puppeteer'; // para armar el listado

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'integrantes_conve'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla integrantes_conve
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';

const toDateOrNull = (v) => {
  if (isEmpty(v)) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;

  const s = String(v).trim();
  if (!s || s.toLowerCase() === 'invalid date') return null;

  // Soportar "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ss"
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(normalized);

  return Number.isNaN(d.getTime()) ? null : d;
};

const toIntOrNull = (v) => {
  if (isEmpty(v)) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};

// Acepta:
// - Date
// - ISO: 2026-02-19T03:00:00.000Z
// - MySQL: 2025-12-21 20:26:17
// - AR: 20/01/2026 16:57:22 (o con hora opcional)
const parseDateFlexible = (v) => {
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v;
  }
  if (isEmpty(v)) return null;

  const s = String(v).trim();

  // Caso ISO directo
  if (s.includes('T')) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Caso MySQL: "YYYY-MM-DD HH:mm:ss"
  if (/^\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?$/.test(s)) {
    const isoLike = s.includes(' ') ? s.replace(' ', 'T') : `${s}T00:00:00`;
    const d = new Date(isoLike);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Caso AR: "DD/MM/YYYY" + opcional "HH:mm:ss"
  const m = s.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const HH = Number(m[4] || 0);
    const MI = Number(m[5] || 0);
    const SS = Number(m[6] || 0);

    const d = new Date(yyyy, mm - 1, dd, HH, MI, SS);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Último intento
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Devuelve: { id_conv, monthStart } para un integrante (monthStart siempre YYYY-MM-01 00:00:00)
async function getIntegranteMonthInfo(id, transaction) {
  const rows = await db.query(
    `
    SELECT
      id_conv,
      DATE_FORMAT(fechaCreacion, '%Y-%m-01 00:00:00') AS monthStart
    FROM integrantes_conve
    WHERE id = :id
    LIMIT 1
    `,
    {
      replacements: { id },
      type: db.QueryTypes.SELECT,
      transaction
    }
  );
  return rows[0] || null;
}

// Devuelve monthStart del mes abierto (MAX(fechaCreacion)) para el convenio
async function getOpenMonthStart(convenio_id, transaction) {
  const rows = await db.query(
    `
    SELECT
      DATE_FORMAT(MAX(fechaCreacion), '%Y-%m-01 00:00:00') AS openMonth
    FROM integrantes_conve
    WHERE id_conv = :convenio_id
    `,
    {
      replacements: { convenio_id },
      type: db.QueryTypes.SELECT,
      transaction
    }
  );
  return rows[0]?.openMonth || null; // null si no hay registros
}

// Devuelve true/false según adm_convenios.permiteFec (0/1)
// Esto nos permite saber si el convenio permite o no manejar fechas de creacion y vencimiento
// si no permite, anulamos el filtro en el OBRS
async function getConvenioPermiteFec(convenio_id, transaction) {
  const rows = await db.query(
    `
    SELECT permiteFec
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

  // Si no existe el convenio, por seguridad tratamos como "sin fechas"
  return Number(rows[0]?.permiteFec ?? 0) === 1;
}

// Validación estricta: inicio de mes
function assertMonthStartFormat(v) {
  const ok = /^\d{4}-\d{2}-01 00:00:00$/.test(String(v || ''));
  if (!ok) {
    const e = new Error('Mes inválido. Debe ser YYYY-MM-01 00:00:00');
    e.statusCode = 400;
    throw e;
  }
}

async function assertMesEditable({
  convenio_id,
  monthStart,
  transaction,
  requireOpenMonth = true // <-- NUEVO
}) {
  assertMonthStartFormat(monthStart);

  // 0) No permitir modificar meses anteriores al actual
  const nowRows = await db.query(
    `SELECT DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00') AS currentMonth`,
    { type: db.QueryTypes.SELECT, transaction }
  );
  const currentMonth = nowRows[0]?.currentMonth;

  if (String(monthStart) < String(currentMonth)) {
    const e = new Error(
      'Mes anterior al actual: no se permiten modificaciones.'
    );
    e.statusCode = 403;
    throw e;
  }

  // 1) Mes no congelado
  const frozen = await db.query(
    `
    SELECT 1
    FROM congelamiento_integrantes
    WHERE convenio_id = :convenio_id
      AND vencimiento = :monthStart
      AND estado = 1
    LIMIT 1
    `,
    {
      replacements: { convenio_id, monthStart },
      type: db.QueryTypes.SELECT,
      transaction
    }
  );

  if (frozen.length) {
    const e = new Error('Mes congelado: no se permiten modificaciones.');
    e.statusCode = 423;
    throw e;
  }

  // 2) Debe ser el mes abierto (solo si requireOpenMonth = true)
  if (!requireOpenMonth) return;

  const hasAny = await db.query(
    `SELECT 1 FROM integrantes_conve WHERE id_conv = :convenio_id LIMIT 1`,
    {
      replacements: { convenio_id },
      type: db.QueryTypes.SELECT,
      transaction
    }
  );

  if (!hasAny.length) return; // primer mes editable

  const isOpen = await db.query(
    `
    SELECT 1
    WHERE :monthStart = (
      SELECT DATE_FORMAT(MAX(fechaCreacion), '%Y-%m-01 00:00:00')
      FROM integrantes_conve
      WHERE id_conv = :convenio_id
    )
    `,
    {
      replacements: { convenio_id, monthStart },
      type: db.QueryTypes.SELECT,
      transaction
    }
  );

  if (!isOpen.length) {
    const e = new Error(
      'Mes no editable: solo se permite editar el mes abierto (último mes).'
    );
    e.statusCode = 403;
    throw e;
  }
}

// Calcula nextMonth (inicio del mes siguiente) desde monthStart
async function getNextMonth(monthStart, transaction) {
  const rows = await db.query(
    `SELECT DATE_ADD(:monthStart, INTERVAL 1 MONTH) AS nextMonth`,
    {
      replacements: { monthStart },
      type: db.QueryTypes.SELECT,
      transaction
    }
  );
  return rows[0]?.nextMonth || null;
}

async function isMonthFrozen(convenio_id, monthStart, transaction) {
  const rows = await db.query(
    `
    SELECT 1
    FROM congelamiento_integrantes
    WHERE convenio_id = :convenio_id
      AND vencimiento = :monthStart
      AND estado = 1
    LIMIT 1
    `,
    {
      replacements: { convenio_id, monthStart },
      type: db.QueryTypes.SELECT,
      transaction
    }
  );
  return rows.length > 0;
}

export const OBRS_IntegrantesConve_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const id_conv = Number(req.query.id_conv || 0);
    if (!Number.isFinite(id_conv) || id_conv <= 0) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'id_conv es obligatorio (query param).' });
    }

    const permiteFec = await getConvenioPermiteFec(id_conv, t);

    // openMonth siempre lo calculamos (sirve para meta)
    const openMonth = await getOpenMonthStart(id_conv, t);

    // monthStart solo aplica como filtro si permiteFec = 1
    let monthStart = null;

    if (permiteFec) {
      monthStart = req.query.monthStart ? String(req.query.monthStart) : null;
      if (monthStart) assertMonthStartFormat(monthStart);

      if (!monthStart) monthStart = openMonth;

      // Si no hay registros aún
      if (!monthStart) {
        await t.commit();
        return res.json({
          registros: [],
          meta: {
            id_conv,
            permiteFec: 1,
            monthStart: null,
            nextMonth: null,
            openMonth: null,
            isFrozen: false,
            isOpenMonth: false,
            filterMode: 'monthly'
          }
        });
      }
    } else {
      // Si NO permite fechas: anulamos filtro por fechaCreacion.
      // Igual devolvemos openMonth en meta (si existe) para no romper el front.
      monthStart = openMonth || null;
    }

    const nextMonth = monthStart ? await getNextMonth(monthStart, t) : null;

    // acá usamos SQL CRUDO para que NO haya corrimiento por timezone de Sequelize
    let rows = [];

    if (permiteFec) {
      // === MODO MENSUAL ===
      rows = await db.query(
        `
    SELECT
      ic.*,

      p.id              AS plan__id,
      p.nombre_plan     AS plan__nombre_plan,
      p.duracion_dias   AS plan__duracion_dias,
      p.precio_lista    AS plan__precio_lista,
      p.descuento_valor AS plan__descuento_valor,
      p.precio_final    AS plan__precio_final,
      p.activo          AS plan__activo,

      CASE
        WHEN ic.convenio_plan_id IS NULL THEN 0
        WHEN ic.fecha_vencimiento IS NULL THEN 1

        /* NUEVO: el "primer mes" (alta real) NO debe quedar locked */
        WHEN fm.first_month IS NOT NULL
        AND DATE_FORMAT(:monthStart, '%Y-%m') = fm.first_month THEN 0

        /* Desde el mes siguiente en adelante: locked mientras el mes sea anterior al vencimiento */
        WHEN :monthStart < ic.fecha_vencimiento THEN 1
        ELSE 0
      END AS locked_este_mes,

      CASE
        WHEN ic.convenio_plan_id IS NULL THEN 1
        WHEN ic.fecha_vencimiento IS NOT NULL AND :monthStart >= ic.fecha_vencimiento THEN 1
        WHEN fm.first_month IS NULL THEN 1
        WHEN DATE_FORMAT(ic.fechaCreacion, '%Y-%m') = fm.first_month THEN 1
        ELSE 0
      END AS cobrar_este_mes

    FROM integrantes_conve ic
    LEFT JOIN convenios_planes_disponibles p
      ON p.id = ic.convenio_plan_id

    LEFT JOIN (
      SELECT
        s.convenio_plan_id,
        s.person_key,
        s.fecha_vencimiento,
        MIN(s.month_ym) AS first_month
      FROM (
        SELECT
          s.convenio_plan_id,
          CASE
            WHEN s.dni IS NOT NULL AND TRIM(s.dni) <> '' THEN CONCAT('D:', TRIM(s.dni))
            WHEN s.email IS NOT NULL AND TRIM(s.email) <> '' THEN CONCAT('E:', LOWER(TRIM(s.email)))
            WHEN s.telefono IS NOT NULL AND TRIM(s.telefono) <> '' THEN CONCAT('T:', TRIM(s.telefono))
            ELSE CONCAT('I:', s.id)
          END AS person_key,
          s.fecha_vencimiento,
          DATE_FORMAT(s.fechaCreacion, '%Y-%m') AS month_ym
        FROM integrantes_conve s
        JOIN (
          SELECT DISTINCT
            ic2.convenio_plan_id,
            CASE
              WHEN ic2.dni IS NOT NULL AND TRIM(ic2.dni) <> '' THEN CONCAT('D:', TRIM(ic2.dni))
              WHEN ic2.email IS NOT NULL AND TRIM(ic2.email) <> '' THEN CONCAT('E:', LOWER(TRIM(ic2.email)))
              WHEN ic2.telefono IS NOT NULL AND TRIM(ic2.telefono) <> '' THEN CONCAT('T:', TRIM(ic2.telefono))
              ELSE CONCAT('I:', ic2.id)
            END AS person_key,
            ic2.fecha_vencimiento
          FROM integrantes_conve ic2
          WHERE ic2.id_conv = :id_conv
            AND ic2.fechaCreacion >= :monthStart
            AND ic2.fechaCreacion <  :nextMonth
            AND ic2.convenio_plan_id IS NOT NULL
        ) cur
          ON cur.convenio_plan_id = s.convenio_plan_id
         AND cur.person_key =
            CASE
              WHEN s.dni IS NOT NULL AND TRIM(s.dni) <> '' THEN CONCAT('D:', TRIM(s.dni))
              WHEN s.email IS NOT NULL AND TRIM(s.email) <> '' THEN CONCAT('E:', LOWER(TRIM(s.email)))
              WHEN s.telefono IS NOT NULL AND TRIM(s.telefono) <> '' THEN CONCAT('T:', TRIM(s.telefono))
              ELSE CONCAT('I:', s.id)
            END
         AND (
            (cur.fecha_vencimiento IS NULL AND s.fecha_vencimiento IS NULL)
            OR cur.fecha_vencimiento = s.fecha_vencimiento
         )
        WHERE s.id_conv = :id_conv
          AND s.convenio_plan_id IS NOT NULL
      ) s
      GROUP BY s.convenio_plan_id, s.person_key, s.fecha_vencimiento
    ) fm
      ON fm.convenio_plan_id = ic.convenio_plan_id
     AND fm.person_key =
        CASE
          WHEN ic.dni IS NOT NULL AND TRIM(ic.dni) <> '' THEN CONCAT('D:', TRIM(ic.dni))
          WHEN ic.email IS NOT NULL AND TRIM(ic.email) <> '' THEN CONCAT('E:', LOWER(TRIM(ic.email)))
          WHEN ic.telefono IS NOT NULL AND TRIM(ic.telefono) <> '' THEN CONCAT('T:', TRIM(ic.telefono))
          ELSE CONCAT('I:', ic.id)
        END
     AND (
        (fm.fecha_vencimiento IS NULL AND ic.fecha_vencimiento IS NULL)
        OR fm.fecha_vencimiento = ic.fecha_vencimiento
     )

    WHERE ic.id_conv = :id_conv
      AND ic.fechaCreacion >= :monthStart
      AND ic.fechaCreacion <  :nextMonth

    ORDER BY ic.id DESC
    `,
        {
          replacements: { id_conv, monthStart, nextMonth },
          type: db.QueryTypes.SELECT,
          transaction: t
        }
      );
    } else {
      // === MODO GLOBAL (SIN FILTRO POR FECHA) ===
      rows = await db.query(
        `
    SELECT
      ic.*,

      p.id              AS plan__id,
      p.nombre_plan     AS plan__nombre_plan,
      p.duracion_dias   AS plan__duracion_dias,
      p.precio_lista    AS plan__precio_lista,
      p.descuento_valor AS plan__descuento_valor,
      p.precio_final    AS plan__precio_final,
      p.activo          AS plan__activo,

      /* Sin lógica mensual */
      0 AS locked_este_mes,
      1 AS cobrar_este_mes

    FROM integrantes_conve ic
    LEFT JOIN convenios_planes_disponibles p
      ON p.id = ic.convenio_plan_id

    WHERE ic.id_conv = :id_conv
    ORDER BY ic.id DESC
    `,
        {
          replacements: { id_conv },
          type: db.QueryTypes.SELECT,
          transaction: t
        }
      );
    }

    // reconstruimos el shape que el front ya consume: { ...integrante, plan: {...} | null }
    const registros = (rows || []).map((r) => {
      const {
        plan__id,
        plan__nombre_plan,
        plan__duracion_dias,
        plan__precio_lista,
        plan__descuento_valor,
        plan__precio_final,
        plan__activo,
        ...rest
      } = r;

      const plan =
        plan__id != null
          ? {
              id: plan__id,
              nombre_plan: plan__nombre_plan,
              duracion_dias: plan__duracion_dias,
              precio_lista: plan__precio_lista,
              descuento_valor: plan__descuento_valor,
              precio_final: plan__precio_final,
              activo: plan__activo
            }
          : null;

      return { ...rest, plan };
    });

    const frozen =
      permiteFec && monthStart
        ? await isMonthFrozen(id_conv, monthStart, t)
        : false;

    await t.commit();
    return res.json({
      registros,
      meta: {
        id_conv,
        permiteFec: permiteFec ? 1 : 0,
        filterMode: permiteFec ? 'monthly' : 'all',
        monthStart,
        nextMonth,
        openMonth,
        isFrozen: frozen,
        isOpenMonth:
          permiteFec && monthStart
            ? String(openMonth) === String(monthStart)
            : false
      }
    });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// ==============================
// Helpers nuevos para PDF
// ==============================
const ARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2
});

const safeNum = (v) => {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

// Obtiene un número desde varias claves posibles (sin romper SQL por columnas inexistentes)
const pickNum = (obj, keys) => {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) {
      const v = obj[k];
      if (v !== null && v !== undefined && String(v).trim() !== '')
        return safeNum(v);
    }
  }
  return 0;
};

const monthLabelFromMonthStart = (monthStart) => {
  const [ym] = String(monthStart).split(' ');
  const [y, m] = ym.split('-').map(Number);
  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre'
  ];
  if (!y || !m) return String(monthStart);
  return `${monthNames[m - 1]} ${y}`;
};

const toTitleWords = (s) =>
  String(s || '')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const formatEstado = (estadoRaw) => {
  const s = String(estadoRaw || '').trim();
  if (!s) return '—';

  const map = {
    sin_autorizacion: 'Sin autorización',
    autorizado: 'Autorizado',
    pendiente: 'Pendiente',
    rechazado: 'Rechazado'
  };

  if (map[s]) return map[s];

  // fallback: "algo_raro" -> "Algo Raro"
  return toTitleWords(s.replaceAll('_', ' '));
};

const estadoBadgeClass = (estadoRaw) => {
  const s = String(estadoRaw || '').trim();
  if (s === 'autorizado') return 'badge badge--ok';
  if (s === 'sin_autorizacion') return 'badge badge--warn';
  if (s === 'rechazado') return 'badge badge--bad';
  if (s === 'pendiente') return 'badge badge--mid';
  return 'badge';
};

// Escape HTML
function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const buildIntegrantesPdfHtml = ({ meta, registros, totals }) => {
  const mes = meta.monthStart ? monthLabelFromMonthStart(meta.monthStart) : '—';
  const generado = new Date().toLocaleString('es-AR');

  const convenioLabel = meta.convenioNombre
    ? `${meta.convenioNombre} (#${meta.id_conv})`
    : `Convenio #${meta.id_conv}`;

  const titulo = `Listado de integrantes - ${convenioLabel}`;

  const rowsHtml = (registros || [])
    .map((r, idx) => {
      const nombre = r.nombre || '—';
      const dni = r.dni || '—';
      const tel = r.telefono || '—';
      const email = r.email || '—';
      const sede = r.sede || '—';

      const estadoText = formatEstado(r.estado_autorizacion);
      const badgeClass = estadoBadgeClass(r.estado_autorizacion);

      // Montos robustos: soporta nombres alternativos reales
      const montoN = pickNum(r, [
        'monto',
        'precio_lista',
        'precio',
        'monto_mensual',
        'precioLista'
      ]);
      const descN = pickNum(r, [
        'descuento',
        'descuento_valor',
        'descuentoValor',
        'descuento_concep'
      ]);
      const finalN = pickNum(r, [
        'importe_final',
        'precio_final',
        'preciofinal',
        'importeFinal',
        'preciofinal_concep'
      ]);

      const monto = ARS.format(montoN);
      const descuento = ARS.format(descN);
      const importeFinal = ARS.format(finalN);

      const plan = r.plan?.nombre_plan ? String(r.plan.nombre_plan) : '—';

      return `
        <tr>
          <td class="cell mono">${String(idx + 1).padStart(2, '0')}</td>

          <td class="cell">
            <div class="strong">${escapeHtml(nombre)}</div>
            <div class="muted">DNI: ${escapeHtml(dni)} · Tel: ${escapeHtml(
        tel
      )}</div>
            <div class="muted">${escapeHtml(email)}</div>
          </td>

          <td class="cell">${escapeHtml(sede)}</td>
          <td class="cell">${escapeHtml(plan)}</td>

          <td class="cell right mono">${escapeHtml(monto)}</td>
          <td class="cell right mono">${escapeHtml(descuento)}</td>
          <td class="cell right mono strong">${escapeHtml(importeFinal)}</td>

          <td class="cell">
            <span class="${badgeClass}">${escapeHtml(estadoText)}</span>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(titulo)}</title>

<style>
  @page { size: A4; margin: 18mm 12mm 18mm 12mm; }

  :root{
    --orange: #fc4b08;
    --orange2:#ff7a18;
    --ink: #0f172a;
    --muted: #64748b;
    --line: #e2e8f0;
    --soft: #f8fafc;
  }

  * { box-sizing: border-box; }
  body {
    font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    color: var(--ink);
    background: #ffffff;
    margin: 0;
  }

  .topbar{
    height: 6px;
    background: linear-gradient(90deg, var(--orange), var(--orange2));
    border-radius: 999px;
    margin-bottom: 10px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
    margin-bottom: 12px;
  }

  .brand {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .brand .h1 {
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 0.2px;
    line-height: 1.2;
  }

  .brand .h2 {
    font-size: 12px;
    color: var(--muted);
  }

  .sf {
    text-align: right;
    font-size: 11px;
    color: var(--muted);
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-end;
  }

  .sf .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border: 1px solid rgba(252,75,8,.25);
    background: rgba(252,75,8,.06);
    border-radius: 999px;
    font-weight: 800;
    color: var(--orange);
    letter-spacing: .06em;
    font-size: 10px;
  }

  .sf .url {
    font-size: 10px;
    color: var(--muted);
  }

  .meta {
    margin-top: 6px;
    font-size: 11px;
    color: var(--muted);
    display: grid;
    gap: 3px;
  }

  .meta b { color: var(--ink); }

  .kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin: 10px 0 14px 0;
  }

  .kpi {
    border: 1px solid rgba(252,75,8,.18);
    border-radius: 12px;
    padding: 10px;
    background: linear-gradient(180deg, rgba(252,75,8,.06), rgba(255,255,255,1));
  }

  .kpi .lbl { font-size: 10px; color: var(--muted); margin-bottom: 6px; }
  .kpi .val { font-size: 12px; font-weight: 900; color: var(--ink); }

  .table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid var(--line);
    border-radius: 14px;
    overflow: hidden;
  }

  thead th {
    background: linear-gradient(135deg, var(--orange), var(--orange2));
    color: #ffffff;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 10px 8px;
    text-align: left;
  }

  tbody td {
    border-top: 1px solid var(--line);
    padding: 9px 8px;
    vertical-align: top;
    font-size: 10.5px;
  }

  tbody tr:nth-child(even) td { background: var(--soft); }

  .right { text-align: right; }
  .mono { font-variant-numeric: tabular-nums; }
  .strong { font-weight: 900; }
  .muted { color: var(--muted); font-size: 10px; margin-top: 2px; }

  .badge{
    display:inline-block;
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
    border: 1px solid rgba(15,23,42,.12);
    background: rgba(15,23,42,.04);
    color: var(--ink);
    white-space: nowrap;
  }
  .badge--ok{
    border-color: rgba(22,163,74,.25);
    background: rgba(22,163,74,.10);
    color: #166534;
  }
  .badge--warn{
    border-color: rgba(252,75,8,.25);
    background: rgba(252,75,8,.10);
    color: #9a3412;
  }
  .badge--bad{
    border-color: rgba(220,38,38,.25);
    background: rgba(220,38,38,.10);
    color: #991b1b;
  }
  .badge--mid{
    border-color: rgba(234,179,8,.25);
    background: rgba(234,179,8,.14);
    color: #854d0e;
  }

  .footerTotals {
    margin-top: 12px;
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 10px;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    background: linear-gradient(180deg, rgba(252,75,8,.05), rgba(255,255,255,1));
  }

  .ftItem .lbl { font-size: 10px; color: var(--muted); }
  .ftItem .val { font-size: 12px; font-weight: 950; margin-top: 4px; }

  .note {
    margin-top: 10px;
    font-size: 10px;
    color: var(--muted);
    display:flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    border-top: 1px dashed rgba(252,75,8,.28);
    padding-top: 8px;
  }

  .note .sfmark{
    font-weight: 900;
    color: var(--orange);
  }

  .note .url{
    color: var(--muted);
  }
</style>
</head>

<body>
  <div class="topbar"></div>

  <div class="header">
    <div class="brand">
      <div class="h1">${escapeHtml(titulo)}</div>
      <div class="h2">Reporte mensual · ${escapeHtml(mes)}</div>

      <div class="meta">
        <div><b>Convenio:</b> ${escapeHtml(convenioLabel)}</div>
        <div><b>Mes:</b> ${escapeHtml(meta.monthStart || '—')}</div>
        <div><b>Generado:</b> ${escapeHtml(generado)}</div>
      </div>
    </div>

    <div class="sf">
      <div class="pill">SOFTFUSION</div>
      <div class="url">www.softfusion.com.ar</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="lbl">Cantidad de registros</div>
      <div class="val">${escapeHtml(String(totals.count))}</div>
    </div>
    <div class="kpi">
      <div class="lbl">Total Monto</div>
      <div class="val">${escapeHtml(ARS.format(totals.sumMonto))}</div>
    </div>
    <div class="kpi">
      <div class="lbl">Total Descuento</div>
      <div class="val">${escapeHtml(ARS.format(totals.sumDescuento))}</div>
    </div>
    <div class="kpi">
      <div class="lbl">Importe Final Total</div>
      <div class="val">${escapeHtml(ARS.format(totals.sumFinal))}</div>
    </div>
  </div>

  <table class="table">
    <thead>
      <tr>
        <th style="width:34px;">#</th>
        <th>Integrante</th>
        <th style="width:80px;">Sede</th>
        <th style="width:120px;">Plan</th>
        <th style="width:85px; text-align:right;">Monto</th>
        <th style="width:90px; text-align:right;">Descuento</th>
        <th style="width:100px; text-align:right;">Importe Final</th>
        <th style="width:105px;">Estado</th>
      </tr>
    </thead>
    <tbody>
      ${
        rowsHtml ||
        `<tr><td colspan="8" style="padding:10px;">Sin registros para el mes seleccionado.</td></tr>`
      }
    </tbody>
  </table>

  <div class="footerTotals">
    <div class="ftItem">
      <div class="lbl">Total Monto</div>
      <div class="val mono">${escapeHtml(ARS.format(totals.sumMonto))}</div>
    </div>
    <div class="ftItem">
      <div class="lbl">Total Descuento</div>
      <div class="val mono">${escapeHtml(ARS.format(totals.sumDescuento))}</div>
    </div>
    <div class="ftItem">
      <div class="lbl">Importe Final Total</div>
      <div class="val mono">${escapeHtml(ARS.format(totals.sumFinal))}</div>
    </div>
  </div>

  <div class="note">
    <div>Este documento fue generado automáticamente desde el sistema. Los importes corresponden al mes indicado.</div>
    <div><span class="sfmark">SOFTFUSION</span> · <span class="url">www.softfusion.com.ar</span></div>
  </div>
</body>
</html>
  `;
};

// ==============================
// ENDPOINT PDF
// ==============================
export const OBRS_IntegrantesConve_PDF_CTS = async (req, res) => {
  const t = await db.transaction();
  let browser = null;

  try {
    const id_conv = Number(req.query.id_conv || 0);
    // Buscar nombre del convenio (adm_convenios.nameConve)
    const convenio = await AdmConveniosModel.findByPk(id_conv, {
      attributes: ['id', 'nameConve', 'permiteFec'],
      transaction: t
    });

    const convenioNombre = convenio?.nameConve
      ? String(convenio.nameConve)
      : null;
    const permiteFec = Number(convenio?.permiteFec ?? 0) === 1;
    const filterMode = permiteFec ? 'monthly' : 'all';

    if (!Number.isFinite(id_conv) || id_conv <= 0) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'id_conv es obligatorio (query param).' });
    }

    // monthStart: si no viene, usar mes abierto (solo es obligatorio si permiteFec=1)
    let monthStart = req.query.monthStart ? String(req.query.monthStart) : null;
    if (monthStart) assertMonthStartFormat(monthStart);

    // openMonth lo usamos para meta/consistencia (y como ancla si hace falta)
    const openMonth = await getOpenMonthStart(id_conv, t);

    if (permiteFec) {
      // En modo mensual, monthStart es obligatorio (si no viene, es el openMonth)
      if (!monthStart) {
        monthStart = openMonth;
        if (!monthStart) {
          await t.commit();
          return res
            .status(404)
            .json({ mensajeError: 'No hay registros para generar el PDF.' });
        }
      }
    } else {
      // En modo "all", ignoramos el filtro mensual: monthStart es solo informativo
      if (!monthStart) monthStart = openMonth || null;
    }

    const nextMonth =
      permiteFec && monthStart ? await getNextMonth(monthStart, t) : null;

    // Traer integrantes del mes + plan
    const anchorMonthStart = monthStart || openMonth || '1970-01-01 00:00:00';

    const sqlMonthly = `
  SELECT
    ic.*,

    p.id              AS plan__id,
    p.nombre_plan     AS plan__nombre_plan,
    p.duracion_dias   AS plan__duracion_dias,
    p.precio_lista    AS plan__precio_lista,
    p.descuento_valor AS plan__descuento_valor,
    p.precio_final    AS plan__precio_final,
    p.activo          AS plan__activo,

    CASE
      WHEN ic.convenio_plan_id IS NULL THEN 0
      WHEN ic.fecha_vencimiento IS NULL THEN 1

      /* NUEVO: el "primer mes" (alta real) NO debe quedar locked */
      WHEN fm.first_month IS NOT NULL
      AND DATE_FORMAT(:monthStart, '%Y-%m') = fm.first_month THEN 0

      /* Desde el mes siguiente en adelante: locked mientras el mes sea anterior al vencimiento */
      WHEN :monthStart < ic.fecha_vencimiento THEN 1
      ELSE 0
    END AS locked_este_mes,

    CASE
      WHEN ic.convenio_plan_id IS NULL THEN 1
      WHEN ic.fecha_vencimiento IS NOT NULL AND :monthStart >= ic.fecha_vencimiento THEN 1
      WHEN fm.first_month IS NULL THEN 1
      WHEN DATE_FORMAT(ic.fechaCreacion, '%Y-%m') = fm.first_month THEN 1
      ELSE 0
    END AS cobrar_este_mes

  FROM integrantes_conve ic
  LEFT JOIN convenios_planes_disponibles p
    ON p.id = ic.convenio_plan_id

  LEFT JOIN (
    SELECT
      s.convenio_plan_id,
      s.person_key,
      s.fecha_vencimiento,
      MIN(s.month_ym) AS first_month
    FROM (
      SELECT
        s.convenio_plan_id,
        CASE
          WHEN s.dni IS NOT NULL AND TRIM(s.dni) <> '' THEN CONCAT('D:', TRIM(s.dni))
          WHEN s.email IS NOT NULL AND TRIM(s.email) <> '' THEN CONCAT('E:', LOWER(TRIM(s.email)))
          WHEN s.telefono IS NOT NULL AND TRIM(s.telefono) <> '' THEN CONCAT('T:', TRIM(s.telefono))
          ELSE CONCAT('I:', s.id)
        END AS person_key,
        s.fecha_vencimiento,
        DATE_FORMAT(s.fechaCreacion, '%Y-%m') AS month_ym
      FROM integrantes_conve s
      JOIN (
        SELECT DISTINCT
          ic2.convenio_plan_id,
          CASE
            WHEN ic2.dni IS NOT NULL AND TRIM(ic2.dni) <> '' THEN CONCAT('D:', TRIM(ic2.dni))
            WHEN ic2.email IS NOT NULL AND TRIM(ic2.email) <> '' THEN CONCAT('E:', LOWER(TRIM(ic2.email)))
            WHEN ic2.telefono IS NOT NULL AND TRIM(ic2.telefono) <> '' THEN CONCAT('T:', TRIM(ic2.telefono))
            ELSE CONCAT('I:', ic2.id)
          END AS person_key,
          ic2.fecha_vencimiento
        FROM integrantes_conve ic2
        WHERE ic2.id_conv = :id_conv
          AND ic2.fechaCreacion >= :monthStart
          AND ic2.fechaCreacion <  :nextMonth
          AND ic2.convenio_plan_id IS NOT NULL
      ) cur
        ON cur.convenio_plan_id = s.convenio_plan_id
       AND cur.person_key =
          CASE
            WHEN s.dni IS NOT NULL AND TRIM(s.dni) <> '' THEN CONCAT('D:', TRIM(s.dni))
            WHEN s.email IS NOT NULL AND TRIM(s.email) <> '' THEN CONCAT('E:', LOWER(TRIM(s.email)))
            WHEN s.telefono IS NOT NULL AND TRIM(s.telefono) <> '' THEN CONCAT('T:', TRIM(s.telefono))
            ELSE CONCAT('I:', s.id)
          END
       AND (
          (cur.fecha_vencimiento IS NULL AND s.fecha_vencimiento IS NULL)
          OR cur.fecha_vencimiento = s.fecha_vencimiento
       )
      WHERE s.id_conv = :id_conv
        AND s.convenio_plan_id IS NOT NULL
    ) s
    GROUP BY s.convenio_plan_id, s.person_key, s.fecha_vencimiento
  ) fm
    ON fm.convenio_plan_id = ic.convenio_plan_id
   AND fm.person_key =
      CASE
        WHEN ic.dni IS NOT NULL AND TRIM(ic.dni) <> '' THEN CONCAT('D:', TRIM(ic.dni))
        WHEN ic.email IS NOT NULL AND TRIM(ic.email) <> '' THEN CONCAT('E:', LOWER(TRIM(ic.email)))
        WHEN ic.telefono IS NOT NULL AND TRIM(ic.telefono) <> '' THEN CONCAT('T:', TRIM(ic.telefono))
        ELSE CONCAT('I:', ic.id)
      END
   AND (
      (fm.fecha_vencimiento IS NULL AND ic.fecha_vencimiento IS NULL)
      OR fm.fecha_vencimiento = ic.fecha_vencimiento
   )

  WHERE ic.id_conv = :id_conv
    AND ic.fechaCreacion >= :monthStart
    AND ic.fechaCreacion <  :nextMonth

  ORDER BY ic.id DESC
`;

    const sqlAll = `
  SELECT
    ic.*,

    p.id              AS plan__id,
    p.nombre_plan     AS plan__nombre_plan,
    p.duracion_dias   AS plan__duracion_dias,
    p.precio_lista    AS plan__precio_lista,
    p.descuento_valor AS plan__descuento_valor,
    p.precio_final    AS plan__precio_final,
    p.activo          AS plan__activo,

    CASE
      WHEN ic.convenio_plan_id IS NULL THEN 0
      WHEN ic.fecha_vencimiento IS NULL THEN 1
      WHEN :anchorMonthStart < ic.fecha_vencimiento THEN 1
      ELSE 0
    END AS locked_este_mes,

    1 AS cobrar_este_mes

  FROM integrantes_conve ic
  LEFT JOIN convenios_planes_disponibles p
    ON p.id = ic.convenio_plan_id

  WHERE ic.id_conv = :id_conv

  ORDER BY ic.id DESC
`;

    const sql = permiteFec ? sqlMonthly : sqlAll;

    const replacements = permiteFec
      ? { id_conv, monthStart, nextMonth }
      : { id_conv, anchorMonthStart };

    const rows = await db.query(sql, {
      replacements,
      type: db.QueryTypes.SELECT,
      transaction: t
    });

    const registros = (rows || []).map((r) => {
      const {
        plan__id,
        plan__nombre_plan,
        plan__duracion_dias,
        plan__precio_lista,
        plan__descuento_valor,
        plan__precio_final,
        plan__activo,
        ...rest
      } = r;

      const plan =
        plan__id != null
          ? {
              id: plan__id,
              nombre_plan: plan__nombre_plan,
              duracion_dias: plan__duracion_dias,
              precio_lista: plan__precio_lista,
              descuento_valor: plan__descuento_valor,
              precio_final: plan__precio_final,
              activo: plan__activo
            }
          : null;

      return { ...rest, plan };
    });

    // Totales robustos (mismos fallbacks que el render)
    const toNum = (v) => {
      if (v === null || v === undefined) return 0;
      const n = Number(String(v).replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };

    const totals = registros.reduce(
      (acc, r) => {
        acc.count += 1;

        const cobrar = Number(r?.cobrar_este_mes ?? 1) === 1;
        if (!cobrar) return acc;

        const precio = toNum(r?.precio); // monto lista snapshot
        const final = toNum(r?.preciofinal); // importe final snapshot
        const descMonto = Math.max(0, precio - final);

        acc.countCobrables += 1;
        acc.sumMonto += precio;
        acc.sumDescuento += descMonto;
        acc.sumFinal += final;

        return acc;
      },
      { count: 0, countCobrables: 0, sumMonto: 0, sumDescuento: 0, sumFinal: 0 }
    );

    const frozen = permiteFec
      ? await isMonthFrozen(id_conv, monthStart, t)
      : false;

    const metaPdf = {
      id_conv,
      permiteFec: permiteFec ? 1 : 0,
      filterMode,
      monthStart,
      nextMonth,
      openMonth,
      isFrozen: frozen,
      isOpenMonth: permiteFec
        ? String(openMonth) === String(monthStart)
        : false,
      convenioNombre
    };

    const html = buildIntegrantesPdfHtml({
      meta: metaPdf,
      registros,
      totals
    });

    // PDF
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `
        <div style="width:100%; font-size:9px; padding:0 12mm; color:#64748b; display:flex; justify-content:space-between;">
          <div><span style="color:#fc4b08; font-weight:800;">SOFTFUSION</span> · www.softfusion.com.ar</div>
          <div>Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>
        </div>
      `,
      margin: { top: '14mm', right: '12mm', bottom: '16mm', left: '12mm' }
    });

    await browser.close();
    browser = null;

    await t.commit();

    const ym = String(monthStart).slice(0, 7);
    const filename = `Listado_Integrantes_Convenio_${id_conv}_${ym}.pdf`;

    const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.end(buf);
  } catch (error) {
    await t.rollback();
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de IntegrantesConveModel por su ID
export const OBR_IntegrantesConve_CTS = async (req, res) => {
  try {
    const registro = await IntegrantesConveModel.findByPk(req.params.id, {
      include: [
        {
          model: ConveniosPlanesDisponiblesModel,
          as: 'plan',
          required: false
        }
      ]
    });

    res.json(registro);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en IntegrantesConveModel
export const CR_IntegrantesConve_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const payload = { ...req.body };

    // Normalizar ids
    const convId = Number(payload.id_conv || 0);
    payload.id_conv = Number.isFinite(convId) && convId > 0 ? convId : null;
    if (!payload.id_conv) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'id_conv es obligatorio.' });
    }

    // Permite fechas (1) o no (0)
    const permiteFec = await getConvenioPermiteFec(payload.id_conv, t);

    // Mes pedido por el front (aceptamos que venga en fechaCreacion o monthStart)
    let requestedMonthStart =
      payload.monthStart ?? payload.fechaCreacion ?? null;

    // ==============================
    // NUEVO: si NO permite fechas, ignoramos cualquier monthStart/fechaCreacion "mensual"
    // y trabajamos con fecha real (NOW). Esto evita bloqueos por mes editable/congelado.
    // ==============================
    let fechaBaseParaVto = null; // <-- NUEVO: base para calcular vencimiento (monthStart o NOW)

    if (!permiteFec) {
      // Por seguridad, ignoramos inputs de "mes" que pueda mandar el front
      delete payload.monthStart;

      // Usar SQL para evitar timezone
      const nowRows = await db.query(`SELECT NOW() AS now`, {
        type: db.QueryTypes.SELECT,
        transaction: t
      });

      const now = nowRows[0]?.now;

      // En convenios sin fechas, fechaCreacion es la fecha real del alta
      payload.fechaCreacion = now;
      fechaBaseParaVto = now;

      // Dejar requestedMonthStart como null para que NO dispare normalizaciones mensuales
      requestedMonthStart = null;
    }

    // ==============================
    // Lógica mensual SOLO si permiteFec = 1
    // ==============================
    if (permiteFec && requestedMonthStart) {
      requestedMonthStart = String(requestedMonthStart).trim();
      // Normalizamos a inicio de mes si vino tipo 'YYYY-MM'
      if (/^\d{4}-\d{2}$/.test(requestedMonthStart)) {
        requestedMonthStart = `${requestedMonthStart}-01 00:00:00`;
      }
      // Si vino ISO o datetime, lo llevamos a YYYY-MM-01 00:00:00
      if (
        /^\d{4}-\d{2}-\d{2}T/.test(requestedMonthStart) ||
        /^\d{4}-\d{2}-\d{2}\s/.test(requestedMonthStart)
      ) {
        requestedMonthStart = `${requestedMonthStart.slice(0, 7)}-01 00:00:00`;
      }
      assertMonthStartFormat(requestedMonthStart);
    }

    // monthStart efectivo
    let monthStart = null;

    if (permiteFec && requestedMonthStart) {
      // Si permite fechas, usamos el mes seleccionado
      monthStart = requestedMonthStart;
    } else {
      // Si NO permite fechas, usamos mes abierto (comportamiento actual)
      // ==============================
      // ANTERIOR (se deja comentado para no perder el histórico)
      // ==============================
      /*
      monthStart = await getOpenMonthStart(payload.id_conv, t);

      // Si no existe aún (primer mes), usar mes actual inicio:
      if (!monthStart) {
        const rows = await db.query(
          `SELECT DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00') AS monthStart`,
          { type: db.QueryTypes.SELECT, transaction: t }
        );
        monthStart = rows[0].monthStart;
      }
      */

      // ==============================
      // NUEVO: si NO permite fechas, NO usamos monthStart mensual.
      // Si permiteFec = 1 y no vino requestedMonthStart, sí usamos mes abierto como antes.
      // ==============================
      if (permiteFec) {
        monthStart = await getOpenMonthStart(payload.id_conv, t);

        // Si no existe aún (primer mes), usar mes actual inicio:
        if (!monthStart) {
          const rows = await db.query(
            `SELECT DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00') AS monthStart`,
            { type: db.QueryTypes.SELECT, transaction: t }
          );
          monthStart = rows[0].monthStart;
        }
      } else {
        // permiteFec = 0: monthStart no aplica
        monthStart = null;
      }
    }

    // Bloqueo:
    // - si permiteFec: no exigimos "mes abierto", pero sí validamos "no pasado" y "no congelado"
    // - si no permiteFec: exigimos mes abierto (como hoy)
    // ==============================
    // NUEVO: si permiteFec = 0, NO validamos mes editable/congelado.
    // ==============================
    if (permiteFec) {
      await assertMesEditable({
        convenio_id: payload.id_conv,
        monthStart,
        transaction: t,
        requireOpenMonth: !permiteFec
      });

      // Forzar fechaCreacion al inicio de mes elegido
      payload.fechaCreacion = monthStart;
      delete payload.monthStart;

      // Base para vencimiento (modo mensual)
      fechaBaseParaVto = monthStart;
    } else {
      // permiteFec = 0: fechaCreacion ya quedó como NOW() arriba, y fechaBaseParaVto también.
      // No hacemos delete de payload.fechaCreacion (se respeta la fecha real)
      // delete payload.monthStart ya se hizo arriba.
    }

    // Normalizar plan
    payload.convenio_plan_id = toIntOrNull(payload.convenio_plan_id);

    // Snapshot + vencimiento (si plan)
    if (payload.convenio_plan_id) {
      const plan = await ConveniosPlanesDisponiblesModel.findByPk(
        payload.convenio_plan_id
        // (opcional) { transaction: t }
      );
      if (!plan) {
        await t.rollback();
        return res
          .status(400)
          .json({ mensajeError: 'El plan seleccionado no existe.' });
      }
      if (
        plan.convenio_id &&
        Number(plan.convenio_id) !== Number(payload.id_conv)
      ) {
        await t.rollback();
        return res
          .status(400)
          .json({ mensajeError: 'El plan no pertenece a ese convenio.' });
      }

      const precioLista = Number(plan.precio_lista || 0);
      const descPct = Number(plan.descuento_valor || 0);
      const finalCalc =
        plan.precio_final !== null && plan.precio_final !== undefined
          ? Number(plan.precio_final)
          : Number((precioLista - (precioLista * descPct) / 100).toFixed(2));

      payload.precio = String(precioLista.toFixed(2));
      payload.descuento = String(descPct.toFixed(2));
      payload.preciofinal = String(finalCalc.toFixed(2));

      // vencimiento: usar SQL para evitar timezone
      if (plan.duracion_dias) {
        // ==============================
        // ANTERIOR (mensual): DATE_ADD(:monthStart, ...)
        // ==============================
        /*
        const vtoRows = await db.query(
          `SELECT DATE_ADD(:monthStart, INTERVAL :dias DAY) AS vto`,
          {
            replacements: { monthStart, dias: Number(plan.duracion_dias) },
            type: db.QueryTypes.SELECT,
            transaction: t
          }
        );
        payload.fecha_vencimiento = vtoRows[0].vto;
        */

        // ==============================
        // NUEVO: usar fechaBaseParaVto:
        // - si permiteFec=1 -> monthStart (inicio de mes)
        // - si permiteFec=0 -> NOW() (fecha real del alta)
        // ==============================
        const vtoRows = await db.query(
          `SELECT DATE_ADD(:fechaBase, INTERVAL :dias DAY) AS vto`,
          {
            replacements: {
              fechaBase: fechaBaseParaVto,
              dias: Number(plan.duracion_dias)
            },
            type: db.QueryTypes.SELECT,
            transaction: t
          }
        );
        payload.fecha_vencimiento = vtoRows[0].vto;
      } else {
        payload.fecha_vencimiento = null;
      }
    } else {
      // sin plan: podés permitir vencimiento manual, pero si no viene limpio:
      payload.fecha_vencimiento = toDateOrNull(payload.fecha_vencimiento);
    }

    const registro = await IntegrantesConveModel.create(payload, {
      transaction: t
    });
    await t.commit();

    return res
      .status(201)
      .json({ message: 'Registro creado correctamente', registro });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// Eliminar un registro en IntegrantesConveModel por su ID
export const ER_IntegrantesConve_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const { id } = req.params;

    // ==============================
    // ANTERIOR
    // ==============================
    /*
    // 1) Obtener convenio + mes del registro
    const info = await getIntegranteMonthInfo(id, t);
    if (!info) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }

    const convenioId = Number(info.id_conv);
    const monthStart = info.monthStart;

    // 2) Bloqueo: solo mes abierto y no congelado
    await assertMesEditable({
      convenio_id: convenioId,
      monthStart,
      transaction: t
    });

    // 3) Eliminar
    const deleted = await IntegrantesConveModel.destroy({
      where: { id },
      transaction: t
    });
    */

    // ==============================
    // NUEVO
    // Criterio: si NO está congelado, debe dejar borrar aunque NO sea el mes abierto.
    // Por eso: requireOpenMonth = false.
    // ==============================

    // 1) Obtener convenio + mes del registro
    const info = await getIntegranteMonthInfo(id, t);
    if (!info) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }

    const convenioId = Number(info.id_conv);
    const monthStart = info.monthStart;

    // (opcional) Si querés que el criterio aplique solo cuando permiteFec=1, lo dejamos calculado:
    const permiteFec = await getConvenioPermiteFec(convenioId, t);

    // 2) Bloqueo:
    // - Mantiene validación "no pasado" (punto 0) + "no congelado" (punto 1)
    // - NO exige mes abierto (punto 2) => requireOpenMonth: false
    // Nota: esto se alinea con "si no está congelado, puedo borrar".
    await assertMesEditable({
      convenio_id: convenioId,
      monthStart,
      transaction: t,
      requireOpenMonth: false
      // si quisieras condicionar: requireOpenMonth: false (igual),
      // o incluso: requireOpenMonth: !permiteFec (pero vos querés que NO exija mes abierto)
    });

    // 3) Eliminar
    const deleted = await IntegrantesConveModel.destroy({
      where: { id },
      transaction: t
    });

    if (!deleted) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }

    await t.commit();
    return res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// Actualizar un registro en Integrante por su ID
export const UR_IntegrantesConve_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const { id } = req.params;
    const payload = { ...req.body };

    // ==============================
    // Benja - 30/12/2025
    // Traer info del registro con SQL crudo para evitar corrimientos timezone
    // y además obtener monthStart/monthYm para reglas mensuales.
    // ==============================
    const infoRows = await db.query(
      `
      SELECT
        id,
        id_conv,
        fechaCreacion,
        DATE_FORMAT(fechaCreacion, '%Y-%m-01 00:00:00') AS monthStart,
        DATE_FORMAT(fechaCreacion, '%Y-%m') AS monthYm,

        convenio_plan_id,
        fecha_vencimiento,

        dni,
        email,
        telefono,
        nombre,
        sede,
        preciofinal
      FROM integrantes_conve
      WHERE id = :id
      LIMIT 1
      `,
      {
        replacements: { id },
        type: db.QueryTypes.SELECT,
        transaction: t
      }
    );

    const info = infoRows?.[0] || null;

    if (!info) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }

    const convenioId = Number(info.id_conv);

    // Permite fechas (1) o no (0)
    const permiteFec = await getConvenioPermiteFec(convenioId, t);

    // monthStart solo aplica si permiteFec=1
    let monthStart = null;

    if (permiteFec) {
      monthStart = info.monthStart;

      await assertMesEditable({
        convenio_id: convenioId,
        monthStart,
        transaction: t,
        requireOpenMonth: !permiteFec // mantenemos tu intención original
      });
    } else {
      // permiteFec=0: NO validar mes editable/congelado/abierto
    }

    // ==============================
    // Sanitizar: nunca permitir que cambien el convenio o el mes del snapshot
    // ==============================
    delete payload.id_conv;
    delete payload.fechaCreacion;
    delete payload.monthStart;
    delete payload.monthCursor;

    // ==============================
    // - No tocar convenio_plan_id si no vino en body.
    // - Si vino, normalizar a int|null.
    // ==============================
    const planIdActual = toIntOrNull(info.convenio_plan_id);

    const planIdVinoEnBody = Object.prototype.hasOwnProperty.call(
      payload,
      'convenio_plan_id'
    );

    if (planIdVinoEnBody) {
      payload.convenio_plan_id = toIntOrNull(payload.convenio_plan_id);
    } else {
      delete payload.convenio_plan_id;
    }

    // Fecha vencimiento manual (solo si lo mandan explícito)
    if (Object.prototype.hasOwnProperty.call(payload, 'fecha_vencimiento')) {
      payload.fecha_vencimiento = parseDateFlexible(payload.fecha_vencimiento);
    } else {
      delete payload.fecha_vencimiento;
    }

    const planIdNuevo = planIdVinoEnBody
      ? payload.convenio_plan_id
      : planIdActual;

    // Cambio de plan SOLO si vino en body y cambia (incluye pasar a NULL)
    const planCambio =
      planIdVinoEnBody &&
      String(planIdNuevo || '') !== String(planIdActual || '');

    // ==============================
    // Benja - 31/12/2025
    // FIX: Bloqueo de cambio/quita de plan cuando:
    // - El plan está vigente
    // - Y NO estás en el mes de creación real de la persona en el convenio
    //
    // Importante:
    // - NO usamos "nombre" como identidad (editable => bypass).
    // - Identidad estricta: dni/email/teléfono válidos (ignorando "No informado").
    // - Fallback (cuando no hay identidad): mismo plan + mismo vto + mismo preciofinal + misma sede
    //   para detectar clones de ese snapshot.
    // ==============================
    if (planCambio && planIdActual) {
      const checkRows = await db.query(
        `
        SELECT
          DATE_FORMAT(ic.fechaCreacion, '%Y-%m') AS cur_month,

          /* identidad estricta (NO editable): dni/email/teléfono */
          CASE
            WHEN ic.dni IS NOT NULL AND TRIM(ic.dni) <> ''
                 AND LOWER(TRIM(ic.dni)) <> 'no informado'
                 AND TRIM(ic.dni) REGEXP '^[0-9]+$'
              THEN CONCAT('D:', TRIM(ic.dni))
            WHEN ic.email IS NOT NULL AND TRIM(ic.email) <> ''
                 AND LOWER(TRIM(ic.email)) <> 'no informado'
              THEN CONCAT('E:', LOWER(TRIM(ic.email)))
            WHEN ic.telefono IS NOT NULL AND TRIM(ic.telefono) <> ''
                 AND LOWER(TRIM(ic.telefono)) <> 'no informado'
              THEN CONCAT('T:', TRIM(ic.telefono))
            ELSE NULL
          END AS person_key_strict,

          /* plan vigente:
             - Si NO hay vencimiento => lo tratamos como vigente (indefinido)
             - permiteFec=1 => comparamos contra monthStart del registro
             - permiteFec=0 => comparamos contra NOW() */
          CASE
            WHEN ic.fecha_vencimiento IS NULL THEN 1
            WHEN :permiteFec = 1 AND :monthStart < ic.fecha_vencimiento THEN 1
            WHEN :permiteFec = 0 AND NOW() < ic.fecha_vencimiento THEN 1
            ELSE 0
          END AS plan_vigente,

          /* Primer mes real (creación) para esa persona/snapshot */
          (
            SELECT MIN(DATE_FORMAT(s.fechaCreacion, '%Y-%m'))
            FROM integrantes_conve s
            WHERE s.id_conv = :id_conv
              AND (
                /* Caso A: identidad estricta disponible => trackea por dni/email/teléfono */
                (
                  (
                    CASE
                      WHEN s.dni IS NOT NULL AND TRIM(s.dni) <> ''
                           AND LOWER(TRIM(s.dni)) <> 'no informado'
                           AND TRIM(s.dni) REGEXP '^[0-9]+$'
                        THEN CONCAT('D:', TRIM(s.dni))
                      WHEN s.email IS NOT NULL AND TRIM(s.email) <> ''
                           AND LOWER(TRIM(s.email)) <> 'no informado'
                        THEN CONCAT('E:', LOWER(TRIM(s.email)))
                      WHEN s.telefono IS NOT NULL AND TRIM(s.telefono) <> ''
                           AND LOWER(TRIM(s.telefono)) <> 'no informado'
                        THEN CONCAT('T:', TRIM(s.telefono))
                      ELSE NULL
                    END
                  ) IS NOT NULL
                  AND
                  (
                    CASE
                      WHEN s.dni IS NOT NULL AND TRIM(s.dni) <> ''
                           AND LOWER(TRIM(s.dni)) <> 'no informado'
                           AND TRIM(s.dni) REGEXP '^[0-9]+$'
                        THEN CONCAT('D:', TRIM(s.dni))
                      WHEN s.email IS NOT NULL AND TRIM(s.email) <> ''
                           AND LOWER(TRIM(s.email)) <> 'no informado'
                        THEN CONCAT('E:', LOWER(TRIM(s.email)))
                      WHEN s.telefono IS NOT NULL AND TRIM(s.telefono) <> ''
                           AND LOWER(TRIM(s.telefono)) <> 'no informado'
                        THEN CONCAT('T:', TRIM(s.telefono))
                      ELSE NULL
                    END
                  ) = (
                    CASE
                      WHEN ic.dni IS NOT NULL AND TRIM(ic.dni) <> ''
                           AND LOWER(TRIM(ic.dni)) <> 'no informado'
                           AND TRIM(ic.dni) REGEXP '^[0-9]+$'
                        THEN CONCAT('D:', TRIM(ic.dni))
                      WHEN ic.email IS NOT NULL AND TRIM(ic.email) <> ''
                           AND LOWER(TRIM(ic.email)) <> 'no informado'
                        THEN CONCAT('E:', LOWER(TRIM(ic.email)))
                      WHEN ic.telefono IS NOT NULL AND TRIM(ic.telefono) <> ''
                           AND LOWER(TRIM(ic.telefono)) <> 'no informado'
                        THEN CONCAT('T:', TRIM(ic.telefono))
                      ELSE NULL
                    END
                  )
                )

                OR

                /* Caso B: NO hay identidad estricta => fallback por snapshot (para detectar clones) */
                (
                  (
                    CASE
                      WHEN ic.dni IS NOT NULL AND TRIM(ic.dni) <> ''
                           AND LOWER(TRIM(ic.dni)) <> 'no informado'
                           AND TRIM(ic.dni) REGEXP '^[0-9]+$'
                        THEN 1
                      WHEN ic.email IS NOT NULL AND TRIM(ic.email) <> ''
                           AND LOWER(TRIM(ic.email)) <> 'no informado'
                        THEN 1
                      WHEN ic.telefono IS NOT NULL AND TRIM(ic.telefono) <> ''
                           AND LOWER(TRIM(ic.telefono)) <> 'no informado'
                        THEN 1
                      ELSE 0
                    END
                  ) = 0
                  AND s.convenio_plan_id = :plan_id
                  AND (
                    (:fv IS NULL AND s.fecha_vencimiento IS NULL)
                    OR (:fv IS NOT NULL AND s.fecha_vencimiento = :fv)
                  )
                  AND COALESCE(TRIM(s.preciofinal), '') = COALESCE(TRIM(ic.preciofinal), '')
                  AND COALESCE(TRIM(s.sede), '') = COALESCE(TRIM(ic.sede), '')
                )
              )
          ) AS first_month_person

        FROM integrantes_conve ic
        WHERE ic.id = :id
        LIMIT 1
        `,
        {
          replacements: {
            id,
            id_conv: convenioId,
            plan_id: planIdActual,
            fv: info.fecha_vencimiento ?? null,
            permiteFec: permiteFec ? 1 : 0,
            monthStart: monthStart // si permiteFec=0 no afecta
          },
          type: db.QueryTypes.SELECT,
          transaction: t
        }
      );

      const check = checkRows?.[0] || null;

      const planVigente = Number(check?.plan_vigente || 0) === 1;

      const firstMonth = check?.first_month_person || null;
      const curMonth = check?.cur_month || null;

      const esMesCreacion =
        firstMonth && curMonth
          ? String(firstMonth) === String(curMonth)
          : false;

      // Si no podemos determinar firstMonth con seguridad, por seguridad NO habilitamos el cambio fuera de mes creación
      if (planVigente && !esMesCreacion) {
        await t.rollback();
        return res.status(423).json({
          mensajeError:
            'Plan vigente: solo se permite cambiar/quitar el plan en el mes de creación. En meses posteriores queda bloqueado hasta su vencimiento.'
        });
      }
    }

    // ==============================
    // Base para vencimiento por duración:
    // - permiteFec=1: monthStart (inicio de mes del registro)
    // - permiteFec=0: fechaCreacion real
    // ==============================
    const fechaBaseParaVto = permiteFec ? monthStart : info.fechaCreacion;

    // ==============================
    // Solo aplicamos lógica de plan/snapshot/vencimiento si vino convenio_plan_id en body
    // ==============================
    if (planIdVinoEnBody) {
      // 5) Si hay plan => forzar snapshot + vencimiento
      if (planIdNuevo) {
        const plan = await ConveniosPlanesDisponiblesModel.findByPk(
          planIdNuevo,
          { transaction: t }
        );

        if (!plan) {
          await t.rollback();
          return res
            .status(400)
            .json({ mensajeError: 'El plan seleccionado no existe.' });
        }

        // Validar que plan pertenece a este convenio
        if (
          plan.convenio_id &&
          Number(plan.convenio_id) !== Number(convenioId)
        ) {
          await t.rollback();
          return res.status(400).json({
            mensajeError:
              'El plan seleccionado no pertenece al convenio del integrante.'
          });
        }

        const precioLista = Number(plan.precio_lista || 0);
        const descPct = Number(plan.descuento_valor || 0);

        const finalCalc =
          plan.precio_final !== null && plan.precio_final !== undefined
            ? Number(plan.precio_final)
            : Number((precioLista - (precioLista * descPct) / 100).toFixed(2));

        // Snapshot forzado
        payload.precio = String(precioLista.toFixed(2));
        payload.descuento = String(descPct.toFixed(2));
        payload.preciofinal = String(finalCalc.toFixed(2));

        // Vencimiento: si hay duración y (cambió plan o no vino vto válido), recalcular
        if (plan.duracion_dias && (planCambio || !payload.fecha_vencimiento)) {
          const vtoRows = await db.query(
            `SELECT DATE_ADD(:fechaBase, INTERVAL :dias DAY) AS vto`,
            {
              replacements: {
                fechaBase: fechaBaseParaVto,
                dias: Number(plan.duracion_dias)
              },
              type: db.QueryTypes.SELECT,
              transaction: t
            }
          );
          payload.fecha_vencimiento = vtoRows[0]?.vto || null;
        }
      } else {
        // 6) Si NO hay plan: si estaban quitando plan y no mandan vto, limpiar
        if (planCambio && !payload.fecha_vencimiento) {
          payload.fecha_vencimiento = null;
        }
      }
    }

    // 7) Update
    await IntegrantesConveModel.update(payload, {
      where: { id },
      transaction: t
    });

    // 8) Devolver actualizado con include plan
    const registroActualizado = await IntegrantesConveModel.findByPk(id, {
      include: [
        {
          model: ConveniosPlanesDisponiblesModel,
          as: 'plan',
          required: false,
          attributes: [
            'id',
            'convenio_id',
            'nombre_plan',
            'duracion_dias',
            'precio_lista',
            'descuento_valor',
            'precio_final',
            'activo'
          ]
        }
      ],
      transaction: t
    });

    await t.commit();
    return res.json({
      message: 'Registro actualizado correctamente',
      registroActualizado
    });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// R6-AutorizarIntegrantes - Benjamin Orellana 15-09-24 - Inicio
// Actualizar el estado de autorización de un integrante
export const Autorizar_Integrante_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const { id } = req.params;
    const { estado_autorizacion } = req.body;

    const validStates = ['sin_autorizacion', 'pendiente', 'autorizado'];
    if (!validStates.includes(estado_autorizacion)) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'Estado de autorización no válido' });
    }

    // 1) Obtener mes del registro y bloquear
    const info = await getIntegranteMonthInfo(id, t);
    if (!info) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }

    await assertMesEditable({
      convenio_id: Number(info.id_conv),
      monthStart: info.monthStart,
      transaction: t
    });

    // 2) Update
    const [numRowsUpdated] = await IntegrantesConveModel.update(
      { estado_autorizacion },
      { where: { id }, transaction: t }
    );

    if (numRowsUpdated !== 1) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }

    const registroActualizado = await IntegrantesConveModel.findByPk(id, {
      transaction: t
    });

    await t.commit();
    return res.json({
      message: 'Estado de autorización actualizado correctamente',
      registroActualizado
    });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// R6-AutorizarIntegrantes - Benjamin Orellana 15-09-24 - Final
// Autorizar todos los integrantes de un convenio específico
export const Autorizar_Integrantes_Por_Convenio = async (req, res) => {
  const t = await db.transaction();
  try {
    const { id_conv } = req.params;
    const convenioId = Number(id_conv);

    if (!Number.isFinite(convenioId) || convenioId <= 0) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'id_conv inválido' });
    }

    // 1) Determinar mes abierto (CLAVE 00:00:00)
    const openMonthKey = await getOpenMonthStart(convenioId, t); // 'YYYY-MM-01 00:00:00'
    if (!openMonthKey) {
      await t.rollback();
      return res
        .status(404)
        .json({ mensajeError: 'No hay integrantes para este convenio' });
    }

    // 2) Bloqueo: solo mes abierto y no congelado
    await assertMesEditable({
      convenio_id: convenioId,
      monthStart: openMonthKey,
      transaction: t
    });

    const ym = String(openMonthKey).slice(0, 7); // 'YYYY-MM'

    // 3) Autorizar TODOS los registros del mes abierto (sin depender de la hora)
    const [updRes, updMeta] = await db.query(
      `
      UPDATE integrantes_conve
      SET estado_autorizacion = 'autorizado'
      WHERE id_conv = :convenio_id
        AND DATE_FORMAT(fechaCreacion, '%Y-%m') = :ym
      `,
      {
        replacements: { convenio_id: convenioId, ym },
        type: db.QueryTypes.UPDATE,
        transaction: t
      }
    );

    const rowsUpdated =
      (typeof updMeta === 'number' ? updMeta : updMeta?.affectedRows) ??
      (typeof updRes === 'number' ? updRes : updRes?.affectedRows) ??
      0;

    // 4) Traer registros actualizados
    const registrosActualizados = await IntegrantesConveModel.findAll({
      where: db.where(
        db.fn('DATE_FORMAT', db.col('fechaCreacion'), '%Y-%m'),
        ym
      ),
      transaction: t
    });

    await t.commit();
    return res.json({
      message: `Se autorizaron ${rowsUpdated} integrantes del convenio ${convenioId} (mes ${ym}).`,
      meta: { convenioId, openMonth: openMonthKey, ym, rowsUpdated },
      registrosActualizados
    });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};
