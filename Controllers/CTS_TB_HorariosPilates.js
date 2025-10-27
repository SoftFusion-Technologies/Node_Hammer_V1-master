/*
 * Programador: [Tu nombre]
 * Fecha Creación: [Fecha actual]
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo (CTS_TB_HorariosPilates.js) contiene controladores para manejar operaciones CRUD en el modelo HorariosPilates.
 *
 * Tema: Controladores - Horarios Pilates
 *
 * Capa: Backend
 *
 * Nomenclatura: OBR_ obtenerRegistro
 *               OBRS_obtenerRegistros(plural)
 *               CR_ crearRegistro
 *               ER_ eliminarRegistro
 *               UR_ actualizarRegistro
 */

import MD_TB_HorariosPilates from "../Models/MD_TB_HorariosPilates.js";
import db from "../DataBase/db.js";
import { SedeModel } from "../Models/MD_TB_sedes.js";

const HorariosPilatesModel = MD_TB_HorariosPilates.HorariosPilatesModel;

// Obtener todos los horarios pilates
export const OBRS_HorariosPilates_CTS = async (req, res) => {
  try {
    const { id_sede, dia_semana, id_instructor } = req.query;

    let whereClause = {};

    if (id_sede) {
      whereClause.id_sede = id_sede;
    }

    if (dia_semana) {
      whereClause.dia_semana = dia_semana.toUpperCase();
    }

    if (id_instructor) {
      whereClause.id_instructor = id_instructor;
    }

    const registros = await HorariosPilatesModel.findAll({
      where: whereClause,
      order: [
        ["dia_semana", "ASC"],
        ["hora_inicio", "ASC"],
      ],
    });

    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener un horario pilates por ID
export const OBR_HorariosPilates_CTS = async (req, res) => {
  try {
    const registro = await HorariosPilatesModel.findByPk(req.params.id);

    if (!registro) {
      return res.status(404).json({ mensajeError: "Horario no encontrado" });
    }

    res.json(registro);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener horarios por sede
export const OBRS_HorariosPorSede_CTS = async (req, res) => {
  try {
    const { id_sede } = req.params;

    const registros = await HorariosPilatesModel.findAll({
      where: { id_sede: id_sede },
      order: [
        ["dia_semana", "ASC"],
        ["hora_inicio", "ASC"],
      ],
    });

    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener horarios por instructor
export const OBRS_HorariosPorInstructor_CTS = async (req, res) => {
  try {
    const { id_instructor } = req.params;

    const registros = await HorariosPilatesModel.findAll({
      where: { id_instructor: id_instructor },
      order: [
        ["dia_semana", "ASC"],
        ["hora_inicio", "ASC"],
      ],
    });

    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener horarios por día de la semana
export const OBRS_HorariosPorDia_CTS = async (req, res) => {
  try {
    const { dia_semana } = req.params;

    const registros = await HorariosPilatesModel.findAll({
      where: { dia_semana: dia_semana.toUpperCase() },
      order: [["hora_inicio", "ASC"]],
    });

    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear un nuevo horario pilates
export const CR_HorariosPilates_CTS = async (req, res) => {
  try {
    const { id_sede, dia_semana, hora_inicio, hora_fin, id_instructor } =
      req.body;

    // Validaciones básicas
    if (!id_sede) {
      return res.status(400).json({ mensajeError: "El id_sede es requerido" });
    }

    if (!dia_semana) {
      return res
        .status(400)
        .json({ mensajeError: "El dia_semana es requerido" });
    }

    if (!hora_inicio) {
      return res
        .status(400)
        .json({ mensajeError: "La hora_inicio es requerida" });
    }

    // Validar que el día de la semana sea válido
    const diasValidos = [
      "LUNES",
      "MARTES",
      "MIERCOLES",
      "JUEVES",
      "VIERNES",
      "SABADO",
      "DOMINGO",
    ];
    if (!diasValidos.includes(dia_semana.toUpperCase())) {
      return res
        .status(400)
        .json({ mensajeError: "Día de la semana inválido" });
    }

    // Verificar conflictos de horarios para el mismo instructor (si se especifica)
    if (id_instructor) {
      const conflicto = await HorariosPilatesModel.findOne({
        where: {
          id_instructor: id_instructor,
          dia_semana: dia_semana.toUpperCase(),
          [db.Sequelize.Op.or]: [
            // El nuevo horario empieza durante un horario existente
            {
              hora_inicio: {
                [db.Sequelize.Op.lte]: hora_inicio,
              },
              hora_fin: {
                [db.Sequelize.Op.gt]: hora_inicio,
              },
            },
            // El nuevo horario termina durante un horario existente
            {
              hora_inicio: {
                [db.Sequelize.Op.lt]: hora_fin || "23:59:59",
              },
              hora_fin: {
                [db.Sequelize.Op.gte]: hora_fin || "23:59:59",
              },
            },
            // El nuevo horario envuelve un horario existente
            {
              hora_inicio: {
                [db.Sequelize.Op.gte]: hora_inicio,
              },
              hora_fin: {
                [db.Sequelize.Op.lte]: hora_fin || "23:59:59",
              },
            },
          ],
        },
      });

      if (conflicto) {
        return res.status(400).json({
          mensajeError:
            "El instructor ya tiene un horario asignado en ese día y hora",
        });
      }
    }

    // Crear el horario
    const nuevoHorario = await HorariosPilatesModel.create({
      id_sede,
      dia_semana: dia_semana.toUpperCase(),
      hora_inicio,
      hora_fin,
      id_instructor,
    });

    res.status(201).json({
      message: "Horario creado correctamente",
      horario: nuevoHorario,
    });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar un horario pilates
export const UR_HorariosPilates_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_sede, dia_semana, hora_inicio, hora_fin, id_instructor } =
      req.body;

    const horario = await HorariosPilatesModel.findByPk(id);

    if (!horario) {
      return res.status(404).json({ mensajeError: "Horario no encontrado" });
    }

    // Validar día de la semana si se está actualizando
    if (dia_semana) {
      const diasValidos = [
        "LUNES",
        "MARTES",
        "MIERCOLES",
        "JUEVES",
        "VIERNES",
        "SABADO",
        "DOMINGO",
      ];
      if (!diasValidos.includes(dia_semana.toUpperCase())) {
        return res
          .status(400)
          .json({ mensajeError: "Día de la semana inválido" });
      }
    }

    // Verificar conflictos de horarios si se está cambiando instructor, día o hora
    if (
      id_instructor &&
      (id_instructor !== horario.id_instructor ||
        dia_semana?.toUpperCase() !== horario.dia_semana ||
        hora_inicio !== horario.hora_inicio ||
        hora_fin !== horario.hora_fin)
    ) {
      const conflicto = await HorariosPilatesModel.findOne({
        where: {
          id: { [db.Sequelize.Op.ne]: id }, // Excluir el horario actual
          id_instructor: id_instructor,
          dia_semana: dia_semana?.toUpperCase() || horario.dia_semana,
          [db.Sequelize.Op.or]: [
            {
              hora_inicio: {
                [db.Sequelize.Op.lte]: hora_inicio || horario.hora_inicio,
              },
              hora_fin: {
                [db.Sequelize.Op.gt]: hora_inicio || horario.hora_inicio,
              },
            },
            {
              hora_inicio: {
                [db.Sequelize.Op.lt]:
                  hora_fin || horario.hora_fin || "23:59:59",
              },
              hora_fin: {
                [db.Sequelize.Op.gte]:
                  hora_fin || horario.hora_fin || "23:59:59",
              },
            },
          ],
        },
      });

      if (conflicto) {
        return res.status(400).json({
          mensajeError:
            "El instructor ya tiene un horario asignado en ese día y hora",
        });
      }
    }

    // Actualizar el horario
    await horario.update({
      id_sede: id_sede || horario.id_sede,
      dia_semana: dia_semana?.toUpperCase() || horario.dia_semana,
      hora_inicio: hora_inicio || horario.hora_inicio,
      hora_fin: hora_fin !== undefined ? hora_fin : horario.hora_fin,
      id_instructor:
        id_instructor !== undefined ? id_instructor : horario.id_instructor,
    });

    res.json({
      message: "Horario actualizado correctamente",
      horario: horario,
    });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar un horario pilates
export const ER_HorariosPilates_CTS = async (req, res) => {
  try {
    const { id } = req.params;

    const horario = await HorariosPilatesModel.findByPk(id);

    if (!horario) {
      return res.status(404).json({ mensajeError: "Horario no encontrado" });
    }

    await horario.destroy();

    res.json({ message: "Horario eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Buscar horarios por múltiples criterios
export const BUSCAR_HorariosPilates_CTS = async (req, res) => {
  try {
    const { busqueda, id_sede, dia_semana } = req.query;

    let whereClause = {};

    if (id_sede) {
      whereClause.id_sede = id_sede;
    }

    if (dia_semana) {
      whereClause.dia_semana = dia_semana.toUpperCase();
    }

    if (busqueda) {
      whereClause[db.Sequelize.Op.or] = [
        {
          dia_semana: {
            [db.Sequelize.Op.like]: `%${busqueda.toUpperCase()}%`,
          },
        },
        {
          hora_inicio: {
            [db.Sequelize.Op.like]: `%${busqueda}%`,
          },
        },
      ];
    }

    const registros = await HorariosPilatesModel.findAll({
      where: whereClause,
      order: [
        ["dia_semana", "ASC"],
        ["hora_inicio", "ASC"],
      ],
    });

    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener horarios disponibles (sin instructor asignado)
export const OBRS_HorariosDisponibles_CTS = async (req, res) => {
  try {
    const { id_sede } = req.query;

    let whereClause = {
      id_instructor: null,
    };

    if (id_sede) {
      whereClause.id_sede = id_sede;
    }

    const registros = await HorariosPilatesModel.findAll({
      where: whereClause,
      order: [
        ["dia_semana", "ASC"],
        ["hora_inicio", "ASC"],
      ],
    });

    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

export const UR_InstructorHorarioPilates_CTS = async (req, res) => {
  try {
    const { id_sede, dia_semana, hora_inicio, id_instructor } = req.body;

    if (!id_sede || !dia_semana || !hora_inicio || !id_instructor) {
      return res.status(400).json({ mensajeError: "Faltan datos requeridos" });
    }

    const [updated] = await HorariosPilatesModel.update(
      { id_instructor },
      {
        where: {
          id_sede,
          dia_semana,
          hora_inicio: { [db.Sequelize.Op.like]: `%${hora_inicio}%` },
        },
      }
    );

    if (updated === 0) {
      return res
        .status(404)
        .json({ mensajeError: "No se encontró el horario para actualizar" });
    }

    res.json({ message: "Instructor actualizado correctamente" });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

export const insertarHorariosPorDefectoParaSedeCiudad = async (sedeId) => {
  try {
    // Generar horarios de lunes a viernes, de 07:00 a 22:00
    const dias = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"];
    const horariosAInsertar = [];

    for (const dia of dias) {
      for (let hora = 7; hora <= 22; hora++) {
        const horaStr = hora.toString().padStart(2, "0") + ":00:00";
        horariosAInsertar.push({
          id_sede: sedeId,
          dia_semana: dia,
          hora_inicio: horaStr,
          id_instructor: 1, // Asignamos un instructor por defecto (puedes cambiarlo)
        });
      }
    }

    // Usamos bulkCreate para insertar todos los horarios en una sola consulta
    await HorariosPilatesModel.bulkCreate(horariosAInsertar);

    return {
      success: true,
      message: "Horarios por defecto insertados correctamente",
    };
  } catch (error) {
    console.error("Error al insertar horarios por defecto:", error);
    return { success: false, message: error.message };
  }
};
