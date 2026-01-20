/*
 * Programador: Sergio Manrique
 * Fecha Creación: 14 / 01 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Controladores CRUD y utilitarios para la tabla ventas_comisiones_vigentes_remarketing.
 *
 * Tema: Controladores - Comisiones Vigentes Remarketing (por período/mes)
 * Capa: Backend (Node.js + Sequelize)
 */

import db from '../DataBase/db.js';
import { Op } from 'sequelize';
import { VentasComisionesVigentesRemarketingModel } from '../Models/MD_TB_ventas_comisiones_vigentes_remarketing.js';

// ======================= Helpers =======================
const firstDayOfMonth = (anio, mes) => {
  // mes 1..12
  const m = Number(mes);
  const y = Number(anio);
  if (!y || !m || m < 1 || m > 12) return null;
  return new Date(Date.UTC(y, m - 1, 1)); // usamos UTC para evitar TZ-skews
};

const normalizaMesAnio = (mes, anio) => {
  // Si no vienen ambos, devolvemos null → el caller decide fallback al mes actual
  if (!mes || !anio) return null;
  const d = firstDayOfMonth(anio, mes);
  if (!d) return null;
  // Formato DATEONLY esperado 'YYYY-MM-DD'
  return d.toISOString().slice(0, 10);
};

// ======================= Listados =======================

/**
 * Listar comisiones vigentes de remarketing.
 * Query params opcionales:
 * - mes, anio: si ambos vienen, filtra por ese período (periodo_inicio = YYYY-MM-01)
 * - solo_activas: (1|true) filtra activo=1
 * - codigo: filtra por código puntual
 */
export const OBRS_ComisionesVigentesRemarketing_CTS = async (req, res) => {
  try {
    const { mes, anio, solo_activas, codigo } = req.query;

    const where = {};
    const periodo = normalizaMesAnio(mes, anio);

    if (periodo) where.periodo_inicio = periodo;
    if (solo_activas === '1' || String(solo_activas).toLowerCase() === 'true') {
      where.activo = true;
    }
    if (codigo) where.codigo = String(codigo).trim();

    const data = await VentasComisionesVigentesRemarketingModel.findAll({
      where,
      order: [
        ['periodo_inicio', 'DESC'],
        ['codigo', 'ASC']
      ]
    });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ mensajeError: err.message });
  }
};

/**
 * Obtener una comisión vigente de remarketing por ID.
 */
export const OBR_ComisionVigenteRemarketing_CTS = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await VentasComisionesVigentesRemarketingModel.findByPk(id);
    if (!item) {
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ mensajeError: err.message });
  }
};

// ======================= Altas / Ediciones =======================

/**
 * Crear comisión vigente de remarketing.
 * Body requerido:
 * - codigo (string)
 * - titulo (string)
 * - tipo_valor ('PORCENTAJE'|'MONTO_FIJO')
 * - valor (decimal)
 * - periodo_inicio (YYYY-MM-01) → si no viene, usa mes/anio; si nada, usa mes actual
 * Opcionales:
 * - moneda (3)
 * - detalle_texto (text)
 * - periodo_fin (YYYY-MM-DD)
 * - activo (boolean)
 */
export const CR_ComisionVigenteRemarketing_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const {
      codigo,
      titulo,
      tipo_valor,
      valor,
      moneda,
      detalle_texto,
      periodo_inicio,
      periodo_fin,
      activo,
      mes,
      anio
    } = req.body ?? {};

    // Resolver periodo_inicio
    let periodo = String(periodo_inicio ?? '').trim();
    if (!periodo) {
      const p = normalizaMesAnio(mes, anio);
      if (p) periodo = p;
    }
    if (!periodo) {
      // mes actual
      const hoy = new Date();
      const pAct = firstDayOfMonth(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1)
        .toISOString()
        .slice(0, 10);
      periodo = pAct;
    }

    // Validaciones mínimas
    if (!codigo || !titulo || !tipo_valor || typeof valor === 'undefined') {
      await t.rollback();
      return res.status(400).json({
        mensajeError:
          'Faltan campos obligatorios: codigo, titulo, tipo_valor, valor'
      });
    }

    if (!['PORCENTAJE', 'MONTO_FIJO'].includes(String(tipo_valor))) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'tipo_valor inválido (PORCENTAJE|MONTO_FIJO)' });
    }

    // Si es MONTO_FIJO, se recomienda moneda
    if (String(tipo_valor) === 'MONTO_FIJO' && !moneda) {
      // No lo bloqueamos, solo sugerimos; si quieres bloquear, cambia a 400
      // continue
    }

    // Enforce uniqueness (periodo_inicio, codigo)
    const existente = await VentasComisionesVigentesRemarketingModel.findOne({
      where: { periodo_inicio: periodo, codigo },
      transaction: t
    });
    if (existente) {
      await t.rollback();
      return res.status(409).json({
        mensajeError:
          'Ya existe una comisión con ese código para el período indicado'
      });
    }

    const nuevo = await VentasComisionesVigentesRemarketingModel.create(
      {
        codigo: String(codigo).trim(),
        titulo: String(titulo).trim(),
        tipo_valor: String(tipo_valor),
        valor,
        moneda: moneda ? String(moneda).trim() : null,
        detalle_texto: detalle_texto ?? null,
        periodo_inicio: periodo,
        periodo_fin: periodo_fin ?? null,
        activo: typeof activo === 'boolean' ? activo : true
      },
      { transaction: t }
    );

    await t.commit();
    return res.json({ message: 'Creado correctamente', data: nuevo });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ mensajeError: err.message });
  }
};

/**
 * Actualizar comisión vigente de remarketing por ID.
 * Restringimos actualización de clave (periodo_inicio+codigo) para evitar colisiones.
 * Para mover de mes, usar duplicado + baja de la anterior.
 */
export const UR_ComisionVigenteRemarketing_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const id = Number(req.params.id);
    const item = await VentasComisionesVigentesRemarketingModel.findByPk(id, {
      transaction: t
    });
    if (!item) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }

    const body = req.body ?? {};
    const ALLOWED = new Set([
      'titulo',
      'tipo_valor',
      'valor',
      'moneda',
      'detalle_texto',
      'periodo_fin',
      'activo'
    ]);

    const cambios = {};
    for (const k of Object.keys(body)) {
      if (!ALLOWED.has(k)) continue;
      const v = body[k];
      if (typeof v === 'string') cambios[k] = v.trim();
      else cambios[k] = v;
    }

    // Validación tipo_valor si viene
    if (
      Object.prototype.hasOwnProperty.call(cambios, 'tipo_valor') &&
      !['PORCENTAJE', 'MONTO_FIJO'].includes(String(cambios.tipo_valor))
    ) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'tipo_valor inválido (PORCENTAJE|MONTO_FIJO)' });
    }

    await VentasComisionesVigentesRemarketingModel.update(cambios, {
      where: { id },
      transaction: t
    });

    const refreshed = await VentasComisionesVigentesRemarketingModel.findByPk(id, {
      transaction: t
    });
    await t.commit();
    return res.json(refreshed);
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ mensajeError: err.message });
  }
};

/**
 * Eliminar comisión vigente de remarketing (hard delete por defecto).
 * Si preferís soft delete, reemplazar por update { activo: 0 }.
 */
export const ER_ComisionVigenteRemarketing_CTS = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const n = await VentasComisionesVigentesRemarketingModel.destroy({ where: { id } });
    if (!n) {
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
    return res.json({ message: 'Eliminado correctamente' });
  } catch (err) {
    return res.status(500).json({ mensajeError: err.message });
  }
};

// ======================= Utilitarios de período =======================

/**
 * Duplicar comisiones desde un período origen (mes/anio) a un período destino (mes/anio).
 * Si existe (periodo_destino, codigo) no duplica ese registro particular (idempotente).
 * Body:
 * - origen_mes, origen_anio
 * - destino_mes, destino_anio
 * - activar_destino (boolean, default true)
 */
export const DUP_ComisionesRemarketing_Mes_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const {
      origen_mes,
      origen_anio,
      destino_mes,
      destino_anio,
      activar_destino = true
    } = req.body ?? {};

    const pOrigen = normalizaMesAnio(origen_mes, origen_anio);
    const pDestino = normalizaMesAnio(destino_mes, destino_anio);

    if (!pOrigen || !pDestino) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'Periodo origen/destino inválido' });
    }

    const origen = await VentasComisionesVigentesRemarketingModel.findAll({
      where: { periodo_inicio: pOrigen },
      transaction: t
    });

    if (origen.length === 0) {
      await t.rollback();
      return res
        .status(404)
        .json({ mensajeError: 'No hay comisiones en el período origen' });
    }

    // Crear las que no existan aún en destino
    let creados = 0;
    for (const o of origen) {
      const ya = await VentasComisionesVigentesRemarketingModel.findOne({
        where: { periodo_inicio: pDestino, codigo: o.codigo },
        transaction: t
      });
      if (ya) continue;


      await VentasComisionesVigentesRemarketingModel.create(
        {
          codigo: o.codigo,
          titulo: o.titulo,
          tipo_valor: o.tipo_valor,
          valor: o.valor,
          moneda: o.moneda,
          detalle_texto: o.detalle_texto,
          periodo_inicio: pDestino,
          periodo_fin: null,
          activo: !!activar_destino
        },
        { transaction: t }
      );
      creados++;
    }

    await t.commit();
    return res.json({
      message: 'Duplicación completada',
      creados,
      periodo_origen: pOrigen,
      periodo_destino: pDestino
    });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ mensajeError: err.message });
  }
};

/**
 * Desactivar todas las comisiones de remarketing de un período (bulk).
 * Query/body:
 * - mes, anio  (o periodo_inicio directo)
 */
export const DESACTIVAR_ComisionesRemarketing_Mes_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const { mes, anio, periodo_inicio } = Object.assign(
      {},
      req.query,
      req.body
    );

    let periodo = String(periodo_inicio ?? '').trim();
    if (!periodo) {
      const p = normalizaMesAnio(mes, anio);
      if (p) periodo = p;
    }
    if (!periodo) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'Periodo inválido para desactivar' });
    }

    const [n] = await VentasComisionesVigentesRemarketingModel.update(
      { activo: false },
      { where: { periodo_inicio: periodo }, transaction: t }
    );

    await t.commit();
    return res.json({ message: 'Período desactivado', registros_afectados: n });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ mensajeError: err.message });
  }
};

// ======================= Búsquedas rápidas =======================

/**
 * Obtener comisión de remarketing por código para un período.
 * Query:
 * - codigo (requerido)
 * - mes, anio (si no vienen, usa mes actual)
 */
export const OBR_ComisionRemarketingPorCodigo_CTS = async (req, res) => {
  try {
    const { codigo, mes, anio } = req.query;
    if (!codigo) {
      return res.status(400).json({ mensajeError: 'Falta parámetro: codigo' });
    }

    let periodo = normalizaMesAnio(mes, anio);
    if (!periodo) {
      const hoy = new Date();
      periodo = firstDayOfMonth(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1)
        .toISOString()
        .slice(0, 10);
    }

    const item = await VentasComisionesVigentesRemarketingModel.findOne({
      where: {
        periodo_inicio: periodo,
        codigo: String(codigo).trim(),
        activo: true
      }
    });

    if (!item) {
      return res.status(404).json({
        mensajeError: 'No existe comisión activa para ese código/período',
        periodo
      });
    }

    return res.json(item);
  } catch (err) {
    return res.status(500).json({ mensajeError: err.message });
  }
};

// ======================= Export =======================
export default {
  OBRS_ComisionesVigentesRemarketing_CTS,
  OBR_ComisionVigenteRemarketing_CTS,
  CR_ComisionVigenteRemarketing_CTS,
  UR_ComisionVigenteRemarketing_CTS,
  ER_ComisionVigenteRemarketing_CTS,
  DUP_ComisionesRemarketing_Mes_CTS,
  DESACTIVAR_ComisionesRemarketing_Mes_CTS,
  OBR_ComisionRemarketingPorCodigo_CTS
};