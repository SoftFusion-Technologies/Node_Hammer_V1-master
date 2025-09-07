/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 15 / 06 / 2025
 * Versión: 1.0
 *
 * Tema: Controladores - Ventas Agenda (seguimiento post clase de prueba)
 * Capa: Backend
 */

import cron from 'node-cron';
import { QueryTypes } from 'sequelize';
import db from '../DataBase/db.js';
import { VentasAgendaModel } from '../Models/MD_TB_VentasAgenda.js';
import { VentasProspectosModel } from '../Models/MD_TB_ventas_prospectos.js';
import NotificationModel from '../Models/MD_TB_Notifications.js'; // 🔔 notificaciones

function ymd(d) {
  return d.toISOString().slice(0, 10);
}
function rangoAyer() {
  const hoy = new Date();
  const start = new Date(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate() - 1,
    0,
    0,
    0
  );
  const end = new Date(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate(),
    0,
    0,
    0
  );
  return { start, end };
}

// =========================
// Generar agenda (AYER)
// =========================
export const GEN_AgendaSeguimientoVentas = async () => {
  // Ayer por fecha (ignora hora)
  const q = `
    SELECT id AS prospecto_id, usuario_id, nombre, contacto, actividad, sede, asesor_nombre,
           1 AS clase_num, clase_prueba_1_fecha AS clase_fecha
      FROM ventas_prospectos
     WHERE DATE(clase_prueba_1_fecha) = CURDATE() - INTERVAL 1 DAY
    UNION ALL
    SELECT id, usuario_id, nombre, contacto, actividad, sede, asesor_nombre,
           2 AS clase_num, clase_prueba_2_fecha
      FROM ventas_prospectos
     WHERE DATE(clase_prueba_2_fecha) = CURDATE() - INTERVAL 1 DAY
    UNION ALL
    SELECT id, usuario_id, nombre, contacto, actividad, sede, asesor_nombre,
           3 AS clase_num, clase_prueba_3_fecha
      FROM ventas_prospectos
     WHERE DATE(clase_prueba_3_fecha) = CURDATE() - INTERVAL 1 DAY
  `;

  const candidatos = await db.query(q, { type: QueryTypes.SELECT });
  if (!candidatos.length) return 0;

  const hoyStr = new Date().toISOString().slice(0, 10);
  let creados = 0;

  for (const c of candidatos) {
    const fechaClaseStr = new Date(c.clase_fecha).toISOString().slice(0, 10);
    const mensaje =
      '¡Ayer tuvo una clase de prueba! Consúltale cómo fue su experiencia';

    const [row, created] = await VentasAgendaModel.findOrCreate({
      where: {
        prospecto_id: c.prospecto_id,
        clase_num: c.clase_num,
        fecha_clase: fechaClaseStr
      },
      defaults: { usuario_id: c.usuario_id, followup_date: hoyStr, mensaje }
    });

    if (created) {
      creados++;
      // (si activaste noti) crea la notificación acá
    }
  }
  return creados;
};


// =========================
// Endpoints
// =========================

// Lista la agenda de HOY (pendientes). Admin ve todos; otros por usuario_id.
// Tip: agregar ?with_prospect=1 para incluir datos del prospecto
export const GET_AgendaHoy = async (req, res) => {
  try {
    const { usuario_id, level, with_prospect } = req.query;

    const where = { followup_date: ymd(new Date()) }; // 👈 sin filtro done
    if (level !== 'admin') {
      if (!usuario_id)
        return res.status(400).json({ mensajeError: 'Debe enviar usuario_id' });
      where.usuario_id = usuario_id;
    }

    const include =
      with_prospect === '1'
        ? [
            {
              model: VentasProspectosModel,
              as: 'prospecto',
              attributes: [
                'nombre',
                'contacto',
                'actividad',
                'sede',
                'asesor_nombre'
              ]
            }
          ]
        : [];

    const items = await VentasAgendaModel.findAll({
      where,
      include,
      // pendientes arriba, realizados abajo; luego por creación
      order: [
        ['done', 'ASC'],
        ['created_at', 'ASC']
      ]
    });

    res.json(items);
  } catch (e) {
    res.status(500).json({ mensajeError: e.message });
  }
};


// Contador para badge
export const GET_AgendaHoyCount = async (req, res) => {
  try {
    const { usuario_id, level } = req.query;
    const where = { followup_date: ymd(new Date()), done: false };
    if (level !== 'admin') {
      if (!usuario_id)
        return res.status(400).json({ mensajeError: 'Debe enviar usuario_id' });
      where.usuario_id = usuario_id;
    }
    const count = await VentasAgendaModel.count({ where });
    res.json({ count });
  } catch (e) {
    res.status(500).json({ mensajeError: e.message });
  }
};

// Marcar seguimiento como realizado
export const PATCH_AgendaDone = async (req, res) => {
  try {
    const { id } = req.params;
    const [n] = await VentasAgendaModel.update(
      { done: true, done_at: new Date() },
      { where: { id, done: false } }
    );
    if (!n)
      return res
        .status(404)
        .json({ mensajeError: 'No encontrado o ya completado' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ mensajeError: e.message });
  }
};

// (Opcional) Ejecutar generación manual (útil para pruebas)
export const POST_GenerarAgendaHoy = async (req, res) => {
  try {
    const n = await GEN_AgendaSeguimientoVentas();
    res.json({ creados: n });
  } catch (e) {
    res.status(500).json({ mensajeError: e.message });
  }
};

// =========================
// Cron diario 09:00 (Tucumán)
// =========================
let cronRunning = false;
export const SCHEDULE_VentasAgendaCron = () => {
  cron.schedule(
    '0 6 * * *',
    async () => {
      if (cronRunning) return;
      cronRunning = true;
      try {
        console.log('[CRON 06:00] Generar agenda de seguimiento (ventas)');
        const n = await GEN_AgendaSeguimientoVentas();
        if (n) console.log(`[Agenda Ventas] creados: ${n}`);
      } catch (e) {
        console.error('[Agenda Ventas] error:', e);
      } finally {
        cronRunning = false;
      }
    },
    { timezone: 'America/Argentina/Tucuman' }
  );
};
