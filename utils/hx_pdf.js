// utils/hx_pdf.js
import { chromium } from 'playwright';

// --- helpers de formateo ---
const fmtNum = (n, d = 2) => (n ?? n === 0 ? Number(n).toFixed(d) : '—');
const fmtInt = (n) => (n ?? n === 0 ? Math.round(n) : '—');
const safe = (s) => (s ? String(s) : '—');

// Orden fijo según la plantilla
const MEAL_ORDER = [
  'desayuno',
  'media_manana', // (Media mañana)
  'almuerzo',
  'merienda',
  'cena',
  'snack_nocturno'
];

// Normaliza “tipo” a claves del orden fijo
function normalizeTipo(t) {
  if (!t) return 'sin_tipo';
  const x = String(t).toLowerCase().trim();
  if (x.startsWith('media')) return 'media_manana';
  if (x.includes('colacion')) return 'media_manana'; // si te llega “colación”, lo mapeamos a media mañana
  return x;
}

function groupComidasFixed(rows = []) {
  // Junta descripciones por tipo (orden 1..N) y luego renderiza en orden fijo de la plantilla
  const map = new Map(); // tipo -> [descr1, descr2, ...]
  for (const r of rows) {
    const tipo = normalizeTipo(r.tipo);
    const arr = map.get(tipo) || [];
    arr.push(r.descripcion || '');
    map.set(tipo, arr);
  }
  const out = [];
  for (const t of MEAL_ORDER) {
    out.push({ tipo: t, items: map.get(t) || [] });
  }
  return out;
}

function tipoNice(t) {
  const map = {
    desayuno: 'Desayuno',
    media_manana: 'Media mañana',
    almuerzo: 'Almuerzo',
    merienda: 'Merienda',
    cena: 'Cena',
    snack_nocturno: 'Snack nocturno',
    sin_tipo: '(Sin tipo)'
  };
  return map[t] || (t ? t.charAt(0).toUpperCase() + t.slice(1) : '(Sin tipo)');
}

// HTML que replica la estructura de la plantilla (títulos con ■, tablas y bloques)
/* Basado en la plantilla compartida: secciones y campos: 
   Datos del cliente; Resultados principales (tabla “Parámetro / Valor”);
   Interpretación; Recomendaciones de entrenamiento; Recomendaciones alimenticias;
   Ejemplos prácticos de alimentación; Objetivo.  :contentReference[oaicite:1]{index=1}
*/
function renderHTML({ cliente, informe, comidasRows }) {
  const fecha = safe(informe.fecha);
  const sexo = safe(cliente.sexo);
  const altura = fmtNum(informe.altura_m ?? cliente.altura_m, 2);
  const dni =  safe(cliente.dni);
  const block = (t) =>
    t
      ? t
          .split('\n')
          .map((p) => `<p>${p}</p>`)
          .join('')
      : '<p>—</p>';

  // Par de utilidades para filas
  const row = (label, value) =>
    `<tr><td class="c1">${label}</td><td class="c2">${value}</td></tr>`;

  // Comidas en orden fijo, si hay más de un ítem del mismo tipo, los concatenamos con “ | ”
  const comidasGrouped = groupComidasFixed(comidasRows || []);
  const comidasHTML = comidasGrouped
    .map(({ tipo, items }) => {
      const texto =
        items && items.length
          ? items
              .map(
                (s, i) => `${items.length > 1 ? `${i + 1}. ` : ''}${safe(s)}`
              )
              .join(' | ')
          : '—';
      return `<tr><td class="c1">${tipoNice(
        tipo
      )}</td><td class="c2">${texto}</td></tr>`;
    })
    .join('');

  // colores y estilos: ajustá los HEX en :root para matchear tu marca/plantilla
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Informe Nutricional y de Entrenamiento – HammerX</title>
  <style>
    /* ====== THEME ====== */
    :root{
      --brand: #FF6D2D;          /* barra y acentos (ajusta al color exacto) */
      --brand-2: #d25018ff;        /* acento secundario */
      --text: #1a1a1a;
      --muted: #666;
      --line: #e5e7eb;
      --bg-soft: #f7f8fb;
      --table-head-bg: #f2f4f8;
    }

    /* ====== PAGE ====== */
    @page { size: A4; margin: 16mm 16mm 18mm 16mm; }
    html, body { padding:0; margin:0; }
    body { font-family: Arial, Helvetica, sans-serif; color: var(--text); }

    /* ====== HEADER ====== */
    .brandbar{
      height: 48px;
      background: linear-gradient(90deg, var(--brand), var(--brand-2));
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .doc-title{
      display:flex; align-items:center; gap:10px; margin: 0 0 12px 0;
      font-size: 20px; font-weight: 700; color: var(--text);
    }
    .doc-title .sq{ width: 12px; height:12px; background: var(--brand); display:inline-block; }

    /* ====== SECTION TITLE ====== */
    .section{
      margin-top: 12px;
    }
    .section .title{
      display:flex; align-items:center; gap:8px; font-weight: 700; font-size: 14px;
      padding: 6px 0 6px 0; border-bottom: 2px solid var(--brand);
      margin-bottom: 8px;
    }
    .section .title .sq{ width: 10px; height:10px; background: var(--brand); display:inline-block; }

    /* ====== TABLES ====== */
    table { width:100%; border-collapse: collapse; }
    .kv th, .kv td { padding: 8px 10px; font-size: 12.5px; vertical-align: top; }
    .kv tr + tr td { border-top: 1px solid var(--line); }
    .kv .c1 { width:52%; background: #fff; }
    .kv .c2 { width:48%; text-align: right; color: var(--text); }

    .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
    .grid2 .pair { font-size: 12.5px; }
    .grid2 .label{ color: var(--muted); }
    .grid2 .value{ font-weight: 600; }

    /* ====== CARDS/BLOCKS ====== */
    .card{ border:1px solid var(--line); border-radius: 8px; padding: 10px 12px; background: #fff; }
    .muted{ color: var(--muted); font-size: 11px; margin-top: 6px; }

    /* ====== FOOTNOTE ====== */
    .foot{ margin-top: 12px; color: var(--muted); font-size: 11px; }

  </style>
</head>
<body>
  <div class="brandbar"></div>
  <h1 class="doc-title"><span class="sq"></span>Informe Nutricional y de Entrenamiento – HammerX</h1>

  <!-- Datos del cliente -->
  <section class="section">
    <div class="title"><span class="sq"></span>Datos del cliente</div>
    <div class="grid2">
      <div class="pair"><span class="label">Nombre:</span> <span class="value">${safe(
        cliente.nombre
      )}</span></div>
      <div class="pair"><span class="label">Fecha:</span> <span class="value">${fecha}</span></div>
      <div class="pair"><span class="label">Edad:</span> <span class="value">${fmtInt(
        informe.edad_anios
      )} años</span></div>
      <div class="pair"><span class="label">Sexo:</span> <span class="value">${sexo}</span></div>
      <div class="pair"><span class="label">Altura:</span> <span class="value">${altura} m</span></div>
      <div class="pair"><span class="label">Dni:</span> <span class="value">${dni} m</span></div>
    </div>
  </section>

  <!-- Resultados principales (tabla “Parámetro / Valor”) -->
  <section class="section">
    <div class="title"><span class="sq"></span>Resultados principales</div>
    <table class="kv">
      <tbody>
        ${row('Peso', `${fmtNum(informe.peso_kg)} kg`)}
        ${row(
          'IMC',
          `${fmtNum(informe.imc)} ${
            informe.imc_categoria ? '(' + informe.imc_categoria + ')' : ''
          }`
        )}
        ${row(
          'Grasa corporal',
          `${fmtNum(informe.grasa_pct)} % – ${fmtNum(informe.grasa_kg)} kg`
        )}
        ${row('Grasa visceral', `${fmtInt(informe.grasa_visceral)}`)}
        ${row(
          'Masa muscular esquelética',
          `${fmtNum(informe.masa_muscular_esqueletica_kg)} kg`
        )}
        ${row(
          'Masa libre de grasa (FFM)',
          `${fmtNum(informe.masa_libre_grasa_kg)} kg`
        )}
        ${row('Masa ósea/mineral', `${fmtNum(informe.masa_osea_kg)} kg`)}
        ${row('Calcio corporal', `${fmtNum(informe.calcio_kg, 3)} kg`)}
        ${row('Agua corporal total', `${fmtNum(informe.agua_total_kg)} kg`)}
        ${row('Proteínas', `${fmtNum(informe.proteinas_kg)} kg`)}
        ${row(
          'Metabolismo basal',
          `${fmtInt(informe.metabolismo_basal_kcal)} kcal`
        )}
        ${row(
          'Gasto energético total',
          `${fmtInt(informe.gasto_energetico_total_kcal)} kcal`
        )}
        ${row(
          'Edad metabólica',
          `${fmtInt(informe.edad_metabolica_anios)} años`
        )}
        ${row('Puntaje físico', `${fmtInt(informe.puntaje_fisico_100)} /100`)}
      </tbody>
    </table>
  </section>

  <!-- Interpretación -->
  <section class="section">
    <div class="title"><span class="sq"></span>Interpretación</div>
    <div class="card">${block(informe.interpretacion)}</div>
  </section>

  <!-- Recomendaciones de entrenamiento -->
  <section class="section">
    <div class="title"><span class="sq"></span>Recomendaciones de entrenamiento</div>
    <div class="card">${block(informe.rec_entrenamiento)}</div>
  </section>

  <!-- Recomendaciones alimenticias -->
  <section class="section">
    <div class="title"><span class="sq"></span>Recomendaciones alimenticias</div>
    <div class="card">${block(informe.rec_alimentacion)}</div>
  </section>

  <!-- Ejemplos prácticos de alimentación (orden fijo) -->
  <section class="section">
    <div class="title"><span class="sq"></span>Ejemplos prácticos de alimentación</div>
    <table class="kv">
      <tbody>
        ${comidasHTML}
      </tbody>
    </table>
  </section>

  <!-- Objetivo -->
  <section class="section">
    <div class="title"><span class="sq"></span>Objetivo</div>
    <div class="card">${block(informe.objetivo)}</div>
    <div class="foot">Este informe es orientativo. Consultar con un profesional matriculado para prescripción clínica.</div>
  </section>
</body>
</html>`;
}

export async function generateInformePDFBuffer({ cliente, informe, comidas }) {
  const html = renderHTML({ cliente, informe, comidasRows: comidas });

  // Si corrés en contenedores Linux sin sandbox, descomenta args:
  // const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  return pdfBuffer;
}
