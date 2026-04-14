/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 30 / 03 / 2026
 * Versión: 1.1
 *
 * Descripción:
 * Service para enviar emails automáticos del módulo de Débitos Automáticos
 * al titular y al adicional, con auditoría de resultado y soporte por evento.
 *
 * Tema: Débitos Automáticos - Envío Email
 * Capa: Backend
 */

import MD_TB_DebitosAutomaticosEnviosEmail from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosEnviosEmail.js';
import { sendMail } from '../Shared/MailService.js';
import {
  buildSolicitudEventSubject,
  buildSolicitudEventTitularEmail,
  buildSolicitudRecibidaAdicionalEmail
} from '../../Templates/DebitosAutomaticos/debitoSolicitudEmailTemplate.js';

const DebitosAutomaticosEnviosEmailModel =
  MD_TB_DebitosAutomaticosEnviosEmail.DebitosAutomaticosEnviosEmailModel;

const normalizeEmail = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const safePlain = (value) => {
  if (!value) return null;
  return typeof value?.toJSON === 'function' ? value.toJSON() : { ...value };
};

const createAudit = async ({
  solicitud,
  adicional,
  destinatario_tipo,
  email_destino,
  evento,
  asunto
}) => {
  return DebitosAutomaticosEnviosEmailModel.create({
    solicitud_id: solicitud.id,
    solicitud_adicional_id:
      destinatario_tipo === 'ADICIONAL' ? adicional?.id || null : null,
    destinatario_tipo,
    email_destino,
    evento,
    estado: 'PENDIENTE',
    asunto,
    intentos: 0
  });
};

// Benjamin Orellana - 2026/04/13 - Se adjunta el PDF dinámico de la carta al email del titular cuando está disponible.
const sendToTitular = async ({
  solicitud,
  adicional,
  evento,
  asunto,
  cartaDocumentoUrl = null,
  cartaPdfAdjunto = null
}) => {
  const email = normalizeEmail(solicitud?.titular_email);
  if (!email) return null;

  const auditoria = await createAudit({
    solicitud,
    adicional,
    destinatario_tipo: 'TITULAR',
    email_destino: email,
    evento,
    asunto
  });

  try {
    const bodies = buildSolicitudEventTitularEmail({
      solicitud,
      adicional,
      evento,
      cartaDocumentoUrl
    });

    const mailResult = await sendMail({
      to: email,
      subject: asunto,
      html: bodies.html,
      text: bodies.text,
      attachments: cartaPdfAdjunto ? [cartaPdfAdjunto] : []
    });

    await auditoria.update({
      estado: 'ENVIADO',
      intentos: 1,
      message_id: mailResult?.messageId || null,
      enviado_at: new Date(),
      error_texto: null
    });

    return {
      ok: true,
      email,
      messageId: mailResult?.messageId || null
    };
  } catch (error) {
    await auditoria.update({
      estado: 'ERROR',
      intentos: 1,
      error_texto: error.message || 'Error al enviar email al titular'
    });

    return {
      ok: false,
      email,
      mensajeError: error.message || 'Error al enviar email al titular'
    };
  }
};

const sendToAdicional = async ({ solicitud, adicional, evento, asunto }) => {
  const email = normalizeEmail(adicional?.email);
  if (!adicional || !email) return null;

  const auditoria = await createAudit({
    solicitud,
    adicional,
    destinatario_tipo: 'ADICIONAL',
    email_destino: email,
    evento,
    asunto
  });

  try {
    const bodies = buildSolicitudRecibidaAdicionalEmail({
      solicitud,
      adicional,
      evento
    });

    const mailResult = await sendMail({
      to: email,
      subject: asunto,
      html: bodies.html,
      text: bodies.text
    });

    await auditoria.update({
      estado: 'ENVIADO',
      intentos: 1,
      message_id: mailResult?.messageId || null,
      enviado_at: new Date(),
      error_texto: null
    });

    return {
      ok: true,
      email,
      messageId: mailResult?.messageId || null
    };
  } catch (error) {
    await auditoria.update({
      estado: 'ERROR',
      intentos: 1,
      error_texto: error.message || 'Error al enviar email al adicional'
    });

    return {
      ok: false,
      email,
      mensajeError: error.message || 'Error al enviar email al adicional'
    };
  }
};

// Benjamin Orellana - 2026/04/13 - El service recibe URL dinámica y adjunto PDF de carta para el email del titular.
export const enviarEmailSolicitudDebito = async ({
  solicitud,
  adicional = null,
  evento = 'SOLICITUD_RECIBIDA',
  cartaDocumentoUrl = null,
  cartaPdfAdjunto = null
}) => {
  const solicitudPlain = safePlain(solicitud);
  const adicionalPlain = safePlain(adicional);

  if (!solicitudPlain?.id) {
    throw new Error('Solicitud inválida para enviar email.');
  }

  const asunto = buildSolicitudEventSubject({
    solicitud: solicitudPlain,
    evento
  });

  const [titularResult, adicionalResult] = await Promise.allSettled([
    sendToTitular({
      solicitud: solicitudPlain,
      adicional: adicionalPlain,
      evento,
      asunto,
      cartaDocumentoUrl,
      cartaPdfAdjunto
    }),
    sendToAdicional({
      solicitud: solicitudPlain,
      adicional: adicionalPlain,
      evento,
      asunto
    })
  ]);

  return {
    evento,
    titular:
      titularResult.status === 'fulfilled'
        ? titularResult.value
        : {
            ok: false,
            email: normalizeEmail(solicitudPlain?.titular_email),
            mensajeError:
              titularResult.reason?.message ||
              'Error no controlado al enviar email al titular'
          },
    adicional:
      adicionalResult.status === 'fulfilled'
        ? adicionalResult.value
        : {
            ok: false,
            email: normalizeEmail(adicionalPlain?.email),
            mensajeError:
              adicionalResult.reason?.message ||
              'Error no controlado al enviar email al adicional'
          }
  };
};
