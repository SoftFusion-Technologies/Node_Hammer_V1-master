/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 12 / 03 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Controladores para la tabla 'debitos_automaticos_terminos'.
 * Incluye lógica de histórico legal, término activo, activación exclusiva,
 * obtención del término vigente para frontend público y baja lógica.
 *
 * Tema: Controladores - Débitos Automáticos Términos
 * Capa: Backend
 *
 * Nomenclatura: OBR_  obtenerRegistro
 *              OBRS_ obtenerRegistros(plural)
 *              CR_   crearRegistro
 *              ER_   eliminarRegistro
 *              UR_   updateRegistro
 */

import { Op } from 'sequelize';
import db from '../../DataBase/db.js';
import DebitosAutomaticosTerminosModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosTerminos.js';

/* =========================
   Helpers
========================= */
const toIntOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
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

const toDateOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const buildVigenciaWhere = (now = new Date()) => ({
  [Op.and]: [
    {
      [Op.or]: [
        { publicado_desde: null },
        { publicado_desde: { [Op.lte]: now } }
      ]
    },
    {
      [Op.or]: [
        { publicado_hasta: null },
        { publicado_hasta: { [Op.gte]: now } }
      ]
    }
  ]
});

/* =========================
   OBRS - listar
   Filtros:
   ?activo=1
   ?vigente=1
   ?q=texto
========================= */
export const OBRS_DebitosAutomaticosTerminos_CTS = async (req, res) => {
  try {
    const { activo, vigente, q } = req.query;

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

    if (vigente !== undefined) {
      const vigenteInt = toIntOrNull(vigente);

      if (vigenteInt === null || ![0, 1].includes(vigenteInt)) {
        return res.status(400).json({
          mensajeError: 'La query vigente es inválida. Use 0 o 1.'
        });
      }

      if (vigenteInt === 1) {
        Object.assign(where, buildVigenciaWhere());
      }
    }

    if (q && String(q).trim()) {
      const search = String(q).trim();

      where[Op.or] = [
        { version: { [Op.like]: `%${search}%` } },
        { titulo: { [Op.like]: `%${search}%` } }
      ];
    }

    const registros = await DebitosAutomaticosTerminosModel.findAll({
      where,
      order: [
        ['activo', 'DESC'],
        ['publicado_desde', 'DESC'],
        ['id', 'DESC']
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
export const OBR_DebitosAutomaticosTerminos_CTS = async (req, res) => {
  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const registro = await DebitosAutomaticosTerminosModel.findByPk(id);

    if (!registro) {
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    return res.json(registro);
  } catch (error) {
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   OBR - término activo/vigente para frontend público
========================= */
export const OBR_DebitosAutomaticosTerminoActivo_CTS = async (req, res) => {
  try {
    const where = {
      activo: 1,
      ...buildVigenciaWhere()
    };

    const registro = await DebitosAutomaticosTerminosModel.findOne({
      where,
      order: [
        ['publicado_desde', 'DESC'],
        ['id', 'DESC']
      ]
    });

    if (!registro) {
      return res.status(404).json({
        mensajeError: 'No existe un término activo y vigente en este momento.'
      });
    }

    return res.json(registro);
  } catch (error) {
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   CR - crear
   Regla:
   - conserva historial
   - si viene activo=1, desactiva los demás
========================= */
export const CR_DebitosAutomaticosTerminos_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const version = cleanStringOrNull(req.body?.version, 30);
    const titulo = cleanStringOrNull(req.body?.titulo, 150);
    const contenido_html = req.body?.contenido_html
      ? String(req.body.contenido_html).trim()
      : null;
    const activo = toFlagOrUndefined(req.body?.activo);
    const publicado_desde = toDateOrNull(req.body?.publicado_desde);
    const publicado_hasta = toDateOrNull(req.body?.publicado_hasta);

    if (!version) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'version es obligatoria.' });
    }

    if (!titulo) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'titulo es obligatorio.' });
    }

    if (!contenido_html) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'contenido_html es obligatorio.'
      });
    }

    if (
      req.body?.publicado_desde !== undefined &&
      req.body?.publicado_desde !== null &&
      req.body?.publicado_desde !== '' &&
      !publicado_desde
    ) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'publicado_desde es inválido.'
      });
    }

    if (
      req.body?.publicado_hasta !== undefined &&
      req.body?.publicado_hasta !== null &&
      req.body?.publicado_hasta !== '' &&
      !publicado_hasta
    ) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'publicado_hasta es inválido.'
      });
    }

    if (
      publicado_desde &&
      publicado_hasta &&
      publicado_desde > publicado_hasta
    ) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'publicado_desde no puede ser mayor a publicado_hasta.'
      });
    }

    const activoFinal = activo ?? 0;

    if (activoFinal === 1) {
      await DebitosAutomaticosTerminosModel.update(
        { activo: 0 },
        { where: { activo: 1 }, transaction: t }
      );
    }

    const creado = await DebitosAutomaticosTerminosModel.create(
      {
        version,
        titulo,
        contenido_html,
        activo: activoFinal,
        publicado_desde,
        publicado_hasta
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
        mensajeError: 'Ya existe un término con la misma versión.'
      });
    }

    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   UR - update
   Regla:
   - nunca borra historial
   - si viene activo=1, desactiva los demás
========================= */
export const UR_DebitosAutomaticosTerminos_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const current = await DebitosAutomaticosTerminosModel.findByPk(id, {
      transaction: t
    });

    if (!current) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    const body = req.body || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

    const updateBody = {};

    if (has('version')) {
      const version = cleanStringOrNull(body.version, 30);
      if (!version) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'version no puede ser vacía.'
        });
      }
      updateBody.version = version;
    }

    if (has('titulo')) {
      const titulo = cleanStringOrNull(body.titulo, 150);
      if (!titulo) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'titulo no puede ser vacío.'
        });
      }
      updateBody.titulo = titulo;
    }

    if (has('contenido_html')) {
      const contenido = body.contenido_html
        ? String(body.contenido_html).trim()
        : '';
      if (!contenido) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'contenido_html no puede ser vacío.'
        });
      }
      updateBody.contenido_html = contenido;
    }

    const nextPublicadoDesde = has('publicado_desde')
      ? toDateOrNull(body.publicado_desde)
      : current.publicado_desde;

    const nextPublicadoHasta = has('publicado_hasta')
      ? toDateOrNull(body.publicado_hasta)
      : current.publicado_hasta;

    if (
      has('publicado_desde') &&
      body.publicado_desde !== null &&
      body.publicado_desde !== '' &&
      nextPublicadoDesde === null
    ) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'publicado_desde es inválido.'
      });
    }

    if (
      has('publicado_hasta') &&
      body.publicado_hasta !== null &&
      body.publicado_hasta !== '' &&
      nextPublicadoHasta === null
    ) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'publicado_hasta es inválido.'
      });
    }

    if (
      nextPublicadoDesde &&
      nextPublicadoHasta &&
      nextPublicadoDesde > nextPublicadoHasta
    ) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'publicado_desde no puede ser mayor a publicado_hasta.'
      });
    }

    if (has('publicado_desde')) {
      updateBody.publicado_desde = nextPublicadoDesde;
    }

    if (has('publicado_hasta')) {
      updateBody.publicado_hasta = nextPublicadoHasta;
    }

    if (has('activo')) {
      const activo = toFlagOrUndefined(body.activo);

      if (activo === null) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'activo debe ser 0 o 1.'
        });
      }

      if (activo === 1) {
        await DebitosAutomaticosTerminosModel.update(
          { activo: 0 },
          {
            where: {
              id: { [Op.ne]: id },
              activo: 1
            },
            transaction: t
          }
        );
      }

      updateBody.activo = activo;
    }

    const [numRowsUpdated] = await DebitosAutomaticosTerminosModel.update(
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
      await DebitosAutomaticosTerminosModel.findByPk(id);

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
        mensajeError: 'Ya existe un término con la misma versión.'
      });
    }

    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   UR - activar uno y desactivar los demás
========================= */
export const UR_DebitosAutomaticosTerminoActivar_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const registro = await DebitosAutomaticosTerminosModel.findByPk(id, {
      transaction: t
    });

    if (!registro) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    await DebitosAutomaticosTerminosModel.update(
      { activo: 0 },
      { where: { activo: 1 }, transaction: t }
    );

    await DebitosAutomaticosTerminosModel.update(
      { activo: 1 },
      { where: { id }, transaction: t }
    );

    await t.commit();

    const registroActualizado =
      await DebitosAutomaticosTerminosModel.findByPk(id);

    return res.json({
      message: 'Término activado correctamente',
      registroActualizado
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   ER - eliminar (baja lógica)
   Regla:
   - NO borrar físicamente
   - conservar histórico legal
========================= */
export const ER_DebitosAutomaticosTerminos_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const registro = await DebitosAutomaticosTerminosModel.findByPk(id, {
      transaction: t
    });

    if (!registro) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    await DebitosAutomaticosTerminosModel.update(
      { activo: 0 },
      { where: { id }, transaction: t }
    );

    await t.commit();

    return res.json({
      message: 'Registro desactivado correctamente'
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({ mensajeError: error.message });
  }
};
