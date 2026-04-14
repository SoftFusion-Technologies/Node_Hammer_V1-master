/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 12 / 03 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Controladores CRUD para la tabla 'debitos_automaticos_planes'.
 * Incluye listado con filtros, obtención por ID, creación, actualización
 * y eliminación mediante baja lógica.
 *
 * Tema: Controladores - Débitos Automáticos Planes
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
import DebitosAutomaticosPlanesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPlanes.js';

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
  return Number(n.toFixed(2));
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

// Benjamin Orellana - 08/04/2026 - Calcula el precio final del plan aplicando descuento porcentual con piso en cero
const calcularPrecioFinalPlan = (precioReferencia, descuento) => {
  if (precioReferencia === null || precioReferencia === undefined) return null;

  const precio = Number(precioReferencia || 0);
  const descPct = Number(descuento || 0);

  if (!Number.isFinite(precio) || !Number.isFinite(descPct)) return null;

  const precioFinal = precio - precio * (descPct / 100);

  return Number(Math.max(precioFinal, 0).toFixed(2));
};

// Benjamin Orellana - 08/04/2026 - Valida la consistencia del plan entre precio inicial, descuento porcentual y precio final
const validarMontosPlan = ({ precioReferencia, descuento }) => {
  if (precioReferencia !== null && precioReferencia < 0) {
    return 'precio_referencia no puede ser negativo.';
  }

  if (descuento !== null && descuento < 0) {
    return 'descuento no puede ser negativo.';
  }

  if (descuento !== null && descuento > 100) {
    return 'descuento no puede ser mayor que 100.';
  }

  if (
    (precioReferencia === null || precioReferencia === undefined) &&
    descuento !== null &&
    descuento > 0
  ) {
    return 'No puedes informar descuento si precio_referencia es null.';
  }

  return null;
};

const pickPlanPayload = (body = {}) => {
  return {
    codigo: cleanStringOrNull(body.codigo, 30),
    nombre: cleanStringOrNull(body.nombre, 120),
    descripcion: cleanStringOrNull(body.descripcion, 255),
    activo: toFlagOrUndefined(body.activo),
    orden_visual: toIntOrNull(body.orden_visual),
    precio_referencia: toDecOrNull(body.precio_referencia),
    descuento: toDecOrNull(body.descuento)
  };
};
/* =========================
   OBRS - listar
   Filtros:
   ?activo=1
   ?q=plan
========================= */
export const OBRS_DebitosAutomaticosPlanes_CTS = async (req, res) => {
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

      where[Op.or] = [
        { codigo: { [Op.like]: `%${search}%` } },
        { nombre: { [Op.like]: `%${search}%` } },
        { descripcion: { [Op.like]: `%${search}%` } }
      ];
    }

    const registros = await DebitosAutomaticosPlanesModel.findAll({
      where,
      order: [
        ['activo', 'DESC'],
        ['orden_visual', 'ASC'],
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
export const OBR_DebitosAutomaticosPlanes_CTS = async (req, res) => {
  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const registro = await DebitosAutomaticosPlanesModel.findByPk(id);

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
export const CR_DebitosAutomaticosPlanes_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const payload = pickPlanPayload(req.body);

    if (!payload.codigo) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'codigo es obligatorio.' });
    }

    if (!payload.nombre) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'nombre es obligatorio.' });
    }

    // Benjamin Orellana - 08/04/2026 - Validación de precio inicial y descuento porcentual del plan antes de crear
    const errorMontos = validarMontosPlan({
      precioReferencia: payload.precio_referencia,
      descuento: payload.descuento ?? 0
    });

    if (errorMontos) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: errorMontos
      });
    }

    // Benjamin Orellana - 14/04/2026 - Se calcula el descuento efectivo y el precio final automáticamente al crear el plan.
    const descuento = payload.descuento ?? 0;

    const precioFinal = calcularPrecioFinalPlan(
      payload.precio_referencia,
      descuento
    );
    
    const creado = await DebitosAutomaticosPlanesModel.create(
      {
        codigo: payload.codigo,
        nombre: payload.nombre,
        descripcion: payload.descripcion,
        activo: payload.activo ?? 1,
        orden_visual: payload.orden_visual ?? 0,
        precio_referencia: payload.precio_referencia,
        descuento,
        precio_final: precioFinal
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
        mensajeError: 'Ya existe un plan con el mismo código o nombre.'
      });
    }

    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   UR - update
========================= */
export const UR_DebitosAutomaticosPlanes_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const current = await DebitosAutomaticosPlanesModel.findByPk(id, {
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

    if (has('descripcion')) {
      updateBody.descripcion = cleanStringOrNull(body.descripcion, 255);
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

    if (has('orden_visual')) {
      const ordenVisual = toIntOrNull(body.orden_visual);

      if (ordenVisual === null) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'orden_visual debe ser numérico.'
        });
      }

      updateBody.orden_visual = ordenVisual;
    }

    if (has('precio_referencia')) {
      const precioReferencia = toDecOrNull(body.precio_referencia);

      if (
        body.precio_referencia !== null &&
        body.precio_referencia !== '' &&
        precioReferencia === null
      ) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'precio_referencia debe ser numérico.'
        });
      }

      if (precioReferencia !== null && precioReferencia < 0) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'precio_referencia no puede ser negativo.'
        });
      }

      updateBody.precio_referencia = precioReferencia;
    }

    // Benjamin Orellana - 08/04/2026 - Se permite editar el descuento fijo del plan y recalcular el precio final
    if (has('descuento')) {
      const descuento = toDecOrNull(body.descuento);

      if (
        body.descuento !== null &&
        body.descuento !== '' &&
        descuento === null
      ) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'descuento debe ser numérico.'
        });
      }

      if (descuento !== null && descuento < 0) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'descuento no puede ser negativo.'
        });
      }

      updateBody.descuento = descuento ?? 0;
    }

    // Benjamin Orellana - 08/04/2026 - Se recalcula el precio final usando los valores finales de precio inicial y descuento
    const precioReferenciaFinal =
      updateBody.precio_referencia !== undefined
        ? updateBody.precio_referencia
        : current.precio_referencia;

    const descuentoFinal =
      updateBody.descuento !== undefined
        ? updateBody.descuento
        : current.descuento;

    const errorMontos = validarMontosPlan({
      precioReferencia: precioReferenciaFinal,
      descuento: descuentoFinal ?? 0
    });

    if (errorMontos) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: errorMontos
      });
    }

    updateBody.precio_final = calcularPrecioFinalPlan(
      precioReferenciaFinal,
      descuentoFinal ?? 0
    );

    const [numRowsUpdated] = await DebitosAutomaticosPlanesModel.update(
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
      await DebitosAutomaticosPlanesModel.findByPk(id);

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
        mensajeError: 'Ya existe un plan con el mismo código o nombre.'
      });
    }

    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   ER - eliminar (baja lógica)
========================= */
export const ER_DebitosAutomaticosPlanes_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const registro = await DebitosAutomaticosPlanesModel.findByPk(id, {
      transaction: t
    });

    if (!registro) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    await DebitosAutomaticosPlanesModel.update(
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
