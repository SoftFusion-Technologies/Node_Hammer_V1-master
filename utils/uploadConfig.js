/**
 * Configuración de Multer para la subida de archivos relacionados con quejas.
 * 
 * Este módulo configura Multer para almacenar archivos subidos en la carpeta './uploads/quejas',
 * generando nombres únicos para evitar conflictos y limitando el tamaño máximo del archivo a 2MB.
 * 
 * @author Sergio Manrique
 * @date 21/01/2026
 */


import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configuración genérica de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Definimos la carpeta de destino (puedes ajustarla según el tipo de archivo si quieres)
    const carpeta = './uploads/quejas';
    
    if (!fs.existsSync(carpeta)) {
      fs.mkdirSync(carpeta, { recursive: true });
    }
    cb(null, carpeta);
  },
  filename: (req, file, cb) => {
    // Nombre único para evitar conflictos
    const prefijoUnico = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + prefijoUnico + path.extname(file.originalname));
  }
});

// Exportamos el middleware configurado
export const uploadQuejas = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 } // Límite de 2MB
});