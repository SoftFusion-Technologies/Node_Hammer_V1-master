// routes/recaptacionImport.js
import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import fs from 'fs';
import db from '../DataBase/db.js'; // instancia db (MySQL)
import { Op } from 'sequelize';
import Recaptacion from '../Models/MD_TB_Recaptacion.js';
import Users from '../Models/MD_TB_Users.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });
const RecaptacionModel = Recaptacion.RecaptacionModel;

/* ------------- helpers ------------- */
const norm = (s = '') =>
  s
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

const alias = (row, names) => {
  for (const n of names) {
    const key = Object.keys(row).find((k) => norm(k) === norm(n));
    if (key && row[key] != null && row[key] !== '') return row[key];
  }
  return null;
};

const parseBool = (v) => {
  if (v === true || v === 1 || v === '1') return true;
  const s = (v ?? '').toString().trim().toLowerCase();
  return ['si', 'sí', 'yes', 'y', 'true', 't'].includes(s);
};

const parseDate = (v) => {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;
  const s = v.toString().trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [_, d, mo, y] = m;
    const year = y.length === 2 ? Number('20' + y) : Number(y);
    return new Date(year, Number(mo) - 1, Number(d));
  }
  const asDate = new Date(s);
  return isNaN(asDate) ? null : asDate;
};

// MySQL: LIKE (case-insensitive según collation) + normalización JS
// ------------------ helpers de normalización y similitud ------------------
const NORM_RE = /[^a-z0-9\s]/g;
const SPACES_RE = /\s+/g;

function normalizeName(s = '') {
  return s
    .toString()
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(NORM_RE, ' ')
    .replace(SPACES_RE, ' ')
    .trim();
}

function tokenize(s = '') {
  return normalizeName(s)
    .split(' ')
    .filter(t => t.length >= 2);
}

// Levenshtein (iterativo)
function lev(a, b) {
  a = normalizeName(a); b = normalizeName(b);
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return dp[n];
}

function jaccardTokens(a, b) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const uni = A.size + B.size - inter;
  return uni ? inter / uni : 0;
}

function includesScore(a, b) {
  const an = normalizeName(a), bn = normalizeName(b);
  if (!an || !bn) return 0;
  if (an === bn) return 1;
  if (an.includes(bn) || bn.includes(an)) {
    const ratio = Math.min(an.length, bn.length) / Math.max(an.length, bn.length);
    return 0.6 + 0.4 * ratio;
  }
  return 0;
}

function similarity(a, b) {
  const jac = jaccardTokens(a, b);
  const d = lev(a, b);
  const maxLen = Math.max(normalizeName(a).length, normalizeName(b).length) || 1;
  const levSim = 1 - d / maxLen;
  const inc = includesScore(a, b);
  return 0.5 * jac + 0.3 * levSim + 0.2 * inc; // [0..1]
}

// --------- caché simple en memoria para snapshot de users (60s) ----------
let _usersCache = { ts: 0, list: [] };
async function getUsersSnapshot() {
  const now = Date.now();
  if (now - _usersCache.ts < 60_000 && _usersCache.list.length) {
    return _usersCache.list;
  }
  const list = await Users.findAll({
    attributes: ['id', 'name'],
    where: {}, // podés filtrar level/state/sede si querés
    limit: 1000,              // ajustá según tamaño real
    order: [['id', 'ASC']],
  });
  _usersCache = { ts: now, list };
  return list;
}

// ------------------ resolución robusta del usuario ------------------
async function resolveUsuarioIdPorColaborador(nombreColaborador, fallbackId) {
  if (!nombreColaborador) return fallbackId ?? null;

  const wantedNorm = normalizeName(nombreColaborador);
  const toks = tokenize(nombreColaborador);

  // 1) Primer pase: LIKE por tokens (rápido en DB)
  const likeClauses = [];
  if (toks.length) {
    likeClauses.push({ name: { [Op.like]: `%${toks[0]}%` } });
    if (toks.length > 1) likeClauses.push({ name: { [Op.like]: `%${toks[toks.length - 1]}%` } });
  } else {
    likeClauses.push({ name: { [Op.like]: `%${wantedNorm}%` } });
  }

  let candidates = await Users.findAll({
    where: { [Op.or]: likeClauses },
    limit: 25,
    attributes: ['id', 'name'],
  });

  // 1.a) Exacto-insensible por normalización
  let exact = candidates.find(c => normalizeName(c.name) === wantedNorm);
  if (exact) return exact.id;

  // 2) Si no hay candidatos o son pocos confiables, ampliamos con snapshot
  if (!candidates.length) {
    candidates = await getUsersSnapshot();
  }

  // 3) Fuzzy scoring
  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    const s = similarity(nombreColaborador, c.name);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    } else if (s === bestScore && best) {
      if ((c.name || '').length > (best.name || '').length) best = c;
    }
  }

  // 4) Umbral de confianza
  const THRESHOLD = 0.72; // subí/bajá si hace falta
  if (best && bestScore >= THRESHOLD) {
    return best.id;
  }

  // 5) Fallback
  return fallbackId ?? null;
}


// Mes/año objetivo del import
function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}
function makeFechaImport({ mesQuery, anioQuery }) {
  const now = new Date();
  const year = anioQuery ? Number(anioQuery) : now.getFullYear();
  const month = mesQuery ? Number(mesQuery) : now.getMonth() + 1; // 1..12
  const day = Math.min(now.getDate(), daysInMonth(year, month - 1));
  return new Date(year, month - 1, day);
}

/* ------------- route ------------- */

router.post(
  '/import-recaptacion/:usuario_id',
  upload.single('file'),
  async (req, res) => {
    const file = req.file;
    const { usuario_id: usuarioIdFromUrl } = req.params;
    const dryRun = String(req.query.dry_run || '').toLowerCase() === '1';

    // mes/año objetivo (si no vienen por query, se usa el mes/año actuales)
    const mesQuery = req.query.mes ? Number(req.query.mes) : null;
    const anioQuery = req.query.anio ? Number(req.query.anio) : null;
    const fechaImport = makeFechaImport({ mesQuery, anioQuery }); // ← clave

    if (!file)
      return res
        .status(400)
        .json({ message: 'No se ha subido ningún archivo' });

    try {
      const workbook = XLSX.readFile(file.path);
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        fs.unlinkSync(file.path);
        return res
          .status(400)
          .json({ message: 'El archivo no contiene hojas' });
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

      if (!Array.isArray(data) || data.length === 0) {
        fs.unlinkSync(file.path);
        return res
          .status(400)
          .json({ message: 'El archivo está vacío o no tiene datos' });
      }

      // detectar formato
      const first = data[0];
      const headers = Object.keys(first).map(norm);
      const isLegacy =
        headers.includes(norm('Nombre')) &&
        headers.includes(norm('Tipo de contacto')) &&
        headers.includes(norm('ID Usuario'));

      const transaction = await db.transaction();
      const errors = [];
      const preview = [];
      let inserted = 0;

      try {
        if (isLegacy) {
          // ===== Formato actual (no romper) =====
          const requiredColumns = ['Nombre', 'Tipo de contacto', 'ID Usuario'];
          const missing = requiredColumns.filter(
            (rc) => !Object.keys(first).find((k) => norm(k) === norm(rc))
          );
          if (missing.length)
            throw new Error(
              `Faltan columnas obligatorias: ${missing.join(', ')}`
            );

          const validData = data.filter(
            (row) =>
              alias(row, ['Nombre']) &&
              alias(row, ['Tipo de contacto']) &&
              alias(row, ['ID Usuario'])
          );
          if (!validData.length)
            throw new Error('No se encontraron filas con datos válidos');

          for (const row of validData) {
            // Fecha original (si vino) solo la preservamos en observación
            const fechaExcel = parseDate(alias(row, ['Fecha']));
            const obsOrig = alias(row, ['Observacion', 'Observación']) || '';
            const obsConFecha = fechaExcel
              ? `${
                  obsOrig ? obsOrig + ' — ' : ''
                }Fecha origen: ${fechaExcel.toLocaleDateString('es-AR')}`
              : obsOrig;

            // Forzamos fecha al mes objetivo
            const fecha = fechaImport;

            const payload = {
              usuario_id: alias(row, ['ID Usuario']),
              nombre: alias(row, ['Nombre']),
              tipo_contacto: alias(row, ['Tipo de contacto']),
              detalle_contacto: alias(row, ['Detalle contacto']) || null,
              actividad: alias(row, ['Actividad']) || null,
              fecha, // ✅ fuerza mes/anio del import
              enviado: false,
              respondido: false,
              agendado: false,
              convertido: false,
              observacion: obsConFecha || null
            };

            if (dryRun) {
              preview.push(payload);
              continue;
            }

            try {
              await RecaptacionModel.create(payload, { transaction });
              inserted++;
            } catch (e) {
              errors.push({ row, error: e.message });
            }
          }
        } else {
          // ===== Nuevo Excel (ventas/prospectos) =====
          const atLeastOne =
            alias(first, ['Nombre']) ||
            alias(first, ['Usuario / Celular', 'Celular']) ||
            alias(first, ['Colaborador']);
          if (!atLeastOne)
            throw new Error(
              'Formato desconocido: falta al menos Nombre / Usuario / Colaborador.'
            );

          for (const row of data) {
            try {
              const canal = alias(row, [
                'Canal Contacto',
                'Canal',
                'Tipo de contacto'
              ]);
              const contacto = alias(row, [
                'Usuario / Celular',
                'Celular',
                'Usuario',
                'Telefono',
                'Teléfono'
              ]);
              const nombre = alias(row, ['Nombre']);
              const actividad = alias(row, ['Actividad']);
              const observacion = alias(row, ['Observacion', 'Observación']);
              const convertido = parseBool(alias(row, ['Convertido'])); // Sí / No
              const fechaExcel = parseDate(alias(row, ['Fecha']));
              const colaborador = alias(row, ['Colaborador']);

              // ✅ Si está convertido => saltar fila
              if (convertido === true) continue;

              // usuario_id: resolver por "Colaborador" -> fallback a :usuario_id
              const usuario_id = await resolveUsuarioIdPorColaborador(
                colaborador,
                usuarioIdFromUrl
              );

              // tipo_contacto del ENUM (no usar valores de "Canal Contacto")
              const tipo_contacto = 'Leads no convertidos'; // o 'Otro'

              // ✅ detalle: guardar SOLO el contacto (sin el canal)
              const detalle_contacto =
                contacto || 'Importación planilla de ventas';

              // Si no hay nada identificable, salteo
              if (!nombre && !detalle_contacto) continue;

              // Forzamos fecha al mes objetivo; preservamos fecha Excel en observación
              const fecha = fechaImport;
              const obsConFecha = fechaExcel
                ? `${
                    observacion || '' ? observacion + ' — ' : ''
                  }Fecha origen: ${fechaExcel.toLocaleDateString('es-AR')}`
                : observacion || '';

              const payload = {
                usuario_id,
                nombre: nombre || '(sin nombre)',
                tipo_contacto,
                detalle_contacto,
                actividad: actividad || null,
                observacion: obsConFecha
                  ? obsConFecha.toString().slice(0, 1000)
                  : null,
                convertido: false, // siempre falso al importar
                fecha, // ✅ fuerza mes/anio del import
                enviado: false,
                respondido: false,
                agendado: false
              };

              if (!dryRun && inserted < 1)
                console.log('INSERT payload ejemplo =>', payload);

              if (dryRun) {
                preview.push(payload);
              } else {
                await RecaptacionModel.create(payload, { transaction });
                inserted++;
              }
            } catch (e) {
              errors.push({ row, error: e.message });
            }
          }
        }

        if (!dryRun) await transaction.commit();
        else await transaction.rollback();
        fs.unlinkSync(file.path);

        return res.status(200).json({
          message: dryRun
            ? 'Validación exitosa (dry-run)'
            : 'Importación exitosa',
          inserted: dryRun ? 0 : inserted,
          preview: dryRun ? preview.slice(0, 50) : undefined,
          errors_count: errors.length,
          errors: errors.length ? errors.slice(0, 20) : undefined,
          mode: isLegacy ? 'legacy' : 'nuevo-excel'
        });
      } catch (error) {
        await transaction.rollback();
        fs.unlinkSync(file.path);
        console.error('Error al insertar datos:', error);
        return res.status(500).json({
          message: 'Error al insertar los datos',
          error: error.message
        });
      }
    } catch (error) {
      if (file) fs.unlinkSync(file.path);
      console.error('Error procesando archivo:', error);
      return res.status(500).json({
        message: 'Error al procesar el archivo. ¿Excel válido (.xls/.xlsx)?',
        error: error.message
      });
    }
  }
);

export default router;
