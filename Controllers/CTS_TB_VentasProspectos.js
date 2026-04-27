/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 15 / 06 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (CTS_TB_VentasProspectos.js) contiene controladores para manejar operaciones CRUD sobre la tabla ventas_prospectos.
 *
 * Tema: Controladores - Ventas Prospectos
 *
 * Capa: Backend
 */

// Importar modelo
import MD_TB_VentasProspectos from '../Models/MD_TB_ventas_prospectos.js';
const { VentasProspectosModel } = MD_TB_VentasProspectos;
import MD_TB_VentasProspectosHorarios from '../Models/MD_TB_VentasProspectosHorarios.js';
const { VentasProspectosHorariosModel } = MD_TB_VentasProspectosHorarios;

import UserModel from '../Models/MD_TB_Users.js';
import { Op, fn, col } from 'sequelize';
import { VentasComisionesModel } from '../Models/MD_TB_ventas_comisiones.js';
import db from '../DataBase/db.js';

// Benjamin Orellana - 2026/04/17 - Imports para el registro público de visitas y clases de prueba.
import { QueryTypes } from 'sequelize';
import { AlumnosModel } from '../Models/MD_TB_Alumnos.js';
import { AgendasModel } from '../Models/MD_TB_Agendas.js';

// Benjamin Orellana - 2026/04/20 - Imports para la rama especial de Pilates dentro del registro público.
import ClientesPilatesModel from '../Models/MD_TB_ClientesPilates.js';

import MD_TB_HorariosPilates from '../Models/MD_TB_HorariosPilates.js';
const { HorariosPilatesModel } = MD_TB_HorariosPilates;

import InscripcionesPilatesModel from '../Models/MD_TB_InscripcionesPilates.js';

// Benjamin Orellana - 2026/04/21 - Se importa el servicio aislado de mails de prospectos para enviar confirmaciones sin afectar Débitos Automáticos.
import { enviarConfirmacionProspectoEmail } from '../Services/VentasProspectos/EnviarConfirmacionProspectoEmailService.js';

// Benjamin Orellana - 2026/04/17 - Catálogos válidos para el registro público de prospectos.
const TIPOS_LINK_VALIDOS = ['Visita programada', 'Clase de prueba'];
const ACTIVIDADES_VALIDAS = [
  'No especifica',
  'Musculacion',
  'Pilates',
  'Clases grupales',
  'Pase full'
];
const SEDES_VALIDAS = [
  'monteros',
  'concepcion',
  'barrio sur',
  'barrio norte',
  'yerba buena - aconquija 2044'
];

// Benjamin Orellana - 2026/04/17 - Normaliza textos simples recibidos desde el formulario público.
const normalizarTexto = (valor) => {
  if (valor === undefined || valor === null) return '';
  return String(valor).trim();
};

// Benjamin Orellana - 2026/04/20 - Normaliza texto simple para comparar días de Pilates sin depender de mayúsculas o acentos.
const normalizarTextoComparacion = (valor) =>
  String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// Benjamin Orellana - 2026/04/17 - Interpreta booleanos desde distintos formatos del frontend.
const normalizarBoolean = (valor) => {
  if (valor === true || valor === 1 || valor === '1') return true;
  if (typeof valor === 'string') {
    const v = valor.trim().toLowerCase();
    return v === 'true' || v === 'si' || v === 'sí';
  }
  return false;
};

// Benjamin Orellana - 2026/04/17 - Arma un DATETIME MySQL seguro a partir de fecha y hora.
const construirFechaHoraMySQL = (fecha, hora) => {
  const fechaNormalizada = normalizarTexto(fecha);
  let horaNormalizada = normalizarTexto(hora);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNormalizada)) {
    return null;
  }

  if (/^\d{2}:\d{2}$/.test(horaNormalizada)) {
    horaNormalizada = `${horaNormalizada}:00`;
  }

  if (!/^\d{2}:\d{2}:\d{2}$/.test(horaNormalizada)) {
    return null;
  }

  return `${fechaNormalizada} ${horaNormalizada}`;
};

// Benjamin Orellana - 2026/04/17 - Convierte una fecha YYYY-MM-DD al esquema 1=Lunes, 7=Domingo usado por rrhh_horarios.
const obtenerDiaSemanaRRHH = (fecha) => {
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;

  const day = d.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
  return day === 0 ? 7 : day;
};

// Benjamin Orellana - 2026/04/17 - Extrae mes y año operativos desde la fecha elegida por el prospecto.
const obtenerMesAnio = (fecha) => {
  const partes = normalizarTexto(fecha).split('-');
  if (partes.length !== 3) return { mes: null, anio: null };

  const anio = Number(partes[0]);
  const mes = Number(partes[1]);

  if (!anio || !mes) return { mes: null, anio: null };
  return { mes, anio };
};

// Benjamin Orellana - 2026/04/20 - Convierte la fecha seleccionada al enum de día usado por horarios_pilates.
const obtenerDiaSemanaPilates = (fecha) => {
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;

  const dias = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miercoles',
    'Jueves',
    'Viernes',
    'Sabado'
  ];

  return dias[d.getDay()] || null;
};

// Benjamin Orellana - 2026/04/20 - Suma días a una fecha YYYY-MM-DD para construir fecha_fin de la prueba en Pilates.
const sumarDiasFechaISO = (fecha, dias) => {
  const base = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(base.getTime())) return null;

  base.setDate(base.getDate() + dias);
  return base.toISOString().split('T')[0];
};

// Obtener todos los registros (puede filtrar por usuario_id o sede)
export const OBRS_VentasProspectos_CTS = async (req, res) => {
  const { usuario_id, sede } = req.query;
  const mes = req.query.mes ? Number(req.query.mes) : null;
  const anio = req.query.anio ? Number(req.query.anio) : null;

  try {
    let whereClause = {};

    if (usuario_id) whereClause.usuario_id = usuario_id;
    if (sede) whereClause.sede = sede;

    if (mes && anio) {
      whereClause[Op.and] = [
        db.where(fn('MONTH', col('fecha')), mes),
        db.where(fn('YEAR', col('fecha')), anio)
      ];
    }

    const registros = await VentasProspectosModel.findAll({
      where: whereClause,
      order: [['fecha', 'ASC']]
    });

    res.json(registros);
  } catch (error) {
    console.error('Error en OBRS_VentasProspectos_CTS:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// =======================================================
//  HECHO POR SERGIO MANRIQUE, FECHA: 12/01/2026
//  INICIO DE MODULO
// =======================================================
// Obtener prospectos no convertidos de la última semana del mes anterior
export const OBRS_VentasProspectosUltimaSemanaMesAnterior_CTS = async (
  _req,
  res
) => {
  try {
    const hoy = new Date();

    // Calcular mes anterior
    let targetYear = hoy.getFullYear();
    let targetMonthIndex = hoy.getMonth() - 1; // 0-based
    if (targetMonthIndex < 0) {
      targetMonthIndex = 11;
      targetYear -= 1;
    }

    // Último día del mes anterior
    const lastDay = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
    const startDate = new Date(
      targetYear,
      targetMonthIndex,
      Math.max(1, lastDay - 6),
      0,
      0,
      0,
      0
    );
    const endDate = new Date(
      targetYear,
      targetMonthIndex,
      lastDay,
      23,
      59,
      59,
      999
    );

    const registros = await VentasProspectosModel.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              { convertido: 0 },
              { convertido: false },
              { convertido: null }
            ]
          },
          {
            fecha: {
              [Op.between]: [startDate, endDate]
            }
          }
        ]
      },
      order: [['fecha', 'ASC']]
    });

    res.json(registros);
  } catch (error) {
    console.error(
      'Error en OBRS_VentasProspectosUltimaSemanaMesAnterior_CTS:',
      error
    );
    res.status(500).json({ mensajeError: error.message });
  }
};
// =======================================================
//  HECHO POR SERGIO MANRIQUE, FECHA: 12/01/2026
//  FIN DE MODULO
// =======================================================

// Obtener un solo prospecto por ID
export const OBR_VentasProspecto_CTS = async (req, res) => {
  try {
    const prospecto = await VentasProspectosModel.findByPk(req.params.id);
    if (!prospecto)
      return res.status(404).json({ mensajeError: 'Prospecto no encontrado' });
    res.json(prospecto);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear un nuevo prospecto
export const CR_VentasProspecto_CTS = async (req, res) => {
  const {
    usuario_id,
    nombre,
    dni,
    tipo_prospecto,
    canal_contacto,
    campania_origen, // <--- AGREGAR AQUÍ
    contacto,
    actividad,
    sede,
    observacion
  } = req.body;

  if (
    !usuario_id ||
    !nombre ||
    !tipo_prospecto ||
    !canal_contacto ||
    !actividad ||
    !sede
  ) {
    return res.status(400).json({
      mensajeError: 'Faltan datos obligatorios para crear el prospecto'
    });
  }

  // Validación PRO: si es campaña, debe venir el origen
  if (canal_contacto === 'Campaña' && !campania_origen) {
    return res.status(400).json({
      mensajeError: 'Debe especificar el origen de la campaña'
    });
  }

  try {
    const usuario = await UserModel.findByPk(usuario_id);
    if (!usuario)
      return res.status(404).json({ mensajeError: 'Usuario no válido' });

    // Validación de sede: solo puede crear en su sede
    // if (usuario.sede !== sede) {
    //   return res
    //     .status(403)
    //     .json({ mensajeError: 'No puede crear prospectos en otra sede' });
    // }

    const nuevoProspecto = await VentasProspectosModel.create({
      usuario_id,
      nombre,
      dni,
      tipo_prospecto,
      canal_contacto,
      campania_origen: canal_contacto === 'Campaña' ? campania_origen : '', // <--- AGREGAR AQUÍ
      contacto,
      actividad,
      sede,
      asesor_nombre: usuario.name,
      n_contacto_1: 1,
      observacion
    });

    res.json({
      message: 'Prospecto creado correctamente',
      data: nuevoProspecto
    });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar un prospecto (para editar nombre, dni, contacto, etc.)
export const UR_VentasProspecto_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const id = Number(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido' });
    }

    const prospecto = await VentasProspectosModel.findByPk(id, {
      transaction: t
    });
    if (!prospecto) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Prospecto no encontrado' });
    }

    // 🔒 Lista blanca (NO incluimos comision_estado ni comision_id: se gestionan en el módulo de comisiones)
    const ALLOWED = new Set([
      'usuario_id',
      'nombre',
      'dni',
      'tipo_prospecto',
      'canal_contacto',
      'contacto',
      'actividad',
      'sede',
      'fecha',
      'asesor_nombre',
      'n_contacto_1',
      'n_contacto_2',
      'n_contacto_3',
      'clase_prueba_1_fecha',
      'clase_prueba_1_obs',
      'clase_prueba_1_tipo',
      'clase_prueba_2_fecha',
      'clase_prueba_2_obs',
      'clase_prueba_2_tipo',
      'clase_prueba_3_fecha',
      'clase_prueba_3_obs',
      'clase_prueba_3_tipo',
      'convertido',
      'observacion',
      'campania_origen',
      // ⚠️ Solo permitimos bajar comision (false) desde aquí; NO subirla a true
      'comision',
      'comision_usuario_id'
    ]);

    const body = req.body ?? {};
    const campos = {};

    // Normalizaciones mínimas
    for (const k of Object.keys(body)) {
      if (!ALLOWED.has(k)) continue;
      const v = body[k];

      if (['n_contacto_1', 'n_contacto_2', 'n_contacto_3'].includes(k)) {
        campos[k] = Number(v ?? 0);
      } else if (['convertido', 'comision'].includes(k)) {
        campos[k] = !!v;
      } else if (
        [
          'fecha',
          'clase_prueba_1_fecha',
          'clase_prueba_2_fecha',
          'clase_prueba_3_fecha'
        ].includes(k)
      ) {
        campos[k] = v ? new Date(v) : null;
      } else if (k === 'sede' && typeof v === 'string') {
        campos[k] = v.trim().toLowerCase();
      } else if (k === 'comision_usuario_id') {
        if (typeof v !== 'undefined' && v !== null && v !== '') {
          campos[k] = Number(v) || null;
        }
      } else if (typeof v === 'string') {
        campos[k] = v.trim();
      } else {
        campos[k] = v;
      }
    }

    // 1) Si cambian a 'Campaña', exigir campania_origen; si no es 'Campaña', limpiar a ''
    if (Object.prototype.hasOwnProperty.call(campos, 'canal_contacto')) {
      const canal = campos.canal_contacto;
      if (canal === 'Campaña') {
        const origen = Object.prototype.hasOwnProperty.call(
          body,
          'campania_origen'
        )
          ? String(body.campania_origen ?? '').trim()
          : String(prospecto.campania_origen ?? '').trim();
        if (!origen) {
          await t.rollback();
          return res
            .status(400)
            .json({ mensajeError: 'Debe especificar el origen de la campaña' });
        }
        campos.campania_origen = origen;
      } else {
        campos.campania_origen = '';
      }
    }

    // 2) Bloquear intento de activar comisión desde UR
    if (
      Object.prototype.hasOwnProperty.call(body, 'comision') &&
      body.comision === true
    ) {
      await t.rollback();
      return res.status(400).json({
        mensajeError:
          'Use el endpoint de conversión para registrar una comisión.'
      });
    }

    // 3) Si desmarcan "convertido"
    const revierteConversion =
      Object.prototype.hasOwnProperty.call(body, 'convertido') &&
      body.convertido === false;

    if (revierteConversion) {
      // limpiar metadata en el prospecto
      campos.comision = false;
      campos.comision_registrada_at = null;
      campos.comision_usuario_id = null;
      campos.comision_estado = null;
      campos.comision_id = null;

      // regla nueva: si tenía comisión y está RECHAZADA, ELIMINARLA (para que no aparezca en "Ver comisiones")
      if (prospecto.comision_id) {
        const com = await VentasComisionesModel.findByPk(
          prospecto.comision_id,
          { transaction: t }
        );

        if (com) {
          if (com.estado === 'rechazado') {
            await VentasComisionesModel.destroy({
              where: { id: com.id },
              transaction: t
            });
          } else {
            // si no estaba rechazada, la marcamos rechazada (auditoría) y queda fuera de aprobadas
            await VentasComisionesModel.update(
              {
                estado: 'rechazado',
                rechazado_por: req.user?.id ?? null,
                rechazado_at: new Date(),
                motivo_rechazo:
                  'Conversión revertida desde edición del prospecto.'
              },
              { where: { id: com.id }, transaction: t }
            );
          }
        }
      }
    }

    // 4) Si vino 'comision' en false explícitamente, limpiar metadatos (no tocamos comision_id/estado)
    if (
      Object.prototype.hasOwnProperty.call(body, 'comision') &&
      body.comision === false &&
      !revierteConversion
    ) {
      campos.comision_registrada_at = null;
      campos.comision_usuario_id = null;
    }

    // Nada para actualizar
    if (Object.keys(campos).length === 0) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'Sin campos válidos para actualizar' });
    }

    const [n] = await VentasProspectosModel.update(campos, {
      where: { id },
      transaction: t
    });
    if (!n) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Prospecto no encontrado' });
    }

    const data = await VentasProspectosModel.findByPk(id, { transaction: t });
    await t.commit();
    return res.json(data);
  } catch (err) {
    try {
      await t.rollback();
    } catch {}
    return res.status(500).json({ mensajeError: err.message });
  }
};

// Eliminar un prospecto
export const ER_VentasProspecto_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const eliminado = await VentasProspectosModel.destroy({ where: { id } });

    if (!eliminado)
      return res.status(404).json({ mensajeError: 'Prospecto no encontrado' });

    res.json({ message: 'Prospecto eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener usuarios que hayan cargado al menos un prospecto
export const OBRS_ColaboradoresConVentasProspectos = async (req, res) => {
  try {
    const registros = await VentasProspectosModel.findAll({
      attributes: ['usuario_id'],
      group: ['usuario_id'],
      include: [
        {
          model: UserModel,
          as: 'usuario',
          attributes: ['id', 'name']
        }
      ]
    });

    const colaboradores = registros.map((r) => r.usuario).filter((u) => u);

    res.json(colaboradores);
  } catch (error) {
    res.status(500).json({
      mensajeError: 'Error al obtener colaboradores',
      error: error.message
    });
  }
};

// Crear prospecto con horario para pilates a ventas
//Controlador hecho por Sergio Manrique
//Fecha: 27/11/2025
export const CR_VentasProspectoConHorario_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const {
      usuario_id,
      nombre,
      dni = 'Sin DNI',
      tipo_prospecto = 'Nuevo',
      contacto,
      canal_contacto,
      actividad,
      sede,
      observacion,
      asesor_nombre,
      clase_prueba_1_fecha,
      clase_prueba_1_tipo,
      // Datos de horario
      hhmm,
      grp,
      clase_num = 1
    } = req.body;

    // ✅ Validaciones básicas
    if (
      !usuario_id ||
      !nombre ||
      !contacto ||
      !canal_contacto ||
      !actividad ||
      !sede
    ) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'Faltan datos obligatorios del prospecto'
      });
    }

    // ✅ Validar datos de horario
    if (!hhmm || !grp) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'Faltan datos de horario (hhmm, grp)'
      });
    }

    // ✅ Validar usuario existe
    const usuario = await UserModel.findByPk(usuario_id, { transaction: t });
    if (!usuario) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Usuario no válido' });
    }

    // 1️⃣ CREAR PROSPECTO
    const nuevoProspecto = await VentasProspectosModel.create(
      {
        usuario_id,
        nombre: nombre.trim(),
        dni,
        tipo_prospecto,
        canal_contacto,
        contacto: contacto.trim(),
        actividad,
        sede: sede.trim().toLowerCase(),
        asesor_nombre: asesor_nombre || usuario.name,
        n_contacto_1: 1,
        clase_prueba_1_obs: observacion,
        clase_prueba_1_fecha: clase_prueba_1_fecha
          ? new Date(clase_prueba_1_fecha)
          : null,
        clase_prueba_1_tipo: clase_prueba_1_tipo || 'Clase de prueba'
      },
      { transaction: t }
    );

    // ✅ Capturar ID del prospecto creado automáticamente
    const prospecto_id = nuevoProspecto.id;

    // 2️⃣ CREAR HORARIO ASOCIADO
    const nuevoHorario = await VentasProspectosHorariosModel.create(
      {
        prospecto_id,
        hhmm: hhmm.trim(),
        grp: grp.trim(),
        clase_num: Number(clase_num)
      },
      { transaction: t }
    );

    // ✅ Confirmar transacción
    await t.commit();

    return res.status(201).json({
      message: 'Prospecto y horario creados correctamente',
      prospecto_id,
      data: {
        prospecto: nuevoProspecto,
        horario: nuevoHorario
      }
    });
  } catch (error) {
    try {
      await t.rollback();
    } catch {}

    console.error('Error en SYNC_ProspectoConHorario_CTS:', error);

    return res.status(500).json({
      mensajeError: 'Error en la sincronización',
      detalle: error.message
    });
  }
};

// Benjamin Orellana - 2026/04/17 - Normaliza horas al formato HH:mm:ss para comparaciones consistentes.
const normalizarHoraHHMMSS = (hora) => {
  const valor = normalizarTexto(hora);

  if (/^\d{2}:\d{2}:\d{2}$/.test(valor)) return valor;
  if (/^\d{2}:\d{2}$/.test(valor)) return `${valor}:00`;

  return null;
};

// Benjamin Orellana - 2026/04/17 - Calcula la diferencia en minutos entre dos horas del mismo día.
const diferenciaMinutosEntreHoras = (horaDesde, horaHasta) => {
  const desde = normalizarHoraHHMMSS(horaDesde);
  const hasta = normalizarHoraHHMMSS(horaHasta);

  if (!desde || !hasta) return null;

  const [h1, m1, s1] = desde.split(':').map(Number);
  const [h2, m2, s2] = hasta.split(':').map(Number);

  const segundosDesde = h1 * 3600 + m1 * 60 + s1;
  const segundosHasta = h2 * 3600 + m2 * 60 + s2;

  return Math.floor((segundosHasta - segundosDesde) / 60);
};

// Benjamin Orellana - 2026/04/17 - Suma minutos a una hora HH:mm:ss para definir la ventana de relevo.
const sumarMinutosAHora = (hora, minutosASumar) => {
  const base = normalizarHoraHHMMSS(hora);
  if (!base) return null;

  const [h, m, s] = base.split(':').map(Number);
  let totalSegundos = h * 3600 + m * 60 + s + minutosASumar * 60;

  if (totalSegundos < 0) totalSegundos = 0;
  if (totalSegundos > 86399) totalSegundos = 86399;

  const hh = String(Math.floor(totalSegundos / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSegundos % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSegundos % 60).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
};

// Benjamin Orellana - 2026/04/21 - Capitaliza la primera letra para mejorar la presentación de textos públicos.
const capitalizarPrimeraLetra = (valor = '') => {
  const texto = String(valor || '').trim();
  if (!texto) return '';
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// Benjamin Orellana - 2026/04/21 - Formatea la fecha elegida por el prospecto a un formato legible para el mensaje público de éxito.
const formatearFechaVisitaPublica = (fechaISO) => {
  if (!fechaISO) return '';

  const fecha = new Date(`${fechaISO}T12:00:00`);

  if (Number.isNaN(fecha.getTime())) {
    return String(fechaISO);
  }

  return capitalizarPrimeraLetra(
    new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(fecha)
  );
};

// Benjamin Orellana - 2026/04/21 - Normaliza la hora al formato HH:MM para reutilizarla en los mensajes públicos.
const formatearHoraVisitaPublica = (hora) => {
  return String(hora || '')
    .trim()
    .slice(0, 5);
};

// Benjamin Orellana - 2026/04/21 - Construye el mensaje de éxito del formulario público usando profesor, fecha y hora cuando existan.
const construirMensajeExitoRegistroPublico = ({
  profesorNombre = '',
  fechaISO = '',
  horaHHMM = ''
}) => {
  const fechaTexto = formatearFechaVisitaPublica(fechaISO);
  const horaTexto = formatearHoraVisitaPublica(horaHHMM);

  const tramoFechaHora = [
    fechaTexto ? `el ${fechaTexto}` : '',
    horaTexto ? `a las ${horaTexto}` : ''
  ]
    .filter(Boolean)
    .join(' ');

  if (profesorNombre) {
    return `Recibimos tu solicitud correctamente. Tu profesor se llama ${profesorNombre}. Te esperamos ${tramoFechaHora}. Revisá tu mail.`;
  }

  return `Recibimos tu solicitud correctamente. Te esperamos ${tramoFechaHora}. Revisá tu mail.`;
};

// Benjamin Orellana - 2026/04/21 - Valida el formato básico del email del prospecto para poder enviar confirmaciones posteriormente.
const esEmailProspectoValido = (email = '') => {
  const valor = String(email || '')
    .trim()
    .toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
};

// Benjamin Orellana - 2026/04/21 - Capitaliza cada palabra para mejorar textos visibles en correo y mensajes públicos.
const capitalizarPalabrasRegistroPublico = (valor = '') =>
  String(valor || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((parte) => capitalizarPrimeraLetra(parte))
    .join(' ');

// Benjamin Orellana - 2026/04/21 - Formatea la sede legada a una etiqueta amigable para el correo de confirmación.
const formatearSedeConfirmacionRegistroPublico = (sede = '') => {
  const clave = normalizarTextoComparacion(sede);

  const mapa = {
    monteros: 'Monteros',
    concepcion: 'Concepción',
    'barrio sur': 'Barrio Sur',
    'barrio norte': 'Barrio Norte',
    'yerba buena - aconquija 2044': 'Yerba Buena - Aconquija 2044'
  };

  return mapa[clave] || capitalizarPalabrasRegistroPublico(sede);
};

// Benjamin Orellana - 2026/04/21 - Formatea la actividad para mostrarla correctamente en el correo de confirmación.
const formatearActividadConfirmacionRegistroPublico = (actividad = '') => {
  const clave = normalizarTextoComparacion(actividad);

  const mapa = {
    musculacion: 'Musculación',
    pilates: 'Pilates',
    'clases grupales': 'Clases grupales',
    'pase full': 'Pase full',
    'no especifica': 'No especifica'
  };

  return mapa[clave] || capitalizarPalabrasRegistroPublico(actividad);
};

// Benjamin Orellana - 2026/04/21 - Unifica advertencias de distintos pasos del flujo sin pisar mensajes existentes.
const unirMensajesAdvertenciaRegistroPublico = (...mensajes) => {
  const mensajesValidos = mensajes
    .map((msg) => String(msg || '').trim())
    .filter(Boolean);

  return mensajesValidos.length ? mensajesValidos.join(' ') : null;
};

// Benjamin Orellana - 2026/04/21 - Intenta enviar el mail de confirmación sin romper el alta principal si el correo falla.
const enviarConfirmacionRegistroPublicoSafe = async ({
  email,
  nombreCompleto,
  tipoLink,
  actividad,
  sede,
  fechaISO,
  horaHHMM,
  profesorNombre = ''
}) => {
  try {
    const resultado = await enviarConfirmacionProspectoEmail({
      to: email,
      nombreCompleto,
      tipoLink,
      actividad,
      sede,
      fechaTexto: formatearFechaVisitaPublica(fechaISO),
      horaTexto: formatearHoraVisitaPublica(horaHHMM),
      profesorNombre
    });

    if (resultado?.skipped) {
      return null;
    }

    return null;
  } catch (error) {
    console.error('Error enviando confirmación de prospecto por email:', error);

    return 'Tu solicitud fue registrada, pero no pudimos enviarte el mail de confirmación.';
  }
};

// Benjamin Orellana - 2026/04/17 - Registra prospectos desde el formulario web y, si corresponde, genera alumno y agenda inicial.
export const CR_RegistroPublicoProspectoClaseVisita_CTS = async (req, res) => {
  try {
    const {
      usuario_id,
      asesor_nombre,
      nombre,
      apellido,
      dni,
      telefono,
      contacto,
      email,
      actividad,
      sede,
      sede_id,
      fecha_clase,
      hora_clase,
      necesita_profe,
      tipo_link,
      observacion,
      pilates_horario_id,
      pilates_hhmm,
      pilates_grp,
      pilates_clase_num
    } = req.body;

    const nombreBase = normalizarTexto(nombre);
    const apellidoBase = normalizarTexto(apellido);
    const nombreCompleto = [nombreBase, apellidoBase]
      .filter(Boolean)
      .join(' ')
      .trim();
    const telefonoFinal =
      normalizarTexto(contacto) || normalizarTexto(telefono);
    const emailFinal = normalizarTexto(email).toLowerCase();
    const actividadFinal = normalizarTexto(actividad);
    const sedeFinal = normalizarTexto(sede).toLowerCase();
    const tipoLinkFinal = normalizarTexto(tipo_link);
    const requiereProfe = normalizarBoolean(necesita_profe);
    const fechaHoraClase = construirFechaHoraMySQL(fecha_clase, hora_clase);
    const diaSemana = obtenerDiaSemanaRRHH(fecha_clase);
    const { mes, anio } = obtenerMesAnio(fecha_clase);

    // Benjamin Orellana - 2026/04/21 - Se centralizan los datos base del mail de confirmación para reutilizarlos en todos los retornos exitosos del flujo.
    const datosBaseMailConfirmacion = {
      email: emailFinal,
      nombreCompleto,
      tipoLink: tipo_link || tipoLinkFinal,
      actividad: formatearActividadConfirmacionRegistroPublico(
        actividad || actividadFinal
      ),
      sede: formatearSedeConfirmacionRegistroPublico(sede || sedeFinal),
      fechaISO: fecha_clase
    };

    // Benjamin Orellana - 2026/04/21 - Se dispara el correo en segundo plano para no demorar la respuesta HTTP del registro público.
    const dispararConfirmacionRegistroPublicoEnSegundoPlano = (payload) => {
      setImmediate(async () => {
        try {
          const advertenciaMail = await enviarConfirmacionRegistroPublicoSafe(
            payload
          );

          if (advertenciaMail) {
            console.warn(
              'Advertencia enviando confirmación de prospecto por email:',
              advertenciaMail
            );
          }
        } catch (errorMailBackground) {
          console.error(
            'Error en envío asíncrono de confirmación de prospecto:',
            errorMailBackground
          );
        }
      });
    };

    // Benjamin Orellana - 2026/04/17 - Validaciones mínimas del formulario público.

    if (!nombreCompleto) {
      return res.status(400).json({
        mensajeError: 'El nombre es obligatorio.'
      });
    }

    if (!actividadFinal || !ACTIVIDADES_VALIDAS.includes(actividadFinal)) {
      return res.status(400).json({
        mensajeError: 'La actividad enviada no es válida.'
      });
    }

    if (!sede_id) {
      return res.status(400).json({
        mensajeError: 'La sede es obligatoria.'
      });
    }

    if (!sedeFinal || !SEDES_VALIDAS.includes(sedeFinal)) {
      return res.status(400).json({
        mensajeError: 'La sede legada enviada no es válida.'
      });
    }

    if (!tipoLinkFinal || !TIPOS_LINK_VALIDOS.includes(tipoLinkFinal)) {
      return res.status(400).json({
        mensajeError:
          'El tipo de link debe ser "Visita programada" o "Clase de prueba".'
      });
    }

    if (!fechaHoraClase || !diaSemana || !mes || !anio) {
      return res.status(400).json({
        mensajeError: 'La fecha u hora seleccionada no es válida.'
      });
    }

    if (!emailFinal) {
      return res.status(400).json({
        mensajeError: 'El email es obligatorio.'
      });
    }

    if (!esEmailProspectoValido(emailFinal)) {
      return res.status(400).json({
        mensajeError: 'El email enviado no es válido.'
      });
    }

    // Benjamin Orellana - 2026/04/20 - Si la actividad es Pilates, se exige la selección de un horario específico.
    if (actividadFinal === 'Pilates') {
      if (!pilates_horario_id || !pilates_hhmm || !pilates_grp) {
        return res.status(400).json({
          mensajeError: 'Para Pilates debés seleccionar un horario disponible.'
        });
      }

      const diaPilates = obtenerDiaSemanaPilates(fecha_clase);

      if (!diaPilates || diaPilates === 'Domingo') {
        return res.status(400).json({
          mensajeError:
            'Pilates no dispone turnos válidos para la fecha seleccionada.'
        });
      }
    }

    // Benjamin Orellana - 2026/04/17 - Primero se registra siempre el prospecto comercial en ventas.
    const prospectoCreado = await VentasProspectosModel.create({
      usuario_id,
      nombre: nombreCompleto,
      dni: normalizarTexto(dni) || null,
      tipo_prospecto: 'Nuevo',
      canal_contacto: 'Link Web',
      contacto: telefonoFinal || null,
      email: emailFinal || null,
      actividad: actividadFinal,
      sede: sedeFinal,
      sede_id,
      asesor_nombre: normalizarTexto(asesor_nombre) || null,
      n_contacto_1: 1,
      n_contacto_2: 0,
      n_contacto_3: 0,
      clase_prueba_1_fecha: fechaHoraClase,
      clase_prueba_1_obs: normalizarTexto(observacion) || null,
      clase_prueba_1_tipo: tipoLinkFinal,
      necesita_profe: requiereProfe,
      observacion: normalizarTexto(observacion) || null
    });

    // Benjamin Orellana - 2026/04/20 - Si la actividad es Pilates, se deriva a su flujo propio sin pasar por alumnos/agendas generales.
    if (actividadFinal === 'Pilates') {
      const transactionPilates = await db.transaction();

      try {
        const diaPilates = obtenerDiaSemanaPilates(fecha_clase);
        const fechaFinPilates = sumarDiasFechaISO(fecha_clase, 1);

        // Benjamin Orellana - 2026/04/20 - Se valida el horario de Pilates por id e id_sede, y luego se comprueba en código que corresponda al día elegido.
        const horarioPilates = await HorariosPilatesModel.findOne({
          where: {
            id: pilates_horario_id,
            id_sede: sede_id
          },
          transaction: transactionPilates
        });

        if (!horarioPilates) {
          await transactionPilates.rollback();

          // Benjamin Orellana - 2026/04/21 - Se intenta enviar el mail aunque el alta de Pilates no haya podido completar su validación específica.
          dispararConfirmacionRegistroPublicoEnSegundoPlano({
            ...datosBaseMailConfirmacion,
            horaHHMM: pilates_hhmm || hora_clase
          });

          return res.status(201).json({
            mensaje: construirMensajeExitoRegistroPublico({
              fechaISO: fecha_clase,
              horaHHMM: pilates_hhmm || hora_clase
            }),
            mensajeAdvertencia:
              'No se pudo validar el horario seleccionado de Pilates.',
            prospecto: prospectoCreado,
            pilates_registrado: false,
            alumno_generado: false
          });
        }

        const diaPilatesEsperado = normalizarTextoComparacion(diaPilates);
        const diaPilatesHorario = normalizarTextoComparacion(
          horarioPilates.dia_semana
        );

        if (diaPilatesHorario !== diaPilatesEsperado) {
          await transactionPilates.rollback();

          // Benjamin Orellana - 2026/04/21 - Se intenta enviar el mail de confirmación aunque exista una inconsistencia puntual en el horario de Pilates.
          dispararConfirmacionRegistroPublicoEnSegundoPlano({
            ...datosBaseMailConfirmacion,
            horaHHMM: pilates_hhmm || hora_clase
          });

          return res.status(201).json({
            mensaje: construirMensajeExitoRegistroPublico({
              fechaISO: fecha_clase,
              horaHHMM: pilates_hhmm || hora_clase
            }),
            mensajeAdvertencia:
              'El horario seleccionado de Pilates no corresponde al día elegido.',
            prospecto: prospectoCreado,
            pilates_registrado: false,
            alumno_generado: false
          });
        }

        // Benjamin Orellana - 2026/04/20 - Se replica la lógica previa de ventas: si ya existe una prueba previa muy similar, se limpia antes de recrearla.
        const whereClientePilatesExistente = {
          nombre: nombreCompleto,
          estado: {
            [Op.in]: ['Clase de prueba', 'Renovacion programada']
          }
        };

        if (telefonoFinal) {
          whereClientePilatesExistente.telefono = telefonoFinal;
        }

        const clientePilatesExistente = await ClientesPilatesModel.findOne({
          where: whereClientePilatesExistente,
          transaction: transactionPilates
        });

        if (clientePilatesExistente) {
          await InscripcionesPilatesModel.destroy({
            where: { id_cliente: clientePilatesExistente.id },
            transaction: transactionPilates
          });

          await ClientesPilatesModel.destroy({
            where: { id: clientePilatesExistente.id },
            transaction: transactionPilates
          });
        }

        // Benjamin Orellana - 2026/04/20 - Se resuelve de forma robusta si el flujo de Pilates corresponde a clase de prueba o visita programada.
        const tipoLinkNormalizadoPilates = normalizarTextoComparacion(
          tipo_link ||
            tipoLinkFinal ||
            prospectoCreado?.clase_prueba_1_tipo ||
            ''
        );

        const esClaseDePruebaPilates =
          tipoLinkNormalizadoPilates === 'clase de prueba' ||
          tipoLinkNormalizadoPilates.includes('clase de prueba');

        const estadoPilates = esClaseDePruebaPilates
          ? 'Clase de prueba'
          : 'Renovacion programada';

        // Benjamin Orellana - 2026/04/20 - Se crea el cliente de Pilates asociado comercialmente al prospecto registrado.
        const clientePilatesCreado = await ClientesPilatesModel.create(
          {
            nombre: nombreCompleto,
            telefono: telefonoFinal || null,
            estado: estadoPilates,
            fecha_inicio: fecha_clase,
            fecha_fin: fechaFinPilates,
            observaciones: normalizarTexto(observacion) || null
          },
          { transaction: transactionPilates }
        );

        // Benjamin Orellana - 2026/04/20 - Se crea la inscripción de Pilates con el horario puntual ya resuelto desde el frontend.
        const inscripcionPilatesCreada = await InscripcionesPilatesModel.create(
          {
            id_cliente: clientePilatesCreado.id,
            id_horario: horarioPilates.id,
            fecha_inscripcion: fecha_clase
          },
          { transaction: transactionPilates }
        );

        // Benjamin Orellana - 2026/04/20 - Se registra el horario elegido también en ventas para mantener la trazabilidad comercial.
        const horarioProspectoCreado =
          await VentasProspectosHorariosModel.create(
            {
              prospecto_id: prospectoCreado.id,
              hhmm: pilates_hhmm,
              grp: pilates_grp,
              clase_num: Number(pilates_clase_num || 1)
            },
            { transaction: transactionPilates }
          );

        let alumnoCreado = null;
        let instructorPilates = null;
        let userInternoInstructor = null;
        let mensajeAdvertenciaPilates = null;

        // Benjamin Orellana - 2026/04/20 - Si el prospecto pidió profesor, se intenta asociar el instructor de Pilates a un usuario interno y crear el alumno prospecto.
        if (requiereProfe) {
          const instructoresPilates = await db.query(
            `
            SELECT
              up.id,
              up.nombre,
              up.apellido,
              up.email
            FROM usuarios_pilates up
            WHERE up.id = :idInstructor
            LIMIT 1
            `,
            {
              replacements: {
                idInstructor: horarioPilates.id_instructor
              },
              type: QueryTypes.SELECT,
              transaction: transactionPilates
            }
          );

          instructorPilates = instructoresPilates?.[0] || null;

          if (instructorPilates?.email) {
            userInternoInstructor = await UserModel.findOne({
              where: {
                email: instructorPilates.email
              },
              transaction: transactionPilates
            });
          }

          if (userInternoInstructor) {
            // Benjamin Orellana - 2026/04/20 - Se crea el alumno prospecto asociado al instructor real de Pilates encontrado.
            alumnoCreado = await AlumnosModel.create(
              {
                nombre: nombreCompleto,
                prospecto: 'prospecto',
                c: '',
                socio_origen: null,
                socio_origen_mes: null,
                socio_origen_anio: null,
                email: instructorPilates?.email || null,
                celular: telefonoFinal || null,
                punto_d: null,
                motivo: null,
                user_id: userInternoInstructor.id,
                fecha_creacion: new Date(),
                mes,
                anio
              },
              { transaction: transactionPilates }
            );
          } else {
            mensajeAdvertenciaPilates =
              'Se registró Pilates correctamente, pero no se pudo asociar el instructor a un usuario interno para crear el alumno.';
          }
        }

        // Benjamin Orellana - 2026/04/21 - Se arma el nombre visible del instructor de Pilates para el mensaje de confirmación al prospecto.
        const nombreProfesorPilates = [
          instructorPilates?.nombre,
          instructorPilates?.apellido
        ]
          .filter(Boolean)
          .join(' ')
          .trim();

        await transactionPilates.commit();

        // Benjamin Orellana - 2026/04/21 - Luego de confirmar el flujo de Pilates se envía el correo de confirmación al prospecto.
        dispararConfirmacionRegistroPublicoEnSegundoPlano({
          ...datosBaseMailConfirmacion,
          horaHHMM: pilates_hhmm || hora_clase,
          profesorNombre: nombreProfesorPilates
        });

        return res.status(201).json({
          mensaje: construirMensajeExitoRegistroPublico({
            profesorNombre: nombreProfesorPilates,
            fechaISO: fecha_clase,
            horaHHMM: pilates_hhmm || hora_clase
          }),
          mensajeAdvertencia: mensajeAdvertenciaPilates,
          prospecto: prospectoCreado,
          pilates_registrado: true,
          cliente_pilates: clientePilatesCreado,
          inscripcion_pilates: inscripcionPilatesCreada,
          horario_ventas: horarioProspectoCreado,
          instructor_pilates: instructorPilates
            ? {
                id: instructorPilates.id,
                nombre: instructorPilates.nombre,
                apellido: instructorPilates.apellido,
                nombre_completo: nombreProfesorPilates,
                email: instructorPilates.email
              }
            : null,
          user_interno_instructor: userInternoInstructor
            ? {
                id: userInternoInstructor.id,
                name: userInternoInstructor.name,
                email: userInternoInstructor.email
              }
            : null,
          alumno: alumnoCreado,
          alumno_generado: !!alumnoCreado
        });
      } catch (errorPilates) {
        await transactionPilates.rollback();

        // Benjamin Orellana - 2026/04/21 - Aunque falle la inscripción interna de Pilates, se intenta enviar la confirmación del registro principal.
        dispararConfirmacionRegistroPublicoEnSegundoPlano({
          ...datosBaseMailConfirmacion,
          horaHHMM: pilates_hhmm || hora_clase
        });

        return res.status(201).json({
          mensaje: construirMensajeExitoRegistroPublico({
            fechaISO: fecha_clase,
            horaHHMM: pilates_hhmm || hora_clase
          }),
          mensajeAdvertencia:
            'No se pudo completar la inscripción inicial de Pilates.',
          detallePilates: errorPilates.message,
          prospecto: prospectoCreado,
          pilates_registrado: false,
          alumno_generado: false
        });
      }
    }

    // Benjamin Orellana - 2026/04/17 - Si no necesita profesor o si es una visita, el flujo termina en ventas_prospectos.
    if (!requiereProfe || tipoLinkFinal !== 'Clase de prueba') {
      // Benjamin Orellana - 2026/04/21 - Se envía el mail de confirmación cuando el flujo termina únicamente con el alta comercial del prospecto.
      dispararConfirmacionRegistroPublicoEnSegundoPlano({
        ...datosBaseMailConfirmacion,
        horaHHMM: hora_clase
      });

      return res.status(201).json({
        mensaje: construirMensajeExitoRegistroPublico({
          fechaISO: fecha_clase,
          horaHHMM: hora_clase
        }),
        prospecto: prospectoCreado,
        profesor_asignado: false,
        alumno_generado: false,
        agenda_generada: false
      });
    }

    // Benjamin Orellana - 2026/04/17 - Se busca primero el instructor que cubre exactamente la hora elegida.
    const horaClaseNormalizada = normalizarHoraHHMMSS(hora_clase);

    const profesoresDisponibles = await db.query(
      `
      SELECT
        rh.id,
        rh.usuario_id,
        u.email,
        u.name,
        u.level,
        rh.hora_entrada,
        rh.hora_salida
      FROM rrhh_horarios rh
      INNER JOIN users u
        ON u.id = rh.usuario_id
      WHERE rh.sede_id = :sedeId
        AND rh.dia_semana = :diaSemana
        AND rh.eliminado = 0
        AND u.level = 'instructor'
        AND rh.fecha_vigencia_desde <= :fechaClase
        AND (rh.fecha_vigencia_hasta IS NULL OR rh.fecha_vigencia_hasta >= :fechaClase)
        AND rh.hora_entrada <= :horaClase
        AND rh.hora_salida > :horaClase
      ORDER BY rh.hora_salida DESC, rh.hora_entrada ASC, rh.id ASC
      LIMIT 1
      `,
      {
        replacements: {
          sedeId: sede_id,
          diaSemana,
          fechaClase: fecha_clase,
          horaClase: horaClaseNormalizada
        },
        type: QueryTypes.SELECT
      }
    );

    let profesorAsignado = profesoresDisponibles?.[0] || null;

    // Benjamin Orellana - 2026/04/17 - Si al instructor actual le quedan 30 minutos o menos y hay relevo dentro de esa ventana, se asigna el siguiente.
    if (profesorAsignado) {
      const minutosRestantes = diferenciaMinutosEntreHoras(
        horaClaseNormalizada,
        profesorAsignado.hora_salida
      );

      if (minutosRestantes !== null && minutosRestantes <= 30) {
        const horaLimiteRelevo = sumarMinutosAHora(horaClaseNormalizada, 30);

        const proximosProfesores = await db.query(
          `
          SELECT
            rh.id,
            rh.usuario_id,
            u.email,
            u.name,
            u.level,
            rh.hora_entrada,
            rh.hora_salida
          FROM rrhh_horarios rh
          INNER JOIN users u
            ON u.id = rh.usuario_id
          WHERE rh.sede_id = :sedeId
            AND rh.dia_semana = :diaSemana
            AND rh.eliminado = 0
            AND u.level = 'instructor'
            AND rh.fecha_vigencia_desde <= :fechaClase
            AND (rh.fecha_vigencia_hasta IS NULL OR rh.fecha_vigencia_hasta >= :fechaClase)
            AND rh.hora_entrada > :horaClase
            AND rh.hora_entrada <= :horaLimiteRelevo
          ORDER BY rh.hora_entrada ASC, rh.hora_salida DESC, rh.id ASC
          LIMIT 1
          `,
          {
            replacements: {
              sedeId: sede_id,
              diaSemana,
              fechaClase: fecha_clase,
              horaClase: horaClaseNormalizada,
              horaLimiteRelevo
            },
            type: QueryTypes.SELECT
          }
        );

        if (proximosProfesores?.[0]) {
          profesorAsignado = proximosProfesores[0];
        }
      }
    }

    // Benjamin Orellana - 2026/04/17 - Si no hay profesor disponible no se inventa una asignación; se conserva el prospecto y se informa advertencia.
    if (!profesorAsignado) {
      // Benjamin Orellana - 2026/04/21 - Se envía la confirmación al prospecto incluso si el profesor queda pendiente de asignación.
      dispararConfirmacionRegistroPublicoEnSegundoPlano({
        ...datosBaseMailConfirmacion,
        horaHHMM: hora_clase
      });

      return res.status(201).json({
        mensaje: construirMensajeExitoRegistroPublico({
          fechaISO: fecha_clase,
          horaHHMM: hora_clase
        }),
        mensajeAdvertencia:
          // 'No se encontró un profesor disponible para la sede, día y horario seleccionados.',
          '',
        prospecto: prospectoCreado,
        profesor_asignado: false,
        alumno_generado: false,
        agenda_generada: false
      });
    }

    const transaction = await db.transaction();

    try {
      // Benjamin Orellana - 2026/04/17 - Se crea el alumno prospecto vinculado al profesor encontrado.
      const alumnoCreado = await AlumnosModel.create(
        {
          nombre: nombreCompleto,
          prospecto: 'prospecto',
          c: '',
          socio_origen: null,
          socio_origen_mes: null,
          socio_origen_anio: null,
          email: profesorAsignado.email || null,
          celular: telefonoFinal || null,
          punto_d: null,
          motivo: null,
          user_id: profesorAsignado.usuario_id,
          fecha_creacion: new Date(),
          mes,
          anio
        },
        { transaction }
      );

      // Benjamin Orellana - 2026/04/17 - Se crea la agenda número 1 para dejar trazada la clase de prueba inicial.
      const agendaCreada = await AgendasModel.create(
        {
          alumno_id: alumnoCreado.id,
          agenda_num: 1,
          contenido: `PENDIENTE`,
          fecha_creacion: new Date(),
          alerta_generada: false,
          mes,
          anio
        },
        { transaction }
      );

      await transaction.commit();

      // Benjamin Orellana - 2026/04/21 - Una vez confirmada la asignación del profesor se envía el mail con todos los datos de la visita o clase.
      dispararConfirmacionRegistroPublicoEnSegundoPlano({
        ...datosBaseMailConfirmacion,
        horaHHMM: hora_clase,
        profesorNombre: profesorAsignado?.name || ''
      });

      return res.status(201).json({
        mensaje: construirMensajeExitoRegistroPublico({
          profesorNombre: profesorAsignado?.name || '',
          fechaISO: fecha_clase,
          horaHHMM: hora_clase
        }),
        prospecto: prospectoCreado,
        profesor_asignado: true,
        profesor: {
          usuario_id: profesorAsignado.usuario_id,
          nombre: profesorAsignado.name,
          email: profesorAsignado.email
        },
        alumno: alumnoCreado,
        agenda: agendaCreada,
        alumno_generado: true,
        agenda_generada: true
      });
    } catch (errorInterno) {
      await transaction.rollback();
      throw errorInterno;
    }
  } catch (error) {
    console.error('Error en CR_RegistroPublicoClasePrueba_CTS:', error);

    return res.status(500).json({
      mensajeError: 'Ocurrió un error al registrar el prospecto público.',
      error: error.message
    });
  }
};

// Benjamin Orellana - 2026/04/27 - Resuelve dinámicamente los campos clase_prueba_X del prospecto según el número de clase seleccionado desde ventas.
const resolverCamposClaseInternaVentas = (numeroClase) => {
  const numero = Number(numeroClase);

  if (![1, 2, 3].includes(numero)) {
    return null;
  }

  return {
    numero,
    fechaKey: `clase_prueba_${numero}_fecha`,
    obsKey: `clase_prueba_${numero}_obs`,
    tipoKey: `clase_prueba_${numero}_tipo`
  };
};

// Benjamin Orellana - 2026/04/27 - Crea o actualiza el horario asociado a una clase del prospecto para no duplicar registros por prospecto y número de clase.
const upsertHorarioProspectoInterno = async ({
  prospecto_id,
  clase_num,
  hhmm,
  grp,
  transaction
}) => {
  const horaFinal = normalizarTexto(hhmm);
  const grupoFinal = normalizarTexto(grp);

  if (!prospecto_id || !clase_num || !horaFinal || !grupoFinal) {
    return null;
  }

  const horarioExistente = await VentasProspectosHorariosModel.findOne({
    where: {
      prospecto_id,
      clase_num: Number(clase_num)
    },
    transaction
  });

  if (horarioExistente) {
    await horarioExistente.update(
      {
        hhmm: horaFinal,
        grp: grupoFinal
      },
      { transaction }
    );

    return horarioExistente;
  }

  return await VentasProspectosHorariosModel.create(
    {
      prospecto_id,
      hhmm: horaFinal,
      grp: grupoFinal,
      clase_num: Number(clase_num)
    },
    { transaction }
  );
};

// Benjamin Orellana - 2026/04/27 - Resuelve el sede_id efectivo desde el prospecto, el payload o el nombre legado de sede para soportar registros viejos sin sede_id.
const resolverSedeIdEfectivoVentas = async ({ prospecto, sede_id, transaction }) => {
  const sedeIdDirecto = Number(prospecto?.sede_id || sede_id || 0) || null;
  if (sedeIdDirecto) return sedeIdDirecto;

  const sedeTexto = normalizarTextoComparacion(prospecto?.sede);
  if (!sedeTexto) return null;

  const sedes = await db.query(
    `
    SELECT id, nombre
    FROM sedes
    `,
    {
      type: QueryTypes.SELECT,
      transaction
    }
  );

  const normalizarNombreSede = (valor) =>
    normalizarTextoComparacion(valor)
      .replace('yerbabuenaaaconquija2044', 'yerbabuenaaconquija2044')
      .replace('yerbabuena-aconquija2044', 'yerbabuenaaconquija2044');

  const sedeEncontrada = sedes.find((s) => {
    const nombreBD = normalizarNombreSede(s.nombre);
    const nombreProspecto = normalizarNombreSede(sedeTexto);

    if (nombreBD === nombreProspecto) return true;

    if (nombreProspecto === 'smt' && nombreBD === 'barriosur') return true;
    if (nombreProspecto === 'sanmiguelbn' && nombreBD === 'barrionorte') return true;

    return false;
  });

  return sedeEncontrada?.id || null;
};

// Benjamin Orellana - 2026/04/27 - Sincroniza desde ventas internas una visita o clase de prueba, impactando prospecto y, cuando aplica, asignación de profesor, alumno y agenda.
export const SYNC_VentasProspectoClaseInterna_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const {
      prospecto_id,
      numeroClase,
      fecha,
      hora_clase,
      tipo,
      observacion,
      necesita_profe,
      hhmm,
      grp,
      sede_id
    } = req.body;

    const camposClase = resolverCamposClaseInternaVentas(numeroClase);
    const tipoFinal = normalizarTexto(tipo);
    const requiereProfe = normalizarBoolean(necesita_profe);

    if (!prospecto_id) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'El prospecto es obligatorio.'
      });
    }

    if (!camposClase) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'El número de clase debe ser 1, 2 o 3.'
      });
    }

    if (!fecha) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'La fecha es obligatoria.'
      });
    }

    if (!tipoFinal) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'El tipo es obligatorio.'
      });
    }

    const TIPOS_VALIDOS_INTERNOS = [
      'Agenda',
      'Visita programada',
      'Clase de prueba'
    ];

    if (!TIPOS_VALIDOS_INTERNOS.includes(tipoFinal)) {
      await t.rollback();
      return res.status(400).json({
        mensajeError:
          'El tipo debe ser Agenda, Visita programada o Clase de prueba.'
      });
    }

    const prospecto = await VentasProspectosModel.findByPk(prospecto_id, {
      transaction: t
    });
 
    // Benjamin Orellana - 2026/04/27 - Se resuelve sede_id efectivo para no buscar instructores con NULL cuando el prospecto es viejo o no trae sede_id persistido.
    const sedeIdEfectivo = await resolverSedeIdEfectivoVentas({
      prospecto,
      sede_id,
      transaction: t
    });

    if (!prospecto) {
      await t.rollback();
      return res.status(404).json({
        mensajeError: 'Prospecto no encontrado.'
      });
    }

    const actividadProspecto = normalizarTexto(prospecto.actividad);
    const esPilates = actividadProspecto === 'Pilates';

    // Benjamin Orellana - 2026/04/27 - Para Pilates se toma la hora desde el horario seleccionado; para el resto se usa hora_clase.
    const horaFinalClase = esPilates
      ? normalizarTexto(hhmm) || normalizarTexto(hora_clase)
      : normalizarTexto(hora_clase);

    if (!horaFinalClase) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'La hora es obligatoria.'
      });
    }

    const fechaHoraClase = construirFechaHoraMySQL(fecha, horaFinalClase);
    const diaSemana = obtenerDiaSemanaRRHH(fecha);
    const { mes, anio } = obtenerMesAnio(fecha);
    const horaClaseNormalizada = normalizarHoraHHMMSS(horaFinalClase);

    if (
      !fechaHoraClase ||
      !diaSemana ||
      !mes ||
      !anio ||
      !horaClaseNormalizada
    ) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'La fecha u hora enviada no es válida.'
      });
    }

    const datosActualizacionProspecto = {
      [camposClase.fechaKey]: fechaHoraClase,
      [camposClase.obsKey]: normalizarTexto(observacion) || null,
      [camposClase.tipoKey]: tipoFinal,
      necesita_profe: esPilates ? false : requiereProfe
    };

    let profesorAsignado = null;
    let alumnoCreadoOActualizado = null;
    let agendaCreadaOActualizada = null;
    let mensajeAdvertencia = null;
    let horarioProspectoSincronizado = null;

    const tipoGeneraPlanillaYAgenda = [
      'Visita programada',
      'Clase de prueba'
    ].includes(tipoFinal);

    // Benjamin Orellana - 2026/04/27 - Si el prospecto es Pilates, se conserva su flujo específico actual y solo se sincronizan datos de clase y horario sin cortar con error.
    if (esPilates) {
      if (normalizarTexto(hhmm) && normalizarTexto(grp)) {
        horarioProspectoSincronizado = await upsertHorarioProspectoInterno({
          prospecto_id: prospecto.id,
          clase_num: camposClase.numero,
          hhmm,
          grp,
          transaction: t
        });
      }

      await prospecto.update(datosActualizacionProspecto, { transaction: t });

      await t.commit();

      return res.status(200).json({
        message:
          'Clase interna sincronizada correctamente. Pilates mantiene su flujo específico actual.',
        prospecto_id: prospecto.id,
        numero_clase: camposClase.numero,
        pilates_flujo_existente: true,
        horario: horarioProspectoSincronizado,
        profesor_asignado: false,
        alumno_generado: false,
        agenda_generada: false,
        mensajeAdvertencia: null
      });
    }

    if (requiereProfe && tipoGeneraPlanillaYAgenda && !sedeIdEfectivo) {
      await t.rollback();
      return res.status(400).json({
        mensajeError:
          'No se pudo resolver la sede del prospecto para asignar profesor.'
      });
    }

    // Benjamin Orellana - 2026/04/27 - Si desde ventas se marca que necesita profesor y el tipo corresponde, se asigna instructor con la misma lógica del flujo público general.
    if (requiereProfe && tipoGeneraPlanillaYAgenda) {
      const profesoresDisponibles = await db.query(
        `
        SELECT
          rh.id,
          rh.usuario_id,
          u.email,
          u.name,
          u.level,
          rh.hora_entrada,
          rh.hora_salida
        FROM rrhh_horarios rh
        INNER JOIN users u
          ON u.id = rh.usuario_id
        WHERE rh.sede_id = :sedeId
          AND rh.dia_semana = :diaSemana
          AND rh.eliminado = 0
          AND u.level = 'instructor'
          AND rh.fecha_vigencia_desde <= :fechaClase
          AND (rh.fecha_vigencia_hasta IS NULL OR rh.fecha_vigencia_hasta >= :fechaClase)
          AND rh.hora_entrada <= :horaClase
          AND rh.hora_salida > :horaClase
        ORDER BY rh.hora_salida DESC, rh.hora_entrada ASC, rh.id ASC
        LIMIT 1
        `,
        {
          replacements: {
            sedeId: sedeIdEfectivo,
            diaSemana,
            fechaClase: fecha,
            horaClase: horaClaseNormalizada
          },
          type: QueryTypes.SELECT,
          transaction: t
        }
      );

      profesorAsignado = profesoresDisponibles?.[0] || null;

      // Benjamin Orellana - 2026/04/27 - Si al instructor actual le quedan 30 minutos o menos y existe relevo cercano, se asigna el siguiente.
      if (profesorAsignado) {
        const minutosRestantes = diferenciaMinutosEntreHoras(
          horaClaseNormalizada,
          profesorAsignado.hora_salida
        );

        if (minutosRestantes !== null && minutosRestantes <= 30) {
          const horaLimiteRelevo = sumarMinutosAHora(horaClaseNormalizada, 30);

          const proximosProfesores = await db.query(
            `
            SELECT
              rh.id,
              rh.usuario_id,
              u.email,
              u.name,
              u.level,
              rh.hora_entrada,
              rh.hora_salida
            FROM rrhh_horarios rh
            INNER JOIN users u
              ON u.id = rh.usuario_id
            WHERE rh.sede_id = :sedeId
              AND rh.dia_semana = :diaSemana
              AND rh.eliminado = 0
              AND u.level = 'instructor'
              AND rh.fecha_vigencia_desde <= :fechaClase
              AND (rh.fecha_vigencia_hasta IS NULL OR rh.fecha_vigencia_hasta >= :fechaClase)
              AND rh.hora_entrada > :horaClase
              AND rh.hora_entrada <= :horaLimiteRelevo
            ORDER BY rh.hora_entrada ASC, rh.hora_salida DESC, rh.id ASC
            LIMIT 1
            `,
            {
              replacements: {
                sedeId: sedeIdEfectivo,
                diaSemana,
                fechaClase: fecha,
                horaClase: horaClaseNormalizada,
                horaLimiteRelevo
              },
              type: QueryTypes.SELECT,
              transaction: t
            }
          );

          if (proximosProfesores?.[0]) {
            profesorAsignado = proximosProfesores[0];
          }
        }
      }

      if (profesorAsignado) {
        // Benjamin Orellana - 2026/04/27 - Se utiliza un marcador técnico en motivo para reutilizar el mismo alumno prospecto interno en reprogramaciones futuras.
        const marcadorAlumno = `VENTAS_PROSPECTO_INTERNO:${prospecto.id}`;

        const alumnoExistente = await AlumnosModel.findOne({
          where: {
            prospecto: 'prospecto',
            motivo: marcadorAlumno
          },
          order: [['id', 'DESC']],
          transaction: t
        });

        const datosAlumno = {
          nombre: prospecto.nombre,
          prospecto: 'prospecto',
          c: '',
          socio_origen: null,
          socio_origen_mes: null,
          socio_origen_anio: null,
          email: profesorAsignado.email || null,
          celular: prospecto.contacto || null,
          punto_d: null,
          motivo: marcadorAlumno,
          user_id: profesorAsignado.usuario_id,
          fecha_creacion: new Date(),
          mes,
          anio
        };

        if (alumnoExistente) {
          await alumnoExistente.update(datosAlumno, { transaction: t });
          alumnoCreadoOActualizado = alumnoExistente;
        } else {
          alumnoCreadoOActualizado = await AlumnosModel.create(datosAlumno, {
            transaction: t
          });
        }

        const contenidoAgenda = `PENDIENTE`;

        const agendaExistente = await AgendasModel.findOne({
          where: {
            alumno_id: alumnoCreadoOActualizado.id,
            agenda_num: Number(camposClase.numero),
            mes,
            anio
          },
          transaction: t
        });

        if (agendaExistente) {
          await agendaExistente.update(
            {
              contenido: contenidoAgenda,
              fecha_creacion: new Date()
            },
            { transaction: t }
          );

          agendaCreadaOActualizada = agendaExistente;
        } else {
          agendaCreadaOActualizada = await AgendasModel.create(
            {
              alumno_id: alumnoCreadoOActualizado.id,
              agenda_num: Number(camposClase.numero),
              contenido: contenidoAgenda,
              fecha_creacion: new Date(),
              mes,
              anio
            },
            { transaction: t }
          );
        }
      } else {
        mensajeAdvertencia =
          'No se encontró un profesor disponible para la sede, día y horario seleccionados.';
      }
    }

    await prospecto.update(datosActualizacionProspecto, { transaction: t });

    await t.commit();

    return res.status(200).json({
      message: 'Clase interna sincronizada correctamente.',
      prospecto_id: prospecto.id,
      numero_clase: camposClase.numero,
      pilates_flujo_existente: false,
      profesor_asignado: !!profesorAsignado,
      profesor: profesorAsignado
        ? {
            usuario_id: profesorAsignado.usuario_id,
            nombre: profesorAsignado.name,
            email: profesorAsignado.email
          }
        : null,
      alumno_generado: !!alumnoCreadoOActualizado,
      alumno: alumnoCreadoOActualizado,
      agenda_generada: !!agendaCreadaOActualizada,
      agenda: agendaCreadaOActualizada,
      horario: horarioProspectoSincronizado,
      mensajeAdvertencia
    });
  } catch (error) {
    try {
      await t.rollback();
    } catch {}

    console.error('Error en SYNC_VentasProspectoClaseInterna_CTS:', error);

    return res.status(500).json({
      mensajeError:
        'Ocurrió un error al sincronizar la clase interna desde ventas.',
      detalle: error.message
    });
  }
};

// Benjamin Orellana - 2026/04/27 - Determina si una actividad pertenece al flujo especial de Pilates.
const esActividadPilates = (actividad) =>
  normalizarTextoComparacion(actividad) === 'pilates';

// Benjamin Orellana - 2026/04/27 - Limpia las columnas de clases del prospecto para obligar a reagendar al cambiar de actividad.
const buildPayloadLimpiezaClasesProspecto = () => ({
  clase_prueba_1_fecha: null,
  clase_prueba_1_obs: null,
  clase_prueba_1_tipo: null,
  clase_prueba_2_fecha: null,
  clase_prueba_2_obs: null,
  clase_prueba_2_tipo: null,
  clase_prueba_3_fecha: null,
  clase_prueba_3_obs: null,
  clase_prueba_3_tipo: null,
  necesita_profe: false
});

// Benjamin Orellana - 2026/04/27 - Limpia el flujo general no-Pilates asociado al prospecto interno de ventas.
const limpiarFlujoGeneralNoPilatesPorProspecto = async (
  prospectoId,
  transaction
) => {
  const marcadorAlumno = `VENTAS_PROSPECTO_INTERNO:${prospectoId}`;

  const alumnos = await AlumnosModel.findAll({
    where: {
      prospecto: 'prospecto',
      motivo: marcadorAlumno
    },
    transaction
  });

  const alumnoIds = alumnos.map((a) => a.id).filter(Boolean);

  let agendasEliminadas = 0;
  let alumnosEliminados = 0;

  if (alumnoIds.length > 0) {
    agendasEliminadas = await AgendasModel.destroy({
      where: {
        alumno_id: {
          [Op.in]: alumnoIds
        }
      },
      transaction
    });

    alumnosEliminados = await AlumnosModel.destroy({
      where: {
        id: {
          [Op.in]: alumnoIds
        }
      },
      transaction
    });
  }

  return {
    alumnosEliminados,
    agendasEliminadas
  };
};

// Benjamin Orellana - 2026/04/27 - Limpia el flujo especial de Pilates asociado al prospecto.
const limpiarFlujoPilatesPorProspecto = async (prospecto, transaction) => {
  let horariosVentasEliminados = 0;
  let clientesPilatesEliminados = 0;
  let inscripcionesPilatesEliminadas = 0;
  let asistenciasPilatesEliminadas = 0;

  horariosVentasEliminados = await VentasProspectosHorariosModel.destroy({
    where: {
      prospecto_id: prospecto.id
    },
    transaction
  });

  const clientesPilates = await ClientesPilatesModel.findAll({
    where: {
      [Op.or]: [
        { id: prospecto.id },
        {
          nombre: prospecto.nombre,
          telefono: prospecto.contacto || null,
          estado: {
            [Op.in]: ['Clase de prueba', 'Renovacion programada']
          }
        }
      ]
    },
    transaction
  });

  const clienteIds = [...new Set(clientesPilates.map((c) => c.id).filter(Boolean))];

  if (clienteIds.length > 0) {
    const inscripciones = await InscripcionesPilatesModel.findAll({
      attributes: ['id'],
      where: {
        id_cliente: {
          [Op.in]: clienteIds
        }
      },
      transaction
    });

    const inscripcionIds = inscripciones.map((i) => i.id).filter(Boolean);

    if (inscripcionIds.length > 0) {
      try {
        const [resultadoDeleteAsistencias] = await db.query(
          `
          DELETE FROM asistencias_pilates
          WHERE id_inscripcion IN (:inscripcionIds)
          `,
          {
            replacements: { inscripcionIds },
            transaction
          }
        );

        asistenciasPilatesEliminadas =
          resultadoDeleteAsistencias?.affectedRows ||
          resultadoDeleteAsistencias?.rowCount ||
          0;
      } catch (error) {
        console.warn(
          'No se pudieron eliminar asistencias_pilates durante el cambio de actividad:',
          error.message
        );
      }
    }

    inscripcionesPilatesEliminadas = await InscripcionesPilatesModel.destroy({
      where: {
        id_cliente: {
          [Op.in]: clienteIds
        }
      },
      transaction
    });

    clientesPilatesEliminados = await ClientesPilatesModel.destroy({
      where: {
        id: {
          [Op.in]: clienteIds
        }
      },
      transaction
    });
  }

  return {
    horariosVentasEliminados,
    clientesPilatesEliminados,
    inscripcionesPilatesEliminadas,
    asistenciasPilatesEliminadas
  };
};

// Benjamin Orellana - 2026/04/27 - Cambia la actividad del prospecto limpiando dependencias cuando cruza entre el flujo general y el flujo especial de Pilates.
export const CAMBIAR_ActividadVentasProspecto_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const { id } = req.params;
    const { actividad_nueva } = req.body;

    const ACTIVIDADES_VALIDAS_CAMBIO = [
      'No especifica',
      'Musculacion',
      'Pilates',
      'Clases grupales',
      'Pase full'
    ];

    if (!id || Number.isNaN(Number(id))) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'El id del prospecto es inválido.'
      });
    }

    if (
      !actividad_nueva ||
      !ACTIVIDADES_VALIDAS_CAMBIO.includes(actividad_nueva)
    ) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'La nueva actividad no es válida.'
      });
    }

    const prospecto = await VentasProspectosModel.findByPk(id, {
      transaction: t
    });

    if (!prospecto) {
      await t.rollback();
      return res.status(404).json({
        mensajeError: 'Prospecto no encontrado.'
      });
    }

    const actividadAnterior = prospecto.actividad;
    const actividadNueva = actividad_nueva;

    if (actividadAnterior === actividadNueva) {
      await t.rollback();
      return res.status(200).json({
        message: 'La actividad no cambió.',
        actividad_anterior: actividadAnterior,
        actividad_nueva: actividadNueva,
        limpieza_realizada: false
      });
    }

    const veniaDePilates = esActividadPilates(actividadAnterior);
    const vaAPilates = esActividadPilates(actividadNueva);

    let resumenLimpieza = {
      flujoGeneral: {
        alumnosEliminados: 0,
        agendasEliminadas: 0
      },
      flujoPilates: {
        horariosVentasEliminados: 0,
        clientesPilatesEliminados: 0,
        inscripcionesPilatesEliminadas: 0,
        asistenciasPilatesEliminadas: 0
      }
    };

    let limpiezaRealizada = false;

    // Benjamin Orellana - 2026/04/27 - Solo se limpia profundo si cambia entre la familia Pilates y la familia no-Pilates.
    if (veniaDePilates !== vaAPilates) {
      if (veniaDePilates) {
        resumenLimpieza.flujoPilates = await limpiarFlujoPilatesPorProspecto(
          prospecto,
          t
        );
      } else {
        resumenLimpieza.flujoGeneral =
          await limpiarFlujoGeneralNoPilatesPorProspecto(prospecto.id, t);
      }

      limpiezaRealizada = true;
    }

    const payloadUpdate = {
      actividad: actividadNueva,
      ...buildPayloadLimpiezaClasesProspecto()
    };

    await prospecto.update(payloadUpdate, { transaction: t });

    await t.commit();

    return res.status(200).json({
      message: limpiezaRealizada
        ? 'Actividad cambiada y dependencias limpiadas correctamente.'
        : 'Actividad cambiada correctamente.',
      prospecto_id: prospecto.id,
      actividad_anterior: actividadAnterior,
      actividad_nueva: actividadNueva,
      limpieza_realizada: limpiezaRealizada,
      resumen_limpieza: resumenLimpieza
    });
  } catch (error) {
    try {
      await t.rollback();
    } catch {}

    console.error('Error en CAMBIAR_ActividadVentasProspecto_CTS:', error);

    return res.status(500).json({
      mensajeError: 'No se pudo cambiar la actividad del prospecto.',
      detalle: error.message
    });
  }
};


VentasProspectosModel.hasMany(VentasProspectosHorariosModel, {
  foreignKey: 'prospecto_id',
  as: 'horarios'
});
// Asociación con UserModel
VentasProspectosModel.belongsTo(UserModel, {
  foreignKey: 'usuario_id',
  as: 'usuario'
});
