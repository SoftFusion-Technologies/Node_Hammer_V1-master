/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 23/10/2025
 * Versión: 1.0
 *
 * Descripción:
 * Este archivo contiene los controladores para gestionar la Lista de Espera de
 * Pilates. Incluye las operaciones CRUD y la lógica para filtrar, ordenar
 * por prioridad y adjuntar los registros de seguimiento (contactos)
 * con el nombre del usuario que los cargó.
 *
 * Tema: Controladores - Lista de Espera Pilates
 *
 * Capa: Backend
 */

import ListaEsperaPilates from "../Models/MD_TB_ListaEsperaPilates.js";
import ContactosListaEsperaPilatesModel from "../Models/MD_TB_ContactosListaEsperaPilates.js";
import UsersModel from "../Models/MD_TB_Users.js";

import { MOVER_ListaEsperaPilatesARemarketing } from "./CTS_TB_VentasRemarketing.js";

// Obtener todos
// Endpoint: GET /lista_espera_pilates?sedeId=<id>
// - Permite filtrar por `id_sede` opcionalmente.
// - Devuelve la lista de espera ordenada por prioridad ("Cambio de turno" primero)
//   y por `fecha_carga` en caso de empate.
// - Para cada elemento, adjunta un array `contacto_cliente` con los intentos de
//   contacto registrados; cada contacto incluye además `nombre_usuario_contacto`
//   resuelto desde la tabla `users` (si existe).
export const OBRS_ListaEsperaPilates = async (req, res) => {
  try {
    const { sedeId } = req.query;

    const whereCondition = {};
    if (sedeId) {
      if (!/^\d+$/.test(sedeId)) {
        return res
          .status(400)
          .json({ error: "sedeId debe ser un número válido." });
      }
      whereCondition.id_sede = parseInt(sedeId, 10);
    }

    // 1. Obtenemos los registros de la lista de espera
    const lista = await ListaEsperaPilates.findAll({
      where: whereCondition,
      order: [
        [
          ListaEsperaPilates.sequelize.literal(
            "CASE WHEN tipo = 'Cambio de turno' THEN 1 ELSE 2 END"
          ),
          "ASC",
        ],
        ["fecha_carga", "ASC"],
      ],
    });

    const listaIds = lista.map((l) => l.id);

    // --> LA CORRECCIÓN EMPIEZA AQUÍ <--

    // 2. Declaramos las variables fuera del 'if' para que estén disponibles en toda la función
    let contactosPorLista = {};
    let usersMap = {};

    if (listaIds.length > 0) {
      // Obtenemos los contactos asociados a la lista de espera
      const contactos = await ContactosListaEsperaPilatesModel.findAll({
        where: { id_lista_espera: listaIds },
        order: [["fecha_contacto", "DESC"]],
      });

      // 3. Recolectamos TODOS los IDs de usuario necesarios en un solo paso
      const contactUserIds = contactos.map((c) => c.id_usuario_contacto);
      const mainListUserIds = lista.map((l) => l.id_usuario_cargado);
      const allUserIds = Array.from(
        new Set([...contactUserIds, ...mainListUserIds])
      ).filter(Boolean);

      // 4. Creamos el mapa de usuarios (ID -> Nombre) con una sola consulta
      if (allUserIds.length > 0) {
        const users = await UsersModel.findAll({
          where: { id: allUserIds },
          attributes: ["id", "name"],
        });
        usersMap = users.reduce((map, user) => {
          map[user.id] = user.name;
          return map;
        }, {});
      }

      // 5. Procesamos los contactos para agruparlos y añadir el nombre del usuario
      contactosPorLista = contactos.reduce((acc, c) => {
        const contactoPlain = c.get({ plain: true });
        const key = contactoPlain.id_lista_espera;
        if (!acc[key]) acc[key] = [];
        contactoPlain.nombre_usuario_contacto =
          usersMap[contactoPlain.id_usuario_contacto] || "N/D";
        acc[key].push(contactoPlain);
        return acc;
      }, {});
    }

    // 6. Mapeamos la respuesta final, reemplazando 'id_usuario_cargado' por su nombre
    const listaConContactos = lista.map((item) => {
      const plainItem = item.get({ plain: true });

      const resultado = {
        ...plainItem,
        // Usamos el 'usersMap' que ahora sí está disponible
        nombre_usuario_cargado:
          usersMap[plainItem.id_usuario_cargado].toUpperCase() || "N/D",
        // Adjuntamos los contactos si existen
        contacto_cliente: contactosPorLista[plainItem.id] || [],
      };

      // Eliminamos el campo del ID original para limpiar la respuesta
      delete resultado.id_usuario_cargado;

      return resultado;
    });

    // --> LA CORRECCIÓN TERMINA AQUÍ <--

    res.json(listaConContactos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Obtener uno por ID
export const OBR_ListaEsperaPilates = async (req, res) => {
  try {
    const item = await ListaEsperaPilates.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: "No encontrado" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Alta
export const CR_ListaEsperaPilates = async (req, res) => {
  try {
    // DTO y validaciones
    const {
      nombre,
      contacto,
      tipo,
      plan_interes,
      horarios_preferidos,
      observaciones,
      id_sede,
      id_usuario_cargado,
    } = req.body;

    // Validaciones obligatorias
    if (
      id_sede &&
      (!/^\d+$/.test(id_sede.toString()) || parseInt(id_sede) <= 0)
    ) {
      return res
        .status(400)
        .json({ error: "id_sede debe ser un número positivo." });
    }
    if (!nombre || typeof nombre !== "string" || nombre.trim() === "") {
      return res
        .status(400)
        .json({ error: "El nombre es obligatorio y debe ser texto." });
    }
    if (!tipo || !["Espera", "Cambio de turno"].includes(tipo)) {
      return res.status(400).json({
        error:
          'El tipo es obligatorio y debe ser "Espera" o "Cambio de turno".',
      });
    }
    if (
      !plan_interes ||
      !["L-M-V", "M-J", "Cualquier dia"].includes(plan_interes)
    ) {
      return res.status(400).json({
        error:
          'El plan_interes es obligatorio y debe ser "L-M-V", "M-J" o "Cualquier dia".',
      });
    }
    if (contacto && typeof contacto !== "string") {
      return res.status(400).json({ error: "El contacto debe ser texto." });
    }
    if (horarios_preferidos && typeof horarios_preferidos !== "string") {
      return res
        .status(400)
        .json({ error: "horarios_preferidos debe ser texto." });
    }
    if (observaciones && typeof observaciones !== "string") {
      return res.status(400).json({ error: "observaciones debe ser texto." });
    }
    if (!id_usuario_cargado || !/^\d+$/.test(id_usuario_cargado.toString())) {
      return res
        .status(400)
        .json({
          error: "id_usuario_cargado es obligatorio y debe ser numérico.",
        });
    }

    // Crear DTO limpio
    const dto = {
      nombre: nombre.trim().toUpperCase(),
      contacto: contacto ? contacto.trim().toUpperCase() : null,
      tipo,
      plan_interes,
      horarios_preferidos: horarios_preferidos
        ? horarios_preferidos.trim().toUpperCase()
        : null,
      observaciones: observaciones ? observaciones.trim().toUpperCase() : null,
      id_sede: id_sede ? parseInt(id_sede, 10) : null,
      id_usuario_cargado: id_usuario_cargado
        ? parseInt(id_usuario_cargado, 10)
        : null,
    };

    const nuevo = await ListaEsperaPilates.create(dto);
    res.status(201).json(nuevo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Modificación
export const UR_ListaEsperaPilates = async (req, res) => {
  try {
    const {
      nombre,
      contacto,
      tipo,
      plan_interes,
      horarios_preferidos,
      observaciones,
    } = req.body;

    // Validaciones obligatorias
    if (!nombre || typeof nombre !== "string" || nombre.trim() === "") {
      return res
        .status(400)
        .json({ error: "El nombre es obligatorio y debe ser texto." });
    }
    if (!tipo || !["Espera", "Cambio de turno"].includes(tipo)) {
      return res.status(400).json({
        error:
          'El tipo es obligatorio y debe ser "Espera" o "Cambio de turno".',
      });
    }
    if (
      !plan_interes ||
      !["L-M-V", "M-J", "Cualquier dia"].includes(plan_interes)
    ) {
      return res.status(400).json({
        error:
          'El plan_interes es obligatorio y debe ser "L-M-V", "M-J" o "Cualquier dia".',
      });
    }
    if (contacto && typeof contacto !== "string") {
      return res.status(400).json({ error: "El contacto debe ser texto." });
    }
    if (horarios_preferidos && typeof horarios_preferidos !== "string") {
      return res
        .status(400)
        .json({ error: "horarios_preferidos debe ser texto." });
    }
    if (observaciones && typeof observaciones !== "string") {
      return res.status(400).json({ error: "observaciones debe ser texto." });
    }

    // Crear DTO limpio
    const dto = {
      nombre: nombre.trim().toUpperCase(),
      contacto: contacto ? contacto.trim().toUpperCase() : null,
      tipo,
      plan_interes,
      horarios_preferidos: horarios_preferidos
        ? horarios_preferidos.trim().toUpperCase()
        : null,
      observaciones: observaciones ? observaciones.trim().toUpperCase() : null,
    };

    const actualizado = await ListaEsperaPilates.update(dto, {
      where: { id: req.params.id },
    });
    if (actualizado[0] === 0)
      return res.status(404).json({ error: "No encontrado" });
    res.json({ message: "Actualizado" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Baja
export const ER_ListaEsperaPilates = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido." });
    }

    // Mover el cliente a remarketing antes de eliminarlo
    await MOVER_ListaEsperaPilatesARemarketing(id);

    const eliminado = await ListaEsperaPilates.destroy({
      where: { id },
    });
    if (!eliminado) return res.status(404).json({ error: "No encontrado" });
    res.json({ message: "Eliminado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
