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
import {VentasAgendaRemarketingModel} from '../Models/MD_TB_VentasAgendaRemarketing.js';
import VentasRemarketingModel from '../Models/MD_TB_VentasRemarketing.js';
import { Op, fn, col, where as sqlWhere } from 'sequelize';
import UsersModel from '../Models/MD_TB_Users.js';

import { norm, mapUserSedeToVp } from '../utils/sede.js';

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
// Generar agenda (AYER) — solo clase/visita, NO "Agenda"
// =========================
export const GEN_AgendaSeguimientoVentasRemarketing = async () => {
  const q = `
    SELECT id AS prospecto_id, usuario_id, nombre_socio AS nombre, contacto, actividad, sede,
           1 AS clase_num, clase_prueba_1_fecha AS clase_fecha, clase_prueba_1_tipo AS clase_tipo
      FROM ventas_remarketing
     WHERE DATE(clase_prueba_1_fecha) = CURDATE() - INTERVAL 1 DAY
       AND clase_prueba_1_tipo IN ('Clase de prueba','Visita programada')
    UNION ALL
    SELECT id, usuario_id, nombre_socio AS nombre, contacto, actividad, sede,
           2 AS clase_num, clase_prueba_2_fecha, clase_prueba_2_tipo
      FROM ventas_remarketing
     WHERE DATE(clase_prueba_2_fecha) = CURDATE() - INTERVAL 1 DAY
       AND clase_prueba_2_tipo IN ('Clase de prueba','Visita programada')
    UNION ALL
    SELECT id, usuario_id, nombre_socio AS nombre, contacto, actividad, sede,
           3 AS clase_num, clase_prueba_3_fecha, clase_prueba_3_tipo
      FROM ventas_remarketing
     WHERE DATE(clase_prueba_3_fecha) = CURDATE() - INTERVAL 1 DAY
       AND clase_prueba_3_tipo IN ('Clase de prueba','Visita programada')
  `;

  let candidatos = await db.query(q, { type: QueryTypes.SELECT });
  if (!candidatos.length) return 0;

  const hoyStr = new Date().toISOString().slice(0, 10);
  let creados = 0;

  for (const c of candidatos) {
    const fechaClaseStr = new Date(c.clase_fecha).toISOString().slice(0, 10);
    const isVisita = (c.clase_tipo || '').toLowerCase().includes('visita');
    const mensaje = isVisita
      ? `¡Ayer tenía una visita programada!`
      : `¡Ayer tuvo una clase de prueba! Consúltale cómo fue su experiencia`;

    const [row, created] = await VentasAgendaRemarketingModel.findOrCreate({
      where: {
        prospecto_id: c.prospecto_id,
        clase_num: c.clase_num,
        fecha_clase: fechaClaseStr
      },
      defaults: {
        usuario_id: c.usuario_id,
        followup_date: hoyStr,
        mensaje
      }
    });

    if (created) creados++;
  }
  return creados;
};

// =========================
// Endpoints
// =========================

// Lista la agenda de HOY (pendientes). Admin ve todos; otros por usuario_id.
// Tip: agregar ?with_prospect=1 para incluir datos del prospecto
export const GET_AgendaHoyRemarketing = async (req, res) => {
  try {
    const { usuario_id, level, with_prospect } = req.query;

    const byToday = sqlWhere(fn('DATE', col('followup_date')), fn('CURDATE'));
    let where = { [Op.and]: [byToday] };

    const include = [];
    const wantPros = with_prospect === '1';
    const lvl = norm(level);

    if (lvl === 'admin') {
      if (wantPros) {
        include.push({
          model: VentasRemarketingModel,
          as: 'prospecto',
          attributes: [
            'nombre_socio',
            'contacto',
            'actividad',
            'sede',
            'usuario_id'
          ],
          include: [
            {
              model: UsersModel,
              as: 'usuario',
              attributes: [['name', 'asesor_nombre']],
              required: false
            }
          ]
        });
      }
    } else {
      if (!usuario_id) {
        return res.status(400).json({ mensajeError: 'Debe enviar usuario_id' });
      }
      const user = await UsersModel.findByPk(usuario_id, {
        attributes: ['id', 'sede', 'level']
      });
      if (!user) {
        return res.status(404).json({ mensajeError: 'Usuario no encontrado' });
      }

      // Modificamos el where para traer tanto las agendas del usuario como las que tienen usuario_id null
      where = {
        ...where,
        [Op.or]: [
          { usuario_id: usuario_id },
          { usuario_id: null }
        ]
      };

      const mappedSede = mapUserSedeToVp(user.sede); // null => todas
      if (mappedSede) {
        include.push({
          model: VentasRemarketingModel,
          as: 'prospecto',
          attributes: wantPros
            ? ['nombre_socio', 'contacto', 'actividad', 'sede', 'usuario_id']
            : [],
          where: { sede: mappedSede },
          required: true,
          include: wantPros ? [
            {
              model: UsersModel,
              as: 'usuario',
              attributes: [['name', 'asesor_nombre']],
              required: false
            }
          ] : []
        });
      } else {
        // multisede -> todas
        if (wantPros) {
          include.push({
            model: VentasRemarketingModel,
            as: 'prospecto',
            attributes: [
              'nombre_socio',
              'contacto',
              'actividad',
              'sede',
              'usuario_id'
            ],
            include: [
              {
                model: UsersModel,
                as: 'usuario',
                attributes: [['name', 'asesor_nombre']],
                required: false
              }
            ]
          });
        }
      }
    }

    const items = await VentasAgendaRemarketingModel.findAll({
      where,
      include,
      order: [
        ['done', 'ASC'],
        ['created_at', 'ASC']
      ]
    });

    res.json(items);
  } catch (e) {
    console.log('GET_AgendaHoyRemarketing error:', e);
    res.status(500).json({ mensajeError: e.message });
  }
};

// Contador para badge
export const GET_AgendaHoyCountRemarketing = async (req, res) => {
  try {
    const { usuario_id, level } = req.query;

    const byToday = sqlWhere(fn('DATE', col('followup_date')), fn('CURDATE'));
    const where = { done: false, [Op.and]: [byToday] };

    const lvl = norm(level);
    const opts = { where }; // empezamos sin include

    if (lvl === 'admin') {
      // todas las sedes
    } else {
      if (!usuario_id) {
        return res.status(400).json({ mensajeError: 'Debe enviar usuario_id' });
      }
      const user = await UsersModel.findByPk(usuario_id, {
        attributes: ['id', 'sede', 'level']
      });
      if (!user) {
        return res.status(404).json({ mensajeError: 'Usuario no encontrado' });
      }

      const mappedSede = mapUserSedeToVp(user.sede); // null => todas
      if (mappedSede) {
        opts.include = [
          {
            model: VentasRemarketingModel,
            as: 'prospecto',
            attributes: [],
            where: { sede: mappedSede },
            required: true
          }
        ];
        opts.distinct = true; // por el join
      }
    }

    const count = await VentasAgendaRemarketingModel.count(opts);
    res.json({ count });
  } catch (e) {
    console.error('GET_AgendaHoyCount error:', e);
    res.status(500).json({ mensajeError: e.message });
  }
};


// Marcar seguimiento como realizado
export const PATCH_AgendaDoneRemarketing = async (req, res) => {
  try {
    const { id } = req.params;
    const [n] = await VentasAgendaRemarketingModel.update(
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
export const POST_GenerarAgendaHoyRemarketing = async (req, res) => {
  try {
    const n = await GEN_AgendaSeguimientoVentasRemarketing();
    res.json({ creados: n });
  } catch (e) {
    res.status(500).json({ mensajeError: e.message });
  }
};

// =========================
// Cron diario 09:00 (Tucumán)
// =========================
let cronRunning = false;
export const SCHEDULE_VentasAgendaCronRemarketing = () => {
  cron.schedule(
    '0 6 * * *',
    async () => {
      if (cronRunning) return;
      cronRunning = true;
      try {
        console.log('[CRON 06:00] Generar agenda de seguimiento (ventas)');
        const n = await GEN_AgendaSeguimientoVentasRemarketing();
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
