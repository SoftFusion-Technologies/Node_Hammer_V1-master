/*
 * Archivo: controllers/CTS_TB_VentasComision.js
 * Programador: Benjamin Orellana
 * Creación: 19/10/2025
 * Versión: 1.0
 *
 * Responsabilidad:
 * - CRUD y flujo de aprobación/rechazo de ventas_comisiones
 * - Sincronización con ventas_prospectos (comision, comision_estado, comision_id)
 */

import db from "../DataBase/db.js";
import { Op, fn, col } from "sequelize";
import { VentasComisionesModel } from "../Models/MD_TB_ventas_comisiones.js";
import { VentasProspectosModel } from "../Models/MD_TB_ventas_prospectos.js";
import VentasRemarketingModel from "../Models/MD_TB_VentasRemarketing.js"; // <--- NUEVO IMPORT
import UserModel from "../Models/MD_TB_Users.js";

// ========================= Helpers =========================

// Fallbacks sin auth
function getActingRole(req) {
  return (
    req.headers["x-user-role"] ||
    req.body?.userLevel ||
    req.body?.role ||
    "admin"
  )
    .toString()
    .toLowerCase();
}
function getActingUserId(req) {
  const v =
    req.headers["x-user-id"] ||
    req.body?.user_id ||
    req.body?.aprobado_por ||
    req.body?.rechazado_por;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function hasRoleLoose(req, roles = []) {
  if (!roles?.length) return true;
  const role = getActingRole(req);
  return roles.some((r) => r.toLowerCase() === role);
}

function hasRole(user, roles = []) {
  if (!user) return false;
  const role = (user.role || user.level || "").toString().toLowerCase();
  if (roles.length === 0) return true;
  return roles.some((r) => r.toLowerCase() === role);
}

function toBigIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function sanitizeStr(v, max = 255) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s.slice(0, max) : null;
}

function positiveMoneyOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n >= 0 ? n : null;
}

function normalizePlanFields({ tipo_plan, tipo_plan_custom }) {
  const plan = sanitizeStr(tipo_plan, 80);
  const custom = sanitizeStr(tipo_plan_custom, 120);
  if (!plan) throw new Error("Debe indicar el tipo de plan");
  if (plan.toLowerCase() === "otros" && !custom) {
    throw new Error('Debe completar el detalle cuando el plan es "Otros"');
  }
  return { plan, custom: plan.toLowerCase() === 'otros' ? custom : null };
}

function normalizeMoneda(m) {
  const x = (m || 'ARS').toString().trim().toUpperCase();
  return x.slice(0, 3); // 'ARS', 'USD', etc.
}

const ESTADOS = ['en_revision', 'aprobado', 'rechazado'];
const MONEDAS = ['ARS', 'USD'];

const sanitize = (v, max = 255) =>
  v == null ? v : String(v).trim().slice(0, max);

const normLower = (v) => (v == null ? v : String(v).trim().toLowerCase());

const numOrUndef = (v) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

function normalizePlan({ tipo_plan, tipo_plan_custom }) {
  const plan = sanitize(tipo_plan, 50) || "Otros";
  const custom =
    plan === "Otros" ? sanitize(tipo_plan_custom, 120) || null : null;
  return { plan, custom };
}

// ========================= Controllers =========================

/**
 * POST /ventas-prospectos/:id/convertir
 * Crea comisión en revisión si esComision=true y sincroniza el prospecto.
 * Body: { esComision: boolean, tipo_plan?, tipo_plan_custom?, observacion?, actor_id? }
 */
export const POST_convertirProspecto_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const prospecto_id = Number(req.params.id);
    if (!Number.isInteger(prospecto_id) || prospecto_id <= 0)
      throw new Error("ID de prospecto inválido");
    const actorId = Number(req.user?.id) || Number(req.body?.actor_id);
    const prospecto = await VentasProspectosModel.findByPk(prospecto_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!prospecto) throw new Error("Prospecto no encontrado");

    const esComision = !!req.body?.esComision;
    const now = new Date();
    const camposProspecto = { convertido: true };

    if (!esComision) {
      Object.assign(camposProspecto, {
        comision: false,
        comision_registrada_at: null,
        comision_usuario_id: actorId,
        comision_estado: null,
        comision_id: null,
      });
      await VentasProspectosModel.update(camposProspecto, {
        where: { id: prospecto_id },
        transaction: t,
      });
      const data = await VentasProspectosModel.findByPk(prospecto_id, {
        transaction: t,
      });
      await t.commit();
      return res.json({
        message: "Prospecto convertido sin comisión",
        prospecto: data,
      });
    }

    const { plan, custom } = normalizePlanFields({
      tipo_plan: req.body?.tipo_plan,
      tipo_plan_custom: req.body?.tipo_plan_custom,
    });
    const observacion = sanitizeStr(req.body?.observacion, 255);
    const yaPendiente = await VentasComisionesModel.findOne({
      where: { prospecto_id, estado: "en_revision" },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (yaPendiente)
      throw new Error("Ya existe una comisión en revisión para este prospecto");

    const vendedor_id = actorId;
    const sede =
      String(prospecto.sede || "")
        .trim()
        .toLowerCase() || "monteros";
    const comision = await VentasComisionesModel.create(
      {
        prospecto_id,
        vendedor_id,
        sede,
        tipo_plan: plan,
        tipo_plan_custom: custom,
        observacion,
        estado: "en_revision",
        moneda: "ARS",
        monto_comision: null,
      },
      { transaction: t }
    );

    Object.assign(camposProspecto, {
      comision: true,
      comision_registrada_at: now,
      comision_usuario_id: actorId,
      comision_estado: "en_revision",
      comision_id: comision.id,
    });
    await VentasProspectosModel.update(camposProspecto, {
      where: { id: prospecto_id },
      transaction: t,
    });
    const prospectoRefresco = await VentasProspectosModel.findByPk(
      prospecto_id,
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({
      message: "Prospecto convertido y comisión creada en revisión",
      prospecto: prospectoRefresco,
      comision,
    });
  } catch (err) {
    await t.rollback();
    return res.status(400).json({ mensajeError: err.message });
  }
};

/**
 * GET /ventas-comisiones
 * Filtros: estado, sede, vendedor_id, prospecto_id, q (nombre/dni), fecha_desde, fecha_hasta
 * Paginación: page (1..N), pageSize (default 20)
 * Orden: orderBy (created_at|estado|monto_comision|...), orderDir (ASC|DESC)
 * AHORA INCLUYE DATOS DE REMARKETING
 */
export const GET_listarVentasComisiones_CTS = async (req, res) => {
  try {
    const {
      estado,
      sede,
      vendedor_id,
      q,
      fecha_desde,
      fecha_hasta,
      page = 1,
      pageSize = 20,
      orderBy = "created_at",
      orderDir = "DESC",
    } = req.query;

    // 1. Filtros Comunes
    const whereComisiones = {};
    // Solo traer remarketing que NO tenga comision_id
    const whereRemarketing = { 
      comision_estado: estado ? String(estado) : ['en_revision', 'aprobado', 'rechazado'],
      comision_id: null,  // SOLO los que no tienen comisión creada aún
      convertido: 1  // Solo los convertidos
    };

    if (estado && ESTADOS.includes(String(estado))) {
      whereComisiones.estado = String(estado);
      whereRemarketing.comision_estado = String(estado);
    }
    if (sede) {
      const s = String(sede).trim().toLowerCase();
      whereComisiones.sede = s;
      whereRemarketing.sede = s;
    }
    if (vendedor_id) {
      const vid = toBigIntOrNull(vendedor_id);
      whereComisiones.vendedor_id = vid;
      whereRemarketing.usuario_id = vid;
    }
    if (fecha_desde || fecha_hasta) {
      const dateFilter = {};
      if (fecha_desde) dateFilter[Op.gte] = new Date(fecha_desde);
      if (fecha_hasta) dateFilter[Op.lte] = new Date(fecha_hasta);
      whereComisiones.created_at = dateFilter;
      whereRemarketing.comision_registrada_at = dateFilter;
    }


    // 2. Buscar Normales (incluye remarketing con comision_id)
    const comisionesNormales = await VentasComisionesModel.findAll({
      where: whereComisiones,
      include: [
        { model: UserModel, as: "vendedor", attributes: ["id", "name"] },
        {
          model: VentasProspectosModel,
          as: "prospecto",
          attributes: [
            "id",
            "nombre",
            "dni",
            "sede",
            "comision_estado",
            "observacion",
          ],
        },
        {
          model: VentasRemarketingModel,
          as: "remarketing",
          attributes: [
            "id",
            "nombre_socio",
            "dni",
            "contacto",
            "sede",
            "observacion",
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    // 3. Buscar Remarketing HUÉRFANOS (sin comision_id)
    if (q) {
      const qq = String(q).toLowerCase();
      whereRemarketing[Op.or] = [
        { nombre_socio: { [Op.like]: `%${qq}%` } },
        { contacto: { [Op.like]: `%${qq}%` } },
      ];
    }

    const comisionesRemarketing = await VentasRemarketingModel.findAll({
      where: whereRemarketing,
      include: [
        { model: UserModel, as: "usuario", attributes: ["id", "name"] },
      ],
      order: [["comision_registrada_at", "DESC"]],
    });

    console.log('🔍 FILTRO whereRemarketing:', JSON.stringify(whereRemarketing, null, 2));
    console.log('📊 Remarketing encontrados:', comisionesRemarketing.length);
    comisionesRemarketing.forEach(r => {
      console.log(`  - ID: ${r.id}, comision_estado: ${r.comision_estado}, comision_id: ${r.comision_id}`);
    });

    // 4. Mapeo Normales (incluye datos de remarketing si existe)
    const lista1 = comisionesNormales.map((c) => {
      const plain = c.get({ plain: true });
      
      // Si tiene remarketing vinculado, usar esos datos
      let clienteNombre = plain.prospecto?.nombre || "-";
      let clienteDni = plain.prospecto?.dni || "-";
      
      if (plain.remarketing) {
        clienteNombre = plain.remarketing.nombre_socio || clienteNombre;
        clienteDni = plain.remarketing.dni || plain.remarketing.contacto || clienteDni;
      }

      return {
        ...plain,
        es_remarketing: !!plain.remarketing_id,
        origen: plain.remarketing_id ? "Remarketing" : "Ventas",
        plan_real: plain.tipo_plan || "No especificado",
        plan_custom: plain.tipo_plan_custom,
        dni_cliente: clienteDni,
        prospecto: plain.remarketing ? {
          id: plain.remarketing.id,
          nombre: plain.remarketing.nombre_socio,
          dni: plain.remarketing.dni || plain.remarketing.contacto,
          sede: plain.remarketing.sede,
          observacion: plain.remarketing.observacion,
        } : plain.prospecto,
      };
    });

    // 5. Mapeo Remarketing HUÉRFANOS (solo los que NO tienen comision_id)
    const lista2 = comisionesRemarketing.map((r) => {
      const plain = r.get({ plain: true });

      // Extracción de plan si está en observación
      let planExtraido = null;
      if (plain.observacion) {
        const match = plain.observacion.match(
          /(?:Plan(?:\s+interés)?):\s*([^\n\r.]+)/i
        );
        if (match) planExtraido = match[1].trim();
      }

      return {
        id: `rem_${plain.id}`,
        id_real: plain.id,
        es_remarketing: true,
        origen: "Remarketing",

        estado: plain.comision_estado || "en_revision",
        monto_comision: 0,
        moneda: "ARS",
        tipo_plan: planExtraido || "No especificado",
        tipo_plan_custom: null,
        plan_real: planExtraido || "No especificado",

        dni_cliente: plain.dni || plain.contacto || "-",
        observacion: plain.observacion,
        sede: plain.sede || "-",

        created_at: plain.comision_registrada_at || plain.created_at,
        updated_at: plain.updated_at,

        vendedor_id: plain.usuario_id,
        vendedor: plain.usuario
          ? { id: plain.usuario.id, name: plain.usuario.name }
          : { id: plain.usuario_id, name: "Usuario Eliminado" },

        prospecto_id: null,
        prospecto: {
          id: plain.id,
          nombre: plain.nombre_socio,
          dni: plain.dni || plain.contacto,
          sede: plain.sede,
          observacion: plain.observacion,
        },

        aprobado_por: null,
        aprobado_at: null,
        rechazado_por: null,
        rechazado_at: null,
        motivo_rechazo: null,
      };
    });

    // 6. Unir y Filtrar
    let todos = [...lista1, ...lista2];

    if (q) {
      const qq = String(q).toLowerCase();
      todos = todos.filter((item) => {
        if (item.es_remarketing && item.id_real) return true; // Ya filtrado en DB
        const p = item.prospecto;
        const nombre = (p?.nombre || "").toLowerCase();
        const dni = (p?.dni || "").toLowerCase();
        return nombre.includes(qq) || dni.includes(qq);
      });
    }

    todos.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return String(orderDir).toUpperCase() === "ASC"
        ? dateA - dateB
        : dateB - dateA;
    });

    const totalCount = todos.length;
    const limitNum = Math.max(1, Math.min(Number(pageSize) || 20, 200));
    const pageNum = Math.max(1, Number(page) || 1);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    return res
    .set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      })
      .json({
      total: totalCount,
      page: pageNum,
      pageSize: limitNum,
      items: todos.slice(startIndex, endIndex),
    });
  } catch (err) {
    console.error("Error listar comisiones unificadas:", err);
    return res.status(500).json({ mensajeError: err.message });
  }
};

/**
 * GET /ventas-comisiones/:id
 * Obtener una comisión específica
 */
export const GET_obtenerVentaComision_CTS = async (req, res) => {
  try {
    const idRaw = req.params.id;
    let id = idRaw;
    let esRemarketing = false;

    if (String(idRaw).startsWith("rem_")) {
      esRemarketing = true;
      id = Number(idRaw.replace("rem_", ""));
    } else {
      id = Number(idRaw);
    }

    if (esRemarketing) {
      const item = await VentasRemarketingModel.findByPk(id, {
        include: [
          { model: UserModel, as: "usuario", attributes: ["id", "name"] },
        ],
      });
      if (!item)
        return res.status(404).json({ mensajeError: "Comisión no encontrada" });

      const plain = item.toJSON();

      // Buscar datos de comisión en ventas_comisiones
      let comisionData = null;
      if (plain.comision_id) {
        comisionData = await VentasComisionesModel.findByPk(plain.comision_id);
      }

      return res.json({
        id: `rem_${plain.id}`,
        id_real: plain.id,
        es_remarketing: true,
        estado: comisionData?.estado || plain.comision_estado,
        monto_comision: comisionData?.monto_comision || 0,
        tipo_plan: comisionData?.tipo_plan || "No especificado",
        tipo_plan_custom: comisionData?.tipo_plan_custom || null,
        observacion: comisionData?.observacion || plain.observacion,
        created_at: plain.comision_registrada_at,
        vendedor: plain.usuario,
        prospecto: {
          nombre: plain.nombre_socio,
          dni: plain.dni || plain.contacto,
          sede: plain.sede,
        },
      });
    }

    // Normal
    const item = await VentasComisionesModel.findByPk(id, {
      include: [
        { model: UserModel, as: "vendedor", attributes: ["id", "name"] },
        {
          model: VentasProspectosModel,
          as: "prospecto",
          attributes: [
            "id",
            "nombre",
            "dni",
            "sede",
            "comision_estado",
            "comision_id",
            "observacion",
          ],
        },
      ],
    });
    if (!item)
      return res.status(404).json({ mensajeError: "Comisión no encontrada" });
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ mensajeError: err.message });
  }
};

/**
 * PUT/PATCH /ventas-comisiones/:id
 * Edición completa + transición de estado y side-effects
 */
export const PUT_actualizarVentaComision_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    let idRaw = req.params.id;
    let id;
    let esRemarketing = false;

    // Detección robusta de ID (rem_123, rem 123, etc.)
    if (String(idRaw).includes("rem")) {
      esRemarketing = true;
      const numeroLimpio = String(idRaw)
        .replace(/rem/i, "")
        .replace(/[_ ]/g, "");
      id = Number(numeroLimpio);
    } else {
      id = Number(idRaw);
    }

    if (!id || isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ mensajeError: "ID inválido" });
    }

    // --- CAMINO A: REMARKETING ---
    if (esRemarketing) {
      const rem = await VentasRemarketingModel.findByPk(id, { transaction: t });
      if (!rem) {
        await t.rollback();
        return res
          .status(404)
          .json({ mensajeError: "Registro Remarketing no encontrado" });
      }

      // Si tiene comisión vinculada, actualizamos esa tabla
      if (rem.comision_id) {
        const comision = await VentasComisionesModel.findByPk(rem.comision_id, {
          transaction: t,
        });
        if (comision) {
          const updatesC = {};
          if (req.body.monto_comision !== undefined)
            updatesC.monto_comision = numOrUndef(req.body.monto_comision);
          if (req.body.tipo_plan) updatesC.tipo_plan = req.body.tipo_plan;
          if (req.body.estado) updatesC.estado = req.body.estado;
          // ... (otros campos si necesario)

          // Datos de aprobación/rechazo
          const actorId = getActingUserId(req);
          const now = new Date();
          if (req.body.estado === "aprobado") {
            updatesC.aprobado_por = actorId;
            updatesC.aprobado_at = now;
          } else if (req.body.estado === "rechazado") {
            updatesC.rechazado_por = actorId;
            updatesC.rechazado_at = now;
          }

          await VentasComisionesModel.update(updatesC, {
            where: { id: rem.comision_id },
            transaction: t,
          });
        }
      }

      // ACTUALIZAR SIEMPRE EN REMARKETING (Datos locales)
      const updatesRem = {};
      if (req.body.estado) updatesRem.comision_estado = req.body.estado;
      if (req.body.monto_comision !== undefined)
        updatesRem.comision_monto = numOrUndef(req.body.monto_comision);
      if (req.body.tipo_plan) updatesRem.comision_tipo_plan = req.body.tipo_plan;
      if (req.body.tipo_plan_custom)
        updatesRem.comision_tipo_plan_custom = req.body.tipo_plan_custom;

      const actorId = getActingUserId(req);
      const now = new Date();

      if (req.body.estado === "aprobado") {
        updatesRem.comision_aprobado_por = actorId;
        updatesRem.comision_aprobado_at = now;
      } else if (req.body.estado === "rechazado") {
        updatesRem.comision_rechazado_por = actorId;
        updatesRem.comision_rechazado_at = now;
      }

      await VentasRemarketingModel.update(updatesRem, {
        where: { id },
        transaction: t,
      });
      await t.commit();

      return res.json({
        message: "Comisión Remarketing actualizada",
        data: { ...rem.toJSON(), ...updatesRem },
      });
    }

    // --- CAMINO B: NORMAL ---
    const com = await VentasComisionesModel.findByPk(id, { transaction: t });
    if (!com) {
      await t.rollback();
      return res.status(404).json({ mensajeError: "Comisión no encontrada" });
    }

    const updates = {};
    if (req.body.monto_comision !== undefined)
      updates.monto_comision = numOrUndef(req.body.monto_comision);
    if (req.body.tipo_plan) updates.tipo_plan = req.body.tipo_plan;
    if (req.body.estado) updates.estado = req.body.estado;

    const actorId = getActingUserId(req);
    const now = new Date();

    if (req.body.estado === "aprobado") {
      updates.aprobado_por = actorId;
      updates.aprobado_at = now;
    } else if (req.body.estado === "rechazado") {
      updates.rechazado_por = actorId;
      updates.rechazado_at = now;
    }

    await VentasComisionesModel.update(updates, {
      where: { id },
      transaction: t,
    });

    if (com.prospecto_id) {
      await VentasProspectosModel.update(
        { comision_estado: updates.estado },
        { where: { id: com.prospecto_id }, transaction: t }
      );
    }

    await t.commit();
    return res.json({ message: "Comisión Normal actualizada" });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ mensajeError: err.message });
  }
};

/**
 * PUT /ventas-comisiones/:id/aprobar
 * Body: { monto_comision, moneda }
 * Requiere roldmin
 */
export const PUT_aprobarVentaComision_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    if (!hasRoleLoose(req, ["admin", "gerente"])) {
      await t.rollback();
      return res.status(403).json({ mensajeError: "No autorizado" });
    }

    let idRaw = req.params.id;
    let id = idRaw;
    let esRemarketing = false;

    if (String(idRaw).startsWith("rem_")) {
      esRemarketing = true;
      id = Number(idRaw.replace("rem_", ""));
    } else {
      id = Number(idRaw);
    }

    const monto = positiveMoneyOrNull(req.body?.monto_comision);
    if (monto === null) {
      await t.rollback();
      return res.status(400).json({ mensajeError: "monto_comision inválido" });
    }
    const aprobadorId = getActingUserId(req);
    const now = new Date();

    if (esRemarketing) {
      // --- APROBAR EN REMARKETING ---
      const rem = await VentasRemarketingModel.findByPk(id, { transaction: t });
      if (!rem) {
        await t.rollback();
        return res
          .status(404)
          .json({ mensajeError: "Remarketing no encontrado" });
      }

      // Buscar la comisión en ventas_comisiones
      if (!rem.comision_id) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: "No hay comisión asociada a este remarketing",
        });
      }

      const comision = await VentasComisionesModel.findByPk(rem.comision_id, {
        transaction: t,
      });
      if (!comision) {
        await t.rollback();
        return res.status(404).json({
          mensajeError: "Comisión no encontrada en ventas_comisiones",
        });
      }

      // Actualizar la comisión en ventas_comisiones
      await VentasComisionesModel.update(
        {
          estado: "aprobado",
          monto_comision: monto,
          moneda: "ARS",
          aprobado_por: aprobadorId,
          aprobado_at: now,
          rechazado_por: null,
          rechazado_at: null,
          motivo_rechazo: null,
        },
        { where: { id: comision.id }, transaction: t }
      );

      // Sincronizar estado en remarketing
      await VentasRemarketingModel.update(
        {
          comision_estado: "aprobado",
        },
        { where: { id }, transaction: t }
      );

      await t.commit();
      return res.json({ message: "Comisión Remarketing aprobada" });
    }
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ mensajeError: err.message });
  }
};

/**
 * PUT /ventas-comisiones/:id/rechazar
 * Body: { motivo_rechazo }
 * Requiere roldmin
 */
export const PUT_rechazarVentaComision_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    if (!hasRoleLoose(req, ["admin", "gerente"])) {
      await t.rollback();
      return res.status(403).json({ mensajeError: "No autorizado" });
    }
    let idRaw = req.params.id;
    let id = idRaw;
    let esRemarketing = false;

    if (String(idRaw).startsWith("rem_")) {
      esRemarketing = true;
      id = Number(idRaw.replace("rem_", ""));
    } else {
      id = Number(idRaw);
    }

    const motivo =
      sanitizeStr(req.body?.motivo_rechazo, 255) ||
      "Rechazada por coordinación";
    const rechezId = getActingUserId(req);
    const now = new Date();

    if (esRemarketing) {
      // --- RECHAZAR REMARKETING ---
      const rem = await VentasRemarketingModel.findByPk(id, { transaction: t });
      if (!rem) {
        await t.rollback();
        return res
          .status(404)
          .json({ mensajeError: "Remarketing no encontrado" });
      }

      // Buscar la comisión en ventas_comisiones
      if (!rem.comision_id) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: "No hay comisión asociada a este remarketing",
        });
      }

      const comision = await VentasComisionesModel.findByPk(rem.comision_id, {
        transaction: t,
      });
      if (!comision) {
        await t.rollback();
        return res.status(404).json({
          mensajeError: "Comisión no encontrada en ventas_comisiones",
        });
      }

      // Actualizar la comisión en ventas_comisiones
      await VentasComisionesModel.update(
        {
          estado: "rechazado",
          rechazado_por: rechezId,
          rechazado_at: now,
          motivo_rechazo: motivo,
          aprobado_por: null,
          aprobado_at: null,
        },
        { where: { id: comision.id }, transaction: t }
      );

      // Sincronizar estado en remarketing
      await VentasRemarketingModel.update(
        {
          comision_estado: "rechazado",
        },
        { where: { id }, transaction: t }
      );

      await t.commit();
      return res.json({ message: "Comisión Remarketing rechazada" });
    }

    // --- RECHAZAR NORMAL ---
    const com = await VentasComisionesModel.findByPk(id, { transaction: t });
    if (!com) {
      await t.rollback();
      return res.status(404).json({ mensajeError: "Comisión no encontrada" });
    }

    await VentasComisionesModel.update(
      {
        estado: "rechazado",
        rechazado_por: rechezId,
        rechazado_at: now,
        motivo_rechazo: motivo,
      },
      { where: { id }, transaction: t }
    );

    await VentasProspectosModel.update(
      { comision_estado: "rechazado" },
      { where: { id: com.prospecto_id }, transaction: t }
    );

    await t.commit();
    return res.json({ message: "Comisión rechazada" });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ mensajeError: err.message });
  }
};


/**
 * DELETE /ventas-comisiones/:id
 * Admin/Gerente o Dueño (vendedor_id) pueden eliminar si está en_revision.
 * Limpia vínculo en prospecto.
 */
export const DEL_eliminarVentaComision_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    let idRaw = req.params.id;
    let id;
    let esRemarketingVirtual = false;

    // 1. Detección de tipo de ID (Normal vs Virtual 'rem_')
    if (String(idRaw).includes("rem")) {
      esRemarketingVirtual = true;
      const numeroLimpio = String(idRaw).replace(/rem/i, "").replace(/[_ ]/g, "");
      id = Number(numeroLimpio);
    } else {
      id = Number(idRaw);
    }

    if (!id || isNaN(id)) {
      await t.rollback();
      return res.status(400).json({ mensajeError: "ID inválido" });
    }

    // --- CASO A: ELIMINAR DESDE ID VIRTUAL (Registro que vino de Remarketing) ---
    if (esRemarketingVirtual) {
      // 1. Buscar el registro en Remarketing
      const rem = await VentasRemarketingModel.findByPk(id, { transaction: t });
      
      if (rem) {
        // 2. Si tenía una comisión real vinculada, la borramos
        if (rem.comision_id) {
          await VentasComisionesModel.destroy({
            where: { id: rem.comision_id },
            transaction: t
          });
        }

        // 3. Limpiamos el estado en Remarketing (Esto hace que desaparezca de la lista)
        await VentasRemarketingModel.update({
          comision_estado: null,      // Deja de aparecer en filtros de comisión
          comision_id: null,
          comision_monto: null,       // Limpiamos datos para que no queden "sucios"
          comision_tipo_plan: null,
          comision_usuario_id: null,
          comision_registrada_at: null,
          convertido: 1               // Opcional: Si quieres que vuelva a "No convertido"
        }, {
          where: { id: id },
          transaction: t
        });
      }
      
      await t.commit();
      return res.json({ message: "Comisión de Remarketing eliminada correctamente" });
    }

    // --- CASO B: ELIMINAR DESDE ID REAL (Registro de tabla ventas_comisiones) ---
    const com = await VentasComisionesModel.findByPk(id, { transaction: t });

    if (!com) {
      await t.rollback();
      return res.status(404).json({ mensajeError: "Comisión no encontrada" });
    }

    // 1. Si está vinculado a un PROSPECTO normal, limpiamos el prospecto
    if (com.prospecto_id) {
      await VentasProspectosModel.update({
        comision_estado: null,
        comision_id: null,
        comision: 0, // Desmarcamos el flag de comisión
        convertido: 1 // Opcional: Desmarcamos convertido si se requiere
      }, {
        where: { id: com.prospecto_id },
        transaction: t
      });
    }

    // 2. Si está vinculado a REMARKETING, limpiamos el remarketing
    // (Esto es lo que faltaba para que no reaparezca en $0.00)
    if (com.remarketing_id) {
      await VentasRemarketingModel.update({
        comision_estado: null,
        comision_id: null,
        comision_monto: null,
        comision_tipo_plan: null,
        convertido: 1
      }, {
        where: { id: com.remarketing_id },
        transaction: t
      });
    }

    // 3. Finalmente borramos la comisión física
    await com.destroy({ transaction: t });

    await t.commit();
    return res.json({ message: "Comisión eliminada y desvinculada correctamente" });

  } catch (err) {
    await t.rollback();
    console.error("Error al eliminar comisión:", err);
    return res.status(500).json({ mensajeError: err.message });
  }
};


// GET /ventas-comisiones/resumen?vendedor_id=...&mes=..&anio=..
export const GET_resumenComisionesVendedor_CTS = async (req, res) => {
  try {
    const vendedor_id = Number(req.query.vendedor_id);
    if (!vendedor_id) {
      return res.status(400).json({ mensajeError: "vendedor_id requerido" });
    }

    const ahora = new Date();
    const mes = Number(req.query.mes ?? ahora.getMonth() + 1);
    const anio = Number(req.query.anio ?? ahora.getFullYear());

    const desde = new Date(anio, mes - 1, 1, 0, 0, 0, 0);
    const hasta = new Date(anio, mes, 0, 23, 59, 59, 999);

    const totalMensual = await VentasComisionesModel.findOne({
      attributes: [
        [fn("COALESCE", fn("SUM", col("monto_comision")), 0), "total"],
      ],
      where: {
        vendedor_id,
        estado: "aprobado",
        aprobado_at: { [Op.between]: [desde, hasta] },
      },
      raw: true,
    });

    const totalHistorico = await VentasComisionesModel.findOne({
      attributes: [
        [fn("COALESCE", fn("SUM", col("monto_comision")), 0), "total"],
      ],
      where: { vendedor_id, estado: "aprobado" },
      raw: true,
    });

    return res.json({
      vendedor_id,
      periodo: { mes, anio },
      total_mensual_aprobado: Number(totalMensual?.total || 0),
      total_historico_aprobado: Number(totalHistorico?.total || 0),
    });
  } catch (err) {
    return res.status(500).json({ mensajeError: err.message });
  }
};

// GET /ventas-comisiones/vendedor?vendedor_id=...&estado=aprobado&mes=..&anio=..&page=1&limit=15
export const GET_listarComisionesVendedor_CTS = async (req, res) => {
  try {
    const vendedor_id = Number(req.query.vendedor_id);
    if (!vendedor_id) {
      return res.status(400).json({ mensajeError: "vendedor_id requerido" });
    }

    const estado = req.query.estado || "aprobado";
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 15)));
    const offset = (page - 1) * limit;

    const ahora = new Date();
    const mes = req.query.mes ? Number(req.query.mes) : ahora.getMonth() + 1;
    const anio = req.query.anio ? Number(req.query.anio) : ahora.getFullYear();

    const desde = new Date(anio, mes - 1, 1, 0, 0, 0, 0);
    const hasta = new Date(anio, mes, 0, 23, 59, 59, 999);

    const dateField = estado === "aprobado" ? "aprobado_at" : "created_at";

    const where = { vendedor_id, estado };
    where[dateField] = { [Op.between]: [desde, hasta] };

    const { rows, count } = await VentasComisionesModel.findAndCountAll({
      where,
      order: [[dateField, "DESC"]],
      limit,
      offset,
      include: [
        { model: UserModel, as: "vendedor", attributes: ["id", "name"] },
        {
          model: VentasProspectosModel,
          as: "prospecto",
          required: false,
          attributes: ["id", "nombre", "dni", "sede", "contacto"],
        },
        {
          model: VentasRemarketingModel,
          as: "remarketing",
          required: false,
          attributes: ["id", "nombre_socio", "dni", "contacto", "sede"],
        },
      ],
    });

    // Unificar datos
    const items = rows.map((r) => {
      const item = r.toJSON();
      let clienteData = null;

      if (item.prospecto) {
        clienteData = {
          ...item.prospecto,
          origen: "prospecto",
        };
      } else if (item.remarketing) {
        clienteData = {
          id: item.remarketing.id,
          nombre: item.remarketing.nombre_socio,
          dni: item.remarketing.dni || item.remarketing.contacto,
          contacto: item.remarketing.contacto,
          sede: item.remarketing.sede,
          origen: "remarketing",
        };
      }

      return {
        ...item,
        prospecto: clienteData,
        cliente: clienteData,
        es_remarketing: !!item.remarketing_id,
      };
    });

    return res.json({ page, limit, total: count, items });
  } catch (err) {
    console.error("Error en GET_listarComisionesVendedor_CTS:", err);
    return res.status(500).json({ mensajeError: err.message });
  }
};
