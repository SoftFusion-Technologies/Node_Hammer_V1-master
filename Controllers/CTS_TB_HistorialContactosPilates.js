/*
 * Autor: Sergio Manrique
 * Fecha de creación: 23-12-2025
 * Controlador: CTS_TB_HistorialContactosPilates
 * Descripción: Gestión de la tabla historial_contactos_pilates y lógica de ausentes.
 */

import { Op } from "sequelize";
import db from "../DataBase/db.js";
import dayjs from "dayjs"; 

// Importamos los modelos
import ClientesPilatesModel from "../Models/MD_TB_ClientesPilates.js";
import InscripcionesPilatesModel from "../Models/MD_TB_InscripcionesPilates.js";
import AsistenciasPilatesModel from "../Models/MD_TB_AsistenciasPilates.js";
import HistorialContactosPilatesModel from "../Models/MD_TB_HistorialContactosPilates.js";
import UsersModel from "../Models/MD_TB_Users.js";
import { HorariosPilatesModel } from "../Models/MD_TB_HorariosPilates.js";

// --------------------------------------------------------------------------------
// 1. DASHBOARD DE AUSENTES (Lógica de negocio y semáforo visual)
// --------------------------------------------------------------------------------
export const OBRS_AlumnosAusentes_Dashboard_CTS = async (req, res) => {
  try {
    const { id_sede } = req.query;

    // 1. Obtenemos clientes activos con sus relaciones necesarias
    const clientes = await ClientesPilatesModel.findAll({
      where: { estado: "Plan" },
      attributes: ["id", "nombre", "telefono", "observaciones"],
      include: [
        {
          model: InscripcionesPilatesModel,
          as: "inscripciones",
          required: true,
          include: [
            {
              model: AsistenciasPilatesModel,
              as: "asistencias",
              required: true,
            },
            {
              // Filtramos por sede si viene el parámetro
              model: HorariosPilatesModel,
              as: "horario",
              where: id_sede ? { id_sede: id_sede } : undefined,
              required: true,
            },
          ],
        },
        {
          model: HistorialContactosPilatesModel,
          as: "historial_contactos",
          required: false,
        },
      ],
    });

    const listaAusentes = [];
    const fechaHoy = new Date();
    const mesActual = fechaHoy.getMonth();
    const anioActual = fechaHoy.getFullYear();
    
    // Usamos dayjs para comparaciones de fecha precisas
    const hoyDayjs = dayjs(); 

    for (const cliente of clientes) {
      
      // 2. Unificamos asistencias de todas las inscripciones del cliente
      let todasLasClases = [];
      if (cliente.inscripciones) {
        cliente.inscripciones.forEach((ins) => {
          if (ins.asistencias && ins.asistencias.length > 0) {
            todasLasClases = todasLasClases.concat(ins.asistencias);
          }
        });
      }

      // 3. Filtramos asistencias futuras o del día actual (solo consideramos hasta ayer)
      todasLasClases = todasLasClases.filter(clase => {
          return dayjs(clase.fecha).isBefore(hoyDayjs, 'day');
      });

      // 4. Ordenamos por fecha descendente (la más reciente primero)
      todasLasClases.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      // 5. Calculamos la racha de ausencias consecutivas
      let rachaTotal = 0;
      for (const asistencia of todasLasClases) {
        if (!asistencia.presente) {
            rachaTotal++;
        } else {
            break; // La racha se corta si asistió a clase
        }
      }

      // 6. Aplicamos regla: Solo procesamos si tiene al menos 2 faltas seguidas
      if (rachaTotal >= 2) {
        
        let ultimoContactoFecha = null;
        let totalContactos = 0;
        let contactoRealizadoValor = 0; 
        let contactoRealizadoTexto = null; 
        let contactadoEsteMes = false;

        // Si tiene historial, obtenemos datos del último contacto
        if (cliente.historial_contactos && cliente.historial_contactos.length > 0) {
          
          cliente.historial_contactos.sort(
            (a, b) => new Date(b.fecha_contacto) - new Date(a.fecha_contacto)
          );

          const registroReciente = cliente.historial_contactos[0];
          totalContactos = cliente.historial_contactos.length;
          ultimoContactoFecha = registroReciente.fecha_contacto;
          
          contactoRealizadoTexto = registroReciente.contacto_realizado;
          contactoRealizadoValor = parseInt(registroReciente.contacto_realizado || 0, 10);

          // Verificamos si el contacto corresponde al mes/año actual
          const fechaUltimo = new Date(ultimoContactoFecha);
          if (
            fechaUltimo.getMonth() === mesActual &&
            fechaUltimo.getFullYear() === anioActual
          ) {
            contactadoEsteMes = true;
          }
        }

        // 7. Calculamos estado visual (Semáforo)
        // ROJO: Si acumuló más de 1 falta nueva desde el último contacto
        // VERDE: Si está al día con el seguimiento
        const diferencia = rachaTotal - contactoRealizadoValor;
        const estadoVisualCalculado = diferencia > 1 ? "ROJO" : "VERDE";

        listaAusentes.push({
          id: cliente.id,
          nombre: cliente.nombre,
          telefono: cliente.telefono,
          observaciones_cliente: cliente.observaciones,
          
          estado_visual: estadoVisualCalculado,
          
          contactado_este_mes: contactadoEsteMes,
          ultimo_contacto: ultimoContactoFecha,
          contacto_realizado: contactoRealizadoTexto,
          total_contactos: totalContactos,
          racha_actual: rachaTotal, 
        });
      }
    }

    // 8. Ordenamos la lista final: Prioridad visual a los ROJOS
    listaAusentes.sort((a, b) => {
      if (a.estado_visual === "ROJO" && b.estado_visual === "VERDE") return -1;
      if (a.estado_visual === "VERDE" && b.estado_visual === "ROJO") return 1;
      return 0;
    });

    res.json(listaAusentes);
  } catch (error) {
    console.error("Error en OBRS_AlumnosAusentes_Dashboard_CTS:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// --------------------------------------------------------------------------------
// 2. CREAR (Registrar nuevo contacto)
// --------------------------------------------------------------------------------
export const CR_HistorialContacto_CTS = async (req, res) => {
  try {
    const { id_cliente, id_usuario, observacion, contacto_realizado } =
      req.body;

    if (!id_cliente || !id_usuario || !contacto_realizado) {
      return res.status(400).json({ mensajeError: "Faltan datos requeridos" });
    }

    if (!observacion || observacion.trim() === "") {
      return res
        .status(400)
        .json({ mensajeError: "La observación es obligatoria." });
    }

    if (observacion && observacion.length > 255) {
      return res
        .status(400)
        .json({
          mensajeError: "La observación no puede exceder los 255 caracteres.",
        });
    }

    const nuevoContacto = await HistorialContactosPilatesModel.create({
      id_cliente: Number(id_cliente),
      id_usuario: Number(id_usuario),
      observacion: observacion.trim().toUpperCase(),
      fecha_contacto: new Date(),
      contacto_realizado: contacto_realizado.trim().toUpperCase(),
    });

    res.status(201).json({
      success: true,
      message: "Contacto registrado. El estado se actualizará a VERDE.",
      data: nuevoContacto,
    });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// --------------------------------------------------------------------------------
// 3. LEER (Obtener historial completo de un cliente)
// --------------------------------------------------------------------------------
export const OBR_HistorialContacto_PorIdCliente_CTS = async (req, res) => {
  try {
    const { id } = req.params;

    const historial = await HistorialContactosPilatesModel.findAll({
      where: { id_cliente: id },
      include: [
        {
          model: UsersModel,
          as: "usuario",
          attributes: ["name"],
        },
      ],
      order: [["fecha_contacto", "DESC"]],
    });

    res.json(historial);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
