// utils/sede.js
export function norm(str = '') {
  return str
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD') // quita acentos
    .replace(/[\u0300-\u036f]/g, '');
}

// Mapea la sede del usuario (users.sede) al valor canonical del ENUM de VP.
// Devuelve:
//  - 'monteros' | 'concepcion' | 'barrio sur'  -> filtrar por esa sede
//  - null -> sin filtro (admin o multisede)
export function mapUserSedeToVp(userSede = '') {
  const s = norm(userSede);
  if (!s) return null;

  // Multisede => ver todas
  if (s === 'Multisede') return null;

  // Mapeos
  if (s === 'monteros') return 'monteros';
  if (s === 'concepcion' || s === 'concepcion') return 'concepcion'; // (ya normalizado)
  if (s === 'concepción') return 'concepcion'; // por si llega con acento de alguna otra fuente
  if (s === 'smt') return 'barrio sur';
  if (s === 'barrio sur' || s === 'barriosur') return 'barrio sur';

  // Barrio Norte (San Miguel BN)
  if (
    s === 'barrionorte' ||
    s === 'sanmiguelbn' ||
    s === 'sanmiguelbarrionorte'
  )
    return 'barrio norte';
  // Por defecto: sin filtro (evita romper si aparece algo nuevo)
  return null;
}
