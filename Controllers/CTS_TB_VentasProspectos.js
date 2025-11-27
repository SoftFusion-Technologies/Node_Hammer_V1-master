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
import { Op } from 'sequelize';
import { VentasComisionesModel } from '../Models/MD_TB_ventas_comisiones.js';
import db from '../DataBase/db.js';

// Obtener todos los registros (puede filtrar por usuario_id o sede)
export const OBRS_VentasProspectos_CTS = async (req, res) => {
  const { usuario_id, sede, mes, anio } = req.query;

  try {
    let whereClause = {};
    if (usuario_id) whereClause.usuario_id = usuario_id;
    if (sede) whereClause.sede = sede;

    // Si mes y año están presentes, filtramos por rango de fechas
    if (mes && anio) {
      const startDate = new Date(anio, mes - 1, 1); // Primer día del mes
      const endDate = new Date(anio, mes, 1); // Primer día del mes siguiente

      whereClause.fecha = {
        [Op.gte]: startDate,
        [Op.lt]: endDate
      };
    }

    const registros = await VentasProspectosModel.findAll({
      where: whereClause
    });

    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};


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

    const prospecto = await VentasProspectosModel.findByPk(id, { transaction: t });
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
        ['fecha', 'clase_prueba_1_fecha', 'clase_prueba_2_fecha', 'clase_prueba_3_fecha'].includes(k)
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
        const origen = Object.prototype.hasOwnProperty.call(body, 'campania_origen')
          ? String(body.campania_origen ?? '').trim()
          : String(prospecto.campania_origen ?? '').trim();
        if (!origen) {
          await t.rollback();
          return res.status(400).json({ mensajeError: 'Debe especificar el origen de la campaña' });
        }
        campos.campania_origen = origen;
      } else {
        campos.campania_origen = '';
      }
    }

    // 2) Bloquear intento de activar comisión desde UR
    if (Object.prototype.hasOwnProperty.call(body, 'comision') && body.comision === true) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'Use el endpoint de conversión para registrar una comisión.'
      });
    }

    // 3) Si desmarcan "convertido"
    const revierteConversion =
      Object.prototype.hasOwnProperty.call(body, 'convertido') && body.convertido === false;

    if (revierteConversion) {
      // limpiar metadata en el prospecto
      campos.comision = false;
      campos.comision_registrada_at = null;
      campos.comision_usuario_id = null;
      campos.comision_estado = null;
      campos.comision_id = null;

      // regla nueva: si tenía comisión y está RECHAZADA, ELIMINARLA (para que no aparezca en "Ver comisiones")
      if (prospecto.comision_id) {
        const com = await VentasComisionesModel.findByPk(prospecto.comision_id, { transaction: t });

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
                motivo_rechazo: 'Conversión revertida desde edición del prospecto.'
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
      return res.status(400).json({ mensajeError: 'Sin campos válidos para actualizar' });
    }

    const [n] = await VentasProspectosModel.update(campos, { where: { id }, transaction: t });
    if (!n) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Prospecto no encontrado' });
    }

    const data = await VentasProspectosModel.findByPk(id, { transaction: t });
    await t.commit();
    return res.json(data);
  } catch (err) {
    try { await t.rollback(); } catch {}
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
      dni = "Sin DNI",
      tipo_prospecto = "Nuevo",
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
    if (!usuario_id || !nombre || !contacto || !canal_contacto || !actividad || !sede) {
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
        clase_prueba_1_fecha: clase_prueba_1_fecha ? new Date(clase_prueba_1_fecha) : null,
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


VentasProspectosModel.hasMany(VentasProspectosHorariosModel, {
  foreignKey: 'prospecto_id',
  as: 'horarios'
});
// Asociación con UserModel
VentasProspectosModel.belongsTo(UserModel, {
  foreignKey: 'usuario_id',
  as: 'usuario'
});
