/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 19/09/2025
 * Ultima Modificación: 07/11/2025
 * Versión: 1.1
 *
 * Descripción:
 * Controlador para la tabla asistencias_pilates.
 * Tema: Controladores - Asistencias Pilates
 * Capa: Backend
 */
import AsistenciasPilatesModel from "../Models/MD_TB_AsistenciasPilates.js";
import InscripcionesPilatesModel from "../Models/MD_TB_InscripcionesPilates.js";
import ClientesPilatesModel from "../Models/MD_TB_ClientesPilates.js";
import UsersModel from "../Models/MD_TB_Users.js";
import MD_TB_HorariosPilates from "../Models/MD_TB_HorariosPilates.js";
import db from "../DataBase/db.js";
import { Op, literal } from "sequelize";

const HorariosPilatesModel = MD_TB_HorariosPilates.HorariosPilatesModel;

/**
 * GET /asistencias-pilates/formato?fecha=YYYY-MM-DD
 * Devuelve las asistencias de una fecha en formato { id_inscripcion: "presente" | "ausente" }
 */
export const OBRS_AsistenciasFormato_CTS = async (req, res) => {
  try {
    const { fecha } = req.query;
    if (!fecha) {
      return res
        .status(400)
        .json({ mensajeError: "El parámetro 'fecha' es requerido." });
    }

    const asistencias = await AsistenciasPilatesModel.findAll({
      where: { fecha },
      include: [
        {
          model: InscripcionesPilatesModel,
          as: "inscripcion",
          attributes: ["id_cliente"],
        },
      ],
    });

    const resultadoFormateado = {};
    asistencias.forEach((a) => {
      // Asegúrate de que estás accediendo a 'id_cliente' a través de la inscripción
      if (a.inscripcion) {
        // Una pequeña verificación para evitar errores
        resultadoFormateado[a.inscripcion.id_cliente] = a.presente
          ? "presente"
          : "ausente";
      }
    });

    console.log(
      "[DEBUG Backend] Objeto de Asistencias Enviado:",
      resultadoFormateado
    );

    res.json(resultadoFormateado);
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Genera un reporte que muestra si los clientes en estado 'Clase de prueba' asistieron o no a su fecha de prueba.
export const OBRS_ReporteAsistenciaPrueba_CTS = async (req, res) => {
  try {
    const hoy = new Date().toISOString().slice(0, 10); // Fecha de hoy en formato 'YYYY-MM-DD'

    // 1. Buscamos a todos los clientes de prueba cuya fecha de clase ya pasó
    const clientesDePrueba = await ClientesPilatesModel.findAll({
      where: {
        estado: "Clase de prueba",
        fecha_inicio: { [Op.lte]: hoy }, // Menor o igual a hoy
      },
      include: [
        {
          model: InscripcionesPilatesModel,
          as: "inscripciones", // Usamos la asociación que creamos
          required: false, // LEFT JOIN: traer clientes aunque no tengan inscripción
          include: [
            {
              model: AsistenciasPilatesModel,
              as: "asistencias", // Usamos la otra asociación
              required: false, // LEFT JOIN: traer inscripciones aunque no tengan asistencia
              // ¡La condición clave! Solo nos interesa la asistencia DEL DÍA de la clase
              where: {
                fecha: { [Op.eq]: db.col("clientes_pilates.fecha_inicio") },
              },
            },
          ],
        },
      ],
      order: [["fecha_inicio", "DESC"]], // Los más recientes primero
    });

    // 2. Formateamos la respuesta para que sea simple para el frontend
    const reporte = clientesDePrueba.map((cliente) => {
      // Verificamos si existe al menos una inscripción con al menos una asistencia
      const asistio = cliente.inscripciones?.some(
        (insc) => insc.asistencias && insc.asistencias.length > 0
      );

      return {
        id_cliente: cliente.id,
        nombre: cliente.nombre,
        fecha_clase: cliente.fecha_inicio,
        asistio: !!asistio, // Convertimos a booleano (true/false)
      };
    });

    res.json(reporte);
  } catch (error) {
    console.error("Error al generar reporte de asistencia de prueba:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// Actualiza el estado de 'presente' (true/false) de un cliente para una fecha determinada en la tabla de asistencias.
export const UR_AsistenciaCliente_CTS = async (req, res) => {
  try {
    const { id_cliente, fecha, presente } = req.body;

    // 1. Validar datos de entrada
    if (!id_cliente || !fecha || presente === undefined) {
      return res.status(400).json({
        mensajeError: "Faltan datos requeridos (id_cliente, fecha, presente).",
      });
    }

    // 2. Encontrar la inscripción del cliente
    const inscripcion = await InscripcionesPilatesModel.findOne({
      where: { id_cliente },
    });

    if (!inscripcion) {
      return res.status(404).json({
        mensajeError:
          "No se encontró una inscripción para el cliente especificado.",
      });
    }

    // 3. Actualizar el registro de asistencia
    const [updated] = await AsistenciasPilatesModel.update(
      { presente },
      {
        where: {
          id_inscripcion: inscripcion.id,
          fecha: fecha,
        },
      }
    );

    if (updated === 0) {
      return res.status(404).json({
        mensajeError:
          "No se encontró un registro de asistencia para esa fecha. Asegúrese de que la tarea automática se haya ejecutado.",
      });
    }

    res.json({ message: "Asistencia actualizada correctamente." });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// En CTS_TB_AsistenciasPilates.js

// [CRON JOB] Crea automáticamente registros de asistencia como 'ausente' (false) para todos los alumnos que tienen clase hoy y cuyo plan ya comenzó.
export const crearAsistenciasDiariasAusentes = async () => {
  // 1. OBTENEMOS LA FECHA Y DÍA ACTUAL DINÁMICAMENTE
  const fechaActual = new Date();
  const hoy = fechaActual.toISOString().slice(0, 10);
  const diasSemana = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];
  const diaActual = diasSemana[fechaActual.getDay()].toLowerCase();

  console.log(
    `[CRON] Iniciando tarea de creación de asistencias para la fecha: ${hoy} (${diaActual})`
  );

  // Determinar el grupo del día actual
  const grupoLMV = ["lunes", "miércoles", "viernes"];
  const grupoMJ = ["martes", "jueves"];
  let diasGrupo = [];

  if (grupoLMV.includes(diaActual)) {
    diasGrupo = grupoLMV;
  } else if (grupoMJ.includes(diaActual)) {
    diasGrupo = grupoMJ;
  } else {
    const mensaje = `Hoy es ${diaActual}. No se generan asistencias para fines de semana.`;
    console.log(`[CRON] ${mensaje}`);
    return mensaje;
  }

  try {
    // 2. SELECCIÓN INTELIGENTE DE ALUMNOS ELEGIBLES
    // Buscamos todas las inscripciones de los horarios del día, pero solo de alumnos
    // cuyo plan ya ha comenzado (fecha_inicio <= hoy).
    const diasGrupoMayus = diasGrupo.map((d) => d.toUpperCase());

    const inscripcionesElegibles = await InscripcionesPilatesModel.findAll({
      attributes: ["id"],
      include: [
        {
          model: ClientesPilatesModel,
          as: "cliente",
          attributes: [], // No necesitamos traer datos del cliente, solo usarlo para filtrar
          where: {
            fecha_inicio: { [Op.lte]: hoy }, // <-- ¡AQUÍ ESTÁ LA MAGIA! (Requerimiento 1)
          },
        },
        {
          model: HorariosPilatesModel,
          as: "horario",
          attributes: [], // No necesitamos traer datos del horario, solo usarlo para filtrar
          where: {
            dia_semana: { [Op.in]: diasGrupoMayus },
          },
        },
      ],
    });

    if (inscripcionesElegibles.length === 0) {
      const mensaje = `No se encontraron inscripciones elegibles para hoy (${hoy}).`;
      console.log(`[CRON] ${mensaje}`);
      return mensaje;
    }

    const idsInscripcionesElegibles = inscripcionesElegibles.map((i) => i.id);

    // 3. VERIFICACIÓN INDIVIDUAL (NO MÁS "TODO O NADA")
    // Buscamos qué inscripciones de las elegibles YA tienen un registro de asistencia para hoy.
    const asistenciasYaCreadas = await AsistenciasPilatesModel.findAll({
      where: {
        fecha: hoy,
        id_inscripcion: { [Op.in]: idsInscripcionesElegibles },
      },
      attributes: ["id_inscripcion"],
    });

    const idsAsistenciasYaCreadas = new Set(
      asistenciasYaCreadas.map((a) => a.id_inscripcion)
    );

    // Comparamos la lista de elegibles con la de ya creadas para encontrar solo los que faltan.
    const inscripcionesFaltantes = idsInscripcionesElegibles.filter(
      (id) => !idsAsistenciasYaCreadas.has(id)
    );

    if (inscripcionesFaltantes.length === 0) {
      const mensaje = `Todos los alumnos elegibles ya tienen su registro de asistencia para hoy. No se realiza ninguna acción.`;
      console.log(`[CRON] ${mensaje}`);
      return mensaje;
    }

    // 4. CREAMOS SOLO LOS REGISTROS FALTANTES
    const valoresAInsertar = inscripcionesFaltantes.map((id_inscripcion) => ({
      id_inscripcion: id_inscripcion,
      fecha: hoy,
      presente: false,
    }));

    await db
      .getQueryInterface()
      .bulkInsert("asistencias_pilates", valoresAInsertar);

    const mensaje = `Tarea completada: Se crearon ${valoresAInsertar.length} nuevos registros de asistencia para la fecha ${hoy}.`;
    console.log(`[CRON] ${mensaje}`);
    return mensaje;
  } catch (error) {
    console.error(
      "[CRON] Error durante la ejecución de la tarea programada:",
      error
    );
    throw error;
  }
};
/*
 * GET /asistencias-pilates/ausencias-mensuales?id_sede=X&fecha=YYYY-MM-DD
 * Devuelve los alumnos de una sede con sus ausencias del mes correspondiente a la fecha
 */
// Obtiene una lista de clientes de una sede y cuenta el total de sus ausencias registradas durante el mes de la fecha indicada.
export const OBRS_AusenciasMensualesPorSede_CTS = async (req, res) => {
  try {
    const { id_sede, fecha } = req.query;

    if (!id_sede || !fecha) {
      return res.status(400).json({
        mensajeError: "Los parámetros 'id_sede' y 'fecha' son requeridos.",
      });
    }

    // Validar formato de fecha
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({
        mensajeError: "El formato de fecha debe ser YYYY-MM-DD.",
      });
    }

    // Obtener el año y mes de la fecha
    const fechaObj = new Date(fecha);
    const año = fechaObj.getFullYear();
    const mes = fechaObj.getMonth() + 1; // getMonth() devuelve 0-11

    // 1. Obtener horarios de la sede
    const horarios = await HorariosPilatesModel.findAll({
      where: { id_sede },
      attributes: ["id"],
      raw: true,
    });

    if (horarios.length === 0) {
      return res.json([]);
    }

    const horarioIds = horarios.map((h) => h.id);

    // 2. Obtener inscripciones de esos horarios
    const inscripciones = await InscripcionesPilatesModel.findAll({
      where: { id_horario: { [Op.in]: horarioIds } },
      attributes: ["id", "id_cliente"],
      raw: true,
    });

    if (inscripciones.length === 0) {
      return res.json([]);
    }

    const inscripcionIds = inscripciones.map((i) => i.id);
    const clienteIds = [...new Set(inscripciones.map((i) => i.id_cliente))];

    // 3. Obtener asistencias del mes (solo ausencias)
    const asistencias = await AsistenciasPilatesModel.findAll({
      where: {
        id_inscripcion: { [Op.in]: inscripcionIds },
        fecha: {
          [Op.and]: [
            literal(`YEAR(fecha) = ${año}`),
            literal(`MONTH(fecha) = ${mes}`),
          ],
        },
        presente: false,
      },
      attributes: ["id_inscripcion"],
      raw: true,
    });

    // 4. Contar ausencias por cliente
    const ausenciasPorCliente = {};
    asistencias.forEach((asistencia) => {
      const inscripcion = inscripciones.find(
        (i) => i.id === asistencia.id_inscripcion
      );
      if (inscripcion) {
        const clienteId = inscripcion.id_cliente;
        ausenciasPorCliente[clienteId] =
          (ausenciasPorCliente[clienteId] || 0) + 1;
      }
    });
    // 5. Obtener datos completos de los clientes
    const clientes = await ClientesPilatesModel.findAll({
      where: { id: { [Op.in]: clienteIds } },
      attributes: [
        "id",
        "nombre",
        "telefono",
        "contactado",
        "fecha_contacto",
        "id_usuario_contacto",
      ],
      raw: true,
    });

    // Obtener nombres de usuarios de contacto si existen
    const userIds = [
      ...new Set(
        clientes
          .map((c) => c.id_usuario_contacto)
          .filter((v) => v !== null && v !== undefined)
      ),
    ];

    let usuariosMap = {};
    if (userIds.length > 0) {
      const usuarios = await UsersModel.findAll({
        where: { id: { [Op.in]: userIds } },
        attributes: ["id", "name"],
        raw: true,
      });
      usuariosMap = usuarios.reduce((acc, u) => {
        acc[u.id] = u.name;
        return acc;
      }, {});
    }

    // 6. Formatear resultado
    const resultado = clientes.map((cliente) => {
      return {
        id: cliente.id,
        nombre: cliente.nombre.trim().toUpperCase(),
        telefono: cliente.telefono ? cliente.telefono.trim() : null,
        contactado: !!cliente.contactado,
        fecha_contacto: cliente.fecha_contacto
          ? (() => {
              const d = new Date(cliente.fecha_contacto);
              const pad = (n) => String(n).padStart(2, "0");
              return `${pad(d.getDate())}/${pad(
                d.getMonth() + 1
              )}/${d.getFullYear()} ${pad(d.getHours())}:${pad(
                d.getMinutes()
              )}:${pad(d.getSeconds())}`;
            })()
          : null,
        cantidad_ausentes: ausenciasPorCliente[cliente.id] || 0,
        // en vez del id, devolvemos el nombre del usuario de contacto (si existe)
        contacto_usuario_nombre: cliente.id_usuario_contacto
          ? usuariosMap[cliente.id_usuario_contacto] || null
          : null,
      };
    });

    // 7. Ordenar por cantidad de ausentes descendente
    resultado.sort((a, b) => {
      if (b.cantidad_ausentes !== a.cantidad_ausentes) {
        return b.cantidad_ausentes - a.cantidad_ausentes;
      }
      return a.nombre.localeCompare(b.nombre);
    });

    res.json(resultado);
  } catch (error) {
    console.error("Error en OBRS_AusenciasMensualesPorSede_CTS:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};

/**
 * [DEBUG] Endpoint para disparar manualmente la creación de asistencias diarias.
 */
// Endpoint para forzar la ejecución manual de la función 'crearAsistenciasDiariasAusentes' (uso en desarrollo/prueba).
export const DEBUG_DispararCreacionAsistencias_CTS = async (req, res) => {
  try {
    console.log(
      "[DEBUG] Se ha solicitado la ejecución manual de la tarea de asistencias."
    );
    const resultado = await crearAsistenciasDiariasAusentes();
    res.status(200).json({
      message: "Ejecución de tarea manual completada.",
      details: resultado,
    });
  } catch (error) {
    res.status(500).json({
      mensajeError: "Falló la ejecución manual de la tarea.",
      error: error.message,
    });
  }
};
