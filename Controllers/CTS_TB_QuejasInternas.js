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
import MD_TB_QuejasInternasImagenes from '../Models/MD_TB_QuejasInternasImagenes.js';
const ImagenesModel = MD_TB_QuejasInternasImagenes.QuejasInternasImagenesModel;
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
        include: [{ model: ImagenesModel, as: 'imagenes' }]
      }),
      QuejasPilatesModel.findAll({
        where: whereClause,
        raw: true
      })
    ]);

    // 2. Procesamos y etiquetamos GIMNASIO
    const internasMarcadas = registrosInternos.map((q) => {
      const quejaPlana = q.get({ plain: true });
      const tieneImagenes = quejaPlana.imagenes && quejaPlana.imagenes.length > 0;
      
      return {
        ...quejaPlana,
        fecha: quejaPlana.created_at,
        origen: 'GIMNASIO', // Etiqueta para el frontend (Badge)
        es_pilates: false, // Flag lógico
        tabla_origen: 'interna', // Útil si necesitas saber a qué endpoint llamar para borrar/editar
        imagenes: tieneImagenes // Booleano que indica si tiene imágenes
      };
    });

    // 3. Procesamos y etiquetamos PILATES
    const pilatesMarcadas = registrosPilates.map((q) => ({
      ...q,
      // 🔹 También usamos created_at para Pilates
      fecha: q.created_at,
      origen: 'PILATES',
      es_pilates: true,
      tabla_origen: 'pilates',
      tipo_usuario: 'cliente pilates',
      creado_desde_qr: 0,
      imagenes: false // Las quejas de Pilates no tienen imágenes por ahora
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

    const registro = await QuejasInternasModel.findByPk(req.params.id, {
        include: [{ model: ImagenesModel, as: 'imagenes' }] 
    });

    if (!registro) return res.status(404).json({ mensajeError: 'No encontrado.' });

    // Si no es admin/gerente, solo puede ver lo que cargó él
    if (!isCoordinator(levelCanon) && String(registro.cargado_por).toLowerCase() !== email) return res.status(403).json({ mensajeError: 'Sin permiso.' });
    return res.json(registro);

    return res.json(registro);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

// crear una queja y disparar la notificacion
export const CR_Queja_CTS = async (req, res) => {
  const { cargado_por, nombre, motivo, sede } = req.body;

  try {
    // Crear la queja principal
    const nuevaQueja = await QuejasInternasModel.create(req.body);

    // Si el middleware Multer procesó archivos, los guardamos
    if (req.files && req.files.length > 0) {
      const promesas = req.files.map(archivo => {
        return ImagenesModel.create({
          id_queja: nuevaQueja.id,
          tipo: 'QR-PAGINA',
          url: archivo.filename 
        });
      });
      await Promise.all(promesas);
    }

    // Crear la notificación
    await NotificationModel.create({
      title: 'Nueva queja registrada',
      message: `Queja de ${nombre} en ${sede}. Motivo: ${motivo}`,
      module: 'quejas',
      reference_id: nuevaQueja.id,
      seen_by: [],
      created_by: cargado_por
    });

    res.json({ message: 'Queja registrada con éxito' });
  } catch (error) {
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
