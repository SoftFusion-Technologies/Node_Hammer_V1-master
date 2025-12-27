/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 21 / 12 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Controladores CRUD para la tabla 'integrantes_conve_notas' (historial de notas).
 *
 * Tema: Controladores - IntegrantesConveNotas
 * Capa: Backend
 *
 * Nomenclatura: OBR_  obtenerRegistro
 *              OBRS_ obtenerRegistros(plural)
 *              CR_   crearRegistro
 *              ER_   eliminarRegistro
 *              UR_   updateRegistro
 */
import { Op, fn, col } from 'sequelize';
import MD_TB_IntegrantesConveNotas from '../Models/MD_TB_IntegrantesConveNotas.js';

const IntegrantesConveNotasModel =
  MD_TB_IntegrantesConveNotas.IntegrantesConveNotasModel;

// Mostrar todas las notas (opcional: filtrar por integrante_conve_id)
export const OBRS_IntegrantesConveNotas_CTS = async (req, res) => {
  try {
    const { integrante_conve_id } = req.query;

    const where = {};
    if (integrante_conve_id) where.integrante_conve_id = integrante_conve_id;

    const registros = await IntegrantesConveNotasModel.findAll({
      where,
      order: [['created_at', 'DESC']]
    });

    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Mostrar una nota por ID
export const OBR_IntegrantesConveNotas_CTS = async (req, res) => {
  try {
    const registro = await IntegrantesConveNotasModel.findByPk(req.params.id);

    if (!registro) {
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }

    res.json(registro);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear una nota
export const CR_IntegrantesConveNotas_CTS = async (req, res) => {
  try {
    // Requeridos: integrante_conve_id, autor_nombre, nota
    await IntegrantesConveNotasModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar una nota por ID
export const ER_IntegrantesConveNotas_CTS = async (req, res) => {
  try {
    const num = await IntegrantesConveNotasModel.destroy({
      where: { id: req.params.id }
    });

    if (num === 0) {
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }

    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// (Opcional) Actualizar una nota por ID
export const UR_IntegrantesConveNotas_CTS = async (req, res) => {
  try {
    const { id } = req.params;

    const [numRowsUpdated] = await IntegrantesConveNotasModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await IntegrantesConveNotasModel.findByPk(id);
      return res.json({
        message: 'Registro actualizado correctamente',
        registroActualizado
      });
    }

    return res.status(404).json({ mensajeError: 'Registro no encontrado' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

/**
 * Devuelve el count de notas por integrante_conve_id
 * Ej:
 * GET /integrantes-conve-notas/counts?ids=10,11,12
 * => [{ integrante_conve_id: 10, count: 3 }, ...]
 */
export const OBRS_IntegrantesConveNotasCounts_CTS = async (req, res) => {
  try {
    const { ids } = req.query;

    if (!ids) {
      return res.status(400).json({
        mensajeError: "Falta query param 'ids' (ej: ?ids=1,2,3)"
      });
    }

    const idsArray = String(ids)
      .split(',')
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (idsArray.length === 0) {
      return res.status(400).json({ mensajeError: 'ids inválidos' });
    }

    const rows = await IntegrantesConveNotasModel.findAll({
      attributes: [
        'integrante_conve_id',
        [fn('COUNT', col('id')), 'count']
      ],
      where: { integrante_conve_id: { [Op.in]: idsArray } },
      group: ['integrante_conve_id']
    });

    // Si preferís devolver un map directo
    const map = {};
    for (const r of rows) {
      map[r.integrante_conve_id] = Number(r.get('count')) || 0;
    }

    return res.json({ map });
  } catch (error) {
    return res.status(500).json({ mensajeError: error.message });
  }
};