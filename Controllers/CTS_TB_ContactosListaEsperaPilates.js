import ContactosListaEsperaPilatesModel from "../Models/MD_TB_ContactosListaEsperaPilates.js";

// Crear un nuevo contacto en la lista de espera
export async function CR_crearContacto(req, res) {
  try {
    const {
      id_lista_espera,
      id_usuario_contacto,
      estado_contacto,
      notas, // notas no necesita validación por ahora
    } = req.body;

    // --- VALIDACIONES ---
    // isNaN(valor) significa "is Not a Number" (no es un número)
    if (!id_lista_espera || isNaN(id_lista_espera)) {
      return res.status(400).json({
        error:
          "El ID de la lista de espera es obligatorio y debe ser un número.",
      });
    }

    if (!id_usuario_contacto || isNaN(id_usuario_contacto)) {
      return res.status(400).json({
        error:
          "El ID del usuario que contacta es obligatorio y debe ser un número.",
      });
    }

    // Lista de los únicos estados que permitimos
    const estadosPermitidos = [
      "Confirmado",
      "Rechazado/Sin Respuesta",
      "Pendiente",
    ];
    if (!estado_contacto || !estadosPermitidos.includes(estado_contacto)) {
      return res.status(400).json({
        error:
          "El estado del contacto es obligatorio y debe ser uno de los valores permitidos.",
      });
    }

    // --- DTO (Objeto de Transferencia de Datos) ---
    // Creamos un objeto "limpio" para asegurarnos de que solo guardamos lo que necesitamos.
    const datosParaGuardar = {
      id_lista_espera: Number(id_lista_espera),
      id_usuario_contacto: Number(id_usuario_contacto),
      estado_contacto: estado_contacto,
      // Si 'notas' viene vacío o no viene, lo guardamos como 'null' en la base de datos.
      notas: notas || null,
    };

    // Usamos el DTO para crear el nuevo registro
    const nuevoContacto = await ContactosListaEsperaPilatesModel.create(
      datosParaGuardar
    );

    res.status(201).json(nuevoContacto);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al crear el contacto", details: error.message });
  }
}

// Modificar el único contacto asociado a una persona de la lista de espera
export async function UR_modificarEstadoContacto(req, res) {
  try {
    // --- 1. OBTENER DATOS ---

    // Obtenemos el ID directamente desde la URL (ej: /contactos-lista-espera/26)
    const { id_lista_espera } = req.params;

    // Obtenemos los datos que envías en el cuerpo (body) de la petición
    const { estado_contacto, notas, id_usuario_contacto } = req.body;

    // --- 2. VALIDACIONES ---

    // Validamos que el ID de la URL sea un número válido
    if (!id_lista_espera || isNaN(parseInt(id_lista_espera))) {
      return res
        .status(400)
        .json({
          error: "El ID de la lista de espera es inválido o no fue provisto.",
        });
    }

    // Validamos que el estado sea uno de los permitidos
    const estadosPermitidos = ["Confirmado", "Rechazado/Sin Respuesta"];
    if (!estado_contacto || !estadosPermitidos.includes(estado_contacto)) {
      return res
        .status(400)
        .json({ error: "El 'estado_contacto' es inválido o no fue provisto." });
    }

    // Validamos que se envíe el ID del usuario que realiza el contacto
    if (!id_usuario_contacto || isNaN(parseInt(id_usuario_contacto))) {
      return res
        .status(400)
        .json({
          error: "El 'id_usuario_contacto' es inválido o no fue provisto.",
        });
    }

    // --- 3. LÓGICA DE BASE DE DATOS ---

    // Buscamos el registro en la tabla ListaEspera usando su clave primaria
    const registro = await ContactosListaEsperaPilatesModel.findOne({
      where: { id_lista_espera: id_lista_espera },
    });

    // Si no encontramos nada, devolvemos un error 404 (No encontrado)
    if (!registro) {
      return res
        .status(404)
        .json({ error: "No se encontró un registro con el ID proporcionado." });
    }

    // --- 4. ACTUALIZACIÓN ---

    // Preparamos los datos para actualizar el registro.
    // La fecha de contacto se genera automáticamente al momento de la modificación.
    const datosParaActualizar = {
      estado_contacto: estado_contacto,
      notas: notas || null, // Si las notas no vienen, se guardan como nulas
      id_usuario_contacto: id_usuario_contacto,
      fecha_contacto: new Date(), // ¡Importante! Se actualiza a la fecha y hora actual
    };

    // Actualizamos el registro en la base de datos
    await registro.update(datosParaActualizar);

    // --- 5. RESPUESTA EXITOSA ---

    // Devolvemos el registro ya actualizado con un estado 200 (OK)
    res.status(200).json(registro);
  } catch (error) {
    // Si algo falla en el bloque 'try', capturamos el error aquí
    console.error("Error en UR_modificarEstadoContacto:", error); // Para verlo en la consola del servidor
    res
      .status(500)
      .json({
        error: "Ocurrió un error en el servidor.",
        details: error.message,
      });
  }
}
