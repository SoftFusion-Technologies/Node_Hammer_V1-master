/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 06/02/2026
 * Versión: 1.0
 *
 * Descripción:
 * Controlador para la gestión de Cupos con Descuentos en Pilates.
 * - Gestiona estados automáticos (vencido, vigente, programado) según Timezone Arg.
 * - Incluye Cron Job para actualización diaria.
 *
 * Tema: Controladores - Pilates Cupos Descuentos
 * Capa: Backend
 */

import MD_TB_PilatesCuposConDescuentos from "../Models/MD_TB_PilatesCuposConDescuentos.js";
import { Op } from "sequelize";
import cron from 'node-cron'; // Librería para el Cron
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isBetween from 'dayjs/plugin/isBetween.js';

// Configuración de DayJS para Argentina
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

const TIMEZONE_ARG = "America/Argentina/Buenos_Aires";

const PilatesCuposConDescuentosModel =
  MD_TB_PilatesCuposConDescuentos.PilatesCuposConDescuentosModel;

// ==========================================
// FUNCIÓN HELPER (Lógica de Negocio)
// ==========================================
const calcularEstado = (fechaInicio, fechaFin) => {
    // Obtenemos la fecha actual en Argentina (sin hora, solo fecha para comparar días)
    const hoy = dayjs().tz(TIMEZONE_ARG).startOf('day');
    const inicio = dayjs(fechaInicio).tz(TIMEZONE_ARG).startOf('day');
    const fin = dayjs(fechaFin).tz(TIMEZONE_ARG).endOf('day'); // Final del día para incluir el mismo día

    if (hoy.isBefore(inicio)) {
        return 'programado'; // Hoy (9) es antes que Inicio (10)
    } else if (hoy.isAfter(fin)) {
        return 'vencido';    // Hoy (9) es después que Fin (8)
    } else {
        return 'vigente';    // Está comprendido (inclusive)
    }
};

// ==========================================
// CRON JOB: Se ejecuta todos los días a las 00:05 AM
// ==========================================
// Nota: Debes llamar a esta función en tu index.js o server.js al iniciar la app
export const iniciarCronEstadosPilates = () => {
    cron.schedule('5 0 * * *', async () => {
        console.log(`[CRON - ${new Date().toISOString()}] Iniciando verificación de estados Pilates...`);
        
        try {
            const descuentos = await PilatesCuposConDescuentosModel.findAll();
            let actualizados = 0;

            for (const descuento of descuentos) {
                const nuevoEstado = calcularEstado(descuento.fecha_inicio, descuento.fecha_fin);
                
                // Solo actualizamos si el estado cambió para no saturar la DB
                if (descuento.estado !== nuevoEstado) {
                    await descuento.update({ estado: nuevoEstado });
                    actualizados++;
                }
            }
            console.log(`[CRON] Verificación finalizada. Registros actualizados: ${actualizados}`);
        } catch (error) {
            console.error("[CRON ERROR] Falló la actualización de estados:", error);
        }
    }, {
        scheduled: true,
        timezone: TIMEZONE_ARG
    });
};


// ==========================================
// CONTROLADORES
// ==========================================

// Obtener todos los descuentos
export const OBRS_PilatesCuposConDescuentos_CTS = async (req, res) => {
  try {
    const { sede_id } = req.query; 

    let whereClause = {};
    if (sede_id) {
      whereClause.sede_id = sede_id;
    }

    const registros = await PilatesCuposConDescuentosModel.findAll({
      where: whereClause,
      order: [["created_at", "DESC"]],
      include: [
        {
          association: "usuario_creador",
          attributes: ["name"],
        },
      ],
    });

    const registrosFormateados = registros.map((registro) => {
      const data = registro.toJSON();
      
      // OPCIONAL: Recálculo en tiempo real (Double Check)
      // Aunque el Cron hace el trabajo, esto asegura consistencia visual al momento de la consulta
      // Si prefieres confiar solo en la DB, puedes quitar estas 3 líneas siguientes.
      const estadoCalculado = calcularEstado(data.fecha_inicio, data.fecha_fin);
      if(data.estado !== estadoCalculado) {
          data.estado = estadoCalculado; // Solo lo cambiamos en la respuesta visual
          // Podríamos hacer un update asíncrono aquí sin await si quisiéramos forzar consistencia
          registro.update({ estado: estadoCalculado }).catch(err => console.error(err));
      }

      return {
        ...data,
        creado_por: data.usuario_creador?.name || null,
        usuario_creador: undefined,
      };
    });

    const ordenar = registrosFormateados.sort((a, b) => {
      const comparacionHora = a.hora.localeCompare(b.hora);
      if (comparacionHora === 0) {
        return new Date(a.created_at) - new Date(b.created_at); // Ojo: usa snake_case si viene del JSON
      }
      return comparacionHora;
    });

    res.json(ordenar);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener un descuento específico por ID
export const OBR_PilatesCuposConDescuentos_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const registro = await PilatesCuposConDescuentosModel.findByPk(id, {
      include: [{ association: "usuario_creador", attributes: ["name"] }],
    });

    if (!registro) {
      return res.status(404).json({ mensajeError: "Regla de descuento no encontrada" });
    }

    const data = registro.toJSON();
    res.json({
      ...data,
      creado_por: data.usuario_creador?.name || null,
      usuario_creador: undefined,
    });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear una nueva regla de descuento
export const CR_PilatesCuposConDescuentos_CTS = async (req, res) => {
  try {
    const {
      sede_id,
      creado_por,
      hora,
      grupo_dias,
      cantidad_cupos,
      valor_descuento,
      fecha_inicio,
      fecha_fin,
    } = req.body;

    // 1. Validaciones básicas
    if (!sede_id || !hora || !grupo_dias || !cantidad_cupos || !valor_descuento || !fecha_fin) {
      return res.status(400).json({
        mensajeError: "Faltan datos obligatorios para crear el descuento.",
      });
    }

    // 2. Procesar porcentaje
    let porcentajeFinal = valor_descuento;
    if (typeof valor_descuento === "string") {
      porcentajeFinal = parseFloat(valor_descuento.replace(",", "."));
    }

    if (isNaN(porcentajeFinal) || porcentajeFinal < 0 || porcentajeFinal > 100) {
      return res.status(400).json({ mensajeError: "El porcentaje de descuento no es válido." });
    }

    // 3. Validar cruce de fechas
    const fechaInicioVerificar = fecha_inicio || new Date(); // Si no envía fecha, es hoy

    const descuentoExistente = await PilatesCuposConDescuentosModel.findOne({
      where: {
        sede_id: sede_id,
        hora: hora,
        grupo_dias: grupo_dias,
        [Op.and]: [
          { fecha_inicio: { [Op.lte]: fecha_fin } },
          { fecha_fin: { [Op.gte]: fechaInicioVerificar } },
        ],
      },
    });

    if (descuentoExistente) {
      return res.status(400).json({
        mensajeError: `Ya existe un descuento para este horario (${hora} - ${grupo_dias}) que coincide con las fechas seleccionadas.`,
      });
    }

    // 4. CALCULAR ESTADO INICIAL
    const estadoInicial = calcularEstado(fechaInicioVerificar, fecha_fin);

    // 5. Crear registro
    const nuevoDescuento = await PilatesCuposConDescuentosModel.create({
      sede_id,
      creado_por,
      hora,
      grupo_dias,
      cantidad_cupos,
      porcentaje_descuento: porcentajeFinal,
      fecha_inicio: fechaInicioVerificar,
      fecha_fin,
      estado: estadoInicial // <--- Insertamos el estado calculado
    });

    res.status(201).json({
      message: "Regla de descuento creada correctamente",
      data: nuevoDescuento,
    });
  } catch (error) {
    console.log("Error al crear descuento:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar una regla de descuento
export const ER_PilatesCuposConDescuentos_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const registro = await PilatesCuposConDescuentosModel.findByPk(id);

    if (!registro) {
      return res.status(404).json({ mensajeError: "Regla de descuento no encontrada" });
    }

    await registro.destroy();
    res.json({ message: "Descuento eliminado correctamente" });
  } catch (error) {
    console.log("Error al eliminar descuento:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar una regla de descuento
export const UR_PilatesCuposConDescuentos_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const datosActualizar = req.body;

    const registro = await PilatesCuposConDescuentosModel.findByPk(id);

    if (!registro) {
      return res.status(404).json({ mensajeError: "Regla de descuento no encontrada" });
    }

    const sedeVerificar = datosActualizar.sede_id || registro.sede_id;
    const horaVerificar = datosActualizar.hora || registro.hora;
    const diasVerificar = datosActualizar.grupo_dias || registro.grupo_dias;
    const inicioVerificar = datosActualizar.fecha_inicio || registro.fecha_inicio;
    const finVerificar = datosActualizar.fecha_fin || registro.fecha_fin;

    // Verificar conflictos
    const conflictoFechas = await PilatesCuposConDescuentosModel.findOne({
      where: {
        id: { [Op.ne]: id },
        sede_id: sedeVerificar,
        hora: horaVerificar,
        grupo_dias: diasVerificar,
        [Op.and]: [
          { fecha_inicio: { [Op.lte]: finVerificar } },
          { fecha_fin: { [Op.gte]: inicioVerificar } },
        ],
      },
    });

    if (conflictoFechas) {
      return res.status(400).json({
        mensajeError: `No se puede actualizar: El horario (${horaVerificar} - ${diasVerificar}) ya tiene un descuento activo en ese rango de fechas.`,
      });
    }

    if (datosActualizar.valor_descuento) {
      let porcentaje = datosActualizar.valor_descuento;
      if (typeof porcentaje === "string") {
        porcentaje = parseFloat(porcentaje.replace(",", "."));
      }
      datosActualizar.porcentaje_descuento = porcentaje;
    }

    // RECALCULAR ESTADO SI CAMBIARON LAS FECHAS
    if (datosActualizar.fecha_inicio || datosActualizar.fecha_fin) {
        datosActualizar.estado = calcularEstado(inicioVerificar, finVerificar);
    }

    await registro.update(datosActualizar);

    res.json({
      message: "Descuento actualizado correctamente",
      data: registro,
    });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};