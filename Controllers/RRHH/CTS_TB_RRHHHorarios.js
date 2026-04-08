/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 08 / 04 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * * Controladores para la gestión de turnos laborales fijos.
 * * Implementa algoritmos de detección de colisiones horarias y superposición de vigencias.
 * * Utiliza transacciones SQL para mantener la integridad al actualizar historiales.
 * Tema: Controladores - RRHH Horarios
 * * Capa: Backend 
 *
 * Nomenclatura: 
 * * OBRS_ obtenerRegistros (Filtrado por sede/usuario/día)
 * * OBRS_ verificarHorariosUsuario (Existencia de carga)
 * * CR_ crearRegistro (Inserción masiva con validación de conflictos)
 * * UR_ actualizarRegistro (Cierre de vigencia anterior y alta de nueva)
 * * ER_ eliminarRegistro (Baja lógica con cierre de fecha)
 */

import dayjs from 'dayjs';
import { Op } from 'sequelize';
import RRHHHorariosModel from '../../Models/RRHH/MD_TB_RRHHHorarios.js';

const esHoraValida = (hora = '') => /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/.test(hora);

const normalizarHora = (hora = '') => {
  if (!hora) return hora;
  return hora.length === 5 ? `${hora}:00` : hora;
};

const esFechaValida = (fecha = '') => /^\d{4}-\d{2}-\d{2}$/.test(fecha);

const rangosSeSuperponen = (inicioA, finA, inicioB, finB) => {
  const finAReal = finA || '9999-12-31';
  const finBReal = finB || '9999-12-31';
  return inicioA <= finBReal && inicioB <= finAReal;
};

const horariosSeSuperponen = (entradaA, salidaA, entradaB, salidaB) => {
  return entradaA < salidaB && salidaA > entradaB;
};

const buscarConflictoHorario = async ({
  usuario_id,
  dia_semana,
  hora_entrada,
  hora_salida,
  fecha_vigencia_desde,
  fecha_vigencia_hasta,
  excluirId
}) => {
  const where = {
    usuario_id: Number(usuario_id),
    dia_semana: Number(dia_semana),
    eliminado: 0
  };

  if (excluirId !== undefined && excluirId !== null) {
    where.id = { [Op.ne]: Number(excluirId) };
  }

  const horariosMismoDia = await RRHHHorariosModel.findAll({ where });

  return horariosMismoDia.find((horarioExistente) => {
    const superponeHora = horariosSeSuperponen(
      hora_entrada,
      hora_salida,
      horarioExistente.hora_entrada,
      horarioExistente.hora_salida
    );

    if (!superponeHora) {
      return false;
    }

    return rangosSeSuperponen(
      fecha_vigencia_desde,
      fecha_vigencia_hasta,
      horarioExistente.fecha_vigencia_desde,
      horarioExistente.fecha_vigencia_hasta
    );
  });
};

const validarPayload = (payload, esActualizacion = false) => {
  const errores = [];

  if (!esActualizacion || payload.usuario_id !== undefined) {
    if (!Number.isInteger(Number(payload.usuario_id)) || Number(payload.usuario_id) <= 0) {
      errores.push('usuario_id es obligatorio y debe ser un número entero positivo');
    }
  }

  if (!esActualizacion || payload.sede_id !== undefined) {
    if (!Number.isInteger(Number(payload.sede_id)) || Number(payload.sede_id) <= 0) {
      errores.push('sede_id es obligatorio y debe ser un número entero positivo');
    }
  }

  if (!esActualizacion || payload.dia_semana !== undefined) {
    const dia = Number(payload.dia_semana);
    if (!Number.isInteger(dia) || dia < 0 || dia > 7) {
      errores.push('dia_semana es obligatorio y debe ser un entero entre 0 y 7');
    }
  }

  if (!esActualizacion || payload.hora_entrada !== undefined) {
    if (!payload.hora_entrada || !esHoraValida(payload.hora_entrada)) {
      errores.push('hora_entrada es obligatoria y debe tener formato HH:mm o HH:mm:ss');
    }
  }

  if (!esActualizacion || payload.hora_salida !== undefined) {
    if (!payload.hora_salida || !esHoraValida(payload.hora_salida)) {
      errores.push('hora_salida es obligatoria y debe tener formato HH:mm o HH:mm:ss');
    }
  }

  if (payload.hora_entrada && payload.hora_salida) {
    const entrada = normalizarHora(payload.hora_entrada);
    const salida = normalizarHora(payload.hora_salida);
    if (entrada >= salida) {
      errores.push('hora_salida debe ser mayor a hora_entrada');
    }
  }

  if (!esActualizacion || payload.fecha_vigencia_desde !== undefined) {
    if (!payload.fecha_vigencia_desde || !esFechaValida(payload.fecha_vigencia_desde)) {
      errores.push('fecha_vigencia_desde es obligatoria y debe tener formato YYYY-MM-DD');
    }
  }

  if (payload.fecha_vigencia_hasta && !esFechaValida(payload.fecha_vigencia_hasta)) {
    errores.push('fecha_vigencia_hasta debe tener formato YYYY-MM-DD');
  }

  if (payload.fecha_vigencia_desde && payload.fecha_vigencia_hasta) {
    if (payload.fecha_vigencia_hasta < payload.fecha_vigencia_desde) {
      errores.push('fecha_vigencia_hasta no puede ser menor a fecha_vigencia_desde');
    }
  }

  return errores;
};

export const OBRS_RRHHHorarios_CTS = async (req, res) => {
  try {
    const { usuario_id, sede_id, dia_semana, incluirEliminados } = req.query;

    const where = {};

    if (incluirEliminados !== '1') {
      where.eliminado = 0;
    }
    if (usuario_id !== undefined) {
      where.usuario_id = Number(usuario_id);
    }
    if (sede_id !== undefined) {
      where.sede_id = Number(sede_id);
    }
    if (dia_semana !== undefined) {
      where.dia_semana = Number(dia_semana);
    }

    const horarios = await RRHHHorariosModel.findAll({
      where,
      order: [
        ['usuario_id', 'ASC'],
        ['dia_semana', 'ASC'],
        ['hora_entrada', 'ASC']
      ]
    });

    return res.json(horarios);
  } catch (error) {
    return res.status(500).json({
      mensajeError: 'Error al obtener horarios RRHH',
      error: error.message
    });
  }
};

export const OBRS_verificarHorariosUsuario_RRHH_CTS = async (req, res) => {
  try {
    const idUsuario = req.query.idUsuario ?? req.params.idUsuario;

    if (!idUsuario) {
      return res.status(400).json({
        mensajeError: 'Debe enviar idUsuario'
      });
    }

    const totalHorarios = await RRHHHorariosModel.count({
      where: {
        usuario_id: Number(idUsuario),
        eliminado: 0
      }
    });

    if (totalHorarios > 0) {
      return res.json({
        tieneHorarios: true,
        cantidadHorarios: totalHorarios
      });
    }

    return res.json({
      tieneHorarios: false,
      cantidadHorarios: 0,
      mensajeError: 'El usuario no tiene horarios cargados'
    });
  } catch (error) {
    return res.status(500).json({
      mensajeError: 'Error al verificar horarios del usuario',
      error: error.message
    });
  }
};

export const OBR_RRHHHorario_CTS = async (req, res) => {
  try {
    const horario = await RRHHHorariosModel.findOne({
      where: {
        id: req.params.id,
        eliminado: {
          [Op.in]: [0, 1]
        }
      }
    });

    if (!horario) {
      return res.status(404).json({ mensajeError: 'Horario RRHH no encontrado' });
    }

    return res.json(horario);
  } catch (error) {
    return res.status(500).json({
      mensajeError: 'Error al obtener horario RRHH',
      error: error.message
    });
  }
};
/* 11. CAMBIO AQUI */
export const CR_RRHHHorario_CTS = async (req, res) => {
  try {
    const esArreglo = Array.isArray(req.body);
    const listadoHorarios = esArreglo ? req.body : [req.body];

    const resultadosExitosos = [];
    const erroresDeValidacion = [];

    const fechaHora = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const hoyFecha = dayjs().format('YYYY-MM-DD'); 

    await RRHHHorariosModel.sequelize.transaction(async (t) => {
      for (const item of listadoHorarios) {
        const payload = {
          usuario_id: item.usuario_id,
          sede_id: item.sede_id,
          dia_semana: item.dia_semana,
          hora_entrada: normalizarHora((item.hora_entrada || '').trim()),
          hora_salida: normalizarHora((item.hora_salida || '').trim()),
          fecha_vigencia_desde: hoyFecha,
          fecha_vigencia_hasta: item.fecha_vigencia_hasta || null
        };

        const errores = validarPayload(payload);
        if (errores.length > 0) {
          erroresDeValidacion.push({ payload, errores });
          continue;
        }

        const conflicto = await buscarConflictoHorario(payload);
        if (conflicto) {
          erroresDeValidacion.push({ payload, mensajeError: 'Conflicto detectado' });
          continue;
        }

        const nuevoHorario = await RRHHHorariosModel.create({
          ...payload,
          created_at: fechaHora,
          updated_at: fechaHora,
          eliminado: 0
        }, { transaction: t });

        resultadosExitosos.push(nuevoHorario);
      }

      if (erroresDeValidacion.length > 0) {
        throw new Error('Validación fallida');
      }
    });

    return res.status(201).json(resultadosExitosos);
  } catch (error) {
    return res.status(500).json({
      mensajeError: 'No se pudieron procesar todos los horarios',
      error: error.message
    });
  }
};
export const UR_RRHHHorario_CTS = async (req, res) => {
  try {
    const horario = await RRHHHorariosModel.findOne({
      where: { id: req.params.id, eliminado: 0 }
    });

    if (!horario) {
      return res.status(404).json({ mensajeError: 'Horario RRHH no encontrado' });
    }

    const payload = {
      usuario_id: req.body.usuario_id,
      sede_id: req.body.sede_id,
      dia_semana: req.body.dia_semana,
      hora_entrada:
        req.body.hora_entrada !== undefined
          ? normalizarHora((req.body.hora_entrada || '').trim())
          : undefined,
      hora_salida:
        req.body.hora_salida !== undefined
          ? normalizarHora((req.body.hora_salida || '').trim())
          : undefined,
      fecha_vigencia_desde: req.body.fecha_vigencia_desde,
      fecha_vigencia_hasta:
        req.body.fecha_vigencia_hasta !== undefined ? req.body.fecha_vigencia_hasta : undefined
    };

    console.log(payload)

    const hoyFecha = dayjs().format('YYYY-MM-DD');
    const fechaHora = dayjs().format('YYYY-MM-DD HH:mm:ss');

    const nuevoHorarioPayload = {
      usuario_id: payload.usuario_id ?? horario.usuario_id,
      sede_id: payload.sede_id ?? horario.sede_id,
      dia_semana: payload.dia_semana ?? horario.dia_semana,
      hora_entrada: payload.hora_entrada ?? horario.hora_entrada,
      hora_salida: payload.hora_salida ?? horario.hora_salida,
      fecha_vigencia_desde: payload.fecha_vigencia_desde ?? hoyFecha,
      fecha_vigencia_hasta:
        payload.fecha_vigencia_hasta !== undefined ? payload.fecha_vigencia_hasta : null
    };

    const errores = validarPayload(nuevoHorarioPayload);

    if (errores.length > 0) {
      return res.status(400).json({
        mensajeError: 'Errores de validación',
        errores
      });
    }

    const conflicto = await buscarConflictoHorario({
      ...nuevoHorarioPayload,
      excluirId: horario.id
    });

    if (conflicto) {
      return res.status(409).json({
        mensajeError: 'Conflicto de horarios: el usuario ya tiene un horario superpuesto para ese día y vigencia',
        error: 'No se puede superponer horarios para el mismo empleado en el mismo día',
        conflicto: {
          id: conflicto.id,
          dia_semana: conflicto.dia_semana,
          hora_entrada: conflicto.hora_entrada,
          hora_salida: conflicto.hora_salida,
          fecha_vigencia_desde: conflicto.fecha_vigencia_desde,
          fecha_vigencia_hasta: conflicto.fecha_vigencia_hasta
        }
      });
    }

    await RRHHHorariosModel.sequelize.transaction(async (transaction) => {
      await horario.update(
        {
          eliminado: 1,
          fecha_vigencia_hasta: hoyFecha,
          updated_at: fechaHora
        },
        { transaction }
      );

      await RRHHHorariosModel.create(
        {
          ...nuevoHorarioPayload,
          eliminado: 0,
          created_at: fechaHora,
          updated_at: fechaHora
        },
        { transaction }
      );
    });

    return res.json({
      message: 'Horario actualizado correctamente con historial',
      horario_anterior_id: horario.id
    });
  } catch (error) {
    console.log('Error en UR_RRHHHorario_CTS:', error);
    return res.status(500).json({
      mensajeError: 'Error al actualizar horario RRHH',
      error: error.message
    });
  }
};

export const ER_RRHHHorario_CTS = async (req, res) => {
  try {
    const horario = await RRHHHorariosModel.findOne({
      where: { id: req.params.id, eliminado: 0 }
    });

    if (!horario) {
      return res.status(404).json({ mensajeError: 'Horario RRHH no encontrado' });
    }

    const hoy = dayjs().format('YYYY-MM-DD');
    const fechaHoraActual = dayjs().format('YYYY-MM-DD HH:mm:ss');

    await horario.update({
      eliminado: 1,
      fecha_vigencia_hasta: hoy,
      updated_at: fechaHoraActual
    });

    return res.json({ 
      message: 'Horario RRHH dado de baja correctamente',
      id_afectado: horario.id,
      vigencia_hasta: hoy
    });
  } catch (error) {
    return res.status(500).json({
      mensajeError: 'Error al eliminar horario RRHH',
      error: error.message
    });
  }
};