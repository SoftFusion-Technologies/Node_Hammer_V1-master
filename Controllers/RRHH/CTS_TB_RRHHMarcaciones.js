/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 24 / 02 / 2026
 * Versión: 1.2
 *
 * Descripción:
 * * Gestiona el flujo crítico de asistencia, geofencing y biometría.
 * * Incluye procesos en segundo plano (CRON) para el cierre automático de jornadas,
 * * cálculo de horas acumuladas y generación de faltas injustificadas.
 * Tema: Controladores - RRHH Marcaciones
 * * Capa: Backend 
 *
 * Nomenclatura: 
 * * OBRS_ obtenerRegistros (Agrupados por sede/empleado/día)
 * * OBRS_ HorasAcumuladasMesActual (Estadísticas mensuales)
 * * CR_ crearRegistro (Con validación GPS y lógica de horas extra)
 * * UR_ actualizarRegistro (Gestión de aprobación y ajustes manuales)
 * * UR_ registrarSalida (Cálculo automático de salida anticipada/extra)
 * * ER_ eliminarRegistro (Baja lógica)
 */
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import RRHHMarcacionesModel from "../../Models/RRHH/MD_TB_RRHHMarcaciones.js";
import UsersModel from "../../Models/MD_TB_Users.js";
import Sedes from "../../Models/MD_TB_sedes.js";
import cron from "node-cron";
import RRHHHorariosModel from "../../Models/RRHH/MD_TB_RRHHHorarios.js";
import { Op } from "sequelize";
import db from "../../DataBase/db.js";

const { SedeModel } = Sedes;

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = "America/Argentina/Buenos_Aires";

// ─── Constantes de validación ────────────────────────────────────────────────
const ESTADOS_VALIDOS = [
  "pendiente",
  "normal",
  "tarde",
  "extra",
  "ausente",
  "justificado",
];
const ESTADOS_APROBACION_VALIDOS = ["pendiente", "aprobada", "rechazada"];
const ORIGENES_VALIDOS = [
  "app",
  "web",
  "lector",
  "manual",
  "facial",
  "automatico",
];

const esFechaValida = (fecha = "") => /^\d{4}-\d{2}-\d{2}$/.test(fecha);

const esFechaHoraValida = (valor) => {
  if (!valor) return true; // opcional
  const d = new Date(valor);
  return !isNaN(d.getTime());
};

const esComentarioValido = (valor) => {
  if (valor === undefined || valor === null || valor === "") return true;
  return typeof valor === "string" && valor.length <= 255;
};

const calcularDistanciaMetros = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const formatearHorasHHMM = (horasDecimal) => {
  const horasNumero = Number(horasDecimal ?? 0);

  if (!Number.isFinite(horasNumero)) return "0:00";

  const signo = horasNumero < 0 ? "-" : "";
  const totalMinutos = Math.round(Math.abs(horasNumero) * 60);
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;

  return `${signo}${horas}:${String(minutos).padStart(2, "0")}`;
};

const parsearHoraSalidaProgramada = (horaSalidaProgramada, fechaBase) => {
  if (!horaSalidaProgramada) return null;

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(horaSalidaProgramada)) {
    const horaCompleta =
      horaSalidaProgramada.length === 5
        ? `${horaSalidaProgramada}:00`
        : horaSalidaProgramada;
    return dayjs.tz(`${fechaBase} ${horaCompleta}`, "YYYY-MM-DD HH:mm:ss", TZ);
  }

  return dayjs(horaSalidaProgramada);
};

// Valida el payload de creación/actualización. esActualizacion=true → campos opcionales.
const validarMarcacion = (body, esActualizacion = false) => {
  const errores = [];

  if (!esActualizacion || body.usuario_id !== undefined) {
    if (
      !Number.isInteger(Number(body.usuario_id)) ||
      Number(body.usuario_id) <= 0
    ) {
      errores.push("usuario_id es obligatorio y debe ser un entero positivo");
    }
  }

  if (!esActualizacion || body.sede_id !== undefined) {
    if (!Number.isInteger(Number(body.sede_id)) || Number(body.sede_id) <= 0) {
      errores.push("sede_id es obligatorio y debe ser un entero positivo");
    }
  }

  // fecha opcional: si viene, se valida; si no viene, el backend la genera
  if (body.fecha !== undefined && body.fecha !== null && body.fecha !== "") {
    if (!esFechaValida(body.fecha)) {
      errores.push("fecha debe tener formato YYYY-MM-DD");
    }
  }

  if (!esActualizacion || body.estado !== undefined) {
    if (!body.estado || !ESTADOS_VALIDOS.includes(body.estado)) {
      errores.push(
        `estado es obligatorio y debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}`,
      );
    }
  }

  if (!esActualizacion || body.origen !== undefined) {
    if (!body.origen || !ORIGENES_VALIDOS.includes(body.origen)) {
      errores.push(
        `origen es obligatorio y debe ser uno de: ${ORIGENES_VALIDOS.join(", ")}`,
      );
    }
  }

  if (body.estado_aprobacion !== undefined) {
    if (!ESTADOS_APROBACION_VALIDOS.includes(body.estado_aprobacion)) {
      errores.push(
        `estado_aprobacion debe ser uno de: ${ESTADOS_APROBACION_VALIDOS.join(", ")}`,
      );
    }
  }

  if (body.aprobado_por !== undefined && body.aprobado_por !== null) {
    if (
      !Number.isInteger(Number(body.aprobado_por)) ||
      Number(body.aprobado_por) <= 0
    ) {
      errores.push("aprobado_por debe ser un entero positivo o null");
    }
  }

  if (
    body.fecha_aprobacion !== undefined &&
    body.fecha_aprobacion !== null &&
    body.fecha_aprobacion !== "" &&
    !esFechaHoraValida(body.fecha_aprobacion)
  ) {
    errores.push("fecha_aprobacion debe ser una fecha/hora válida (ISO 8601)");
  }

  if (
    body.hora_entrada !== undefined &&
    body.hora_entrada !== null &&
    body.hora_entrada !== "" &&
    !esFechaHoraValida(body.hora_entrada)
  ) {
    errores.push("hora_entrada debe ser una fecha/hora válida (ISO 8601)");
  }

  if (
    body.hora_salida !== undefined &&
    body.hora_salida !== null &&
    body.hora_salida !== "" &&
    !esFechaHoraValida(body.hora_salida)
  ) {
    errores.push("hora_salida debe ser una fecha/hora válida (ISO 8601)");
  }

  if (body.hora_entrada && body.hora_salida) {
    if (new Date(body.hora_salida) <= new Date(body.hora_entrada)) {
      errores.push("hora_salida debe ser posterior a hora_entrada");
    }
  }

  if (body.comentarios !== undefined && !esComentarioValido(body.comentarios)) {
    errores.push("comentarios debe ser texto y no superar los 255 caracteres");
  }

  if (
    body.minutos_descuento !== undefined &&
    (!Number.isFinite(Number(body.minutos_descuento)) ||
      Number(body.minutos_descuento) < 0)
  ) {
    errores.push("minutos_descuento debe ser un número mayor o igual a 0");
  }

  return errores;
};

// Mostrar todos los registros de marcaciones
export const OBRS_RRHHMarcaciones_CTS = async (req, res) => {
  try {
    // Captura de parámetros opcionales para filtrar la búsqueda
    const { usuario_id, sede_id } = req.query;
    const filtros = {};

    // Filtro para traer solo registros no eliminados
    filtros.eliminado = 0;

    if (usuario_id) {
      filtros.usuario_id = usuario_id;
    }
    if (sede_id) {
      filtros.sede_id = sede_id;
    }

    // Consulta con inclusión de modelos relacionados y ordenamiento por fecha/hora
    const registros = await RRHHMarcacionesModel.findAll({
      where: filtros,
      include: [
        { model: UsersModel, as: "usuario" },
        { model: UsersModel, as: "aprobador", attributes: ["id", "name"] },
        { model: SedeModel, as: "sede" },
        { model: RRHHHorariosModel, as: "horario" },
      ],
      order: [
        ["fecha", "ASC"],
        ["hora_entrada", "ASC"],
      ],
    });

    // Lógica de transformación para agrupar por sede, empleado y fecha calculando horas totales
    const diccionarioAgrupado = {};

    registros.forEach((reg) => {
      // Clave para agrupar por sede y usuario
      const claveAgrupado = `${reg.sede_id}-${reg.usuario_id}`;

      if (!diccionarioAgrupado[claveAgrupado]) {
        diccionarioAgrupado[claveAgrupado] = {
          sede: reg.sede ? reg.sede.nombre_sede || reg.sede.nombre : "Sin Sede",
          id_empleado: reg.usuario_id,
          empleado: reg.usuario ? reg.usuario.name : "Sin Nombre",
          asistencias: [],
        };
      }

      // Verificación de si la fecha ya existe en las asistencias del empleado
      let asistenciaDelDia = diccionarioAgrupado[
        claveAgrupado
      ].asistencias.find((a) => a.fecha === reg.fecha);

      if (!asistenciaDelDia) {
        asistenciaDelDia = {
          fecha: reg.fecha,
          horasTotales: 0,
          turnos: [],
        };
        diccionarioAgrupado[claveAgrupado].asistencias.push(asistenciaDelDia);
      }

      // Función para formatear la hora a HH:mm
      const formatearHora = (fechaIso) => {
        if (!fechaIso) return null;
        const d = new Date(fechaIso);
        const horas = String(d.getHours()).padStart(2, "0");
        const minutos = String(d.getMinutes()).padStart(2, "0");
        return `${horas}:${minutos}`;
      };

      // Cálculo de la duración del turno en horas
      let calculoHoras = 0;
      if (reg.horario) {
        const partesEntrada = reg.horario.hora_entrada.split(":");
        const partesSalida = reg.horario.hora_salida.split(":");
        const minutosEntrada =
          parseInt(partesEntrada[0]) * 60 + parseInt(partesEntrada[1]);
        const minutosSalida =
          parseInt(partesSalida[0]) * 60 + parseInt(partesSalida[1]);
        calculoHoras = (minutosSalida - minutosEntrada) / 60;
      } else if (reg.hora_entrada && reg.hora_salida) {
        const ms = new Date(reg.hora_salida) - new Date(reg.hora_entrada);
        calculoHoras = ms / (1000 * 60 * 60);
      }

      // Inserción del turno con sus metadatos
      asistenciaDelDia.turnos.push({
        id: reg.id,
        entrada: formatearHora(reg.hora_entrada),
        salida: formatearHora(reg.hora_salida),
        horas_turno: formatearHorasHHMM(calculoHoras),
        horas_turno_decimal: Number(calculoHoras.toFixed(2)),
        usuario_id: reg.usuario_id,
        sede_id: reg.sede_id,
        horario_id: reg.horario_id,
        estado: reg.estado,
        estado_aprobacion: reg.estado_aprobacion,
        origen: reg.origen,
        minutos_tarde: reg.minutos_tarde,
        minutos_extra_pendientes: reg.minutos_extra_pendientes,
        minutos_extra_autorizados: reg.minutos_extra_autorizados,
        minutos_extra_no_autorizados: reg.minutos_extra_no_autorizados,
        minutos_descuento: reg.minutos_descuento,
        minutos_salida_anticipada: reg.minutos_salida_anticipada,
        latitud: reg.latitud,
        longitud: reg.longitud,
        reconocimiento_valido: reg.reconocimiento_valido,
        reemplaza_a: reg.reemplaza_a,
        comentarios: reg.comentarios,
        aprobado_por: reg.aprobado_por,
        aprobado_por_nombre: reg.aprobador?.name || null,
        fecha_aprobacion: reg.fecha_aprobacion,
        liquidacion_id: reg.liquidacion_id,
        created_at: reg.created_at,
        updated_at: reg.updated_at,
        eliminado: reg.eliminado,
      });

      // Lógica solicitada para el total diario:
      const horasExtrasAutorizadas =
        Number(reg.minutos_extra_autorizados || 0) / 60;
      const horasDescuento = Number(reg.minutos_descuento || 0) / 60;

      let sumarAlTotalDia = 0;

      if (reg.estado === "extra") {
        sumarAlTotalDia = horasExtrasAutorizadas - horasDescuento;
      } else {
        sumarAlTotalDia =
          calculoHoras + horasExtrasAutorizadas - horasDescuento;
      }

      sumarAlTotalDia = Math.max(0, sumarAlTotalDia);

      // Acumulación de horas totales del día
      asistenciaDelDia.horasTotales = Number(
        (asistenciaDelDia.horasTotales + sumarAlTotalDia).toFixed(2),
      );
    });

    const resultado = Object.values(diccionarioAgrupado).map((grupo) => ({
      ...grupo,
      asistencias: grupo.asistencias.map((asistencia) => ({
        ...asistencia,
        horasTotales_decimal: Number(asistencia.horasTotales.toFixed(2)),
        horasTotales: formatearHorasHHMM(asistencia.horasTotales),
      })),
    }));

    // Envío de la respuesta con los datos agrupados
    res.json(resultado);
  } catch (error) {
    console.error("Error al obtener marcaciones:", error);
    res.status(500).json({ mensajeError: "Error al obtener marcaciones" });
  }
};

// Devuelve el total de horas acumuladas por usuario en el mes solicitado (o corriente).
// Si se envía usuario_id devuelve solo ese usuario; si no, devuelve todos.
export const OBRS_HorasAcumuladasMesActual_CTS = async (req, res) => {
  try {
    // 1. Parámetros opcionales
    const usuario_id = req.query.usuario_id || req.params.usuario_id || null;

    // 2. Determinamos el primer y último día del mes solicitado (o el corriente si no se indica)
    const ahora = new Date();
    const anio = req.query.anio
      ? parseInt(req.query.anio)
      : ahora.getFullYear();
    const mes = req.query.mes ? parseInt(req.query.mes) - 1 : ahora.getMonth(); // 0-indexed

    const primerDiaDelMes = new Date(anio, mes, 1);
    const primerDiaDelMesSiguiente = new Date(anio, mes + 1, 1);

    // Convertimos a formato YYYY-MM-DD para filtrar por el campo `fecha` (DATEONLY)
    const formatFecha = (d) => d.toISOString().split("T")[0];

    // 3. Armamos el filtro: si hay usuario_id lo usamos, si no traemos todos
    const { Op } = await import("sequelize");

    const filtroDonde = {
      fecha: {
        [Op.gte]: formatFecha(primerDiaDelMes),
        [Op.lt]: formatFecha(primerDiaDelMesSiguiente),
      },
      hora_entrada: { [Op.ne]: null },
      hora_salida: { [Op.ne]: null },
    };

    if (usuario_id) {
      filtroDonde.usuario_id = usuario_id;
    }

    // 4. Consultamos los registros incluyendo datos del usuario
    const registros = await RRHHMarcacionesModel.findAll({
      where: filtroDonde,
      include: [
        { model: UsersModel, as: "usuario", attributes: ["id", "name"] },
      ],
      order: [
        ["usuario_id", "ASC"],
        ["fecha", "ASC"],
        ["hora_entrada", "ASC"],
      ],
    });

    // 5. Función auxiliar para calcular y formatear horas de un array de registros
    const calcularHoras = (regs) => {
      let totalMinutos = 0;
      regs.forEach((reg) => {
        const ms = new Date(reg.hora_salida) - new Date(reg.hora_entrada);
        if (ms > 0) totalMinutos += ms / (1000 * 60);
      });
      const totalHoras = Number((totalMinutos / 60).toFixed(2));
      const horasEnteras = Math.floor(totalHoras);
      const minutosRestantes = Math.round((totalHoras - horasEnteras) * 60);
      return { totalHoras, resumen: `${horasEnteras}h ${minutosRestantes}m` };
    };

    // 6. Nombre del mes para la respuesta
    const fechaConsultada = new Date(anio, mes, 1);
    const nombreMes = fechaConsultada.toLocaleString("es-AR", {
      month: "long",
      year: "numeric",
    });

    // 7. Si se pidió un usuario específico → respuesta simple (igual que antes)
    if (usuario_id) {
      const { totalHoras, resumen } = calcularHoras(registros);
      const nombreUsuario = registros[0]?.usuario?.name || null;
      return res.json({
        usuario_id: Number(usuario_id),
        nombre: nombreUsuario,
        mes: nombreMes,
        anio,
        numero_mes: mes + 1,
        cantidad_turnos: registros.length,
        total_horas: totalHoras,
        resumen,
      });
    }

    // 8. Sin usuario_id → agrupar por usuario y devolver listado
    const porUsuario = {};

    registros.forEach((reg) => {
      const uid = reg.usuario_id;
      if (!porUsuario[uid]) {
        porUsuario[uid] = {
          usuario_id: uid,
          nombre: reg.usuario?.name || null,
          registros: [],
        };
      }
      porUsuario[uid].registros.push(reg);
    });

    const resultado = Object.values(porUsuario).map(
      ({ usuario_id, nombre, registros: regs }) => {
        const { totalHoras, resumen } = calcularHoras(regs);
        return {
          usuario_id,
          nombre,
          mes: nombreMes,
          anio,
          numero_mes: mes + 1,
          cantidad_turnos: regs.length,
          total_horas: totalHoras,
          resumen,
        };
      },
    );

    res.json(resultado);
  } catch (error) {
    console.error("Error al calcular horas acumuladas:", error);
    res
      .status(500)
      .json({ mensajeError: "Error al calcular horas acumuladas del mes." });
  }
};

// ─── Crear marcación ──────
export const CR_RRHHMarcacion_CTS = async (req, res) => {
  try {
    const body = req.body;

    const errores = validarMarcacion(body, false);
    if (errores.length > 0) {
      return res
        .status(400)
        .json({ mensajeError: "Errores de validación", errores });
    }

    // Validación de GPS para registros directos (app/facial)
    if (
      (body.origen === "facial") &&
      body.latitud &&
      body.longitud &&
      !body.hora_salida
    ) {
      const sede = await SedeModel.findByPk(body.sede_id);
      if (!sede || !sede.latitud || !sede.longitud) {
        return res
          .status(400)
          .json({ mensajeError: "Sede sin GPS configurado." });
      }

      const distanciaMetros = calcularDistanciaMetros(
        Number(body.latitud),
        Number(body.longitud),
        Number(sede.latitud),
        Number(sede.longitud),
      );

      const radioPermitido = sede.radio_permitido_metros || 120;

      if (distanciaMetros > radioPermitido) {
        return res
          .status(400)
          .json({ 
            mensajeError: `Fuera de rango permitido. Te encuentras a ${Math.round(distanciaMetros)} metros de la sede (Máximo permitido: ${radioPermitido}m).` 
          });
      }
    }

    const ahoraArg = dayjs().tz(TZ);
    const fechaActual = ahoraArg.format("YYYY-MM-DD");
    const fechaHoraActual = ahoraArg.format("YYYY-MM-DD HH:mm:ss");

    // --- LÓGICA DE NEGOCIO PARA EXTRAS MANUALES ---
    let minutosExtraPendientes = Number(body.minutos_extra_pendientes || 0);
    let minutosExtraAutorizados = Number(body.minutos_extra_autorizados || 0);
    let estadoFinal = body.estado;

    // Si es una carga manual (vía web/admin) y no se vinculó un horario:
    if (body.origen === "manual" && !body.horario_id) {
      estadoFinal = "extra"; // Forzamos estado extra

      if (body.hora_entrada && body.hora_salida) {
        const diffMinutos = dayjs(body.hora_salida).diff(
          dayjs(body.hora_entrada),
          "minute",
        );

        if (diffMinutos > 0) {
          minutosExtraPendientes = diffMinutos;
          // Si el admin lo marca como aprobada desde el inicio:
          if (body.estado_aprobacion === "aprobada") {
            minutosExtraAutorizados = diffMinutos;
          }
        }
      }
    }

    const nuevaMarcacion = await RRHHMarcacionesModel.create({
      usuario_id: Number(body.usuario_id),
      sede_id: Number(body.sede_id),
      horario_id: body.horario_id ? Number(body.horario_id) : null,
      fecha: body.fecha || fechaActual,
      hora_entrada: body.hora_entrada || fechaHoraActual,
      hora_salida: body.hora_salida || null,
      estado: estadoFinal,
      estado_aprobacion: body.estado_aprobacion || "pendiente",
      origen: body.origen,
      minutos_tarde: Number(body.minutos_tarde || 0),
      minutos_extra_pendientes: minutosExtraPendientes,
      minutos_extra_autorizados: minutosExtraAutorizados,
      minutos_extra_no_autorizados: Number(
        body.minutos_extra_no_autorizados || 0,
      ),
      minutos_descuento: Number(body.minutos_descuento || 0),
      minutos_salida_anticipada: Number(body.minutos_salida_anticipada || 0),
      latitud: body.latitud || null,
      longitud: body.longitud || null,
      reconocimiento_valido: Number(body.reconocimiento_valido || 0),
      reemplaza_a: body.reemplaza_a || null,
      comentarios: body.comentarios || null,
      aprobado_por: body.aprobado_por || null,
      fecha_aprobacion: body.fecha_aprobacion || null,
      created_at: fechaHoraActual,
      updated_at: fechaHoraActual,
      eliminado: 0,
    });

    return res.status(201).json(nuevaMarcacion);
  } catch (error) {
    console.error("Error al crear marcación:", error);
    return res
      .status(500)
      .json({ mensajeError: "Error al crear marcación", error: error.message });
  }
};

// ─── Actualizar marcación ─────────────────────────────────────────────────────
export const UR_RRHHMarcacion_CTS = async (req, res) => {
  try {
    const marcacion = await RRHHMarcacionesModel.findOne({
      where: { id: req.params.id, eliminado: 0 },
    });

    if (!marcacion) {
      return res.status(404).json({ mensajeError: "Marcación no encontrada" });
    }

    const body = req.body;

    const errores = validarMarcacion(body, true);
    if (errores.length > 0) {
      return res
        .status(400)
        .json({ mensajeError: "Errores de validación", errores });
    }

    // Construimos el objeto con los valores fusionados (body ?? valor actual)
    const horaEntradaNueva =
      body.hora_entrada !== undefined
        ? body.hora_entrada
        : marcacion.hora_entrada;
    const horaSalidaNueva =
      body.hora_salida !== undefined ? body.hora_salida : marcacion.hora_salida;

    // Validación cruzada con valores fusionados
    if (horaEntradaNueva && horaSalidaNueva) {
      if (new Date(horaSalidaNueva) <= new Date(horaEntradaNueva)) {
        return res.status(400).json({
          mensajeError: "hora_salida debe ser posterior a hora_entrada",
        });
      }
    }

    // --- LÓGICA DE RECALCULO AUTOMÁTICO (Caso sin horario vinculado) ---
    let minutosExtraPendientes =
      body.minutos_extra_pendientes !== undefined
        ? Number(body.minutos_extra_pendientes)
        : marcacion.minutos_extra_pendientes;

    let minutosExtraAutorizados =
      body.minutos_extra_autorizados !== undefined
        ? Number(body.minutos_extra_autorizados)
        : marcacion.minutos_extra_autorizados;

    // Si la marcación NO tiene horario_id, recalculamos solo el total pendiente real,
    // pero respetando lo que venga explícitamente desde el front.
    if (!marcacion.horario_id) {
      if (horaEntradaNueva && horaSalidaNueva) {
        const diffMinutos = dayjs(horaSalidaNueva).diff(
          dayjs(horaEntradaNueva),
          "minute",
        );
        const diffFinal = diffMinutos > 0 ? diffMinutos : 0;

        minutosExtraPendientes = diffFinal;

        const estadoAprobacionActual =
          body.estado_aprobacion !== undefined
            ? body.estado_aprobacion
            : marcacion.estado_aprobacion;

        if (estadoAprobacionActual === "aprobada") {
          minutosExtraAutorizados =
            body.minutos_extra_autorizados !== undefined
              ? Number(body.minutos_extra_autorizados)
              : marcacion.minutos_extra_autorizados;
        } else {
          minutosExtraAutorizados = 0;
        }
      }
    }

        await marcacion.update({
      usuario_id:
        body.usuario_id !== undefined
          ? Number(body.usuario_id)
          : marcacion.usuario_id,
      sede_id:
        body.sede_id !== undefined ? Number(body.sede_id) : marcacion.sede_id,
      fecha: body.fecha !== undefined ? body.fecha : marcacion.fecha,
      hora_entrada: horaEntradaNueva,
      hora_salida: horaSalidaNueva,
      estado: body.estado !== undefined ? body.estado : marcacion.estado,
      estado_aprobacion:
        body.estado_aprobacion !== undefined
          ? body.estado_aprobacion
          : marcacion.estado_aprobacion,
      origen: body.origen !== undefined ? body.origen : marcacion.origen,
      minutos_tarde:
        body.minutos_tarde !== undefined
          ? Number(body.minutos_tarde)
          : marcacion.minutos_tarde,
      minutos_extra_autorizados: minutosExtraAutorizados,
      minutos_extra_pendientes: minutosExtraPendientes,
      minutos_extra_no_autorizados:
        body.minutos_extra_no_autorizados !== undefined
          ? Number(body.minutos_extra_no_autorizados)
          : Math.max(
              0,
              Number(minutosExtraPendientes || 0) -
                Number(minutosExtraAutorizados || 0)
            ),
      minutos_descuento:
        body.minutos_descuento !== undefined
          ? Number(body.minutos_descuento)
          : marcacion.minutos_descuento,
      minutos_salida_anticipada:
        body.minutos_salida_anticipada !== undefined
          ? Number(body.minutos_salida_anticipada)
          : marcacion.minutos_salida_anticipada,
      latitud: body.latitud !== undefined ? body.latitud : marcacion.latitud,
      longitud:
        body.longitud !== undefined ? body.longitud : marcacion.longitud,
      reconocimiento_valido:
        body.reconocimiento_valido !== undefined
          ? Number(body.reconocimiento_valido)
          : marcacion.reconocimiento_valido,
      reemplaza_a:
        body.reemplaza_a !== undefined
          ? body.reemplaza_a
          : marcacion.reemplaza_a,
      comentarios:
        body.comentarios !== undefined
          ? body.comentarios
          : marcacion.comentarios,
      aprobado_por:
        body.aprobado_por !== undefined
          ? body.aprobado_por === null
            ? null
            : Number(body.aprobado_por)
          : marcacion.aprobado_por,
      fecha_aprobacion:
        body.fecha_aprobacion !== undefined
          ? body.fecha_aprobacion
          : marcacion.fecha_aprobacion,
      updated_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    });;

    return res.json({
      message: "Marcación actualizada correctamente",
      marcacion,
    });
  } catch (error) {
    console.error("Error al actualizar marcación:", error);
    return res.status(500).json({
      mensajeError: "Error al actualizar marcación",
      error: error.message,
    });
  }
};

// ─── Registrar salida (controlador específico para marcar la salida) ─────────
export const UR_RRHHMarcacionSalida_CTS = async (req, res) => {
  try {
    const marcacion = await RRHHMarcacionesModel.findOne({
      where: { id: req.params.id, eliminado: 0 },
      include: [{ model: RRHHHorariosModel, as: "horario" }],
    });

    if (!marcacion) {
      return res.status(404).json({ mensajeError: "Marcación no encontrada" });
    }

    if (marcacion.hora_salida) {
      return res.status(400).json({
        mensajeError: "La salida ya fue registrada.",
      });
    }

    const ahoraArg = dayjs().tz(TZ);

    // NO TOCO TU LÓGICA DE HORA MANUAL DEL FRONT.
    // Acá respetamos si viene hora_salida desde el body.
    let horaSalidaFinal;

    if (req.body.hora_salida) {
      const horaLimpia =
        req.body.hora_salida.length === 5
          ? `${req.body.hora_salida}:00`
          : req.body.hora_salida;

      horaSalidaFinal = dayjs.tz(
        `${marcacion.fecha} ${horaLimpia}`,
        "YYYY-MM-DD HH:mm:ss",
        TZ,
      );
    } else {
      horaSalidaFinal = ahoraArg;
    }

    const hizoHorasExtra = req.body.hizo_horas_extra === true;

    let minutosSalidaAnticipada = 0;
    let minutosExtraPendientes = 0;
    let estadoAprobacionFinal = marcacion.estado_aprobacion;
    let comentariosFinal = req.body.comentarios || marcacion.comentarios;

    // -------------------------------------------------------------------------
    // CASO 1: MARCACIÓN CON HORARIO ASOCIADO
    // -------------------------------------------------------------------------
    if (marcacion.horario && marcacion.horario.hora_salida) {
      const salidaProgramada = dayjs.tz(
        `${marcacion.fecha} ${marcacion.horario.hora_salida}`,
        "YYYY-MM-DD HH:mm:ss",
        TZ,
      );

      const limiteTolerancia = salidaProgramada.add(30, "minute");

      // Salida anticipada
      if (horaSalidaFinal.isBefore(salidaProgramada)) {
        minutosSalidaAnticipada = salidaProgramada.diff(
          horaSalidaFinal,
          "minute",
        );
        estadoAprobacionFinal = "pendiente";
      }

      // Se pasó más de 30 min del horario de salida
      if (horaSalidaFinal.isAfter(limiteTolerancia)) {
        if (hizoHorasExtra) {
          minutosExtraPendientes = horaSalidaFinal.diff(
            salidaProgramada,
            "minute",
          );
          estadoAprobacionFinal = "pendiente";
        }
        // Si NO hizo horas extra, se guarda la hora real y no se modifica nada más
      }
    }

    // -------------------------------------------------------------------------
    // CASO 2: MARCACIÓN SIN HORARIO ASOCIADO
    // -------------------------------------------------------------------------
    else {
      if (marcacion.hora_entrada) {
        const horaEntrada = dayjs(marcacion.hora_entrada);

        if (horaSalidaFinal.isAfter(horaEntrada)) {
          minutosExtraPendientes = horaSalidaFinal.diff(horaEntrada, "minute");
          estadoAprobacionFinal = "pendiente";

          if (!comentariosFinal) {
            comentariosFinal =
              "Marcación sin horario asociado enviada para revisión";
          }
        }
      }
    }

    await marcacion.update({
      hora_salida: horaSalidaFinal.format("YYYY-MM-DD HH:mm:ss"),
      minutos_salida_anticipada: minutosSalidaAnticipada,
      minutos_extra_pendientes: minutosExtraPendientes,
      estado_aprobacion: estadoAprobacionFinal,
      comentarios: comentariosFinal,
      updated_at: ahoraArg.format("YYYY-MM-DD HH:mm:ss"),
    });

    return res.json({
      message: "Salida registrada correctamente",
      marcacion,
      resumen: {
        minutos_salida_anticipada: minutosSalidaAnticipada,
        minutos_extra_pendientes: minutosExtraPendientes,
        estado_aprobacion: estadoAprobacionFinal,
      },
    });
  } catch (error) {
    console.error("Error en UR_RRHHMarcacionSalida_CTS:", error);
    return res.status(500).json({
      mensajeError: "Error al registrar salida",
      error: error.message,
    });
  }
};

// ─── Eliminar marcación (soft delete) ────────────────────────────────────────
export const ER_RRHHMarcacion_CTS = async (req, res) => {
  try {
    const marcacion = await RRHHMarcacionesModel.findOne({
      where: { id: req.params.id, eliminado: 0 },
    });

    if (!marcacion) {
      return res.status(404).json({ mensajeError: "Marcación no encontrada" });
    }

    await marcacion.update({
      eliminado: 1,
      updated_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    });

    return res.json({ message: "Marcación eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar marcación:", error);
    return res.status(500).json({
      mensajeError: "Error al eliminar marcación",
      error: error.message,
    });
  }
};

export const OBRS_PendientesPorAlumnoYSede_CTS = async (req, res) => {
  try {
    // Traer todas las marcaciones pendientes
    const pendientes = await RRHHMarcacionesModel.findAll({
      where: { estado_aprobacion: "pendiente" },
      attributes: ["usuario_id", "sede_id"],
    });

    // Contar pendientes por usuario y sede
    const contador = {};
    pendientes.forEach((p) => {
      const key = `${p.usuario_id}-${p.sede_id}`;
      contador[key] = (contador[key] || 0) + 1;
    });

    // Traer solo los usuarios y sedes que tienen pendientes
    const usuarioIds = [...new Set(pendientes.map((p) => p.usuario_id))];
    const sedeIds = [...new Set(pendientes.map((p) => p.sede_id))];

    const alumnos = await UsersModel.findAll({
      where: { id: usuarioIds },
      attributes: ["id", "name"],
    });
    const sedes = await SedeModel.findAll({
      where: { id: sedeIds },
      attributes: ["id", "nombre"],
    });

    // Mapear para acceso rápido
    const alumnosMap = Object.fromEntries(alumnos.map((a) => [a.id, a.name]));
    const sedesMap = Object.fromEntries(sedes.map((s) => [s.id, s.nombre]));

    // Solo devolver los que tienen cantidad_pendientes > 0
    const resultado = Object.entries(contador)
      .filter(([_, cantidad]) => cantidad > 0)
      .map(([key, cantidad]) => {
        const [usuario_id, sede_id] = key.split("-");
        return {
          usuario_id: Number(usuario_id),
          usuario_nombre: alumnosMap[usuario_id] || null,
          sede_id: Number(sede_id),
          sede_nombre: sedesMap[sede_id] || null,
          cantidad_pendientes: cantidad,
        };
      });

    res.json(resultado);
  } catch (error) {
    console.error("Error al obtener pendientes por alumno y sede:", error);
    res
      .status(500)
      .json({ mensajeError: "Error al obtener pendientes por alumno y sede" });
  }
};

export const OBRS_CantidadPendientes_CTS = async (req, res) => {
  try {
    // Traer todas las marcaciones pendientes
    const totalPendientes = await RRHHMarcacionesModel.count({
      where: { estado_aprobacion: "pendiente", eliminado: 0 },
    });
    res.json({ total_pendientes: totalPendientes });
  } catch (error) {
    console.error("Error al obtener el contador de pendientes:", error);
    res
      .status(500)
      .json({ mensajeError: "Error al obtener el contador de pendientes" });
  }
};

export const OBRS_UsuariosConMarcacionFacialSinSalida_CTS = async (
  req,
  res,
) => {
  try {
    const marcaciones = await RRHHMarcacionesModel.findAll({
      where: {
        origen: "facial",
        hora_salida: null,
        eliminado: 0,
      },
      include: [
        { model: UsersModel, as: "usuario", attributes: ["id", "name"] },
        { model: SedeModel, as: "sede", attributes: ["id", "nombre"] },
      ],
    });

    // Agrupar por usuario y devolver solo los que tienen al menos una marcación sin salida
    const resultado = marcaciones.map((m) => ({
      id: m.id,
      usuario_id: m.usuario_id,
      usuario_nombre: m.usuario?.name || null,
      sede_id: m.sede_id,
      sede_nombre: m.sede?.nombre || null,
      fecha: m.fecha,
      hora_entrada: m.hora_entrada,
      horario_id: m.horario_id || null,
    }));

    res.json(resultado);
  } catch (error) {
    console.error(
      "Error al obtener usuarios con marcación facial sin salida:",
      error,
    );
    res.status(500).json({
      mensajeError: "Error al obtener usuarios con marcación facial sin salida",
    });
  }
};

export const procesarMarcacionesAutomaticas_CTS = async () => {
  try {
    const ayer = dayjs().tz(TZ).subtract(1, "day");
    const fechaAyerStr = ayer.format("YYYY-MM-DD");
    const diaSemanaAyer = ayer.day();

    if (diaSemanaAyer === 0) return;

    const horariosPlanificados = await RRHHHorariosModel.findAll({
      where: {
        dia_semana: diaSemanaAyer,
        eliminado: 0,
        fecha_vigencia_desde: { [Op.lte]: fechaAyerStr },
        [Op.or]: [
          { fecha_vigencia_hasta: null },
          { fecha_vigencia_hasta: { [Op.gte]: fechaAyerStr } },
        ],
      },
      include: [{
        model: UsersModel,
        as: 'usuario', 
        attributes: ['id', 'level_admin'], // Solo traemos lo necesario
        where: {
          level_admin: { [Op.ne]: 1 } // Trae todos los que NO sean 1 (!= 1)
        }
      }]
    });

    console.log(
      `[CRON] Procesando fecha: ${fechaAyerStr}. Turnos: ${horariosPlanificados.length}`,
    );

    for (const horario of horariosPlanificados) {
      const inicioTurno = dayjs(
        `${fechaAyerStr} ${horario.hora_entrada}`,
      ).toDate();
      const finTurno = dayjs(`${fechaAyerStr} ${horario.hora_salida}`).toDate();

      // 2. Verificamos si ya existe marcación incluyendo el horario_id para ser más precisos
      const marcacionExistente = await RRHHMarcacionesModel.findOne({
        where: {
          usuario_id: horario.usuario_id,
          horario_id: horario.id, // <-- AGREGADO: Buscamos por el ID del horario
          fecha: fechaAyerStr,
          eliminado: 0,
        },
      });

      if (!marcacionExistente) {
        console.log(
          `[CRON] Generando falta automática - Usuario: ${horario.usuario_id} | Horario ID: ${horario.id}`,
        );

        await RRHHMarcacionesModel.create({
          usuario_id: horario.usuario_id,
          horario_id: horario.id, // <-- AGREGADO: Guardamos la relación
          sede_id: horario.sede_id,
          fecha: fechaAyerStr,
          hora_entrada: inicioTurno,
          hora_salida: finTurno,
          estado: "normal",
          estado_aprobacion: "pendiente",
          origen: "automatico",
          comentarios: "Asiento automático por falta de marcación",
          created_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          updated_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
          eliminado: 0,
        });
      }
    }
  } catch (error) {
    console.error("[CRON ERROR]:", error);
  }
};

export const anularMarcacionesFacialesAbiertas_CTS = async () => {
  try {
    const ahoraArgentina = dayjs().tz(TZ);
    const fechaHoy = ahoraArgentina.format("YYYY-MM-DD");
    const fechaHoraActual = ahoraArgentina.format("YYYY-MM-DD HH:mm:ss");

    const marcacionesAbiertas = await RRHHMarcacionesModel.findAll({
      where: {
        fecha: fechaHoy,
        origen: "facial",
        hora_entrada: { [Op.ne]: null },
        hora_salida: null,
        eliminado: 0,
      },
    });

    if (!marcacionesAbiertas.length) {
      console.log(
        `[CRON] ${fechaHoraActual} - No se encontraron marcaciones faciales abiertas para anular.`,
      );
      return;
    }

    const idsMarcaciones = marcacionesAbiertas.map((m) => m.id);

    const cantidadActualizada = await RRHHMarcacionesModel.update(
      {
        eliminado: 1,
        comentarios:
          "Marcación anulada automáticamente por quedar abierta sin hora de salida al cierre del día",
        updated_at: fechaHoraActual,
      },
      {
        where: {
          id: { [Op.in]: idsMarcaciones },
        },
      },
    );

    console.log(
      `[CRON] ${fechaHoraActual} - Marcaciones faciales abiertas anuladas: ${idsMarcaciones.length}`,
    );
  } catch (error) {
    console.error(
      "[CRON ERROR] Error al anular marcaciones faciales abiertas:",
      error,
    );
  }
};

cron.schedule(
  "59 23 * * *",
  async () => {
    try {
      console.log("[CRON] Inicio cierre diario de marcaciones");

      // 1) Primero anula las faciales abiertas/incompletas
      await anularMarcacionesFacialesAbiertas_CTS();

      // 2) Luego genera/procesa las automáticas según horario
      await procesarMarcacionesAutomaticas_CTS();

      console.log("[CRON] Fin cierre diario de marcaciones");
    } catch (error) {
      console.error("[CRON ERROR] Falló el cierre diario:", error);
    }
  },
  {
    timezone: TZ,
  },
);
