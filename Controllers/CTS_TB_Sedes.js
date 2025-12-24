/*
  * Programador: Benjamin Orellana
  * Fecha Creación:  17 de Abril 2025
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_Sedes.js) contiene controladores para manejar operaciones CRUD en el modelo 'SedeModel'.
   
  * Tema: Controladores - Sedes
  
  * Capa: Backend
  
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla SedeModel
// ----------------------------------------------------------------

// Importa el modelo SedeModel desde el archivo de modelos
import MD_TB_sedes from '../Models/MD_TB_sedes.js';
import MD_TB_HorariosPilates from '../Models/MD_TB_HorariosPilates.js';
import MD_TB_InscripcionesPilates from '../Models/MD_TB_InscripcionesPilates.js';
import { insertarHorariosPorDefectoParaSedeCiudad } from './CTS_TB_HorariosPilates.js';

const SedeModel = MD_TB_sedes.SedeModel;
const HorariosPilatesModel = MD_TB_HorariosPilates.HorariosPilatesModel;
const InscripcionesPilatesModel = MD_TB_InscripcionesPilates;
import { fn, col } from 'sequelize';


// Mostrar todos los registros de sedes
export const OBRS_Sede_CTS = async (req, res) => {
  try {
    const registros = await SedeModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de sede por su ID
export const OBR_Sede_CTS = async (req, res) => {
  try {
    const registro = await SedeModel.findByPk(req.params.id);
    if (registro) {
      res.json(registro);
    } else {
      res.status(404).json({ mensajeError: 'Sede no encontrada' });
    }
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en SedeModel
export const CR_Sede_CTS = async (req, res) => {
  try {
    const { nombre, estado, cupo_maximo_pilates, es_ciudad } = req.body;
    const registro = await SedeModel.create({ nombre, estado, cupo_maximo_pilates, es_ciudad });
    if (es_ciudad === 1) {
      const horariosResult = await insertarHorariosPorDefectoParaSedeCiudad(registro.id);
      if (!horariosResult.success) {
        return res
          .status(500)
          .json({
            message: "Sede creada, pero error al insertar horarios",
            error: horariosResult.message,
            registro,
          });
      }
    }
    res.json({ message: 'Sede creada correctamente', registro });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Eliminar un registro de SedeModel por su ID
export const ER_Sede_CTS = async (req, res) => {
  try {
    const sedeId = req.params.id;

    // 1. Obtener ids de horarios vinculados a la sede
    const horarios = await HorariosPilatesModel.findAll({ where: { id_sede: sedeId }, attributes: ['id'] });
    const horariosIds = horarios.map(h => h.id);

    // 2. Obtener ids de inscripciones vinculadas a esos horarios
    let inscripcionesIds = [];
    if (horariosIds.length > 0) {
      const inscripciones = await InscripcionesPilatesModel.findAll({ where: { id_horario: horariosIds }, attributes: ['id'] });
      inscripcionesIds = inscripciones.map(i => i.id);
    }

    // 3. Eliminar asistencias vinculadas a las inscripciones
    if (inscripcionesIds.length > 0) {
      const { default: AsistenciasPilatesModel } = await import('../Models/MD_TB_AsistenciasPilates.js');
      await AsistenciasPilatesModel.destroy({ where: { id_inscripcion: inscripcionesIds } });
    }

    // 4. Eliminar inscripciones vinculadas a los horarios
    if (horariosIds.length > 0) {
      await InscripcionesPilatesModel.destroy({ where: { id_horario: horariosIds } });
    }

    // 5. Eliminar horarios vinculados a la sede
    if (horariosIds.length > 0) {
      await HorariosPilatesModel.destroy({ where: { id: horariosIds } });
    }

    // 6. Eliminar lista de espera vinculada a la sede
    const { default: ListaEsperaPilatesModel } = await import('../Models/MD_TB_ListaEsperaPilates.js');
    await ListaEsperaPilatesModel.destroy({ where: { id_sede: sedeId } });

    // 7. Eliminar la sede
    const numRowsDeleted = await SedeModel.destroy({
      where: { id: sedeId }
    });

    // 8. (Comentado) Eliminar usuarios vinculados a la sede
    // const { default: UsuarioPilatesModel } = await import('../Models/MD_TB_UsuariosPilates.js');
    // await UsuarioPilatesModel.destroy({ where: { sede_id: sedeId } });

    if (numRowsDeleted === 1) {
      res.json({ message: 'Sede eliminada correctamente' });
    } else {
      res.status(404).json({ mensajeError: 'Sede no encontrada' });
    }
  } catch (error) {
    console.error("El error es:", error);
    res.json({ mensajeError: error.message });
  }
};

export const ObtenerCantidadAlumnosPorSede_CTS = async (req, res) => {
  try {
    // Traer las sedes que son ciudad, con sus horarios y las inscripciones de cada horario
    const sedes = await SedeModel.findAll({
      where: { es_ciudad: true },
      attributes: ["id", "nombre"],
      include: [
        {
          model: HorariosPilatesModel,
          as: "horarios",
          attributes: ["id"],
          include: [
            {
              model: InscripcionesPilatesModel,
              as: "inscripciones",
              attributes: ["id_cliente"],
            },
          ],
        },
      ],
    });

    // Procesar los datos para obtener el máximo de inscriptos por sede
    const resultados = sedes.map(sede => {
      const max_inscriptos = sede.horarios.length > 0
        ? Math.max(...sede.horarios.map(h => h.inscripciones.length))
        : 0;
      return {
        sede_id: sede.id,
        sede_nombre: sede.nombre,
        max_inscriptos,
      };
    });

    res.json(resultados);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
// Actualizar un registro de SedeModel por su ID
export const UR_Sede_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await SedeModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await SedeModel.findByPk(id);

      if (registroActualizado.es_ciudad) {
        // Contamos si ya tiene horarios para no crear duplicados
        const horariosExistentes = await HorariosPilatesModel.count({
          where: { id_sede: id },
        });
        // Si es de Pilates y NO tiene horarios, los creamos
        if (horariosExistentes === 0) {
          console.log(`La sede ${registroActualizado.nombre} (ID: ${id}) fue marcada para Pilates y no tenía horarios. Creando horarios por defecto...`);
          await insertarHorariosPorDefectoParaSedeCiudad(id);
        }
      }
      res.json({
        message: 'Sede actualizada correctamente',
        registroActualizado
      });
    } else {
      res.status(404).json({ mensajeError: 'Sede no encontrada' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
;

//Traer solamente las sedes que son ciudades (pilates)
export const OBRS_SedesCiudad_CTS = async (req, res) => {
  try {
    const sedes = await SedeModel.findAll({
      where: { es_ciudad: true },
      attributes: ["id", "nombre", "cupo_maximo_pilates"]
    });
    res.json(sedes);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
