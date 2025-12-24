/*
 * Programador: Sergio Manrique
 * Fecha Creación: 08/10/2025
 * Versión: 1.0
 */

import pool from "../DataBase/db.js";
import ClientesPilatesModel from "../Models/MD_TB_ClientesPilates.js";
import InscripcionesPilatesModel from "../Models/MD_TB_InscripcionesPilates.js";
import AsistenciasPilatesModel from "../Models/MD_TB_AsistenciasPilates.js";
import { HorariosPilatesModel } from "../Models/MD_TB_HorariosPilates.js";
import { SedeModel } from "../Models/MD_TB_sedes.js";
import UsuarioPilatesModel from "../Models/MD_TB_UsuariosPilates.js";
import { CR_EventoHistorial_Alta_CTS} from "./CTS_TB_ClientesPilatesHistorial.js";
import { ER_HistorialPorCliente } from "./CTS_TB_ClientesPilatesHistorial.js";
import { Op } from "sequelize";

import { MOVER_ClientePilatesARemarketing } from "./CTS_TB_VentasRemarketing.js";

if (!HorariosPilatesModel.associations?.instructor) {
  HorariosPilatesModel.belongsTo(UsuarioPilatesModel, {
    foreignKey: "id_instructor",
    as: "instructor",
  });
}

// Obtiene los horarios de Pilates por sede, instructor y hora, agrupando LMV/MJ, junto con los alumnos inscriptos y sus detalles.
export const ESP_OBRS_HorarioClientesPilates_CTS = async (req, res) => {
  try {
    // Validaciones de parámetros recibidos
    const { sedeId, instructorId, hhmm } = req.query;

    let cupoMaximoSede = null;
      if (sedeId) {
          const sedeInfo = await SedeModel.findByPk(sedeId);
          if (sedeInfo && sedeInfo.cupo_maximo_pilates) {
              cupoMaximoSede = sedeInfo.cupo_maximo_pilates;
          }
      }
      if(cupoMaximoSede === null){
        throw new Error("No se pudo obtener el cupo máximo de la sede.");
      }

    const isNumeric = (value) => /^\d+$/.test(value);
    const isHHMM = (value) => /^\d{2}:\d{2}$/.test(value);

    if (sedeId && !isNumeric(sedeId)) {
      return res.status(400).json({ mensajeError: "sedeId inválido" });
    }

    if (instructorId && !isNumeric(instructorId)) {
      return res.status(400).json({ mensajeError: "instructorId inválido" });
    }

    if (hhmm && !isHHMM(hhmm)) {
      return res.status(400).json({ mensajeError: "hhmm inválido" });
    }

    // Helpers para normalizar día, agrupar y formatear hora/fecha
    const normalizeDayForGroup = (value) => {
      if (!value) return "";
      return value
        .toString()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toUpperCase();
    };

    const determineGroup = (day) => {
      const normalized = normalizeDayForGroup(day);
      if (["LUNES", "MIERCOLES", "VIERNES"].includes(normalized)) return "LMV";
      if (["MARTES", "JUEVES"].includes(normalized)) return "MJ";
      return "OTRO";
    };

    const formatTime = (timeValue) => {
      if (!timeValue) return "";
      if (typeof timeValue === "string") {
        return timeValue.length >= 5 ? timeValue.slice(0, 5) : timeValue;
      }
      if (timeValue instanceof Date) {
        return timeValue.toISOString().slice(11, 16);
      }
      const asString = String(timeValue);
      return asString.length >= 5 ? asString.slice(0, 5) : asString;
    };

    const toTimeWithSeconds = (value) => {
      if (!value) return null;
      if (typeof value === "string") {
        return value.length === 5 ? `${value}:00` : value;
      }
      if (value instanceof Date) {
        return value.toISOString().slice(11, 19);
      }
      const asString = String(value);
      return asString.length === 5 ? `${asString}:00` : asString;
    };

    const formatDate = (value) => {
      if (!value) return null;
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      const asString = value.toString();
      return asString.length >= 10 ? asString.slice(0, 10) : asString;
    };

    // Construcción de filtros para la consulta de horarios
    const horarioWhere = {};
    if (sedeId) horarioWhere.id_sede = Number(sedeId);
    if (instructorId) horarioWhere.id_instructor = Number(instructorId);
    if (hhmm) horarioWhere.hora_inicio = toTimeWithSeconds(hhmm);

    // Consulta de horarios con sus instructores
    const horarios = await HorariosPilatesModel.findAll({
      where: horarioWhere,
      attributes: [
        "id",
        "id_sede",
        "id_instructor",
        "dia_semana",
        "hora_inicio",
      ],
      include: [
        {
          model: UsuarioPilatesModel,
          as: "instructor",
          attributes: ["id", "nombre", "apellido"],
          required: true,
        },
      ],
      order: [
        [
          pool.literal(
            "FIELD(dia_semana,'LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO')"
          ),
          "ASC",
        ],
        ["hora_inicio", "ASC"],
      ],
    });

    if (horarios.length === 0) {
      return res.json({});
    }

    // Mapas para agrupar horarios y preparar claves
    const horarioKeyMap = new Map();
    const groupKeySet = new Set();
    const horarioIdSet = new Set();
    const sedeIdsSet = new Set();
    const horaInicioSet = new Set();

    const buildGroupKey = (sede, hhmmValue, group) =>
      `${sede}|${hhmmValue}|${group}`;

    for (const horario of horarios) {
      const hhmmValue = formatTime(horario.hora_inicio);
      const dayUpper = (horario.dia_semana ?? "").toString().toUpperCase();
      const group = determineGroup(horario.dia_semana);
      const groupKey = buildGroupKey(horario.id_sede, hhmmValue, group);
      const timeWithSeconds = toTimeWithSeconds(horario.hora_inicio);

      horarioKeyMap.set(horario.id, {
        horarioKey: `${dayUpper}-${hhmmValue}`,
        group,
        hhmm: hhmmValue,
      });
      groupKeySet.add(groupKey);
      horarioIdSet.add(horario.id);
      sedeIdsSet.add(horario.id_sede);
      if (timeWithSeconds) horaInicioSet.add(timeWithSeconds);
    }

    // Consulta de inscripciones relevantes (plan, renovación, prueba)
    const estadosInteres = ["Plan", "Renovacion programada", "Clase de prueba"];

    const inscripciones = await InscripcionesPilatesModel.findAll({
      attributes: ["id", "id_cliente", "id_horario", "fecha_inscripcion"],
      include: [
        {
          model: ClientesPilatesModel,
          as: "cliente",
          attributes: [
            "id",
            "nombre",
            "telefono",
            "estado",
            "fecha_inicio",
            "fecha_fin",
            "observaciones",
            "fecha_prometido_pago",
          ],
          required: true,
        },
        {
          model: HorariosPilatesModel,
          as: "horario",
          attributes: ["id", "id_sede", "dia_semana", "hora_inicio"],
          required: true,
        },
      ],
      where: {
        [Op.and]: [
          { "$cliente.estado$": { [Op.in]: estadosInteres } },
          sedeIdsSet.size
            ? // 1. Buscar inscripciones del cliente
              { "$horario.id_sede$": { [Op.in]: Array.from(sedeIdsSet) } }
            : {},
          horaInicioSet.size
            ? {
                "$horario.hora_inicio$": { [Op.in]: Array.from(horaInicioSet) },
              }
            : {},
        ].filter(Boolean),
        // 2. Eliminar asistencias vinculadas a esas inscripciones
      },
    });

    // Agrupación de inscripciones por grupo y horario
    // 3. Eliminar inscripciones del cliente
    const planGroupMap = new Map();
    const trialMap = new Map();
    // 4. Eliminar el cliente

    for (const inscripcion of inscripciones) {
      const cliente = inscripcion.cliente;
      const horario = inscripcion.horario;
      if (!cliente || !horario) continue;

      const hhmmValue = formatTime(horario.hora_inicio);
      const group = determineGroup(horario.dia_semana);
      const groupKey = buildGroupKey(horario.id_sede, hhmmValue, group);

      if (!groupKeySet.has(groupKey)) {
        continue;
      }

      // Manejo de errores
      const baseCliente = {
        id: cliente.id,
        nombre: cliente.nombre ?? "",
        telefono: cliente.telefono ?? null,
        estado: cliente.estado ?? "",
        fecha_inicio: cliente.fecha_inicio ?? null,
        fecha_fin: cliente.fecha_fin ?? null,
        observaciones: cliente.observaciones ?? "",
        fecha_prometido_pago: cliente.fecha_prometido_pago ?? null,
      };

      const estadoLower = baseCliente.estado.toLowerCase();

      if (estadoLower === "clase de prueba") {
        if (!horarioIdSet.has(horario.id)) continue;
        const currentTrials = trialMap.get(horario.id) ?? [];
        currentTrials.push(baseCliente);
        trialMap.set(horario.id, currentTrials);
        continue;
      }

      if (estadoLower === "plan" || estadoLower === "renovacion programada") {
        const currentPlans = planGroupMap.get(groupKey) ?? [];
        currentPlans.push(baseCliente);
        planGroupMap.set(groupKey, currentPlans);
      }
    }

    // Helper para tipo de grupo en la respuesta
    const planTypeByGroup = (group) => {
      if (group === "LMV") return "L-M-V";
      if (group === "MJ") return "M-J";
      return "Otro";
    };

    // Construcción final del objeto de horarios con alumnos
// ... código anterior ...
    const schedule = {};

    for (const horario of horarios) {
      const keyInfo = horarioKeyMap.get(horario.id);
      if (!keyInfo) continue;

      const { horarioKey, group, hhmm: hhmmValue } = keyInfo;
      const groupKey = buildGroupKey(horario.id_sede, hhmmValue, group);

      const instructor = horario.instructor;
      const coachName = instructor
        ? `${instructor.nombre ?? ""} ${instructor.apellido ?? ""}`.trim()
        : "";
      const coachUpper = coachName ? coachName.toUpperCase() : null;

      // --- CAMBIO PRINCIPAL: UNIFICAR, ORDENAR Y MARCAR ---
      
      let listaUnificada = [];

      // 1. Recopilar Planes
      const planEntries = planGroupMap.get(groupKey) ?? [];
      planEntries.forEach(p => listaUnificada.push({ ...p, tipo: 'plan', sortId: p.id })); 
      // Nota: p.id debe ser el ID de inscripción o algo incremental. 
      // Si p.id es ID de cliente, el orden será por antigüedad de cliente, no de inscripción. 
      // *Idealmente*, en la consulta SQL de arriba deberías traer el ID de la tabla inscripciones_pilates como 'inscripcion_id' y usar ese.
      // Pero si usas 'p.id' (id cliente) ordenará por quien se registró primero en el sistema, lo cual suele ser aceptable.

      // 2. Recopilar Pruebas
      const trialEntries = trialMap.get(horario.id) ?? [];
      trialEntries.forEach(t => listaUnificada.push({ ...t, tipo: 'prueba', sortId: t.id }));

      // 3. Ordenar (FIFO - Primero en llegar, primero en la fila)
      listaUnificada.sort((a, b) => a.sortId - b.sortId);

      const alumnosProcesados = [];

      // 4. Procesar y marcar Sobrecupo
      listaUnificada.forEach((entry, index) => {
        // La magia: Si su posición es mayor al cupo, es extra
        const esExtra = (index + 1) > cupoMaximoSede;

        const estadoLower = (entry.estado ?? "").toLowerCase();
        const fechaInicio = formatDate(entry.fecha_inicio);
        const fechaFin = formatDate(entry.fecha_fin);
        const fechaPrometidoPago = formatDate(entry.fecha_prometido_pago);

        // Construir detalles según tipo
        let planDetails = null;
        let trialDetails = null;
        let scheduledDetails = null;

        if (entry.tipo === 'plan') {
             if(estadoLower === "plan" || estadoLower === "renovacion programada") {
                planDetails = {
                  type: planTypeByGroup(group),
                  startDate: fechaInicio,
                  endDate: fechaFin,
                  promisedDate: fechaPrometidoPago,
                };
             }
             if(estadoLower === "renovacion programada") {
                scheduledDetails = { date: fechaInicio, promisedDate: fechaPrometidoPago };
             }
        } else {
             trialDetails = { date: formatDate(entry.fecha_inicio) };
        }

        alumnosProcesados.push({
          id: entry.id,
          name: (entry.nombre ?? "").toUpperCase(),
          contact: entry.telefono,
          observation: entry.observaciones,
          status: entry.tipo === 'prueba' ? "prueba" : (estadoLower === "renovacion programada" ? "programado" : estadoLower),
          planDetails: planDetails,
          trialDetails: trialDetails,
          scheduledDetails: scheduledDetails,
          
          // NUEVA PROPIEDAD PARA EL FRONT
          es_cupo_extra: esExtra 
        });
      });

      schedule[horarioKey] = {
        coach: coachUpper,
        horarioId: horario.id,
        coachId: instructor?.id ?? null,
        alumnos: alumnosProcesados,
      };
    }

    // Respuesta final con el objeto de horarios y alumnos
    return res.json(schedule);
  } catch (error) {
    // Manejo de errores
    console.error("ESP_OBRS_HorarioClientesPilates_CTS error:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener todos los clientes pilates
// Devuelve el listado completo de clientes Pilates ordenados por ID descendente.
export const OBRS_ClientesPilates_CTS = async (req, res) => {
  try {
    const registros = await ClientesPilatesModel.findAll({
      order: [["id", "DESC"]],
    });

    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener un cliente pilates por ID
// Obtiene los datos de un cliente Pilates por su ID.
export const OBR_ClientesPilates_CTS = async (req, res) => {
  try {
    const registro = await ClientesPilatesModel.findByPk(req.params.id);

    if (!registro) {
      return res.status(404).json({ mensajeError: "Cliente no encontrado" });
    }

    res.json(registro);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear un nuevo cliente pilates
// Crea un nuevo cliente Pilates con los datos recibidos en el cuerpo de la solicitud.
export const CR_ClientesPilates_CTS = async (req, res) => {
  try {
    const {
      nombre,
      telefono,
      estado,
      fecha_inicio,
      fecha_fin,
      observaciones,
      cambios_especificos,
      resumen,
      tipo_evento,
      usuario_id,
    } = req.body;

    if (!nombre) {
      return res.status(400).json({ mensajeError: "El nombre es requerido" });
    }

    if (!telefono) {
      return res.status(400).json({ mensajeError: "El teléfono es requerido" });
    }

    if (!estado) {
      return res.status(400).json({ mensajeError: "El estado es requerido" });
    }

    // Validar valores permitidos para estado
    const estadosPermitidos = [
      "Plan",
      "Clase de prueba",
      "Renovacion programada",
    ];
    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({
        mensajeError:
          "Estado inválido. Valores permitidos: Plan, Clase de prueba, Renovacion programada",
      });
    }

    // Crear el cliente
    const nuevoCliente = await ClientesPilatesModel.create({
      nombre,
      telefono,
      estado,
      fecha_inicio,
      fecha_fin,
      observaciones,
    });

    await CR_EventoHistorial_Alta_CTS({
      cliente_id: nuevoCliente.id,
      tipo_evento: tipo_evento ? tipo_evento : "ALTA",
      usuario_id: usuario_id,
      resumen: resumen || "Alta de nuevo alumno", 
      cambios_especificos,
    });

    res.status(201).json({
      message: "Cliente creado correctamente",
      cliente: nuevoCliente,
    });
  } catch (error) {
    console.error("Error en CR_ClientesPilates_CTS:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar un cliente pilates
// Actualiza los datos de un cliente Pilates existente por su ID.
export const UR_ClientesPilates_CTS = async (req, res) => {
  try {
    const { id } = req.params; // ID del cliente a actualizar
    const {
      nombre,
      apellido,
      telefono,
      estado,
      fecha_inicio,
      fecha_fin,
      observaciones,
    } = req.body;

    // Validaciones básicas
    if (!nombre)
      return res.status(400).json({ mensajeError: "El nombre es requerido" });
    if (!telefono)
      return res.status(400).json({ mensajeError: "El teléfono es requerido" });

    const estadosPermitidos = [
      "Plan",
      "Clase de prueba",
      "Renovacion programada",
    ];
    if (estado && !estadosPermitidos.includes(estado)) {
      return res.status(400).json({
        mensajeError:
          "Estado inválido. Valores permitidos: Plan, Clase de prueba, Renovacion programada, Renovacion reprogramada",
      });
    }

    if (estado === "Renovacion reprogramada") {
      fecha_inicio === undefined;
      fecha_fin === undefined;
    }

    // Buscar cliente existente
    const cliente = await ClientesPilatesModel.findByPk(id);
    if (!cliente)
      return res.status(404).json({ mensajeError: "Cliente no encontrado" });

    // Actualizar solo los campos proporcionados
    await cliente.update({
      nombre: nombre !== undefined ? nombre : cliente.nombre,
      apellido: apellido !== undefined ? apellido : cliente.apellido,
      telefono: telefono !== undefined ? telefono : cliente.telefono,
      estado: estado !== undefined ? estado : cliente.estado,
      fecha_inicio:
        fecha_inicio !== undefined ? fecha_inicio : cliente.fecha_inicio,
      fecha_fin: fecha_fin !== undefined ? fecha_fin : cliente.fecha_fin,
      observaciones:
        observaciones !== undefined ? observaciones : cliente.observaciones,
    });

    res.json({
      message: "Cliente actualizado correctamente",
      cliente,
    });
  } catch (error) {
    console.error("Error en UR_ClientesPilates_CTS:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar solo las observaciones de un cliente Pilates (Uso de PATCH)
// Modifica únicamente el campo 'observaciones' de un cliente Pilates por su ID.
export const UR_ClientesPilates_Observaciones_CTS = async (req, res) => {
  try {
    const { id } = req.params; // ID del cliente a actualizar
    const { observaciones } = req.body; // Solo esperamos el nuevo texto de observación

    // 1. Validación de datos esenciales
    if (observaciones === undefined) {
      return res
        .status(400)
        .json({ mensajeError: "El campo 'observaciones' es requerido" });
    }

    // 2. Buscar cliente existente
    const cliente = await ClientesPilatesModel.findByPk(id);

    if (!cliente) {
      return res.status(404).json({ mensajeError: "Cliente no encontrado" });
    }

    // 3. Actualizar solo el campo 'observaciones'
    // Sequelize actualizará solo los campos que están en el objeto pasado.
    const [affectedRows] = await ClientesPilatesModel.update(
      { observaciones: observaciones },
      {
        where: { id: id },
      }
    );

    if (affectedRows === 0) {
      // Esto solo ocurriría si el cliente existía (findByPk lo confirmó)
      // pero la actualización falló por alguna razón (ej. bloqueo de tabla),
      // aunque es poco probable con findByPk previo.
      return res
        .status(500)
        .json({ mensajeError: "La actualización de observaciones falló." });
    }

    // 4. Obtener el cliente actualizado para la respuesta
    const clienteActualizado = await ClientesPilatesModel.findByPk(id, {
      attributes: ["id", "nombre", "observaciones"], // Devolver solo campos relevantes
    });

    res.json({
      message: "Observaciones actualizadas correctamente",
      cliente: clienteActualizado,
    });
  } catch (error) {
    console.error("Error en UR_ClientesPilates_Observaciones_CTS:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};

export const UR_ClientesPilates_PlanRenovacion_CTS = async (req, res) => {
  try {
    // La ruta define :id en routes.js
    const { id } = req.params;
    const {
      estado,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      observaciones,
      fecha_prometido_pago: fechaPrometidoPago,
      nombre,
      telefono,
    } = req.body;

    // Buscar al cliente por ID
    const cliente = await ClientesPilatesModel.findByPk(id);

    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    // Construir objeto de actualización
    const updates = {};

    // 1. Manejar los campos que se actualizan siempre, como las observaciones
    if (observaciones !== undefined || nombre !== undefined || telefono !== undefined) {
      updates.observaciones = observaciones;
      updates.nombre = nombre;
      updates.telefono = telefono;
    }

    // 2. Manejar la lógica de estados de forma separada
    if (estado === "Reprogramado") {
      // CASO A: Es una "Reprogramación"
      // El estado NO cambia, solo se actualiza la fecha de pago prometida.
      updates.fecha_prometido_pago = fechaPrometidoPago || null;
    } else if (estado === "Renovacion programada") {
      // CASO B: Se está pasando de "Plan" -> "Renovacion programada"
      updates.estado = "Renovacion programada";
      updates.fecha_prometido_pago = fechaPrometidoPago || null;
      // No tocamos fecha_inicio ni fecha_fin, preservamos las del plan anterior
    } else if (estado === "Plan") {
      // CASO C: Se está pasando de "Renovacion programada" -> "Plan"
      updates.estado = "Plan";
      updates.fecha_inicio = fechaInicio || null;
      updates.fecha_fin = fechaFin || null;
      updates.fecha_prometido_pago = null; // Limpiamos la fecha prometida
    }

    console.log("Actualizaciones a aplicar:", updates);

    // Actualizar cliente
    await cliente.update(updates);

    res.json({
      message: "Estado del cliente actualizado correctamente",
      cliente,
    });
  } catch (error) {
    console.error("Error en UR_ClientesPilates_PlanRenovacion_CTS:", error);
    res.status(500).json({ message: "Error actualizando el cliente", error });
  }
};


// Eliminar un cliente pilates y sus inscripciones/asistencias en cascada
// Elimina un cliente Pilates y todas sus inscripciones y asistencias asociadas (eliminación en cascada).
export const ER_ClienteConInscripciones_CTS = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Buscar inscripciones del cliente
    const inscripciones = await InscripcionesPilatesModel.findAll({
      where: { id_cliente: id },
      attributes: ["id"],
    });
    const inscripcionesIds = inscripciones.map((i) => i.id);

    // 2. Eliminar asistencias vinculadas a esas inscripciones
    if (inscripcionesIds.length > 0) {
      await AsistenciasPilatesModel.destroy({
        where: { id_inscripcion: inscripcionesIds },
      });
    }

    // 3. Eliminar inscripciones del cliente
    await InscripcionesPilatesModel.destroy({ where: { id_cliente: id } });

    // 4. Eliminar el cliente
    const cliente = await ClientesPilatesModel.findByPk(id);
    if (!cliente) {
      return res
        .status(404)
        .json({ success: false, message: "Cliente no encontrado" });
    }

    await ER_HistorialPorCliente(id);
    await cliente.destroy();

    res.json({
      success: true,
      message: "Cliente, inscripciones y asistencias eliminados correctamente",
      id,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Buscar clientes por nombre, apellido o teléfono
// Busca clientes Pilates por nombre, apellido o teléfono usando coincidencia parcial.
export const BUSCAR_ClientesPilates_CTS = async (req, res) => {
  try {
    const { busqueda } = req.query;

    // Validación de parámetro de búsqueda
    if (!busqueda) {
      return res
        .status(400)
        .json({ mensajeError: "Parámetro de búsqueda requerido" });
    }

    // Consulta por coincidencia parcial en nombre, apellido o teléfono
    const registros = await ClientesPilatesModel.findAll({
      where: {
        [pool.Sequelize.Op.or]: [
          {
            nombre: {
              [pool.Sequelize.Op.like]: `%${busqueda}%`,
            },
          },
          {
            apellido: {
              [pool.Sequelize.Op.like]: `%${busqueda}%`,
            },
          },
          {
            telefono: {
              [pool.Sequelize.Op.like]: `%${busqueda}%`,
            },
          },
        ],
      },
      order: [
        ["nombre", "ASC"],
        ["apellido", "ASC"],
      ],
    });

    res.json(registros);
  } catch (error) {
    // Manejo de errores
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener clientes por estado
// Devuelve los clientes Pilates filtrados por estado (Plan, Clase de prueba, Renovacion programada).
export const OBRS_ClientesPorEstado_CTS = async (req, res) => {
  try {
    const { estado } = req.params;

    // Validación de estado permitido
    const estadosPermitidos = [
      "Plan",
      "Clase de prueba",
      "Renovacion programada",
    ];
    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({
        mensajeError:
          "Estado inválido. Valores permitidos: Plan, Clase de prueba, Renovacion programada",
      });
    }

    // Consulta de clientes por estado
    const registros = await ClientesPilatesModel.findAll({
      where: { estado },
      order: [
        ["nombre", "ASC"],
        ["apellido", "ASC"],
      ],
    });

    res.json(registros);
  } catch (error) {
    // Manejo de errores
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener clientes con planes próximos a vencer
// Obtiene los clientes Pilates cuyo plan está próximo a vencer en los próximos días.
export const OBRS_ClientesProximosVencer_CTS = async (req, res) => {
  try {
    const { dias = 7 } = req.query; // Por defecto 7 días

    // Calcula la fecha límite para vencimiento
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + parseInt(dias));

    // Consulta de clientes cuyo plan vence antes de la fecha límite
    const registros = await ClientesPilatesModel.findAll({
      where: {
        estado: "Plan",
        fecha_fin: {
          [pool.Sequelize.Op.lte]: fechaLimite.toISOString().split("T")[0],
        },
      },
      order: [["fecha_fin", "ASC"]],
    });

    res.json(registros);
  } catch (error) {
    // Manejo de errores
    res.status(500).json({ mensajeError: error.message });
  }
};


// Obtener horarios disponibles with cupo e inscriptos por sede para el apartado de ventas, así sepan cuántos lugares quedan en cada horario y grupo
// Devuelve los horarios disponibles por sede, agrupando LMV/MJ, con cupo y cantidad de inscriptos para ventas.
export const ESP_OBRS_HorariosDisponibles_CTS = async (req, res) => {
  try {
    const { sedeId } = req.query;
    if (!sedeId || !/^\d+$/.test(sedeId)) {
      return res
        .status(400)
        .json({ mensajeError: "sedeId requerido y debe ser numérico" });
    }

    const sede = await SedeModel.findByPk(sedeId, {
      attributes: ["id", "cupo_maximo_pilates"],
    });

    if (!sede) {
      return res.status(404).json({ mensajeError: "Sede no encontrada" });
    }

    const normalizeDay = (value) => {
      if (!value) return "";
      return value
        .toString()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toUpperCase();
    };

    const determineGroup = (day) => {
      const normalized = normalizeDay(day);
      if (["LUNES", "MIERCOLES", "VIERNES"].includes(normalized)) return "LMV";
      if (["MARTES", "JUEVES"].includes(normalized)) return "MJ";
      return "OTRO";
    };

    const formatTime = (timeValue) => {
      if (!timeValue) return "";
      if (typeof timeValue === "string") return timeValue.slice(0, 5);
      if (timeValue instanceof Date)
        return timeValue.toISOString().slice(11, 16);
      const asString = String(timeValue);
      return asString.length >= 5 ? asString.slice(0, 5) : asString;
    };

    const groupLabels = {
      LMV: "Lunes-Miercoles-Viernes",
      MJ: "Martes-Jueves",
      OTRO: "Otro",
    };

    const allowedGroups = new Set(["LMV", "MJ"]);
    const sedeCupo = Number(sede.cupo_maximo_pilates ?? 0);
    const resultsMap = new Map();
    const horarioKeyById = new Map();

    const ensureEntry = (grp, hhmm) => {
      if (!allowedGroups.has(grp)) return null;
      const key = `${grp}|${hhmm}`;
      if (!resultsMap.has(key)) {
        resultsMap.set(key, {
          hhmm,
          grp,
          grupo_label: groupLabels[grp] ?? grp,
          cupo_por_clase: sedeCupo,
          total_inscriptos: 0,
        });
      }
      return resultsMap.get(key);
    };

    const horarios = await HorariosPilatesModel.findAll({
      where: { id_sede: sedeId },
      attributes: ["id", "dia_semana", "hora_inicio"],
    });

    for (const horario of horarios) {
      const grp = determineGroup(horario.dia_semana);
      const hhmm = formatTime(horario.hora_inicio);
      const entry = ensureEntry(grp, hhmm);
      if (!entry) continue;
      const key = `${grp}|${hhmm}`;
      horarioKeyById.set(horario.id, key);
    }

    const fetchInscripcionesByEstados = async (estados) =>
      InscripcionesPilatesModel.findAll({
        attributes: ["id"],
        include: [
          {
            model: ClientesPilatesModel,
            as: "cliente",
            attributes: ["estado"],
            where: {
              estado: {
                [Op.in]: estados,
              },
            },
            required: true,
          },
          // Busca si existe un cliente en estado "Clase de prueba" con ese nombre
          {
            model: HorariosPilatesModel,
            as: "horario",
            attributes: ["id", "dia_semana", "hora_inicio", "id_sede"],
            where: { id_sede: sedeId },
            required: true,
          },
        ],
      });
    // Manejo de errores

    const planYRenovaciones = await fetchInscripcionesByEstados([
      "Plan",
      "Renovacion programada",
    ]);
    const pruebas = await fetchInscripcionesByEstados(["Clase de prueba"]);

    const accumulateInscripciones = (inscripciones) => {
      for (const inscripcion of inscripciones) {
        const horario = inscripcion.horario;
        if (!horario) continue;

        let key = horarioKeyById.get(horario.id);
        let entry = key ? resultsMap.get(key) : null;

        if (!entry) {
          const grp = determineGroup(horario.dia_semana);
          const hhmm = formatTime(horario.hora_inicio);
          entry = ensureEntry(grp, hhmm);
          if (!entry) continue;
          key = `${grp}|${hhmm}`;
          horarioKeyById.set(horario.id, key);
        }

        entry.total_inscriptos += 1;
      }
    };

    accumulateInscripciones(planYRenovaciones);
    accumulateInscripciones(pruebas);

    const groupOrder = {
      LMV: 0,
      MJ: 1,
      OTRO: 2,
    };

    const result = Array.from(resultsMap.values()).sort((a, b) => {
      const groupDiff = (groupOrder[a.grp] ?? 99) - (groupOrder[b.grp] ?? 99);
      if (groupDiff !== 0) return groupDiff;
      return a.hhmm.localeCompare(b.hhmm);
    });

    return res.json(result);
  } catch (error) {
    console.error("ESP_OBRS_HorariosDisponibles_CTS error:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

// Verifica si existe un cliente Pilates en estado "Clase de prueba" por nombre (para evitar duplicados).
export const EXISTE_ClientePruebaPorNombre_CTS = async (req, res) => {
  try {
    const { nombre } = req.query;
    if (!nombre || typeof nombre !== "string" || nombre.trim() === "") {
      return res
        .status(400)
        .json({ existe: false, mensajeError: "Nombre requerido" });
    }

    const cliente = await ClientesPilatesModel.findOne({
      where: {
        nombre: { [Op.like]: `%${nombre.trim()}%` },
        estado: { [Op.in]: ["Clase de prueba", "Renovacion programada"] },
      },
    });

    if (cliente) {
      return res.json({ existe: true, id: cliente.id });
    } else {
      return res.json({ existe: false });
    }
  } catch (error) {
    return res.status(500).json({ existe: false, mensajeError: error.message });
  }
};
