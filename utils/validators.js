// validators.js

/**
 * Normaliza y valida datos provenientes de importación masiva de integrantes de convenios (Excel/CSV)
 * para la tabla `integrantes_conve`.
 *
 * REGLA DE NEGOCIO:
 * - El ÚNICO campo obligatorio para considerar una fila "válida" es `nombre`.
 * - El resto de campos pueden venir null/vacío y se completan con defaults
 *   cortos (ej: telefono = "No informado") o se dejan en null.
 *
 * OBJETIVO:
 * - Evitar que se descarten filas por campos opcionales vacíos.
 * - Evitar valores largos/ruidosos en DB: se truncan a los tamaños máximos de la tabla.
 * - Normalizar números (precio/descuento/preciofinal) y fechaCreacion.
 *
 * @param {Array<Object>} data Filas leídas del archivo (por ejemplo `sheet`).
 * @param {Object} [opts]
 * @param {boolean} [opts.debug=false] Si true, loguea info de depuración.
 * @returns {Array<Object>} Lista de filas listas para insertar (solo exige `nombre`).
 * @throws {Error} Si `data` no es un array.
 */
export function validateData(data, opts = {}) {
  const { debug = false } = opts;

  if (!Array.isArray(data)) {
    throw new Error('Data must be an array');
  }

  if (debug) {
    console.log('Datos recibidos para validación (cantidad):', data.length);
  }

  return (
    data
      .map((row, index) => normalizeRow(row, index, debug))
      // Se consideran válidas únicamente las filas con `nombre` no vacío.
      .filter((row) => Boolean(row.nombre))
  );
}

/**
 * Normaliza una fila individual:
 * - nombre: obligatorio (trim + truncado)
 * - telefono: default "No informado" si viene vacío
 * - dni/email/sede/notas/userName: null si vienen vacíos (o truncados si vienen)
 * - precio/descuento/preciofinal: number (0 por default), tolerante a formato AR
 * - fechaCreacion: Date válida (por default "ahora"); soporta serial Excel (opcional)
 */
function normalizeRow(item, index, debug) {
  const src = item && typeof item === 'object' ? item : {};

  // Si la fila está completamente vacía (típico final de Excel), la dejamos “vacía”
  // y luego caerá por el filter (nombre requerido).
  const nombre = normStr(src.nombre, 55);

  const normalized = {
    ...src,

    // Obligatorio
    nombre,

    // Opcionales con defaults cortos (sin ocupar demasiado espacio)
    telefono: normStr(src.telefono, 20) || 'No informado',

    // Opcionales: preferimos NULL antes que strings largas o rellenos innecesarios
    dni: normNullableStr(src.dni, 100) || 'No informado',
    email: normNullableStr(src.email, 50) || 'No informado',
    sede: normNullableStr(src.sede, 50),
    notas: normNullableStr(src.notas, 255),
    userName: normNullableStr(src.userName, 155),

    // Valores numéricos normalizados (si llega "1.234,56" lo convierte bien)
    precio: parseNumberLoose(src.precio),
    descuento: parseNumberLoose(src.descuento),
    preciofinal: parseNumberLoose(src.preciofinal),

    // Fecha: si viene vacía o inválida => ahora
    fechaCreacion: parseDateLoose(src.fechaCreacion)
  };

  if (debug) {
    const ok = Boolean(normalized.nombre);
    console.log(
      `[validateData] Row #${index + 1} => ${ok ? 'OK' : 'SKIP'} (nombre="${
        normalized.nombre || ''
      }")`
    );
  }

  return normalized;
}

/**
 * Normaliza string requerido:
 * - trim
 * - colapsa espacios múltiples
 * - trunca a maxLen
 * - si queda vacío => "" (para que el filter lo descarte)
 */
function normStr(value, maxLen) {
  if (value === null || value === undefined) return '';
  const s = String(value).replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/**
 * Normaliza string opcional:
 * - si está vacío => null
 * - si tiene contenido => trim + truncado
 */
function normNullableStr(value, maxLen) {
  const s = normStr(value, maxLen);
  return s ? s : null;
}

/**
 * Parseo de números tolerante a entradas típicas de Excel/usuarios:
 * - Acepta number directo
 * - Acepta "1234.56", "1,234.56", "1.234,56", "$ 1.234,56", etc.
 * - Si no se puede parsear => 0
 */
function parseNumberLoose(value) {
  if (value === null || value === undefined || value === '') return 0;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  let s = String(value).trim();
  if (!s) return 0;

  // Limpieza básica: remove currency/espacios
  s = s.replace(/\$/g, '').replace(/\s/g, '');

  // Caso AR típico: miles con "." y decimales con ","
  // Si tiene "," asumimos decimal = "," => reemplazar "." (miles) y cambiar "," por "."
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Si no tiene coma, puede venir "1,234.56" (US miles con coma)
    // En ese caso quitamos comas como separador de miles.
    // (Si viniera "1234.56" no afecta)
    s = s.replace(/,/g, '');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parseo de fechas tolerante:
 * - Date => se valida
 * - string => new Date(string)
 * - number => puede ser epoch ms o serial Excel.
 *
 * Heurística Excel:
 * - si el número es “chico” y parece cantidad de días (ej 45000), lo tratamos como serial.
 *   Excel (sistema 1900) suele mapear: 1 = 1900-01-01 (con offset conocido).
 */
function parseDateLoose(value) {
  // Default: ahora
  const now = new Date();

  if (value === null || value === undefined || value === '') return now;

  // Ya es Date
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? now : value;
  }

  // Serial Excel probable (días)
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Si parece epoch en ms (muy grande), usar directo.
    if (value > 10_000_000_000) {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? now : d;
    }

    // Si parece serial Excel (rango razonable de días)
    if (value > 20_000 && value < 80_000) {
      // Excel 1900 date system: day 0 ~ 1899-12-30
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(excelEpoch.getTime() + value * 86400000);
      return Number.isNaN(d.getTime()) ? now : d;
    }

    // Si no calza, intentar como ms igual
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? now : d;
  }

  // String u otros => intentar parse
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? now : d;
}
