/* Benjamin Orellana - 2026/04/21 - Servicio aislado para enviar mails de confirmación de visitas y clases públicas sin afectar el flujo de Débitos Automáticos. */

import nodemailer from 'nodemailer';
import { buildConfirmacionProspectoEmailTemplate } from '../../Templates/VentasProspectos/confirmacionProspectoEmailTemplate.js';

let transporterCache = null;

const getProspectosMailConfig = () => {
  const enabled =
    String(process.env.MAIL_PROSPECTOS_ENABLED || 'false').toLowerCase() ===
    'true';

  return {
    enabled,
    host: process.env.MAIL_PROSPECTOS_HOST,
    port: Number(process.env.MAIL_PROSPECTOS_PORT || 465),
    secure:
      String(process.env.MAIL_PROSPECTOS_SECURE || 'true').toLowerCase() ===
      'true',
    requireAuth:
      String(
        process.env.MAIL_PROSPECTOS_REQUIRE_AUTH || 'true'
      ).toLowerCase() === 'true',
    forceIPv4:
      String(
        process.env.MAIL_PROSPECTOS_FORCE_IPV4 || 'false'
      ).toLowerCase() === 'true',
    tlsRejectUnauthorized:
      String(
        process.env.MAIL_PROSPECTOS_TLS_REJECT_UNAUTHORIZED || 'true'
      ).toLowerCase() === 'true',
    user: process.env.MAIL_PROSPECTOS_USER,
    pass: process.env.MAIL_PROSPECTOS_PASS,
    fromName: process.env.MAIL_PROSPECTOS_FROM_NAME || 'HammerX',
    fromAddress: process.env.MAIL_PROSPECTOS_FROM_ADDRESS,
    replyTo: process.env.MAIL_PROSPECTOS_REPLY_TO || null
  };
};

const getTransporter = () => {
  if (transporterCache) return transporterCache;

  const config = getProspectosMailConfig();

  if (!config.host) {
    throw new Error(
      'MAIL_PROSPECTOS_HOST no está configurado para el envío de confirmaciones.'
    );
  }

  const transportOptions = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    tls: {
      rejectUnauthorized: config.tlsRejectUnauthorized
    }
  };

  if (config.requireAuth) {
    transportOptions.auth = {
      user: config.user,
      pass: config.pass
    };
  }

  if (config.forceIPv4) {
    transportOptions.family = 4;
  }

  transporterCache = nodemailer.createTransport(transportOptions);

  return transporterCache;
};

export const enviarConfirmacionProspectoEmail = async ({
  to,
  nombreCompleto,
  tipoLink,
  actividad,
  sede,
  fechaTexto,
  horaTexto,
  profesorNombre = ''
}) => {
  const config = getProspectosMailConfig();

  if (!config.enabled) {
    return {
      sent: false,
      skipped: true,
      reason: 'MAIL_PROSPECTOS_ENABLED=false'
    };
  }

  if (!to) {
    return {
      sent: false,
      skipped: true,
      reason: 'DESTINATARIO_VACIO'
    };
  }

  const transporter = getTransporter();

  const { subject, html, text } = buildConfirmacionProspectoEmailTemplate({
    nombreCompleto,
    tipoLink,
    actividad,
    sede,
    fechaTexto,
    horaTexto,
    profesorNombre
  });

  const info = await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromAddress}>`,
    to,
    replyTo: config.replyTo || undefined,
    subject,
    html,
    text
  });

  return {
    sent: true,
    skipped: false,
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || []
  };
};

export default enviarConfirmacionProspectoEmail;
