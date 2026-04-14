/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 13 / 04 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Genera el PDF dinámico de la carta de aceptación de Débitos Automáticos
 * a partir del término vigente o del snapshot almacenado en la solicitud.
 *
 * Tema: Débitos Automáticos - PDF Carta
 * Capa: Backend / Service
 */

import puppeteer from 'puppeteer';
import DebitosAutomaticosTerminosModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosTerminos.js';

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR');
};

/* Benjamin Orellana - 13/04/2026 - Obtiene el término vigente priorizando activo y fecha de publicación. */
export const obtenerTerminoVigente = async () => {
  const now = new Date();

  const termino = await DebitosAutomaticosTerminosModel.findOne({
    where: {
      activo: 1
    },
    order: [['updated_at', 'DESC']]
  });

  if (!termino) return null;

  const desde = termino.publicado_desde
    ? new Date(termino.publicado_desde)
    : null;
  const hasta = termino.publicado_hasta
    ? new Date(termino.publicado_hasta)
    : null;

  if (desde && now < desde) return null;
  if (hasta && now > hasta) return null;

  return termino;
};

/* Benjamin Orellana - 2026/04/13 - Genera un PDF limpio de la carta para el cliente final, sin metadata operativa ni footer interno. */
export const buildCartaPdfHtml = ({ solicitud, termino }) => {
  const contenidoHtml =
    solicitud?.termino_html_snapshot ||
    termino?.contenido_html ||
    '<div><p>Sin contenido disponible.</p></div>';

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Carta de aceptación</title>
        <style>
          @page {
            size: A4;
            margin: 18mm 14mm 18mm 14mm;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
            color: #0f172a;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .pdf-root {
            width: 100%;
          }

          .pdf-sheet {
            width: 100%;
            max-width: 100%;
            margin: 0 auto;
          }

          .pdf-sheet * {
            box-sizing: border-box;
          }

          .pdf-sheet h1,
          .pdf-sheet h2,
          .pdf-sheet h3,
          .pdf-sheet h4,
          .pdf-sheet h5,
          .pdf-sheet h6,
          .pdf-sheet p,
          .pdf-sheet ul,
          .pdf-sheet ol,
          .pdf-sheet li,
          .pdf-sheet div,
          .pdf-sheet span,
          .pdf-sheet strong,
          .pdf-sheet em,
          .pdf-sheet u {
            max-width: 100%;
            word-break: break-word;
          }
        </style>
      </head>
      <body>
        <div class="pdf-root">
          <div class="pdf-sheet">
            ${contenidoHtml}
          </div>
        </div>
      </body>
    </html>
  `;
};

/* Benjamin Orellana - 13/04/2026 - Genera buffer PDF listo para adjuntar o servir por endpoint. */
export const generarCartaPdfBuffer = async ({ solicitud, termino }) => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    const html = buildCartaPdfHtml({ solicitud, termino });

    await page.setContent(html, {
      waitUntil: 'networkidle0'
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
};
