/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 08 / 04 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * * Motor de procesamiento de pagos y haberes.
 * * Calcula resúmenes proyectados, saldos de deuda por adelantos previos y horas netas a pagar.
 * * Realiza el cierre masivo de marcaciones vinculadas bajo transacciones atómicas.
 * Tema: Controladores - RRHH Liquidaciones
 * * Capa: Backend 
 *
 * Nomenclatura: 
 * * OBRS_ obtenerRegistros (Historial de pagos)
 * * OBRS_ PendientesLiquidar (Pre-cálculo de resumen y deudas)
 * * CR_ crearRegistro (Emisión de liquidación y generación de detalles)
 * * UPD_ AnularLiquidacion (Rollback de estados y liberación de marcaciones)
 */
import { Op } from "sequelize";
import RRHHLiquidacionesModel from "../../Models/RRHH/MD_TB_RRHHLiquidaciones.js";
import RRHHLiquidacionDetalleModel from "../../Models/RRHH/MD_TB_RRHHLiquidacionDetalle.js";
import RRHHMarcacionesModel from "../../Models/RRHH/MD_TB_RRHHMarcaciones.js";
import UsersModel from "../../Models/MD_TB_Users.js";
import Sedes from "../../Models/MD_TB_sedes.js";
import RRHHHorariosModel from "../../Models/RRHH/MD_TB_RRHHHorarios.js";
import RRHHCuentasBancariasModel from "../../Models/RRHH/MD_TB_RRHH_CuentasBancarias.js";
import db from "../../DataBase/db.js";

const { SedeModel } = Sedes;

// ======================================================
// Helpers
// ======================================================

const redondear2 = (valor) => Number((Number(valor || 0)).toFixed(2));

const horasADecimal = (minutos) => redondear2((Number(minutos || 0) / 60));

const decimalAMinutos = (horasDecimal) => Math.round(Number(horasDecimal || 0) * 60);

const formatearHorasHHMM = (horasDecimal) => {
  const totalMinutos = decimalAMinutos(horasDecimal);
  const signo = totalMinutos < 0 ? "-" : "";
  const minutosAbs = Math.abs(totalMinutos);
  const horas = Math.floor(minutosAbs / 60);
  const minutos = minutosAbs % 60;
  return `${signo}${horas}:${String(minutos).padStart(2, "0")}`;
};

const obtenerPrimeraMarcacionPendiente = async (usuario_id, sede_id, transaction = null) => {
  return RRHHMarcacionesModel.findOne({
    where: {
      usuario_id,
      sede_id,
      eliminado: 0,
      estado_aprobacion: "aprobada",
      liquidacion_id: null,
    },
    order: [
      ["fecha", "ASC"],
      ["id", "ASC"],
    ],
    transaction,
  });
};

const obtenerUltimaLiquidacionConfirmada = async (usuario_id, sede_id, transaction = null) => {
  return RRHHLiquidacionesModel.findOne({
    where: {
      usuario_id,
      sede_id,
      eliminado: 0,
      estado: "confirmada",
    },
    order: [
      ["fecha_hasta", "DESC"],
      ["id", "DESC"],
    ],
    transaction,
  });
};

const obtenerMarcacionesLiquidables = async ({ usuario_id, sede_id, fecha_desde, fecha_hasta, transaction = null }) => {
  return RRHHMarcacionesModel.findAll({
    where: {
      usuario_id,
      sede_id,
      eliminado: 0,
      estado_aprobacion: "aprobada",
      liquidacion_id: null,
      fecha: {
        [Op.between]: [fecha_desde, fecha_hasta],
      },
    },
    include: [{ model: RRHHHorariosModel, as: "horario" }],
    order: [
      ["fecha", "ASC"],
      ["id", "ASC"],
    ],
    transaction,
  });
};

// Devuelve minutos base
const calcularMinutosBaseMarcacion = (marcacion) => {
  if (marcacion.estado === "extra") return 0;

  if (marcacion.horario?.hora_entrada && marcacion.horario?.hora_salida) {
    const [hEntrada, mEntrada] = marcacion.horario.hora_entrada.split(":").map(Number);
    const [hSalida, mSalida] = marcacion.horario.hora_salida.split(":").map(Number);

    if (!Number.isFinite(hEntrada) || !Number.isFinite(mEntrada) || !Number.isFinite(hSalida) || !Number.isFinite(mSalida)) {
      return 0;
    }

    const minEntrada = hEntrada * 60 + mEntrada;
    const minSalida = hSalida * 60 + mSalida;
    const diff = minSalida - minEntrada;

    return diff > 0 ? diff : 0;
  }

  if (!marcacion?.hora_entrada || !marcacion?.hora_salida) return 0;

  const entrada = new Date(marcacion.hora_entrada);
  const salida = new Date(marcacion.hora_salida);

  if (Number.isNaN(entrada.getTime()) || Number.isNaN(salida.getTime()) || salida <= entrada) {
    return 0;
  }

  return Math.round((salida - entrada) / (1000 * 60));
};

// Devuelve minutos extra autorizados
const calcularMinutosExtrasAutorizados = (marcacion) => {
  const minutos = Number(marcacion.minutos_extra_autorizados || 0);
  return Number.isFinite(minutos) && minutos > 0 ? Math.round(minutos) : 0;
};

const calcularMinutosLiquidadosMarcacion = (marcacion) => {
  const minutosBase = calcularMinutosBaseMarcacion(marcacion);
  const minutosExtras = calcularMinutosExtrasAutorizados(marcacion);
  const minutosDescuento = Number(marcacion.minutos_descuento || 0);

  return Math.max(0, minutosBase + minutosExtras - minutosDescuento);
};

// ======================================================
// NUEVA LÓGICA DE RESUMEN
// ======================================================
const calcularResumenLiquidable = async ({
  usuario_id,
  sede_id,
  fecha_desde,
  fecha_hasta,
  transaction = null
}) => {
  const marcaciones = await obtenerMarcacionesLiquidables({
    usuario_id,
    sede_id,
    fecha_desde,
    fecha_hasta,
    transaction
  });

  let minutosTrabajados = 0;

  marcaciones.forEach((m) => {
    minutosTrabajados += calcularMinutosLiquidadosMarcacion(m);
  });

  const liquidacionesPrevias = await RRHHLiquidacionesModel.findAll({
    where: { usuario_id, sede_id, estado: "confirmada", eliminado: 0 },
    transaction
  });

  let totalAdelantosDados = 0;
  let totalAdelantosCobrados = 0;

  liquidacionesPrevias.forEach((liq) => {
    totalAdelantosDados += Number(liq.horas_adelanto_futuro || 0);
    totalAdelantosCobrados += Number(liq.saldo_adelantos_previos || 0);
  });

  const horasDeudaEmpleado = totalAdelantosDados - totalAdelantosCobrados;

  return {
    marcaciones,
    horas_trabajadas_periodo: horasADecimal(minutosTrabajados),
    saldo_adelantos_previos:
      horasDeudaEmpleado > 0 ? redondear2(horasDeudaEmpleado) : 0
  };
};

// ======================================================
// Mostrar todas las liquidaciones
// ======================================================
export const OBRS_RRHHLiquidaciones_CTS = async (req, res) => {
  try {
    const { usuario_id, sede_id, estado, fecha_desde, fecha_hasta, fecha_liquidacion_desde, fecha_liquidacion_hasta } = req.query;

    const filtros = { eliminado: 0 };

    if (usuario_id) filtros.usuario_id = usuario_id;
    if (sede_id) filtros.sede_id = sede_id;
    if (estado) filtros.estado = estado;

    if (fecha_desde && fecha_hasta) {
      filtros.fecha_desde = { [Op.gte]: fecha_desde };
      filtros.fecha_hasta = { [Op.lte]: fecha_hasta };
    }

    if (fecha_liquidacion_desde && fecha_liquidacion_hasta) {
      filtros.fecha_liquidacion = {
        [Op.between]: [fecha_liquidacion_desde, fecha_liquidacion_hasta],
      };
    }

    const registros = await RRHHLiquidacionesModel.findAll({
      where: filtros,
      include: [
        { model: UsersModel, as: "usuario", attributes: ["id", "name"] },
        { model: UsersModel, as: "liquidador", attributes: ["id", "name"] },
        { model: SedeModel, as: "sede", attributes: ["id", "nombre"] },
        { model: RRHHCuentasBancariasModel, as: "cuenta_bancaria" },
        {
          model: RRHHLiquidacionDetalleModel,
          as: "detalles",
          where: { eliminado: 0 },
          required: false,
        },
      ],
      order: [
        ["fecha_liquidacion", "DESC"],
        ["id", "DESC"],
      ],
    });

    res.json(registros);
  } catch (error) {
    console.error("ERROR EN OBRS_RRHHLiquidaciones_CTS:", error);
    res.status(500).json({ message: error.message });
  }
};

// ======================================================
// Mostrar una liquidación por ID
// ======================================================
export const OBR_RRHHLiquidacion_CTS = async (req, res) => {
  try {
    const registro = await RRHHLiquidacionesModel.findOne({
      where: { id: req.params.id, eliminado: 0 },
      include: [
        { model: UsersModel, as: "usuario", attributes: ["id", "name"] },
        { model: UsersModel, as: "liquidador", attributes: ["id", "name"] },
        { model: SedeModel, as: "sede", attributes: ["id", "nombre"] },
        { model: RRHHCuentasBancariasModel, as: "cuenta_bancaria" },
        {
          model: RRHHLiquidacionDetalleModel,
          as: "detalles",
          where: { eliminado: 0 },
          required: false,
          include: [
            { model: RRHHMarcacionesModel, as: "marcacion", required: false },
          ],
        },
        {
          model: RRHHMarcacionesModel,
          as: "marcaciones_liquidadas",
          where: { eliminado: 0 },
          required: false,
        },
      ],
    });

    if (!registro) {
      return res.status(404).json({ message: "Liquidación no encontrada" });
    }

    res.json(registro);
  } catch (error) {
    console.error("ERROR EN OBR_RRHHLiquidacion_CTS:", error);
    res.status(500).json({ message: error.message });
  }
};

// ======================================================
// Resumen previo para liquidar
// ======================================================
export const OBRS_PendientesLiquidar_CTS = async (req, res) => {
  try {
    const { usuario_id } = req.params;
    const { sede_id, fecha_desde, fecha_hasta } = req.query;

    if (!usuario_id || !sede_id) {
      return res.status(400).json({ message: "usuario_id y sede_id son obligatorios" });
    }

    const ultimaLiquidacion = await obtenerUltimaLiquidacionConfirmada(usuario_id, sede_id);
    const primeraPendiente = await obtenerPrimeraMarcacionPendiente(usuario_id, sede_id);

    let fechaDesdeSugerida = fecha_desde;

    if (!fechaDesdeSugerida) {
      if (primeraPendiente?.fecha) {
        fechaDesdeSugerida = primeraPendiente.fecha;
      } else if (ultimaLiquidacion?.fecha_hasta) {
        const siguienteDia = new Date(ultimaLiquidacion.fecha_hasta);
        siguienteDia.setDate(siguienteDia.getDate() + 1);
        fechaDesdeSugerida = siguienteDia.toISOString().slice(0, 10);
      } else {
        const hoy = new Date();
        fechaDesdeSugerida = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
          .toISOString()
          .slice(0, 10);
      }
    }

    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const fechaHastaSugerida = fecha_hasta || ayer.toISOString().slice(0, 10);

    const resumen = await calcularResumenLiquidable({
      usuario_id,
      sede_id,
      fecha_desde: fechaDesdeSugerida,
      fecha_hasta: fechaHastaSugerida,
    });

    return res.json({
      usuario_id: Number(usuario_id),
      sede_id: Number(sede_id),
      fecha_desde_sugerida: fechaDesdeSugerida,
      fecha_hasta_sugerida: fechaHastaSugerida,

      horas_trabajadas_periodo: formatearHorasHHMM(resumen.horas_trabajadas_periodo),
      saldo_adelantos_previos: formatearHorasHHMM(resumen.saldo_adelantos_previos),

      cantidad_marcaciones: resumen.marcaciones.length,

      marcaciones: resumen.marcaciones.map((m) => {
        const minutosBase = calcularMinutosBaseMarcacion(m);
        const minutosExtra = calcularMinutosExtrasAutorizados(m);
        const minutosDescuento = Number(m.minutos_descuento || 0);

        const minutosTotales = Math.max(
          0,
          minutosBase + minutosExtra - minutosDescuento
        );

        return {
          id: m.id,
          fecha: m.fecha,
          hora_entrada: m.hora_entrada,
          hora_salida: m.hora_salida,
          horas_normales: formatearHorasHHMM(horasADecimal(minutosBase)),
          horas_extras: formatearHorasHHMM(horasADecimal(minutosExtra)),
          horas_descuento: formatearHorasHHMM(horasADecimal(minutosDescuento)),
          horas_totales: formatearHorasHHMM(horasADecimal(minutosTotales)),
          estado: m.estado,
          comentarios: m.comentarios,
          minutos_descuento: minutosDescuento,
        };
      }),

      ultima_liquidacion: ultimaLiquidacion
        ? {
            id: ultimaLiquidacion.id,
            fecha_desde: ultimaLiquidacion.fecha_desde,
            fecha_hasta: ultimaLiquidacion.fecha_hasta,
            horas_liquidadas: formatearHorasHHMM(ultimaLiquidacion.horas_liquidadas),
          }
        : null,
    });
  } catch (error) {
    console.error("ERROR EN OBRS_PendientesLiquidar_CTS:", error);
    return res.status(500).json({ message: error.message });
  }
};

// ======================================================
// Crear / emitir liquidación nueva
// ======================================================
export const CR_EmitirLiquidacion_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const {
      usuario_id, sede_id, fecha_desde, fecha_hasta, fecha_liquidacion, fecha_pago,
      observacion, tipo_liquidacion, subtipo_adelanto, cuenta_bancaria_id, liquidado_por,
      marcacion_ids, horas_descontadas = 0, horas_adelanto = 0
    } = req.body;

    if (!usuario_id || !sede_id || !fecha_desde || !fecha_hasta || !fecha_liquidacion) {
      await t.rollback();
      return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    const esAdelantoFuturo =
      tipo_liquidacion === "adelanto" &&
      subtipo_adelanto === "horas_futuras";

    if (!esAdelantoFuturo && (!Array.isArray(marcacion_ids) || marcacion_ids.length === 0)) {
      await t.rollback();
      return res.status(400).json({ message: "Debés enviar marcaciones seleccionadas" });
    }

    const resumen = await calcularResumenLiquidable({
      usuario_id, sede_id, fecha_desde, fecha_hasta, transaction: t
    });

    let marcacionesSeleccionadas = [];
    let horasTrabajadas = 0;
    let horasAdelantoFuturo = esAdelantoFuturo ? Number(horas_adelanto) : 0;
    let horasDescontadasNum = Number(horas_descontadas);
    let saldoACobrar = 0;

    if (!esAdelantoFuturo) {
      marcacionesSeleccionadas = resumen.marcaciones.filter((m) =>
        marcacion_ids.includes(m.id)
      );

      const minutosSeleccionados = marcacionesSeleccionadas.reduce(
        (acc, m) => acc + calcularMinutosLiquidadosMarcacion(m),
        0
      );

      horasTrabajadas = horasADecimal(minutosSeleccionados);

      saldoACobrar = Math.min(resumen.saldo_adelantos_previos, horasTrabajadas);
    }

    let horasLiquidadas =
      horasTrabajadas - saldoACobrar - horasDescontadasNum + horasAdelantoFuturo;

    if (horasLiquidadas < 0) horasLiquidadas = 0;

    const liquidacion = await RRHHLiquidacionesModel.create({
      usuario_id,
      sede_id,
      fecha_desde,
      fecha_hasta,
      fecha_liquidacion,
      fecha_pago: fecha_pago || null,
      estado: "confirmada",

      horas_trabajadas_periodo: horasTrabajadas,
      saldo_adelantos_previos: saldoACobrar,
      horas_descontadas: horasDescontadasNum,
      horas_adelanto_futuro: horasAdelantoFuturo,
      horas_liquidadas: horasLiquidadas,

      tipo_liquidacion,
      subtipo_adelanto: subtipo_adelanto || null,
      observacion: observacion || null,
      cuenta_bancaria_id: cuenta_bancaria_id || null,
      liquidado_por: liquidado_por || null,
    }, { transaction: t });

    const detalles = [];

    if (saldoACobrar > 0) {
      detalles.push({
        liquidacion_id: liquidacion.id,
        fecha: fecha_liquidacion,
        tipo_detalle: "saldo_anterior",
        horas: -Math.abs(saldoACobrar),
        observacion: "Descuento por adelanto de horas de meses anteriores"
      });
    }

    if (esAdelantoFuturo) {
      detalles.push({
        liquidacion_id: liquidacion.id,
        fecha: fecha_liquidacion,
        tipo_detalle: "adelanto",
        horas: horasAdelantoFuturo,
        observacion: observacion || "Adelanto de horas futuras"
      });
    } else {
      for (const m of marcacionesSeleccionadas) {
        const hDetalle = horasADecimal(calcularMinutosLiquidadosMarcacion(m));

        detalles.push({
          liquidacion_id: liquidacion.id,
          fecha: m.fecha,
          tipo_detalle: "marcacion_aprobada",
          marcacion_id: m.id,
          horas: hDetalle,
          observacion: m.comentarios || null
        });
      }

      if (horasDescontadasNum > 0) {
        detalles.push({
          liquidacion_id: liquidacion.id,
          fecha: fecha_liquidacion,
          tipo_detalle: "ajuste_manual",
          horas: -Math.abs(horasDescontadasNum),
          observacion: observacion || "Descuento manual"
        });
      }
    }

    if (detalles.length > 0) {
      await RRHHLiquidacionDetalleModel.bulkCreate(detalles, { transaction: t });
    }

    if (marcacionesSeleccionadas.length > 0) {
      await RRHHMarcacionesModel.update(
        { liquidacion_id: liquidacion.id },
        {
          where: { id: marcacionesSeleccionadas.map((m) => m.id) },
          transaction: t
        }
      );
    }

    await t.commit();
    res.status(201).json(liquidacion);
  } catch (error) {
    await t.rollback();
    console.error("ERROR EN CR_EmitirLiquidacion_CTS:", error);
    res.status(500).json({ message: error.message });
  }
};

// ======================================================
// Anular liquidación
// ======================================================
export const UPD_AnularLiquidacion_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const { id } = req.params;

    const liquidacion = await RRHHLiquidacionesModel.findOne({
      where: { id, eliminado: 0 },
      transaction: t,
    });

    if (!liquidacion || liquidacion.estado === "anulada") {
      await t.rollback();
      return res.status(400).json({ message: "Liquidación no válida para anular" });
    }

    await RRHHMarcacionesModel.update(
      { liquidacion_id: null },
      { where: { liquidacion_id: liquidacion.id }, transaction: t },
    );

    await liquidacion.update({ estado: "anulada" }, { transaction: t });

    await t.commit();
    res.json({ message: "Liquidación anulada correctamente" });
  } catch (error) {
    await t.rollback();
    console.error("ERROR EN UPD_AnularLiquidacion_CTS:", error);
    res.status(500).json({ message: error.message });
  }
};