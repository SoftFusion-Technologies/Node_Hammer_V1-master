/*
 * Programador: Matias Pallero
 * Fecha Cración: 20 / 10 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (CTS_TB_VentasRemarketing.js) es el controlador para las operaciones relacionadas con las ventas de remarketing.
 *
 * Tema: Controladores - Ventas Remarketing
 * Capa: Backend
 * Contacto: matuutepallero@gmail.com || 3865265100
 *
 *  Nomenclatura: OBR_ obtenerRegistro
 *                OBRS_obtenerRegistros(plural)
 *                CR_ crearRegistro
 *                ER_ eliminarRegistro
 */

// Controladores para operaciones CRUD en la tabla ventas_remarketing

import VentasRemarketingModel from "../Models/MD_TB_VentasRemarketing.js";
import { Op, QueryTypes } from "sequelize";
import db from "../DataBase/db.js";
import cron from "node-cron";

import { VentasProspectosModel } from "../Models/MD_TB_ventas_prospectos.js";
import { RecaptacionModel } from "../Models/MD_TB_Recaptacion.js";
import UsersModel from "../Models/MD_TB_Users.js";
import { SedeModel } from "../Models/MD_TB_sedes.js";
import { VentasComisionesModel } from "../Models/MD_TB_ventas_comisiones.js";

import ClientesPilatesModel from "../Models/MD_TB_ClientesPilates.js";
import InscripcionesPilatesModel from "../Models/MD_TB_InscripcionesPilates.js";
import AsistenciasPilatesModel from "../Models/MD_TB_AsistenciasPilates.js";
import { HorariosPilatesModel } from "../Models/MD_TB_HorariosPilates.js";

import ListaEsperaPilates from "../Models/MD_TB_ListaEsperaPilates.js";

// Obtener todos los registros de ventas remarketing con paginación y filtros
export const OBRS_VentasRemarketing_CTS = async (req, res) => {
  try {
    const {
      sede,
      mes,
      anio,
      enviado,
      respondido,
      agendado,
      convertido,
      comision_estado,
      nombre,
      canal,
      dni,
      contacto,
      limit,
      offset,
      order = "created_at",
      direction = "DESC",
    } = req.query;

    // console.log('Parámetros de consulta recibidos:', req.query);

    // Construcción dinámica de filtros
    const whereClause = {};

    if (sede) whereClause.sede = sede;
    if (mes) whereClause.mes = parseInt(mes);
    if (anio) whereClause.anio = parseInt(anio);
    if (enviado !== undefined) whereClause.enviado = enviado;
    if (respondido !== undefined) whereClause.respondido = respondido;
    if (agendado !== undefined) whereClause.agendado = agendado;
    if (convertido !== undefined) whereClause.convertido = convertido;
    if (comision_estado) whereClause.comision_estado = comision_estado;
    if (canal) whereClause.canal_contacto = canal;

    // Filtros de texto con búsqueda parcial
    if (nombre) {
      whereClause.nombre_socio = { [Op.like]: `%${nombre}%` };
    }
    if (contacto) {
      whereClause.contacto = { [Op.like]: `%${contacto}%` };
    }

    const validOrders = [
      "created_at",
      "fecha",
      "nombre_socio",
      "visitas",
      "id",
    ];
    const orderField = validOrders.includes(order) ? order : "created_at";
    const orderDirection = direction.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const queryOptions = {
      where: whereClause,
      order: [[orderField, orderDirection]],
      include: [
        {
          model: UsersModel,
          as: "usuario",
          attributes: ["name", "id"],
        },
      ],
    };

    let parsedLimit = null;

    if (limit) {
      const validLimits = [20, 50, 100];

      parsedLimit = validLimits.includes(parseInt(limit))
        ? parseInt(limit)
        : 20;
      queryOptions.limit = parsedLimit;
      queryOptions.offset = parseInt(offset) || 0;
    }

    const { count, rows } = await VentasRemarketingModel.findAndCountAll(
      queryOptions
    );

    // console.log(`✅ Total encontrados: ${count}, Devueltos: ${rows.length}`);

    const registrosMapeados = rows.map((row) => {
      const plainRow = row.get({ plain: true });
      return {
        ...plainRow,
        nombre: plainRow.nombre_socio,
        dni: plainRow.dni,
        asesor_nombre:
          plainRow.usuario?.name || plainRow.usuario?.usuario || "N/A",

        // 🔧 NORMALIZAR BOOLEANOS
        contactado: Boolean(plainRow.contactado),
        convertido: Boolean(plainRow.convertido),
        comision: Boolean(plainRow.comision_id),
        n_contacto_1: Boolean(plainRow.n_contacto_1),
        n_contacto_2: Boolean(plainRow.n_contacto_2),
        n_contacto_3: Boolean(plainRow.n_contacto_3),
        enviado: Boolean(plainRow.enviado),
        respondido: Boolean(plainRow.respondido),
        agendado: Boolean(plainRow.agendado),

        usuario: undefined,
      };
    });

    res.json({
      total: count,
      registros: registrosMapeados,
      limit: parsedLimit,
      offset: parseInt(offset) || 0,
      pages: parsedLimit ? Math.ceil(count / parsedLimit) : 1,
    });
  } catch (error) {
    console.error("Error al obtener ventas remarketing:", error);
    res.status(500).json({
      mensajeError: "Error al obtener ventas remarketing",
      detalle: error.message,
    });
  }
};

// Obtener un registro de venta remarketing por ID
export const OBR_VentaRemarketing_CTS = async (req, res) => {
  try {
    const registro = await VentasRemarketingModel.findByPk(req.params.id);
    if (!registro) {
      return res.status(404).json({ mensajeError: "Registro no encontrado" });
    }
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro de venta remarketing
export const CR_VentaRemarketing_CTS = async (req, res) => {
  try {
    const camposPermitidos = {
      // IDs de origen
      ventas_prospecto_id: req.body.ventas_prospecto_id || null,
      recaptacion_id: req.body.recaptacion_id || null,

      // Datos principales
      usuario_id: req.body.usuario_id,
      sede: req.body.sede,
      nombre_socio: req.body.nombre_socio,
      dni: req.body.dni,
      tipo_prospecto: req.body.tipo_prospecto || "Nuevo",
      canal_contacto: req.body.canal_contacto,
      contacto: req.body.contacto,
      actividad: req.body.actividad,
      observacion: req.body.observacion || "sin observacion",

      // ✅ SOLO fecha - mes y anio se generan automáticamente en la DB
      fecha: req.body.fecha || new Date(),

      // Contactado
      contactado: req.body.contactado || false,

      // Visitas y contactos
      visitas: req.body.visitas || 0,
      n_contacto_1: req.body.n_contacto_1 || 0,
      n_contacto_2: req.body.n_contacto_2 || 0,
      n_contacto_3: req.body.n_contacto_3 || 0,

      // Estados
      enviado: req.body.enviado || 0,
      respondido: req.body.respondido || 0,
      agendado: req.body.agendado || 0,
      convertido: req.body.convertido || 0,

      // Campos opcionales de fecha
      enviado_at: req.body.enviado_at || null,
      respondido_at: req.body.respondido_at || null,
      agendado_at: req.body.agendado_at || null,
      agendado_for_date: req.body.agendado_for_date || null,
      convertido_at: req.body.convertido_at || null,

      // Comisión
      comision_id: req.body.comision_id || null,
      comision_estado: req.body.comision_estado || null,
      comision_usuario_id: req.body.comision_usuario_id || null,
      comision_registrada_at: req.body.comision_registrada_at || null,

      // Usuario que envió
      enviado_by_user_id: req.body.enviado_by_user_id || null,
    };

    // Crear el registro SIN mes ni anio (se generan automáticamente)
    const registro = await VentasRemarketingModel.create(camposPermitidos);

    res.status(201).json({
      success: true,
      message: "Registro creado correctamente",
      registro,
    });
  } catch (error) {
    console.error("❌ Error al crear venta remarketing:", error);
    res.status(500).json({
      success: false,
      mensajeError: error.message,
    });
  }
};

// Actualizar un registro de venta remarketing por su ID
export const UR_VentaRemarketing_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const id = req.params.id;
    const registroExistente = await VentasRemarketingModel.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!registroExistente) {
      await t.rollback();
      return res.status(404).json({
        mensajeError: "Registro de remarketing no encontrado",
      });
    }

    // 🔍 Detectar si es una actualización de comisión
    const esActualizacionComision = 
      req.body.comision_estado || 
      req.body.comision_monto !== undefined || 
      req.body.comision_tipo_plan;

    console.log("📋 Registro existente:", {
      id: registroExistente.id,
      comision_id: registroExistente.comision_id,
      comision_estado: registroExistente.comision_estado
    });

    console.log("🔍 Detección:", {
      esActualizacionComision,
      tieneComisionId: !!registroExistente.comision_id,
      body: req.body
    });

    // Auto-crear comisión si no existe
    if (esActualizacionComision && !registroExistente.comision_id) {
      console.log("🆕 Auto-creando comisión porque no existe...");

      // Validar datos requeridos
      const tipo_plan = req.body.comision_tipo_plan?.trim();
      const tipo_plan_custom = req.body.comision_tipo_plan_custom?.trim();
      const monto_comision = req.body.comision_monto;

      if (!tipo_plan) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: "Debe indicar el tipo de plan para crear la comisión"
        });
      }

      if (tipo_plan.toLowerCase() === 'otros' && !tipo_plan_custom) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: "Debe especificar el detalle cuando el plan es 'Otros'"
        });
      }

      // Determinar vendedor_id (quien registra la comisión)
      const vendedor_id = Number(req.body.usuario_id) || Number(req.user?.id) || registroExistente.usuario_id;
      const sede = String(registroExistente.sede || '').trim().toLowerCase() || 'monteros';

      // Crear comisión en ventas_comisiones
      const nuevaComision = await VentasComisionesModel.create({
        remarketing_id: registroExistente.id,
        vendedor_id: vendedor_id,
        sede: sede,
        tipo_plan: tipo_plan,
        tipo_plan_custom: tipo_plan.toLowerCase() === 'otros' ? tipo_plan_custom : null,
        monto_comision: monto_comision || null,
        observacion: req.body.observacion || registroExistente.observacion || null,
        estado: req.body.comision_estado || 'en_revision',
        moneda: 'ARS'
      }, { transaction: t });

      console.log("✅ Comisión creada con ID:", nuevaComision.id);

      // Actualizar remarketing con comision_id
      const now = new Date();
      await VentasRemarketingModel.update({
        comision_id: nuevaComision.id,
        comision_estado: nuevaComision.estado,
        comision_usuario_id: vendedor_id,
        comision_registrada_at: now,
        convertido: 1,
        convertido_at: now
      }, {
        where: { id },
        transaction: t
      });

      // Si es aprobación/rechazo, actualizar la comisión inmediatamente
      const actorId = Number(req.user?.id) || vendedor_id;
      
      if (req.body.comision_estado === 'aprobado') {
        await VentasComisionesModel.update({
          estado: 'aprobado',
          aprobado_por: actorId,
          aprobado_at: now
        }, {
          where: { id: nuevaComision.id },
          transaction: t
        });
      } else if (req.body.comision_estado === 'rechazado') {
        await VentasComisionesModel.update({
          estado: 'rechazado',
          rechazado_por: actorId,
          rechazado_at: now,
          motivo_rechazo: req.body.motivo_rechazo || null
        }, {
          where: { id: nuevaComision.id },
          transaction: t
        });
      }

      await t.commit();
      console.log("✅ Comisión auto-creada y actualizada exitosamente");

      const remarketingActualizado = await VentasRemarketingModel.findByPk(id);
      return res.json({
        message: "Comisión creada y actualizada exitosamente",
        registro: remarketingActualizado
      });
    }

    // Si tiene comision_id, actualizar en ventas_comisiones
    if (esActualizacionComision && registroExistente.comision_id) {
      console.log("🔄 RUTA: Actualización de comisión existente");

      const updates = {};
      
      if (req.body.comision_tipo_plan) updates.tipo_plan = req.body.comision_tipo_plan;
      if (req.body.comision_tipo_plan_custom) updates.tipo_plan_custom = req.body.comision_tipo_plan_custom;
      if (req.body.comision_monto !== undefined) updates.monto_comision = req.body.comision_monto;
      if (req.body.observacion !== undefined) updates.observacion = req.body.observacion;

      const actorId = Number(req.user?.id) || Number(req.body.usuario_id);
      const now = new Date();

      if (req.body.comision_estado) {
        updates.estado = req.body.comision_estado;
        
        if (req.body.comision_estado === 'aprobado') {
          updates.aprobado_por = actorId;
          updates.aprobado_at = now;
        } else if (req.body.comision_estado === 'rechazado') {
          updates.rechazado_por = actorId;
          updates.rechazado_at = now;
          updates.motivo_rechazo = req.body.motivo_rechazo || null;
        }
      }

      await VentasComisionesModel.update(updates, {
        where: { id: registroExistente.comision_id },
        transaction: t
      });

      // Sincronizar estado en remarketing
      if (req.body.comision_estado) {
        await VentasRemarketingModel.update({
          comision_estado: req.body.comision_estado
        }, {
          where: { id },
          transaction: t
        });
      }

      await t.commit();
      console.log("✅ Comisión existente actualizada");

      const remarketingActualizado = await VentasRemarketingModel.findByPk(id);
      return res.json({
        message: "Comisión actualizada exitosamente",
        registro: remarketingActualizado
      });
    }

    // Actualización normal de remarketing (sin comisión)
    console.log("🔄 RUTA: Actualización normal de remarketing");
    
    await VentasRemarketingModel.update(req.body, {
      where: { id },
      transaction: t
    });

    await t.commit();
    const registroActualizado = await VentasRemarketingModel.findByPk(id);
    res.json(registroActualizado);

  } catch (error) {
    await t.rollback();
    console.error("❌ Error en UR_VentaRemarketing_CTS:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar un registro de venta remarketing por su ID
export const ER_VentaRemarketing_CTS = async (req, res) => {
  try {
    await VentasRemarketingModel.destroy({ where: { id: req.params.id } });
    res.json({ message: "Registro eliminado correctamente" });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Marcar venta como enviada
export const UR_MarcarEnviado_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const { enviado_by_user_id } = req.body;

    // console.log("📤 Marcando como enviado:", { id, enviado_by_user_id }); // DEBUG

    const [numRowsUpdated] = await VentasRemarketingModel.update(
      {
        enviado: 1,
        enviado_by_user_id,
        enviado_at: new Date(),
      },
      {
        where: { id },
      }
    );

    if (numRowsUpdated === 1) {
      const registroActualizado = await VentasRemarketingModel.findByPk(id);
      // console.log("✅ Actualizado correctamente"); // DEBUG
      res.json({
        message: "Venta marcada como enviada",
        registroActualizado,
      });
    } else {
      // console.log("⚠️ No se encontró el registro"); // DEBUG
      res.status(404).json({ mensajeError: "Registro no encontrado" });
    }
  } catch (error) {
    console.error("❌ Error en UR_MarcarEnviado_CTS:", error); // DEBUG
    res.status(500).json({ mensajeError: error.message });
  }
};

// Marcar venta como respondida
export const UR_MarcarRespondido_CTS = async (req, res) => {
  try {
    const { id } = req.params;

    const [numRowsUpdated] = await VentasRemarketingModel.update(
      {
        respondido: 1,
        respondido_at: new Date(),
      },
      {
        where: { id },
      }
    );

    if (numRowsUpdated === 1) {
      const registroActualizado = await VentasRemarketingModel.findByPk(id);
      res.json({
        message: "Venta marcada como respondida",
        registroActualizado,
      });
    } else {
      res.status(404).json({ mensajeError: "Registro no encontrado" });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Agendar venta
export const UR_AgendarVenta_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const { agendado_for_date } = req.body;

    if (!agendado_for_date) {
      return res.status(400).json({
        mensajeError: "Debe proporcionar una fecha para agendar",
      });
    }

    const [numRowsUpdated] = await VentasRemarketingModel.update(
      {
        agendado: 1,
        agendado_for_date,
        agendado_at: new Date(),
      },
      {
        where: { id },
      }
    );

    if (numRowsUpdated === 1) {
      const registroActualizado = await VentasRemarketingModel.findByPk(id);
      res.json({
        message: "Venta agendada exitosamente",
        registroActualizado,
      });
    } else {
      res.status(404).json({ mensajeError: "Registro no encontrado" });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Marcar venta como convertida
export const UR_MarcarConvertido_CTS = async (req, res) => {
  try {
    const { id } = req.params;

    const [numRowsUpdated] = await VentasRemarketingModel.update(
      {
        convertido: 1,
        convertido_at: new Date(),
      },
      {
        where: { id },
      }
    );

    if (numRowsUpdated === 1) {
      const registroActualizado = await VentasRemarketingModel.findByPk(id);
      res.json({
        message: "Venta marcada como convertida",
        registroActualizado,
      });
    } else {
      res.status(404).json({ mensajeError: "Registro no encontrado" });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Registrar comisión
export const UR_RegistrarComision_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const { comision_id, comision_estado, comision_usuario_id } = req.body;

    if (!comision_id || !comision_estado) {
      return res.status(400).json({
        mensajeError: "Debe proporcionar comision_id y comision_estado",
      });
    }

    const [numRowsUpdated] = await VentasRemarketingModel.update(
      {
        comision_id,
        comision_estado,
        comision_usuario_id,
        comision_registrada_at: new Date(),
      },
      {
        where: { id },
      }
    );

    if (numRowsUpdated === 1) {
      const registroActualizado = await VentasRemarketingModel.findByPk(id);
      res.json({
        message: "Comisión registrada exitosamente",
        registroActualizado,
      });
    } else {
      res.status(404).json({ mensajeError: "Registro no encontrado" });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener ventas por usuario con paginación
export const OBRS_VentasPorUsuario_CTS = async (req, res) => {
  try {
    const { usuario_id } = req.params;
    const {
      limit = 20,
      offset = 0,
      order = "created_at",
      direction = "DESC",
    } = req.query;

    // Validar límite
    const validLimits = [20, 50, 100];
    const parsedLimit = validLimits.includes(parseInt(limit))
      ? parseInt(limit)
      : 20;

    // Orden configurable
    const validOrders = ["created_at", "fecha", "nombre_socio", "visitas"];
    const orderField = validOrders.includes(order) ? order : "created_at";
    const orderDirection = direction.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const { count, rows } = await VentasRemarketingModel.findAndCountAll({
      where: { usuario_id },
      limit: parsedLimit,
      offset: parseInt(offset),
      order: [[orderField, orderDirection]],
    });

    res.json({
      total: count,
      registros: rows,
      limit: parsedLimit,
      offset: parseInt(offset),
      pages: Math.ceil(count / parsedLimit),
    });
  } catch (error) {
    console.error("Error al obtener ventas por usuario:", error);
    res
      .status(500)
      .json({ mensajeError: "Error al obtener ventas por usuario" });
  }
};

// Obtener ventas por sede con paginación
export const OBRS_VentasPorSede_CTS = async (req, res) => {
  try {
    const { sede } = req.params;
    const {
      limit = 20,
      offset = 0,
      order = "created_at",
      direction = "DESC",
    } = req.query;

    // Validar límite
    const validLimits = [20, 50, 100];
    const parsedLimit = validLimits.includes(parseInt(limit))
      ? parseInt(limit)
      : 20;

    // Orden configurable
    const validOrders = ["created_at", "fecha", "nombre_socio", "visitas"];
    const orderField = validOrders.includes(order) ? order : "created_at";
    const orderDirection = direction.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const { count, rows } = await VentasRemarketingModel.findAndCountAll({
      where: { sede },
      limit: parsedLimit,
      offset: parseInt(offset),
      order: [[orderField, orderDirection]],
    });

    res.json({
      total: count,
      registros: rows,
      limit: parsedLimit,
      offset: parseInt(offset),
      pages: Math.ceil(count / parsedLimit),
    });
  } catch (error) {
    console.error("Error al obtener ventas por sede:", error);
    res.status(500).json({ mensajeError: "Error al obtener ventas por sede" });
  }
};

// Obtener ventas por rango de fechas con paginación
export const OBRS_VentasPorFecha_CTS = async (req, res) => {
  try {
    const {
      fecha_inicio,
      fecha_fin,
      limit = 20,
      offset = 0,
      order = "fecha",
      direction = "DESC",
    } = req.query;

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({
        mensajeError: "Debe proporcionar fecha_inicio y fecha_fin",
      });
    }

    // Validar límite
    const validLimits = [20, 50, 100];
    const parsedLimit = validLimits.includes(parseInt(limit))
      ? parseInt(limit)
      : 20;

    // Orden configurable
    const validOrders = ["created_at", "fecha", "nombre_socio", "visitas"];
    const orderField = validOrders.includes(order) ? order : "fecha";
    const orderDirection = direction.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const { count, rows } = await VentasRemarketingModel.findAndCountAll({
      where: {
        fecha: {
          [Op.between]: [fecha_inicio, fecha_fin],
        },
      },
      limit: parsedLimit,
      offset: parseInt(offset),
      order: [[orderField, orderDirection]],
    });

    res.json({
      total: count,
      registros: rows,
      limit: parsedLimit,
      offset: parseInt(offset),
      pages: Math.ceil(count / parsedLimit),
    });
  } catch (error) {
    console.error("Error al obtener ventas por fecha:", error);
    res.status(500).json({ mensajeError: "Error al obtener ventas por fecha" });
  }
};

// Proceso automático: Crear remarketing DESDE RECAPTACIÓN no convertida
export const CR_ProcesoAutomaticoRemarketing_CTS = async (req, res) => {
  const { mes, anio } = req.body;
  // console.log(`-> [Manual] Iniciando proceso para ${mes}/${anio}`);
  const t = await VentasRemarketingModel.sequelize.transaction(); // Inicia transacción

  try {
    if (!mes || !anio) {
      await t.rollback(); // Deshace si faltan datos
      return res
        .status(400)
        .json({ mensajeError: "Debe proporcionar mes y anio." });
    }

    // 1. Buscar en Ventas Prospectos no convertidos
    // console.log("-> [Manual] Buscando en Ventas Prospectos...");
    const prospectosNoConvertidos = await VentasProspectosModel.findAll({
      where: {
        [Op.and]: [
          VentasProspectosModel.sequelize.where(
            VentasProspectosModel.sequelize.fn(
              "MONTH",
              VentasProspectosModel.sequelize.col("fecha")
            ),
            mes
          ),
          VentasProspectosModel.sequelize.where(
            VentasProspectosModel.sequelize.fn(
              "YEAR",
              VentasProspectosModel.sequelize.col("fecha")
            ),
            anio
          ),
        ],
        convertido: { [Op.or]: [false, 0, null] }, // Busca los no convertidos
      },
      // Puedes añadir include: ['usuario'] si necesitas datos del usuario asociado
    });
    // console.log(`-> [Manual] Encontrados ${prospectosNoConvertidos.length} en Ventas Prospectos.`);

    // 2. Buscar en Recaptación no convertidos
    // console.log("-> [Manual] Buscando en Recaptación...");
    const recaptacionNoConvertida = await RecaptacionModel.findAll({
      where: {
        mes: mes,
        anio: anio,
        convertido: { [Op.or]: [false, 0, null] }, // Busca los no convertidos
      },
      // Puedes añadir include: ['usuario'] si necesitas datos del usuario asociado
    });
    // console.log(`-> [Manual] Encontrados ${recaptacionNoConvertida.length} en Recaptación.`);

    const registrosParaCrear = [];
    const hoyParaFecha = new Date(); // Fecha actual para los nuevos registros

    // 3. Mapear prospectos de Ventas a formato Remarketing
    prospectosNoConvertidos.forEach((p) => {
      registrosParaCrear.push({
        ventas_prospecto_id: p.id, // ID Origen Ventas
        recaptacion_id: null, // No viene de recaptación
        usuario_id: p.usuario_id, // Asignar usuario original
        sede: p.sede,
        nombre_socio: p.nombre, // Asegúrate que 'nombre' es el campo correcto
        canal_contacto: p.canal_contacto,
        contacto: p.contacto,
        actividad: p.actividad,
        visitas: 0,
        fecha: hoyParaFecha, // Fecha de creación en Remarketing
        // Inicializar campos booleanos/tinyint a 0 o false
        n_contacto_1: 0,
        n_contacto_2: 0,
        n_contacto_3: 0,

        // Copia la observación general original
        observacion: p.observacion,

        // Copia los datos de las 3 clases de prueba
        clase_prueba_1_fecha: p.clase_prueba_1_fecha,
        clase_prueba_1_tipo: p.clase_prueba_1_tipo,
        clase_prueba_1_obs: p.clase_prueba_1_obs,

        clase_prueba_2_fecha: p.clase_prueba_2_fecha,
        clase_prueba_2_tipo: p.clase_prueba_2_tipo,
        clase_prueba_2_obs: p.clase_prueba_2_obs,

        clase_prueba_3_fecha: p.clase_prueba_3_fecha,
        clase_prueba_3_tipo: p.clase_prueba_3_tipo,
        clase_prueba_3_obs: p.clase_prueba_3_obs,

        enviado: 0,
        respondido: 0,
        agendado: 0,
        convertido: 0,
        // Asegúrate que otros campos NOT NULL tengan valor default o se incluyan
      });
    });

    // 4. Mapear registros de Recaptación a formato Remarketing (Ajusta nombres de campo!)
    recaptacionNoConvertida.forEach((r) => {
      registrosParaCrear.push({
        ventas_prospecto_id: null, // No viene directo de ventas (podría tener un ID de prospecto original si lo guardas en recaptacion)
        recaptacion_id: r.id, // ID Origen Recaptación
        usuario_id: r.usuario_id,
        sede: r.sede || "monteros", // O el default que prefieras
        nombre_socio: r.nombre, // Ajusta si el campo se llama distinto
        canal_contacto: r.tipo_contacto || "Otro", // Ajusta campo origen
        contacto: r.detalle_contacto, // Ajusta campo origen
        actividad: r.actividad || "No especifica", // Ajusta campo origen
        visitas: 0,
        fecha: hoyParaFecha,
        n_contacto_1: 0,
        n_contacto_2: 0,
        n_contacto_3: 0,

        observacion: r.observacion || null,

        enviado: 0,
        respondido: 0,
        agendado: 0,
        convertido: 0,
      });
    });

    // 5. Verificar si hay algo para crear
    if (registrosParaCrear.length === 0) {
      await t.rollback(); // No hay nada que hacer, deshace la transacción vacía
      // console.log(`-> [Manual] No se encontraron registros no convertidos en ${mes}/${anio}.`);
      return res.json({
        message: `No se encontraron prospectos o recaptaciones no convertidos en ${mes}/${anio} para generar remarketing.`,
        total_creados: 0,
      });
    }

    // 6. Crear en Remarketing usando findOrCreate para evitar duplicados
    let creados = 0;
    // console.log(`-> [Manual] Intentando crear ${registrosParaCrear.length} registros...`);
    for (const registro of registrosParaCrear) {
      // Define la condición para buscar duplicados: por ID de origen
      const whereClause = registro.ventas_prospecto_id
        ? { ventas_prospecto_id: registro.ventas_prospecto_id }
        : { recaptacion_id: registro.recaptacion_id };

      const [instance, created] = await VentasRemarketingModel.findOrCreate({
        where: whereClause, // Busca si ya existe por ID origen
        defaults: registro, // Si no existe, crea con estos datos
        transaction: t, // Dentro de la transacción
      });

      if (created) {
        creados++;
      }
    }
    // console.log(`-> [Manual] Se crearon ${creados} nuevos registros.`);

    // 7. Si todo fue bien, confirma la transacción
    await t.commit();
    // console.log("-> [Manual] Commit realizado.");

    res.json({
      message: "Proceso de remarketing completado.",
      total_creados: creados,
      total_potenciales: registrosParaCrear.length, // Informa cuántos candidatos había
    });
  } catch (error) {
    console.error("-> [Manual] ERROR DENTRO DEL TRY:", error); // Muestra el error específico
    await t.rollback(); // Deshace todo si hubo un error
    // console.log("-> [Manual] Rollback realizado debido a error.");
    res.status(500).json({
      mensajeError: "Error en el proceso automático: " + error.message,
    });
  }
};

const ejecutarCopiaDeRemarketing = async () => {
  // Iniciación del proceso automático mensual con CRON
  //console.log(`[CRON] Iniciando proceso automático de remarketing desde Ventas Prospectos...`); -- comentado para producción
  const t = await VentasRemarketingModel.sequelize.transaction();

  try {
    const fechaHoy = new Date();
    const mesActual = fechaHoy.getMonth() + 1;
    const anioActual = fechaHoy.getFullYear();

    // Calcular mes y año ANTERIOR para BUSCAR prospectos
    let mesAnterior, anioAnterior;

    if (mesActual === 1) {
      mesAnterior = 12;
      anioAnterior = anioActual - 1;
    } else {
      mesAnterior = mesActual - 1;
      anioAnterior = anioActual;
    }

    // Comentarios de log para seguimiento del proceso -- comentado para producción
    // console.log(`-> [CRON] Fecha actual: ${fechaHoy.toLocaleDateString()}`);
    // console.log(`-> [CRON] Mes actual: ${mesActual}/${anioActual}`);
    // console.log(`-> [CRON] Buscando prospectos no convertidos de ${mesAnterior}/${anioAnterior}`);

    // Buscar prospectos del mes ANTERIOR que:
    // 1. NO estén convertidos en ventas_prospectos
    // 2. NO estén convertidos en ventas_remarketing del mes ACTUAL
    const prospectosNoConvertidos = await VentasProspectosModel.findAll({
      where: {
        // ✅ Buscar todos los registros ANTES del mes actual
        [Op.or]: [
          // Años anteriores completos
          {
            [Op.and]: [
              VentasProspectosModel.sequelize.where(
                VentasProspectosModel.sequelize.fn(
                  "YEAR",
                  VentasProspectosModel.sequelize.col("fecha")
                ),
                { [Op.lt]: anioActual }
              ),
            ],
          },
          // Mismo año pero meses anteriores
          {
            [Op.and]: [
              VentasProspectosModel.sequelize.where(
                VentasProspectosModel.sequelize.fn(
                  "YEAR",
                  VentasProspectosModel.sequelize.col("fecha")
                ),
                anioActual
              ),
              VentasProspectosModel.sequelize.where(
                VentasProspectosModel.sequelize.fn(
                  "MONTH",
                  VentasProspectosModel.sequelize.col("fecha")
                ),
                { [Op.lt]: mesActual }
              ),
            ],
          },
        ],
        convertido: { [Op.or]: [false, 0, null] },
      },
      transaction: t,
      logging: false,
    });

    // Comentario de log para saber cuántos prospectos se encontraron -- comentado para producción
    // console.log(`-> [CRON] Encontrados ${prospectosNoConvertidos.length} prospectos del mes anterior no convertidos.`);

    if (prospectosNoConvertidos.length === 0) {
      await t.rollback();
      // console.log(`-> [CRON] No se encontraron registros. Proceso finalizado.`);
      return;
    }

    // Usar fecha del MES ACTUAL (no del mes anterior)
    const fechaNormalizada = new Date(anioActual, mesActual - 1, 1);
    // console.log(`-> [CRON] Fecha normalizada para remarketing: ${fechaNormalizada.toLocaleDateString()}`);
    // console.log(`-> [CRON] Creando registros para: ${mesActual}/${anioActual}`);

    let creados = 0;
    let omitidos = 0;
    let convertidosEnRemarketing = 0;

    for (const p of prospectosNoConvertidos) {
      // Verificar si ya está convertido en remarketing (cualquier mes)
      const yaConvertidoEnRemarketing = await VentasRemarketingModel.findOne({
        where: {
          ventas_prospecto_id: p.id,
          convertido: 1,
        },
        transaction: t,
        logging: false,
      });

      if (yaConvertidoEnRemarketing) {
        convertidosEnRemarketing++;
        // console.log(`-> [CRON] ⭐ Prospecto ${p.id} ya fue convertido en remarketing, omitiendo.`);
        continue;
      }

      // Verificar si ya existe para el MES ACTUAL
      const yaExisteEsteMes = await VentasRemarketingModel.findOne({
        where: {
          ventas_prospecto_id: p.id,
          mes: mesActual,
          anio: anioActual,
        },
        transaction: t,
        logging: false,
      });

      if (yaExisteEsteMes) {
        omitidos++;
        // console.log(`-> [CRON] ⚠️ Omitido: ${p.nombre} (ID: ${p.id}) - Ya existe en ${mesActual}/${anioActual}`);
        continue;
      }

      // Calcular visitas
      let visitas = 0;
      if (p.clase_prueba_1_fecha) visitas++;
      if (p.clase_prueba_2_fecha) visitas++;
      if (p.clase_prueba_3_fecha) visitas++;

      const CANALES_VALIDOS = {
        'Desde pilates': 'Baja Pilates',
        'Baja Pilates': 'Baja Pilates',
        'Mostrador': 'Mostrador',
        'Whatsapp': 'Whatsapp',
        'Instagram': 'Instagram',
        'Facebook': 'Facebook',
        'Pagina web': 'Pagina web',
        'Campaña': 'Campaña',
        'Comentarios/Stickers': 'Comentarios/Stickers'
      };

      // Función para normalizar canal de contacto
      const normalizarCanal = (canal) => {
        if (!canal) return 'Mostrador'; // Default
        
        // Si el canal está en el mapeo, usarlo
        if (CANALES_VALIDOS[canal]) {
          return CANALES_VALIDOS[canal];
        }
        
        // Si es uno de los valores válidos directamente
        const valoresValidos = Object.values(CANALES_VALIDOS);
        if (valoresValidos.includes(canal)) {
          return canal;
        }
        
        // Caso por defecto
        return 'Mostrador';
      };

      const canalContacto = normalizarCanal(p.canal_contacto);

      const registroNuevo = {
        ventas_prospecto_id: p.id,
        usuario_id: p.usuario_id,
        sede: p.sede,
        nombre_socio: p.nombre,
        dni: p.dni,
        canal_contacto: canalContacto,
        contacto: p.contacto,
        actividad: p.actividad,
        tipo_prospecto: p.tipo_prospecto,
        observacion: p.observacion,
        fecha: fechaNormalizada, // Fecha del MES ACTUAL
        visitas: visitas,
        enviado: 0,
        respondido: 0,
        agendado: 0,
        convertido: 0,
        contactado: false,
        n_contacto_1: 0,
        n_contacto_2: 0,
        n_contacto_3: 0,
      };

      await VentasRemarketingModel.create(registroNuevo, {
        transaction: t,
        logging: false,
      });
      creados++;
      // console.log(`-> [CRON] ✅ Creado para ${mesActual}/${anioActual}: ${p.nombre} (ID: ${p.id})`); -- comentado para producción
    }

    await t.commit();
    // console.log(`-> [CRON] ========================================`);
    // console.log(`-> [CRON] Proceso completado exitosamente`);
    // console.log(`-> [CRON] Total prospectos del mes anterior: ${prospectosNoConvertidos.length}`);
    // console.log(`-> [CRON] Nuevos creados para ${mesActual}/${anioActual}: ${creados}`);
    // console.log(`-> [CRON] Omitidos (ya existen este mes): ${omitidos}`);
    // console.log(`-> [CRON] Ya convertidos en remarketing: ${convertidosEnRemarketing}`);
    // console.log(`-> [CRON] ========================================`);
    // -- comentado para producción
  } catch (error) {
    await t.rollback();
    console.error(
      `-> [CRON] ❌ ERROR en proceso automático de remarketing:`,
      error
    );
  }
};

// Obtener las clases programadas para hoy (o fecha dada) para remarketing
export const OBRS_ClasesHoy_CTS = async (req, res) => {
  try {
    const { fecha, usuario_id } = req.query;

    // Calcular fecha de Argentina manualmente
    let fechaBuscar;
    if (fecha) {
      fechaBuscar = fecha;
    } else {
      const now = new Date();
      const argentinaTime = new Date(
        now.toLocaleString("en-US", {
          timeZone: "America/Argentina/Buenos_Aires",
        })
      );

      const year = argentinaTime.getFullYear();
      const month = String(argentinaTime.getMonth() + 1).padStart(2, "0");
      const day = String(argentinaTime.getDate()).padStart(2, "0");
      fechaBuscar = `${year}-${month}-${day}`;
    }

    // console.log("📅 Fecha a buscar (Argentina):", fechaBuscar, "usuario:", usuario_id);

    // ✅ REPLICAR EXACTAMENTE LA LÓGICA SQL QUE FUNCIONABA
    const whereClause = {
      [Op.or]: [
        VentasRemarketingModel.sequelize.where(
          VentasRemarketingModel.sequelize.fn(
            "DATE",
            VentasRemarketingModel.sequelize.col("clase_prueba_1_fecha")
          ),
          fechaBuscar
        ),
        VentasRemarketingModel.sequelize.where(
          VentasRemarketingModel.sequelize.fn(
            "DATE",
            VentasRemarketingModel.sequelize.col("clase_prueba_2_fecha")
          ),
          fechaBuscar
        ),
        VentasRemarketingModel.sequelize.where(
          VentasRemarketingModel.sequelize.fn(
            "DATE",
            VentasRemarketingModel.sequelize.col("clase_prueba_3_fecha")
          ),
          fechaBuscar
        ),
      ],
    };

    // Si se proporciona usuario_id, agregar al filtro (fuera del Op.or)
    if (usuario_id) {
      whereClause.usuario_id = usuario_id;
    }

    // Buscar con Sequelize
    const clases = await VentasRemarketingModel.findAll({
      where: whereClause,
      attributes: [
        "id",
        "usuario_id",
        "nombre_socio",
        "dni",
        "contacto",
        "actividad",
        "sede",
        "observacion",
        "enviado",
        "respondido",
        "agendado",
        "convertido",
        "clase_prueba_1_fecha",
        "clase_prueba_1_tipo",
        "clase_prueba_2_fecha",
        "clase_prueba_2_tipo",
        "clase_prueba_3_fecha",
        "clase_prueba_3_tipo",
      ],
      include: [
        {
          model: UsersModel,
          as: "usuario",
          attributes: ["id", "name"],
        },
      ],
      order: [["enviado", "ASC"]],
    });

    // Mapear para determinar qué clase corresponde a la fecha
    const clasesFormateadas = clases.map((clase) => {
      const plain = clase.get({ plain: true });

      let numero_clase = null;
      let fecha_clase = null;
      let tipo_clase = null;

      // Determinar cuál de las 3 clases corresponde a la fecha buscada
      const fecha1 = plain.clase_prueba_1_fecha
        ? new Date(plain.clase_prueba_1_fecha).toISOString().split("T")[0]
        : null;
      const fecha2 = plain.clase_prueba_2_fecha
        ? new Date(plain.clase_prueba_2_fecha).toISOString().split("T")[0]
        : null;
      const fecha3 = plain.clase_prueba_3_fecha
        ? new Date(plain.clase_prueba_3_fecha).toISOString().split("T")[0]
        : null;

      if (fecha1 === fechaBuscar) {
        numero_clase = 1;
        fecha_clase = plain.clase_prueba_1_fecha;
        tipo_clase = plain.clase_prueba_1_tipo;
      } else if (fecha2 === fechaBuscar) {
        numero_clase = 2;
        fecha_clase = plain.clase_prueba_2_fecha;
        tipo_clase = plain.clase_prueba_2_tipo;
      } else if (fecha3 === fechaBuscar) {
        numero_clase = 3;
        fecha_clase = plain.clase_prueba_3_fecha;
        tipo_clase = plain.clase_prueba_3_tipo;
      }

      return {
        prospecto_id: plain.id,
        usuario_id: plain.usuario_id,
        nombre: plain.nombre_socio,
        dni: plain.dni,
        contacto: plain.contacto,
        actividad: plain.actividad,
        sede: plain.sede,
        observacion: plain.observacion,
        enviado: Boolean(plain.enviado),
        respondido: Boolean(plain.respondido),
        agendado: Boolean(plain.agendado),
        convertido: Boolean(plain.convertido),
        numero_clase,
        fecha: fecha_clase,
        tipo: tipo_clase,
        asesor_nombre: plain.usuario?.name || "Sin asesor",
      };
    });

    // 🔧 HEADERS PARA EVITAR CACHÉ
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Surrogate-Control": "no-store",
    });

    // console.log(`✅ ${clasesFormateadas.length} clases encontradas para ${fechaBuscar}`);
    res.json(clasesFormateadas);
  } catch (error) {
    console.error("❌ Error en OBRS_ClasesHoy_CTS:", error);
    res.status(500).json({
      mensajeError: "Error al obtener clases del día",
      detalle: error.message,
    });
  }
};

// Se la utiliza en CTS_TB_ClientesPilates.js
// Mover cliente de Pilates a Remarketing y eliminarlo de Pilates
export const MOVER_ClientePilatesARemarketing = async (id_cliente_pilates) => {
  try {
    // 1. Buscar Datos del Cliente
    const cliente = await ClientesPilatesModel.findByPk(id_cliente_pilates);
    
    // Si no existe el cliente, salimos sin hacer nada (o lanzamos error si prefieres)
    if (!cliente) return; 

    // 2. Determinar la SEDE
    let nombreSede = "Sede Desconocida";

    // Buscamos la inscripción más reciente para ver de dónde viene
    const ultimaInscripcion = await InscripcionesPilatesModel.findOne({
      where: { id_cliente: id_cliente_pilates },
      order: [['id', 'DESC']],
    });

    if (ultimaInscripcion && ultimaInscripcion.id_horario) {
        // Buscamos horario y sede usando los modelos importados
        const horario = await HorariosPilatesModel.findByPk(ultimaInscripcion.id_horario);
        if (horario && horario.id_sede) {
            const sedeData = await SedeModel.findByPk(horario.id_sede);
            if (sedeData) {
                nombreSede = (sedeData.nombre || sedeData.sede || "Sede Encontrada").trim();
            }
        }
    }

    // 3. Determinar el Usuario Responsable (ID 36 si es null)
    let usuarioResponsable = cliente.id_usuario_contacto;
    if (!usuarioResponsable) usuarioResponsable = 36; 

    // 4. Crear registro en Ventas Remarketing
    await VentasRemarketingModel.create({
      usuario_id: usuarioResponsable,
      sede: nombreSede,
      nombre_socio: cliente.nombre, 
      dni: cliente.dni,
      canal_contacto: "Baja Pilates", 
      contacto: cliente.telefono,
      actividad: "Pilates",
      tipo_prospecto: "ExSocio",
      observacion: `Eliminado de la grilla de Pilates. Obs original: ${cliente.observaciones || "Ninguna"}`,
      fecha: new Date(),
      // Defaults obligatorios
      contactado: 0, visitas: 0, enviado: 0, respondido: 0, agendado: 0, convertido: 0
    });

    console.log(`[Remarketing] Cliente ${id_cliente_pilates} copiado exitosamente.`);
    return true;

  } catch (error) {
    // Solo logueamos el error para no romper el proceso de eliminación principal
    console.error("Error al copiar cliente a Remarketing:", error);
    return false;
  }
};

// Se la utiliza en CTS_TB_ListaEsperaPilates.js
// Mover lista de clientes de Pilates a Remarketing
export const MOVER_ListaEsperaPilatesARemarketing = async (idListaEspera) => {
  try {
    // 1. Buscar el registro en la lista de espera
    const registroEspera = await ListaEsperaPilates.findByPk(idListaEspera);
    if (!registroEspera) return;

    // 2. Obtener el nombre de la Sede
    let nombreSede = "Sede Desconocida";
    if (registroEspera.id_sede) {
        const sedeData = await SedeModel.findByPk(registroEspera.id_sede);
        if (sedeData) {
            // Normalizamos el nombre (trim)
            nombreSede = (sedeData.nombre || sedeData.sede || "Sede Encontrada").trim();
        }
    }

    // 3. Determinar usuario responsable (Default Admin 36 si viene null)
    let usuarioResponsable = registroEspera.id_usuario_cargado || 36;

    // 4. Construir observación detallada (para no perder datos de plan/horarios)
    const detalleObservacion = `Eliminado de Lista de Espera de Pilates. Obs original: ${registroEspera.observaciones || "Ninguna"}`;

    // 5. Crear registro en Remarketing
    await VentasRemarketingModel.create({
        usuario_id: usuarioResponsable,
        sede: nombreSede,
        nombre_socio: registroEspera.nombre,
        dni: registroEspera.dni,
        canal_contacto: "Baja Pilates", // Usamos este canal para identificar origen
        contacto: registroEspera.contacto,
        actividad: "Pilates",
        tipo_prospecto: "ExSocio",
        observacion: detalleObservacion, // Aquí guardamos toda la info extra
        fecha: new Date(),
        // Valores por defecto
        contactado: 0, visitas: 0, enviado: 0, respondido: 0, agendado: 0, convertido: 0
    });

  } catch (error) {
    console.error("Error al mover Lista Espera a Remarketing (Continuando eliminación):", error);
  }
};

export const POST_convertirRemarketing_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const remarketing_id = Number(req.params.id);
    if (!Number.isInteger(remarketing_id) || remarketing_id <= 0) {
      throw new Error('ID de remarketing inválido');
    }

    const actorId = Number(req.user?.id) || Number(req.body?.actor_id);
    if (!Number.isInteger(actorId) || actorId <= 0) {
      throw new Error('No se pudo determinar el usuario que convierte (actor_id)');
    }

    const remarketing = await VentasRemarketingModel.findByPk(remarketing_id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!remarketing) throw new Error('Registro de remarketing no encontrado');

    const esComision = !!req.body?.esComision;
    const now = new Date();

    // 1. Marcar como convertido en remarketing
    await VentasRemarketingModel.update(
      {
        convertido: 1,
        convertido_at: now
      },
      { where: { id: remarketing_id }, transaction: t }
    );

    // 2. Si NO es comisión, terminar aquí
    if (!esComision) {
    // Ya se marcó como convertido arriba (línea 1437-1443)
      const data = await VentasRemarketingModel.findByPk(remarketing_id, {
        transaction: t
      });

      await t.commit();
      return res.json({
        message: 'Remarketing convertido sin comisión',
        remarketing: data
      });
    }

    // 3. Validar datos de comisión
    const tipo_plan = req.body?.tipo_plan?.trim();
    const tipo_plan_custom = req.body?.tipo_plan_custom?.trim();
    const observacion = req.body?.observacion?.trim() || null;

    if (!tipo_plan) {
      throw new Error('Debe indicar el tipo de plan');
    }
    if (tipo_plan.toLowerCase() === 'otros' && !tipo_plan_custom) {
      throw new Error('Debe completar el detalle cuando el plan es "Otros"');
    }

    // 4. Verificar que no exista comisión pendiente
    const yaPendiente = await VentasComisionesModel.findOne({
      where: { remarketing_id, estado: 'en_revision' },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (yaPendiente) {
      throw new Error('Ya existe una comisión en revisión para este remarketing');
    }

    // 5. Crear comisión en ventas_comisiones
    const vendedor_id = actorId;
    const sede = String(remarketing.sede || '').trim().toLowerCase() || 'monteros';

    const comision = await VentasComisionesModel.create({
      remarketing_id: remarketing.id,
      vendedor_id: vendedor_id,
      sede: sede,
      tipo_plan: tipo_plan,
      tipo_plan_custom: tipo_plan.toLowerCase() === 'otros' ? tipo_plan_custom : null,
      observacion: observacion,
      estado: 'en_revision',
      moneda: 'ARS',
      monto_comision: null
    }, { transaction: t });

    // 6. Sincronizar remarketing con comision_id
    await VentasRemarketingModel.update({
      comision_id: comision.id,
      comision_estado: 'en_revision',
      comision_usuario_id: vendedor_id,
      comision_registrada_at: now
    }, { where: { id: remarketing_id }, transaction: t });

    const remarketingActualizado = await VentasRemarketingModel.findByPk(
      remarketing_id,
      { transaction: t }
    );

    await t.commit();
    return res.status(201).json({
      message: 'Remarketing convertido y comisión creada en revisión',
      remarketing: remarketingActualizado,
      comision
    });
  } catch (err) {
    await t.rollback();
    console.error('❌ Error en POST_convertirRemarketing_CTS:', err);
    return res.status(400).json({ mensajeError: err.message });
  }
};

// Tarea programada: se ejecuta el día 1 de cada mes a las 00:10 AM
export const SCHEDULE_VentasRemarketingCron = () => {
  // Tarea: '10 0 1 * *' -> Minuto 10, Hora 0, Día 1 del mes, Cualquier mes, Cualquier día de la semana
  cron.schedule("10 0 1 * *", ejecutarCopiaDeRemarketing, {
    //cron.schedule('*/1 * * * *', ejecutarCopiaDeRemarketing, {
    scheduled: true,
    timezone: "America/Argentina/Tucuman",
  });
  console.log(
    "-> [CRON] Tarea de Remarketing programada para ejecutarse el día 1 de cada mes a las 00:10 AM."
  );
};
