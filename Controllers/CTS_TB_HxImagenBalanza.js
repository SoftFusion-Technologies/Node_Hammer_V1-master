/* Programador: Benjamin Orellana
 * Fecha Creación: 11/10/2025
 * Versión: 1.0
 *
 * Descripción:
 *  Controlador para imágenes de balanza:
 *   - POST /hx/imagenes-balanza (subida 2..4 imágenes en lote)
 *   - GET  /hx/imagenes-balanza/:batch_id         (lista por lote)
 *   - GET  /hx/imagenes-balanza?informe_id=123    (lista por informe)
 *   - GET  /hx/imagenes-balanza/file/:id          (descarga/serve una imagen)
 *
 * Notas:
 *  - El informe puede crearse después: se guarda informe_id = NULL y luego se asocia.
 */

import dotenv from 'dotenv';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import HxImagenBalanzaModel from '../Models/MD_TB_HxImagenesBalanza.js';
import HxClienteModel from '../Models/MD_TB_HxClientes.js';
import HxInformeModel from '../Models/MD_TB_HxInformes.js';
import db from '../DataBase/db.js';
import { Op, Sequelize } from 'sequelize';

// Para obtener dimensiones sin dependencias pesadas, probamos 'image-size' si está instalado.
// Si no, almacenamos width/height = null y no rompemos el flujo.
let imageSize = null;
try {
  // eslint-disable-next-line global-require
  imageSize = (await import('image-size')).imageSize;
} catch {
  imageSize = null;
}

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ==================== Utils ==================== */
const ensureDir = async (dir) => fs.mkdir(dir, { recursive: true });
const sha256hex = (buf) =>
  crypto.createHash('sha256').update(buf).digest('hex');

const isAllowedImageMime = (m) => {
  if (!m) return false;
  const mm = m.toLowerCase();
  return (
    mm === 'image/jpeg' ||
    mm === 'image/jpg' ||
    mm === 'image/png' ||
    mm === 'image/webp' ||
    mm === 'image/heic' || // si no podés leer dimensiones, igual se guarda
    mm === 'image/heif'
  );
};

const slug = (s = '') =>
  String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

/* ==================== Multer (memoria) ==================== */
// Usamos memoryStorage para poder calcular hash y dimensiones antes de escribir a disco.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 4,
    fileSize: 20 * 1024 * 1024 // 20 MB por imagen (ajustable)
  },
  fileFilter: (req, file, cb) => {
    if (!isAllowedImageMime(file.mimetype)) {
      cb(new Error('Formato no permitido. Use JPG/PNG/WEBP/HEIC/HEIF.'));
    } else cb(null, true);
  }
}).array('fotos', 4);

/* ==================== POST: subir lote (2..4 imágenes) ==================== */
/**
 * Body (multipart/form-data):
 *  - fotos: (2..4) archivos
 *  - cliente_id (opcional)
 *  - informe_id (opcional - normalmente NO, porque el informe se creará luego)
 *  - fecha_captura (YYYY-MM-DD) (opcional)
 *  - notas (opcional, aplicar a todas)
 *
 * Respuesta:
 *  { ok, batch_id, count, items:[{id, orden, storage_url, ...}], constraints:{min,max} }
 */
export async function POST_UploadImagenesBalanza(req, res) {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        ok: false,
        code: 'UPLOAD_ERROR',
        message: err.message || 'Error subiendo imágenes'
      });
    }

    const files = req.files || [];
    const {
      cliente_id,
      informe_id,
      fecha_captura,
      notas,
      nombre: nombreRaw, // 👈 existente
      dni: dniRaw, // 👈 existente
      sede: sedeRaw // 👈 NUEVO
    } = req.body || {};
    const MIN = 2,
      MAX = 4;

    if (files.length < MIN || files.length > MAX) {
      return res.status(400).json({
        ok: false,
        code: 'BAD_COUNT',
        message: `Debe enviar entre ${MIN} y ${MAX} imágenes`,
        constraints: { min: MIN, max: MAX, got: files.length }
      });
    }

    // ================= Resolver cliente =================
    let clienteRow = null;
    const nombre = (nombreRaw || '').trim() || null;
    const dni = (dniRaw || '').replace(/\D/g, '') || null;
    const sede = (sedeRaw ?? '').toString().trim() || null;

    const hasDniColumn = !!HxClienteModel.rawAttributes?.dni;
    const hasSedeColumn = !!HxClienteModel.rawAttributes?.sede;

    if (cliente_id) {
      clienteRow = await HxClienteModel.findByPk(cliente_id);
      if (!clienteRow) {
        return res.status(400).json({
          ok: false,
          code: 'CLIENT_NOT_FOUND',
          message: `cliente_id ${cliente_id} no existe`
        });
      }
      // Si viene sede y existe la columna, actualizamos si cambió
      if (hasSedeColumn && sede && sede !== (clienteRow.sede || null)) {
        await clienteRow.update({ sede });
      }
      // Si viene nombre y está vacío en DB, opcionalmente lo completamos
      if (nombre && !clienteRow.nombre) {
        await clienteRow.update({ nombre });
      }
      // Si viene dni y existe columna y está vacío en DB, opcionalmente lo completamos
      if (dni && hasDniColumn && !clienteRow.dni) {
        await clienteRow.update({ dni });
      }
    } else if (nombre || dni) {
      // Buscar por DNI primero (si existe la columna)
      if (dni && hasDniColumn) {
        clienteRow = await HxClienteModel.findOne({ where: { dni } });
      }
      // Luego por nombre exacto
      if (!clienteRow && nombre) {
        clienteRow = await HxClienteModel.findOne({ where: { nombre } });
      }

      if (!clienteRow) {
        // Crear cliente con los datos disponibles
        clienteRow = await HxClienteModel.create({
          nombre: nombre || null,
          ...(hasDniColumn && dni ? { dni } : {}),
          ...(hasSedeColumn && sede ? { sede } : {})
        });

        if (!nombre) {
          await clienteRow.update({
            nombre: `Sin nombre cliente ${clienteRow.id}`
          });
        }
      } else {
        // Si ya existía, actualizamos sede si llegó y existe la columna
        if (hasSedeColumn && sede && sede !== (clienteRow.sede || null)) {
          await clienteRow.update({ sede });
        }
        // Opcional: completar dni si faltaba
        if (hasDniColumn && dni && !clienteRow.dni) {
          await clienteRow.update({ dni });
        }
      }
    }
    // si no vino nada, se permite batch sin cliente (cliente_id null)

    // ============ Validar informe si lo mandaron ============
    let informeRow = null;
    if (informe_id) {
      informeRow = await HxInformeModel.findByPk(informe_id);
      if (!informeRow) {
        return res.status(400).json({
          ok: false,
          code: 'REPORT_NOT_FOUND',
          message: `informe_id ${informe_id} no existe`
        });
      }
    }

    const t = await db.transaction();
    try {
      const batch_id = uuidv4();
      const baseDir = path.resolve('./uploads/balanza', batch_id);
      await ensureDir(baseDir);

      // Si el modelo NO tiene las columnas, persistimos lo provisto en notas
      let notasExtraObj = {};
      if ((!hasDniColumn && (dni || nombre)) || (!hasSedeColumn && sede)) {
        notasExtraObj = {
          ...(nombre ? { provided_nombre: nombre } : {}),
          ...(dni ? { provided_dni: dni } : {}),
          ...(sede ? { provided_sede: sede } : {})
        };
      }

      const saved = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const buffer = f.buffer;
        const mime = f.mimetype;
        const sha = sha256hex(buffer);

        // dimensiones (si querés/si podés)
        let width = null,
          height = null;
        if (imageSize) {
          try {
            const info = imageSize(buffer);
            width = Number.isFinite(info?.width) ? info.width : null;
            height = Number.isFinite(info?.height) ? info.height : null;
          } catch {}
        }

        const safeName = `${String(i + 1).padStart(2, '0')}-${slug(
          f.originalname || 'foto'
        )}`;
        const finalName = /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(safeName)
          ? safeName
          : `${safeName}${
              mime === 'image/png'
                ? '.png'
                : mime === 'image/webp'
                ? '.webp'
                : mime === 'image/heic' || mime === 'image/heif'
                ? '.heic'
                : '.jpg'
            }`;

        const savePath = path.join(baseDir, finalName);
        await fs.writeFile(savePath, buffer);

        const publicUrl = `/uploads/balanza/${batch_id}/${finalName}`;

        // notas finales
        const notasFinal =
          notas || Object.keys(notasExtraObj).length
            ? JSON.stringify({ ...(notas ? { notas } : {}), ...notasExtraObj })
            : null;

        const row = await HxImagenBalanzaModel.create(
          {
            cliente_id: clienteRow?.id ?? null, // 👈 asignamos cliente si lo resolvimos
            informe_id: informeRow?.id ?? null,
            batch_id,
            orden: i + 1,
            fecha_captura: fecha_captura || null,
            filename_original: f.originalname || null,
            mime_type: mime || null,
            size_bytes: f.size ?? buffer.length,
            width_px: width,
            height_px: height,
            sha256_hex: sha,
            storage_path: savePath,
            storage_url: publicUrl,
            notas: notasFinal
          },
          { transaction: t }
        );

        saved.push({
          id: row.id,
          batch_id,
          orden: row.orden,
          informe_id: row.informe_id,
          cliente_id: row.cliente_id,
          storage_url: publicUrl,
          filename_original: row.filename_original,
          mime_type: row.mime_type,
          size_bytes: row.size_bytes,
          width_px: row.width_px,
          height_px: row.height_px,
          fecha_captura: row.fecha_captura
        });
      }

      await t.commit();
      return res.json({
        ok: true,
        batch_id,
        count: saved.length,
        constraints: { min: MIN, max: MAX },
        // info útil para el frontend/n8n
        cliente_resuelto: clienteRow
          ? {
              id: clienteRow.id,
              nombre: clienteRow.nombre,
              ...(clienteRow.dni ? { dni: clienteRow.dni } : {}),
              ...(hasSedeColumn && (clienteRow.sede || sede)
                ? { sede: clienteRow.sede ?? sede }
                : {})
            }
          : null,
        items: saved
      });
    } catch (e) {
      await t.rollback();
      return res.status(500).json({
        ok: false,
        code: 'SAVE_ERROR',
        message: 'No se pudieron guardar las imágenes',
        detail: process.env.NODE_ENV === 'production' ? undefined : e.message
      });
    }
  });
}

/* ==================== GET: listar por batch o por informe ==================== */
/**
 * GET /hx/imagenes-balanza/:batch_id
 * GET /hx/imagenes-balanza?informe_id=123
 * GET /hx/imagenes-balanza?cliente_id=45   (opcional)
 */
export async function GET_ListImagenesBalanza(req, res) {
  try {
    const { batch_id } = req.params || {};
    const { informe_id, cliente_id } = req.query || {};

    const where = {};
    if (batch_id) where.batch_id = batch_id;
    if (informe_id) where.informe_id = informe_id;
    if (cliente_id) where.cliente_id = cliente_id;

    if (!where.batch_id && !where.informe_id && !where.cliente_id) {
      return res.status(400).json({
        ok: false,
        code: 'BAD_QUERY',
        message:
          'Debe especificar batch_id (path), o informe_id/cliente_id (query).'
      });
    }

    const rows = await HxImagenBalanzaModel.findAll({
      where,
      order: [
        ['batch_id', 'ASC'],
        ['orden', 'ASC'],
        ['id', 'ASC']
      ]
    });

    return res.json({
      ok: true,
      count: rows.length,
      items: rows.map((r) => ({
        id: r.id,
        batch_id: r.batch_id,
        orden: r.orden,
        informe_id: r.informe_id,
        cliente_id: r.cliente_id,
        storage_url: r.storage_url,
        filename_original: r.filename_original,
        mime_type: r.mime_type,
        size_bytes: r.size_bytes,
        width_px: r.width_px,
        height_px: r.height_px,
        fecha_captura: r.fecha_captura
      }))
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      code: 'LIST_ERROR',
      message: 'No se pudo listar',
      detail: process.env.NODE_ENV === 'production' ? undefined : e.message
    });
  }
}

/* ==================== GET: servir/descargar una imagen por id ==================== */
/**
 * GET /hx/imagenes-balanza/file/:id   → Content-Type imagen, Content-Disposition inline
 *  - Si querés forzar descarga: ?download=1
 */
export async function GET_DownloadImagenBalanza(req, res) {
  try {
    const { id } = req.params;
    const row = await HxImagenBalanzaModel.findByPk(id);
    if (!row) {
      return res.status(404).json({
        ok: false,
        code: 'NOT_FOUND',
        message: `Imagen id ${id} no existe`
      });
    }

    const filepath = row.storage_path;
    if (!filepath || !fsSync.existsSync(filepath)) {
      return res.status(404).json({
        ok: false,
        code: 'FILE_MISSING',
        message: 'Archivo no disponible en disco'
      });
    }

    const download = req.query?.download === '1';
    const filename = path.basename(filepath);

    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    const disp = download ? 'attachment' : 'inline';
    res.setHeader(
      'Content-Disposition',
      `${disp}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`
    );

    const stream = fsSync.createReadStream(filepath);
    stream.pipe(res);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      code: 'SERVE_ERROR',
      message: 'No se pudo servir el archivo',
      detail: process.env.NODE_ENV === 'production' ? undefined : e.message
    });
  }
}

export async function GET_ListUltimosBatches(req, res) {
  try {
    const limit = Math.min(Number(req.query?.limit) || 1, 20); // default 1, tope 20
    const cliente_id = req.query?.cliente_id
      ? Number(req.query.cliente_id)
      : null;
    const informe_id = req.query?.informe_id
      ? Number(req.query.informe_id)
      : null;

    // subquery: batch_id, max_created
    const rows = await HxImagenBalanzaModel.findAll({
      attributes: [
        'batch_id',
        [Sequelize.fn('MAX', Sequelize.col('created_at')), 'max_created'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: {
        ...(cliente_id ? { cliente_id } : {}),
        ...(informe_id ? { informe_id } : {})
      },
      group: ['batch_id'],
      order: [[Sequelize.literal('max_created'), 'DESC']],
      limit
    });

    const batchIds = rows.map((r) => r.get('batch_id'));
    if (!batchIds.length) {
      return res.json({ ok: true, count: 0, batches: [] });
    }

    // traer items de esos batches (ordenados)
    const items = await HxImagenBalanzaModel.findAll({
      where: { batch_id: { [Op.in]: batchIds } },
      order: [
        [
          Sequelize.literal(
            `FIELD(batch_id, ${batchIds.map((b) => `'${b}'`).join(',')})`
          ),
          'ASC'
        ],
        ['orden', 'ASC'],
        ['id', 'ASC']
      ]
    });

    // agrupar
    const byBatch = new Map();
    for (const r of items) {
      const b = r.batch_id;
      if (!byBatch.has(b)) byBatch.set(b, []);
      byBatch.get(b).push({
        id: r.id,
        orden: r.orden,
        storage_url: r.storage_url,
        filename_original: r.filename_original,
        mime_type: r.mime_type,
        size_bytes: r.size_bytes,
        width_px: r.width_px,
        height_px: r.height_px,
        cliente_id: r.cliente_id,
        informe_id: r.informe_id,
        created_at: r.created_at
      });
    }

    // respuesta compacta
    const batches = rows.map((meta) => ({
      batch_id: meta.get('batch_id'),
      count: Number(meta.get('count')),
      max_created: meta.get('max_created'),
      items: byBatch.get(meta.get('batch_id')) || []
    }));

    return res.json({ ok: true, count: batches.length, batches });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      code: 'LATEST_ERROR',
      message: 'No se pudieron obtener los últimos batches',
      detail: process.env.NODE_ENV === 'production' ? undefined : e.message
    });
  }
}
