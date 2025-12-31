/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 21 / 12 / 2025
 * Versión: 1.1
 *
 * Descripción:
 * Controladores CRUD para la tabla 'convenios_planes_disponibles'.
 * Requerimiento: al crear plan, obligar selección de sede (sede_id) y validar existencia.
 *
 * Tema: Controladores - ConveniosPlanesDisponibles
 * Capa: Backend
 *
 * Nomenclatura: OBR_  obtenerRegistro
 *              OBRS_ obtenerRegistros(plural)
 *              CR_   crearRegistro
 *              ER_   eliminarRegistro
 *              UR_   updateRegistro
 */

import db from '../DataBase/db.js';
import MD_TB_ConveniosPlanesDisponibles from '../Models/MD_TB_ConveniosPlanesDisponibles.js';

const ConveniosPlanesDisponiblesModel =
  MD_TB_ConveniosPlanesDisponibles.ConveniosPlanesDisponiblesModel;

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
  return n;
};

const calcPrecioFinal = ({ precio_lista, descuento_valor, precio_final }) => {
  const pl = toDecOrNull(precio_lista);
  const dv = toDecOrNull(descuento_valor);
  const pf = toDecOrNull(precio_final);

  if (pf !== null) return pf;
  if (pl === null) return null;

  const final = dv !== null ? pl - dv : pl;
  // Evitar negativos por datos erróneos
  return final < 0 ? 0 : Number(final.toFixed(2));
};

const toDefaultFlagOrUndefined = (v) => {
  // undefined => no viene en el body (no tocar en update)
  if (v === undefined) return undefined;

  // null/"" => explícitamente “sin default”
  if (v === null || v === '') return null;

  const s = String(v).trim().toLowerCase();

  // Aceptamos 1/true/si/sí como "default"
  if (
    v === 1 ||
    v === true ||
    s === '1' ||
    s === 'true' ||
    s === 'si' ||
    s === 'sí'
  )
    return 1;

  // Cualquier otro valor => lo tratamos como "no default" (NULL)
  return null;
};

const pickPlanPayload = (body = {}) => {
  // Whitelist para evitar “mass assignment”
  return {
    convenio_id: toIntOrNull(body.convenio_id),
    sede_id: toIntOrNull(body.sede_id),
    nombre_plan: body.nombre_plan ? String(body.nombre_plan).trim() : null,
    duracion_dias: toIntOrNull(body.duracion_dias),
    precio_lista: toDecOrNull(body.precio_lista),
    descuento_valor: toDecOrNull(body.descuento_valor),
    precio_final: body.precio_final,
    activo: body.activo === undefined ? undefined : toIntOrNull(body.activo),

    // Benjamin Orellana - 30/12/2025
    // Manejo de es_default
    es_default: toDefaultFlagOrUndefined(body.es_default) ?? 1
  };
};

const validateSedeExists = async (sede_id) => {
  // Valida existencia de sede (y opcionalmente estado)
  const [rows] = await db.query(
    `
    SELECT id, estado
    FROM sedes
    WHERE id = ?
    LIMIT 1
    `,
    { replacements: [sede_id] }
  );

  if (!rows || rows.length === 0) return { ok: false, reason: 'no_existe' };

  const sede = rows[0];
  const estado = sede.estado ? String(sede.estado).toLowerCase() : null;

  // Si manejás baja lógica por estado, lo validamos. Ajustá a tu criterio real.
  if (estado && estado !== 'activo') return { ok: false, reason: 'inactiva' };

  return { ok: true };
};

/* =========================
   OBRS - listar
========================= */
export const OBRS_ConveniosPlanesDisponibles_CTS = async (req, res) => {
  try {
    const { convenio_id, activo } = req.query;

    const where = {};
    const convId = toIntOrNull(convenio_id);
    if (convId) where.convenio_id = convId;

    if (activo !== undefined) {
      const a = toIntOrNull(activo);
      if (a === null) {
        return res.status(400).json({ mensajeError: 'Query activo inválida.' });
      }
      where.activo = a;
    }

    const registros = await ConveniosPlanesDisponiblesModel.findAll({
      where,
      order: [['id', 'DESC']]
    });

    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   OBR - por ID
========================= */
export const OBR_ConveniosPlanesDisponibles_CTS = async (req, res) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ mensajeError: 'ID inválido.' });

    const registro = await ConveniosPlanesDisponiblesModel.findByPk(id);

    if (!registro) {
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }

    res.json(registro);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   CR - crear (requiere sede_id)
========================= */
export const CR_ConveniosPlanesDisponibles_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const payload = pickPlanPayload(req.body);

    if (!payload.convenio_id) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'convenio_id es obligatorio.' });
    }

    if (!payload.nombre_plan) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'nombre_plan es obligatorio.' });
    }
    if (payload.nombre_plan.length > 60) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'nombre_plan supera 60 caracteres.' });
    }
    if (payload.precio_lista === null) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'precio_lista es obligatorio y debe ser numérico.'
      });
    }
    if (
      payload.descuento_valor !== null &&
      payload.descuento_valor > payload.precio_lista
    ) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'descuento_valor no puede ser mayor a precio_lista.'
      });
    }

    if (payload.sede_id) {
      const sedeCheck = await validateSedeExists(payload.sede_id);
      if (!sedeCheck.ok) {
        await t.rollback();
        const msg =
          sedeCheck.reason === 'inactiva'
            ? 'La sede seleccionada está inactiva.'
            : 'La sede seleccionada no existe.';
        return res.status(400).json({ mensajeError: msg });
      }
    }

    const precio_final_calc = calcPrecioFinal({
      precio_lista: payload.precio_lista,
      descuento_valor: payload.descuento_valor,
      precio_final: payload.precio_final
    });

    // Si viene marcado como default, primero “bajamos” el resto del convenio
    if (payload.es_default === 1) {
      await ConveniosPlanesDisponiblesModel.update(
        { es_default: null },
        { where: { convenio_id: payload.convenio_id }, transaction: t }
      );
    }

    const creado = await ConveniosPlanesDisponiblesModel.create(
      {
        convenio_id: payload.convenio_id,
        sede_id: payload.sede_id ?? null,
        nombre_plan: payload.nombre_plan,
        duracion_dias: payload.duracion_dias,
        precio_lista: payload.precio_lista,
        descuento_valor: payload.descuento_valor,
        precio_final: precio_final_calc,
        activo: payload.activo ?? 1,

        // NUEVO
        es_default: payload.es_default === 1 ? 1 : null
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

    const sqlMsg = String(
      error?.original?.sqlMessage || error?.original?.message || ''
    );

    // UNIQUE de default
    if (sqlMsg.includes('uq_cpd_convenio_default')) {
      return res.status(409).json({
        mensajeError: 'Ya existe un plan por defecto en este convenio.'
      });
    }

    // UNIQUE nombre por convenio+sede+nombre_plan
    if (
      error?.name === 'SequelizeUniqueConstraintError' ||
      String(error?.original?.code || '').includes('ER_DUP_ENTRY')
    ) {
      return res.status(409).json({
        mensajeError:
          'Ya existe un plan con el mismo nombre para ese convenio y sede.'
      });
    }

    return res.status(500).json({ mensajeError: error.message });
  }
};


/* =========================
   ER - eliminar
========================= */
export const ER_ConveniosPlanesDisponibles_CTS = async (req, res) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ mensajeError: 'ID inválido.' });

    const num = await ConveniosPlanesDisponiblesModel.destroy({
      where: { id }
    });

    if (num === 0) {
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }

    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   UR - update (si viene sede_id, valida)
========================= */
export const UR_ConveniosPlanesDisponibles_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    // ==============================
    // Importante:
    // En UPDATE NO podemos usar pickPlanPayload “tal cual”,
    // porque convierte campos ausentes en NULL y eso provoca notNull Violation.
    // Por eso armamos updateBody SOLO con lo que venga en req.body.
    // ==============================
    const body = req.body || {};

    // Traemos el registro actual UNA vez para:
    // - recalcular precio_final si hace falta
    // - manejar es_default y convenio_id real
    const current = await ConveniosPlanesDisponiblesModel.findByPk(id, {
      transaction: t
    });

    if (!current) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }

    // Helper: detectar si un campo vino en el body (aunque venga null)
    const has = (k) =>
      Object.prototype.hasOwnProperty.call(body, k);

    const updateBody = {};

    // ==============================
    // Validaciones + asignación controlada (solo si viene en body)
    // ==============================

    // sede_id: opcional. Si viene, validar existencia (permitimos null para “General”)
    if (has('sede_id')) {
      const nextSedeId = toIntOrNull(body.sede_id); // null permitido
      if (nextSedeId) {
        const sedeCheck = await validateSedeExists(nextSedeId);
        if (!sedeCheck.ok) {
          await t.rollback();
          const msg =
            sedeCheck.reason === 'inactiva'
              ? 'La sede seleccionada está inactiva.'
              : 'La sede seleccionada no existe.';
          return res.status(400).json({ mensajeError: msg });
        }
      }
      updateBody.sede_id = nextSedeId;
    }

    // nombre_plan: si viene, no puede ser vacío
    if (has('nombre_plan')) {
      const np = body.nombre_plan ? String(body.nombre_plan).trim() : '';
      if (!np) {
        await t.rollback();
        return res
          .status(400)
          .json({ mensajeError: 'nombre_plan no puede ser vacío.' });
      }
      if (np.length > 60) {
        await t.rollback();
        return res
          .status(400)
          .json({ mensajeError: 'nombre_plan supera 60 caracteres.' });
      }
      updateBody.nombre_plan = np;
    }

    // duracion_dias: opcional, null permitido
    if (has('duracion_dias')) {
      updateBody.duracion_dias = toIntOrNull(body.duracion_dias);
    }

    // activo: opcional
    if (has('activo')) {
      const a = toIntOrNull(body.activo);
      updateBody.activo = a === null ? 1 : a; // tu criterio: si viene inválido, default 1
    }

    // ==============================
    // Benjamin Orellana - 30/12/2025
    // Manejo de es_default (NULL o 1)
    // Regla: solo 1 por convenio (DB lo asegura con uq_cpd_convenio_default)
    // ==============================
    if (has('es_default')) {
      const incoming =
        String(body.es_default) === '1' || body.es_default === 1 ? 1 : null;

      // Si quieren marcar este como default, bajamos todos los demás del convenio
      if (incoming === 1) {
        await ConveniosPlanesDisponiblesModel.update(
          { es_default: null },
          { where: { convenio_id: current.convenio_id }, transaction: t }
        );
      }

      updateBody.es_default = incoming;
    }

    // ==============================
    // Precio final: recalcular solo si se toca precio_lista/descuento_valor/precio_final
    // ==============================
    const touchesPrice =
      has('precio_lista') || has('descuento_valor') || has('precio_final');

    if (touchesPrice) {
      // Valores “next” (si no vienen, usamos current)
      const nextPrecioLista = has('precio_lista')
        ? toDecOrNull(body.precio_lista)
        : Number(current.precio_lista);

      const nextDesc = has('descuento_valor')
        ? toDecOrNull(body.descuento_valor)
        : current.descuento_valor !== null
        ? Number(current.descuento_valor)
        : null;

      const nextPf = has('precio_final')
        ? body.precio_final
        : current.precio_final;

      // Validaciones coherentes (si viene precio_lista, debe ser numérico)
      if (has('precio_lista') && nextPrecioLista === null) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'precio_lista es obligatorio y debe ser numérico.'
        });
      }

      if (nextDesc !== null && nextPrecioLista !== null && nextDesc > nextPrecioLista) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'descuento_valor no puede ser mayor a precio_lista.'
        });
      }

      const precio_final_calc = calcPrecioFinal({
        precio_lista: nextPrecioLista,
        descuento_valor: nextDesc,
        precio_final: nextPf
      });

      // Guardamos los campos que vinieron explícitos
      if (has('precio_lista')) updateBody.precio_lista = nextPrecioLista;
      if (has('descuento_valor')) updateBody.descuento_valor = nextDesc;

      // El precio_final se setea siempre si toca precio (tu lógica original)
      updateBody.precio_final = precio_final_calc;
    }

    // ==============================
    // Ejecutar update
    // ==============================
    const [numRowsUpdated] = await ConveniosPlanesDisponiblesModel.update(
      updateBody,
      { where: { id }, transaction: t }
    );

    if (numRowsUpdated !== 1) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }

    await t.commit();

    const registroActualizado = await ConveniosPlanesDisponiblesModel.findByPk(id);
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
      // Puede ocurrir si hay concurrencia extrema al setear default
      return res.status(409).json({
        mensajeError:
          'Conflicto de unicidad: ya existe un plan por defecto para este convenio.'
      });
    }

    return res.status(500).json({ mensajeError: error.message });
  }
};
