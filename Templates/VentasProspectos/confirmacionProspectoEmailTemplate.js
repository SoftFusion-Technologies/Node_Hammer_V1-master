/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 21 / 04 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Template HTML para emails de confirmación del registro público de visitas
 * y clases de prueba. Reutiliza la identidad visual base usada en Débitos
 * Automáticos, pero con contenido simplificado y menos repetición de marca.
 *
 * Tema: Ventas Prospectos - Confirmación Email
 * Capa: Backend
 */

const logoUrl = process.env.MAIL_BRAND_LOGO_URL || null;

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

/* Benjamin Orellana - 2026/04/21 - Normaliza textos para comparar variantes del tipo de solicitud sin depender de mayúsculas. */
const normalizarTextoComparacion = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/* Benjamin Orellana - 2026/04/21 - Define el asunto del correo evitando repetir la marca innecesariamente. */
const buildSubject = ({ tipoLink = '' }) => {
  const tipo = String(tipoLink || '').trim();
  if (!tipo) return 'Confirmación de solicitud';
  return `${tipo} confirmada`;
};

/* Benjamin Orellana - 2026/04/21 - Define un título principal más claro según el tipo de solicitud. */
const buildTitle = ({ tipoLink = '', profesorNombre = '' }) => {
  const tipo = normalizarTextoComparacion(tipoLink);

  if (tipo.includes('clase de prueba')) {
    return profesorNombre ? 'Clase confirmada' : 'Clase registrada';
  }

  if (tipo.includes('visita programada')) {
    return profesorNombre ? 'Visita confirmada' : 'Visita registrada';
  }

  return 'Solicitud registrada';
};

/* Benjamin Orellana - 2026/04/21 - Define un subtítulo más útil con el próximo paso esperado para el prospecto. */
const buildSubtitle = ({ profesorNombre = '' }) => {
  if (profesorNombre) {
    return 'Ya dejamos registrada tu solicitud con profesor asignado.';
  }

  return 'Ya dejamos registrada tu solicitud correctamente.';
};

const buildBrandEmailLayout = ({
  eyebrow = 'HAMMER',
  title = 'NOTIFICACIÓN',
  subtitle = '',
  intro = '',
  badgeText = '',
  summaryRows = [],
  highlightBox = '',
  footerText = 'Este es un correo automático de confirmación.',
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

/* Benjamin Orellana - 2026/04/21 - Construye el email de confirmación de visitas y clases públicas con estilo Hammer simplificado. */
export const buildConfirmacionProspectoEmailTemplate = ({
  nombreCompleto = '',
  tipoLink = '',
  actividad = '',
  sede = '',
  fechaTexto = '',
  horaTexto = '',
  profesorNombre = ''
}) => {
  const subject = buildSubject({ tipoLink });
  const title = buildTitle({ tipoLink, profesorNombre });
  const subtitle = buildSubtitle({ profesorNombre });

  const profesorTexto = profesorNombre
    ? profesorNombre
    : 'A confirmar por el equipo';

  const intro = `
    Hola <b style="color:#111827;">${escapeHtml(
      nombreCompleto || 'cliente'
    )}</b>, registramos correctamente tu solicitud.
    <br /><br />
    A continuación te compartimos el resumen con los datos de tu turno para que puedas revisarlos con tranquilidad.
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
      Te recomendamos presentarte unos minutos antes del horario indicado.
      Si necesitás reprogramar tu visita o clase, comunicate con la sede correspondiente.
    </div>
  `;

  const html = buildBrandEmailLayout({
    eyebrow: 'Hammer',
    title,
    subtitle,
    badgeText: tipoLink || '',
    intro,
    summaryRows: [
      { label: 'Nombre', value: nombreCompleto || '—' },
      { label: 'Solicitud', value: tipoLink || '—' },
      { label: 'Actividad', value: actividad || '—' },
      { label: 'Sede', value: sede || '—' },
      { label: 'Fecha', value: fechaTexto || '—' },
      { label: 'Hora', value: horaTexto || '—' },
      { label: 'Profesor', value: profesorTexto }
    ],
    highlightBox,
    footerText:
      'Este correo confirma el registro de tu solicitud. No respondas a este email; ante cualquier duda, comunicate con la sede.',
    logoUrl
  });

  const text = [
    title,
    '',
    `Hola ${nombreCompleto || 'cliente'}, registramos correctamente tu solicitud.`,
    '',
    'Resumen:',
    `Solicitud: ${tipoLink || '—'}`,
    `Actividad: ${actividad || '—'}`,
    `Sede: ${sede || '—'}`,
    `Fecha: ${fechaTexto || '—'}`,
    `Hora: ${horaTexto || '—'}`,
    `Profesor: ${profesorTexto}`,
    '',
    'Te recomendamos presentarte unos minutos antes del horario indicado.',
    'Si necesitás reprogramar tu visita o clase, comunicate con la sede correspondiente.'
  ].join('\n');

  return { subject, html, text };
};

export default buildConfirmacionProspectoEmailTemplate;
