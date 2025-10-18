// utils/names.js
export function slug(s = '') {
  return String(s)
    .normalize('NFKD') // separa acentos
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-zA-Z0-9._-]+/g, '-') // no alfanum => '-'
    .replace(/-+/g, '-') // colapsa '--'
    .replace(/^-|-$/g, '') // sin guiones extremos
    .toLowerCase();
}

export function formatDateYYYYMMDD(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function formatHHMMSS(d = new Date()) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}${mm}${ss}`;
}

/**
 * Genera nombre consistente:
 * hammerx-<cliente>-<YYYYMMDD>-<hhmmss>-id<informe_id>.pdf
 * - Si el informe trae fecha (DATE), se usa para YYYYMMDD; si no, hoy.
 * - La hora es la actual del servidor (hhmmss). Si preferís, podés usar created_at.
 */
export function getInformeFilename({ informe, cliente, prefix = 'hammerx' }) {
  const baseDate = informe?.fecha
    ? new Date(informe.fecha + 'T00:00:00') // fecha del informe
    : new Date();
  const ymd = formatDateYYYYMMDD(baseDate);
  const hms = formatHHMMSS(new Date()); // o usa created_at si lo tenés

  const nom = cliente?.nombre ? slug(cliente.nombre) : 'sin-nombre';
  const id = informe?.id ?? 'x';

  return `${prefix}-${nom}-${ymd}-${hms}-id${id}.pdf`;
}
