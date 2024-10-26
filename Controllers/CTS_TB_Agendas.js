/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 22-10-2024
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (CTS_TB_Agendas.js) contiene controladores para manejar operaciones CRUD en el modelo de agendas.
 *
 * Tema: Controladores - Agendas
 *
 * Capa: Backend
 *
 * Nomenclatura: OBR_ obtenerRegistro
 *               OBRS_obtenerRegistros(plural)
 *               CR_ crearRegistro
 *               ER_ eliminarRegistro
 */

// Importa los modelos necesarios desde el archivo de modelos
import MD_TB_Agendas from '../Models/MD_TB_Agendas.js';

// Asigna los modelos a variables para su uso en los controladores
const AgendasModel = MD_TB_Agendas.AgendasModel;

// Controladores para operaciones CRUD en la tabla 'agendas'

// Mostrar todos los registros de la tabla agendas
export const OBRS_Agendas_CTS = async (req, res) => {
  try {
    const registros = await AgendasModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de Agendas por su ID
export const OBR_Agendas_CTS = async (req, res) => {
  try {
    const registro = await AgendasModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Verificar si existe una agenda para un alumno y un número de agenda específicos
export const GET_Agenda_CTS = async (req, res) => {
  try {
    const { alumno_id, agenda_num } = req.params;
    const agenda = await AgendasModel.findOne({
      where: { alumno_id, agenda_num },
    });

    if (agenda) {
      res.json({ existe: true, id: agenda.id, agenda });
    } else {
      res.json({ existe: false });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en Agendas
export const CR_Agendas_CTS = async (req, res) => {
  try {
    const { alumno_id, agenda_num, contenido } = req.body;

    // Crear el registro en la base de datos
    const agendaCreada = await AgendasModel.create({
      alumno_id,
      agenda_num,
      contenido,
    });
    
    res.status(201).json({
      message: 'Agenda creada correctamente',
      agenda: agendaCreada,
    });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};


// Eliminar un registro en Agendas por su ID
export const ER_Agendas_CTS = async (req, res) => {
  try {
    await AgendasModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Actualizar un registro en Agendas por su ID
export const UR_Agendas_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await AgendasModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await AgendasModel.findByPk(id);
      res.json({
        message: 'Registro actualizado correctamente',
        registroActualizado
      });
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
