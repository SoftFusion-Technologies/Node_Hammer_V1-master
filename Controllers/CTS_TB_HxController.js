// controllers/hx_ingestion.controller.js
import * as yup from 'yup';
import db from '../DataBase/db.js';
import HxClienteModel from '../Models/MD_TB_HxClientes.js';
import HxInformeModel from '../Models/MD_TB_HxInformes.js';
import HxInformeComidaModel from '../Models/MD_TB_HxInformesComidas.js';
import HxImagenBalanzaModel from '../Models/MD_TB_HxImagenesBalanza.js';
import { Op } from 'sequelize';

import fs from 'node:fs/promises';
import path from 'node:path';
import { getInformeFilename } from '../utils/names.js';

/* ===================== Helpers ===================== */

const uuid36 = yup
  .string()
  .matches(
    /^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/,
    'batch_id debe ser UUID'
);
  
async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}
const safeText = (s) => (typeof s === 'string' ? s.trim() : null);

// Mapea "Normal/Low/High" → 'Normal'/'Bajo'/'Alto' (es-AR) para imc_categoria
const mapEstadoEnToEs = (e) => {
  if (!e) return null;
  const x = ('' + e).toLowerCase();
  if (x.includes('low')) return 'Bajo';
  if (x.includes('high')) return 'Alto';
  return 'Normal';
};

// Detecta tipo de comida por prefijo ("Desayuno:", "Colación:", etc.)
function parseEjemploLinea(lineaRaw = '') {
  const linea = lineaRaw.replace(/^[-–•]\s*/, '').trim(); // saca guiones/puntos
  const m = linea.match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ ]+)\s*:\s*(.+)$/);
  if (!m) return { tipo: null, descripcion: linea };
  const tipo = m[1]
    .toLowerCase()
    .replace('colación', 'colacion')
    .replace('media mañana', 'media_manana')
    .replace(/\s+/g, '_');
  return { tipo, descripcion: m[2].trim() };
}

// Junta array de bullets a texto multilínea
const joinBullets = (arr) =>
  Array.isArray(arr)
    ? arr.map((s) => s.replace(/^\s*[-–•]\s*/, '')).join('\n')
    : null;

async function upsertClienteFromPayload(c = {}, t) {
  // Normalizar
  const dni = (c.dni ?? '').toString().trim() || null;
  const nombreIn = (c.nombre ?? '').toString().trim() || null;
  const sexoIn = c.sexo ?? null;
  const fnacIn = c.fecha_nacimiento ?? null; // YYYY-MM-DD
  const alturaIn = c.altura_m ?? null;

  let clienteRow = null;

  if (dni) {
    clienteRow = await HxClienteModel.findOne({
      where: { dni },
      transaction: t
    });
    if (clienteRow) {
      // Completar sólo campos vacíos o place-holder
      const patch = {};
      if (
        nombreIn &&
        (!clienteRow.nombre ||
          clienteRow.nombre.startsWith('Sin nombre cliente'))
      ) {
        patch.nombre = nombreIn;
      }
      if (sexoIn && !clienteRow.sexo) patch.sexo = sexoIn;
      if (fnacIn && !clienteRow.fecha_nacimiento)
        patch.fecha_nacimiento = fnacIn;
      if (alturaIn && !clienteRow.altura_m) patch.altura_m = alturaIn;

      if (Object.keys(patch).length)
        await clienteRow.update(patch, { transaction: t });
      return clienteRow;
    }
  }

  // No existía por DNI → intentar por nombre + fecha_nacimiento
  if (!clienteRow && nombreIn) {
    const where = { nombre: nombreIn };
    if (fnacIn) where.fecha_nacimiento = fnacIn;

    clienteRow = await HxClienteModel.findOne({ where, transaction: t });
    if (clienteRow) {
      const patch = {};
      if (dni && !clienteRow.dni) patch.dni = dni;
      if (sexoIn && !clienteRow.sexo) patch.sexo = sexoIn;
      if (fnacIn && !clienteRow.fecha_nacimiento)
        patch.fecha_nacimiento = fnacIn;
      if (alturaIn && !clienteRow.altura_m) patch.altura_m = alturaIn;

      if (Object.keys(patch).length)
        await clienteRow.update(patch, { transaction: t });
      return clienteRow;
    }
  }

  // Crear nuevo (con lo que venga)
  clienteRow = await HxClienteModel.create(
    {
      nombre: nombreIn || null,
      dni: dni || null,
      sexo: sexoIn || null,
      fecha_nacimiento: fnacIn || null,
      altura_m: alturaIn || null
    },
    { transaction: t }
  );

  // Si no vino nombre → placeholder
  if (!nombreIn) {
    await clienteRow.update(
      { nombre: `Sin nombre cliente ${clienteRow.id}` },
      { transaction: t }
    );
  }

  return clienteRow;
}

/* ===================== Validación request ===================== */
// Permitimos dos formas de identificar al cliente:
// A) cliente_id (preferido)
// B) datos mínimos de cliente: nombre (y opcional sexo/fecha_nacimiento/altura_m)
const clienteSchema = yup
  .object({
    id: yup.number().integer().positive().nullable(),
    nombre: yup.string().nullable(),
    dni: yup.string().trim().optional(), // 👈 nuevo

    sexo: yup.mixed().oneOf(['M', 'F', 'X', null]).nullable(),
    fecha_nacimiento: yup.string().nullable(), // 'YYYY-MM-DD'
    altura_m: yup.number().nullable(),
    batch_id: yup.string().trim().optional() // 👈 nuevo
  })
  .noUnknown();

const bodySchema = yup
  .object({
    idempotency_key: yup.string().max(100).nullable(),
    fecha: yup.string().required('fecha (YYYY-MM-DD) es requerida'),
    cliente: clienteSchema.nullable(), // ← ahora puede ser null/omitido
    content: yup.mixed().nullable(),
    textos: yup.mixed().nullable(),
    batch_id: uuid36.nullable()
  })
  .required();

/* ===================== Parser del JSON n8n ===================== */
function parseMaybeJSON(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return null;
  }
}

function extractInformesFields(content, opts = {}) {
  const { altura_m_fallback = null } = opts;

  const c = content || {};
  const bc = c.body_composition || {};
  const pp = c.physical_parameters || {};
  const idx = pp.indices || {};

  const vOf = (obj, key) => obj?.[key]?.v ?? obj?.[key]; // acepta {v:...} o número directo
  const eOf = (obj, key) => obj?.[key]?.e ?? null;

  const toNumSafe = (x) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };
  const round0 = (x) => (x == null ? null : Math.round(Number(x)));

  const cmToM = (h) => {
    const n = toNumSafe(h);
    if (n == null) return null;
    return n > 3 ? Number((n / 100).toFixed(2)) : Number(n.toFixed(2));
  };

  // ====== BODY COMPOSITION ======
  const peso_kg = toNumSafe(vOf(bc, 'weight'));
  const grasa_kg = toNumSafe(vOf(bc, 'fat'));
  const masa_libre_grasa_kg = toNumSafe(vOf(bc, 'fat_free_mass'));
  const masa_osea_kg = toNumSafe(vOf(bc, 'mineral')); // “mineral” ≈ masa ósea
  const proteinas_kg = toNumSafe(vOf(bc, 'protein'));
  const agua_total_kg = toNumSafe(vOf(bc, 'total_body_water'));

  // algunos equipos reportan músculo/FFM en otros campos
  const soft_lean_mass = toNumSafe(vOf(bc, 'soft_lean_mass')); // no modelado directo (nota)
  const calcio_kg = toNumSafe(vOf(pp, 'calcium')); // a veces viene en pp

  // ====== PHYSICAL PARAMETERS ======
  const grasa_pct = toNumSafe(vOf(pp, 'percent_body_fat'));
  const grasa_visceral = toNumSafe(vOf(pp, 'visceral_fat_index'));

  let imc = toNumSafe(vOf(pp, 'body_mass_index'));
  const imc_estado_en = eOf(pp, 'body_mass_index');
  const imc_categoria = mapEstadoEnToEs(imc_estado_en);

  // masa muscular (si viene en pp)
  let masa_muscular_esqueletica_kg = toNumSafe(vOf(pp, 'skeletal_muscle_mass'));

  const metabolismo_basal_kcal = toNumSafe(vOf(pp, 'basal_metabolic_rate'));
  const gasto_energetico_total_kcal = toNumSafe(
    vOf(pp, 'total_energy_expenditure')
  );
  const edad_metabolica_anios = round0(toNumSafe(vOf(pp, 'physical_age')));

  // === NUEVOS CAMPOS ===
  // Edad del día (si el JSON la trae en top-level)
  const edad_anios = c.Age != null ? round0(c.Age) : null;

  // Puntaje físico (0..100) si viene en physical_parameters
  const puntaje_fisico_100 =
    pp.physical_score != null ? round0(pp.physical_score) : null;

  // Altura contextual del día (si viene Height en cm o m)
  const altura_m_from_content = cmToM(c.Height);
  const altura_m = altura_m_from_content ?? altura_m_fallback ?? null;

  // ====== IMC fallback ======
  // Si no vino IMC pero tenemos peso y altura → calcula IMC = kg / (m*m)
  if (
    (imc == null || Number.isNaN(imc)) &&
    peso_kg != null &&
    altura_m != null &&
    altura_m > 0
  ) {
    const calc = peso_kg / (altura_m * altura_m);
    imc = Number(calc.toFixed(2));
  }

  // ====== Masa muscular fallback ======
  // si no vino skeletal_muscle_mass, algunos equipos dejan soft_lean_mass en bc
  if (masa_muscular_esqueletica_kg == null && soft_lean_mass != null) {
    masa_muscular_esqueletica_kg = soft_lean_mass;
  }

  // Índices extra posibles (no modelados): cintura/cadera
  // const waist_hip = toNumSafe(vOf(idx, 'waist_hip_ratio'));

  return {
    // Contexto del día
    edad_anios, // NUEVO
    altura_m, // (opcional) útil si querés guardarla en hx_informes

    // Resultados
    peso_kg,
    imc,
    imc_categoria,
    grasa_pct,
    grasa_kg,
    grasa_visceral,
    masa_muscular_esqueletica_kg,
    masa_libre_grasa_kg,
    masa_osea_kg,
    calcio_kg,
    agua_total_kg,
    proteinas_kg,
    metabolismo_basal_kcal,
    gasto_energetico_total_kcal,
    edad_metabolica_anios,

    // NUEVO:
    puntaje_fisico_100 // ← se verá en el PDF como “82 /100”, por ej.
    // Campos no modelados: soft_lean_mass, ffmi, waist_hip
  };
}

function extractTextos(textos) {
  const t = textos || {};
  const interpretacion = safeText(t.interpretacion) || null;
  const objetivo = safeText(t.objetivo_final) || null;

  const rec_entrenamiento = joinBullets(t.recomendaciones_entrenamiento);
  const rec_alimentacion = joinBullets(t.recomendaciones_alimenticias);

  const comidas = Array.isArray(t.ejemplos_alimentacion)
    ? t.ejemplos_alimentacion
    : [];
  const comidasParsed = comidas.map(parseEjemploLinea);
  return {
    interpretacion,
    objetivo,
    rec_entrenamiento,
    rec_alimentacion,
    comidasParsed
  };
}

// === NORMALIZADOR PARA SOBRES DE OPENAI (array con choices/output) ===
function tryParseJSON(x) {
  if (x == null) return null;
  if (typeof x === 'object') return x;
  try {
    return JSON.parse(String(x));
  } catch {
    return null;
  }
}

// unescape JSON doble: si viene "\"{...}\"" lo parsea a objeto; si viene "{...}" string, lo parsea; si falla, devuelve original
function parseLooselyJSON(x) {
  if (x == null) return null;
  if (typeof x === 'object') return x;
  const s = String(x).trim();
  // si está entre comillas, quítalas
  const maybe = s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
  return tryParseJSON(maybe) || tryParseJSON(s) || x;
}

// mapeo de sexo textual a tu ENUM
function mapSexo(gender) {
  if (!gender) return null;
  const g = String(gender).toLowerCase();
  if (g.startsWith('f')) return 'F';
  if (g.startsWith('m')) return 'M';
  return 'X';
}

// convierte cm a metros si es necesario
function toAlturaM(h) {
  if (h == null || h === '') return null;
  const n = Number(h);
  if (!isFinite(n)) return null;
  return n > 3 ? Number((n / 100).toFixed(2)) : Number(n.toFixed(2));
}

// Normaliza el "sobre" de OpenAI (array) a tu payload interno
function normalizeOpenAIEnvelope(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const first = arr[0] || {};

  // content (métricas) puede venir doble-serializado
  const contentRaw = first?.choices?.[0]?.message?.content ?? null;
  const contentObj = parseLooselyJSON(contentRaw);

  // textos (interpretación/recomendaciones)
  const textosRaw = first?.output ?? null;
  const textosObj = parseLooselyJSON(textosRaw);

  if (!contentObj && !textosObj) return null;

  const sexo = mapSexo(contentObj?.Gender);
  const altura_m = toAlturaM(contentObj?.Height);
  const edad_anios = Number.isFinite(Number(contentObj?.Age))
    ? Number(contentObj.Age)
    : null;

  const today = new Date().toISOString().slice(0, 10);

  return {
    idempotency_key:
      (typeof first.id === 'string' && first.id) ||
      first.system_fingerprint ||
      `ai-${Date.now()}`,
    fecha: today,
    cliente: {
      sexo: sexo ?? null,
      altura_m: altura_m ?? null
    },
    content: contentObj ? JSON.stringify(contentObj) : undefined,
    textos: textosObj ? JSON.stringify(textosObj) : undefined,
    _edad_anios_override: edad_anios
  };
}
/* ===================== Controller ===================== */
export async function POST_InformeFromOCR(req, res) {
  // 0) Pre-parseo: si el body vino como string, intentar JSON.parse
  let inbound = req.body;
  if (typeof inbound === 'string') {
    const parsed = tryParseJSON(inbound);
    if (parsed) inbound = parsed;
  }

  // 0.1) Si el top-level es array (sobre OpenAI), normalizar
  const maybeFromAI = Array.isArray(inbound)
    ? normalizeOpenAIEnvelope(inbound)
    : null;

  // 0.2) Usar el body normalizado si aplica
  const bodyForValidation = maybeFromAI ? { ...maybeFromAI } : inbound;

  // 1) Validación de request
  let payload;
  try {
    payload = await bodySchema.validate(bodyForValidation, {
      abortEarly: false,
      stripUnknown: true
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Error de validación',
      errors: err.inner?.map((e) => ({ path: e.path, message: e.message })) ?? [
        { message: err.message }
      ]
    });
  }

  const {
    idempotency_key,
    fecha,
    cliente,
    content,
    textos,
    _edad_anios_override
  } = payload;

  // 2) Parse de los JSON (acepta string u objeto)
  let contentObj = null;
  if (content !== undefined && content !== null && content !== '') {
    contentObj = parseMaybeJSON(content);
    if (!contentObj) {
      return res.status(400).json({
        ok: false,
        code: 'BAD_CONTENT',
        message:
          '`content` no es JSON válido (cuando se envía, debe ser JSON parseable)'
      });
    }
  }

  const textosObj = parseMaybeJSON(textos) || {};

  // 3) Mapear a columnas de hx_informes
  const infoFields = contentObj ? extractInformesFields(contentObj) : {};
  if (_edad_anios_override != null && infoFields.edad_anios == null) {
    infoFields.edad_anios = _edad_anios_override;
  }
  const textosFields = extractTextos(textosObj);

  // 👇 *** ÚNICO CAMBIO CLAVE: separar comidasParsed de lo que va a la tabla de informes
  const { comidasParsed, ...textosCols } = textosFields;

  // 4) Transacción + idempotencia
  const t = await db.transaction();
  try {
    // 4.1) Resolver/crear cliente y completar campos faltantes
    let clienteRow;

    if (cliente?.id) {
      clienteRow = await HxClienteModel.findByPk(cliente.id, {
        transaction: t
      });
      if (!clienteRow) throw new Error(`cliente_id ${cliente.id} no existe`);

      const patch = {};
      if (cliente.dni && !clienteRow.dni)
        patch.dni = String(cliente.dni).replace(/\D/g, '');
      if (
        cliente.nombre &&
        (!clienteRow.nombre || clienteRow.nombre.startsWith('Sin nombre'))
      )
        patch.nombre = cliente.nombre;
      if (cliente.sexo && !clienteRow.sexo) patch.sexo = cliente.sexo;
      if (cliente.fecha_nacimiento && !clienteRow.fecha_nacimiento)
        patch.fecha_nacimiento = cliente.fecha_nacimiento;
      if (cliente.altura_m && !clienteRow.altura_m)
        patch.altura_m = cliente.altura_m;

      if (Object.keys(patch).length)
        await clienteRow.update(patch, { transaction: t });
    } else {
      clienteRow = await upsertClienteFromPayload(cliente || {}, t);
    }

    // 4.2) Idempotencia / Upsert de informe por (cliente_id, fecha)
    const [informeRow, createdInforme] = await HxInformeModel.findOrCreate({
      where: { cliente_id: clienteRow.id, fecha },
      defaults: {
        cliente_id: clienteRow.id,
        fecha,
        ...infoFields,
        ...textosCols // 👈 usar SOLO columnas válidas del informe (sin comidasParsed)
      },
      transaction: t
    });

    if (!createdInforme) {
      await informeRow.update(
        { ...infoFields, ...textosCols }, // 👈 idem
        { transaction: t }
      );
    }

    // 4.3) Comidas (array) — usa comidasParsed
    if (Array.isArray(comidasParsed) && comidasParsed.length) {
      const counters = new Map(); // tipo -> next orden

      for (const c of comidasParsed) {
        const descripcion = c.descripcion ?? null;
        const tipo =
          c.tipo && String(c.tipo).trim()
            ? String(c.tipo).trim().toLowerCase()
            : 'sin_tipo';

        const nextOrden = (counters.get(tipo) ?? 0) + 1;
        counters.set(tipo, nextOrden);

        const [row, created] = await HxInformeComidaModel.findOrCreate({
          where: { informe_id: informeRow.id, tipo, orden: nextOrden },
          defaults: { descripcion },
          transaction: t
        });

        if (!created) {
          await row.update({ descripcion }, { transaction: t });
        }
      }
    }

    // 4.4) Vincular imágenes de balanza al informe
    const batch_id_from_body = payload?.batch_id ?? req.body?.batch_id ?? null;
    const batch_id_from_header =
      req.get('batchid') || req.get('BatchId') || null;
    const batch_id = (batch_id_from_body || batch_id_from_header || '').trim();

   if (batch_id) {
     const imgs = await HxImagenBalanzaModel.findAll({
       where: { batch_id },
       transaction: t
     });
     if (!imgs.length)
       throw new Error(`No hay imágenes para batch_id ${batch_id}`);

     const distintosCliente = imgs.some(
       (im) => im.cliente_id && im.cliente_id !== clienteRow.id
     );
     if (distintosCliente)
       throw new Error(`El batch ${batch_id} pertenece a otro cliente.`);

     const [affected] = await HxImagenBalanzaModel.update(
       { cliente_id: clienteRow.id, informe_id: informeRow.id },
       { where: { batch_id }, transaction: t }
     );

     if (!affected)
       throw new Error(
         `No se pudo vincular imágenes al informe (batch_id ${batch_id}).`
       );
   }
    if (batch_id) {
      const imgs = await HxImagenBalanzaModel.findAll({
        where: { batch_id },
        transaction: t
      });

      if (!imgs.length) {
        throw new Error(`No hay imágenes para batch_id ${batch_id}`);
      }

      const distintosCliente = imgs.some(
        (im) => im.cliente_id && im.cliente_id !== clienteRow.id
      );
      if (distintosCliente) {
        throw new Error(`El batch ${batch_id} pertenece a otro cliente.`);
      }

      await HxImagenBalanzaModel.update(
        { cliente_id: clienteRow.id, informe_id: informeRow.id },
        { where: { batch_id }, transaction: t }
      );
    } else {
      const lastImg = await HxImagenBalanzaModel.findOne({
        where: { cliente_id: clienteRow.id, informe_id: null },
        order: [['created_at', 'DESC']],
        transaction: t
      });

      if (lastImg?.batch_id) {
        await HxImagenBalanzaModel.update(
          { informe_id: informeRow.id },
          {
            where: {
              batch_id: lastImg.batch_id,
              [Op.or]: [{ informe_id: null }, { informe_id: informeRow.id }]
            },
            transaction: t
          }
        );
      }
    }

    await t.commit();

    // Preferencias de PDF
    const wantsPDFDownload =
      req.query?.download === '1' ||
      (req.get('accept') || '').toLowerCase().includes('application/pdf');

    const wantsPDFMeta =
      req.query?.pdf === 'meta' || req.body?.generate_pdf === true;

    if (wantsPDFDownload || wantsPDFMeta) {
      try {
        const clienteFull = await HxClienteModel.findByPk(clienteRow.id, {
          attributes: [
            'id',
            'nombre',
            'dni',
            'sexo',
            'fecha_nacimiento',
            'altura_m'
          ]
        });
        const informeFull = await HxInformeModel.findByPk(informeRow.id);
        const comidas = await HxInformeComidaModel.findAll({
          where: { informe_id: informeRow.id },
          order: [
            ['tipo', 'ASC'],
            ['orden', 'ASC'],
            ['id', 'ASC']
          ],
          attributes: ['tipo', 'orden', 'descripcion']
        });

        const { generateInformePDFBuffer } = await import('../utils/hx_pdf.js');

        const pdfBuffer = await generateInformePDFBuffer({
          cliente: clienteFull.toJSON(),
          informe: informeFull.toJSON(),
          comidas: comidas.map((r) => r.toJSON())
        });

        const wantsPDFBase64 =
          req.query?.pdf === 'base64' || req.body?.pdf === 'base64';

        if (wantsPDFBase64) {
          const b64 = pdfBuffer.toString('base64');
          const fecha =
            informeFull.fecha || new Date().toISOString().slice(0, 10);
          const filename = getInformeFilename({
            informe: informeFull,
            cliente: clienteFull
          });
          return res.json({
            ok: true,
            idempotency_key: idempotency_key ?? null,
            cliente_id: clienteRow.id,
            informe_id: informeRow.id,
            created: createdInforme,
            pdf: {
              generated: true,
              filename,
              content_type: 'application/pdf',
              size_bytes: Buffer.byteLength(pdfBuffer),
              base64: b64
            }
          });
        }

        const fecha =
          informeFull.fecha || new Date().toISOString().slice(0, 10);
        const filename = getInformeFilename({
          informe: informeFull,
          cliente: clienteFull
        });

        if (wantsPDFDownload) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}"`
          );
          res.setHeader('X-PDF-Filename', filename);
          return res.end(pdfBuffer);
        }

        const saveDir = path.resolve('./exports');
        await ensureDir(saveDir);
        const savePath = path.join(saveDir, filename);
        await fs.writeFile(savePath, pdfBuffer);

        const publicUrl = `/exports/${filename}`;

        return res.json({
          ok: true,
          idempotency_key: idempotency_key ?? null,
          cliente_id: clienteRow.id,
          informe_id: informeRow.id,
          created: createdInforme,
          pdf: {
            generated: true,
            filename,
            content_type: 'application/pdf',
            size_bytes: Buffer.byteLength(pdfBuffer),
            saved: true,
            path: savePath,
            url: publicUrl
          }
        });
      } catch (err) {
        return res.status(500).json({
          ok: false,
          code: 'PDF_ERROR',
          message: 'No se pudo generar/guardar el PDF',
          detail:
            process.env.NODE_ENV === 'production' ? undefined : err.message
        });
      }
    }

    const pdfDownloadUrl = `/hx/informes/${informeRow.id}/pdf`;
    const pdfInlineUrl = `/hx/informes/${informeRow.id}/pdf?view=1`;

    if (req.query?.redirect === '1') {
      res.status(303).set('Location', pdfDownloadUrl);
      return res.end();
    }

    if (req.query?.open === '1') {
      const fecha = fecha;
      const html = `<!doctype html>
<html lang="es"><head>
  <meta charset="utf-8">
  <title>Descargando informe…</title>
  <meta http-equiv="refresh" content="0; url='${pdfDownloadUrl}'" />
  <style>body{font-family: system-ui, Arial, sans-serif; padding:24px}</style>
</head>
<body>
  <h1>Generando y descargando informe…</h1>
  <p>Si no inicia la descarga automáticamente, <a href="${pdfDownloadUrl}">hacer clic aquí</a>.</p>
</body></html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(html);
    }

    return res.json({
      ok: true,
      idempotency_key: idempotency_key ?? null,
      cliente_id: clienteRow.id,
      informe_id: informeRow.id,
      created: createdInforme,
      pdf: {
        generated: false,
        url: `/hx/informes/${informeRow.id}/pdf`,
        inline_url: `/hx/informes/${informeRow.id}/pdf?view=1`
      }
    });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({
      ok: false,
      code: 'INGEST_ERROR',
      message: err.message,
      detail: {
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
        hint: 'Verifique cliente (id/nombre), fecha (YYYY-MM-DD) y estructura JSON de content/textos.'
      }
    });
  }
}
