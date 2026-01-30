/*
 * Programador: Sergio Manrique
 * Fecha Creación: 30/01/2026
 * Versión: 1.0
 *
 * Descripción:
 * Controlador de bajas de Pilates: listado por sede y registro de baja
 * con datos de cliente, sede y usuario que gestionó.
 *
 * Tema: Controladores - Bajas Pilates
 *
 */

// Controlador para obtener todas las bajas de pilates
import PilatesBajasHistorial from "../Models/MD_TB_PilatesBajasHistorial.js";
import UsersModel from "../Models/MD_TB_Users.js";
import { SedeModel } from "../Models/MD_TB_sedes.js";

// GET: Listar todas las bajas de pilates con nombre del cliente, sede y usuario que gestionó la baja
export const OBRS_BajasPilates_CTS = async (req, res) => {
  try {
    const id_sede = req.params.id_sede || req.query.id_sede;
    if (!id_sede) {
      return res.status(400).json({ message: "Falta el parámetro id_sede" });
    }

    const bajas = await PilatesBajasHistorial.findAll({
      where: { id_sede },
      attributes: [
        "nombre_cliente",
        "telefono",
        "fecha_alta_original",
        "fecha_baja",
        "cantidad_renovaciones",
        "meses_entrenados",
        "motivo",
        "contactado_remarketing",
        "recuperado",
        "fecha_creacion",
        "estado"
      ],
      include: [
        {
          model: SedeModel,
          as: "sede",
          attributes: ["nombre"]
        },
        {
          model: UsersModel,
          as: "usuario_gestion",
          attributes: ["name"]
        }
      ],
      order: [["fecha_creacion", "DESC"]]
    });

    // Contadores por estado
    let contadorPlan = 0;
    let contadorPrueba = 0;
    let contadorRenovacion = 0;
    bajas.forEach(b => {
      if (b.estado === 'Plan') contadorPlan++;
      else if (b.estado === 'Clase de prueba') contadorPrueba++;
      else if (b.estado === 'Renovacion programada') contadorRenovacion++;
    });

    res.json({
      bajas,
      contador_estado: {
        plan: contadorPlan,
        clase_de_prueba: contadorPrueba,
        renovacion_programada: contadorRenovacion
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener las bajas de pilates" });
  }
};


export const ER_RegistrarBajaPilates = async (
  idCliente,
  motivoCausa,
  idUsuarioGestion = null,
) => {
  // 1. Buscamos al cliente para obtener su nombre antes de que se elimine
  const clienteInfo = await ClientesPilates.findByPk(idCliente);

  if (!clienteInfo) {
    console.error("No se encontró el cliente para registrar la baja.");
    return null;
  }

  const inscripcion = await InscripcionesPilatesModel.findOne({
    where: { id_cliente: idCliente },
    order: [["fecha_inscripcion", "DESC"]],
  });

  if (!inscripcion) {
    console.warn(`Cliente ${idCliente} sin inscripciones.`);
    return null;
  }

  const horario = await HorariosPilatesModel.findByPk(inscripcion.id_horario, {
    attributes: ["id_sede"],
  });

  const id_sede = horario?.id_sede;

  const fechaAlta = inscripcion.fecha_inscripcion;
  const fechaBaja = moment().format("YYYY-MM-DD");
  
  // Calcular meses entrenados: cada 28 días = 1 mes (planes mínimos son 29 días)
  const diasEntrenados = moment(fechaBaja).diff(moment(fechaAlta), "days");
  const mesesEntrenados = Math.floor(diasEntrenados / 28);
  
  const payload = {
    nombre_cliente: clienteInfo.nombre,
    telefono: clienteInfo.telefono || null,
    id_sede,
    fecha_alta_original: fechaAlta,
    fecha_baja: fechaBaja,
    estado: clienteInfo.estado,
    cantidad_renovaciones: 0,
    meses_entrenados: mesesEntrenados,
    motivo: String(motivoCausa?.trim().toUpperCase() || "NO PROPORCIONADO"),
    contactado_remarketing: false,
    recuperado: false,
    id_usuario_gestion: idUsuarioGestion,
  };

  try {
    const result = await PilatesBajasHistorial.create(payload);
    return result;
  } catch (err) {
    console.error(`Error al registrar baja:`, err);
    throw err;
  }
};