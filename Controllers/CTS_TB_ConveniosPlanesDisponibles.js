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
    activo:
      body.activo === undefined ? undefined : toIntOrNull(body.activo) ?? 1
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
  try {
    const payload = pickPlanPayload(req.body);

    // Validaciones mínimas
    if (!payload.convenio_id) {
      return res
        .status(400)
        .json({ mensajeError: 'convenio_id es obligatorio.' });
    }

    // sede_id NO obligatoria

    if (!payload.nombre_plan) {
      return res
        .status(400)
        .json({ mensajeError: 'nombre_plan es obligatorio.' });
    }
    if (payload.nombre_plan.length > 60) {
      return res
        .status(400)
        .json({ mensajeError: 'nombre_plan supera 60 caracteres.' });
    }
    if (payload.precio_lista === null) {
      return res.status(400).json({
        mensajeError: 'precio_lista es obligatorio y debe ser numérico.'
      });
    }
    if (
      payload.descuento_valor !== null &&
      payload.descuento_valor > payload.precio_lista
    ) {
      return res.status(400).json({
        mensajeError: 'descuento_valor no puede ser mayor a precio_lista.'
      });
    }

    // Validar sede SOLO si viene
    if (payload.sede_id) {
      const sedeCheck = await validateSedeExists(payload.sede_id);
      if (!sedeCheck.ok) {
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

    const creado = await ConveniosPlanesDisponiblesModel.create({
      convenio_id: payload.convenio_id,
      sede_id: payload.sede_id ?? null,
      nombre_plan: payload.nombre_plan,
      duracion_dias: payload.duracion_dias,
      precio_lista: payload.precio_lista,
      descuento_valor: payload.descuento_valor,
      precio_final: precio_final_calc,
      activo: payload.activo ?? 1
    });

    return res.status(201).json({
      message: 'Registro creado correctamente',
      registro: creado
    });
  } catch (error) {
    if (
      error?.name === 'SequelizeUniqueConstraintError' ||
      String(error?.original?.code || '').includes('ER_DUP_ENTRY')
    ) {
      return res.status(409).json({
        mensajeError:
          'Ya existe un plan con el mismo nombre para ese convenio y sede.'
      });
    }
    res.status(500).json({ mensajeError: error.message });
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
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ mensajeError: 'ID inválido.' });

    const payload = pickPlanPayload(req.body);

    // Si vienen valores, validamos (pero en update pueden venir parciales)
    if (payload.sede_id !== null && payload.sede_id !== undefined) {
      const sedeCheck = await validateSedeExists(payload.sede_id);
      if (!sedeCheck.ok) {
        const msg =
          sedeCheck.reason === 'inactiva'
            ? 'La sede seleccionada está inactiva.'
            : 'La sede seleccionada no existe.';
        return res.status(400).json({ mensajeError: msg });
      }
    }

    if (payload.nombre_plan !== null && payload.nombre_plan !== undefined) {
      if (!payload.nombre_plan) {
        return res
          .status(400)
          .json({ mensajeError: 'nombre_plan no puede ser vacío.' });
      }
      if (payload.nombre_plan.length > 60) {
        return res
          .status(400)
          .json({ mensajeError: 'nombre_plan supera 60 caracteres.' });
      }
    }

    // Recalcular precio_final solo si se toca precio_lista/descuento/precio_final
    const touchesPrice =
      req.body?.precio_lista !== undefined ||
      req.body?.descuento_valor !== undefined ||
      req.body?.precio_final !== undefined;

    let precio_final_calc;
    if (touchesPrice) {
      // Tomamos los valores resultantes (si no vinieron en body, necesitamos el registro actual)
      const current = await ConveniosPlanesDisponiblesModel.findByPk(id);
      if (!current)
        return res.status(404).json({ mensajeError: 'Registro no encontrado' });

      const nextPrecioLista =
        payload.precio_lista !== null && payload.precio_lista !== undefined
          ? payload.precio_lista
          : Number(current.precio_lista);

      const nextDesc =
        payload.descuento_valor !== undefined
          ? payload.descuento_valor
          : current.descuento_valor !== null
          ? Number(current.descuento_valor)
          : null;

      const nextPf =
        req.body?.precio_final !== undefined
          ? req.body.precio_final
          : current.precio_final;

      precio_final_calc = calcPrecioFinal({
        precio_lista: nextPrecioLista,
        descuento_valor: nextDesc,
        precio_final: nextPf
      });
    }

    const updateBody = {};
    // Solo seteamos lo que vino definido (parcial)
    Object.keys(payload).forEach((k) => {
      if (payload[k] !== undefined) updateBody[k] = payload[k];
    });

    if (touchesPrice) updateBody.precio_final = precio_final_calc;

    const [numRowsUpdated] = await ConveniosPlanesDisponiblesModel.update(
      updateBody,
      { where: { id } }
    );

    if (numRowsUpdated === 1) {
      const registroActualizado =
        await ConveniosPlanesDisponiblesModel.findByPk(id);
      return res.json({
        message: 'Registro actualizado correctamente',
        registroActualizado
      });
    }

    return res.status(404).json({ mensajeError: 'Registro no encontrado' });
  } catch (error) {
    if (
      error?.name === 'SequelizeUniqueConstraintError' ||
      String(error?.original?.code || '').includes('ER_DUP_ENTRY')
    ) {
      return res.status(409).json({
        mensajeError:
          'Ya existe un plan con el mismo nombre para ese convenio y sede.'
      });
    }

    res.status(500).json({ mensajeError: error.message });
  }
};
