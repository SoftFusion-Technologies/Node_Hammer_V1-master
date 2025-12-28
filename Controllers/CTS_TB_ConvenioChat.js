/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 28 / 12 / 2025
 * Versión: 1.0
 *
 * Descripción:
 * Controladores para el módulo de Chat Convenio <-> Gimnasio.
 * Tablas:
 *  - convenio_chat_threads (1 hilo por convenio)
 *  - convenio_chat_messages (historial de mensajes con contexto monthStart)
 *  - convenio_chat_message_reads (lecturas por usuario del gimnasio)
 *
 * Integración:
 *  - Cada vez que el CONVENIO envía un mensaje, se registra/actualiza en convenios_mes_acciones
 *    con tipo CHAT_MENSAJE (UPSERT por uq_cma_convenio_mes_tipo) y se resetea a no leído.
 *
 * Tema: Controladores - ConvenioChat
 * Capa: Backend
 *
 * Nomenclatura:
 *   OBR_  obtenerRegistro
 *   OBRS_ obtenerRegistros
 *   CR_   crearRegistro
 *   ER_   eliminarRegistro
 */

import db from '../DataBase/db.js';

import MD_TB_ConvenioChatThreads from '../Models/MD_TB_ConvenioChatThreads.js';
const ConvenioChatThreadsModel =
  MD_TB_ConvenioChatThreads.ConvenioChatThreadsModel;

import MD_TB_ConvenioChatMessages from '../Models/MD_TB_ConvenioChatMessages.js';
const ConvenioChatMessagesModel =
  MD_TB_ConvenioChatMessages.ConvenioChatMessagesModel;

import MD_TB_ConvenioChatMessageReads from '../Models/MD_TB_ConvenioChatMessageReads.js';
const ConvenioChatMessageReadsModel =
  MD_TB_ConvenioChatMessageReads.ConvenioChatMessageReadsModel;

import UsersModel from '../Models/MD_TB_Users.js';

// -------------------- Helpers --------------------

const isEmpty = (v) => v === null || v === undefined || String(v).trim() === '';

const toIntOrNull = (v) => {
  if (isEmpty(v)) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

function assertMonthStartFormat(v) {
  const ok = /^\d{4}-\d{2}-01 00:00:00$/.test(String(v || ''));
  if (!ok) {
    const e = new Error('Mes inválido. Debe ser YYYY-MM-01 00:00:00');
    e.statusCode = 400;
    throw e;
  }
}

const ALLOWED_SENDER = new Set(['CONVENIO', 'GIMNASIO']);
function assertSenderTipo(tipo) {
  const t = String(tipo || '').trim();
  if (!ALLOWED_SENDER.has(t)) {
    const e = new Error(
      "sender_tipo inválido. Debe ser 'CONVENIO' o 'GIMNASIO'."
    );
    e.statusCode = 400;
    throw e;
  }
  return t;
}

function makePreview(text, max = 140) {
  const s = String(text || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

async function getConvenioInfo(convenio_id, transaction) {
  const rows = await db.query(
    `
    SELECT id, nameConve, descConve
    FROM adm_convenios
    WHERE id = :convenio_id
    LIMIT 1
    `,
    {
      replacements: { convenio_id },
      type: db.QueryTypes.SELECT,
      transaction
    }
  );
  return rows[0] || null;
}

async function resolveUserInfo({ req, bodyUserId, bodyUserName, transaction }) {
  // 1) Si existe req.user (por middleware), priorizarlo
  if (req?.user && (req.user.id || req.user.name)) {
    return {
      id: toIntOrNull(req.user.id),
      name: isEmpty(req.user.name) ? null : String(req.user.name).trim()
    };
  }

  // 2) Tomar lo que venga en body
  const id = toIntOrNull(bodyUserId);
  const name = isEmpty(bodyUserName) ? null : String(bodyUserName).trim();

  if (name || !id) return { id, name };

  // 3) Si solo viene id, buscar en users
  const u = await UsersModel.findByPk(id, { transaction });
  if (!u) return { id, name: null };

  return { id, name: u.name || null };
}

async function getOrCreateThread({ convenio_id, transaction }) {
  // Insert idempotente por UNIQUE (convenio_id)
  await db.query(
    `
    INSERT INTO convenio_chat_threads (convenio_id)
    VALUES (:convenio_id)
    ON DUPLICATE KEY UPDATE
      updated_at = updated_at
    `,
    {
      replacements: { convenio_id },
      type: db.QueryTypes.INSERT,
      transaction
    }
  );

  const rows = await db.query(
    `
    SELECT *
    FROM convenio_chat_threads
    WHERE convenio_id = :convenio_id
    LIMIT 1
    `,
    {
      replacements: { convenio_id },
      type: db.QueryTypes.SELECT,
      transaction
    }
  );

  return rows[0] || null;
}

async function updateThreadLastMessageAt({ thread_id, transaction }) {
  await db.query(
    `
    UPDATE convenio_chat_threads
    SET last_message_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = :thread_id
    `,
    {
      replacements: { thread_id },
      type: db.QueryTypes.UPDATE,
      transaction
    }
  );
}

async function setThreadNombreContactoIfEmpty({
  thread_id,
  nombre_contacto,
  transaction
}) {
  if (isEmpty(nombre_contacto)) return;

  await db.query(
    `
    UPDATE convenio_chat_threads
    SET convenio_nombre_contacto = COALESCE(convenio_nombre_contacto, :nombre),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = :thread_id
    `,
    {
      replacements: {
        thread_id,
        nombre: String(nombre_contacto).trim()
      },
      type: db.QueryTypes.UPDATE,
      transaction
    }
  );
}

// UPSERT a convenios_mes_acciones para "CHAT_MENSAJE" (respetando UNIQUE convenio_id+monthStart+tipo)
async function upsertAccionChatMensaje({
  convenio_id,
  monthStart,
  descripcion,
  creado_por_nombre,
  thread_id,
  last_message_id,
  transaction
}) {
  await db.query(
    `
    INSERT INTO convenios_mes_acciones
      (convenio_id, monthStart, tipo, descripcion, creado_por_id, creado_por_nombre,
       leido, leido_at, leido_por_id, leido_por_nombre, meta_json)
    VALUES
      (:convenio_id, :monthStart, 'CHAT_MENSAJE', :descripcion, NULL, :creado_por_nombre,
       0, NULL, NULL, NULL,
       JSON_OBJECT(
         'thread_id', :thread_id,
         'last_message_id', :last_message_id,
         'sender_tipo', 'CONVENIO'
       )
      )
    ON DUPLICATE KEY UPDATE
      descripcion = VALUES(descripcion),
      creado_por_id = NULL,
      creado_por_nombre = VALUES(creado_por_nombre),
      leido = 0,
      leido_at = NULL,
      leido_por_id = NULL,
      leido_por_nombre = NULL,
      meta_json = VALUES(meta_json),
      updated_at = CURRENT_TIMESTAMP
    `,
    {
      replacements: {
        convenio_id,
        monthStart,
        descripcion: isEmpty(descripcion) ? null : String(descripcion).trim(),
        creado_por_nombre: isEmpty(creado_por_nombre)
          ? null
          : String(creado_por_nombre).trim(),
        thread_id,
        last_message_id
      },
      type: db.QueryTypes.INSERT,
      transaction
    }
  );
}

// -------------------- Controladores --------------------

// GET /convenio-chat/thread?convenio_id=58
export const OBR_ConvenioChatThread_ByConvenio_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const convenio_id = toIntOrNull(req.query.convenio_id);
    if (!convenio_id || convenio_id <= 0) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'convenio_id es obligatorio.' });
    }

    const convenio = await getConvenioInfo(convenio_id, t);
    if (!convenio) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Convenio inexistente.' });
    }

    const thread = await getOrCreateThread({ convenio_id, transaction: t });

    await t.commit();
    return res.json({
      thread,
      convenio: {
        id: convenio.id,
        nameConve: convenio.nameConve,
        descConve: convenio.descConve
      },
      needs_convenio_name: !thread?.convenio_nombre_contacto
    });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// PATCH /convenio-chat/thread/:id/nombre
// Body: convenio_nombre_contacto
export const UPD_ConvenioChatThread_SetNombre_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const id = toIntOrNull(req.params.id);
    const nombre = isEmpty(req.body.convenio_nombre_contacto)
      ? null
      : String(req.body.convenio_nombre_contacto).trim();

    if (!id || id <= 0) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }
    if (!nombre) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'convenio_nombre_contacto es obligatorio.' });
    }

    await db.query(
      `
      UPDATE convenio_chat_threads
      SET convenio_nombre_contacto = :nombre,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = :id
      `,
      {
        replacements: { id, nombre },
        type: db.QueryTypes.UPDATE,
        transaction: t
      }
    );

    const rows = await db.query(
      `SELECT * FROM convenio_chat_threads WHERE id = :id LIMIT 1`,
      {
        replacements: { id },
        type: db.QueryTypes.SELECT,
        transaction: t
      }
    );

    await t.commit();
    return res.json({ thread: rows[0] || null });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// GET /convenio-chat/messages?thread_id=1&monthStart=YYYY-MM-01 00:00:00&viewer_user_id=36&limit=50&offset=0
export const OBRS_ConvenioChatMessages_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const thread_id = toIntOrNull(req.query.thread_id);
    const monthStart = isEmpty(req.query.monthStart)
      ? null
      : String(req.query.monthStart).trim();

    // Nuevo: para calcular read_by_me / unread count (lado gimnasio)
    const viewer_user_id = toIntOrNull(
      req.query.viewer_user_id ?? req.query.user_id ?? null
    );

    const include_deleted =
      String(req.query.include_deleted || '').trim() === '1';

    const limit = Math.min(
      Math.max(toIntOrNull(req.query.limit) || 50, 1),
      200
    );
    const offset = Math.max(toIntOrNull(req.query.offset) || 0, 0);

    if (!thread_id || thread_id <= 0) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'thread_id es obligatorio.' });
    }
    if (monthStart) assertMonthStartFormat(monthStart);

    const where = [`m.thread_id = :thread_id`];
    const repl = { thread_id, limit, offset, viewer_user_id };

    if (monthStart) {
      where.push(`m.monthStart = :monthStart`);
      repl.monthStart = monthStart;
    }

    // Por defecto ocultamos borrados
    if (!include_deleted) {
      where.push(`m.deleted_at IS NULL`);
    }

    const joinRead = viewer_user_id
      ? `
        LEFT JOIN convenio_chat_message_reads r
          ON r.message_id = m.id
         AND r.reader_user_id = :viewer_user_id
      `
      : ``;

    const selectRead = viewer_user_id
      ? `,
    CASE WHEN r.id IS NULL THEN 0 ELSE 1 END AS read_by_me,
    r.read_at AS read_at_me
  `
      : ``;

    const rows = await db.query(
      `
      SELECT m.*
      ${selectRead}
      FROM convenio_chat_messages m
      ${joinRead}
      WHERE ${where.join(' AND ')}
      ORDER BY m.created_at ASC
      LIMIT :limit OFFSET :offset
      `,
      {
        replacements: repl,
        type: db.QueryTypes.SELECT,
        transaction: t
      }
    );

    const countRows = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM convenio_chat_messages m
      WHERE ${where.join(' AND ')}
      `,
      {
        replacements: repl,
        type: db.QueryTypes.SELECT,
        transaction: t
      }
    );

    // Nuevo: unread count (solo si hay viewer_user_id)
    let unread = 0;
    if (viewer_user_id) {
      const unreadRows = await db.query(
        `
        SELECT COUNT(*) AS unread
        FROM convenio_chat_messages m
        LEFT JOIN convenio_chat_message_reads r
          ON r.message_id = m.id
         AND r.reader_user_id = :viewer_user_id
        WHERE m.thread_id = :thread_id
          ${monthStart ? `AND m.monthStart = :monthStart` : ``}
          ${include_deleted ? `` : `AND m.deleted_at IS NULL`}
          AND m.sender_tipo = 'CONVENIO'
          AND r.id IS NULL
        `,
        {
          replacements: repl,
          type: db.QueryTypes.SELECT,
          transaction: t
        }
      );

      unread = Number(unreadRows?.[0]?.unread || 0);
    }

    await t.commit();
    return res.json({
      mensajes: rows || [],
      meta: {
        total: Number(countRows?.[0]?.total || 0),
        unread,
        limit,
        offset
      }
    });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// POST /convenio-chat/messages
// Body:
//  - convenio_id (opcional si mandás thread_id)
//  - thread_id (opcional si mandás convenio_id)
//  - monthStart (obligatorio)
//  - sender_tipo: CONVENIO | GIMNASIO (obligatorio)
//  - mensaje (obligatorio)
//  - sender_nombre (opcional; para CONVENIO si aún no hay nombre guardado)
//  - user_id/user_name (opcionales; para GIMNASIO si no hay req.user)
export const CR_ConvenioChatMessage_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const convenio_id = toIntOrNull(req.body.convenio_id);
    const thread_id_body = toIntOrNull(req.body.thread_id);

    const monthStart = isEmpty(req.body.monthStart)
      ? null
      : String(req.body.monthStart).trim();

    const sender_tipo = assertSenderTipo(req.body.sender_tipo);

    const mensaje = isEmpty(req.body.mensaje)
      ? null
      : String(req.body.mensaje).trim();
    const sender_nombre_body = isEmpty(req.body.sender_nombre)
      ? null
      : String(req.body.sender_nombre).trim();

    if (!monthStart) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'monthStart es obligatorio.' });
    }
    assertMonthStartFormat(monthStart);

    if (!mensaje) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'mensaje es obligatorio.' });
    }

    // Resolver thread
    let thread = null;

    if (thread_id_body && thread_id_body > 0) {
      const rows = await db.query(
        `SELECT * FROM convenio_chat_threads WHERE id = :id LIMIT 1`,
        {
          replacements: { id: thread_id_body },
          type: db.QueryTypes.SELECT,
          transaction: t
        }
      );
      thread = rows[0] || null;
      if (!thread) {
        await t.rollback();
        return res.status(404).json({ mensajeError: 'Thread inexistente.' });
      }
    } else {
      if (!convenio_id || convenio_id <= 0) {
        await t.rollback();
        return res
          .status(400)
          .json({ mensajeError: 'convenio_id o thread_id es obligatorio.' });
      }

      const convenio = await getConvenioInfo(convenio_id, t);
      if (!convenio) {
        await t.rollback();
        return res.status(404).json({ mensajeError: 'Convenio inexistente.' });
      }

      thread = await getOrCreateThread({ convenio_id, transaction: t });
    }

    const thread_id = thread.id;

    // Resolver emisor
    let sender_user_id = null;
    let sender_nombre = null;

    if (sender_tipo === 'GIMNASIO') {
      const userInfo = await resolveUserInfo({
        req,
        bodyUserId: req.body.user_id ?? req.body.userId ?? null,
        bodyUserName: req.body.user_name ?? req.body.userName ?? null,
        transaction: t
      });

      sender_user_id = userInfo.id ?? null;
      sender_nombre = userInfo.name ?? null;

      if (isEmpty(sender_nombre)) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'No se pudo resolver el nombre del usuario (gimnasio).'
        });
      }
    } else {
      // CONVENIO
      sender_nombre = thread.convenio_nombre_contacto || sender_nombre_body;

      if (isEmpty(sender_nombre)) {
        await t.rollback();
        return res.status(400).json({
          mensajeError:
            'Nombre del convenio requerido. En la primera vez enviar sender_nombre o setear convenio_nombre_contacto.'
        });
      }

      // Si el thread no tenía nombre, lo seteamos
      if (isEmpty(thread.convenio_nombre_contacto) && sender_nombre_body) {
        await setThreadNombreContactoIfEmpty({
          thread_id,
          nombre_contacto: sender_nombre_body,
          transaction: t
        });

        // refrescar thread (mínimo)
        thread.convenio_nombre_contacto = sender_nombre_body;
      }
    }
    // Insert mensaje (RAW) para evitar conversiones de timezone que rompen chk_chat_msg_monthStart
    await db.query(
      `
  INSERT INTO convenio_chat_messages
    (thread_id, monthStart, sender_tipo, sender_user_id, sender_nombre, mensaje)
  VALUES
    (:thread_id, :monthStart, :sender_tipo, :sender_user_id, :sender_nombre, :mensaje)
  `,
      {
        replacements: {
          thread_id,
          monthStart, // "YYYY-MM-01 00:00:00"
          sender_tipo,
          sender_user_id,
          sender_nombre,
          mensaje
        },
        type: db.QueryTypes.INSERT,
        transaction: t
      }
    );

    const idRow = await db.query(`SELECT LAST_INSERT_ID() AS id`, {
      type: db.QueryTypes.SELECT,
      transaction: t
    });
    const messageId = Number(idRow?.[0]?.id || 0);

    if (!messageId) {
      const e = new Error('No se pudo obtener el ID del mensaje insertado.');
      e.statusCode = 500;
      throw e;
    }

    // Update last_message_at en thread
    await updateThreadLastMessageAt({ thread_id, transaction: t });

    // Si escribe el convenio: upsert en convenios_mes_acciones (CHAT_MENSAJE) + reset leído
    if (sender_tipo === 'CONVENIO') {
      const preview = makePreview(mensaje, 140);
      const convId = toIntOrNull(thread.convenio_id);
      if (convId) {
        await upsertAccionChatMensaje({
          convenio_id: convId,
          monthStart,
          descripcion: preview,
          creado_por_nombre: sender_nombre,
          thread_id,
          last_message_id: messageId,
          transaction: t
        });
      }
    }

    // devolver registro
    const rows = await db.query(
      `SELECT * FROM convenio_chat_messages WHERE id = :id LIMIT 1`,
      {
        replacements: { id: messageId },
        type: db.QueryTypes.SELECT,
        transaction: t
      }
    );

    await t.commit();
    return res.status(201).json({ mensaje: rows[0] || null });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// PATCH /convenio-chat/messages/:id
// Body: mensaje
export const UPD_ConvenioChatMessage_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const id = toIntOrNull(req.params.id);
    const mensaje = isEmpty(req.body.mensaje)
      ? null
      : String(req.body.mensaje).trim();

    if (!id || id <= 0) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }
    if (!mensaje) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'mensaje es obligatorio.' });
    }

    // No permitir editar si está borrado
    const current = await db.query(
      `SELECT * FROM convenio_chat_messages WHERE id = :id LIMIT 1`,
      {
        replacements: { id },
        type: db.QueryTypes.SELECT,
        transaction: t
      }
    );
    const reg = current[0] || null;
    if (!reg) {
      await t.commit();
      return res.status(404).json({ mensajeError: 'Mensaje no encontrado.' });
    }
    if (reg.deleted_at) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'No se puede editar un mensaje eliminado.' });
    }

    await db.query(
      `
      UPDATE convenio_chat_messages
      SET mensaje = :mensaje,
          edited_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = :id
      `,
      {
        replacements: { id, mensaje },
        type: db.QueryTypes.UPDATE,
        transaction: t
      }
    );

    const rows = await db.query(
      `SELECT * FROM convenio_chat_messages WHERE id = :id LIMIT 1`,
      {
        replacements: { id },
        type: db.QueryTypes.SELECT,
        transaction: t
      }
    );

    await t.commit();
    return res.json({ mensaje: rows[0] || null });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// DELETE /convenio-chat/messages/:id
// Body: delete_reason (opcional), user_id/user_name (opcionales) (para gimnasio)
export const ER_ConvenioChatMessage_SoftDelete_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const id = toIntOrNull(req.params.id);
    if (!id || id <= 0) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const reason = isEmpty(req.body.delete_reason)
      ? null
      : String(req.body.delete_reason).trim();

    const userInfo = await resolveUserInfo({
      req,
      bodyUserId: req.body.user_id ?? req.body.userId ?? null,
      bodyUserName: req.body.user_name ?? req.body.userName ?? null,
      transaction: t
    });

    await db.query(
      `
      UPDATE convenio_chat_messages
      SET deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP),
          deleted_by_user_id = :deleted_by_user_id,
          delete_reason = :delete_reason,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = :id
      `,
      {
        replacements: {
          id,
          deleted_by_user_id: userInfo.id ?? null,
          delete_reason: reason
        },
        type: db.QueryTypes.UPDATE,
        transaction: t
      }
    );

    const rows = await db.query(
      `SELECT * FROM convenio_chat_messages WHERE id = :id LIMIT 1`,
      {
        replacements: { id },
        type: db.QueryTypes.SELECT,
        transaction: t
      }
    );

    await t.commit();
    return res.json({ mensaje: rows[0] || null });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// POST /convenio-chat/acciones/marcar-leido
// Body: convenio_id, monthStart, user_id/user_name (opcionales). Si no, intenta req.user.
// Marca leído el row único de convenios_mes_acciones (tipo CHAT_MENSAJE) para ese convenio/mes.
export const MARCAR_LEIDO_ConvenioChatAccion_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const convenio_id = toIntOrNull(req.body.convenio_id);
    const monthStart = isEmpty(req.body.monthStart)
      ? null
      : String(req.body.monthStart).trim();

    if (!convenio_id || convenio_id <= 0) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'convenio_id es obligatorio.' });
    }
    if (!monthStart) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'monthStart es obligatorio.' });
    }
    assertMonthStartFormat(monthStart);

    const userInfo = await resolveUserInfo({
      req,
      bodyUserId: req.body.user_id ?? req.body.userId ?? null,
      bodyUserName: req.body.user_name ?? req.body.userName ?? null,
      transaction: t
    });

    await db.query(
      `
      UPDATE convenios_mes_acciones
      SET
        leido = 1,
        leido_at = CURRENT_TIMESTAMP,
        leido_por_id = :leido_por_id,
        leido_por_nombre = :leido_por_nombre,
        updated_at = CURRENT_TIMESTAMP
      WHERE convenio_id = :convenio_id
        AND monthStart = :monthStart
        AND tipo = 'CHAT_MENSAJE'
      `,
      {
        replacements: {
          convenio_id,
          monthStart,
          leido_por_id: userInfo.id ?? null,
          leido_por_nombre: userInfo.name ?? null
        },
        type: db.QueryTypes.UPDATE,
        transaction: t
      }
    );

    const rows = await db.query(
      `
      SELECT *
      FROM convenios_mes_acciones
      WHERE convenio_id = :convenio_id
        AND monthStart = :monthStart
        AND tipo = 'CHAT_MENSAJE'
      LIMIT 1
      `,
      {
        replacements: { convenio_id, monthStart },
        type: db.QueryTypes.SELECT,
        transaction: t
      }
    );

    await t.commit();
    return res.json({ registro: rows[0] || null });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};

// POST /convenio-chat/messages/:id/read
// Crea una marca de lectura por usuario (tabla convenio_chat_message_reads).
export const CR_ConvenioChatMessageRead_CTS = async (req, res) => {
  const t = await db.transaction();
  try {
    const message_id = toIntOrNull(req.params.id);
    if (!message_id || message_id <= 0) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const userInfo = await resolveUserInfo({
      req,
      bodyUserId: req.body.user_id ?? req.body.userId ?? null,
      bodyUserName: req.body.user_name ?? req.body.userName ?? null,
      transaction: t
    });

    if (!userInfo.id) {
      await t.rollback();
      return res
        .status(400)
        .json({ mensajeError: 'No se pudo resolver user_id.' });
    }

    // Insert idempotente por UNIQUE (message_id, reader_user_id)
    await db.query(
      `
      INSERT INTO convenio_chat_message_reads (message_id, reader_user_id)
      VALUES (:message_id, :reader_user_id)
      ON DUPLICATE KEY UPDATE
        read_at = read_at
      `,
      {
        replacements: { message_id, reader_user_id: userInfo.id },
        type: db.QueryTypes.INSERT,
        transaction: t
      }
    );

    await t.commit();
    return res.status(201).json({ ok: true });
  } catch (error) {
    await t.rollback();
    const code = error.statusCode || 500;
    return res.status(code).json({ mensajeError: error.message });
  }
};
