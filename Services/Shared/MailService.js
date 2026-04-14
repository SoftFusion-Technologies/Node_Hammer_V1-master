import nodemailer from 'nodemailer';
import dns from 'node:dns/promises';

let mailTransporterCache = null;

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'si'].includes(normalized);
};

export const getMailConfig = () => {
  const host = String(process.env.MAIL_HOST || '').trim();
  const port = Number(process.env.MAIL_PORT || 587);
  const secure = toBool(process.env.MAIL_SECURE, port === 465);

  const user = String(process.env.MAIL_USER || '').trim();
  const pass = String(process.env.MAIL_PASS || '').trim();

  const fromName = String(process.env.MAIL_FROM_NAME || '').trim();
  const fromAddress = String(
    process.env.MAIL_FROM_ADDRESS ||
      process.env.MAIL_FROM ||
      process.env.MAIL_USER ||
      ''
  ).trim();

  const from =
    fromName && fromAddress
      ? `"${fromName}" <${fromAddress}>`
      : fromAddress || '';

  const replyTo =
    String(process.env.MAIL_REPLY_TO || fromAddress || '').trim() || null;

  const requireAuth = toBool(process.env.MAIL_REQUIRE_AUTH, !!user);
  const forceIPv4 = toBool(process.env.MAIL_FORCE_IPV4, true);

  // Benjamin Orellana - 28-03-2026 - Permite desactivar validación TLS para servidores SMTP cuyo issuer no está disponible localmente.
  const allowInvalidCert =
    toBool(process.env.MAIL_TLS_REJECT_UNAUTHORIZED, true) === false;

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
    fromAddress,
    replyTo,
    requireAuth,
    forceIPv4,
    allowInvalidCert
  };
};

export const getMailTransporter = async () => {
  if (mailTransporterCache) return mailTransporterCache;

  const cfg = getMailConfig();

  if (!cfg.host) {
    throw new Error('MAIL_HOST no configurado.');
  }

  if (!cfg.fromAddress) {
    throw new Error('MAIL_FROM_ADDRESS/MAIL_FROM/MAIL_USER no configurado.');
  }

  if (cfg.requireAuth && !cfg.user) {
    throw new Error('MAIL_USER no configurado. SMTP requiere autenticación.');
  }

  if (cfg.requireAuth && !cfg.pass) {
    throw new Error('MAIL_PASS no configurado. SMTP requiere autenticación.');
  }

  let smtpHostForConnect = cfg.host;
  let tlsOptions = {};

  if (cfg.forceIPv4) {
    const resolved = await dns.lookup(cfg.host, { family: 4 });
    smtpHostForConnect = resolved.address;

    // importante: mantenemos el hostname real para SNI/validación TLS
    tlsOptions.servername = cfg.host;
  }

  if (cfg.allowInvalidCert) {
    tlsOptions.rejectUnauthorized = false;
  }

  mailTransporterCache = nodemailer.createTransport({
    host: smtpHostForConnect,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.requireAuth
      ? {
          user: cfg.user,
          pass: cfg.pass
        }
      : undefined,
    tls: tlsOptions
  });

  return mailTransporterCache;
};

export const verifyMailTransporter = async () => {
  const transporter = await getMailTransporter();
  await transporter.verify();
  return { ok: true };
};

// Benjamin Orellana - 2026/04/13 - Se corrige sendMail para obtener el transporter real y soportar adjuntos PDF.
export const sendMail = async ({
  to,
  subject,
  html,
  text,
  attachments = []
}) => {
  const transporter = await getMailTransporter();
  const cfg = getMailConfig();

  return transporter.sendMail({
    from: cfg.from,
    replyTo: cfg.replyTo || undefined,
    to,
    subject,
    html,
    text,
    attachments
  });
};