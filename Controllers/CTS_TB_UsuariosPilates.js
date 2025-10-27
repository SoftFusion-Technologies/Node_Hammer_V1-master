import UsuarioPilates from "../Models/MD_TB_UsuariosPilates.js";
import { SedeModel } from "../Models/MD_TB_sedes.js"; // Importa el modelo de sede
import { HorariosPilatesModel } from "../Models/MD_TB_HorariosPilates.js";

import { Sequelize, Op } from "sequelize";

// Obtener todos (todo como está en BD)
export const OBRS_UsuariosPilates_CTS = async (req, res) => {
  try {
    const data = await UsuarioPilates.findAll();
    // Formatear los datos antes de enviarlos
    const dataFormateada = data.map(u => ({
      ...u.toJSON(),
      nombre: u.nombre ? u.nombre.trim().toUpperCase() : "",
      apellido: u.apellido ? u.apellido.trim().toUpperCase() : "",
      telefono: u.telefono ? u.telefono.trim().toUpperCase() : "",
      email: u.email ? u.email.trim().toUpperCase() : "",
      password: u.password ? u.password.trim() : ""
      // estado y rol se mantienen como están
    }));
    res.json(dataFormateada);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
};

// Obtener todos con nombre completo
export const OBRS_UsuariosPilatesNombreCompleto_CTS = async (req, res) => {
  try {
    const data = await UsuarioPilates.findAll({
      where: { id: { [Op.gte]: 2 } },
      attributes: [
        "id",
        [
          Sequelize.fn(
            "UPPER",
            Sequelize.fn(
              "CONCAT",
                Sequelize.fn("TRIM", Sequelize.col("nombre")),
                " ",
                Sequelize.fn("TRIM", Sequelize.col("apellido"))
            )
          ),
          "nombre_completo",
        ],
      ],
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener nombres completos" });
  }
};

// Obtener uno
export const OBR_UsuarioPilates_CTS = async (req, res) => {
  try {
    const usuario = await UsuarioPilates.findByPk(req.params.id);
    if (!usuario)
      return res.status(404).json({ error: "Usuario no encontrado" });
    // Formatear los datos antes de enviarlos
    const usuarioFormateado = {
      ...usuario.toJSON(),
      nombre: usuario.nombre ? usuario.nombre.trim().toUpperCase() : "",
      apellido: usuario.apellido ? usuario.apellido.trim().toUpperCase() : "",
      telefono: usuario.telefono ? usuario.telefono.trim().toUpperCase() : "",
      email: usuario.email ? usuario.email.trim().toUpperCase() : "",
      password: usuario.password ? usuario.password.trim(): ""
      // estado y rol se mantienen como están
    };
    res.json(usuarioFormateado);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener usuario" });
  }
};


// Obtener usuarios por sede (opcional) - si no se envía sede_id trae todos
export const OBRS_UsuariosPilatesPorSede_CTS = async (req, res) => {
  try {
    const { sede_id } = req.query;
    const whereConditions = { id: { [Op.gte]: 2 } };
    if (sede_id) {
      whereConditions.sede_id = sede_id;
    }

    const data = await UsuarioPilates.findAll({
      where: whereConditions,
      order: [['nombre', 'ASC'], ['apellido', 'ASC']],
      include: [{
        model: SedeModel,
        as: "sede",
        attributes: ["nombre"]
      }]
    });

    // Formatear los datos antes de enviarlos
    const dataFormateada = data.map(u => ({
      ...u.toJSON(),
      nombre: u.nombre ? u.nombre.trim().toUpperCase() : "",
      apellido: u.apellido ? u.apellido.trim().toUpperCase() : "",
      telefono: u.telefono ? u.telefono.trim().toUpperCase() : "",
      email: u.email ? u.email.trim().toUpperCase() : "",
      password: u.password ? u.password.trim() : "",
      sede_nombre: u.sede ? u.sede.nombre.toUpperCase() : null // Agrega el nombre de la sede
      // estado y rol se mantienen como están
    }));

    res.json(dataFormateada);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener usuarios por sede" });
  }
};


// Crear
export const CR_UsuarioPilates_CTS = async (req, res) => {
  try {
    let { nombre, apellido, telefono, email, password, estado, rol, sede_id } = req.body;

    // Validaciones de campos obligatorios
    if (!nombre || !apellido || !email || !password || !rol || !sede_id) {
      return res.status(400).json({
        error: "Faltan datos obligatorios: nombre, apellido, email, password, rol y sede_id son requeridos"
      });
    }

    // Validación de rol válido
    const rolesValidos = ["Administrador", "Vendedor", "Instructor", "Recepcionista"];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({
        error: "Rol no válido. Debe ser: Administrador, Vendedor, Instructor o Recepcionista"
      });
    }

    // Validación de estado válido
    const estadosValidos = ["activo", "inactivo"];
    if (estado && !estadosValidos.includes(estado)) {
      return res.status(400).json({
        error: "Estado no válido. Debe ser: activo o inactivo"
      });
    }

    // Verificar que no exista ya un usuario con el mismo email
    const usuarioExistente = await UsuarioPilates.findOne({ where: { email } });
    if (usuarioExistente) {
      return res.status(409).json({
        error: "Ya existe un usuario con ese email"
      });
    }

    // Formatear los datos antes de guardar
    nombre = nombre.trim().toUpperCase();
    apellido = apellido.trim().toUpperCase();
    telefono = telefono.trim().toUpperCase();
    email = email.trim().toUpperCase();
    password = password.trim();

    // Crear el usuario
    const usuario = await UsuarioPilates.create({
      nombre,
      apellido,
      telefono,
      email,
      password,
      estado,
      rol,
      sede_id
    });
    res.json({
      message: "Usuario creado correctamente",
      usuario
    });
  } catch (error) {
    res.status(500).json({ error: "Error al crear usuario: " + error.message });
  }
};

// Actualizar
export const UR_UsuarioPilates_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    let { nombre, apellido, telefono, email, password, estado, rol, sede_id } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "ID de usuario no válido" });
    }

    const usuarioExistente = await UsuarioPilates.findByPk(id);
    if (!usuarioExistente) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (rol) {
      const rolesValidos = ["Administrador", "Vendedor", "Instructor", "Recepcionista"];
      if (!rolesValidos.includes(rol)) {
        return res.status(400).json({
          error: "Rol no válido. Debe ser: Administrador, Vendedor, Instructor o Recepcionista"
        });
      }
    }

    if (estado) {
      const estadosValidos = ["activo", "inactivo"];
      if (!estadosValidos.includes(estado)) {
        return res.status(400).json({
          error: "Estado no válido. Debe ser: activo o inactivo"
        });
      }
    }

    // Verificar que no exista otro usuario con el mismo email (si se está cambiando)
    if (email && email !== usuarioExistente.email) {
      const emailExistente = await UsuarioPilates.findOne({
        where: {
          email,
          id: { [Op.ne]: id }
        }
      });
      if (emailExistente) {
        return res.status(409).json({
          error: "Ya existe otro usuario con ese email"
        });
      }
    }

    // Formatear los datos antes de actualizar
    const datosActualizados = {
      nombre: nombre !== undefined ? nombre.trim().toUpperCase() : usuarioExistente.nombre,
      apellido: apellido !== undefined ? apellido.trim().toUpperCase() : usuarioExistente.apellido,
      telefono: telefono !== undefined ? telefono.trim().toUpperCase() : usuarioExistente.telefono,
      email: email !== undefined ? email.trim().toUpperCase() : usuarioExistente.email,
      password: password !== undefined ? password.trim() : usuarioExistente.password,
      estado,
      rol,
      sede_id
    };

    await UsuarioPilates.update(datosActualizados, { where: { id } });

    const usuarioActualizado = await UsuarioPilates.findByPk(id);
    res.json({
      message: "Usuario actualizado correctamente",
      usuario: usuarioActualizado
    });
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar usuario: " + error.message });
  }
};


// Eliminar
export const ER_UsuarioPilates_CTS = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "ID de usuario no válido" });
    }

    const usuarioExistente = await UsuarioPilates.findByPk(id);
    if (!usuarioExistente) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // 1. Actualizar horarios donde el usuario era instructor
    await HorariosPilatesModel.update(
      { id_instructor: 1 },
      { where: { id_instructor: id } }
    );

    // 2. Eliminar el usuario
    const deleted = await UsuarioPilates.destroy({ where: { id } });

    if (deleted) {
      res.json({
        message: "Usuario eliminado correctamente",
        usuarioEliminado: {
          id: usuarioExistente.id,
          nombre: usuarioExistente.nombre,
          apellido: usuarioExistente.apellido,
          email: usuarioExistente.email
        }
      });
    } else {
      res.status(500).json({ error: "No se pudo eliminar el usuario" });
    }
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar usuario: " + error.message });
  }
};
