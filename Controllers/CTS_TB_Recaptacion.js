/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 14 / 06 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (CTS_TB_Recaptacion.js) contiene controladores para manejar operaciones CRUD sobre la tabla de recaptación.
 *
 * Tema: Controladores - Recaptación
 *
 * Capa: Backend
 *
 * Nomenclatura:
 *   OBR_  obtenerRegistro
 *   OBRS_ obtenerRegistros
 *   CR_   crearRegistro
 *   ER_   eliminarRegistro
 *   UR_   actualizarRegistro
 */

// Importa el modelo
import MD_TB_Recaptacion from '../Models/MD_TB_Recaptacion.js';
const RecaptacionModel = MD_TB_Recaptacion.RecaptacionModel;

// Importar modelo de notificaciones si se desea generar
import NotificationModel from '../Models/MD_TB_Notifications.js';
import { Op } from 'sequelize'; // Importar operadores de Sequelize

// Obtener todos los registros (opcionalmente filtrados por usuario o acceso admin)

export const OBRS_Recaptacion_CTS = async (req, res) => {
  const { usuario_id, level, mes, anio } = req.query;

  try {
    let whereClause = {};

    // Si no es admin, debe enviar usuario_id obligatoriamente
    if (level !== 'admin') {
      if (!usuario_id) {
        return res.status(400).json({ mensajeError: 'Debe enviar usuario_id' });
      }
      whereClause.usuario_id = usuario_id;
    }

    // Filtro opcional por mes y anio
    if (mes) {
      whereClause.mes = mes;
    }
    if (anio) {
      whereClause.anio = anio;
    }

    const registros = await RecaptacionModel.findAll({ where: whereClause });

    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener un solo registro por ID
export const OBR_Recaptacion_CTS = async (req, res) => {
  try {
    const registro = await RecaptacionModel.findByPk(req.params.id);
    if (!registro)
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    res.json(registro);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear registros nuevos (uno o varios desde Excel o formulario)
export const CR_Recaptacion_CTS = async (req, res) => {
  const { registros } = req.body; // registros: array de objetos con nombre, tipo_contacto, usuario_id

  if (!registros || !Array.isArray(registros)) {
    return res.status(400).json({
      mensajeError: 'Formato inválido: debe enviar un array de registros'
    });
  }

  try {
    const creados = await RecaptacionModel.bulkCreate(registros);

    // Notificación opcional
    await NotificationModel.create({
      title: 'Nueva lista de recaptación',
      message: `Se cargaron ${creados.length} registros nuevos.`,
      module: 'recaptacion',
      reference_id: creados[0].id,
      seen_by: [],
      created_by: 'sistema'
    });

    res.json({ message: 'Registros creados correctamente', data: creados });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar un registro
export const ER_Recaptacion_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const eliminado = await RecaptacionModel.destroy({ where: { id } });

    if (!eliminado)
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });

    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar seguimiento (enviado, respondido, etc.)
export const UR_Recaptacion_CTS = async (req, res) => {
  const { id } = req.params;

  try {
    const [updated] = await RecaptacionModel.update(req.body, {
      where: { id }
    });

    if (updated === 1) {
      const actualizado = await RecaptacionModel.findByPk(id);
      res.json({ message: 'Registro actualizado', actualizado });
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
