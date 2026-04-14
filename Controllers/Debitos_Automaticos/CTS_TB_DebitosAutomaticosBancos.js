/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 12 / 03 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Controladores CRUD para la tabla 'debitos_automaticos_bancos'.
 * Incluye listado con filtros, obtención por ID, creación, actualización
 * y eliminación mediante baja lógica.
 *
 * Tema: Controladores - Débitos Automáticos Bancos
 * Capa: Backend
 *
 * Nomenclatura: OBR_  obtenerRegistro
 *              OBRS_ obtenerRegistros(plural)
 *              CR_   crearRegistro
 *              ER_   eliminarRegistro
 *              UR_   updateRegistro
 */

import db from '../../DataBase/db.js';
import DebitosAutomaticosBancosModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosBancos.js';

/* =========================
   Helpers
========================= */
const toIntOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
};

const toDecOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Number(n);
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

const pickBancoPayload = (body = {}) => {
  return {
    codigo: cleanStringOrNull(body.codigo, 30),
    nombre: cleanStringOrNull(body.nombre, 120),
    activo: toFlagOrUndefined(body.activo),
    descuento_off_pct: toDecOrNull(body.descuento_off_pct),
    reintegro_pct: toDecOrNull(body.reintegro_pct),
    reintegro_desde_mes: toIntOrNull(body.reintegro_desde_mes),
    reintegro_duracion_meses: toIntOrNull(body.reintegro_duracion_meses),
    beneficio_permanente: toFlagOrUndefined(body.beneficio_permanente),
    descripcion_publica: cleanStringOrNull(body.descripcion_publica, 255)
  };
};

const validatePct = (value, fieldName) => {
  if (value === null) return null;
  if (value < 0 || value > 100) {
    return `${fieldName} debe estar entre 0 y 100.`;
  }
  return null;
};

/* =========================
   OBRS - listar
   Filtros:
   ?activo=1
   ?q=macro
========================= */
export const OBRS_DebitosAutomaticosBancos_CTS = async (req, res) => {
  try {
    const { activo, q } = req.query;

    const where = {};

    if (activo !== undefined) {
      const activoInt = toIntOrNull(activo);
      if (activoInt === null || ![0, 1].includes(activoInt)) {
        return res.status(400).json({
          mensajeError: 'La query activo es inválida. Use 0 o 1.'
        });
      }
      where.activo = activoInt;
    }

    if (q && String(q).trim()) {
      const search = String(q).trim();

      where[db.Sequelize.Op.or] = [
        { codigo: { [db.Sequelize.Op.like]: `%${search}%` } },
        { nombre: { [db.Sequelize.Op.like]: `%${search}%` } },
        { descripcion_publica: { [db.Sequelize.Op.like]: `%${search}%` } }
      ];
    }

    const registros = await DebitosAutomaticosBancosModel.findAll({
      where,
      order: [
        ['activo', 'DESC'],
        ['nombre', 'ASC']
      ]
    });

    return res.json(registros);
  } catch (error) {
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   OBR - por ID
========================= */
export const OBR_DebitosAutomaticosBancos_CTS = async (req, res) => {
  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const registro = await DebitosAutomaticosBancosModel.findByPk(id);

    if (!registro) {
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    return res.json(registro);
  } catch (error) {
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   CR - crear
========================= */
export const CR_DebitosAutomaticosBancos_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const payload = pickBancoPayload(req.body);

    if (!payload.codigo) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'codigo es obligatorio.' });
    }

    if (!payload.nombre) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'nombre es obligatorio.' });
    }

    const errDesc = validatePct(
      payload.descuento_off_pct ?? 25,
      'descuento_off_pct'
    );
    if (errDesc) {
      await t.rollback();
      return res.status(400).json({ mensajeError: errDesc });
    }

    const errReint = validatePct(payload.reintegro_pct ?? 0, 'reintegro_pct');
    if (errReint) {
      await t.rollback();
      return res.status(400).json({ mensajeError: errReint });
    }

    if (
      payload.reintegro_desde_mes !== null &&
      payload.reintegro_desde_mes !== undefined &&
      payload.reintegro_desde_mes < 1
    ) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'reintegro_desde_mes debe ser mayor o igual a 1.'
      });
    }

    if (
      payload.reintegro_duracion_meses !== null &&
      payload.reintegro_duracion_meses !== undefined &&
      payload.reintegro_duracion_meses < 1
    ) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'reintegro_duracion_meses debe ser mayor o igual a 1.'
      });
    }

    const creado = await DebitosAutomaticosBancosModel.create(
      {
        codigo: payload.codigo,
        nombre: payload.nombre,
        activo: payload.activo ?? 1,
        descuento_off_pct: payload.descuento_off_pct ?? 25.0,
        reintegro_pct: payload.reintegro_pct ?? 0.0,
        reintegro_desde_mes: payload.reintegro_desde_mes,
        reintegro_duracion_meses: payload.reintegro_duracion_meses,
        beneficio_permanente: payload.beneficio_permanente ?? 1,
        descripcion_publica:
          payload.descripcion_publica ?? '25% off (permanente)'
      },
      { transaction: t }
    );

    await t.commit();

    return res.status(201).json({
      message: 'Registro creado correctamente',
      registro: creado
    });
  } catch (error) {
    await t.rollback();

    if (
      error?.name === 'SequelizeUniqueConstraintError' ||
      String(error?.original?.code || '').includes('ER_DUP_ENTRY')
    ) {
      return res.status(409).json({
        mensajeError: 'Ya existe un banco con el mismo código o nombre.'
      });
    }

    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   UR - update
========================= */
export const UR_DebitosAutomaticosBancos_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const current = await DebitosAutomaticosBancosModel.findByPk(id, {
      transaction: t
    });

    if (!current) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    const body = req.body || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

    const updateBody = {};

    if (has('codigo')) {
      const codigo = cleanStringOrNull(body.codigo, 30);
      if (!codigo) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'codigo no puede ser vacío.'
        });
      }
      updateBody.codigo = codigo;
    }

    if (has('nombre')) {
      const nombre = cleanStringOrNull(body.nombre, 120);
      if (!nombre) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'nombre no puede ser vacío.'
        });
      }
      updateBody.nombre = nombre;
    }

    if (has('activo')) {
      const activo = toFlagOrUndefined(body.activo);
      if (activo === null) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'activo debe ser 0 o 1.'
        });
      }
      updateBody.activo = activo;
    }

    if (has('descuento_off_pct')) {
      const descuento = toDecOrNull(body.descuento_off_pct);
      if (descuento === null) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'descuento_off_pct debe ser numérico.'
        });
      }

      const err = validatePct(descuento, 'descuento_off_pct');
      if (err) {
        await t.rollback();
        return res.status(400).json({ mensajeError: err });
      }

      updateBody.descuento_off_pct = descuento;
    }

    if (has('reintegro_pct')) {
      const reintegro = toDecOrNull(body.reintegro_pct);
      if (reintegro === null) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'reintegro_pct debe ser numérico.'
        });
      }

      const err = validatePct(reintegro, 'reintegro_pct');
      if (err) {
        await t.rollback();
        return res.status(400).json({ mensajeError: err });
      }

      updateBody.reintegro_pct = reintegro;
    }

    if (has('reintegro_desde_mes')) {
      const reintegroDesdeMes = toIntOrNull(body.reintegro_desde_mes);

      if (
        body.reintegro_desde_mes !== null &&
        body.reintegro_desde_mes !== '' &&
        reintegroDesdeMes === null
      ) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'reintegro_desde_mes debe ser numérico.'
        });
      }

      if (reintegroDesdeMes !== null && reintegroDesdeMes < 1) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'reintegro_desde_mes debe ser mayor o igual a 1.'
        });
      }

      updateBody.reintegro_desde_mes = reintegroDesdeMes;
    }

    if (has('reintegro_duracion_meses')) {
      const reintegroDuracion = toIntOrNull(body.reintegro_duracion_meses);

      if (
        body.reintegro_duracion_meses !== null &&
        body.reintegro_duracion_meses !== '' &&
        reintegroDuracion === null
      ) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'reintegro_duracion_meses debe ser numérico.'
        });
      }

      if (reintegroDuracion !== null && reintegroDuracion < 1) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'reintegro_duracion_meses debe ser mayor o igual a 1.'
        });
      }

      updateBody.reintegro_duracion_meses = reintegroDuracion;
    }

    if (has('beneficio_permanente')) {
      const beneficioPermanente = toFlagOrUndefined(body.beneficio_permanente);
      if (beneficioPermanente === null) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'beneficio_permanente debe ser 0 o 1.'
        });
      }
      updateBody.beneficio_permanente = beneficioPermanente;
    }

    if (has('descripcion_publica')) {
      updateBody.descripcion_publica =
        cleanStringOrNull(body.descripcion_publica, 255) ??
        '25% off (permanente)';
    }

    const [numRowsUpdated] = await DebitosAutomaticosBancosModel.update(
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

    await t.commit();

    const registroActualizado =
      await DebitosAutomaticosBancosModel.findByPk(id);

    return res.json({
      message: 'Registro actualizado correctamente',
      registroActualizado
    });
  } catch (error) {
    await t.rollback();

    if (
      error?.name === 'SequelizeUniqueConstraintError' ||
      String(error?.original?.code || '').includes('ER_DUP_ENTRY')
    ) {
      return res.status(409).json({
        mensajeError: 'Ya existe un banco con el mismo código o nombre.'
      });
    }

    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   ER - eliminar
========================= */
export const ER_DebitosAutomaticosBancos_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const registro = await DebitosAutomaticosBancosModel.findByPk(id, {
      transaction: t
    });

    if (!registro) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    await DebitosAutomaticosBancosModel.update(
      { activo: 0 },
      { where: { id }, transaction: t }
    );

    await t.commit();

    return res.json({
      message: 'Registro dado de baja correctamente'
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({ mensajeError: error.message });
  }
};
