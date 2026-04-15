/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 12 / 03 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Controladores de negocio para la tabla 'debitos_automaticos_solicitudes'.
 * Incluye flujo público e interno, validaciones, snapshot de beneficios,
 * manejo de persona adicional, transiciones de estado y baja lógica.
 *
 * Tema: Controladores - Débitos Automáticos Solicitudes
 * Capa: Backend
 *
 * Nomenclatura: OBR_  obtenerRegistro
 *              OBRS_ obtenerRegistros(plural)
 *              CR_   crearRegistro
 *              ER_   eliminarRegistro
 *              UR_   updateRegistro
 */

import crypto from 'crypto';
import { Op } from 'sequelize';
import db from '../../DataBase/db.js';

import DebitosAutomaticosSolicitudesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosSolicitudes.js';
import DebitosAutomaticosSolicitudesAdicionalesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosSolicitudesAdicionales.js';
import DebitosAutomaticosBancosModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosBancos.js';
import DebitosAutomaticosPlanesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPlanes.js';
import DebitosAutomaticosTerminosModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosTerminos.js';

import DebitosAutomaticosClientesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosClientes.js';
import DebitosAutomaticosClientesAdicionalesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosClientesAdicionales.js';
import DebitosAutomaticosPeriodosModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPeriodos.js';
import { SedeModel } from '../../Models/MD_TB_sedes.js';

// Benjamin Orellana - 23/03/2026 - Se importa modelo de usuarios para resolver el usuario autenticado cuando req.user no viene poblado
import UsersModel from '../../Models/MD_TB_Users.js';

import DebitosAutomaticosPlanesSedesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPlanesSedes.js';
// Benjamin Orellana - 30/03/2026 - Service de envío automático de emails para solicitudes de débito automático.
import { enviarEmailSolicitudDebito } from '../../Services/DebitosAutomaticos/EnviarSolicitudDebitoEmailService.js';

// Benjamin Orellana - 2026/04/10 - Helpers centralizados de seguridad para permisos y presentación segura de tarjeta.
import {
  hasDebitosFullAccess,
  resolveCardPresentation
} from '../../Helpers/DebitosAutomaticos/cardSecurity.js';

import {
  obtenerTerminoVigente,
  generarCartaPdfBuffer
} from '../../Services/DebitosAutomaticos/TerminosPdfService.js';

/* =========================
   Constantes
========================= */
const ESTADOS = {
  PENDIENTE: 'PENDIENTE',
  APROBADA: 'APROBADA',
  RECHAZADA: 'RECHAZADA',
  OBSERVADA: 'OBSERVADA',
  CANCELADA: 'CANCELADA'
};

const CANALES = {
  PUBLICO: 'PUBLICO',
  INTERNO: 'INTERNO'
};

const ROLES_CARGA = [
  'CLIENTE',
  'RECEPCION',
  'VENDEDOR',
  'COORDINADOR',
  'ADMIN'
];
const MARCAS_TARJETA = ['VISA', 'MASTER'];
const MODALIDADES = ['TITULAR_SOLO', 'AMBOS', 'SOLO_ADICIONAL'];

const SOLICITUD_EXCLUDE_ATTRIBUTES = ['tarjeta_numero_cifrado'];

/* =========================
   Helpers base
========================= */
const toIntOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
};

const toFlagOrUndefined = (v) => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;

  const s = String(v).trim().toLowerCase();

  if (
    v === 1 ||
    v === true ||
    s === '1' ||
    s === 'true' ||
    s === 'si' ||
    s === 'sí'
  ) {
    return 1;
  }

  if (v === 0 || v === false || s === '0' || s === 'false' || s === 'no') {
    return 0;
  }

  return null;
};

const cleanStringOrNull = (v, max = null) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (max && s.length > max) return s.slice(0, max);
  return s;
};

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

// Benjamin Orellana - 30/03/2026 - Helper para habilitar o deshabilitar el envío de emails por variable de entorno.
const isMailEnabled = () => {
  const raw = String(process.env.MAIL_ENABLED ?? 'true')
    .trim()
    .toLowerCase();

  return ['1', 'true', 'yes', 'y', 'si', 'sí'].includes(raw);
};

// Benjamin Orellana - 30/03/2026 - Construye un contexto mínimo para email si la recarga del detalle falla luego del commit.
const buildSolicitudEmailFallbackContext = ({
  creado,
  adicionalCreado = null
}) => {
  const solicitudFallback =
    typeof creado?.toJSON === 'function'
      ? creado.toJSON()
      : { ...(creado || {}) };

  const adicionalFallback = adicionalCreado
    ? typeof adicionalCreado?.toJSON === 'function'
      ? adicionalCreado.toJSON()
      : { ...(adicionalCreado || {}) }
    : null;

  return {
    solicitud: solicitudFallback,
    adicional: adicionalFallback
  };
};

// Benjamin Orellana - 30/03/2026 - Obtiene el adicional desde distintas formas posibles del detalle ya expandido.
const resolveSolicitudAdicionalFromDetalle = (detalle) => {
  if (!detalle) return null;

  return (
    detalle?.adicional ||
    detalle?.solicitud_adicional ||
    (Array.isArray(detalle?.adicionales) ? detalle.adicionales[0] : null) ||
    null
  );
};

// Benjamin Orellana - 2026/04/13 - Envía emails soportando URL dinámica y adjunto PDF de la carta sin romper el flujo principal.
const safeEnviarEmailsSolicitudDebito = async ({
  solicitud,
  adicional = null,
  evento = 'SOLICITUD_RECIBIDA',
  cartaDocumentoUrl = null,
  cartaPdfAdjunto = null
}) => {
  if (!isMailEnabled()) {
    return {
      enabled: false,
      evento,
      titular: null,
      adicional: null
    };
  }

  try {
    const resultado = await enviarEmailSolicitudDebito({
      solicitud,
      adicional,
      evento,
      cartaDocumentoUrl,
      cartaPdfAdjunto
    });

    return {
      enabled: true,
      evento,
      ...resultado
    };
  } catch (error) {
    return {
      enabled: true,
      evento,
      titular: null,
      adicional: null,
      mensajeError: error.message || 'Error al enviar emails de la solicitud'
    };
  }
};

// Benjamin Orellana - 30/03/2026 - Ejecuta tareas post-response para no bloquear la respuesta HTTP mientras se envían emails.
const runDetachedAsync = (label, task) => {
  setImmediate(async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[DebitosAutomaticosSolicitudes][${label}]`, error);
    }
  });
};

/* Benjamin Orellana - 2026/04/13 - Construye la URL pública dinámica de la carta PDF asociada a una solicitud. */
const buildSolicitudCartaPdfUrl = (solicitudId) => {
  const baseUrl = String(process.env.APP_PUBLIC_URL || '')
    .trim()
    .replace(/\/+$/, '');

  if (!baseUrl || !solicitudId) return null;

  return `${baseUrl}/debitos-automaticos/solicitudes/${solicitudId}/carta-pdf`;
};

// Benjamin Orellana - 2026/04/13 - Programa el envío de emails en segundo plano resolviendo URL dinámica y adjunto PDF de la carta.
const scheduleSolicitudEmailDispatch = ({
  solicitudId,
  evento,
  detalle = null,
  creado = null,
  adicionalCreado = null
}) => {
  if (!isMailEnabled()) {
    return {
      enabled: false,
      scheduled: false,
      evento
    };
  }

  runDetachedAsync(`email-${evento}-${solicitudId}`, async () => {
    let solicitudForEmail = detalle || creado || null;
    let adicionalForEmail =
      resolveSolicitudAdicionalFromDetalle(detalle) || adicionalCreado || null;

    if (!solicitudForEmail && creado) {
      const fallback = buildSolicitudEmailFallbackContext({
        creado,
        adicionalCreado
      });
      solicitudForEmail = fallback.solicitud;
      adicionalForEmail = adicionalForEmail || fallback.adicional;
    }

    if (
      (!detalle || !solicitudForEmail?.termino_html_snapshot) &&
      solicitudId
    ) {
      try {
        const detalleFresh = await getSolicitudDetalleById(solicitudId);

        if (detalleFresh) {
          solicitudForEmail =
            typeof detalleFresh?.get === 'function'
              ? detalleFresh.get({ plain: true })
              : detalleFresh;

          adicionalForEmail =
            resolveSolicitudAdicionalFromDetalle(detalleFresh) ||
            adicionalForEmail ||
            null;
        }
      } catch (error) {
        console.warn(
          `[DebitosAutomaticosSolicitudes][email-${evento}-${solicitudId}] No se pudo recargar detalle para email:`,
          error.message
        );
      }
    } else if (solicitudForEmail && typeof solicitudForEmail?.get === 'function') {
      solicitudForEmail = solicitudForEmail.get({ plain: true });
    }

    if (!solicitudForEmail) {
      throw new Error(
        `No se pudo resolver el contexto de email para la solicitud ${solicitudId}.`
      );
    }

    // Benjamin Orellana - 2026/04/13 - Se genera la URL pública dinámica de la carta PDF para incluirla en el email.
    const cartaDocumentoUrl = buildSolicitudCartaPdfUrl(
      solicitudForEmail?.id || solicitudId
    );

    // Benjamin Orellana - 2026/04/13 - Se genera el PDF adjunto desde el snapshot legal congelado en la solicitud.
    let cartaPdfAdjunto = null;

    try {
      const terminoForPdf =
        solicitudForEmail?.termino_html_snapshot ||
        solicitudForEmail?.termino_version
          ? {
              id: solicitudForEmail?.termino_id || null,
              version: solicitudForEmail?.termino_version || null,
              titulo:
                solicitudForEmail?.termino_titulo ||
                'Términos y Condiciones',
              contenido_html:
                solicitudForEmail?.termino_html_snapshot || null
            }
          : await obtenerTerminoVigente();

      if (terminoForPdf?.contenido_html) {
        const pdfBufferRaw = await generarCartaPdfBuffer({
          solicitud: solicitudForEmail,
          termino: terminoForPdf
        });

        const pdfBuffer = Buffer.isBuffer(pdfBufferRaw)
          ? pdfBufferRaw
          : Buffer.from(pdfBufferRaw);

        cartaPdfAdjunto = {
          filename: `carta-aceptacion-debito-automatico-solicitud-${solicitudForEmail.id}.pdf`,
          content: pdfBuffer.toString('base64'),
          encoding: 'base64',
          contentType: 'application/pdf',
          contentDisposition: 'attachment'
        };

        console.log(
          '[DebitosAutomaticosSolicitudes][scheduleSolicitudEmailDispatch] adjunto PDF generado',
          {
            solicitudId: solicitudForEmail.id,
            bytes: pdfBuffer.length,
            filename: cartaPdfAdjunto.filename
          }
        );
      }
    } catch (error) {
      console.warn(
        `[DebitosAutomaticosSolicitudes][email-${evento}-${solicitudId}] No se pudo generar adjunto PDF:`,
        error.message
      );
    }

    await safeEnviarEmailsSolicitudDebito({
      solicitud: solicitudForEmail,
      adicional: adicionalForEmail,
      evento,
      cartaDocumentoUrl,
      cartaPdfAdjunto
    });
  });

  return {
    enabled: true,
    scheduled: true,
    evento
  };
};

const buildVigenciaWhere = (now = new Date()) => ({
  [Op.and]: [
    {
      [Op.or]: [
        { publicado_desde: null },
        { publicado_desde: { [Op.lte]: now } }
      ]
    },
    {
      [Op.or]: [
        { publicado_hasta: null },
        { publicado_hasta: { [Op.gte]: now } }
      ]
    }
  ]
});

const getClientIp = (req) => {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || null;
};

const getActorUserId = (req) => {
  return (
    req?.user?.id ||
    req?.auth?.id ||
    toIntOrNull(req?.body?.revisado_por) ||
    toIntOrNull(req?.body?.usuario_id) ||
    null
  );
};

const ensureEnum = (value, allowed, fieldName) => {
  if (!value) return `${fieldName} es obligatorio.`;
  if (!allowed.includes(value)) {
    return `${fieldName} inválido. Valores permitidos: ${allowed.join(', ')}.`;
  }
  return null;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmailOrNull = (value, maxLen = 150) => {
  const cleaned = cleanStringOrNull(value, maxLen);
  if (!cleaned) return null;
  return String(cleaned).trim().toLowerCase();
};

const buildSolicitudIncludes = ({ includeHtml = false } = {}) => [
  {
    model: DebitosAutomaticosBancosModel,
    as: 'banco'
  },
  {
    model: DebitosAutomaticosPlanesModel,
    as: 'plan_titular'
  },
  {
    model: DebitosAutomaticosTerminosModel,
    as: 'terminos',
    attributes: includeHtml
      ? undefined
      : [
          'id',
          'version',
          'titulo',
          'activo',
          'publicado_desde',
          'publicado_hasta'
        ]
  },
  {
    model: DebitosAutomaticosSolicitudesAdicionalesModel,
    as: 'adicional',
    required: false,
    include: [
      {
        model: DebitosAutomaticosPlanesModel,
        as: 'plan'
      }
    ]
  },
  {
    model: UsersModel,
    as: 'usuario_carga',
    required: false,
    attributes: ['id', 'name', 'email', 'level']
  },
  // Benjamin Orellana - 07/04/2026 - Se incluye la sede asociada a la solicitud para listados y detalle del nuevo flujo con sede desde origen.
  {
    model: SedeModel,
    as: 'sede',
    required: false,
    attributes: ['id', 'nombre', 'estado', 'es_ciudad']
  }
];

const validateTransition = (currentEstado, allowedFrom = []) => {
  return allowedFrom.includes(currentEstado);
};

/* =========================
   Helpers tarjeta / seguridad
========================= */
const buildMaskedCard = (digits) => {
  const last4 = digits.slice(-4);
  return `**** **** **** ${last4}`;
};

const encryptCardNumber = (rawDigits) => {
  const secret = process.env.DEBITOS_AUTOMATICOS_CARD_SECRET;

  if (!secret) {
    throw new Error(
      'Falta la variable de entorno DEBITOS_AUTOMATICOS_CARD_SECRET para cifrar tarjetas.'
    );
  }

  const key = crypto.createHash('sha256').update(String(secret)).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(String(rawDigits), 'utf8'),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

const resolveCardData = (body = {}) => {
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
  const tarjeta_ultimos4 = cleanStringOrNull(body.tarjeta_ultimos4, 4);
  const tarjeta_mascara = cleanStringOrNull(body.tarjeta_mascara, 30);

  if (tarjeta_numero_cifrado) {
    if (!tarjeta_ultimos4 || !tarjeta_mascara) {
      return {
        ok: false,
        message:
          'Si envías tarjeta_numero_cifrado, también debes enviar tarjeta_ultimos4 y tarjeta_mascara.'
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

/* =========================
   Helpers de negocio
========================= */
const findBancoActivoById = async (id, transaction) => {
  return DebitosAutomaticosBancosModel.findOne({
    where: { id, activo: 1 },
    transaction
  });
};

const findPlanActivoById = async (id, transaction) => {
  return DebitosAutomaticosPlanesModel.findOne({
    where: { id, activo: 1 },
    transaction
  });
};

const findTerminoActivoVigenteById = async (id, transaction) => {
  return DebitosAutomaticosTerminosModel.findOne({
    where: {
      id,
      activo: 1,
      ...buildVigenciaWhere()
    },
    transaction
  });
};

const findCurrentTerminoActivoVigente = async (transaction) => {
  return DebitosAutomaticosTerminosModel.findOne({
    where: {
      activo: 1,
      ...buildVigenciaWhere()
    },
    order: [
      ['publicado_desde', 'DESC'],
      ['id', 'DESC']
    ],
    transaction
  });
};

const validateModalidadAndPlans = async ({
  modalidad_adhesion,
  titular_plan_id,
  adicional,
  transaction
}) => {
  if (!MODALIDADES.includes(modalidad_adhesion)) {
    return {
      ok: false,
      message: `modalidad_adhesion inválida. Valores permitidos: ${MODALIDADES.join(', ')}.`
    };
  }

  let titularPlan = null;
  let adicionalPayload = null;

  if (modalidad_adhesion === 'TITULAR_SOLO' || modalidad_adhesion === 'AMBOS') {
    if (!titular_plan_id) {
      return {
        ok: false,
        message:
          'titular_plan_id es obligatorio cuando modalidad_adhesion es TITULAR_SOLO o AMBOS.'
      };
    }

    titularPlan = await findPlanActivoById(titular_plan_id, transaction);

    if (!titularPlan) {
      return {
        ok: false,
        message: 'El titular_plan_id no existe o está inactivo.'
      };
    }
  }

  if (modalidad_adhesion === 'SOLO_ADICIONAL') {
    if (
      titular_plan_id !== null &&
      titular_plan_id !== undefined &&
      titular_plan_id !== ''
    ) {
      return {
        ok: false,
        message:
          'titular_plan_id debe ir null cuando modalidad_adhesion es SOLO_ADICIONAL.'
      };
    }
  }

  if (
    modalidad_adhesion === 'AMBOS' ||
    modalidad_adhesion === 'SOLO_ADICIONAL'
  ) {
    if (!adicional || typeof adicional !== 'object') {
      return {
        ok: false,
        message:
          'Debes enviar una persona adicional cuando modalidad_adhesion es AMBOS o SOLO_ADICIONAL.'
      };
    }

    const adicionalNombre = cleanStringOrNull(adicional.nombre, 150);
    const adicionalDni = cleanStringOrNull(adicional.dni, 20);
    const adicionalEmail = normalizeEmailOrNull(adicional.email, 150);
    const adicionalTelefono = cleanStringOrNull(adicional.telefono, 30);
    const adicionalPlanId = toIntOrNull(adicional.plan_id);

    if (!adicionalNombre) {
      return {
        ok: false,
        message: 'El nombre de la persona adicional es obligatorio.'
      };
    }

    if (!adicionalDni) {
      return {
        ok: false,
        message: 'El dni de la persona adicional es obligatorio.'
      };
    }

    if (!adicionalEmail) {
      return {
        ok: false,
        message: 'El email de la persona adicional es obligatorio.'
      };
    }

    if (!EMAIL_REGEX.test(adicionalEmail)) {
      return {
        ok: false,
        message: 'El email de la persona adicional no tiene un formato válido.'
      };
    }

    if (!adicionalPlanId) {
      return {
        ok: false,
        message: 'El plan_id de la persona adicional es obligatorio.'
      };
    }

    const adicionalPlan = await findPlanActivoById(
      adicionalPlanId,
      transaction
    );

    if (!adicionalPlan) {
      return {
        ok: false,
        message: 'El plan_id de la persona adicional no existe o está inactivo.'
      };
    }

    adicionalPayload = {
      nombre: adicionalNombre,
      dni: adicionalDni,
      email: adicionalEmail,
      telefono: adicionalTelefono,
      plan_id: adicionalPlanId
    };
  }

  if (modalidad_adhesion === 'TITULAR_SOLO' && adicional) {
    return {
      ok: false,
      message:
        'No debes enviar persona adicional cuando modalidad_adhesion es TITULAR_SOLO.'
    };
  }

  return {
    ok: true,
    titularPlan,
    adicionalPayload
  };
};

const upsertAdicionalForSolicitud = async ({
  solicitudId,
  modalidad_adhesion,
  adicionalPayload,
  transaction
}) => {
  const existente = await DebitosAutomaticosSolicitudesAdicionalesModel.findOne(
    {
      where: { solicitud_id: solicitudId },
      transaction
    }
  );

  if (
    modalidad_adhesion === 'AMBOS' ||
    modalidad_adhesion === 'SOLO_ADICIONAL'
  ) {
    if (!adicionalPayload) {
      throw new Error(
        'La persona adicional es obligatoria para la modalidad seleccionada.'
      );
    }

    if (!existente) {
      await DebitosAutomaticosSolicitudesAdicionalesModel.create(
        {
          solicitud_id: solicitudId,
          nombre: adicionalPayload.nombre,
          dni: adicionalPayload.dni,
          email: adicionalPayload.email,
          telefono: adicionalPayload.telefono,
          plan_id: adicionalPayload.plan_id
        },
        { transaction }
      );
    } else {
      await DebitosAutomaticosSolicitudesAdicionalesModel.update(
        {
          nombre: adicionalPayload.nombre,
          dni: adicionalPayload.dni,
          email: adicionalPayload.email,
          telefono: adicionalPayload.telefono,
          plan_id: adicionalPayload.plan_id
        },
        {
          where: { solicitud_id: solicitudId },
          transaction
        }
      );
    }
  } else if (existente) {
    await DebitosAutomaticosSolicitudesAdicionalesModel.destroy({
      where: { solicitud_id: solicitudId },
      transaction
    });
  }
};

const buildSolicitudCreationPayload = async ({
  body,
  req,
  isPublic,
  transaction
}) => {
  const titular_nombre = cleanStringOrNull(body.titular_nombre, 150);
  const titular_dni = cleanStringOrNull(body.titular_dni, 20);
  const titular_email = normalizeEmailOrNull(body.titular_email, 150);
  const titular_telefono = cleanStringOrNull(body.titular_telefono, 30);
  // Benjamin Orellana - 07/04/2026 - Se toma sede_id desde la solicitud para que la sede se elija antes de completar el formulario.
  const sede_id = toIntOrNull(body.sede_id);

  const banco_id = toIntOrNull(body.banco_id);
  const marca_tarjeta = cleanStringOrNull(body.marca_tarjeta, 20);
  const confirmo_tarjeta_credito = toFlagOrUndefined(
    body.confirmo_tarjeta_credito
  );
  const modalidad_adhesion = cleanStringOrNull(body.modalidad_adhesion, 30);
  const titular_plan_id = toIntOrNull(body.titular_plan_id);
  const observaciones_cliente = cleanStringOrNull(
    body.observaciones_cliente,
    500
  );
  const observaciones_internas = body.observaciones_internas
    ? String(body.observaciones_internas).trim()
    : null;

  const canal_origen = isPublic
    ? CANALES.PUBLICO
    : cleanStringOrNull(body.canal_origen, 20) || CANALES.INTERNO;

  const rol_carga_origen = isPublic
    ? 'CLIENTE'
    : cleanStringOrNull(body.rol_carga_origen, 20) || 'ADMIN';

  // Benjamin Orellana - 17-03-2026 - Resolver usuario_carga_id para altas internas:
  // prioriza usuario autenticado en req, y si no existe, usa body.usuario_carga_id.
  const usuarioCargaDesdeReq = getActorUserId(req);
  const usuarioCargaDesdeBody = toIntOrNull(body.usuario_carga_id);

  const usuario_carga_id = isPublic
    ? null
    : usuarioCargaDesdeReq || usuarioCargaDesdeBody || null;

  if (!titular_nombre) {
    return { ok: false, message: 'titular_nombre es obligatorio.' };
  }

  if (!titular_dni) {
    return { ok: false, message: 'titular_dni es obligatorio.' };
  }

  if (!titular_email) {
    return { ok: false, message: 'titular_email es obligatorio.' };
  }

  if (!EMAIL_REGEX.test(titular_email)) {
    return {
      ok: false,
      message: 'titular_email no tiene un formato válido.'
    };
  }

  if (!banco_id) {
    return { ok: false, message: 'banco_id es obligatorio.' };
  }

  // Benjamin Orellana - 07/04/2026 - Se valida que la solicitud venga con sede_id y que la sede sea operativa para débitos automáticos.
  if (!sede_id) {
    return { ok: false, message: 'sede_id es obligatorio.' };
  }

  const sede = await findSedeValidaParaDebitoById(sede_id, transaction);

  if (!sede) {
    return {
      ok: false,
      message:
        'La sede indicada no existe, no está activa o no es válida para débitos.'
    };
  }

  const errMarca = ensureEnum(marca_tarjeta, MARCAS_TARJETA, 'marca_tarjeta');
  if (errMarca) return { ok: false, message: errMarca };

  const errCanal = ensureEnum(
    canal_origen,
    Object.values(CANALES),
    'canal_origen'
  );
  if (errCanal) return { ok: false, message: errCanal };

  const errRol = ensureEnum(rol_carga_origen, ROLES_CARGA, 'rol_carga_origen');
  if (errRol) return { ok: false, message: errRol };

  if (!isPublic && !usuario_carga_id) {
    return {
      ok: false,
      message: 'No se pudo determinar usuario_carga_id para la alta interna.'
    };
  }

  if (confirmo_tarjeta_credito !== 1) {
    return {
      ok: false,
      message: 'confirmo_tarjeta_credito debe ser 1.'
    };
  }

  const cardResolved = resolveCardData(body);
  if (!cardResolved.ok) {
    return { ok: false, message: cardResolved.message };
  }

  const banco = await findBancoActivoById(banco_id, transaction);
  if (!banco) {
    return {
      ok: false,
      message: 'El banco_id no existe o está inactivo.'
    };
  }

  const terminos_aceptados = toFlagOrUndefined(body.terminos_aceptados);
  if (terminos_aceptados !== 1) {
    return {
      ok: false,
      message: 'terminos_aceptados debe ser 1.'
    };
  }

  const terminos_id = toIntOrNull(body.terminos_id);
  let terminos = null;

  if (terminos_id) {
    terminos = await findTerminoActivoVigenteById(terminos_id, transaction);
    if (!terminos) {
      return {
        ok: false,
        message: 'El terminos_id no existe, no está activo o no está vigente.'
      };
    }
  } else {
    terminos = await findCurrentTerminoActivoVigente(transaction);
    if (!terminos) {
      return {
        ok: false,
        message:
          'No existe un término activo y vigente para registrar la solicitud.'
      };
    }
  }

  const modalidadCheck = await validateModalidadAndPlans({
    modalidad_adhesion,
    titular_plan_id,
    adicional: body.adicional,
    transaction
  });

  if (!modalidadCheck.ok) {
    return modalidadCheck;
  }

  const solicitudPayload = {
    canal_origen,
    rol_carga_origen,
    usuario_carga_id,
    // Benjamin Orellana - 07/04/2026 - Se guarda la sede elegida en la solicitud para que luego se copie al cliente aprobado.
    sede_id,
    estado: ESTADOS.PENDIENTE,

    titular_nombre,
    titular_dni,
    titular_email,
    titular_telefono,

    banco_id,
    marca_tarjeta,
    confirmo_tarjeta_credito: 1,

    tarjeta_numero_cifrado: cardResolved.tarjeta_numero_cifrado,
    tarjeta_ultimos4: cardResolved.tarjeta_ultimos4,
    tarjeta_mascara: cardResolved.tarjeta_mascara,

    modalidad_adhesion,
    titular_plan_id:
      modalidad_adhesion === 'SOLO_ADICIONAL' ? null : titular_plan_id,

    terminos_id: terminos.id,
    terminos_aceptados: 1,
    terminos_aceptados_at: new Date(),
    terminos_ip: getClientIp(req),
    terminos_user_agent: cleanStringOrNull(req.headers['user-agent'], 500),

    beneficio_descripcion_snapshot: banco.descripcion_publica,
    beneficio_descuento_off_pct_snapshot: banco.descuento_off_pct,
    beneficio_reintegro_pct_snapshot: banco.reintegro_pct,
    beneficio_reintegro_desde_mes_snapshot: banco.reintegro_desde_mes,
    beneficio_reintegro_duracion_meses_snapshot: banco.reintegro_duracion_meses,

    observaciones_cliente,
    observaciones_internas,

    revisado_por: null,
    revisado_at: null,
    motivo_rechazo: null
  };

  return {
    ok: true,
    solicitudPayload,
    adicionalPayload: modalidadCheck.adicionalPayload
  };
};

const appendObservacionInterna = (actual, nueva) => {
  const oldVal = actual ? String(actual).trim() : '';
  const newVal = nueva ? String(nueva).trim() : '';

  if (!oldVal && !newVal) return null;
  if (!oldVal) return newVal;
  if (!newVal) return oldVal;

  return `${oldVal}\n${newVal}`;
};

// Benjamin Orellana - 23/03/2026 - Resuelve el usuario actual desde req.user o desde auth_user_id recibido en la request para escenarios donde el middleware no puebla req.user
const resolveViewerUser = async (req) => {
  if (req?.user?.id) {
    return req.user;
  }

  const authUserId = toIntOrNull(
    req?.query?.auth_user_id ||
      req?.headers?.['x-auth-user-id'] ||
      req?.body?.auth_user_id
  );

  if (!authUserId) return null;

  const user = await UsersModel.findByPk(authUserId, {
    attributes: ['id', 'name', 'email', 'level', 'state']
  });

  return user ? user.get({ plain: true }) : null;
};

// Benjamin Orellana - 23/03/2026 - Determina acceso admin usando users.level sin confiar en flags del frontend
const isAdminUser = async (req) => {
  const viewer = await resolveViewerUser(req);

  return (
    String(viewer?.level || '')
      .trim()
      .toLowerCase() === 'admin'
  );
};

// Benjamin Orellana - 2026/04/13 - Se incluyen siempre los snapshots legales del término y se mantiene oculto el cifrado de tarjeta salvo acceso explícito.
const buildSolicitudAttributes = ({ includeEncrypted = false } = {}) => {
  const baseExclude = Array.isArray(SOLICITUD_EXCLUDE_ATTRIBUTES)
    ? SOLICITUD_EXCLUDE_ATTRIBUTES.filter(
        (attr) => attr !== 'tarjeta_numero_cifrado'
      )
    : [];

  const includeCommon = [
    'termino_id',
    'termino_version',
    'termino_titulo',
    'termino_html_snapshot'
  ];

  if (includeEncrypted) {
    return {
      include: [...includeCommon, 'tarjeta_numero_cifrado'],
      exclude: baseExclude
    };
  }

  return {
    include: includeCommon,
    exclude: [...baseExclude, 'tarjeta_numero_cifrado']
  };
};

// Benjamin Orellana - 2026/04/10 - Normaliza la respuesta y nunca expone tarjeta_numero_cifrado, resolviendo tarjeta completa solo para correos habilitados.
const formatSolicitudForResponse = (
  registro,
  { includeFullCard = false, req = null } = {}
) => {
  if (!registro) return null;

  const plain =
    typeof registro?.get === 'function'
      ? registro.get({ plain: true })
      : JSON.parse(JSON.stringify(registro));

  const cardData = resolveCardPresentation({
    req,
    solicitud: plain,
    forceFullAccess: includeFullCard
  });

  delete plain.tarjeta_numero_cifrado;

  plain.tarjeta_mascara = cardData.tarjeta_mascara || null;
  plain.tarjeta_ultimos4 = cardData.tarjeta_ultimos4 || null;

  if (cardData.tarjeta_numero_completo) {
    plain.tarjeta_numero_completo = cardData.tarjeta_numero_completo;
  } else {
    delete plain.tarjeta_numero_completo;
  }

  plain.cargado_por_nombre =
    plain?.usuario_carga?.name?.trim() || 'Alta formulario página web';

  return plain;
};

// Benjamin Orellana - 2026/04/10 - Aplica el formateo seguro a listados, usando el request para resolver permisos reales de tarjeta.
const formatSolicitudesForResponse = (
  registros,
  { includeFullCard = false, req = null } = {}
) => {
  return (Array.isArray(registros) ? registros : []).map((item) =>
    formatSolicitudForResponse(item, {
      includeFullCard,
      req
    })
  );
};
// Benjamin Orellana - 2026/04/10 - Permite traer detalle reutilizable incluyendo cifrado solo cuando el request tiene permiso de tarjeta completa.
const getSolicitudDetalleById = async (
  id,
  transaction = null,
  includeEncrypted = false
) => {
  return DebitosAutomaticosSolicitudesModel.findByPk(id, {
    attributes: buildSolicitudAttributes({ includeEncrypted }),
    include: buildSolicitudIncludes({ includeHtml: false }),
    transaction
  });
};

/* Benjamin Orellana - 2026/04/15 - Resuelve el plan comercial efectivo de la solicitud según modalidad para buscar el precio base correcto por sede al momento de aprobar. */
const resolvePlanIdForSolicitudAprobacion = ({
  solicitud,
  adicionalSolicitud
}) => {
  if (!solicitud) return null;

  if (
    solicitud.modalidad_adhesion === 'TITULAR_SOLO' ||
    solicitud.modalidad_adhesion === 'AMBOS'
  ) {
    return toIntOrNull(solicitud.titular_plan_id);
  }

  if (solicitud.modalidad_adhesion === 'SOLO_ADICIONAL') {
    return toIntOrNull(adicionalSolicitud?.plan_id);
  }

  return null;
};

/* =========================
   OBR - carta PDF pública
========================= */
export const OBR_DebitosAutomaticosSolicitudesCartaPdfPublica_CTS = async (
  req,
  res
) => {
  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const solicitudDb = await getSolicitudDetalleById(id);

    if (!solicitudDb) {
      return res.status(404).json({
        mensajeError: 'Solicitud no encontrada.'
      });
    }

    const solicitud =
      typeof solicitudDb?.get === 'function'
        ? solicitudDb.get({ plain: true })
        : solicitudDb;

    const terminoFallback =
      solicitud?.termino_html_snapshot || solicitud?.termino_version
        ? {
            id: solicitud?.termino_id || null,
            version: solicitud?.termino_version || null,
            titulo: solicitud?.termino_titulo || 'Términos y Condiciones',
            contenido_html: solicitud?.termino_html_snapshot || null
          }
        : await obtenerTerminoVigente();

    if (!terminoFallback?.contenido_html) {
      return res.status(409).json({
        mensajeError:
          'La solicitud no tiene carta disponible para generar el PDF.'
      });
    }

    const pdfBufferRaw = await generarCartaPdfBuffer({
      solicitud,
      termino: terminoFallback
    });

    /* Benjamin Orellana - 2026/04/13 - Se normaliza la salida de Puppeteer a Buffer nativo para servir el PDF de forma consistente. */
    const pdfBuffer = Buffer.isBuffer(pdfBufferRaw)
      ? pdfBufferRaw
      : Buffer.from(pdfBufferRaw);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="carta-aceptacion-debito-automatico-solicitud-${solicitud.id}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-store');

    return res.end(pdfBuffer, 'binary');

  } catch (error) {
    console.error('[DebitosAutomaticosSolicitudes][carta-pdf]', error);

    return res.status(500).json({
      mensajeError: error.message || 'No se pudo generar el PDF.'
    });
  }
};
/* =========================
   OBRS - listar interno
   Filtros:
   ?estado=PENDIENTE
   ?canal_origen=PUBLICO
   ?rol_carga_origen=CLIENTE
   ?banco_id=1
   ?titular_dni=123
   ?modalidad_adhesion=AMBOS
   ?q=texto
========================= */
export const OBRS_DebitosAutomaticosSolicitudes_CTS = async (req, res) => {
  try {
    const {
      estado,
      canal_origen,
      rol_carga_origen,
      banco_id,
      sede_id,
      titular_dni,
      modalidad_adhesion,
      q
    } = req.query;

    const where = {};

    if (estado) {
      const err = ensureEnum(estado, Object.values(ESTADOS), 'estado');
      if (err) return res.status(400).json({ mensajeError: err });
      where.estado = estado;
    }

    if (canal_origen) {
      const err = ensureEnum(
        canal_origen,
        Object.values(CANALES),
        'canal_origen'
      );
      if (err) return res.status(400).json({ mensajeError: err });
      where.canal_origen = canal_origen;
    }

    if (rol_carga_origen) {
      const err = ensureEnum(rol_carga_origen, ROLES_CARGA, 'rol_carga_origen');
      if (err) return res.status(400).json({ mensajeError: err });
      where.rol_carga_origen = rol_carga_origen;
    }

    if (banco_id !== undefined) {
      const bancoId = toIntOrNull(banco_id);
      if (!bancoId) {
        return res.status(400).json({ mensajeError: 'banco_id inválido.' });
      }
      where.banco_id = bancoId;
    }

    // Benjamin Orellana - 07/04/2026 - Se habilita filtro por sede_id en el listado de solicitudes.
    if (sede_id !== undefined) {
      const sedeId = toIntOrNull(sede_id);
      if (!sedeId) {
        return res.status(400).json({ mensajeError: 'sede_id inválido.' });
      }
      where.sede_id = sedeId;
    }

    if (titular_dni) {
      where.titular_dni = { [Op.like]: `%${String(titular_dni).trim()}%` };
    }

    if (modalidad_adhesion) {
      const err = ensureEnum(
        modalidad_adhesion,
        MODALIDADES,
        'modalidad_adhesion'
      );
      if (err) return res.status(400).json({ mensajeError: err });
      where.modalidad_adhesion = modalidad_adhesion;
    }

    if (q && String(q).trim()) {
      const search = String(q).trim();
      where[Op.or] = [
        { titular_nombre: { [Op.like]: `%${search}%` } },
        { titular_dni: { [Op.like]: `%${search}%` } },
        { tarjeta_ultimos4: { [Op.like]: `%${search}%` } },
        { beneficio_descripcion_snapshot: { [Op.like]: `%${search}%` } }
      ];
    }

    // Benjamin Orellana - 2026/04/10 - El acceso a tarjeta completa deja de depender de admin y pasa a depender del whitelist de correos privilegiados.
    const includeFullCard = hasDebitosFullAccess(req);

    const registros = await DebitosAutomaticosSolicitudesModel.findAll({
      attributes: buildSolicitudAttributes({
        includeEncrypted: includeFullCard
      }),
      where,
      include: buildSolicitudIncludes({ includeHtml: false }),
      order: [
        ['created_at', 'DESC'],
        ['id', 'DESC']
      ]
    });

    return res.json(
      formatSolicitudesForResponse(registros, {
        includeFullCard,
        req
      })
    );
  } catch (error) {
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   OBRS - pendientes
========================= */
export const OBRS_DebitosAutomaticosSolicitudesPendientes_CTS = async (
  req,
  res
) => {
  try {
    // Benjamin Orellana - 2026/04/10 - En pendientes también se habilita tarjeta completa únicamente para correos privilegiados del módulo.
    const includeFullCard = hasDebitosFullAccess(req);

    const registros = await DebitosAutomaticosSolicitudesModel.findAll({
      attributes: buildSolicitudAttributes({
        includeEncrypted: includeFullCard
      }),
      where: { estado: ESTADOS.PENDIENTE },
      include: buildSolicitudIncludes({ includeHtml: false }),
      order: [
        ['created_at', 'ASC'],
        ['id', 'ASC']
      ]
    });

    return res.json(
      formatSolicitudesForResponse(registros, {
        includeFullCard,
        req
      })
    );
  } catch (error) {
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   OBR - detalle
========================= */
export const OBR_DebitosAutomaticosSolicitudes_CTS = async (req, res) => {
  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const includeFullCard = hasDebitosFullAccess(req);

    const registro = await getSolicitudDetalleById(id, null, includeFullCard);

    return res.json(
      formatSolicitudForResponse(registro, {
        includeFullCard,
        req
      })
    );
  } catch (error) {
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   CR - alta interna
========================= */
export const CR_DebitosAutomaticosSolicitudes_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const build = await buildSolicitudCreationPayload({
      body: req.body || {},
      req,
      isPublic: false,
      transaction: t
    });

    if (!build.ok) {
      await t.rollback();
      return res.status(400).json({ mensajeError: build.message });
    }

    // Benjamin Orellana - 2026/04/13 - Se obtiene el término vigente y se congela su snapshot legal dentro de la solicitud.
    const terminoVigente = await obtenerTerminoVigente();

    if (!terminoVigente) {
      await t.rollback();
      return res.status(400).json({
        mensajeError:
          'No existe un término vigente para registrar la solicitud.'
      });
    }

    // Benjamin Orellana - 2026/04/13 - Se inyecta en el payload la versión legal exacta aceptada al momento del alta.
    build.solicitudPayload = {
      ...build.solicitudPayload,
      termino_id: terminoVigente.id,
      termino_version: terminoVigente.version,
      termino_titulo: terminoVigente.titulo,
      termino_html_snapshot: terminoVigente.contenido_html
    };

    const creado = await DebitosAutomaticosSolicitudesModel.create(
      build.solicitudPayload,
      {
        transaction: t
      }
    );

    // Benjamin Orellana - 30/03/2026 - Se conserva referencia del adicional creado para reutilizarlo en emails y fallback seguro.
    let adicionalCreado = null;

    if (build.adicionalPayload) {
      adicionalCreado =
        await DebitosAutomaticosSolicitudesAdicionalesModel.create(
          {
            solicitud_id: creado.id,
            nombre: build.adicionalPayload.nombre,
            dni: build.adicionalPayload.dni,
            email: build.adicionalPayload.email,
            telefono: build.adicionalPayload.telefono,
            plan_id: build.adicionalPayload.plan_id
          },
          { transaction: t }
        );
    }

    await t.commit();

    const detalle = await getSolicitudDetalleById(creado.id);

    // Benjamin Orellana - 30/03/2026 - El envío de emails se programa post-response para no bloquear el alta interna.
    const email_resultado = scheduleSolicitudEmailDispatch({
      solicitudId: creado.id,
      evento: 'SOLICITUD_RECIBIDA',
      detalle,
      creado,
      adicionalCreado
    });

    return res.status(201).json({
      message: 'Solicitud creada correctamente',
      registro: detalle,
      email_resultado
    });
  } catch (error) {
    await t.rollback();

    if (
      error?.name === 'SequelizeForeignKeyConstraintError' ||
      String(error?.original?.code || '').includes('ER_NO_REFERENCED_ROW')
    ) {
      return res.status(409).json({
        mensajeError: 'No se pudo crear la solicitud por referencias inválidas.'
      });
    }

    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   CR - alta pública
========================= */
export const CR_DebitosAutomaticosSolicitudesPublica_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const build = await buildSolicitudCreationPayload({
      body: req.body || {},
      req,
      isPublic: true,
      transaction: t
    });

    if (!build.ok) {
      await t.rollback();
      return res.status(400).json({ mensajeError: build.message });
    }

    // Benjamin Orellana - 2026/04/13 - Se obtiene el término vigente y se congela su snapshot legal dentro de la solicitud pública.
    const terminoVigente = await obtenerTerminoVigente();

    if (!terminoVigente) {
      await t.rollback();
      return res.status(400).json({
        mensajeError:
          'No existe un término vigente para registrar la solicitud.'
      });
    }

    // Benjamin Orellana - 2026/04/13 - Se persiste la versión legal exacta aceptada por el usuario al momento de enviar la solicitud pública.
    build.solicitudPayload = {
      ...build.solicitudPayload,
      termino_id: terminoVigente.id,
      termino_version: terminoVigente.version,
      termino_titulo: terminoVigente.titulo,
      termino_html_snapshot: terminoVigente.contenido_html
    };

    const creado = await DebitosAutomaticosSolicitudesModel.create(
      build.solicitudPayload,
      {
        transaction: t
      }
    );

    // Benjamin Orellana - 30/03/2026 - Se captura el adicional creado para usarlo en emails sin depender de otra consulta.
    let adicionalCreado = null;

    if (build.adicionalPayload) {
      adicionalCreado =
        await DebitosAutomaticosSolicitudesAdicionalesModel.create(
          {
            solicitud_id: creado.id,
            nombre: build.adicionalPayload.nombre,
            dni: build.adicionalPayload.dni,
            // Benjamin Orellana - 30/03/2026 - Se corrige alta pública del adicional para persistir también email y teléfono.
            email: build.adicionalPayload.email,
            telefono: build.adicionalPayload.telefono,
            plan_id: build.adicionalPayload.plan_id
          },
          { transaction: t }
        );
    }

    await t.commit();

    // Benjamin Orellana - 30/03/2026 - El email se programa luego de responder para evitar que el SMTP degrade la UX de la página pública.
    const email_resultado = scheduleSolicitudEmailDispatch({
      solicitudId: creado.id,
      evento: 'SOLICITUD_RECIBIDA',
      creado,
      adicionalCreado
    });

    return res.status(201).json({
      message: 'Solicitud registrada correctamente',
      registro: {
        id: creado.id,
        estado: creado.estado,
        titular_nombre: creado.titular_nombre,
        titular_dni: creado.titular_dni,
        titular_email: creado.titular_email,
        banco_id: creado.banco_id,
        // Benjamin Orellana - 07/04/2026 - Se devuelve sede_id para confirmar la sede elegida en la solicitud pública.
        sede_id: creado.sede_id,
        modalidad_adhesion: creado.modalidad_adhesion,
        termino_id: creado.termino_id,
        termino_version: creado.termino_version,
        termino_titulo: creado.termino_titulo,
        created_at: creado.created_at
      },
      email_resultado
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   UR - edición interna
   Regla:
   - solo PENDIENTE u OBSERVADA
   - si cambia banco => refresca snapshot
   - si cambia modalidad => sync adicional
========================= */
export const UR_DebitosAutomaticosSolicitudes_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const current = await DebitosAutomaticosSolicitudesModel.findByPk(id, {
      transaction: t
    });

    if (!current) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    if (
      !validateTransition(current.estado, [
        ESTADOS.PENDIENTE,
        ESTADOS.OBSERVADA
      ])
    ) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'Solo se pueden editar solicitudes en estado PENDIENTE u OBSERVADA.'
      });
    }

    const body = req.body || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

    const updateBody = {};

    if (has('titular_nombre')) {
      const titularNombre = cleanStringOrNull(body.titular_nombre, 150);
      if (!titularNombre) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'titular_nombre no puede ser vacío.'
        });
      }
      updateBody.titular_nombre = titularNombre;
    }

    if (has('titular_dni')) {
      const titularDni = cleanStringOrNull(body.titular_dni, 20);
      if (!titularDni) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'titular_dni no puede ser vacío.'
        });
      }
      updateBody.titular_dni = titularDni;
    }

    if (has('titular_email')) {
      const titularEmail = normalizeEmailOrNull(body.titular_email, 150);

      if (!titularEmail) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'titular_email no puede ser vacío.'
        });
      }

      if (!EMAIL_REGEX.test(titularEmail)) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'titular_email no tiene un formato válido.'
        });
      }

      updateBody.titular_email = titularEmail;
    }

    if (has('titular_telefono')) {
      updateBody.titular_telefono = cleanStringOrNull(
        body.titular_telefono,
        30
      );
    }

    if (has('marca_tarjeta')) {
      const marcaTarjeta = cleanStringOrNull(body.marca_tarjeta, 20);
      const errMarca = ensureEnum(
        marcaTarjeta,
        MARCAS_TARJETA,
        'marca_tarjeta'
      );
      if (errMarca) {
        await t.rollback();
        return res.status(400).json({ mensajeError: errMarca });
      }
      updateBody.marca_tarjeta = marcaTarjeta;
    }

    if (has('confirmo_tarjeta_credito')) {
      const confirm = toFlagOrUndefined(body.confirmo_tarjeta_credito);
      if (confirm !== 1) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'confirmo_tarjeta_credito debe ser 1.'
        });
      }
      updateBody.confirmo_tarjeta_credito = 1;
    }

    const touchesCard =
      has('tarjeta_numero') ||
      has('tarjeta_numero_cifrado') ||
      has('tarjeta_ultimos4') ||
      has('tarjeta_mascara');

    if (touchesCard) {
      const cardResolved = resolveCardData(body);
      if (!cardResolved.ok) {
        await t.rollback();
        return res.status(400).json({ mensajeError: cardResolved.message });
      }

      updateBody.tarjeta_numero_cifrado = cardResolved.tarjeta_numero_cifrado;
      updateBody.tarjeta_ultimos4 = cardResolved.tarjeta_ultimos4;
      updateBody.tarjeta_mascara = cardResolved.tarjeta_mascara;
    }

    let bancoRef = null;
    const nextBancoId = has('banco_id')
      ? toIntOrNull(body.banco_id)
      : current.banco_id;

    if (has('banco_id')) {
      if (!nextBancoId) {
        await t.rollback();
        return res.status(400).json({ mensajeError: 'banco_id inválido.' });
      }

      bancoRef = await findBancoActivoById(nextBancoId, t);
      if (!bancoRef) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'El banco_id no existe o está inactivo.'
        });
      }

      updateBody.banco_id = nextBancoId;
    }
    // Benjamin Orellana - 07/04/2026 - Se permite corregir sede_id antes de aprobar la solicitud, validando que la sede exista y sea operativa.
    if (has('sede_id')) {
      const nextSedeId = toIntOrNull(body.sede_id);

      if (!nextSedeId) {
        await t.rollback();
        return res.status(400).json({ mensajeError: 'sede_id inválido.' });
      }

      const sedeRef = await findSedeValidaParaDebitoById(nextSedeId, t);

      if (!sedeRef) {
        await t.rollback();
        return res.status(400).json({
          mensajeError:
            'La sede indicada no existe, no está activa o no es válida para débitos.'
        });
      }

      updateBody.sede_id = nextSedeId;
    }
    const nextModalidad = has('modalidad_adhesion')
      ? cleanStringOrNull(body.modalidad_adhesion, 30)
      : current.modalidad_adhesion;

    const nextTitularPlanId = has('titular_plan_id')
      ? toIntOrNull(body.titular_plan_id)
      : current.titular_plan_id;

    const nextAdicionalInput = has('adicional')
      ? body.adicional
      : await DebitosAutomaticosSolicitudesAdicionalesModel.findOne({
          where: { solicitud_id: id },
          transaction: t
        });

    const modalidadCheck = await validateModalidadAndPlans({
      modalidad_adhesion: nextModalidad,
      titular_plan_id: nextTitularPlanId,
      adicional:
        nextAdicionalInput && nextAdicionalInput.dataValues
          ? {
              nombre: nextAdicionalInput.nombre,
              dni: nextAdicionalInput.dni,
              email: nextAdicionalInput.email,
              telefono: nextAdicionalInput.telefono,
              plan_id: nextAdicionalInput.plan_id
            }
          : nextAdicionalInput,
      transaction: t
    });

    if (!modalidadCheck.ok) {
      await t.rollback();
      return res.status(400).json({ mensajeError: modalidadCheck.message });
    }

    if (has('modalidad_adhesion')) {
      updateBody.modalidad_adhesion = nextModalidad;
    }

    if (has('titular_plan_id') || has('modalidad_adhesion')) {
      updateBody.titular_plan_id =
        nextModalidad === 'SOLO_ADICIONAL' ? null : nextTitularPlanId;
    }

    if (has('terminos_id')) {
      const terminosId = toIntOrNull(body.terminos_id);
      if (!terminosId) {
        await t.rollback();
        return res.status(400).json({ mensajeError: 'terminos_id inválido.' });
      }

      const terminos = await findTerminoActivoVigenteById(terminosId, t);
      if (!terminos) {
        await t.rollback();
        return res.status(400).json({
          mensajeError:
            'El terminos_id no existe, no está activo o no está vigente.'
        });
      }

      const termAceptados = toFlagOrUndefined(body.terminos_aceptados);
      if (termAceptados !== 1) {
        await t.rollback();
        return res.status(400).json({
          mensajeError:
            'Para cambiar terminos_id debes enviar terminos_aceptados = 1.'
        });
      }

      updateBody.terminos_id = terminos.id;
      updateBody.terminos_aceptados = 1;
      updateBody.terminos_aceptados_at = new Date();
      updateBody.terminos_ip = getClientIp(req);
      updateBody.terminos_user_agent = cleanStringOrNull(
        req.headers['user-agent'],
        500
      );
    }

    if (has('observaciones_cliente')) {
      updateBody.observaciones_cliente = cleanStringOrNull(
        body.observaciones_cliente,
        500
      );
    }

    if (has('observaciones_internas')) {
      updateBody.observaciones_internas = body.observaciones_internas
        ? String(body.observaciones_internas).trim()
        : null;
    }

    if (has('rol_carga_origen')) {
      const rol = cleanStringOrNull(body.rol_carga_origen, 20);
      const errRol = ensureEnum(rol, ROLES_CARGA, 'rol_carga_origen');
      if (errRol) {
        await t.rollback();
        return res.status(400).json({ mensajeError: errRol });
      }
      updateBody.rol_carga_origen = rol;
    }

    if (has('canal_origen')) {
      const canal = cleanStringOrNull(body.canal_origen, 20);
      const errCanal = ensureEnum(
        canal,
        Object.values(CANALES),
        'canal_origen'
      );
      if (errCanal) {
        await t.rollback();
        return res.status(400).json({ mensajeError: errCanal });
      }
      updateBody.canal_origen = canal;
    }

    if (has('usuario_carga_id')) {
      updateBody.usuario_carga_id = toIntOrNull(body.usuario_carga_id);
    }

    if (bancoRef) {
      updateBody.beneficio_descripcion_snapshot = bancoRef.descripcion_publica;
      updateBody.beneficio_descuento_off_pct_snapshot =
        bancoRef.descuento_off_pct;
      updateBody.beneficio_reintegro_pct_snapshot = bancoRef.reintegro_pct;
      updateBody.beneficio_reintegro_desde_mes_snapshot =
        bancoRef.reintegro_desde_mes;
      updateBody.beneficio_reintegro_duracion_meses_snapshot =
        bancoRef.reintegro_duracion_meses;
    }

    const [numRowsUpdated] = await DebitosAutomaticosSolicitudesModel.update(
      updateBody,
      {
        where: { id },
        transaction: t
      }
    );

    if (numRowsUpdated !== 1) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    await upsertAdicionalForSolicitud({
      solicitudId: id,
      modalidad_adhesion: nextModalidad,
      adicionalPayload: modalidadCheck.adicionalPayload,
      transaction: t
    });

    await t.commit();

    const detalle = await getSolicitudDetalleById(id);

    return res.json({
      message: 'Solicitud actualizada correctamente',
      registroActualizado: detalle
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   Helpers aprobación
========================= */

// Benjamin Orellana - 24/03/2026 - Normaliza montos monetarios para aprobación de solicitudes de débito automático.
const toDecimalOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;

  const normalized = String(value).replace(/\s/g, '').replace(',', '.');
  const num = Number(normalized);

  if (!Number.isFinite(num)) return null;

  return Number(num.toFixed(2));
};

// Benjamin Orellana - 24/03/2026 - Parsea fechas date-only en formato seguro sin depender del timezone del servidor.
const parseDateOnlyParts = (value) => {
  if (value === undefined || value === null || value === '') return null;

  const raw = String(value).trim();

  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    return { year, month, day };
  }

  match = raw.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);

    if (month < 1 || month > 12) return null;

    return { year, month, day: 1 };
  }

  match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    return { year, month, day };
  }

  return null;
};

// Benjamin Orellana - 24/03/2026 - Convierte un valor de fecha a DATE para fecha_aprobacion.
const parseDateForDateTimeField = (value) => {
  if (value === undefined || value === null || value === '') return new Date();

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const parts = parseDateOnlyParts(value);
  if (!parts) return null;

  return new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
};

// Benjamin Orellana - 24/03/2026 - Normaliza fecha de inicio de cobro al primer día del mes.
const normalizeInicioCobroToMonthStart = (value) => {
  const parts = parseDateOnlyParts(value);
  if (!parts) return null;

  const month = String(parts.month).padStart(2, '0');

  return `${parts.year}-${month}-01`;
};

// Benjamin Orellana - 24/03/2026 - Devuelve año y mes de un DATEONLY.
const getPeriodoFromDateOnly = (dateOnlyValue) => {
  const parts = parseDateOnlyParts(dateOnlyValue);
  if (!parts) return null;

  return {
    periodo_anio: parts.year,
    periodo_mes: parts.month
  };
};

// Benjamin Orellana - 24/03/2026 - Determina el estado inicial del cliente según el mes de inicio del cobro.
const resolveEstadoGeneralInicialCliente = (fechaInicioCobro) => {
  const inicio = getPeriodoFromDateOnly(fechaInicioCobro);
  if (!inicio) return 'PENDIENTE_INICIO';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (
    inicio.periodo_anio > currentYear ||
    (inicio.periodo_anio === currentYear && inicio.periodo_mes > currentMonth)
  ) {
    return 'PENDIENTE_INICIO';
  }

  return 'ACTIVO';
};

// Benjamin Orellana - 24/03/2026 - Calcula el monto neto estimado del período aplicando descuento off y reintegro snapshot.
const calcularMontoNetoEstimadoPeriodo = ({
  montoBruto,
  descuentoOffPct,
  reintegroPct
}) => {
  const bruto = Number(montoBruto || 0);
  const off = Number(descuentoOffPct || 0);
  const reintegro = Number(reintegroPct || 0);

  const descuentoMonto = bruto * (off / 100);
  const reintegroMonto = bruto * (reintegro / 100);
  const neto = bruto - descuentoMonto - reintegroMonto;

  return Number(Math.max(neto, 0).toFixed(2));
};

// Benjamin Orellana - 24/03/2026 - Valida que la sede exista, esté activa y sea una sede operativa de ciudad.
const findSedeValidaParaDebitoById = async (id, transaction) => {
  return SedeModel.findOne({
    where: {
      id,
      estado: 'activo',
      es_ciudad: true
    },
    transaction
  });
};

/* =========================
   UR - aprobar
========================= */
export const UR_DebitosAutomaticosSolicitudesAprobar_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const actorUserId = getActorUserId(req);

    // Benjamin Orellana - 07/04/2026 - En aprobación la sede ya no se recibe por request, sino que se toma desde la solicitud previamente cargada.
    let sede_id = null;

    // Benjamin Orellana - 09/04/2026 - Se reciben los tres valores comerciales vigentes desde frontend para persistirlos en el cliente aprobado.
    const monto_inicial_vigente_body = toDecimalOrNull(
      req.body?.monto_inicial_vigente
    );

    const descuento_vigente_body = toDecimalOrNull(req.body?.descuento_vigente);

    const monto_base_vigente_body = toDecimalOrNull(
      req.body?.monto_base_vigente ?? req.body?.monto_plan
    );

    const fecha_aprobacion = parseDateForDateTimeField(
      req.body?.fecha_aprobacion ?? req.body?.fecha_alta
    );

    const fecha_inicio_cobro = normalizeInicioCobroToMonthStart(
      req.body?.fecha_inicio_cobro ?? req.body?.fecha_inicio
    );

    const observaciones = req.body?.observaciones_internas
      ? String(req.body.observaciones_internas).trim()
      : null;

    if (!fecha_aprobacion || Number.isNaN(fecha_aprobacion.getTime())) {
      await t.rollback();
      return res.status(400).json({
        mensajeError:
          'fecha_aprobacion es inválida. Usa YYYY-MM-DD o DD/MM/YYYY.'
      });
    }

    if (!fecha_inicio_cobro) {
      await t.rollback();
      return res.status(400).json({
        mensajeError:
          'fecha_inicio_cobro es obligatoria. Usa YYYY-MM-DD, YYYY-MM o DD/MM/YYYY.'
      });
    }

    const current = await DebitosAutomaticosSolicitudesModel.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!current) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    // Benjamin Orellana - 07/04/2026 - La sede se resuelve desde la solicitud y se valida antes de consolidar el cliente.
    sede_id = toIntOrNull(current.sede_id);

    if (!sede_id) {
      await t.rollback();
      return res.status(400).json({
        mensajeError:
          'La solicitud no tiene sede_id cargada. Debes completar la sede antes de aprobar.'
      });
    }

    const sede = await findSedeValidaParaDebitoById(sede_id, t);

    if (!sede) {
      await t.rollback();
      return res.status(400).json({
        mensajeError:
          'La sede asociada a la solicitud no existe, no está activa o no es válida para débitos.'
      });
    }

    if (
      !validateTransition(current.estado, [
        ESTADOS.PENDIENTE,
        ESTADOS.OBSERVADA
      ])
    ) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'Solo se pueden aprobar solicitudes en estado PENDIENTE u OBSERVADA.'
      });
    }

    const clienteExistente = await DebitosAutomaticosClientesModel.findOne({
      where: { solicitud_id: id },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (clienteExistente) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'La solicitud ya fue aprobada previamente y ya posee un cliente asociado.'
      });
    }

    let adicionalSolicitud = null;

    if (
      current.modalidad_adhesion === 'AMBOS' ||
      current.modalidad_adhesion === 'SOLO_ADICIONAL'
    ) {
      adicionalSolicitud =
        await DebitosAutomaticosSolicitudesAdicionalesModel.findOne({
          where: { solicitud_id: id },
          transaction: t,
          lock: t.LOCK.UPDATE
        });

      if (!adicionalSolicitud) {
        await t.rollback();
        return res.status(409).json({
          mensajeError:
            'La solicitud requiere un adicional pero no se encontró el registro adicional asociado.'
        });
      }
    }

    /* Benjamin Orellana - 2026/04/15 - La aprobación ya no toma valores del plan global: resuelve el precio base desde plan+sede y el descuento desde el snapshot del banco guardado en la solicitud. */
    const planIdVigente = resolvePlanIdForSolicitudAprobacion({
      solicitud: current,
      adicionalSolicitud
    });

    if (!planIdVigente) {
      await t.rollback();
      return res.status(400).json({
        mensajeError:
          'No se pudo resolver el plan vigente de la solicitud para la aprobación.'
      });
    }

    const planSedeVigente = await DebitosAutomaticosPlanesSedesModel.findOne({
      where: {
        plan_id: planIdVigente,
        sede_id,
        activo: 1,
        precio_base: {
          [Op.ne]: null
        }
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!planSedeVigente) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'El plan seleccionado no tiene un precio configurado para la sede de la solicitud. No se puede aprobar.'
      });
    }

    const monto_inicial_vigente_plan = toDecimalOrNull(
      planSedeVigente?.precio_base
    );

    const descuento_vigente_snapshot = toDecimalOrNull(
      current?.beneficio_descuento_off_pct_snapshot
    );

    const monto_inicial_vigente =
      monto_inicial_vigente_body !== null
        ? monto_inicial_vigente_body
        : monto_inicial_vigente_plan;

    const descuento_vigente =
      descuento_vigente_body !== null
        ? descuento_vigente_body
        : descuento_vigente_snapshot !== null
          ? descuento_vigente_snapshot
          : 0;

    let monto_base_vigente =
      monto_base_vigente_body !== null ? monto_base_vigente_body : null;
    
    // Benjamin Orellana - 09/04/2026 - Si no viene monto final explícito pero sí monto inicial y descuento, se calcula automáticamente.
    if (
      monto_base_vigente === null &&
      monto_inicial_vigente !== null &&
      descuento_vigente !== null
    ) {
      monto_base_vigente = Number(
        (
          monto_inicial_vigente -
          (monto_inicial_vigente * descuento_vigente) / 100
        ).toFixed(2)
      );
    }

    if (monto_inicial_vigente === null || monto_inicial_vigente <= 0) {
      await t.rollback();
      return res.status(400).json({
        mensajeError:
          'monto_inicial_vigente es obligatorio y debe ser mayor a 0.'
      });
    }

    if (
      descuento_vigente === null ||
      descuento_vigente < 0 ||
      descuento_vigente > 100
    ) {
      await t.rollback();
      return res.status(400).json({
        mensajeError:
          'descuento_vigente es obligatorio y debe estar entre 0 y 100.'
      });
    }

    if (monto_base_vigente === null || monto_base_vigente <= 0) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'monto_base_vigente es obligatorio y debe ser mayor a 0.'
      });
    }

    const estado_general =
      resolveEstadoGeneralInicialCliente(fecha_inicio_cobro);

    // Benjamin Orellana - 08/04/2026 - Se toma el texto especial opcional para guardar una promoción puntual del cliente
    const especial = cleanStringOrNull(req.body?.especial, 255);

    const clienteCreado = await DebitosAutomaticosClientesModel.create(
      {
        solicitud_id: current.id,
        estado_general,

        sede_id,
        creado_por: actorUserId,
        updated_by: actorUserId,

        fecha_aprobacion,
        fecha_inicio_cobro,
        fecha_baja: null,

        titular_nombre: current.titular_nombre,
        titular_dni: current.titular_dni,

        banco_id: current.banco_id,
        marca_tarjeta: current.marca_tarjeta,
        confirmo_tarjeta_credito: current.confirmo_tarjeta_credito,

        tarjeta_numero_cifrado: current.tarjeta_numero_cifrado,
        tarjeta_ultimos4: current.tarjeta_ultimos4,
        tarjeta_mascara: current.tarjeta_mascara,

        modalidad_adhesion: current.modalidad_adhesion,
        titular_plan_id: current.titular_plan_id,

        beneficio_descripcion_snapshot: current.beneficio_descripcion_snapshot,
        beneficio_descuento_off_pct_snapshot:
          current.beneficio_descuento_off_pct_snapshot,
        beneficio_reintegro_pct_snapshot:
          current.beneficio_reintegro_pct_snapshot,
        beneficio_reintegro_desde_mes_snapshot:
          current.beneficio_reintegro_desde_mes_snapshot,
        beneficio_reintegro_duracion_meses_snapshot:
          current.beneficio_reintegro_duracion_meses_snapshot,

        // Benjamin Orellana - 09/04/2026 - Se persisten los tres valores comerciales vigentes del cliente aprobando con snapshot operativo.
        monto_inicial_vigente,
        descuento_vigente,
        monto_base_vigente,
        // Benjamin Orellana - 08/04/2026 - Se persiste el campo especial independiente del beneficio estándar del banco
        especial,
        moneda: 'ARS',

        observaciones_internas: appendObservacionInterna(
          current.observaciones_internas,
          observaciones
        )
      },
      { transaction: t }
    );

    if (
      adicionalSolicitud &&
      (current.modalidad_adhesion === 'AMBOS' ||
        current.modalidad_adhesion === 'SOLO_ADICIONAL')
    ) {
      await DebitosAutomaticosClientesAdicionalesModel.create(
        {
          cliente_id: clienteCreado.id,
          nombre: adicionalSolicitud.nombre,
          dni: adicionalSolicitud.dni,
          plan_id: adicionalSolicitud.plan_id
        },
        { transaction: t }
      );
    }

    const periodoInicio = getPeriodoFromDateOnly(fecha_inicio_cobro);

    if (!periodoInicio) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'No se pudo resolver el período inicial del débito.'
      });
    }

    const periodoExistente = await DebitosAutomaticosPeriodosModel.findOne({
      where: {
        cliente_id: clienteCreado.id,
        periodo_anio: periodoInicio.periodo_anio,
        periodo_mes: periodoInicio.periodo_mes
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (periodoExistente) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'Ya existe un período inicial para este cliente en el mes de inicio indicado.'
      });
    }

    const descuentoAplicado = Number(
      current.beneficio_descuento_off_pct_snapshot || 0
    );
    const reintegroAplicado = Number(
      current.beneficio_reintegro_pct_snapshot || 0
    );

    const montoNetoEstimado = calcularMontoNetoEstimadoPeriodo({
      montoBruto: monto_base_vigente,
      descuentoOffPct: descuentoAplicado,
      reintegroPct: reintegroAplicado
    });

    // Benjamin Orellana - 10/04/2026 - Se persiste en el período inicial el snapshot comercial completo del cliente: monto inicial, descuento porcentual y monto final
    await DebitosAutomaticosPeriodosModel.create(
      {
        cliente_id: clienteCreado.id,

        periodo_anio: periodoInicio.periodo_anio,
        periodo_mes: periodoInicio.periodo_mes,

        estado_envio: 'PENDIENTE',
        estado_cobro: 'PENDIENTE',
        accion_requerida: 'NINGUNA',

        motivo_codigo: null,
        motivo_detalle: null,

        monto_inicial_cliente_aplicado: monto_inicial_vigente,
        descuento_cliente_pct_aplicado: descuento_vigente,
        monto_bruto: monto_base_vigente,
        descuento_off_pct_aplicado: descuentoAplicado,
        reintegro_pct_aplicado: reintegroAplicado,
        monto_neto_estimado: montoNetoEstimado,

        fecha_envio: null,
        fecha_resultado: null,
        archivo_banco_id: null,

        observaciones: null,
        creado_por: actorUserId,
        updated_by: actorUserId
      },
      { transaction: t }
    );

    await DebitosAutomaticosSolicitudesModel.update(
      {
        estado: ESTADOS.APROBADA,
        revisado_por: actorUserId,
        revisado_at: new Date(),
        motivo_rechazo: null,
        observaciones_internas: appendObservacionInterna(
          current.observaciones_internas,
          observaciones
        ),
        updated_at: new Date()
      },
      { where: { id }, transaction: t }
    );

    await t.commit();

    const detalle = await getSolicitudDetalleById(id);

    // Benjamin Orellana - 07/04/2026 - Se programa el email de aprobación luego del commit para no bloquear la respuesta y evitar variable indefinida.
    // const email_resultado = scheduleSolicitudEmailDispatch({
    //   solicitudId: id,
    //   evento: 'SOLICITUD_APROBADA',
    //   detalle
    // });

    return res.json({
      message: 'Solicitud aprobada correctamente.',
      registroActualizado: detalle,
      clienteCreado: {
        id: clienteCreado.id,
        solicitud_id: clienteCreado.solicitud_id,
        estado_general: clienteCreado.estado_general,
        sede_id: clienteCreado.sede_id,
        monto_inicial_vigente: clienteCreado.monto_inicial_vigente,
        descuento_vigente: clienteCreado.descuento_vigente,
        monto_base_vigente: clienteCreado.monto_base_vigente,
        fecha_aprobacion: clienteCreado.fecha_aprobacion,
        fecha_inicio_cobro: clienteCreado.fecha_inicio_cobro
      },
      email_resultado: null
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({
      mensajeError: error.message || 'Error interno al aprobar la solicitud.'
    });
  }
};
/* =========================
   UR - rechazar
========================= */
export const UR_DebitosAutomaticosSolicitudesRechazar_CTS = async (
  req,
  res
) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);
    const motivo_rechazo = cleanStringOrNull(req.body?.motivo_rechazo, 500);
    const actorUserId = getActorUserId(req);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    if (!motivo_rechazo) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'motivo_rechazo es obligatorio.'
      });
    }

    const current = await DebitosAutomaticosSolicitudesModel.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!current) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    if (
      !validateTransition(current.estado, [
        ESTADOS.PENDIENTE,
        ESTADOS.OBSERVADA
      ])
    ) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'Solo se pueden rechazar solicitudes en estado PENDIENTE u OBSERVADA.'
      });
    }

    const clienteExistente = await DebitosAutomaticosClientesModel.findOne({
      where: { solicitud_id: id },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (clienteExistente) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'La solicitud ya posee un cliente asociado y no puede rechazarse.'
      });
    }

    const observaciones = req.body?.observaciones_internas
      ? String(req.body.observaciones_internas).trim()
      : null;

    await DebitosAutomaticosSolicitudesModel.update(
      {
        estado: ESTADOS.RECHAZADA,
        revisado_por: actorUserId,
        revisado_at: new Date(),
        motivo_rechazo,
        observaciones_internas: appendObservacionInterna(
          current.observaciones_internas,
          observaciones
        ),
        updated_at: new Date()
      },
      { where: { id }, transaction: t }
    );

    await t.commit();

    const detalle = await getSolicitudDetalleById(id);

    // Benjamin Orellana - 30/03/2026 - La notificación de rechazo se programa post-response y reutiliza el motivo actualizado.
    const email_resultado = scheduleSolicitudEmailDispatch({
      solicitudId: id,
      evento: 'SOLICITUD_RECHAZADA',
      detalle
    });

    return res.json({
      message: 'Solicitud rechazada correctamente.',
      registroActualizado: detalle,
      email_resultado
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({
      mensajeError: error.message || 'Error interno al rechazar la solicitud.'
    });
  }
};

/* =========================
   UR - observar
========================= */
export const UR_DebitosAutomaticosSolicitudesObservar_CTS = async (
  req,
  res
) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);
    const actorUserId = getActorUserId(req);
    const observaciones = cleanStringOrNull(
      req.body?.observaciones_internas,
      5000
    );

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    if (!observaciones) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'observaciones_internas es obligatorio para observar.'
      });
    }

    const current = await DebitosAutomaticosSolicitudesModel.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!current) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    if (
      !validateTransition(current.estado, [
        ESTADOS.PENDIENTE,
        ESTADOS.OBSERVADA
      ])
    ) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'Solo se pueden observar solicitudes en estado PENDIENTE u OBSERVADA.'
      });
    }

    const clienteExistente = await DebitosAutomaticosClientesModel.findOne({
      where: { solicitud_id: id },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (clienteExistente) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'La solicitud ya posee un cliente asociado y no puede observarse.'
      });
    }

    await DebitosAutomaticosSolicitudesModel.update(
      {
        estado: ESTADOS.OBSERVADA,
        revisado_por: actorUserId,
        revisado_at: new Date(),
        motivo_rechazo: null,
        observaciones_internas: appendObservacionInterna(
          current.observaciones_internas,
          observaciones
        ),
        updated_at: new Date()
      },
      { where: { id }, transaction: t }
    );

    await t.commit();

    const detalle = await getSolicitudDetalleById(id);

    return res.json({
      message: 'Solicitud observada correctamente.',
      registroActualizado: detalle
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({
      mensajeError: error.message || 'Error interno al observar la solicitud.'
    });
  }
};

/* =========================
   UR - cancelar
========================= */
export const UR_DebitosAutomaticosSolicitudesCancelar_CTS = async (
  req,
  res
) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);
    const actorUserId = getActorUserId(req);
    const observaciones = cleanStringOrNull(
      req.body?.observaciones_internas,
      5000
    );

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const current = await DebitosAutomaticosSolicitudesModel.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!current) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    if (
      !validateTransition(current.estado, [
        ESTADOS.PENDIENTE,
        ESTADOS.OBSERVADA
      ])
    ) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'Solo se pueden cancelar solicitudes en estado PENDIENTE u OBSERVADA.'
      });
    }

    const clienteExistente = await DebitosAutomaticosClientesModel.findOne({
      where: { solicitud_id: id },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (clienteExistente) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'La solicitud ya posee un cliente asociado y no puede cancelarse.'
      });
    }

    await DebitosAutomaticosSolicitudesModel.update(
      {
        estado: ESTADOS.CANCELADA,
        revisado_por: actorUserId,
        revisado_at: new Date(),
        motivo_rechazo: null,
        observaciones_internas: appendObservacionInterna(
          current.observaciones_internas,
          observaciones
        ),
        updated_at: new Date()
      },
      { where: { id }, transaction: t }
    );

    await t.commit();

    const detalle = await getSolicitudDetalleById(id);

    // Benjamin Orellana - 30/03/2026 - La notificación de cancelación se programa post-response y mantiene la respuesta ágil.
    const email_resultado = scheduleSolicitudEmailDispatch({
      solicitudId: id,
      evento: 'SOLICITUD_CANCELADA',
      detalle
    });

    return res.json({
      message: 'Solicitud cancelada correctamente.',
      registroActualizado: detalle,
      email_resultado
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({
      mensajeError: error.message || 'Error interno al cancelar la solicitud.'
    });
  }
};

/* =========================
   ER - delete lógico
   Regla:
   - no borrar físicamente
   - se transforma en CANCELADA
========================= */
export const ER_DebitosAutomaticosSolicitudes_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const current = await DebitosAutomaticosSolicitudesModel.findByPk(id, {
      transaction: t
    });

    if (!current) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    if (
      !validateTransition(current.estado, [
        ESTADOS.PENDIENTE,
        ESTADOS.OBSERVADA
      ])
    ) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'Solo se pueden eliminar lógicamente solicitudes en estado PENDIENTE u OBSERVADA.'
      });
    }

    await DebitosAutomaticosSolicitudesModel.update(
      {
        estado: ESTADOS.CANCELADA,
        revisado_por: getActorUserId(req),
        revisado_at: new Date()
      },
      { where: { id }, transaction: t }
    );

    await t.commit();

    return res.json({
      message: 'Solicitud eliminada lógicamente correctamente'
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* Benjamin Orellana - 08/04/2026 - Helper para obtener el inicio del día actual en Argentina y usarlo como corte de limpieza de solicitudes aprobadas */
const getArgentinaStartOfToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  return new Date(`${year}-${month}-${day}T00:00:00-03:00`);
};

/* Benjamin Orellana - 08/04/2026 - Limpia solicitudes aprobadas de días anteriores; los adicionales se eliminan por cascade desde la FK */
export const limpiarSolicitudesAprobadasVencidas_CRON = async () => {
  const t = await db.transaction();

  try {
    const startOfTodayArgentina = getArgentinaStartOfToday();

    const eliminadas = await DebitosAutomaticosSolicitudesModel.destroy({
      where: {
        estado: ESTADOS.APROBADA,
        [Op.or]: [
          {
            revisado_at: {
              [Op.lt]: startOfTodayArgentina
            }
          },
          {
            revisado_at: null,
            updated_at: {
              [Op.lt]: startOfTodayArgentina
            }
          }
        ]
      },
      transaction: t
    });

    await t.commit();

    console.log(
      `[CRON][DebitosAutomaticos] Limpieza OK. Solicitudes aprobadas eliminadas: ${eliminadas}. Corte aplicado: ${startOfTodayArgentina.toISOString()}`
    );

    return {
      ok: true,
      eliminadas,
      corte: startOfTodayArgentina
    };
  } catch (error) {
    await t.rollback();
    console.error(
      '[CRON][DebitosAutomaticos] Error al limpiar solicitudes aprobadas:',
      error
    );

    return {
      ok: false,
      eliminadas: 0,
      mensajeError: error?.message || 'Error al limpiar solicitudes aprobadas'
    };
  }
};
