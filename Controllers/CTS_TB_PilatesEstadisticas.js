/*
 * Programador: Sergio Manrique
 * Fecha Creación: 30/01/2026
 * Versión: 1.0
 *
 * Descripción:
 * Controlador de estadísticas de Pilates: sincronización mensual/diaria,
 * reportes completos para frontend y evolución mes a mes.
 *
 * Tema: Controladores - Estadísticas Pilates
 *
 */

import cron from "node-cron";
import PilatesEstadisticasMensuales from "../Models/MD_TB_PilatesEstadisticasMensuales.js";
import PilatesEstadisticasInstructores from "../Models/MD_TB_PilatesEstadisticasInstructores.js";
import PilatesEstadisticasPlanes from "../Models/MD_TB_PilatesEstadisticasPlanes.js";
import PilatesBajasHistorial from "../Models/MD_TB_PilatesBajasHistorial.js";
import UsuariosPilates from "../Models/MD_TB_UsuariosPilates.js";
import Sedes from "../Models/MD_TB_sedes.js";
const { SedeModel } = Sedes;

import ClientesPilates from "../Models/MD_TB_ClientesPilates.js";
import InscripcionesPilatesModel from "../Models/MD_TB_InscripcionesPilates.js";
import AsistenciasPilates from "../Models/MD_TB_AsistenciasPilates.js";
import ListaEsperaPilates from "../Models/MD_TB_ListaEsperaPilates.js";
import Horarios from "../Models/MD_TB_HorariosPilates.js";
import HorariosDeshabilitadosPilatesModel from "../Models/MD_TB_Horarios_deshabilitados_pilates.js";
const { HorariosPilatesModel } = Horarios;

import db from "../DataBase/db.js";
import { Op, fn, col, literal, QueryTypes } from "sequelize";
import moment from "moment";

// Cliente "activo" para conteos de alumnos:
// - estado = Plan
// - estado = Renovacion programada SOLO si fecha_prometido_pago NO es null
const whereClienteActivoParaConteos = {
  [Op.or]: [
    { estado: "Plan" },
    {
      estado: "Renovacion programada",
      fecha_prometido_pago: { [Op.ne]: null },
    },
  ],
};

const normalizarNombre = (valor) =>
  (valor || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

// Helper para determinar nombre de plan
const obtenerNombrePlan = (inicio, fin) => {
  if (!inicio || !fin) return "Sin Plan";
  const dias = moment(fin).diff(moment(inicio), "days");
  if (dias === 29) return "Mensual";
  if (dias === 89) return "Trimestral";
  if (dias === 179) return "Semestral";
  if (dias === 359) return "Anual";
  return "Personalizado";
};

// ============================================================================
// 1. SINCRONIZAR (Cálculos Pesados y Guardado en BD)
// ============================================================================
export const CR_sincronizarEstadisticas = async (req, res) => {
  try {
    const { id_sede, anio, mes } = req.body;

    const sedeInfo = await SedeModel.findOne({
      where: { id: id_sede, es_ciudad: 1 },
    });
    if (!sedeInfo)
      return res
        .status(403)
        .json({ message: "Sede no válida para estadísticas." });

    const fechaInicio = moment(`${anio}-${mes}-01`).startOf("month").toDate();
    const fechaFin = moment(fechaInicio).endOf("month").toDate();

    // --- A. RETENCIÓN GLOBAL & ALTAS/BAJAS ---
    // 1. Clientes Iniciales: Ahora incluimos el modelo Clientes para tener el nombre
    const clientesInicioRaw = await InscripcionesPilatesModel.findAll({
      where: { fecha_inscripcion: { [Op.lt]: fechaInicio } },
      include: [
        {
          model: HorariosPilatesModel,
          as: "horario",
          where: { id_sede },
          attributes: [],
        },
        { model: ClientesPilates, as: "cliente", attributes: ["nombre"] }, // Necesario para comparar con bajas
      ],
      attributes: ["id_cliente"],
      group: ["id_cliente", "cliente.id"],
      raw: true,
      nest: true,
    });
    const cantidad_inicio = clientesInicioRaw.length;

    // 2. Bajas del Mes: Obtenemos los nombres registrados en el historial
    const bajasDelMes = await PilatesBajasHistorial.findAll({
      where: {
        id_sede,
        fecha_baja: { [Op.between]: [fechaInicio, fechaFin] },
      },
      attributes: ["nombre_cliente"],
      raw: true,
    });

    const nombresBajas = new Set(
      bajasDelMes.map((b) => normalizarNombre(b.nombre_cliente)),
    );

    // Calculamos cuántos siguen comparando nombres (ya no IDs)
    const siguen = clientesInicioRaw.filter(
      (c) => !nombresBajas.has(normalizarNombre(c.cliente?.nombre)),
    ).length;

    // 3. Altas del Mes
    const altas = await InscripcionesPilatesModel.count({
      where: { fecha_inscripcion: { [Op.between]: [fechaInicio, fechaFin] } },
      include: [
        {
          model: HorariosPilatesModel,
          as: "horario",
          where: { id_sede },
          attributes: [],
        },
      ],
    });

    // Cálculo de retención: (cantidad_fin / cantidad_inicio) * 100
    const cantidad_fin = siguen + altas;
    const porcentaje_retencion =
      cantidad_inicio > 0 ? (cantidad_fin * 100) / cantidad_inicio : 0;

    // --- B. OCUPACIÓN & ASISTENCIA ---
    const totalCuposSede =
      (await HorariosPilatesModel.count({ where: { id_sede } })) * 4;
    const alumnosActivos = await InscripcionesPilatesModel.count({
      include: [
        {
          model: HorariosPilatesModel,
          as: "horario",
          where: { id_sede },
          attributes: [],
        },
        {
          model: ClientesPilates,
          as: "cliente",
          where: whereClienteActivoParaConteos,
          attributes: [],
        },
      ],
      distinct: true,
      col: "id_cliente",
    });
    const porcentaje_ocupacion =
      totalCuposSede > 0 ? (alumnosActivos * 100) / totalCuposSede : 0;

    const asistenciasTotales = await AsistenciasPilates.count({
      where: { fecha: { [Op.between]: [fechaInicio, fechaFin] } },
      include: [
        {
          model: InscripcionesPilatesModel,
          as: "inscripcion",
          include: [
            {
              model: HorariosPilatesModel,
              as: "horario",
              where: { id_sede },
              attributes: [],
            },
          ],
        },
      ],
    });
    const presentes = await AsistenciasPilates.count({
      where: { fecha: { [Op.between]: [fechaInicio, fechaFin] }, presente: 1 },
      include: [
        {
          model: InscripcionesPilatesModel,
          as: "inscripcion",
          include: [
            {
              model: HorariosPilatesModel,
              as: "horario",
              where: { id_sede },
              attributes: [],
            },
          ],
        },
      ],
    });
    const ausentes = asistenciasTotales - presentes;
    const porcentaje_asistencia =
      asistenciasTotales > 0 ? (presentes * 100) / asistenciasTotales : 0;
    const porcentaje_ausentismo =
      asistenciasTotales > 0 ? (ausentes * 100) / asistenciasTotales : 0;

    // --- B2. LTV del mes (promedio meses entrenados y total de bajas)
    const ltvMes = await PilatesBajasHistorial.findOne({
      where: {
        id_sede,
        fecha_baja: { [Op.between]: [fechaInicio, fechaFin] },
      },
      attributes: [
        [fn("AVG", col("meses_entrenados")), "promedioMeses"],
        [fn("COUNT", col("id")), "totalBajas"],
      ],
      raw: true,
    });
    const ltv_promedio_meses = parseFloat(ltvMes?.promedioMeses || 0);
    const ltv_total_bajas = parseInt(ltvMes?.totalBajas || 0, 10);

    // Calcular variación porcentual respecto al mes anterior
    const fechaMesAnterior = moment(fechaInicio).subtract(1, "month");
    const mesAnteriorStats = await PilatesEstadisticasMensuales.findOne({
      where: {
        id_sede,
        anio: fechaMesAnterior.year(),
        mes: fechaMesAnterior.month() + 1,
      },
    });

    let variacion_porcentual = 0;
    if (mesAnteriorStats && mesAnteriorStats.cantidad_inicio_mes > 0) {
      variacion_porcentual =
        ((cantidad_inicio - mesAnteriorStats.cantidad_inicio_mes) /
          mesAnteriorStats.cantidad_inicio_mes) *
        100;
    }

    // GUARDAR MENSUAL
    const estadisticasExistentes = await PilatesEstadisticasMensuales.findOne({
      where: { id_sede, anio, mes },
    });

    if (!estadisticasExistentes) {
      await PilatesEstadisticasMensuales.create({
        id_sede,
        anio,
        mes,
        cantidad_inicio_mes: cantidad_inicio,
        cantidad_fin_mes: siguen + altas,
        alumnos_dia_uno_que_siguen: siguen,
        porcentaje_retencion_global: porcentaje_retencion.toFixed(2),
        porcentaje_ocupacion_total: porcentaje_ocupacion.toFixed(2),
        asistencias_totales_mes: asistenciasTotales,
        asistencias_presentes_mes: presentes,
        asistencias_ausentes_mes: ausentes,
        porcentaje_asistencia_total: porcentaje_asistencia.toFixed(2),
        porcentaje_ausentismo_total: porcentaje_ausentismo.toFixed(2),
        variacion_porcentual: variacion_porcentual.toFixed(2),
        ltv_promedio_meses: ltv_promedio_meses.toFixed(2),
        ltv_total_bajas,
      });
    } else {
      await estadisticasExistentes.update({
        cantidad_inicio_mes: cantidad_inicio,
        cantidad_fin_mes: siguen + altas,
        alumnos_dia_uno_que_siguen: siguen,
        porcentaje_retencion_global: porcentaje_retencion.toFixed(2),
        porcentaje_ocupacion_total: porcentaje_ocupacion.toFixed(2),
        asistencias_totales_mes: asistenciasTotales,
        asistencias_presentes_mes: presentes,
        asistencias_ausentes_mes: ausentes,
        porcentaje_asistencia_total: porcentaje_asistencia.toFixed(2),
        porcentaje_ausentismo_total: porcentaje_ausentismo.toFixed(2),
        variacion_porcentual: variacion_porcentual.toFixed(2),
        ltv_promedio_meses: ltv_promedio_meses.toFixed(2),
        ltv_total_bajas,
      });
    }

    // --- C. PLANES (i vs f) ---
    // Reglas de conteo (según negocio):
    // - Se cuentan alumnos con estado = 'Plan'
    // - Se cuentan alumnos con estado = 'Renovacion programada' SOLO si fecha_prometido_pago NO es null
    // - NO importa si el plan está vencido o no (no filtramos por fecha_inicio/fecha_fin)
    // - Se cuenta por sede según inscripción -> horario
    //
    // Se preserva cantidad_inicial si ya existe; lo demás se recalcula.

    const tiposPlanes = [
      "Mensual",
      "Trimestral",
      "Semestral",
      "Anual",
      "Personalizado",
    ];

    const planesExistentes = await PilatesEstadisticasPlanes.findAll({
      where: { id_sede, anio, mes },
      attributes: ["nombre_plan", "cantidad_inicial"],
      raw: true,
    });
    const inicialExistentePorPlan = new Map(
      (planesExistentes || []).map((p) => [
        String(p.nombre_plan || "").trim(),
        Number(p.cantidad_inicial || 0),
      ]),
    );

    // Traemos los clientes únicos de la sede que cumplen la regla de conteo.
    const clientesParaPlanesRaw = await db.query(
      `SELECT DISTINCT
         c.id AS id,
         c.fecha_inicio AS fecha_inicio,
         c.fecha_fin AS fecha_fin
       FROM inscripciones_pilates i
       JOIN horarios_pilates h ON h.id = i.id_horario
       JOIN clientes_pilates c ON c.id = i.id_cliente
       WHERE h.id_sede = :id_sede
         AND (
           c.estado = 'Plan'
           OR (c.estado = 'Renovacion programada' AND c.fecha_prometido_pago IS NOT NULL)
         )`,
      {
        replacements: { id_sede },
        type: QueryTypes.SELECT,
      },
    );

    const conteoActualPorPlan = {};
    for (const c of clientesParaPlanesRaw || []) {
      // Si por algún motivo hay clientes sin fechas, los absorbemos en "Personalizado"
      // para que el total de alumnos se refleje en alguna categoría.
      let nombrePlan = obtenerNombrePlan(c.fecha_inicio, c.fecha_fin);
      if (nombrePlan === "Sin Plan") nombrePlan = "Personalizado";
      conteoActualPorPlan[nombrePlan] =
        (conteoActualPorPlan[nombrePlan] || 0) + 1;
    }

    for (const nombre of tiposPlanes) {
      const fin = conteoActualPorPlan[nombre] || 0;
      const ini = inicialExistentePorPlan.has(nombre)
        ? inicialExistentePorPlan.get(nombre)
        : fin;

      const variacion = ini > 0 ? ((fin - ini) / ini) * 100 : 0;

      await PilatesEstadisticasPlanes.upsert({
        id_sede,
        anio,
        mes,
        nombre_plan: nombre,
        cantidad_inicial: ini,
        cantidad_final: fin,
        variacion_porcentual: variacion.toFixed(2),
      });
    }

    // --- D. INSTRUCTORES ---
    // En el front los alumnos se agrupan por "grupo" semanal:
    // - LMV (Lunes/Miercoles/Viernes) por hora
    // - MJ  (Martes/Jueves) por hora
    // La inscripción puede venir con un solo día, pero se replica al grupo.
    const obtenerGrupoDia = (dia) => {
      const normalized = (dia || "").toString().trim().toUpperCase();
      if (["LUNES", "MIERCOLES", "MIÉRCOLES", "VIERNES"].includes(normalized))
        return "lmv";
      if (["MARTES", "JUEVES"].includes(normalized)) return "mj";
      return (dia || "otros").toString().trim().toLowerCase();
    };

    const horariosSede = await HorariosPilatesModel.findAll({
      where: { id_sede },
      attributes: ["id_instructor", "dia_semana", "hora_inicio"],
      raw: true,
    });

    const instructorGrupos = new Map();
    for (const h of horariosSede) {
      const instructorId = Number(h.id_instructor);
      if (!instructorId) continue;
      const grupo = obtenerGrupoDia(h.dia_semana);
      const key = `${grupo}|${h.hora_inicio}`;
      if (!instructorGrupos.has(instructorId))
        instructorGrupos.set(instructorId, new Set());
      instructorGrupos.get(instructorId).add(key);
    }

    const idsInstructores = Array.from(instructorGrupos.keys());
    const instructores = await UsuariosPilates.findAll({
      where: { id: { [Op.in]: idsInstructores } },
    });

    const caseGrupo =
      "CASE " +
      "WHEN UPPER(horario.dia_semana) IN ('LUNES','MIERCOLES','MIÉRCOLES','VIERNES') THEN 'lmv' " +
      "WHEN UPPER(horario.dia_semana) IN ('MARTES','JUEVES') THEN 'mj' " +
      "ELSE LOWER(horario.dia_semana) END";

    const construirMapConteoPorGrupo = (raw) =>
      new Map(
        (raw || []).map((r) => [
          `${r.grupo}|${r.hora_inicio}`,
          Number(r.alumnos || 0),
        ]),
      );

    const sumarConteoPorInstructor = (idInstructor, mapConteo) => {
      const grupos = instructorGrupos.get(Number(idInstructor)) || new Set();
      let total = 0;
      for (const key of grupos) total += Number(mapConteo.get(key) || 0);
      return total;
    };

    const conteoGruposInicioRaw = await InscripcionesPilatesModel.findAll({
      where: { fecha_inscripcion: { [Op.lt]: fechaInicio } },
      include: [
        {
          model: HorariosPilatesModel,
          as: "horario",
          where: { id_sede },
          attributes: [],
        },
        {
          model: ClientesPilates,
          as: "cliente",
          where: whereClienteActivoParaConteos,
          attributes: [],
        },
      ],
      attributes: [
        [literal(caseGrupo), "grupo"],
        [col("horario.hora_inicio"), "hora_inicio"],
        [fn("COUNT", fn("DISTINCT", col("id_cliente"))), "alumnos"],
      ],
      group: [literal(caseGrupo), col("horario.hora_inicio")],
      raw: true,
    });

    const conteoGruposActualRaw = await InscripcionesPilatesModel.findAll({
      include: [
        {
          model: HorariosPilatesModel,
          as: "horario",
          where: { id_sede },
          attributes: [],
        },
        {
          model: ClientesPilates,
          as: "cliente",
          where: whereClienteActivoParaConteos,
          attributes: [],
        },
      ],
      attributes: [
        [literal(caseGrupo), "grupo"],
        [col("horario.hora_inicio"), "hora_inicio"],
        [fn("COUNT", fn("DISTINCT", col("id_cliente"))), "alumnos"],
      ],
      group: [literal(caseGrupo), col("horario.hora_inicio")],
      raw: true,
    });

    const conteoGruposNuevosRaw = await InscripcionesPilatesModel.findAll({
      where: { fecha_inscripcion: { [Op.between]: [fechaInicio, fechaFin] } },
      include: [
        {
          model: HorariosPilatesModel,
          as: "horario",
          where: { id_sede },
          attributes: [],
        },
        {
          model: ClientesPilates,
          as: "cliente",
          where: whereClienteActivoParaConteos,
          attributes: [],
        },
      ],
      attributes: [
        [literal(caseGrupo), "grupo"],
        [col("horario.hora_inicio"), "hora_inicio"],
        [fn("COUNT", fn("DISTINCT", col("id_cliente"))), "alumnos"],
      ],
      group: [literal(caseGrupo), col("horario.hora_inicio")],
      raw: true,
    });

    const conteoGruposInicio = construirMapConteoPorGrupo(
      conteoGruposInicioRaw,
    );
    const conteoGruposActual = construirMapConteoPorGrupo(
      conteoGruposActualRaw,
    );
    const conteoGruposNuevos = construirMapConteoPorGrupo(
      conteoGruposNuevosRaw,
    );

    // =========================
    // Conversión clases de prueba (cohorte del mes)
    // =========================
    // Cohorte = clientes que pasan a "Clase de prueba" dentro del mes.
    // Convertidos = de esa cohorte, los que pasan a "Plan" dentro del mes.
    // Asignación a instructores por grupo LMV/MJ + hora (igual que el front).

    const clienteGruposSedeRaw = await InscripcionesPilatesModel.findAll({
      include: [
        {
          model: HorariosPilatesModel,
          as: "horario",
          where: { id_sede },
          attributes: [],
        },
      ],
      attributes: [
        "id_cliente",
        [literal(caseGrupo), "grupo"],
        [col("horario.hora_inicio"), "hora_inicio"],
      ],
      group: ["id_cliente", literal(caseGrupo), col("horario.hora_inicio")],
      raw: true,
    });

    const clienteGruposSede = new Map();
    for (const r of clienteGruposSedeRaw) {
      const clienteId = Number(r.id_cliente);
      if (!clienteId) continue;
      const key = `${r.grupo}|${r.hora_inicio}`;
      if (!clienteGruposSede.has(clienteId))
        clienteGruposSede.set(clienteId, new Set());
      clienteGruposSede.get(clienteId).add(key);
    }

    const instructoresPorGrupoHora = new Map();
    for (const h of horariosSede) {
      const instructorId = Number(h.id_instructor);
      if (!instructorId) continue;
      const grupo = obtenerGrupoDia(h.dia_semana);
      const key = `${grupo}|${h.hora_inicio}`;
      if (!instructoresPorGrupoHora.has(key))
        instructoresPorGrupoHora.set(key, new Set());
      instructoresPorGrupoHora.get(key).add(instructorId);
    }

    // En esta BD las pruebas se detectan por cambios en campos (no siempre por estado).
    const eventosTrial = await db.query(
      `SELECT
         h.cliente_id AS cliente_id,
         h.fecha_evento AS fecha_evento
       FROM clientes_pilates_historial_detalle d
       JOIN clientes_pilates_historial h ON h.id = d.historial_id
       WHERE h.fecha_evento BETWEEN :inicio AND :fin
         AND (
           LOWER(TRIM(d.campo)) LIKE '%prueba%'
           OR LOWER(TRIM(d.valor_nuevo)) LIKE '%prueb%'
         )`,
      {
        replacements: { inicio: fechaInicio, fin: fechaFin },
        type: QueryTypes.SELECT,
      },
    );

    const eventosPlan = await db.query(
      `SELECT
         h.cliente_id AS cliente_id,
         h.fecha_evento AS fecha_evento,
         LOWER(TRIM(d.campo)) AS campo_norm,
         LOWER(TRIM(d.valor_nuevo)) AS valor_nuevo_norm
       FROM clientes_pilates_historial_detalle d
       JOIN clientes_pilates_historial h ON h.id = d.historial_id
       WHERE h.fecha_evento BETWEEN :inicio AND :fin
         AND (
           (LOWER(TRIM(d.campo)) = 'estado' AND (LOWER(TRIM(d.valor_nuevo)) LIKE 'plan%' OR LOWER(TRIM(d.valor_nuevo)) LIKE '%contrat%'))
           OR (LOWER(TRIM(d.campo)) LIKE '%plan%')
         )`,
      {
        replacements: { inicio: fechaInicio, fin: fechaFin },
        type: QueryTypes.SELECT,
      },
    );

    const trialDateByClient = new Map();
    const planDateByClient = new Map();

    for (const e of eventosTrial) {
      const clienteId = Number(e.cliente_id);
      if (!clienteId || !clienteGruposSede.has(clienteId)) continue;
      const fechaEvento = new Date(e.fecha_evento);
      const prev = trialDateByClient.get(clienteId);
      if (!prev || fechaEvento < prev)
        trialDateByClient.set(clienteId, fechaEvento);
    }

    for (const e of eventosPlan) {
      const clienteId = Number(e.cliente_id);
      if (!clienteId || !clienteGruposSede.has(clienteId)) continue;
      const fechaEvento = new Date(e.fecha_evento);
      const prev = planDateByClient.get(clienteId);
      if (!prev || fechaEvento < prev)
        planDateByClient.set(clienteId, fechaEvento);
    }

    const clientesPruebaMes = new Set(trialDateByClient.keys());
    const clientesConvertidosMes = new Set();
    for (const [clienteId, trialDate] of trialDateByClient.entries()) {
      const planDate = planDateByClient.get(clienteId);
      if (planDate && planDate > trialDate)
        clientesConvertidosMes.add(clienteId);
    }

    const asignadosPorInstructor = new Map();
    const convertidosPorInstructor = new Map();
    const asegurarSet = (map, key) => {
      if (!map.has(key)) map.set(key, new Set());
      return map.get(key);
    };

    const asignarCliente = (map, clienteId) => {
      const keys = clienteGruposSede.get(clienteId) || new Set();
      for (const k of keys) {
        const instructores = instructoresPorGrupoHora.get(k) || new Set();
        for (const instructorId of instructores) {
          asegurarSet(map, instructorId).add(clienteId);
        }
      }
    };

    for (const clienteId of clientesPruebaMes)
      asignarCliente(asignadosPorInstructor, clienteId);
    for (const clienteId of clientesConvertidosMes)
      asignarCliente(convertidosPorInstructor, clienteId);

    for (const profe of instructores) {
      // 1. Verificar si ya existe registro para este instructor en este mes
      const estadisticaProfeExistente =
        await PilatesEstadisticasInstructores.findOne({
          where: { usuario_id: profe.id, id_sede, anio, mes },
          attributes: ["alumnos_iniciales"],
        });

      // 2. Calcular alumnos que tenía al inicio del mes (día 1)
      // Inscripciones con fecha ANTES del inicio del mes, pero agrupadas por LMV/MJ y hora
      let alumnosIniciales;
      if (
        estadisticaProfeExistente?.alumnos_iniciales !== null &&
        estadisticaProfeExistente?.alumnos_iniciales !== undefined
      ) {
        // Ya existe el registro, mantener el valor inicial fijo
        alumnosIniciales = estadisticaProfeExistente.alumnos_iniciales;
      } else {
        alumnosIniciales = sumarConteoPorInstructor(
          profe.id,
          conteoGruposInicio,
        );
      }

      // 3. Calcular alumnos actuales del instructor (todas las inscripciones vigentes)
      const alumnosActuales = sumarConteoPorInstructor(
        profe.id,
        conteoGruposActual,
      );

      // 4. Calcular retención del instructor SOLO por cantidad:
      //    (alumnos_actuales / alumnos_iniciales) * 100
      const retencionProfe =
        alumnosIniciales > 0
          ? (Math.min(alumnosActuales, alumnosIniciales) * 100) /
            alumnosIniciales
          : 0;

      // 5. Calcular alumnos perdidos (los que estaban al inicio y ya no están)
      const alumnosPerdidos = Math.max(alumnosIniciales - alumnosActuales, 0);

      // 6. Calcular alumnos nuevos (inscripciones durante el mes)
      const alumnosNuevos = sumarConteoPorInstructor(
        profe.id,
        conteoGruposNuevos,
      );

      const pruebasAsignadas = asignadosPorInstructor.get(profe.id)?.size || 0;
      const pruebasConvertidas =
        convertidosPorInstructor.get(profe.id)?.size || 0;

      const conversion =
        pruebasAsignadas > 0
          ? (pruebasConvertidas * 100) / pruebasAsignadas
          : 0;

      await PilatesEstadisticasInstructores.upsert({
        usuario_id: profe.id,
        id_sede,
        anio,
        mes,
        alumnos_iniciales: alumnosIniciales,
        alumnos_actuales: alumnosActuales,
        alumnos_perdidos: alumnosPerdidos,
        alumnos_nuevos: alumnosNuevos,
        porcentaje_retencion_profe: retencionProfe.toFixed(2),
        porcentaje_asistencia_clases: 0,
        pruebas_asignadas: pruebasAsignadas,
        pruebas_convertidas: pruebasConvertidas,
        porcentaje_conversion: conversion.toFixed(2),
      });
    }

    res.json({ message: "Sincronización completa", sede: id_sede });
  } catch (error) {
    console.error("Error en Sync:", error);
    res.status(500).json({ message: error.message });
  }
};

// ============================================================================
// 2. OBTENER DATOS COMPLETOS (Endpoint Full para Frontend)
// ============================================================================
export const OBRS_EstadisticasCompletas = async (req, res) => {
  try {
    const { id_sede, anio, mes, fecha } = req.query;

    // 1. Validar Sede
    const sedeInfo = await SedeModel.findOne({
      where: { id: id_sede, es_ciudad: 1 },
    });
    if (!sedeInfo) return res.status(403).json({ message: "Sede no válida." });

    // 2. Recuperar Datos Mensuales (Ya procesados por la sincronización)
    let estadisticasMes = await PilatesEstadisticasMensuales.findOne({
      where: { id_sede, anio, mes },
    });

    if (!estadisticasMes) {
      estadisticasMes = {
        cantidad_inicio_mes: 0,
        alumnos_dia_uno_que_siguen: 0,
        porcentaje_retencion_global: 0,
        cantidad_fin_mes: 0,
        porcentaje_ocupacion_total: 0,
        asistencias_totales_mes: 0,
        asistencias_presentes_mes: 0,
        asistencias_ausentes_mes: 0,
        porcentaje_asistencia_total: 0,
        porcentaje_ausentismo_total: 0,
      };
    }

    // 3. Evolución (Gráfico de los últimos 6 meses)
    const evolucionMensualRaw = await PilatesEstadisticasMensuales.findAll({
      where: { id_sede },
      order: [
        ["anio", "DESC"],
        ["mes", "DESC"],
      ],
      limit: 6,
    });
    const evolucionMensual = evolucionMensualRaw.map((e) => ({
      ...e.toJSON(),
      variacion_porcentual: parseFloat(e.variacion_porcentual || 0),
    }));

    // 4. Vida Media (LTV) - Guardado en estadisticas mensuales
    const ltv = {
      promedioMeses: estadisticasMes.ltv_promedio_meses || 0,
      totalSociosEstudiados: estadisticasMes.ltv_total_bajas || 0,
    };

    // 5. Fechas para Mostrador y Filtros
    // Regla:
    // - Si el front manda `fecha`, la usamos tal cual.
    // - Si NO manda `fecha`, usamos como máximo "hoy" pero dentro del mes consultado,
    //   y si para ese día no hay asistencias creadas, caemos al ÚLTIMO día con datos.
    const fechaInicioMesMoment = moment(`${anio}-${mes}-01`).startOf("month");
    const fechaFinMesMoment = moment(`${anio}-${mes}-01`).endOf("month");
    const fechaInicioMes = fechaInicioMesMoment.toDate();
    const fechaFinMes = fechaFinMesMoment.toDate();

    const fechaSolicitada = fecha ? moment(fecha).format("YYYY-MM-DD") : null;
    const hoyMoment = moment().startOf("day");
    const fechaTopeSinParametro = moment
      .min(hoyMoment, fechaFinMesMoment)
      .format("YYYY-MM-DD");

    let fechaMostrador = fechaSolicitada || fechaTopeSinParametro;

    if (!fechaSolicitada) {
      const ultimaFechaConAsistencias = await db.query(
        `SELECT MAX(a.fecha) AS max_fecha
         FROM asistencias_pilates a
         JOIN inscripciones_pilates i ON i.id = a.id_inscripcion
         JOIN horarios_pilates h ON h.id = i.id_horario
         WHERE h.id_sede = :id_sede
           AND a.fecha <= :fecha_tope`,
        {
          replacements: { id_sede, fecha_tope: fechaMostrador },
          type: QueryTypes.SELECT,
        },
      );

      const maxFecha = ultimaFechaConAsistencias?.[0]?.max_fecha;
      if (maxFecha) fechaMostrador = moment(maxFecha).format("YYYY-MM-DD");
    }

    const fechaInicioMesStr = fechaInicioMesMoment.format("YYYY-MM-DD");
    const fechaMostradorStr = fechaMostrador;

    // 6. Cálculos en vivo para el Mostrador Diario (cupos por grupos LMV/MJ y bloqueos)
    const horasRaw = await HorariosPilatesModel.findAll({
      where: {
        id_sede,
        dia_semana: {
          [Op.in]: ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"],
        },
      },
      attributes: [
        "hora_inicio",
        [
          fn(
            "MAX",
            literal(
              "CASE WHEN dia_semana IN ('Lunes','Miercoles','Viernes') THEN 1 ELSE 0 END",
            ),
          ),
          "has_lmv",
        ],
        [
          fn(
            "MAX",
            literal(
              "CASE WHEN dia_semana IN ('Martes','Jueves') THEN 1 ELSE 0 END",
            ),
          ),
          "has_mj",
        ],
      ],
      group: ["hora_inicio"],
      raw: true,
    });

    const bloqueos = await HorariosDeshabilitadosPilatesModel.findAll({
      where: { sede_id: id_sede },
      attributes: ["hora_label", "tipo_bloqueo"],
      raw: true,
    });

    const bloqueosPorHora = new Map();
    for (const b of bloqueos) {
      if (!bloqueosPorHora.has(b.hora_label))
        bloqueosPorHora.set(b.hora_label, new Set());
      bloqueosPorHora.get(b.hora_label).add(b.tipo_bloqueo);
    }

    const inscLmvRaw = await InscripcionesPilatesModel.findAll({
      include: [
        {
          model: HorariosPilatesModel,
          as: "horario",
          where: {
            id_sede,
            dia_semana: { [Op.in]: ["Lunes", "Miercoles", "Viernes"] },
          },
          attributes: [],
        },
      ],
      attributes: [
        [col("horario.hora_inicio"), "hora_inicio"],
        [fn("COUNT", fn("DISTINCT", col("id_cliente"))), "insc_lmv"],
      ],
      group: ["horario.hora_inicio"],
      raw: true,
    });

    const inscMjRaw = await InscripcionesPilatesModel.findAll({
      include: [
        {
          model: HorariosPilatesModel,
          as: "horario",
          where: { id_sede, dia_semana: { [Op.in]: ["Martes", "Jueves"] } },
          attributes: [],
        },
      ],
      attributes: [
        [col("horario.hora_inicio"), "hora_inicio"],
        [fn("COUNT", fn("DISTINCT", col("id_cliente"))), "insc_mj"],
      ],
      group: ["horario.hora_inicio"],
      raw: true,
    });

    const inscLmvMap = new Map(
      inscLmvRaw.map((r) => [
        moment(r.hora_inicio, "HH:mm:ss").format("HH:mm"),
        Number(r.insc_lmv || 0),
      ]),
    );
    const inscMjMap = new Map(
      inscMjRaw.map((r) => [
        moment(r.hora_inicio, "HH:mm:ss").format("HH:mm"),
        Number(r.insc_mj || 0),
      ]),
    );

    const cupoMaximo = sedeInfo?.cupo_maximo_pilates || 0;
    let cuposHabilitados = 0;
    let inscriptosHoy = 0;

    for (const h of horasRaw) {
      const label = moment(h.hora_inicio, "HH:mm:ss").format("HH:mm");
      const tipos = bloqueosPorHora.get(label) || new Set();
      let lmvOn = Number(h.has_lmv || 0);
      let mjOn = Number(h.has_mj || 0);

      if (tipos.has("todos")) {
        lmvOn = 0;
        mjOn = 0;
      } else {
        if (tipos.has("lmv")) lmvOn = 0;
        if (tipos.has("mj")) mjOn = 0;
      }

      cuposHabilitados += (lmvOn + mjOn) * cupoMaximo;
      inscriptosHoy +=
        (lmvOn ? inscLmvMap.get(label) || 0 : 0) +
        (mjOn ? inscMjMap.get(label) || 0 : 0);
    }

    const cuposTeoricos = horasRaw.length * 2 * cupoMaximo;
    const cuposDeshabilitados = Math.max(0, cuposTeoricos - cuposHabilitados);
    const totalCupos = cuposHabilitados;
    const turnosLibres = Math.max(0, totalCupos - inscriptosHoy);
    // Filtrar planes vencidos por sede a través de la inscripción -> horario
    const planesVencidos = await ClientesPilates.count({
      where: { estado: "Plan", fecha_fin: { [Op.lt]: fechaMostrador } },
      include: [
        {
          model: InscripcionesPilatesModel,
          as: "inscripciones",
          required: true,
          include: [
            {
              model: HorariosPilatesModel,
              as: "horario",
              where: { id_sede },
              attributes: [],
            },
          ],
        },
      ],
      distinct: true,
      col: "id",
    });
    const listaEspera = await ListaEsperaPilates.count({ where: { id_sede } });

    const altasDia = await InscripcionesPilatesModel.count({
      where: { fecha_inscripcion: fechaMostrador },
      include: [
        {
          model: HorariosPilatesModel,
          as: "horario",
          where: { id_sede },
          attributes: [],
        },
      ],
    });
    const bajasDia = await PilatesBajasHistorial.count({
      where: { id_sede, fecha_baja: fechaMostrador },
    });
    const ausentesDia = await AsistenciasPilates.count({
      where: { fecha: fechaMostrador, presente: 0 },
      include: [
        {
          model: InscripcionesPilatesModel,
          as: "inscripcion",
          include: [
            {
              model: HorariosPilatesModel,
              as: "horario",
              where: { id_sede },
              attributes: [],
            },
          ],
        },
      ],
    });

    // Resumen de asistencia mensual (hasta la fecha del mostrador):
    // - "ausentes posibles" = total de registros de asistencias creados
    // - "ausentes" = presente = 0
    const asistenciaMesRaw = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(a.presente = 1) AS presentes,
         SUM(a.presente = 0) AS ausentes
       FROM asistencias_pilates a
       JOIN inscripciones_pilates i ON i.id = a.id_inscripcion
       JOIN horarios_pilates h ON h.id = i.id_horario
       WHERE h.id_sede = :id_sede
         AND a.fecha BETWEEN :inicio_mes AND :fin_hasta`,
      {
        replacements: {
          id_sede,
          inicio_mes: fechaInicioMesStr,
          fin_hasta: fechaMostradorStr,
        },
        type: QueryTypes.SELECT,
      },
    );

    const asistenciaMesTotal = Number(asistenciaMesRaw?.[0]?.total || 0);
    const asistenciaMesPresentes = Number(
      asistenciaMesRaw?.[0]?.presentes || 0,
    );
    const asistenciaMesAusentes = Number(asistenciaMesRaw?.[0]?.ausentes || 0);
    const porcentajeAsistenciaMes =
      asistenciaMesTotal > 0
        ? (asistenciaMesPresentes * 100) / asistenciaMesTotal
        : 0;
    const porcentajeAusentismoMes =
      asistenciaMesTotal > 0
        ? (asistenciaMesAusentes * 100) / asistenciaMesTotal
        : 0;

    // 7. DETALLE DE BAJAS
    const detalleBajas = await PilatesBajasHistorial.findAll({
      where: {
        id_sede,
        fecha_baja: { [Op.between]: [fechaInicioMes, fechaFinMes] },
      },
      attributes: [
        "id",
        "nombre_cliente",
        "id_sede",
        "fecha_alta_original",
        "fecha_baja",
        "fecha_creacion",
        "cantidad_renovaciones",
        "meses_entrenados",
        "motivo",
        "contactado_remarketing",
        "recuperado",
      ],
      include: [{ model: SedeModel, as: "sede", attributes: ["nombre"] }],
      order: [
        ["fecha_creacion", "DESC"],
        ["fecha_baja", "DESC"],
      ],
    });

    // 8. Estadísticas de Instructores
    const instructoresStats = await PilatesEstadisticasInstructores.findAll({
      where: { id_sede, anio, mes },
      include: [
        {
          model: UsuariosPilates,
          as: "usuarioInstructor",
          attributes: ["id", "nombre", "apellido", "telefono"],
        },
      ],
    });

    // Conteo en vivo de alumnos por instructor según agrupamiento LMV/MJ por hora
    const obtenerGrupoDia = (dia) => {
      const normalized = (dia || "").toString().trim().toUpperCase();
      if (["LUNES", "MIERCOLES", "MIÉRCOLES", "VIERNES"].includes(normalized))
        return "lmv";
      if (["MARTES", "JUEVES"].includes(normalized)) return "mj";
      return (dia || "otros").toString().trim().toLowerCase();
    };

    const horariosSede = await HorariosPilatesModel.findAll({
      where: { id_sede },
      attributes: ["id_instructor", "dia_semana", "hora_inicio"],
      raw: true,
    });

    const instructorGrupos = new Map();
    for (const h of horariosSede) {
      const instructorId = Number(h.id_instructor);
      if (!instructorId) continue;
      const grupo = obtenerGrupoDia(h.dia_semana);
      const key = `${grupo}|${h.hora_inicio}`;
      if (!instructorGrupos.has(instructorId))
        instructorGrupos.set(instructorId, new Set());
      instructorGrupos.get(instructorId).add(key);
    }

    const caseGrupo =
      "CASE " +
      "WHEN UPPER(horario.dia_semana) IN ('LUNES','MIERCOLES','MIÉRCOLES','VIERNES') THEN 'lmv' " +
      "WHEN UPPER(horario.dia_semana) IN ('MARTES','JUEVES') THEN 'mj' " +
      "ELSE LOWER(horario.dia_semana) END";

    const construirMapConteoPorGrupo = (raw) =>
      new Map(
        (raw || []).map((r) => [
          `${r.grupo}|${r.hora_inicio}`,
          Number(r.alumnos || 0),
        ]),
      );

    const sumarConteoPorInstructor = (idInstructor, mapConteo) => {
      const grupos = instructorGrupos.get(Number(idInstructor)) || new Set();
      let total = 0;
      for (const key of grupos) total += Number(mapConteo.get(key) || 0);
      return total;
    };

    const conteoGruposActualRaw = await InscripcionesPilatesModel.findAll({
      include: [
        {
          model: HorariosPilatesModel,
          as: "horario",
          where: { id_sede },
          attributes: [],
        },
        {
          model: ClientesPilates,
          as: "cliente",
          where: whereClienteActivoParaConteos,
          attributes: [],
        },
      ],
      attributes: [
        [literal(caseGrupo), "grupo"],
        [col("horario.hora_inicio"), "hora_inicio"],
        [fn("COUNT", fn("DISTINCT", col("id_cliente"))), "alumnos"],
      ],
      group: [literal(caseGrupo), col("horario.hora_inicio")],
      raw: true,
    });

    const conteoGruposNuevosRaw = await InscripcionesPilatesModel.findAll({
      where: {
        fecha_inscripcion: { [Op.between]: [fechaInicioMes, fechaFinMes] },
      },
      include: [
        {
          model: HorariosPilatesModel,
          as: "horario",
          where: { id_sede },
          attributes: [],
        },
        {
          model: ClientesPilates,
          as: "cliente",
          where: whereClienteActivoParaConteos,
          attributes: [],
        },
      ],
      attributes: [
        [literal(caseGrupo), "grupo"],
        [col("horario.hora_inicio"), "hora_inicio"],
        [fn("COUNT", fn("DISTINCT", col("id_cliente"))), "alumnos"],
      ],
      group: [literal(caseGrupo), col("horario.hora_inicio")],
      raw: true,
    });

    const conteoGruposActual = construirMapConteoPorGrupo(
      conteoGruposActualRaw,
    );
    const conteoGruposNuevos = construirMapConteoPorGrupo(
      conteoGruposNuevosRaw,
    );

    // =========================================================
    // ASISTENCIA POR INSTRUCTOR (LMV/MJ por hora, hasta fechaMostrador)
    // =========================================================
    const asistenciaPorGrupoHoraRaw = await db.query(
      `SELECT
         CASE
           WHEN UPPER(h.dia_semana) IN ('LUNES','MIERCOLES','MIÉRCOLES','VIERNES') THEN 'lmv'
           WHEN UPPER(h.dia_semana) IN ('MARTES','JUEVES') THEN 'mj'
           ELSE LOWER(h.dia_semana)
         END AS grupo,
         h.hora_inicio AS hora_inicio,
         COUNT(*) AS total,
         SUM(a.presente = 1) AS presentes,
         SUM(a.presente = 0) AS ausentes
       FROM asistencias_pilates a
       JOIN inscripciones_pilates i ON i.id = a.id_inscripcion
       JOIN horarios_pilates h ON h.id = i.id_horario
       WHERE h.id_sede = :id_sede
         AND a.fecha BETWEEN :inicio_mes AND :fin_hasta
       GROUP BY grupo, hora_inicio`,
      {
        replacements: {
          id_sede,
          inicio_mes: fechaInicioMesStr,
          fin_hasta: fechaMostradorStr,
        },
        type: QueryTypes.SELECT,
      },
    );

    const mapAsistenciaTotal = new Map();
    const mapAsistenciaPresentes = new Map();
    const mapAsistenciaAusentes = new Map();
    for (const r of asistenciaPorGrupoHoraRaw || []) {
      const key = `${r.grupo}|${r.hora_inicio}`;
      mapAsistenciaTotal.set(key, Number(r.total || 0));
      mapAsistenciaPresentes.set(key, Number(r.presentes || 0));
      mapAsistenciaAusentes.set(key, Number(r.ausentes || 0));
    }

    // 9. Estadísticas de Planes
    const planesStatsRaw = await PilatesEstadisticasPlanes.findAll({
      where: {
        id_sede,
        nombre_plan: { [Op.ne]: "Sin Plan" },
      },
      order: [
        ["anio", "DESC"],
        ["mes", "DESC"],
      ],
    });

    const planesStats = planesStatsRaw.map((p) => ({
      ...p.toJSON(),
      variacion_porcentual: parseFloat(p.variacion_porcentual || 0),
    }));

    const alumnosPorPlan = Object.values(
      planesStats
        .filter((p) =>
          evolucionMensual.some((e) => e.anio === p.anio && e.mes === p.mes),
        )
        .reduce((acc, p) => {
          const key = `${p.anio}-${p.mes}`;
          if (!acc[key])
            acc[key] = {
              anio: parseInt(p.anio),
              mes: parseInt(p.mes),
              planes: [],
            };
          acc[key].planes.push(p);
          return acc;
        }, {}),
    );

    // 10. Totales del Mes (Altas y Bajas brutas)
    const altasMes = await InscripcionesPilatesModel.count({
      where: {
        fecha_inscripcion: { [Op.between]: [fechaInicioMes, fechaFinMes] },
      },
      include: [
        {
          model: HorariosPilatesModel,
          as: "horario",
          where: { id_sede },
          attributes: [],
        },
      ],
    });
    const bajasMes = await PilatesBajasHistorial.count({
      where: {
        id_sede,
        fecha_baja: { [Op.between]: [fechaInicioMes, fechaFinMes] },
      },
    });

    const alumnosInscritosActuales = await InscripcionesPilatesModel.count({
      include: [
        {
          model: HorariosPilatesModel,
          as: "horario",
          where: { id_sede },
          attributes: [],
        },
        {
          model: ClientesPilates,
          as: "cliente",
          where: whereClienteActivoParaConteos,
          attributes: [],
        },
      ],
      distinct: true,
      col: "id_cliente",
    });

    const porcentajeOcupacionActual =
      totalCupos > 0
        ? (Number(alumnosInscritosActuales || 0) * 100) / totalCupos
        : 0;

    // =========================================================
    // CONSTRUCCIÓN DEL OBJETO DE RESPUESTA CONSOLIDADO
    // =========================================================
    res.json({
      evolucionMensual,
      vidaMedia: {
        promedioMeses: parseFloat(ltv?.promedioMeses || 0).toFixed(1),
        totalSociosEstudiados: ltv?.totalSociosEstudiados || 0,
      },
      retencion: {
        clientesIniciales: estadisticasMes.cantidad_inicio_mes,
        bajasMes: bajasMes,
        porcentajeRetencion: parseFloat(
          (alumnosInscritosActuales * 100) /
            estadisticasMes.cantidad_inicio_mes,
        ).toFixed(2),
      },
      ocupacion: {
        alumnosInscritos: alumnosInscritosActuales,
        turnosHabilitados: totalCupos,
        porcentajeOcupacion: parseFloat(porcentajeOcupacionActual.toFixed(2)),
      },
      asistenciaPromedio: parseFloat(porcentajeAsistenciaMes.toFixed(2)),
      retencionPorInstructor: instructoresStats.map((i) => {
        const alumnosIniciales = Number(i.alumnos_iniciales || 0);
        const alumnosActualesVivo = sumarConteoPorInstructor(
          i.usuario_id,
          conteoGruposActual,
        );
        const alumnosNuevosVivo = sumarConteoPorInstructor(
          i.usuario_id,
          conteoGruposNuevos,
        );
        const alumnosPerdidosVivo = Math.max(
          alumnosIniciales - alumnosActualesVivo,
          0,
        );
        const retencionVivo =
          alumnosIniciales > 0
            ? (Math.min(alumnosActualesVivo, alumnosIniciales) * 100) /
              alumnosIniciales
            : 0;

        const asistenciasTotalesProfe = sumarConteoPorInstructor(
          i.usuario_id,
          mapAsistenciaTotal,
        );
        const asistenciasPresentesProfe = sumarConteoPorInstructor(
          i.usuario_id,
          mapAsistenciaPresentes,
        );
        const asistenciasAusentesProfe = sumarConteoPorInstructor(
          i.usuario_id,
          mapAsistenciaAusentes,
        );
        const porcentajeAsistenciaProfe =
          asistenciasTotalesProfe > 0
            ? (asistenciasPresentesProfe * 100) / asistenciasTotalesProfe
            : 0;

        return {
          id: i.id,
          usuario_id: i.usuario_id,
          nombre:
            `${i.usuarioInstructor?.nombre || ""} ${i.usuarioInstructor?.apellido || ""}`.trim(),
          telefono: i.usuarioInstructor?.telefono || "",
          anio: i.anio,
          mes: i.mes,
          alumnos_iniciales: alumnosIniciales,
          alumnos_actuales: alumnosActualesVivo,
          alumnos_perdidos: alumnosPerdidosVivo,
          alumnos_nuevos: alumnosNuevosVivo,
          porcentaje_retencion_profe: parseFloat(retencionVivo.toFixed(2)),
          porcentaje_asistencia_clases: parseFloat(
            porcentajeAsistenciaProfe.toFixed(2),
          ),
          asistencias_totales: asistenciasTotalesProfe,
          asistencias_presentes: asistenciasPresentesProfe,
          asistencias_ausentes: asistenciasAusentesProfe,
        };
      }),
      conversionPrueba: instructoresStats.map((i) => ({
        id: i.id,
        nombre:
          `${i.usuarioInstructor?.nombre || ""} ${i.usuarioInstructor?.apellido || ""}`.trim(),
        pruebas_asignadas: i.pruebas_asignadas,
        pruebas_convertidas: i.pruebas_convertidas,
        porcentaje_conversion: parseFloat(i.porcentaje_conversion || 0),
      })),
      alumnosPorPlan,
      mostrador: {
        turnos_libres: turnosLibres,
        planes_vencidos: planesVencidos,
        lista_espera: listaEspera,
        ausentes_mes_hasta_fecha: asistenciaMesAusentes,
        ausentes_posibles_mes_hasta_fecha: asistenciaMesTotal,
        resumen_ausentes_mes: `${asistenciaMesAusentes}/${asistenciaMesTotal}`,
        porcentaje_ausentismo_mes: parseFloat(
          porcentajeAusentismoMes.toFixed(2),
        ),
        porcentaje_asistencia_mes: parseFloat(
          porcentajeAsistenciaMes.toFixed(2),
        ),
        altas_dia: altasDia,
        bajas_dia: bajasDia,
        fechaActualizacion: moment(fechaMostrador).format("DD/MM/YYYY"),
        cupos_teoricos: cuposTeoricos,
        cupos_habilitados: cuposHabilitados,
        cupos_deshabilitados: cuposDeshabilitados,
      },
      altasMes,
      bajasMes,
      // 11. Detalle Tabla Bajas (Mapeo corregido a nombre_cliente)
      detalleBajas: detalleBajas.map((b) => ({
        id: b.id,
        nombre: b.nombre_cliente || "NO DEFINIDO", // Campo local de la tabla
        sede: b.sede?.nombre,
        fecha_alta_original: b.fecha_alta_original,
        fecha_baja: b.fecha_baja,
        motivo: b.motivo?.nombre_motivo || "Sin Motivo",
        meses_entrenados: b.meses_entrenados,
        recuperado: b.recuperado,
      })),
    });
  } catch (error) {
    console.error("Error en obtenerEstadisticasCompletas:", error);
    res.status(500).json({ message: error.message });
  }
};

// ============================================================================
// 3. OBTENER DATOS MES A MES (Endpoint para Evolución Mes a Mes)
// ============================================================================
export const OBRS_EstadisticasMesConMes = async (req, res) => {
  try {
    const { id_sede, anio_desde, mes_desde, anio_hasta, mes_hasta } = req.query;

    // 1. Validar sede
    const sedeInfo = await SedeModel.findOne({
      where: { id: id_sede, es_ciudad: 1 },
    });
    if (!sedeInfo) {
      return res.status(403).json({ message: "Sede no válida." });
    }

    // 2. Determinar rango de fechas para la consulta principal
    let whereCondition = { id_sede };

    if (anio_desde && mes_desde && anio_hasta && mes_hasta) {
      whereCondition = {
        ...whereCondition,
        [Op.and]: [
          {
            [Op.or]: [
              { anio: { [Op.gt]: parseInt(anio_desde) } },
              {
                anio: parseInt(anio_desde),
                mes: { [Op.gte]: parseInt(mes_desde) },
              },
            ],
          },
          {
            [Op.or]: [
              { anio: { [Op.lt]: parseInt(anio_hasta) } },
              {
                anio: parseInt(anio_hasta),
                mes: { [Op.lte]: parseInt(mes_hasta) },
              },
            ],
          },
        ],
      };
    }

    // 3. Obtener registros base mensuales (snapshot guardado)
    const evolucionMensualRaw = await PilatesEstadisticasMensuales.findAll({
      where: whereCondition,
      order: [
        ["anio", "ASC"],
        ["mes", "ASC"],
      ],
      raw: true,
    });

    // 4. Enriquecer cada mes con datos adicionales (Queries en paralelo)
    const resultado = await Promise.all(
      evolucionMensualRaw.map(async (mesActual, index) => {
        // --- A. Preparar Fechas del mes iterado ---
        const fechaInicio = moment(
          `${mesActual.anio}-${mesActual.mes}-01`,
          "YYYY-M-D",
        )
          .startOf("month")
          .toDate();
        const fechaFin = moment(fechaInicio).endOf("month").toDate();

        // --- B. Variación Porcentual (Lógica existente) ---
        let variacion_porcentual = 0;
        if (index > 0) {
          const mesAnterior = evolucionMensualRaw[index - 1];
          const valorAnterior = mesAnterior.cantidad_inicio_mes || 0;
          const valorActual = mesActual.cantidad_inicio_mes || 0;
          if (valorAnterior > 0) {
            variacion_porcentual =
              ((valorActual - valorAnterior) / valorAnterior) * 100;
          }
        }

        // --- C. Altas y Bajas (queries en vivo) ---
        // Query directa
        const altas_mes = await InscripcionesPilatesModel.count({
          where: {
            fecha_inscripcion: { [Op.between]: [fechaInicio, fechaFin] },
          },
          include: [
            {
              model: HorariosPilatesModel,
              as: "horario",
              where: { id_sede },
              attributes: [],
            },
          ],
        });

        const bajas_mes = await PilatesBajasHistorial.count({
          where: {
            id_sede,
            fecha_baja: { [Op.between]: [fechaInicio, fechaFin] },
          },
        });

        // --- D. Cupos y Turnos (Cálculo derivado) ---
        // Si ocupación = (inscritos / cupos) * 100  => Cupos = (inscritos * 100) / ocupación
        const inscritosFin = parseInt(mesActual.cantidad_fin_mes || 0);
        const ocupacion = parseFloat(mesActual.porcentaje_ocupacion_total || 0);
        let cupos_habilitados = 0;

        if (ocupacion > 0) {
          cupos_habilitados = Math.round((inscritosFin * 100) / ocupacion);
        } else {
          // Fallback si ocupación es 0: estimar con cupo maximo sede * horas promedio (o devolver 0)
          cupos_habilitados = 0;
        }
        const turnos_libres = Math.max(0, cupos_habilitados - inscritosFin);

        // --- E. Instructores (Agregación) ---
        const statsInstructores = await PilatesEstadisticasInstructores.findAll(
          {
            where: { id_sede, anio: mesActual.anio, mes: mesActual.mes },
            attributes: [
              [fn("COUNT", col("id")), "total_activos"],
              [
                fn("AVG", col("porcentaje_retencion_profe")),
                "promedio_retencion",
              ],
              // Si no hay asistencia guardada, el promedio queda en 0.
              [
                fn("AVG", col("porcentaje_asistencia_clases")),
                "promedio_asistencia",
              ],
              [fn("SUM", col("pruebas_asignadas")), "pruebas_asignadas_total"],
              [
                fn("SUM", col("pruebas_convertidas")),
                "pruebas_convertidas_total",
              ],
              [
                fn("AVG", col("porcentaje_conversion")),
                "porcentaje_conversion_promedio",
              ],
            ],
            raw: true,
          },
        );

        const dataInst = statsInstructores[0] || {};

        // --- F. Planes (Pivot) ---
        const statsPlanes = await PilatesEstadisticasPlanes.findAll({
          where: { id_sede, anio: mesActual.anio, mes: mesActual.mes },
          raw: true,
        });

        const objetoPlanes = {
          mensual: 0,
          trimestral: 0,
          semestral: 0,
          anual: 0,
          personalizado: 0,
        };

        statsPlanes.forEach((p) => {
          const nombre = (p.nombre_plan || "").toLowerCase();
          if (objetoPlanes.hasOwnProperty(nombre)) {
            objetoPlanes[nombre] = parseInt(p.cantidad_final || 0);
          } else {
            // Por si hay otros nombres
            objetoPlanes[nombre] = parseInt(p.cantidad_final || 0);
          }
        });

        // --- G. Vida Media (LTV) del mes (persistido) ---
        const vida_media_meses = parseFloat(mesActual.ltv_promedio_meses || 0);
        const ltv_total_bajas = parseInt(mesActual.ltv_total_bajas || 0, 10);

        // --- RETORNO DEL OBJETO FORMATEADO ---
        return {
          // 1. Datos existentes
          anio: parseInt(mesActual.anio),
          mes: parseInt(mesActual.mes),
          cantidad_inicio_mes: parseInt(mesActual.cantidad_inicio_mes || 0),
          cantidad_fin_mes: inscritosFin,
          variacion_porcentual: parseFloat(variacion_porcentual.toFixed(2)),
          alumnos_dia_uno_que_siguen: parseInt(
            mesActual.alumnos_dia_uno_que_siguen || 0,
          ),
          porcentaje_retencion_global: parseFloat(
            mesActual.porcentaje_retencion_global || 0,
          ),
          porcentaje_ocupacion_total: ocupacion,
          asistencias_totales_mes: parseInt(
            mesActual.asistencias_totales_mes || 0,
          ),
          asistencias_presentes_mes: parseInt(
            mesActual.asistencias_presentes_mes || 0,
          ),
          asistencias_ausentes_mes: parseInt(
            mesActual.asistencias_ausentes_mes || 0,
          ),
          porcentaje_asistencia_total: parseFloat(
            mesActual.porcentaje_asistencia_total || 0,
          ),
          porcentaje_ausentismo_total: parseFloat(
            mesActual.porcentaje_ausentismo_total || 0,
          ),

          // 2. Nuevos Datos Agregados
          altas_mes: altas_mes,
          bajas_mes: bajas_mes,
          cupos_habilitados: cupos_habilitados,
          turnos_libres: turnos_libres,

          // 3. Objeto Instructores
          instructores: {
            total_activos: parseInt(dataInst.total_activos || 0),
            promedio_retencion: parseFloat(
              Number(dataInst.promedio_retencion || 0).toFixed(2),
            ),
            promedio_asistencia: parseFloat(
              Number(dataInst.promedio_asistencia || 0).toFixed(2),
            ),
            pruebas_asignadas_total: parseInt(
              dataInst.pruebas_asignadas_total || 0,
            ),
            pruebas_convertidas_total: parseInt(
              dataInst.pruebas_convertidas_total || 0,
            ),
            porcentaje_conversion_promedio: parseFloat(
              Number(dataInst.porcentaje_conversion_promedio || 0).toFixed(2),
            ),
          },

          // 4. Objeto Planes
          planes: objetoPlanes,

          // 5. Vida Media
          vida_media_meses: parseFloat(vida_media_meses.toFixed(1)),
          ltv_total_bajas: ltv_total_bajas,
        };
      }),
    );

    res.json({
      evolucionMensual: resultado,
    });
  } catch (error) {
    console.error("Error en obtenerEstadisticasMesConMes:", error);
    res.status(500).json({ message: error.message });
  }
};


export const programarSincronizacionEstadisticasPilatesDiario = () => {
  // Todos los días a las 23:55
  const cronExpresion = "55 23 * * *";

  cron.schedule(cronExpresion, CR_sincronizarEstadisticas, {
    scheduled: true,
    timezone: "America/Argentina/Tucuman",
    name: "sincronizar-estadisticas-pilates-diario",
  });
};

