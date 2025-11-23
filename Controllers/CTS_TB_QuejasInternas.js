/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 30/04/2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (CTS_TB_QuejasInternas.js) contiene controladores para manejar operaciones CRUD
 * y acciones especiales en el modelo QuejasInternas.
 * Tema: Controladores - Quejas Internas
 * Capa: Backend
 * Nomenclatura: OBR_ obtenerRegistro
 *               OBRS_obtenerRegistros(plural)
 *               CR_ crearRegistro
 *               UR_ actualizarRegistro
 *               ER_ eliminarRegistro
 */

// Importa el modelo
import MD_TB_QuejasInternas from '../Models/MD_TB_QuejasInternas.js';
import QuejasPilatesModel from '../Models/MD_TB_QuejasPilates.js';
import NotificationModel from '../Models/MD_TB_Notifications.js';
import { Op } from 'sequelize';

// Asigna el modelo a una variable
const QuejasInternasModel = MD_TB_QuejasInternas.QuejasInternasModel;

const toCanonical = (s = '') =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

function getUserFromReq(req) {
  const userLevel = (
    req.query.userLevel ??
    req.body?.userLevel ??
    ''
  ).toString();
  const userName = (req.query.userName ?? req.body?.userName ?? '').toString();
  return {
    email: userName.trim().toLowerCase(),
    levelCanon: toCanonical(userLevel)
  };
}

function isCoordinator(levelCanon) {
  return ['ADMIN', 'ADMINISTRADOR', 'GERENTE'].includes(levelCanon);
}

export const OBRS_Quejas_CTS = async (req, res) => {
  try {
    const { email, levelCanon } = getUserFromReq(req);
    if (!email || !levelCanon) {
      return res
        .status(400)
        .json({ mensajeError: 'Faltan userName o userLevel.' });
    }

    // Filtro de permisos: Si es coordinador ve todo, si no, solo lo suyo
    const whereClause = isCoordinator(levelCanon) ? {} : { cargado_por: email };

    // 1. Ejecutamos ambas consultas en paralelo (Promise.all es más rápido)
    const [registrosInternos, registrosPilates] = await Promise.all([
      QuejasInternasModel.findAll({
        where: whereClause,
        raw: true // Traemos objetos planos para poder modificarlos fácil
      }),
      QuejasPilatesModel.findAll({
        where: whereClause,
        raw: true
      })
    ]);

    // 2. Procesamos y etiquetamos GIMNASIO
    const internasMarcadas = registrosInternos.map((q) => ({
      ...q,
      // 🔹 Usamos created_at como fecha canon (ya NO dependemos de la columna fecha)
      fecha: q.created_at,
      origen: 'GIMNASIO', // Etiqueta para el frontend (Badge)
      es_pilates: false, // Flag lógico
      tabla_origen: 'interna' // Útil si necesitas saber a qué endpoint llamar para borrar/editar
    }));

    // 3. Procesamos y etiquetamos PILATES
    const pilatesMarcadas = registrosPilates.map((q) => ({
      ...q,
      // 🔹 También usamos created_at para Pilates
      fecha: q.created_at,
      origen: 'PILATES',
      es_pilates: true,
      tabla_origen: 'pilates',
      tipo_usuario: 'cliente pilates',
      creado_desde_qr: 0
    }));

    // 4. UNIFICAMOS ambas listas
    const listaUnificada = [...internasMarcadas, ...pilatesMarcadas];

    // 5. ORDENAMOS cronológicamente (lo más nuevo primero)
    listaUnificada.sort((a, b) => {
      const fechaA = a.fecha ? new Date(a.fecha) : 0;
      const fechaB = b.fecha ? new Date(b.fecha) : 0;
      return fechaB - fechaA; // Orden Descendente (Mayor a menor)
    });

    // 6. Enviamos la lista lista para consumir
    return res.json(listaUnificada);
  } catch (error) {
    console.error('Error al obtener quejas unificadas:', error);
    return res.status(500).json({ mensajeError: error.message });
  }
};


export const OBR_Queja_CTS = async (req, res) => {
  try {
    const { email, levelCanon } = getUserFromReq(req);
    if (!email || !levelCanon) {
      return res
        .status(400)
        .json({ mensajeError: 'Faltan userName o userLevel.' });
    }

    const registro = await QuejasInternasModel.findByPk(req.params.id);
    if (!registro)
      return res.status(404).json({ mensajeError: 'No encontrado.' });

    // Si no es admin/gerente, solo puede ver lo que cargó él
    if (
      !isCoordinator(levelCanon) &&
      String(registro.cargado_por).toLowerCase() !== email
    ) {
      return res.status(403).json({ mensajeError: 'Sin permiso.' });
    }

    return res.json(registro);
  } catch (error) {
    return res.status(500).json({ mensajeError: error.message });
  }
};

// crear una queja y disparar la notificacion
export const CR_Queja_CTS = async (req, res) => {
  const { cargado_por, nombre, motivo, sede } = req.body;

  try {
    // 1. Crear la queja
    const nuevaQueja = await QuejasInternasModel.create(req.body);

    // 2. Crear la notificación relacionada usando Sequelize
    const notiTitle = 'Nueva queja registrada';
    const notiMessage = `Queja de ${nombre} en ${sede}. Motivo: ${motivo}`;
    const module = 'quejas';
    const reference_id = nuevaQueja.id;
    const seen_by = [];
    const created_by = cargado_por;

    // Crear la notificación en la base de datos
    await NotificationModel.create({
      title: notiTitle,
      message: notiMessage,
      module: module,
      reference_id: reference_id,
      seen_by: seen_by,
      created_by: created_by
    });

    res.json({
      message: 'Queja registrada y notificación enviada correctamente'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar una queja
export const UR_Queja_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await QuejasInternasModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await QuejasInternasModel.findByPk(id);
      res.json({
        message: 'Queja actualizada correctamente',
        registroActualizado
      });
    } else {
      res.status(404).json({ mensajeError: 'Queja no encontrada' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar una queja
export const ER_Queja_CTS = async (req, res) => {
  try {
    await QuejasInternasModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Queja eliminada correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Marcar como resuelto
export const MARCAR_Resuelto_Queja_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const { resuelto_por } = req.body; // nombre del usuario que resolvió

    const [numRowsUpdated] = await QuejasInternasModel.update(
      {
        resuelto: 1,
        resuelto_por,
        fecha_resuelto: new Date()
      },
      {
        where: { id }
      }
    );

    if (numRowsUpdated === 1) {
      res.json({ message: 'Queja marcada como resuelta' });
    } else {
      res.status(404).json({ mensajeError: 'Queja no encontrada' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Marcar como no resuelto (con confirmación desde el frontend)
export const MARCAR_NoResuelto_Queja_CTS = async (req, res) => {
  try {
    const { id } = req.params;

    const [numRowsUpdated] = await QuejasInternasModel.update(
      {
        resuelto: 0,
        resuelto_por: null,
        fecha_resuelto: null
      },
      {
        where: { id }
      }
    );

    if (numRowsUpdated === 1) {
      res.json({ message: 'Queja marcada como no resuelta' });
    } else {
      res.status(404).json({ mensajeError: 'Queja no encontrada' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
