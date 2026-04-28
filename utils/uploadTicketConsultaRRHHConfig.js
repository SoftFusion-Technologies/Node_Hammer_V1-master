/*
 * Descripción:
 * Configuración de Multer para la carga de archivos adjuntos en tickets de consultas de RRHH.
 * Los archivos se almacenan en 'uploads/ticket_consultas_rrhh' con nombres únicos.
 * Se valida el tipo MIME y la extensión del archivo para garantizar formatos permitidos.
*/

import fs from 'fs';
import multer from 'multer';
import path from 'path';

// 1. Definimos la ruta exacta de destino
const RRHH_TICKETS_UPLOAD_DIR = path.join(
  process.cwd(),
  'uploads',
  'ticket_consultas_rrhh'
);

// 2. Definimos los tipos MIME y extensiones permitidas
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

// 3. Configuramos el motor de almacenamiento (Storage)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Si la carpeta no existe, la creamos automáticamente
    if (!fs.existsSync(RRHH_TICKETS_UPLOAD_DIR)) {
      fs.mkdirSync(RRHH_TICKETS_UPLOAD_DIR, { recursive: true });
    }
    cb(null, RRHH_TICKETS_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const baseName = path
      .basename(file.originalname || 'ticket_rrhh', extension)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .slice(0, 80);

    // Generamos un nombre único para evitar que se sobrescriban archivos
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeBase = baseName || 'ticket_rrhh';
    cb(null, `${unique}-${safeBase}${extension}`);
  }
});

// 4. Configuramos el filtro para rechazar archivos no permitidos
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
      'Formato de archivo no permitido. Se aceptan imágenes, PDF y Word (.jpg, .png, .webp, .heic, .pdf, .doc, .docx, .odt).'
    )
  );
};

// 5. Función auxiliar para eliminar archivos físicos
export const eliminarArchivoRRHH = (rutaRelativa) => {
  if (!rutaRelativa) return;
  const rutaAbsoluta = path.join(process.cwd(), rutaRelativa);
  if (fs.existsSync(rutaAbsoluta)) {
    fs.unlinkSync(rutaAbsoluta);
  }
};

// 6. Exportamos la instancia configurada de Multer
export const uploadTicketConsultasRRHH = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 70 * 1024 * 1024
  }
});