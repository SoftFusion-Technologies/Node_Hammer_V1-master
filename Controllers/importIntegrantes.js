import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import IntegranteConveImp from '../Models/MD_TB_IntegrantesConveImp.js';
import { validateData } from '../utils/validators.js';
import sequelize from '../DataBase/db.js';
import fs from 'fs';

// NUEVO: para leer permiteFec del convenio
import MD_TB_AdmConvenios from '../Models/MD_TB_AdmConvenios.js';
const AdmConveniosModel = MD_TB_AdmConvenios.AdmConveniosModel;

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

router.post('/import/:id_conv', upload.single('file'), async (req, res) => {
  const file = req.file;
  const idConvRaw = req.params.id_conv;

  if (!file) {
    return res.status(400).json({ message: 'No se ha subido ningún archivo' });
  }

  const convId = Number(idConvRaw || 0);
  if (!Number.isFinite(convId) || convId <= 0) {
    // Mantengo estilo de tu endpoint
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
      attributes: ['id', 'permiteFec'],
      transaction
    });

    if (!convenio) {
      await transaction.rollback();
      transaction = null;
      fs.unlinkSync(file.path);
      return res.status(404).json({ message: 'Convenio no encontrado' });
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
        nombre: cleanStr(integrante.nombre),
        telefono: cleanStr(integrante.telefono),
        dni: cleanStr(integrante.dni),
        email: cleanStr(integrante.email),
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
      // ANTI DUPLICADOS (permiteFec)
      // ============================
      if (permiteFec) {
        const key = personKey(row);

        if (!key) {
          // Sin identidad, no deduplicamos: insert directo
          await IntegranteConveImp.create(row, { transaction });
          inserted += 1;
          continue;
        }

        // Buscar existente en ese mes
        const existing = await sequelize.query(
          `
          SELECT id, nombre, telefono, dni, email, notas, precio, descuento, preciofinal, userName
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
            precio: mergePreferFilled(found.precio, row.precio),
            descuento: mergePreferFilled(found.descuento, row.descuento),
            preciofinal: mergePreferFilled(found.preciofinal, row.preciofinal),
            userName: mergePreferFilled(found.userName, row.userName)
            // fechaCreacion NO se toca: ya es monthStart
          };

          await IntegranteConveImp.update(patch, {
            where: { id: found.id },
            transaction
          });

          updated += 1;
        } else {
          await IntegranteConveImp.create(row, { transaction });
          inserted += 1;
        }
      } else {
        // No mensual: insert simple (sin dedup por mes)
        await IntegranteConveImp.create(row, { transaction });
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
