/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 08 / 04 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * * Contiene la lógica para la gestión de datos bancarios de los colaboradores.
 * * Incluye validaciones estrictas de CBU, gestión de cuentas principales y verificación de existencia.
 * Tema: Controladores - RRHH Cuentas Bancarias
 * * Capa: Backend 
 *
 * Nomenclatura: 
 * * OBRS_ obtenerRegistros (por usuario o sede)
 * * OBRS_ verificarCuentaUsuario (Existencia previa)
 * * CR_ crearRegistro
 * * UR_ actualizarRegistro
 * * ER_ eliminarRegistro (Borrado lógico)
 */
import RRHHCuentasBancariasModel from "../../Models/RRHH/MD_TB_RRHH_CuentasBancarias.js";
import UsersModel from "../../Models/MD_TB_Users.js";
import dayjs from "dayjs";

export const CR_CuentaBancaria_CTS = async (req, res) => {
  try {
    const {
      usuario_id,
      banco,
      cbu,
      alias,
      titular_nombre,
      titular_apellido,
      titular_dni,
      es_principal,
      activa,
      fecha_vigencia_hasta,
    } = req.body;

    const payload = {
      usuario_id: Number(usuario_id),
      banco: (banco || "").trim(),
      cbu: (cbu || "").trim(),
      alias: (alias || "").trim() || null,
      titular_nombre: (titular_nombre || "").trim(),
      titular_apellido: (titular_apellido || "").trim(),
      titular_dni: (titular_dni || "").trim(),
      es_principal:
        es_principal === undefined ? 1 : Number(es_principal) ? 1 : 0,
      activa: activa === undefined ? 1 : Number(activa) ? 1 : 0,
    };

    const errores = [];

    if (!Number.isInteger(payload.usuario_id) || payload.usuario_id <= 0) {
      errores.push(
        "usuario_id es obligatorio y debe ser un número entero positivo",
      );
    }
    if (!payload.banco) {
      errores.push("banco es obligatorio");
    }
    if (!/^\d{22}$/.test(payload.cbu)) {
      errores.push("cbu es obligatorio y debe tener exactamente 22 dígitos");
    }
    if (!payload.titular_nombre) {
      errores.push("titular_nombre es obligatorio");
    }
    if (!payload.titular_apellido) {
      errores.push("titular_apellido es obligatorio");
    }
    if (!payload.titular_dni) {
      errores.push("titular_dni es obligatorio");
    }

    if (errores.length > 0) {
      return res.status(400).json({
        mensajeError: "Errores de validación",
        errores,
      });
    }

    const ahora = dayjs();
    const fechaDesde = ahora.format("YYYY-MM-DD");
    const fechaHora = ahora.format("YYYY-MM-DD HH:mm:ss");

    const nuevaCuenta = await RRHHCuentasBancariasModel.create({
      ...payload,
      fecha_vigencia_desde: fechaDesde,
      fecha_vigencia_hasta: fecha_vigencia_hasta || null,
      created_at: fechaHora,
      updated_at: fechaHora,
      eliminado: 0,
    });

    return res.status(201).json(nuevaCuenta);
  } catch (error) {
    console.error("Error al crear cuenta bancaria:", error);
    return res.status(500).json({
      mensajeError: "Error al crear cuenta bancaria",
      error: error.message,
    });
  }
};

export const OBRS_verificarCuentaUsuario = async (req, res) => {
  try {
    const idUsuario = req.query.idUsuario ?? req.params.idUsuario;

    if (!idUsuario) {
      return res.status(400).json({
        mensajeError: "Debe enviar idUsuario",
      });
    }

    const cuenta = await RRHHCuentasBancariasModel.findOne({
      where: {
        usuario_id: idUsuario,
        eliminado: 0,
      },
    });

    if (cuenta) {
      res.json({ tieneCuenta: true, datosCuenta: cuenta });
    } else {
      res.json({
        tieneCuenta: false,
        mensajeError: "El usuario no tiene una cuenta bancaria asociada",
      });
    }
  } catch (error) {
    console.error("Error al verificar cuenta bancaria del usuario:", error);
    res.status(500).json({ mensajeError: error.message });
  }
};

export const OBRS_obtenerCuentasBancarias_CTS = async (req, res) => {
  try {
    const idUsuario = req.query.idUsuario ?? req.params.idUsuario;
    const idSede = req.query.idSede ?? req.params.idSede;

    if (idUsuario) {
      const cuentas = await RRHHCuentasBancariasModel.findAll({
        where: {
          usuario_id: Number(idUsuario),
          eliminado: 0,
        },
        order: [
          ["es_principal", "DESC"], 
          ["created_at", "DESC"]
        ],
      });

      if (!cuentas.length) {
        return res.status(404).json({
          mensajeError:
            "No se encontraron cuentas bancarias para el usuario indicado",
        });
      }

      return res.json(cuentas);
    }

    if (!idSede) {
      return res.status(400).json({
        mensajeError: "Debe enviar idUsuario o idSede",
      });
    }

    const cuentas = await RRHHCuentasBancariasModel.findAll({
      where: { eliminado: 0 },
      include: [
        {
          model: UsersModel,
          as: "usuario",
          attributes: ["id", "name", "email", "sede"],
          where: { sede: String(idSede) },
        },
      ],
      order: [
        ["es_principal", "DESC"],
        ["created_at", "DESC"]
      ],
    });

    return res.json(cuentas);
  } catch (error) {
    console.error("Error al obtener cuentas bancarias:", error);
    return res.status(500).json({
      mensajeError: "Error al obtener cuentas bancarias",
      error: error.message,
    });
  }
};

export const UR_CuentaBancaria_CTS = async (req, res) => {
  try {
    const cuenta = await RRHHCuentasBancariasModel.findOne({
      where: {
        id: req.params.id,
        eliminado: 0,
      },
    });

    if (!cuenta) {
      return res.status(404).json({
        mensajeError: "Cuenta bancaria no encontrada",
      });
    }

    const payload = {
      banco:
        req.body.banco !== undefined
          ? (req.body.banco || "").trim()
          : undefined,
      cbu: req.body.cbu !== undefined ? (req.body.cbu || "").trim() : undefined,
      alias:
        req.body.alias !== undefined
          ? (req.body.alias || "").trim() || null
          : undefined,
      titular_nombre:
        req.body.titular_nombre !== undefined
          ? (req.body.titular_nombre || "").trim()
          : undefined,
      titular_apellido:
        req.body.titular_apellido !== undefined
          ? (req.body.titular_apellido || "").trim()
          : undefined,
      titular_dni:
        req.body.titular_dni !== undefined
          ? (req.body.titular_dni || "").trim()
          : undefined,
      es_principal:
        req.body.es_principal !== undefined
          ? Number(req.body.es_principal)
            ? 1
            : 0
          : undefined,
      activa:
        req.body.activa !== undefined
          ? Number(req.body.activa)
            ? 1
            : 0
          : undefined,
      fecha_vigencia_hasta:
        req.body.fecha_vigencia_hasta !== undefined
          ? req.body.fecha_vigencia_hasta
          : undefined,
    };

    const errores = [];

    if (payload.banco !== undefined && !payload.banco) {
      errores.push("banco no puede estar vacío");
    }
    if (payload.cbu !== undefined && !/^\d{22}$/.test(payload.cbu)) {
      errores.push("cbu debe tener exactamente 22 dígitos");
    }
    if (payload.titular_nombre !== undefined && !payload.titular_nombre) {
      errores.push("titular_nombre no puede estar vacío");
    }
    if (payload.titular_apellido !== undefined && !payload.titular_apellido) {
      errores.push("titular_apellido no puede estar vacío");
    }
    if (payload.titular_dni !== undefined && !payload.titular_dni) {
      errores.push("titular_dni no puede estar vacío");
    }

    if (errores.length > 0) {
      return res.status(400).json({
        mensajeError: "Errores de validación",
        errores,
      });
    }

    await cuenta.update({
      ...payload,
      updated_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    });

    return res.json(cuenta);
  } catch (error) {
    console.error("Error al actualizar cuenta bancaria:", error);
    return res.status(500).json({
      mensajeError: "Error al actualizar cuenta bancaria",
      error: error.message,
    });
  }
};

export const ER_CuentaBancaria_CTS = async (req, res) => {
  try {
    const cuenta = await RRHHCuentasBancariasModel.findOne({
      where: {
        id: req.params.id,
        eliminado: 0,
      },
    });

    if (!cuenta) {
      return res.status(404).json({
        mensajeError: "Cuenta bancaria no encontrada",
      });
    }

    await cuenta.update({
      eliminado: 1,
      updated_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    });

    return res.json({ message: "Cuenta bancaria eliminada correctamente" });
  } catch (error) {
    console.error("Error al eliminar cuenta bancaria:", error);
    return res.status(500).json({
      mensajeError: "Error al eliminar cuenta bancaria",
      error: error.message,
    });
  }
};
