/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 30 / 03 / 2026
 * Versión: 2.0
 *
 * Descripción:
 * Templates HTML para emails del módulo Débitos Automáticos con identidad visual
 * orientada a Hammer. Usa paleta naranja, tipografía visual condensed fallback,
 * títulos en uppercase y bloques compatibles con clientes de correo.
 *
 * Tema: Débitos Automáticos - Templates Email
 * Capa: Backend
 */

// const logoUrl = process.env.MAIL_BRAND_LOGO_URL || null;
const logoUrl = null;

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR');
};

const buildPlanName = (planLike) =>
  planLike?.nombre || planLike?.name || planLike?.titulo || '—';

const buildBrandEmailLayout = ({
  eyebrow = 'HAMMERX',
  title = 'NOTIFICACIÓN',
  subtitle = '',
  intro = '',
  badgeText = '',
  summaryRows = [],
  highlightBox = '',
  footerText = 'Este es un mensaje automático del sistema de adhesiones por débito automático.',
  accent = '#ff5a00',
  accentSoft = '#fff1e8',
  accentBorder = '#ffd3bd',
  logoUrl = null
}) => {
  const summaryHtml = Array.isArray(summaryRows)
    ? summaryRows
        .map(
          (row) => `
            <tr>
              <td
                style="
                  padding:11px 18px;
                  font-family:Arial Narrow, Arial, Helvetica, sans-serif;
                  font-size:13px;
                  line-height:18px;
                  color:#7c8795;
                  text-transform:uppercase;
                  letter-spacing:0.7px;
                  border-bottom:1px solid #eef2f6;
                "
              >
                ${escapeHtml(row.label)}
              </td>
              <td
                align="right"
                style="
                  padding:11px 18px;
                  font-family:Arial Narrow, Arial, Helvetica, sans-serif;
                  font-size:13px;
                  line-height:18px;
                  color:#111827;
                  font-weight:800;
                  text-transform:uppercase;
                  letter-spacing:0.5px;
                  border-bottom:1px solid #eef2f6;
                "
              >
                ${escapeHtml(row.value)}
              </td>
            </tr>
          `
        )
        .join('')
    : '';

  return `
    <div style="margin:0; padding:24px 0; background:#f4f6f8;">
      <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        border="0"
        style="width:100%; border-collapse:collapse; background:#f4f6f8;"
      >
        <tr>
          <td align="center" style="padding:0 14px;">
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              border="0"
              style="
                width:100%;
                max-width:660px;
                border-collapse:separate;
                border-spacing:0;
                background:#ffffff;
                border:1px solid #e5e7eb;
                border-radius:22px;
                overflow:hidden;
              "
            >
              <tr>
                <td
                  style="
                    padding:0;
                    background:${accent};
                  "
                >
                  <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                    style="
                      width:100%;
                      border-collapse:collapse;
                      background:
                        linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%),
                        ${accent};
                    "
                  >
                    <tr>
                      <td style="padding:28px 30px 26px 30px;">
                        ${
                          logoUrl
                            ? `
                              <div style="margin-bottom:14px;">
                                <img
                                  src="${escapeHtml(logoUrl)}"
                                  alt="Hammer"
                                  style="
                                    display:block;
                                    max-width:220px;
                                    max-height:68px;
                                    width:auto;
                                    height:auto;
                                    border:0;
                                    outline:none;
                                    text-decoration:none;
                                  "
                                />
                              </div>
                            `
                            : `
                              <div
                                style="
                                  font-family:Arial Narrow, Arial, Helvetica, sans-serif;
                                  font-size:12px;
                                  line-height:16px;
                                  font-weight:800;
                                  letter-spacing:1.6px;
                                  text-transform:uppercase;
                                  color:#ffffff;
                                "
                              >
                                ${escapeHtml(eyebrow)}
                              </div>
                            `
                        }

                        <div
                          style="
                            font-family:'Arial Narrow', Arial, Helvetica, sans-serif;
                            font-size:36px;
                            line-height:38px;
                            font-weight:900;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:#ffffff;
                            margin-top:10px;
                          "
                        >
                          ${escapeHtml(title)}
                        </div>

                        ${
                          subtitle
                            ? `
                              <div
                                style="
                                  font-family:Arial, Helvetica, sans-serif;
                                  font-size:14px;
                                  line-height:22px;
                                  color:#fff4ee;
                                  margin-top:10px;
                                "
                              >
                                ${escapeHtml(subtitle)}
                              </div>
                            `
                            : ''
                        }

                        ${
                          badgeText
                            ? `
                              <div style="margin-top:16px;">
                                <span
                                  style="
                                    display:inline-block;
                                    padding:8px 14px;
                                    background:#ffffff;
                                    color:${accent};
                                    border-radius:999px;
                                    font-family:'Arial Narrow', Arial, Helvetica, sans-serif;
                                    font-size:13px;
                                    line-height:18px;
                                    font-weight:900;
                                    letter-spacing:0.8px;
                                    text-transform:uppercase;
                                  "
                                >
                                  ${escapeHtml(badgeText)}
                                </span>
                              </div>
                            `
                            : ''
                        }
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:30px 30px 18px 30px;">
                  ${
                    intro
                      ? `
                        <div
                          style="
                            font-family:Arial, Helvetica, sans-serif;
                            font-size:15px;
                            line-height:25px;
                            color:#4b5563;
                          "
                        >
                          ${intro}
                        </div>
                      `
                      : ''
                  }

                  <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    border="0"
                    style="
                      width:100%;
                      border-collapse:separate;
                      border-spacing:0;
                      margin-top:22px;
                      background:#ffffff;
                      border:1px solid #e9edf2;
                      border-radius:18px;
                      overflow:hidden;
                    "
                  >
                    <tr>
                      <td colspan="2" style="padding:16px 18px 8px 18px;">
                        <div
                          style="
                            font-family:Arial Narrow, Arial, Helvetica, sans-serif;
                            font-size:12px;
                            line-height:16px;
                            font-weight:900;
                            letter-spacing:1px;
                            text-transform:uppercase;
                            color:${accent};
                          "
                        >
                          Resumen
                        </div>
                      </td>
                    </tr>
                    ${summaryHtml}
                  </table>

                  ${
                    highlightBox
                      ? `
                        <div
                          style="
                            margin-top:18px;
                            padding:16px 18px;
                            background:${accentSoft};
                            border:1px solid ${accentBorder};
                            border-radius:16px;
                          "
                        >
                          ${highlightBox}
                        </div>
                      `
                      : ''
                  }
                </td>
              </tr>

              <tr>
                <td
                  style="
                    padding:18px 30px 24px 30px;
                    border-top:1px solid #edf2f7;
                    background:#fcfcfd;
                  "
                >
                  <div
                    style="
                      font-family:Arial, Helvetica, sans-serif;
                      font-size:12px;
                      line-height:20px;
                      color:#6b7280;
                    "
                  >
                    ${footerText}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
};

export const buildSolicitudRecibidaSubject = ({ solicitud }) => {
  return `Solicitud de débito automático recibida`;
};

/* Benjamin Orellana - 2026/04/13 - El email del titular ahora admite URL dinámica de carta PDF y muestra la versión legal congelada en la solicitud. */
export const buildSolicitudRecibidaTitularEmail = ({
  solicitud,
  adicional = null,
  cartaDocumentoUrl = null
}) => {
  const modalidad = solicitud?.modalidad_adhesion || '—';
  const banco =
    solicitud?.banco?.nombre || `Banco #${solicitud?.banco_id || '—'}`;
  const planTitular =
    buildPlanName(solicitud?.plan_titular) ||
    buildPlanName(solicitud?.titular_plan) ||
    '—';

  const adicionalesTexto = adicional?.nombre
    ? `${adicional.nombre}${adicional?.dni ? ` - DNI ${adicional.dni}` : ''}`
    : 'Sin adicionales';

  const tarjetaTexto = 'A confirmar; próximamente procesaremos tu pago';

  /* Benjamin Orellana - 2026/04/13 - Se construye la referencia del término legal aceptado para mostrarla en el email. */
  const terminoLegalTexto =
    solicitud?.termino_version && solicitud?.termino_titulo
      ? `${solicitud.termino_version} - ${solicitud.termino_titulo}`
      : solicitud?.termino_version ||
        solicitud?.termino_titulo ||
        'Versión vigente';

  // const cartaDocumentoUrl = process.env.MAIL_HAMMER_CARTA_DOCUMENTO_URL || null;

  const logoUrl = process.env.MAIL_BRAND_LOGO_URL || null;

  const whatsappUrl = 'https://linktr.ee/hammerx.whatsapp';
  const emailBajas = 'bajas@hammer.ar';

  const intro = `
    <div
      style="
        font-family:Arial, Helvetica, sans-serif;
        font-size:15px;
        line-height:25px;
        color:#4b5563;
      "
    >
      ¡Gracias por adherirte a nuestro débito automático!
    </div>

    <div
      style="
        font-family:Arial, Helvetica, sans-serif;
        font-size:15px;
        line-height:25px;
        color:#4b5563;
        margin-top:14px;
      "
    >
      Por medio de esta confirmación automática, dejamos constancia de que has solicitado la adhesión al servicio de débito automático.
      A través de este medio de pago podrás acceder a los beneficios y descuentos vigentes
      <span style="font-weight:700; color:#111827;">
        (por favor nunca respondas a este e-mail; para contactarte, realizalo por nuestros canales habituales)
      </span>.
    </div>

    <div
      style="
        font-family:Arial, Helvetica, sans-serif;
        font-size:15px;
        line-height:25px;
        color:#4b5563;
        margin-top:14px;
      "
    >
      En este correo te compartimos el detalle de los datos registrados, para tu tranquilidad.
      Te solicitamos revisarlos cuidadosamente a fin de evitar cualquier inconveniente futuro.
    </div>
  `;

  const highlightBox = `
    <div
      style="
        font-family:Arial Narrow, Arial, Helvetica, sans-serif;
        font-size:13px;
        line-height:19px;
        font-weight:900;
        letter-spacing:0.8px;
        text-transform:uppercase;
        color:#9a3412;
      "
    >
      Protección de datos
    </div>

    <div
      style="
        font-family:Arial, Helvetica, sans-serif;
        font-size:13px;
        line-height:21px;
        color:#9a3412;
        margin-top:6px;
      "
    >
      Te confirmamos asimismo que todos los datos brindados se encuentran debidamente protegidos y serán tratados con la correspondiente confidencialidad.
    </div>

    <div
      style="
        font-family:Arial Narrow, Arial, Helvetica, sans-serif;
        font-size:13px;
        line-height:19px;
        font-weight:900;
        letter-spacing:0.8px;
        text-transform:uppercase;
        color:#9a3412;
        margin-top:14px;
      "
    >
      Importante
    </div>

    <div
      style="
        font-family:Arial, Helvetica, sans-serif;
        font-size:13px;
        line-height:21px;
        color:#9a3412;
        margin-top:6px;
      "
    >
      Recordá que para solicitar tu baja debés realizarlo con 30 días de anticipación para poder procesarla correctamente y no tener inconvenientes con los cierres de tarjeta.
      Realizalo al siguiente e-mail:
      <a
        href="mailto:${escapeHtml(emailBajas)}"
        style="color:#9a3412; font-weight:700; text-decoration:underline;"
      >
        ${escapeHtml(emailBajas)}
      </a>
    </div>

    <div
      style="
        font-family:Arial, Helvetica, sans-serif;
        font-size:13px;
        line-height:21px;
        color:#9a3412;
        margin-top:12px;
      "
    >
      Ante cualquier duda o si detectás algún error en la información consignada, te pedimos que te comuniques con nosotros a la brevedad en mostrador o por nuestro WhatsApp desde el siguiente link:
      <a
        href="${escapeHtml(whatsappUrl)}"
        target="_blank"
        rel="noreferrer"
        style="color:#9a3412; font-weight:700; text-decoration:underline;"
      >
        ${escapeHtml(whatsappUrl)}
      </a>
    </div>

    ${
      cartaDocumentoUrl
        ? `
          <div style="margin-top:18px;">
            <a
              href="${escapeHtml(cartaDocumentoUrl)}"
              target="_blank"
              rel="noreferrer"
              style="
                display:inline-block;
                background:#ffffff;
                color:#ff5a00;
                text-decoration:none;
                padding:12px 18px;
                border-radius:12px;
                border:1px solid #ffd3bd;
                font-family:Arial Narrow, Arial, Helvetica, sans-serif;
                font-size:13px;
                line-height:18px;
                font-weight:900;
                text-transform:uppercase;
                letter-spacing:0.8px;
              "
            >
              Descargar carta documento PDF
            </a>
          </div>
        `
        : ''
    }
  `;

  const html = buildBrandEmailLayout({
    eyebrow: 'Hammer',
    title: 'Solicitud recibida',
    subtitle: 'Débito automático',
    badgeText: null,
    intro,
    logoUrl,
    summaryRows: [
      {
        label: 'Nombre y apellido',
        value: solicitud?.titular_nombre || '—'
      },
      {
        label: 'DNI',
        value: solicitud?.titular_dni || '—'
      },
      {
        label: 'Plan contratado',
        value: planTitular
      },
      {
        label: 'Adicionales',
        value: adicionalesTexto
      },
      {
        label: 'Tarjeta',
        value: tarjetaTexto
      },
      {
        label: 'Banco',
        value: banco
      },
      {
        label: 'Marca',
        value: solicitud?.marca_tarjeta || '—'
      },
      {
        label: 'Modalidad',
        value: modalidad.replaceAll('_', ' ')
      },
      {
        label: 'Término legal',
        value: terminoLegalTexto
      }
    ],
    highlightBox
  });

  const text = [
    '¡Gracias por adherirte a nuestro débito automático!',
    '',
    'Por medio de esta confirmación automática, dejamos constancia de que has solicitado la adhesión al servicio de débito automático.',
    'A través de este medio de pago podrás acceder a los beneficios y descuentos vigentes.',
    '(Por favor nunca respondas a este e-mail; para contactarte, realizalo por nuestros canales habituales).',
    '',
    'En este correo te compartimos el detalle de los datos registrados, para tu tranquilidad.',
    'Te solicitamos revisarlos cuidadosamente a fin de evitar cualquier inconveniente futuro.',
    '',
    'Datos registrados:',
    `Nombre y apellido: ${solicitud?.titular_nombre || '—'}`,
    `DNI: ${solicitud?.titular_dni || '—'}`,
    `Plan contratado: ${planTitular}`,
    `Adicionales: ${adicionalesTexto}`,
    `Tarjeta: ${tarjetaTexto}`,
    `Término legal: ${terminoLegalTexto}`,
    '',
    'Te confirmamos asimismo que todos los datos brindados se encuentran debidamente protegidos y serán tratados con la correspondiente confidencialidad.',
    '',
    `Recordá que para solicitar tu baja debés realizarlo con 30 días de anticipación para poder procesarla correctamente y no tener inconvenientes con los cierres de tarjeta. Realizalo al siguiente e-mail: ${emailBajas}`,
    '',
    `Ante cualquier duda o si detectás algún error en la información consignada, te pedimos que te comuniques con nosotros a la brevedad en mostrador o por nuestro WhatsApp desde el siguiente link: ${whatsappUrl}`,
    cartaDocumentoUrl ? `Carta documento PDF: ${cartaDocumentoUrl}` : null
  ]
    .filter(Boolean)
    .join('\n');

  return { html, text };
};

// Benjamin Orellana - 30 / 03 / 2026 - Nuevo diseño Hammer para email al adicional cuando fue incluido en la solicitud.
export const buildSolicitudRecibidaAdicionalEmail = ({
  solicitud,
  adicional
}) => {
  const planAdicional =
    buildPlanName(adicional?.plan) || buildPlanName(adicional?.plan_rel) || '—';

  const intro = `
    Hola <b style="color:#111827;">${escapeHtml(
      adicional?.nombre || 'adicional'
    )}</b>, fuiste incluido como adicional en una solicitud de adhesión a débito automático.
  `;

  const html = buildBrandEmailLayout({
    eyebrow: 'HammerX',
    title: 'Alta adicional',
    subtitle: 'Fuiste agregado a una solicitud',
    // badgeText: `Solicitud #${solicitud?.id || '—'}`,
    intro,
    summaryRows: [
      { label: 'Adicional', value: adicional?.nombre || '—' },
      { label: 'DNI', value: adicional?.dni || '—' },
      { label: 'Titular', value: solicitud?.titular_nombre || '—' },
      { label: 'Plan', value: planAdicional },
      { label: 'Fecha', value: fmtDate(solicitud?.created_at) },
      { label: 'Estado', value: 'Pendiente' }
    ],
    highlightBox: `
      <div
        style="
          font-family:Arial, Helvetica, sans-serif;
          font-size:13px;
          line-height:21px;
          color:#9a3412;
        "
      >
        Esta adhesión todavía se encuentra en revisión administrativa.
      </div>
    `,
    logoUrl
  });

  const text = [
    `Hola ${adicional?.nombre || 'adicional'},`,
    '',
    'Fuiste incluido como adicional en una solicitud de adhesión a débito automático.',
    `Titular: ${solicitud?.titular_nombre || '—'}`,
    `Plan: ${planAdicional}`,
    `Solicitud: #${solicitud?.id || '—'}`,
    `Estado: PENDIENTE`
  ].join('\n');

  return { html, text };
};

// Benjamin Orellana - 30 / 03 / 2026 - Subject para estados posteriores de la solicitud.
export const buildSolicitudEstadoSubject = ({ solicitud, estado }) => {
  const estadoLabel = String(estado || 'ACTUALIZADA').replaceAll('_', ' ');
  return `Solicitud de débito automático ${estadoLabel} #${solicitud?.id || '—'}`;
};

// Benjamin Orellana - 30 / 03 / 2026 - Template visual genérico para estados APROBADA, OBSERVADA, RECHAZADA y CANCELADA.
export const buildSolicitudEstadoTitularEmail = ({
  solicitud,
  estado,
  motivo = null,
  observaciones = null
}) => {
  const estadoUpper = String(estado || '').toUpperCase();

  const configByEstado = {
    APROBADA: {
      title: 'Solicitud aprobada',
      subtitle: 'Tu adhesión fue confirmada',
      accent: '#ff5a00',
      accentSoft: '#fff1e8',
      accentBorder: '#ffd3bd'
    },
    OBSERVADA: {
      title: 'Solicitud observada',
      subtitle: 'Necesitamos revisar algunos datos',
      accent: '#f59e0b',
      accentSoft: '#fffbeb',
      accentBorder: '#fde68a'
    },
    RECHAZADA: {
      title: 'Solicitud rechazada',
      subtitle: 'No pudimos avanzar con la adhesión',
      accent: '#dc2626',
      accentSoft: '#fef2f2',
      accentBorder: '#fecaca'
    },
    CANCELADA: {
      title: 'Solicitud cancelada',
      subtitle: 'La adhesión fue cancelada',
      accent: '#6b7280',
      accentSoft: '#f3f4f6',
      accentBorder: '#d1d5db'
    }
  };

  const visual = configByEstado[estadoUpper] || {
    title: 'Solicitud actualizada',
    subtitle: 'Hubo un cambio en tu adhesión',
    accent: '#ff5a00',
    accentSoft: '#fff1e8',
    accentBorder: '#ffd3bd'
  };

  const banco =
    solicitud?.banco?.nombre || `Banco #${solicitud?.banco_id || '—'}`;

  const intro = `
    Hola <b style="color:#111827;">${escapeHtml(
      solicitud?.titular_nombre || 'cliente'
    )}</b>, te informamos que tu solicitud de adhesión a débito automático cambió de estado.
  `;

  const extraLines = [];
  if (motivo) {
    extraLines.push(`
      <div
        style="
          font-family:Arial Narrow, Arial, Helvetica, sans-serif;
          font-size:13px;
          line-height:19px;
          font-weight:900;
          letter-spacing:0.7px;
          text-transform:uppercase;
          color:#7c2d12;
        "
      >
        Motivo
      </div>
      <div
        style="
          font-family:Arial, Helvetica, sans-serif;
          font-size:13px;
          line-height:21px;
          color:#7c2d12;
          margin-top:4px;
        "
      >
        ${escapeHtml(motivo)}
      </div>
    `);
  }

  if (observaciones) {
    extraLines.push(`
      <div
        style="
          font-family:Arial Narrow, Arial, Helvetica, sans-serif;
          font-size:13px;
          line-height:19px;
          font-weight:900;
          letter-spacing:0.7px;
          text-transform:uppercase;
          color:#7c2d12;
          margin-top:10px;
        "
      >
        Observaciones
      </div>
      <div
        style="
          font-family:Arial, Helvetica, sans-serif;
          font-size:13px;
          line-height:21px;
          color:#7c2d12;
          margin-top:4px;
        "
      >
        ${escapeHtml(observaciones)}
      </div>
    `);
  }

  const html = buildBrandEmailLayout({
    eyebrow: 'HammerX',
    title: visual.title,
    subtitle: visual.subtitle,
    badgeText: `Estado ${estadoUpper}`,
    intro,
    accent: visual.accent,
    accentSoft: visual.accentSoft,
    accentBorder: visual.accentBorder,
    summaryRows: [
      { label: 'Solicitud', value: `#${solicitud?.id || '—'}` },
      { label: 'Titular', value: solicitud?.titular_nombre || '—' },
      { label: 'DNI', value: solicitud?.titular_dni || '—' },
      { label: 'Banco', value: banco },
      { label: 'Estado', value: estadoUpper },
      { label: 'Fecha', value: fmtDate(new Date()) }
    ],
    highlightBox: extraLines.join(''),
    logoUrl
  });

  const text = [
    `Hola ${solicitud?.titular_nombre || 'cliente'},`,
    '',
    `Tu solicitud #${solicitud?.id || '—'} cambió al estado ${estadoUpper}.`,
    `Banco: ${banco}`,
    motivo ? `Motivo: ${motivo}` : null,
    observaciones ? `Observaciones: ${observaciones}` : null
  ]
    .filter(Boolean)
    .join('\n');

  return { html, text };
};

// Benjamin Orellana - 30 / 03 / 2026 - Template visual para estados del adicional.
export const buildSolicitudEstadoAdicionalEmail = ({
  solicitud,
  adicional,
  estado,
  motivo = null,
  observaciones = null
}) => {
  const estadoUpper = String(estado || '').toUpperCase();

  const configByEstado = {
    APROBADA: {
      title: 'Alta confirmada',
      subtitle: 'La adhesión fue aprobada',
      accent: '#ff5a00',
      accentSoft: '#fff1e8',
      accentBorder: '#ffd3bd'
    },
    OBSERVADA: {
      title: 'Solicitud observada',
      subtitle: 'Hay datos para revisar',
      accent: '#f59e0b',
      accentSoft: '#fffbeb',
      accentBorder: '#fde68a'
    },
    RECHAZADA: {
      title: 'Solicitud rechazada',
      subtitle: 'No se pudo aprobar la adhesión',
      accent: '#dc2626',
      accentSoft: '#fef2f2',
      accentBorder: '#fecaca'
    },
    CANCELADA: {
      title: 'Solicitud cancelada',
      subtitle: 'La adhesión fue cancelada',
      accent: '#6b7280',
      accentSoft: '#f3f4f6',
      accentBorder: '#d1d5db'
    }
  };

  const visual = configByEstado[estadoUpper] || {
    title: 'Solicitud actualizada',
    subtitle: 'Hubo un cambio en la adhesión',
    accent: '#ff5a00',
    accentSoft: '#fff1e8',
    accentBorder: '#ffd3bd'
  };

  const planAdicional =
    buildPlanName(adicional?.plan) || buildPlanName(adicional?.plan_rel) || '—';

  const extraLines = [];

  if (motivo) {
    extraLines.push(`
      <div
        style="
          font-family:Arial Narrow, Arial, Helvetica, sans-serif;
          font-size:13px;
          line-height:19px;
          font-weight:900;
          letter-spacing:0.7px;
          text-transform:uppercase;
          color:#7c2d12;
        "
      >
        Motivo
      </div>
      <div
        style="
          font-family:Arial, Helvetica, sans-serif;
          font-size:13px;
          line-height:21px;
          color:#7c2d12;
          margin-top:4px;
        "
      >
        ${escapeHtml(motivo)}
      </div>
    `);
  }

  if (observaciones) {
    extraLines.push(`
      <div
        style="
          font-family:Arial Narrow, Arial, Helvetica, sans-serif;
          font-size:13px;
          line-height:19px;
          font-weight:900;
          letter-spacing:0.7px;
          text-transform:uppercase;
          color:#7c2d12;
          margin-top:10px;
        "
      >
        Observaciones
      </div>
      <div
        style="
          font-family:Arial, Helvetica, sans-serif;
          font-size:13px;
          line-height:21px;
          color:#7c2d12;
          margin-top:4px;
        "
      >
        ${escapeHtml(observaciones)}
      </div>
    `);
  }

  const intro = `
    Hola <b style="color:#111827;">${escapeHtml(
      adicional?.nombre || 'adicional'
    )}</b>, te informamos que la solicitud donde figuras como adicional cambió de estado.
  `;

  const html = buildBrandEmailLayout({
    eyebrow: 'HammerX',
    title: visual.title,
    subtitle: visual.subtitle,
    badgeText: `Estado ${estadoUpper}`,
    intro,
    accent: visual.accent,
    accentSoft: visual.accentSoft,
    accentBorder: visual.accentBorder,
    summaryRows: [
      { label: 'Solicitud', value: `#${solicitud?.id || '—'}` },
      { label: 'Adicional', value: adicional?.nombre || '—' },
      { label: 'DNI', value: adicional?.dni || '—' },
      { label: 'Titular', value: solicitud?.titular_nombre || '—' },
      { label: 'Plan', value: planAdicional },
      { label: 'Estado', value: estadoUpper }
    ],
    highlightBox: extraLines.join(''),
    logoUrl
  });

  const text = [
    `Hola ${adicional?.nombre || 'adicional'},`,
    '',
    `La solicitud #${solicitud?.id || '—'} donde figuras como adicional cambió al estado ${estadoUpper}.`,
    `Titular: ${solicitud?.titular_nombre || '—'}`,
    `Plan: ${planAdicional}`,
    motivo ? `Motivo: ${motivo}` : null,
    observaciones ? `Observaciones: ${observaciones}` : null
  ]
    .filter(Boolean)
    .join('\n');

  return { html, text };
};

// Benjamin Orellana - 30 / 03 / 2026 - Wrapper de compatibilidad para subject por evento.
export const buildSolicitudEventSubject = ({ solicitud, evento }) => {
  const eventoUpper = String(evento || '').toUpperCase();

  if (eventoUpper === 'SOLICITUD_RECIBIDA') {
    return buildSolicitudRecibidaSubject({ solicitud });
  }

  const estadoMap = {
    SOLICITUD_APROBADA: 'APROBADA',
    SOLICITUD_OBSERVADA: 'OBSERVADA',
    SOLICITUD_RECHAZADA: 'RECHAZADA',
    SOLICITUD_CANCELADA: 'CANCELADA'
  };

  return buildSolicitudEstadoSubject({
    solicitud,
    estado: estadoMap[eventoUpper] || eventoUpper
  });
};

/* Benjamin Orellana - 2026/04/13 - Wrapper del titular preparado para recibir URL dinámica de carta PDF. */
export const buildSolicitudEventTitularEmail = ({
  solicitud,
  adicional = null,
  evento,
  motivo = null,
  observaciones = null,
  cartaDocumentoUrl = null
}) => {
  const eventoUpper = String(evento || '').toUpperCase();

  if (eventoUpper === 'SOLICITUD_RECIBIDA') {
    return buildSolicitudRecibidaTitularEmail({
      solicitud,
      adicional,
      cartaDocumentoUrl
    });
  }

  const estadoMap = {
    SOLICITUD_APROBADA: 'APROBADA',
    SOLICITUD_OBSERVADA: 'OBSERVADA',
    SOLICITUD_RECHAZADA: 'RECHAZADA',
    SOLICITUD_CANCELADA: 'CANCELADA'
  };

  return buildSolicitudEstadoTitularEmail({
    solicitud,
    estado: estadoMap[eventoUpper] || eventoUpper,
    motivo,
    observaciones
  });
};

// Benjamin Orellana - 30 / 03 / 2026 - Wrapper de compatibilidad para email del adicional por evento.
export const buildSolicitudEventAdicionalEmail = ({
  solicitud,
  adicional,
  evento,
  motivo = null,
  observaciones = null
}) => {
  const eventoUpper = String(evento || '').toUpperCase();

  if (eventoUpper === 'SOLICITUD_RECIBIDA') {
    return buildSolicitudRecibidaAdicionalEmail({
      solicitud,
      adicional
    });
  }

  const estadoMap = {
    SOLICITUD_APROBADA: 'APROBADA',
    SOLICITUD_OBSERVADA: 'OBSERVADA',
    SOLICITUD_RECHAZADA: 'RECHAZADA',
    SOLICITUD_CANCELADA: 'CANCELADA'
  };

  return buildSolicitudEstadoAdicionalEmail({
    solicitud,
    adicional,
    estado: estadoMap[eventoUpper] || eventoUpper,
    motivo,
    observaciones
  });
};
