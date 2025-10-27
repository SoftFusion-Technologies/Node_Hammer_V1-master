/*
 * Programador: [Tu nombre]
 * Fecha Creación: 23/10/2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo contiene los controladores para la tabla de auditoría
 * de fechas de fin de plan en Pilates.
 *
 * Tema: Controladores - Auditoría Pilates
 * Capa: Backend
 */

import AuditoriaFechaFinModificadaPilatesModel from "../Models/MD_TB_AuditoriaFechaFinModificadaPilates.js";
import UsersModel from "../Models/MD_TB_Users.js";
import db from "../DataBase/db.js";

/**
 * GET /auditoria-pilates/cliente/:cliente_id
 * Obtiene el último registro de auditoría para un cliente específico.
 * Incluye el nombre del usuario que realizó la modificación.
 */
export const OBR_AuditoriaPorCliente_CTS = async (req, res) => {
  try {
    const { cliente_id } = req.params;

    // Busca el registro de auditoría por el ID del cliente.
    const auditoria = await AuditoriaFechaFinModificadaPilatesModel.findOne({
      where: { cliente_id: cliente_id },
      // Incluimos el modelo de Users para traer el nombre del usuario.
      include: [
        {
          model: UsersModel,
          as: "usuario",
          attributes: ["name"], // Solo necesitamos el nombre.
        },
      ],
    });

    if (!auditoria) {
      return res
        .status(404)
        .json({ mensajeError: "No se encontraron registros de auditoría para este cliente." });
    }

    // Formateamos la respuesta para que sea amigable para el frontend.
    const resultado = {
      cliente_id: auditoria.cliente_id,
      motivo: auditoria.motivo,
      // Formateamos la fecha a un formato argentino legible.
      fecha_modificacion: new Date(auditoria.fecha_modificacion).toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
      }),
      // Si el usuario existe, mostramos su nombre, si no, "N/D".
      nombre_usuario: auditoria.usuario ? auditoria.usuario.name : "N/D",
    };

    res.json(resultado);
  } catch (error) {
    console.error("Error al obtener el registro de auditoría:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};

/**
 * PUT /auditoria-pilates/cliente/:cliente_id
 * Crea o actualiza el registro de auditoría para un cliente.
 * Utiliza 'upsert' para manejar ambos casos de forma atómica.
 */
export const UR_AuditoriaFechaFin_CTS = async (req, res) => {
  const t = await db.transaction(); // Iniciamos una transacción para asegurar la integridad.

  try {
    const { cliente_id } = req.params;
    const { motivo, usuario_id } = req.body;

    // Validamos los datos de entrada.
    if (!motivo || !usuario_id) {
      return res.status(400).json({
        mensajeError: "El 'motivo' y el 'usuario_id' son requeridos.",
      });
    }

    // 'upsert' busca un registro con el 'cliente_id' (que es UNIQUE).
    // Si lo encuentra, lo actualiza. Si no, lo crea.
    await AuditoriaFechaFinModificadaPilatesModel.upsert({
      cliente_id: cliente_id,
      usuario_id: usuario_id,
      motivo: motivo,
      fecha_modificacion: new Date(), // Siempre usamos la fecha actual.
    }, { transaction: t });

    await t.commit(); // Si todo sale bien, confirmamos los cambios.

    res.status(200).json({ message: "Registro de auditoría guardado correctamente." });

  } catch (error) {
    await t.rollback(); // Si algo falla, deshacemos todos los cambios.
    console.error("Error al guardar el registro de auditoría:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};