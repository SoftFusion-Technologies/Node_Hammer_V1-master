import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
// import IntegranteConveImp from '../Models/MD_TB_IntegrantesConveImp.js';// Modelo ya no util, usamos el modelo original
import { validateData } from '../utils/validators.js';
import sequelize from '../DataBase/db.js';
import fs from 'fs';

// NUEVO: para leer permiteFec del convenio
import MD_TB_AdmConvenios from '../Models/MD_TB_AdmConvenios.js';
const AdmConveniosModel = MD_TB_AdmConvenios.AdmConveniosModel;

import MD_TB_IntegrantesConve from '../Models/MD_TB_IntegrantesConve.js';
const IntegrantesConveModel = MD_TB_IntegrantesConve.IntegrantesConveModel;

import MD_TB_ConveniosPlanesDisponibles from '../Models/MD_TB_ConveniosPlanesDisponibles.js';
const ConveniosPlanesDisponiblesModel =
  MD_TB_ConveniosPlanesDisponibles.ConveniosPlanesDisponiblesModel;

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';

function assertMonthStartFormat(v) {
  const ok = /^\d{4}-\d{2}-01 00:00:00$/.test(String(v || ''));
  if (!ok) {
    const e = new Error('monthStart inválido. Debe ser YYYY-MM-01 00:00:00');
    e.statusCode = 400;
    throw e;
  }
}

// Acepta:
// - 'YYYY-MM-01 00:00:00'
// - 'YYYY-MM-01'
// - 'YYYY-MM'
// - ISO 'YYYY-MM-01T00:00:00.000Z'
function normalizeMonthStart(input) {
  if (isEmpty(input)) return null;
  const s = String(input).trim();

  // ISO -> tomar YYYY-MM-01 00:00:00
  if (s.includes('T')) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01 00:00:00`;
  }

  if (/^\d{4}-\d{2}-01\s+00:00:00$/.test(s)) return s;
  if (/^\d{4}-\d{2}-01$/.test(s)) return `${s} 00:00:00`;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01 00:00:00`;

  return null;
}

function cleanStr(v) {
  return isEmpty(v) ? '' : String(v).trim();
}

function personKey(row) {
  const dni = cleanStr(row?.dni);
  if (dni) return `D:${dni}`;

  const email = cleanStr(row?.email).toLowerCase();
  if (email) return `E:${email}`;

  const tel = cleanStr(row?.telefono);
  if (tel) return `T:${tel}`;

  return null;
}

// “Completa sin pisar”: solo actualiza un campo si el nuevo trae algo y el viejo está vacío
function mergePreferFilled(oldVal, newVal) {
  const o = cleanStr(oldVal);
  const n = cleanStr(newVal);
  if (!o && n) return n;
  return oldVal;
}

// ============================
// Helpers fecha vencimiento (DATETIME MySQL sin tz)
// ============================
function parseMySQLDateTimeUTC(s) {
  if (!s) return null;
  const str = String(s).trim();
  const [datePart, timePart = '00:00:00'] = str.split(' ');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm, ss] = timePart.split(':').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
    return null;
  return new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0, ss || 0));
}

function formatMySQLDateTimeUTC(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
      date.getUTCDate()
    )} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(
      date.getUTCSeconds()
    )}`
  );
}

function addDaysMySQL(fechaCreacion, duracionDias) {
  const days = Number(duracionDias || 0);
  if (!Number.isFinite(days) || days <= 0) return null;

  let base;
  if (typeof fechaCreacion === 'string')
    base = parseMySQLDateTimeUTC(fechaCreacion);
  else base = new Date(fechaCreacion);

  if (!base || Number.isNaN(base.getTime())) return null;

  const out = new Date(base.getTime() + days * 86400000);
  return formatMySQLDateTimeUTC(out);
}

// ============================
// Helpers money: tratar 0 como "no informado" (para completar desde plan)
// ============================
function isZeroLike(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  if (!s) return false;

  // normalizar: "0,00" -> "0.00", quitar miles
  let t = s.replace(/\s/g, '');
  if (t.includes(',')) {
    t = t.replace(/\./g, '');
    t = t.replace(',', '.');
  }
  t = t.replace(/,/g, '');

  const n = parseFloat(t);
  return Number.isFinite(n) && n === 0;
}

function isEmptyMoney(v) {
  return isEmpty(v) || isZeroLike(v);
}

function toMoneyStr(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '';
}

// Merge “completar sin pisar”, pero considerando 0 como vacío
function mergePreferFilledMoney(oldVal, newVal) {
  const oEmpty = isEmptyMoney(oldVal);
  const n = cleanStr(newVal);
  if (oEmpty && n) return n;
  return oldVal;
}

router.post('/import/:id_conv', upload.single('file'), async (req, res) => {
  const file = req.file;
  const idConvRaw = req.params.id_conv;

  if (!file) {
    return res.status(400).json({ message: 'No se ha subido ningún archivo' });
  }

  const convId = Number(idConvRaw || 0);
  if (!Number.isFinite(convId) || convId <= 0) {
    try {
      fs.unlinkSync(file.path);
    } catch {}
    return res
      .status(400)
      .json({ message: 'El parámetro id_conv es requerido' });
  }

  let transaction = null;

  try {
    // Leer el archivo y convertirlo en JSON
    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Validar datos
    const validData = validateData(sheet);

    if (validData.length === 0) {
      fs.unlinkSync(file.path);
      return res
        .status(400)
        .json({ message: 'No se encontraron datos válidos para importar' });
    }

    transaction = await sequelize.transaction();

    // NUEVO: leer convenio para saber permiteFec
    const convenio = await AdmConveniosModel.findByPk(convId, {
      attributes: ['id', 'permiteFec', 'sede'],
      transaction
    });

    if (!convenio) {
      await transaction.rollback();
      transaction = null;
      fs.unlinkSync(file.path);
      return res.status(404).json({ message: 'Convenio no encontrado' });
    }

    const convenioSede = cleanStr(convenio?.sede);

    // ============================
    // Benjamin Orellana - 30/12/2025
    // Resolver plan por defecto del convenio (si existe)
    // ============================
    let defaultPlan = await ConveniosPlanesDisponiblesModel.findOne({
      where: {
        convenio_id: convId,
        es_default: 1,
        activo: 1
      },
      attributes: [
        'id',
        'duracion_dias',
        'precio_lista',
        'descuento_valor',
        'precio_final'
      ],
      order: [['id', 'DESC']],
      transaction
    });

    // Si por algún motivo el default está inactivo, igual lo buscamos (opcional)
    if (!defaultPlan) {
      defaultPlan = await ConveniosPlanesDisponiblesModel.findOne({
        where: { convenio_id: convId, es_default: 1 },
        attributes: [
          'id',
          'duracion_dias',
          'precio_lista',
          'descuento_valor',
          'precio_final'
        ],
        order: [['id', 'DESC']],
        transaction
      });
    }

    const permiteFec = Number(convenio.permiteFec || 0) === 1;

    // NUEVO: monthStart objetivo para importación mensual (permiteFec=1)
    // Se acepta por query o body: ?monthStart=2026-01-01 00:00:00
    // Si no viene, usamos mes actual (inicio de mes en SQL) para evitar “caer” en meses viejos.
    let monthStart = null;

    if (permiteFec) {
      const fromReq =
        req.query.monthStart ?? req.body?.monthStart ?? req.query.mes ?? null;

      monthStart = normalizeMonthStart(fromReq);

      if (!monthStart) {
        const rows = await sequelize.query(
          `SELECT DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00') AS monthStart`,
          { type: sequelize.QueryTypes.SELECT, transaction }
        );
        monthStart = rows[0]?.monthStart || null;
      }

      assertMonthStartFormat(monthStart);
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    // Insertar / Upsert
    for (const integrante of validData) {
      const row = {
        id_conv: convId,

        // plan por defecto si existe
        convenio_plan_id: defaultPlan ? Number(defaultPlan.id) : null,

        nombre: cleanStr(integrante.nombre),
        telefono: cleanStr(integrante.telefono),
        dni: cleanStr(integrante.dni),
        email: cleanStr(integrante.email),

        // sede del convenio por defecto (si Excel no trae)
        sede: cleanStr(integrante.sede) || convenioSede || null,

        notas: cleanStr(integrante.notas),
        precio: cleanStr(integrante.precio),
        descuento: cleanStr(integrante.descuento),
        preciofinal: cleanStr(integrante.preciofinal),
        userName: cleanStr(integrante.userName)
      };

      // ============================
      // FECHA: aplicar regla negocio
      // ============================

      // Comentado: generaba imports en el mes “actual del server” o por parse ambiguo de Excel,
      // causando que una importación de enero termine registrada en diciembre.
      // fechaCreacion: integrante.fechaCreacion || new Date()
      //
      // NUEVO:
      if (permiteFec) {
        // Si el convenio trabaja por mes: forzar inicio de mes objetivo
        row.fechaCreacion = monthStart;
      } else {
        // Si NO trabaja por mes: respetar fecha por fila si viene, si no NOW()
        row.fechaCreacion = integrante.fechaCreacion || new Date();
      }

      // ============================
      // NUEVO: si hay plan default, calcular vencimiento si aplica
      // ============================
      if (defaultPlan && defaultPlan.duracion_dias) {
        // Solo setear vencimiento si no viene por Excel y si el plan tiene duración
        row.fecha_vencimiento = addDaysMySQL(
          row.fechaCreacion,
          defaultPlan.duracion_dias
        );
      } else {
        row.fecha_vencimiento = null;
      }

      // Opcional recomendado: si el Excel no trae precio/descuento/preciofinal, completar desde plan
      if (defaultPlan) {
        if (isEmpty(row.precio) && defaultPlan.precio_lista != null)
          row.precio = String(defaultPlan.precio_lista);

        if (isEmpty(row.descuento) && defaultPlan.descuento_valor != null)
          row.descuento = String(defaultPlan.descuento_valor);

        if (isEmpty(row.preciofinal) && defaultPlan.precio_final != null)
          row.preciofinal = String(defaultPlan.precio_final);
      }

      // ============================
      // NUEVO: si hay plan default, completar importes si vienen vacíos o 0
      // ============================
      if (defaultPlan) {
        if (isEmptyMoney(row.precio) && defaultPlan.precio_lista != null) {
          row.precio = toMoneyStr(defaultPlan.precio_lista);
        }

        if (
          isEmptyMoney(row.descuento) &&
          defaultPlan.descuento_valor != null
        ) {
          row.descuento = toMoneyStr(defaultPlan.descuento_valor);
        }

        if (isEmptyMoney(row.preciofinal) && defaultPlan.precio_final != null) {
          row.preciofinal = toMoneyStr(defaultPlan.precio_final);
        }
      }

      // ============================
      // ANTI DUPLICADOS (permiteFec)
      // ============================
      if (permiteFec) {
        const key = personKey(row);

        if (!key) {
          // Sin identidad, no deduplicamos: insert directo
          await IntegrantesConveModel.create(row, { transaction });
          inserted += 1;
          continue;
        }

        // Buscar existente en ese mes
        const existing = await sequelize.query(
          `
  SELECT id, nombre, telefono, dni, email, notas, precio, descuento, preciofinal, userName,
         convenio_plan_id, fecha_vencimiento
  FROM integrantes_conve
  WHERE id_conv = :id_conv
    AND fechaCreacion = :monthStart
    AND (
      (:dni <> '' AND TRIM(dni) = :dni)
      OR (:email <> '' AND LOWER(TRIM(email)) = :email)
      OR (:tel <> '' AND TRIM(telefono) = :tel)
    )
  ORDER BY id DESC
  LIMIT 1
  `,
          {
            replacements: {
              id_conv: convId,
              monthStart,
              dni: cleanStr(row.dni),
              email: cleanStr(row.email).toLowerCase(),
              tel: cleanStr(row.telefono)
            },
            type: sequelize.QueryTypes.SELECT,
            transaction
          }
        );

        const found = existing?.[0] || null;

        if (found) {
          // Upsert “suave”: completar campos vacíos sin pisar info útil existente
          const patch = {
            nombre: mergePreferFilled(found.nombre, row.nombre),
            telefono: mergePreferFilled(found.telefono, row.telefono),
            dni: mergePreferFilled(found.dni, row.dni),
            email: mergePreferFilled(found.email, row.email),
            notas: mergePreferFilled(found.notas, row.notas),
            precio: mergePreferFilledMoney(found.precio, row.precio),
            descuento: mergePreferFilledMoney(found.descuento, row.descuento),
            preciofinal: mergePreferFilledMoney(
              found.preciofinal,
              row.preciofinal
            ),
            userName: mergePreferFilled(found.userName, row.userName)
            // fechaCreacion NO se toca: ya es monthStart
          };

          // NUEVO: setear plan default SOLO si el existente no tiene plan
          if (
            defaultPlan &&
            (found.convenio_plan_id === null ||
              found.convenio_plan_id === undefined)
          ) {
            patch.convenio_plan_id = Number(defaultPlan.id);
          }

          // NUEVO: setear vencimiento SOLO si no estaba calculado
          if (
            defaultPlan &&
            defaultPlan.duracion_dias &&
            !found.fecha_vencimiento
          ) {
            patch.fecha_vencimiento = addDaysMySQL(
              row.fechaCreacion,
              defaultPlan.duracion_dias
            );
          }

          await IntegrantesConveModel.update(patch, {
            where: { id: found.id },
            transaction
          });

          updated += 1;
        } else {
          await IntegrantesConveModel.create(row, { transaction });
          inserted += 1;
        }
      } else {
        // No mensual: insert simple (sin dedup por mes)
        await IntegrantesConveModel.create(row, { transaction });
        inserted += 1;
      }
    }

    await transaction.commit();
    transaction = null;

    fs.unlinkSync(file.path);

    return res.status(200).json({
      message: 'Importación exitosa',
      meta: {
        id_conv: convId,
        permiteFec: permiteFec ? 1 : 0,
        monthStart: permiteFec ? monthStart : null,
        inserted,
        updated,
        skipped
      }
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch {}
    }

    try {
      fs.unlinkSync(file.path);
    } catch {}

    const code = error.statusCode || 500;

    return res.status(code).json({
      message: 'Error en la importación',
      error: error.message
    });
  }
});

export default router;
