/*
  * Programador: Sergio Gustavo Manrique
  * Fecha Creación: 31 de Marzo 2026
  * Versión: 1.0
  *
  * Descripción:
  * Configuración de Multer para la carga de comprobantes de transferencia en preventas.
  * Permite archivos de imagen (JPEG, PNG, WEBP, HEIC), PDF y documentos de Word.
  * Los archivos se almacenan en 'uploads/preventas/transferencias' con nombres únicos.
  * Se valida el tipo MIME y la extensión del archivo para garantizar formatos permitidos.
*/


import fs from 'fs';
import multer from 'multer';
import path from 'path';

const PREVENTAS_UPLOAD_DIR = path.join(
  process.cwd(),
  'uploads',
  'preventas',
  'transferencias'
);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/octet-stream'
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
  '.pdf',
  '.doc',
  '.docx',
  '.odt'
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(PREVENTAS_UPLOAD_DIR)) {
      fs.mkdirSync(PREVENTAS_UPLOAD_DIR, { recursive: true });
    }
    cb(null, PREVENTAS_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const baseName = path
      .basename(file.originalname || 'comprobante', extension)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .slice(0, 80);

    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeBase = baseName || 'comprobante';
    cb(null, `${unique}-${safeBase}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const mimeType = String(file.mimetype || '').toLowerCase();

  const extensionAllowed = ALLOWED_EXTENSIONS.has(extension);
  const mimeAllowed = ALLOWED_MIME_TYPES.has(mimeType);

  if (mimeAllowed && extensionAllowed) {
    return cb(null, true);
  }

  return cb(
    new Error(
      'Formato de comprobante no permitido. Se aceptan imagenes, PDF y Word (.jpg, .png, .webp, .heic, .pdf, .doc, .docx, .odt).'
    )
  );
};

export const uploadPreventaTransferencia = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 70 * 1024 * 1024
  }
});
