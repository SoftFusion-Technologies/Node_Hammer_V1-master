import crypto from 'crypto';

/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 10 / 04 / 2026
 * Versión: 2.0
 *
 * Descripción:
 * Helper centralizado de seguridad para tarjetas del módulo
 * Débitos Automáticos.
 *
 * Centraliza:
 * - normalización de tarjeta
 * - máscara
 * - cifrado
 * - descifrado
 * - control de acceso a tarjeta completa
 * - resolución segura para exportaciones/consultas privilegiadas
 *
 * Tema: Débitos Automáticos - Seguridad de tarjeta
 * Capa: Backend / Helpers
 */

/* Benjamin Orellana - 2026/04/10 - Correos privilegiados normalizados para tolerar diferencias de mayúsculas/minúsculas. */
export const DEBITOS_FULL_ACCESS_EMAILS = new Set(
  [
    'carlosg@hammer.ar',
    'marcelog@hammer.ar',
    'benja@gmail.com', /* este es de prueba */
    'azultaborda@icloud.com'
  ].map((email) => String(email).trim().toLowerCase())
);

/* Benjamin Orellana - 2026/04/10 - Normaliza una cadena trimmeando espacios y permitiendo limitar longitud. */
const cleanStringOrNull = (value, maxLength = null) => {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim();

  if (!normalized) return null;

  if (maxLength && Number(maxLength) > 0) {
    return normalized.slice(0, Number(maxLength));
  }

  return normalized;
};

/* Benjamin Orellana - 2026/04/10 - Extrae solo dígitos desde cualquier valor para sanitizar números de tarjeta. */
const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

/* Benjamin Orellana - 2026/04/10 - Normaliza correos electrónicos para comparaciones seguras en whitelist. */
const normalizeEmail = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

/* =========================
   Helpers tarjeta / seguridad
========================= */

/* Benjamin Orellana - 2026/04/10 - Construye la máscara visual de tarjeta usando únicamente los últimos cuatro dígitos. */
export const buildMaskedCard = (digits) => {
  const rawDigits = onlyDigits(digits);

  if (!rawDigits || rawDigits.length < 4) {
    return null;
  }

  const last4 = rawDigits.slice(-4);
  return `**** **** **** ${last4}`;
};

/* Benjamin Orellana - 2026/04/10 - Cifra el número completo de tarjeta con AES-256-GCM usando la secret del módulo. */
export const encryptCardNumber = (rawDigits) => {
  const secret = process.env.DEBITOS_AUTOMATICOS_CARD_SECRET;
  const digits = onlyDigits(rawDigits);

  if (!secret) {
    throw new Error(
      'Falta la variable de entorno DEBITOS_AUTOMATICOS_CARD_SECRET para cifrar tarjetas.'
    );
  }

  if (!digits) {
    throw new Error('No se recibió un número de tarjeta válido para cifrar.');
  }

  if (digits.length < 13 || digits.length > 19) {
    throw new Error(
      'El número de tarjeta debe contener entre 13 y 19 dígitos.'
    );
  }

  const key = crypto.createHash('sha256').update(String(secret)).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(String(digits), 'utf8'),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

/* Benjamin Orellana - 2026/04/10 - Descifra un valor de tarjeta previamente cifrado con AES-256-GCM. */
export const decryptCardNumber = (encryptedValue) => {
  const secret = process.env.DEBITOS_AUTOMATICOS_CARD_SECRET;
  const payload = cleanStringOrNull(encryptedValue);

  if (!secret) {
    throw new Error(
      'Falta la variable de entorno DEBITOS_AUTOMATICOS_CARD_SECRET para descifrar tarjetas.'
    );
  }

  if (!payload) {
    return null;
  }

  const parts = payload.split(':');

  if (parts.length !== 3) {
    throw new Error('Formato inválido de tarjeta_numero_cifrado.');
  }

  const [ivB64, tagB64, encryptedB64] = parts;

  const key = crypto.createHash('sha256').update(String(secret)).digest();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]).toString('utf8');

  const digits = onlyDigits(decrypted);

  if (!digits || digits.length < 13 || digits.length > 19) {
    throw new Error('El descifrado de tarjeta produjo un valor inválido.');
  }

  return digits;
};

// Benjamin Orellana - 2026/04/13 - Intenta descifrar tarjeta sin romper el flujo del endpoint; devuelve null si falla.
export const safeDecryptCardNumber = (encryptedValue) => {
  try {
    return decryptCardNumber(encryptedValue);
  } catch (error) {
    console.error(
      '[DebitosAutomaticos][safeDecryptCardNumber] No se pudo descifrar tarjeta:',
      error.message
    );
    return null;
  }
};

// Benjamin Orellana - 2026/04/13 - Extrae el email autenticado desde req.user o headers explícitos enviados por frontend.
export const getRequestUserEmail = (req = {}) => {
  return normalizeEmail(
    req?.user?.email ||
      req?.usuario?.email ||
      req?.auth?.email ||
      req?.session?.user?.email ||
      req?.headers?.['x-auth-user-email'] ||
      req?.headers?.['x-user-email'] ||
      req?.query?.auth_user_email ||
      req?.body?.auth_user_email ||
      ''
  );
};

/* Benjamin Orellana - 2026/04/10 - Determina si un request o email tiene permiso para ver/exportar tarjeta completa. */
export const hasDebitosFullAccess = (reqOrEmail = null) => {
  const email =
    typeof reqOrEmail === 'string'
      ? normalizeEmail(reqOrEmail)
      : getRequestUserEmail(reqOrEmail);

  if (!email) return false;

  return DEBITOS_FULL_ACCESS_EMAILS.has(email);
};

/* Benjamin Orellana - 2026/04/10 - Normaliza el snapshot persistible de tarjeta cuando llega número plano o campos ya cifrados. */
export const resolveCardData = (body = {}) => {
  const rawDigits = onlyDigits(body.tarjeta_numero);

  if (rawDigits) {
    if (rawDigits.length < 13 || rawDigits.length > 19) {
      return {
        ok: false,
        message: 'tarjeta_numero debe contener entre 13 y 19 dígitos.'
      };
    }

    return {
      ok: true,
      tarjeta_numero_cifrado: encryptCardNumber(rawDigits),
      tarjeta_ultimos4: rawDigits.slice(-4),
      tarjeta_mascara: buildMaskedCard(rawDigits)
    };
  }

  const tarjeta_numero_cifrado = cleanStringOrNull(body.tarjeta_numero_cifrado);
  const tarjeta_ultimos4_raw = onlyDigits(body.tarjeta_ultimos4);
  const tarjeta_ultimos4 = tarjeta_ultimos4_raw
    ? tarjeta_ultimos4_raw.slice(-4)
    : null;
  const tarjeta_mascara = cleanStringOrNull(body.tarjeta_mascara, 30);

  if (tarjeta_numero_cifrado) {
    if (
      !tarjeta_ultimos4 ||
      tarjeta_ultimos4.length !== 4 ||
      !tarjeta_mascara
    ) {
      return {
        ok: false,
        message:
          'Si envías tarjeta_numero_cifrado, también debes enviar tarjeta_ultimos4 y tarjeta_mascara válidos.'
      };
    }

    return {
      ok: true,
      tarjeta_numero_cifrado,
      tarjeta_ultimos4,
      tarjeta_mascara
    };
  }

  return {
    ok: false,
    message:
      'Debes enviar tarjeta_numero para cifrar en backend o tarjeta_numero_cifrado con sus metadatos.'
  };
};

/* Benjamin Orellana - 2026/04/10 - Resuelve el origen de tarjeta desde cliente y, si no existe, desde solicitud como fallback legado. */
export const getCardSourceSnapshot = ({
  cliente = null,
  solicitud = null
} = {}) => {
  const tarjeta_numero_cifrado =
    cleanStringOrNull(cliente?.tarjeta_numero_cifrado) ||
    cleanStringOrNull(solicitud?.tarjeta_numero_cifrado) ||
    null;

  const tarjeta_ultimos4 =
    cleanStringOrNull(cliente?.tarjeta_ultimos4, 4) ||
    cleanStringOrNull(solicitud?.tarjeta_ultimos4, 4) ||
    null;

  const tarjeta_mascara =
    cleanStringOrNull(cliente?.tarjeta_mascara, 30) ||
    cleanStringOrNull(solicitud?.tarjeta_mascara, 30) ||
    null;

  return {
    tarjeta_numero_cifrado,
    tarjeta_ultimos4,
    tarjeta_mascara
  };
};

// Benjamin Orellana - 2026/04/13 - Devuelve la tarjeta completa solo cuando el usuario está autorizado; si falla el descifrado, cae a máscara.
export const resolveVisibleCardNumber = ({
  req = null,
  cliente = null,
  solicitud = null,
  forceFullAccess = false
} = {}) => {
  const {
    tarjeta_numero_cifrado,
    tarjeta_mascara
  } = getCardSourceSnapshot({ cliente, solicitud });

  const canSeeFull = forceFullAccess || hasDebitosFullAccess(req);

  if (canSeeFull && tarjeta_numero_cifrado) {
    const fullCard = safeDecryptCardNumber(tarjeta_numero_cifrado);
    if (fullCard) return fullCard;
  }

  return tarjeta_mascara || null;
};

// Benjamin Orellana - 2026/04/13 - Devuelve metadatos de tarjeta listos para responses seguras o exportaciones privilegiadas sin romper si falla el descifrado.
export const resolveCardPresentation = ({
  req = null,
  cliente = null,
  solicitud = null,
  forceFullAccess = false
} = {}) => {
  const {
    tarjeta_numero_cifrado,
    tarjeta_ultimos4,
    tarjeta_mascara
  } = getCardSourceSnapshot({ cliente, solicitud });

  const canSeeFull = forceFullAccess || hasDebitosFullAccess(req);

  let tarjeta_numero_completo = null;

  if (canSeeFull && tarjeta_numero_cifrado) {
    tarjeta_numero_completo = safeDecryptCardNumber(tarjeta_numero_cifrado);
  }

  return {
    can_view_full_card: Boolean(canSeeFull),
    tarjeta_numero_completo,
    tarjeta_ultimos4: tarjeta_ultimos4 || null,
    tarjeta_mascara: tarjeta_mascara || null
  };
};
