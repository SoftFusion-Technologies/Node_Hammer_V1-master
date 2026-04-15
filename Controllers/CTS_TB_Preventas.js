/*
  * Programador: Sergio Gustavo Manrique
  * Fecha Creación: 25 de Marzo 2026
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_Preventas.js) contiene los controladores para manejar la preventa.
   
  * Tema: Controladores - Preventas
  
  * Capa: Backend
  
  * Nomenclatura: OBR_ obtenerRegistro
  * OBRS_obtenerRegistros
  * CR_ crearRegistro
  * UR_ actualizarRegistro
*/

import PreventaModel from "../Models/MD_TB_Preventas.js";
import { SedeModel } from "../Models/MD_TB_sedes.js";
import UsersModel from "../Models/MD_TB_Users.js";
import { CR_ClientePilates_Preventa } from "./CTS_TB_ClientesPilates.js";

const PREVENTAS_UPLOAD_PREFIX = "uploads/preventas/transferencias/";

const normalizarTexto = (valor, modo = "upper") => {
  if (valor === undefined || valor === null) return valor;
  const texto = String(valor).trim();
  if (!texto) return "";
  return modo === "lower" ? texto.toLowerCase() : texto.toUpperCase();
};

const obtenerArchivoComprobante = (req) => {
  if (req.file) return req.file;

  if (!req.files) return null;

  if (Array.isArray(req.files) && req.files.length > 0) {
    return req.files[0];
  }

  if (
    Array.isArray(req.files.comprobante) &&
    req.files.comprobante.length > 0
  ) {
    return req.files.comprobante[0];
  }

  if (Array.isArray(req.files.file) && req.files.file.length > 0) {
    return req.files.file[0];
  }

  return null;
};

const construirComprobanteUrlPublica = (comprobanteUrl) => {
  if (!comprobanteUrl) return null;

  const limpia = String(comprobanteUrl).trim();
  if (!limpia) return null;

  if (/^https?:\/\//i.test(limpia)) {
    return limpia;
  }

  const normalizada = limpia.replace(/\\/g, "/").replace(/^\/+/, "");
  return `/${normalizada}`;
};

const obtenerTipoComprobante = (comprobanteUrl) => {
  if (!comprobanteUrl) return null;

  const sinQuery = String(comprobanteUrl).split("?")[0].toLowerCase();
  const idx = sinQuery.lastIndexOf(".");
  const extension = idx >= 0 ? sinQuery.slice(idx) : "";

  const extensionesImagen = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".heic",
    ".heif",
  ]);
  const extensionesDocumento = new Set([".doc", ".docx", ".odt"]);

  if (extensionesImagen.has(extension)) return "imagen";
  if (extension === ".pdf") return "pdf";
  if (extensionesDocumento.has(extension)) return "documento";
  return "otro";
};

const serializarPreventa = (registro) => {
  const preventa =
    registro && typeof registro.toJSON === "function"
      ? registro.toJSON()
      : registro;

  const comprobante_url_publica = construirComprobanteUrlPublica(
    preventa?.comprobante_url,
  );
  const comprobante_tipo = obtenerTipoComprobante(preventa?.comprobante_url);

  return {
    ...preventa,
    comprobante_url_publica,
    comprobante_tipo,
    comprobante_es_imagen: comprobante_tipo === "imagen",
  };
};

// Crear un nuevo registro de preventa (Desde el formulario del cliente)
export const CR_Preventa_CTS = async (req, res) => {
  try {
    const idSedeRaw =
      req.body?.id_sede ?? req.body?.sede_id ?? req.body?.idSede;
    const id_sede = Number(idSedeRaw);
    const archivoComprobante = obtenerArchivoComprobante(req);
    const comprobanteDesdeArchivo = archivoComprobante
      ? `${PREVENTAS_UPLOAD_PREFIX}${archivoComprobante.filename}`
      : null;

    const duracion_plan = normalizarTexto(req.body?.duracion_plan);

    if (duracion_plan && !["SEMESTRAL", "ANUAL"].includes(duracion_plan)) {
      return res.status(400).json({
        mensajeError: "La duración del plan debe ser SEMESTRAL o ANUAL",
      });
    }

    const payload = {
      id_sede: Number.isInteger(id_sede) && id_sede > 0 ? id_sede : null,
      nombre_apellido: normalizarTexto(req.body?.nombre_apellido),
      dni: normalizarTexto(req.body?.dni),
      fecha_nacimiento: req.body?.fecha_nacimiento || null,
      correo: normalizarTexto(req.body?.correo, "lower"),
      domicilio: normalizarTexto(req.body?.domicilio),
      celular: normalizarTexto(req.body?.celular),
      plan_seleccionado: normalizarTexto(req.body?.plan_seleccionado),
      duracion_plan,
      modalidad_pago: normalizarTexto(req.body?.modalidad_pago),
      monto_pactado:
        req.body?.monto_pactado === undefined ||
        req.body?.monto_pactado === null
          ? null
          : String(req.body.monto_pactado).trim(),
      metodo_inscripcion: normalizarTexto(req.body?.metodo_inscripcion),
      comprobante_url: comprobanteDesdeArchivo || null,
      turno_seleccionado:
        req.body?.turno_seleccionado === undefined ||
        req.body?.turno_seleccionado === null
          ? null
          : normalizarTexto(req.body.turno_seleccionado),
      estado_contacto: normalizarTexto(
        req.body?.estado_contacto || "PENDIENTE",
      ),
      observaciones: req.body?.observaciones
        ? String(req.body.observaciones).trim()
        : null,
    };

    const camposObligatorios = [
      "id_sede",
      "nombre_apellido",
      "dni",
      "fecha_nacimiento",
      "correo",
      "domicilio",
      "celular",
      "plan_seleccionado",
      "duracion_plan",
      "modalidad_pago",
      "metodo_inscripcion",
      "estado_contacto",
    ];

    const faltantes = camposObligatorios.filter((campo) => {
      const valor = payload[campo];
      return (
        valor === null ||
        valor === undefined ||
        (typeof valor === "string" && valor.trim() === "")
      );
    });

    if (faltantes.length > 0) {
      return res.status(400).json({
        mensajeError: `Faltan campos obligatorios: ${faltantes.join(", ")}`,
      });
    }

    const forzarDuplicado =
    String(req.body?.confirmar_duplicado || "").trim() === "1";

    const preventaExistente = await PreventaModel.findOne({
      where: { dni: payload.dni },
      order: [["created_at", "DESC"]],
      attributes: ["id", "plan_seleccionado", "created_at"],
    });

    if (preventaExistente && !forzarDuplicado) {
      return res.status(409).json({
        mensajeError: "Ya existe una preventa con ese DNI",
        requiere_confirmacion: true,
        preventa_existente: preventaExistente,
      });
    }

    const nuevaPreventa = await PreventaModel.create(payload);
    const horario_id = req.body?.horario_id
      ? Number(req.body.horario_id)
      : null;

    if (horario_id !== null && (!Number.isInteger(horario_id) || horario_id <= 0)) {
      return res.status(400).json({
        mensajeError: "horario_id inválido",
      });
    }

    let resultadoAltaPilates = null;

    if (horario_id) {
      resultadoAltaPilates = await CR_ClientePilates_Preventa({
        nombre_apellido: payload.nombre_apellido,
        celular: payload.celular,
        duracion_plan: payload.duracion_plan,
        usuario_id: null,
        observaciones: payload.observaciones,
        id_preventa: nuevaPreventa.id,
        horario_id,
      });
    }
    return res.status(201).json({
      mensaje: "Preventa registrada correctamente",
      nuevaPreventa: serializarPreventa(nuevaPreventa),
      alta_pilates: resultadoAltaPilates
        ? {
            cliente: resultadoAltaPilates.cliente,
            inscripcion: resultadoAltaPilates.inscripcion,
            historial: resultadoAltaPilates.historial,
          }
        : null,
    });
  } catch (error) {
    console.error("Error al registrar preventa:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener todas las preventas (Para la gestión del gimnasio)
export const OBRS_Preventas_CTS = async (req, res) => {
  try {
    const registros = await PreventaModel.findAll({
      include: [
        {
          model: UsersModel,
          as: "usuario_contacto",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: SedeModel,
          as: "sede",
          attributes: ["id", "nombre"],
          required: false,
        },
      ],
      order: [["created_at", "DESC"]],
    });
    const respuesta = registros.map((registro) => {
      const preventaSerializada = serializarPreventa(registro);
      const nombreUsuario =
        typeof registro?.usuario_contacto?.name === "string"
          ? registro.usuario_contacto.name.trim()
          : "";
      const nombreSede =
        typeof registro?.sede?.nombre === "string"
          ? registro.sede.nombre.trim()
          : "";

      return {
        ...preventaSerializada,
        nombre_usuario_contacto: nombreUsuario || "No definido",
        nombre_sede: nombreSede || "No definida",
      };
    });

    res.json(respuesta);
  } catch (error) {
    console.error("Error al obtener preventas:", error);
    res.json({ mensajeError: error.message });
  }
};

// Modificar datos de preventa por ID
export const UR_Preventa_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const idPreventa = Number(id);

    if (!Number.isInteger(idPreventa) || idPreventa <= 0) {
      return res.status(400).json({ mensajeError: "ID de preventa inválido" });
    }

    const body = req.body || {};
    const archivoComprobante = obtenerArchivoComprobante(req);
    const comprobanteDesdeArchivo = archivoComprobante
      ? `${PREVENTAS_UPLOAD_PREFIX}${archivoComprobante.filename}`
      : null;

    const tiene = (campo) => Object.prototype.hasOwnProperty.call(body, campo);
    const cambios = {};

    if (tiene("id_sede")) {
      const idSede = Number(body.id_sede);
      if (!Number.isInteger(idSede) || idSede <= 0) {
        return res.status(400).json({ mensajeError: "id_sede inválido" });
      }
      cambios.id_sede = idSede;
    }

    if (tiene("nombre_apellido")) {
      cambios.nombre_apellido = normalizarTexto(body.nombre_apellido);
    }

    if (tiene("dni")) {
      cambios.dni = normalizarTexto(body.dni);
    }

    if (tiene("fecha_nacimiento")) {
      cambios.fecha_nacimiento = body.fecha_nacimiento || null;
    }

    if (tiene("correo")) {
      cambios.correo = normalizarTexto(body.correo, "lower");
    }

    if (tiene("domicilio")) {
      cambios.domicilio = normalizarTexto(body.domicilio);
    }

    if (tiene("celular")) {
      cambios.celular = normalizarTexto(body.celular);
    }

    if (tiene("plan_seleccionado")) {
      cambios.plan_seleccionado = normalizarTexto(body.plan_seleccionado);
    }

    if (tiene("observaciones")) {
      cambios.observaciones = body.observaciones
        ? String(body.observaciones).trim()
        : null;
    }

    if (tiene("duracion_plan")) {
      const duracionPlan = normalizarTexto(body.duracion_plan);
      if (!duracionPlan || !["SEMESTRAL", "ANUAL"].includes(duracionPlan)) {
        return res.status(400).json({
          mensajeError: "La duración del plan debe ser SEMESTRAL o ANUAL",
        });
      }
      cambios.duracion_plan = duracionPlan;
    }

    if (tiene("modalidad_pago")) {
      cambios.modalidad_pago = normalizarTexto(body.modalidad_pago);
    }

    if (tiene("monto_pactado")) {
      cambios.monto_pactado =
        body.monto_pactado === undefined || body.monto_pactado === null
          ? null
          : String(body.monto_pactado).trim();
    }

    if (tiene("metodo_inscripcion")) {
      cambios.metodo_inscripcion = normalizarTexto(body.metodo_inscripcion);
    }

    if (tiene("turno_seleccionado")) {
      cambios.turno_seleccionado =
        body.turno_seleccionado === undefined ||
        body.turno_seleccionado === null
          ? null
          : normalizarTexto(body.turno_seleccionado);
    }

    if (tiene("estado_contacto")) {
      cambios.estado_contacto = normalizarTexto(body.estado_contacto);
    }

    if (comprobanteDesdeArchivo) {
      cambios.comprobante_url = comprobanteDesdeArchivo;
    }

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({
        mensajeError: "No se enviaron campos para actualizar",
      });
    }

    const [filasActualizadas] = await PreventaModel.update(cambios, {
      where: { id: idPreventa },
    });

    if (filasActualizadas !== 1) {
      return res
        .status(404)
        .json({ mensajeError: "No se encontró el registro" });
    }

    const registroActualizado = await PreventaModel.findByPk(idPreventa, {
      include: [
        {
          model: UsersModel,
          as: "usuario_contacto",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    const preventaSerializada = serializarPreventa(registroActualizado);
    const nombreUsuario =
      typeof registroActualizado?.usuario_contacto?.name === "string"
        ? registroActualizado.usuario_contacto.name.trim()
        : "";

    return res.json({
      mensaje: "Preventa actualizada correctamente",
      preventa: {
        ...preventaSerializada,
        nombre_usuario_contacto: nombreUsuario || "No definido",
      },
    });
  } catch (error) {
    console.error("Error al actualizar preventa:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar estado de contacto (Botón "Contactado" del colaborador)
export const UR_Preventa_Contacto_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_usuario_contacto } = req.body;

    let fecha_contacto = null;
    let estado_contacto = "PENDIENTE";
    if (id_usuario_contacto) {
      fecha_contacto = new Date();
      estado_contacto = "CONTACTADO";
    }

    console.log(id_usuario_contacto, fecha_contacto, estado_contacto);

    const [filasActualizadas] = await PreventaModel.update(
      {
        estado_contacto,
        id_usuario_contacto,
        fecha_contacto,
      },
      { where: { id } },
    );

    if (filasActualizadas === 1) {
      res.json({ mensaje: "Contacto registrado correctamente" });
    } else {
      res.status(404).json({ mensajeError: "No se encontró el registro" });
    }
  } catch (error) {
    console.error("Error al actualizar contacto:", error);
    res.json({ mensajeError: error.message });
  }
};

// Eliminar registro de preventa por ID
export const ER_Preventa_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const idPreventa = Number(id);

    if (!Number.isInteger(idPreventa) || idPreventa <= 0) {
      return res.status(400).json({ mensajeError: "ID de preventa inválido" });
    }

    const filasEliminadas = await PreventaModel.destroy({
      where: { id: idPreventa },
    });

    if (filasEliminadas === 1) {
      return res.json({ mensaje: "Preventa eliminada correctamente" });
    }

    return res.status(404).json({ mensajeError: "No se encontró el registro" });
  } catch (error) {
    console.error("Error al eliminar preventa:", error);
    return res.status(500).json({ mensajeError: error.message });
  }
};

// Obtener preventa por DNI (Para verificar si ya existe una preventa registrada con ese DNI)
export const OBR_PreventaPorDni_CTS = async (req, res) => {
  try {
    const dni = normalizarTexto(req.params?.dni);

    if (!dni) {
      return res.status(400).json({
        mensajeError: "DNI inválido",
      });
    }

    const preventa = await PreventaModel.findOne({
      where: { dni },
      order: [["created_at", "DESC"]],
      attributes: [
        "id",
        "nombre_apellido",
        "dni",
        "plan_seleccionado",
        "duracion_plan",
        "modalidad_pago",
        "metodo_inscripcion",
        "created_at",
      ],
    });

    if (!preventa) {
      return res.json({
        existe: false,
        preventa: null,
      });
    }

    return res.json({
      existe: true,
      preventa,
    });
  } catch (error) {
    console.error("Error al verificar DNI de preventa:", error);
    return res.status(500).json({
      mensajeError: error.message,
    });
  }
};