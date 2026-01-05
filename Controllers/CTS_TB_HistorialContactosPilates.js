/*
 * Autor: Sergio Manrique
 * Fecha de creación: 23-12-2025
 * Controlador: CTS_TB_HistorialContactosPilates
 * Descripción: Gestión de la tabla historial_contactos_pilates y lógica de ausentes.
 */

import { Op } from 'sequelize';
import db from '../DataBase/db.js';
import dayjs from 'dayjs';

// Importamos los modelos
import ClientesPilatesModel from '../Models/MD_TB_ClientesPilates.js';
import InscripcionesPilatesModel from '../Models/MD_TB_InscripcionesPilates.js';
import AsistenciasPilatesModel from '../Models/MD_TB_AsistenciasPilates.js';
import HistorialContactosPilatesModel from '../Models/MD_TB_HistorialContactosPilates.js';
import UsersModel from '../Models/MD_TB_Users.js';
import { HorariosPilatesModel } from '../Models/MD_TB_HorariosPilates.js';

// --------------------------------------------------------------------------------
// 1. DASHBOARD DE AUSENTES (Lógica de negocio y semáforo visual)
// --------------------------------------------------------------------------------
export const OBRS_AlumnosAusentes_Dashboard_CTS = async (req, res) => {
  try {
    const { id_sede } = req.query;

    // 1. Obtener clientes activos con sus inscripciones, asistencias e historial de contactos
    const clientes = await ClientesPilatesModel.findAll({
      where: { estado: 'Plan' },
      attributes: ['id', 'nombre', 'telefono', 'observaciones'],
      include: [
        {
          model: InscripcionesPilatesModel,
          as: 'inscripciones',
          required: true,
          include: [
            {
              model: AsistenciasPilatesModel,
              as: 'asistencias',
              required: true
            },
            {
              // Filtrar por sede si se recibe el parámetro
              model: HorariosPilatesModel,
              as: 'horario',
              where: id_sede ? { id_sede: id_sede } : undefined,
              required: true
            }
          ]
        },
        {
          model: HistorialContactosPilatesModel,
          as: 'historial_contactos',
          required: false
        }
      ]
    });

    // 2. Variables de control y fecha actual
    const listaAusentes = [];
    const hoyDayjs = dayjs();
    const mesActual = hoyDayjs.month();
    const anioActual = hoyDayjs.year();

    for (const cliente of clientes) {
      // 3. Unificar asistencias de todas las inscripciones del cliente en un solo listado
      let todasLasClases = [];
      if (cliente.inscripciones) {
        cliente.inscripciones.forEach((ins) => {
          if (ins.asistencias && ins.asistencias.length > 0) {
            todasLasClases = todasLasClases.concat(ins.asistencias);
          }
        });
      }

      // 4. Filtrar solo clases pasadas (ayer hacia atrás) y ordenar por fecha reciente
      todasLasClases = todasLasClases
        .filter((clase) => dayjs(clase.fecha).isBefore(hoyDayjs, 'day'))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      // 5. Contar el total histórico de inasistencias acumuladas
      let totalHistoricoAusencias = 0;
      for (const asistencia of todasLasClases) {
        if (!asistencia.presente) {
          totalHistoricoAusencias++;
        }
      }

      // 6. Regla de negocio: Solo procesar si el alumno tiene 2 o más faltas en total
      if (totalHistoricoAusencias >= 2) {
        let ultimoContactoFecha = null;
        let totalContactos = 0;
        let contactoRealizadoValor = 0;
        let contactoRealizadoTexto = null;
        let contactadoEsteMes = false;
        
        // --- NUEVO: Variable para detectar estado de espera ---
        let estaEsperandoRespuesta = false;

        // 7. Analizar el historial de contactos para ver el último registro
        if (
          cliente.historial_contactos &&
          cliente.historial_contactos.length > 0
        ) {
          // Ordenar para obtener el contacto más reciente primero
          cliente.historial_contactos.sort(
            (a, b) => new Date(b.fecha_contacto) - new Date(a.fecha_contacto)
          );

          const registroReciente = cliente.historial_contactos[0];
          totalContactos = cliente.historial_contactos.length;
          ultimoContactoFecha = registroReciente.fecha_contacto;
          contactoRealizadoTexto = registroReciente.contacto_realizado;
          
          // Capturamos el flag de la base de datos
          estaEsperandoRespuesta = registroReciente.esperando_respuesta;

          // Convertir a número para comparar con las ausencias actuales
          contactoRealizadoValor = parseInt(
            registroReciente.contacto_realizado || 0,
            10
          );

          // Verificar si ya fue contactado en el mes en curso
          const fechaUltimo = dayjs(ultimoContactoFecha);
          if (
            fechaUltimo.month() === mesActual &&
            fechaUltimo.year() === anioActual
          ) {
            contactadoEsteMes = true;
          }
        }

        // 8. Lógica del Semáforo: Comparar faltas actuales vs faltas que tenía al ser contactado
        // Si sumó más de 1 falta nueva desde el último contacto, va a ROJO
        const diferencia = totalHistoricoAusencias - contactoRealizadoValor;
        let estadoVisualCalculado = diferencia > 1 ? 'ROJO' : 'VERDE';

        // SI ESTA EN ESPERA, FORZAMOS EL ESTADO VISUAL A AMARILLO (Prioridad)
        if (estaEsperandoRespuesta) {
            estadoVisualCalculado = 'AMARILLO';
        }

        // 9. Construir el objeto del alumno para el listado final
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
          racha_actual: totalHistoricoAusencias,
          esperando_respuesta: estaEsperandoRespuesta // Enviamos el dato crudo también
        });
      }
    }
    // 10. Ordenar por los que tiene más inasistencias acumuladas
    listaAusentes.sort((a, b) => b.racha_actual - a.racha_actual);
    
    // 11. Ordenar la lista final para mostrar ROJOS primero, luego AMARILLOS, luego VERDES
    listaAusentes.sort((a, b) => {
        const prioridad = { 'ROJO': 3, 'AMARILLO': 2, 'VERDE': 1 };
        const pA = prioridad[a.estado_visual] || 0;
        const pB = prioridad[b.estado_visual] || 0;
        return pB - pA;
    });

    // 11. Enviar respuesta al frontend
    res.json(listaAusentes);
  } catch (error) {
    console.error('Error en OBRS_AlumnosAusentes_Dashboard_CTS:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// --------------------------------------------------------------------------------
// 2. CREAR (Registrar nuevo contacto)
// --------------------------------------------------------------------------------
export const CR_HistorialContacto_CTS = async (req, res) => {
  try {
    const { id_cliente, id_usuario, observacion, contacto_realizado, esperando_respuesta } =
      req.body;

    if (!id_cliente || !id_usuario || !contacto_realizado) {
      return res.status(400).json({ mensajeError: 'Faltan datos requeridos' });
    }

    // --- MODIFICACIÓN: Si NO está esperando respuesta, la observación es obligatoria.
    // Si SI está esperando respuesta, podemos permitir que la observación venga vacía y ponemos una automática.
    
    let observacionFinal = observacion ? observacion.trim().toUpperCase() : "";

    if (esperando_respuesta) {
        // Si no escribió nada pero marcó espera, ponemos un texto por defecto
        if (observacionFinal === '') {
            observacionFinal = "PENDIENTE: ESPERANDO RESPUESTA DEL CLIENTE";
        }
    } else {
        // Comportamiento normal: requiere texto
        if (observacionFinal === '') {
            return res
              .status(400)
              .json({ mensajeError: 'La observación es obligatoria para cerrar una gestión.' });
        }
    }

    if (observacionFinal.length > 255) {
      return res.status(400).json({
        mensajeError: 'La observación no puede exceder los 255 caracteres.'
      });
    }

    const nuevoContacto = await HistorialContactosPilatesModel.create({
      id_cliente: Number(id_cliente),
      id_usuario: Number(id_usuario),
      observacion: observacionFinal,
      fecha_contacto: new Date(),
      contacto_realizado: contacto_realizado.trim().toUpperCase(),
      esperando_respuesta: esperando_respuesta || false
    });

    res.status(201).json({
      success: true,
      message: 'Contacto registrado correctamente.',
      data: nuevoContacto
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
          as: 'usuario',
          attributes: ['name'] 
        }
      ],
      order: [['fecha_contacto', 'DESC']]
    });

    res.json(historial);
  } catch (error) {
    console.error("Error en OBR_HistorialContacto:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};


// --------------------------------------------------------------------------------
// 4. ACTUALIZAR (Modificar un registro del historial)
// --------------------------------------------------------------------------------
export const UR_HistorialContacto_CTS = async (req, res) => {
  try {
    const { id } = req.params; // ID del registro de historial
    const { observacion, esperando_respuesta } = req.body;

    // Buscar el registro
    const contacto = await HistorialContactosPilatesModel.findByPk(id);

    if (!contacto) {
      return res
        .status(404)
        .json({ mensajeError: 'El registro de historial no existe.' });
    }
    
    // Si mandan observación, validamos
    if (observacion !== undefined) {
        if (observacion.trim() === '') {
            return res.status(400).json({ mensajeError: 'La observación no puede estar vacía.' });
        }
        if (observacion.length > 255) {
             return res.status(400).json({ mensajeError: "La observación no puede exceder los 255 caracteres." });
        }
        contacto.observacion = observacion.trim().toUpperCase();
    }

    // Actualizamos el estado si viene
    if (esperando_respuesta !== undefined) {
        contacto.esperando_respuesta = esperando_respuesta;
    }

    await contacto.save();

    res.json({
      success: true,
      message: 'Historial modificado correctamente.',
      data: contacto
    });
  } catch (error) {
    console.error('Error en UR_HistorialContacto_CTS:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// --------------------------------------------------------------------------------
// 5. ELIMINAR (Dar de baja un registro del historial)
// --------------------------------------------------------------------------------
export const ER_HistorialContacto_CTS = async (req, res) => {
  try {
    const { id } = req.params;

    const contacto = await HistorialContactosPilatesModel.findByPk(id);

    if (!contacto) {
      return res
        .status(404)
        .json({ mensajeError: 'El registro de historial no existe.' });
    }

    // Eliminamos el registro
    await contacto.destroy();

    res.json({
      success: true,
      message: 'El registro del historial ha sido eliminado correctamente.'
    });
  } catch (error) {
    console.error('Error en ER_HistorialContacto_CTS:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};