/* 
Autor: Sergio Manrique
Fecha: 15/12/2025
Version: 1.0.0
Objetivo: Controlador de historial de clientes pilates 
*/

import db from "../DataBase/db.js";
import ClientesPilatesHistorialDetalleModel from "../Models/MD_TB_ClientesPilatesHistorialDetalle.js";
import ClientesPilatesHistorialModel from "../Models/MD_TB_ClientesPilatesHistorial.js";
import UsersModel from "../Models/MD_TB_Users.js";

// ==========================================
// OBTENER HISTORIAL DE UN CLIENTE
// ==========================================
export const OBRS_HistorialPorCliente_CTS = async (req, res) => {
  try {
    const { cliente_id } = req.params;

    if (!cliente_id) {
      return res.status(400).json({ mensajeError: "Falta el ID del cliente." });
    }

    const historial = await ClientesPilatesHistorialModel.findAll({
      where: { cliente_id },
      include: [
        {
          model: ClientesPilatesHistorialDetalleModel,
          as: "detalles", // Trae los campos que cambiaron
        },
        {
          model: UsersModel,
          as: "informacion_usuario", // Trae los datos del usuario
          attributes: ["name"],
        },
      ],
      order: [["fecha_evento", "DESC"]], // Lo más nuevo primero
    });

    res.json(historial);
  } catch (error) {
    console.error("Error al obtener historial:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// ==========================================
// CREAR UN EVENTO (DTO y Transacción)
// ==========================================
export const CR_EventoHistorial_CTS = async (req, res) => {
  // Iniciamos una transacción por si falla algo, no guardar datos a medias
  const t = await db.transaction();

  try {
    // 1. DTO / Validaciones de entrada
    const {
      cliente_id,
      tipo_evento,
      es_instructor,
      usuario_id,
      resumen,
      cambios_especificos, // Array de objetos: [{ campo, valor_anterior, valor_nuevo }]
    } = req.body;

    if (!cliente_id || !tipo_evento || !resumen || !cambios_especificos) {
      await t.rollback();
      return res.status(400).json({
        mensajeError:
          "Faltan datos obligatorios: cliente_id, tipo_evento y resumen.",
      });
    }

    const tiposValidos = [
      "ALTA",
      "CAMBIO_PLAN",
      "MODIFICACION",
      "BAJA",
      "CAMBIO_TURNO",
    ];
    if (!tiposValidos.includes(tipo_evento)) {
      await t.rollback();
      return res.status(400).json({
        mensajeError:
          "Tipo de evento inválido. Use: ALTA, CAMBIO_PLAN, MODIFICACION, BAJA o CAMBIO_TURNO.",
      });
    }

    // 2. Crear la cabecera (El evento principal)
    const nuevoEvento = await ClientesPilatesHistorialModel.create(
      {
        cliente_id,
        tipo_evento,
        es_instructor: es_instructor || 0,
        usuario_id: usuario_id || null, // Puede ser null si lo hace el sistema
        resumen: resumen.toUpperCase().trim(),
        fecha_evento: new Date(),
      },
      { transaction: t }
    );

    // 3. Crear los detalles (si enviaron cambios específicos)
    if (
      cambios_especificos &&
      Array.isArray(cambios_especificos) &&
      cambios_especificos.length > 0
    ) {
      // Preparamos los datos agregando el ID del evento recién creado
      const detallesParaInsertar = cambios_especificos.map((item) => ({
        historial_id: nuevoEvento.id,
        campo: item.campo,
        valor_anterior: item.valor_anterior
          ? String(item.valor_anterior)
          : null,
        valor_nuevo: item.valor_nuevo ? String(item.valor_nuevo) : null,
      }));

      // Insertamos todo junto (bulkCreate es más rápido)
      await ClientesPilatesHistorialDetalleModel.bulkCreate(
        detallesParaInsertar,
        {
          transaction: t,
        }
      );
    }

    // 4. Confirmar transacción
    await t.commit();

    res.status(201).json({
      message: "Evento registrado correctamente",
      evento_id: nuevoEvento.id,
    });
  } catch (error) {
    // Si algo falla, deshacemos todo
    await t.rollback();
    console.error("Error al crear evento historial:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};
export const CR_EventoHistorial_Alta_CTS = async ({
  cliente_id,
  tipo_evento,
  usuario_id,
  resumen,
  cambios_especificos,
}) => {
  const t = await db.transaction();
  try {
    const tiposValidos = [
      "ALTA",
      "CAMBIO_PLAN",
      "MODIFICACION",
      "BAJA",
      "CAMBIO_TURNO",
    ];
    if (!tiposValidos.includes(tipo_evento)) {
      throw new Error("Tipo de evento inválido.");
    }

    const nuevoEvento = await ClientesPilatesHistorialModel.create(
      {
        cliente_id,
        tipo_evento: "ALTA",
        usuario_id: usuario_id || null,
        resumen: resumen.toUpperCase().trim(),
        fecha_evento: new Date(),
      },
      { transaction: t }
    );

    if (cambios_especificos?.length > 0) {
      const detallesParaInsertar = cambios_especificos.map((item) => ({
        historial_id: nuevoEvento.id,
        campo: item.campo,
        valor_anterior:
          item.valor_anterior != null ? String(item.valor_anterior) : null,
        valor_nuevo: item.valor_nuevo != null ? String(item.valor_nuevo) : null,
      }));

      await ClientesPilatesHistorialDetalleModel.bulkCreate(
        detallesParaInsertar,
        {
          transaction: t,
        }
      );
    }

    await t.commit();
    return { evento_id: nuevoEvento.id };
  } catch (error) {
    await t.rollback();
    throw error; // Re-lanzamos el error para que lo maneje quien llame
  }
};

// ==========================================
// ELIMINAR HISTORIAL DE UN CLIENTE
// ==========================================
export const ER_HistorialPorCliente = async (
  cliente_id,
  transaction = null
) => {
  // 1. Buscar IDs de historial del cliente
  const historiales = await ClientesPilatesHistorialModel.findAll({
    where: { cliente_id },
    attributes: ["id"],
    transaction,
  });

  const historialIds = historiales.map((h) => h.id);

  // 2. Eliminar detalles
  if (historialIds.length > 0) {
    await ClientesPilatesHistorialDetalleModel.destroy({
      where: { historial_id: historialIds },
      transaction,
    });
  }

  // 3. Eliminar cabecera
  await ClientesPilatesHistorialModel.destroy({
    where: { cliente_id },
    transaction,
  });
};
