/*
 * Descripción: Controlador para gestionar los horarios ocultos de Pilates.
 * Tema: Controladores - Horarios Ocultos Pilates
 * Capa: Backend
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 05/12/2025
 * Ultima Modificación: 05/12/2025
 * Versión: 1.0
 *
 * Nomenclatura:
 * OBRS_ obtenerRegistros (GET)
 * CR_   crearRegistro (POST - Ocultar horario)
 * ER_   eliminarRegistro (DELETE - Mostrar horario)
 */

import HorariosOcultosPilatesModel from '../Models/MD_TB-Horarios_deshabilitados_pilates.js';
import UsersModel from '../Models/MD_TB_Users.js';

// Obtener horarios ocultos de una sede específica
// GET /horarios-ocultos/:sedeId
export const OBRS_HorariosDeshabilitadosPilates_CTS = async (req, res) => {
  try {
    const { sedeId } = req.params;

    if (!sedeId) {
      return res.status(400).json({ mensajeError: 'El ID de la sede es requerido.' });
    }

    const registros = await HorariosOcultosPilatesModel.findAll({
      where: { sede_id: sedeId },
      include: [
        {
          model: UsersModel,
          as: 'usuario',
          attributes: ['id', 'name', 'email'] // Traemos el nombre del usuario que ocultó
        }
      ],
      order: [['hora_label', 'ASC']]
    });

    // Formateamos la respuesta si es necesario, o la enviamos directa
    // El frontend podrá acceder a: item.hora_label, item.creado_en, item.usuario.name
    res.json(registros);
  } catch (error) {
    console.error('Error al obtener horarios ocultos:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// Ocultar un horario (Crear registro)
// POST /horarios-ocultos
// Body: { sede_id, hora_label, creado_por }
export const CR_HorarioDeshabilitadoPilates_CTS = async (req, res) => {
  try {
    const { sede_id, hora_label, creado_por } = req.body;

    if (!sede_id || !hora_label) {
      return res.status(400).json({ mensajeError: 'Faltan datos obligatorios (sede_id, hora_label).' });
    }

    // Intentamos crear el registro.
    // Como la tabla tiene UNIQUE(sede_id, hora_label), si ya existe fallará o podemos usar findOrCreate.
    const [nuevoRegistro, creado] = await HorariosOcultosPilatesModel.findOrCreate({
      where: {
        sede_id: sede_id,
        hora_label: hora_label
      },
      defaults: {
        creado_por: creado_por || null, // ID del usuario que ejecuta la acción
        creado_en: new Date()
      }
    });

    if (!creado) {
      return res.status(409).json({ 
        mensajeError: `El horario ${hora_label} ya se encuentra oculto en esta sede.` 
      });
    }

    res.status(201).json({
      message: 'Horario ocultado correctamente',
      registro: nuevoRegistro
    });

  } catch (error) {
    console.error('Error al ocultar horario:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// Mostrar un horario (Eliminar registro de la tabla de ocultos)
// DELETE /horarios-ocultos?sede_id=X&hora_label=Y  <-- Opción A (Query Params)
// DELETE /horarios-ocultos/:id                     <-- Opción B (Por ID de registro, más RESTful)
// Aquí implementamos lógica para borrar por ID directo o por combinación sede/hora.
export const ER_HorarioDeshabilitadoPilates_CTS = async (req, res) => {
  try {
    // Aceptamos borrar por ID directo (si el front lo tiene) o por combinación sede/hora
    const { id } = req.params; 
    const { sede_id, hora_label } = req.query;

    let whereClause = {};

    if (id) {
      whereClause.id = id;
    } else if (sede_id && hora_label) {
      whereClause.sede_id = sede_id;
      whereClause.hora_label = hora_label;
    } else {
      return res.status(400).json({ 
        mensajeError: 'Se requiere ID o (sede_id y hora_label) para restaurar el horario.' 
      });
    }

    const eliminados = await HorariosOcultosPilatesModel.destroy({
      where: whereClause
    });

    if (eliminados === 0) {
      return res.status(404).json({ mensajeError: 'No se encontró el horario oculto para restaurar.' });
    }

    res.json({ message: 'Horario restaurado (visible nuevamente).' });

  } catch (error) {
    console.error('Error al restaurar horario:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};