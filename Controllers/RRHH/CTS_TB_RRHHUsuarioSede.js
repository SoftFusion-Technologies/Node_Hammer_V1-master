/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 08 / 04 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * * Este archivo contiene los controladores para gestionar la vinculación de empleados con sedes.
 * * Maneja la sincronización masiva de sedes, el estado de modalidad remota y la activación/desactivación
 * * automática del usuario en el sistema según su asignación operativa.
 * Tema: Controladores - RRHH Usuario Sede
 * * Capa: Backend 
 *
 * Nomenclatura: 
 * * OBRS_ obtenerRegistros (plural / filtrado por usuario)
 * * CR_ crearRegistro (Incluye lógica de sincronización y actualización de estado de usuario)
 * * UR_ actualizarRegistro (Registro individual)
 */
import RRHH_UsuarioSede from "../../Models/RRHH/MD_TB_RRHHUsuarioSede.js";
import UsersModel from "../../Models/MD_TB_Users.js";
import { SedeModel } from "../../Models/MD_TB_sedes.js";

// Obtener todos los registros
export const OBRS_RRHHUsuarioSede_CTS = async (req, res) => {
  try {
    const data = await RRHH_UsuarioSede.findAll({
      where: { eliminado: 0 },
      include: [
        {
          model: UsersModel,
          as: "usuario",
          attributes: ["name", "email", "level_admin"],
        },
        {
          model: SedeModel,
          as: "sede",
          attributes: ["nombre"],
        },
      ],
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener las sedes de un usuario específico
export const OBRS_RRHHUsuarioSedePorUsuario_CTS = async (req, res) => {
  try {
    const { usuario_id } = req.params;
    if (!usuario_id) return res.status(400).json({ error: "Falta usuario_id" });
    const data = await RRHH_UsuarioSede.findAll({
      where: { eliminado: 0, usuario_id },
      include: [
        {
          model: UsersModel,
          as: "usuario",
          attributes: ["name"],
        },
        {
          model: SedeModel,
          as: "sede",
          attributes: ["nombre"],
        },
      ],
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear/Sincronizar vinculaciones múltiples y actualizar estado del usuario
export const CR_RRHHUsuarioSede_CTS = async (req, res) => {
  try {
    const { usuario_id, sedes_ids = [], remoto = 0 } = req.body;

    if (!usuario_id) return res.status(400).json({ error: "Falta usuario_id" });

    // 1. Eliminación lógica de vinculaciones anteriores
    await RRHH_UsuarioSede.update(
      { eliminado: 1, activo: 0 },
      { where: { usuario_id: usuario_id } },
    );

    // 2. Si hay sedes nuevas, las insertamos
    if (sedes_ids && sedes_ids.length > 0) {
      const nuevasVinculaciones = sedes_ids.map((id_sede) => ({
        usuario_id: usuario_id,
        sede_id: id_sede,
        activo: 1,
        eliminado: 0,
        remoto: remoto || 0,
        fecha_desde: new Date(),
      }));

      await RRHH_UsuarioSede.bulkCreate(nuevasVinculaciones);

      // 3. CAMBIO AQUÍ: Si tiene sedes, activamos al usuario en la tabla users
      await UsersModel.update(
        { activada: true },
        { where: { id: usuario_id } },
      );
    } else {
      // 4. CAMBIO AQUÍ: Si no seleccionó ninguna sede, desactivamos al usuario
      await UsersModel.update(
        { activada: false },
        { where: { id: usuario_id } },
      );
    }

    res
      .status(201)
      .json({ mensaje: "Vinculación y estado de usuario actualizados" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar un registro individual (si lo necesitas)
export const UR_RRHHUsuarioSede_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [updated] = await RRHH_UsuarioSede.update(req.body, {
      where: { id },
    });
    if (updated) {
      const actualizado = await RRHH_UsuarioSede.findByPk(id);
      res.json(actualizado);
    } else {
      res.status(404).json({ error: "Registro no encontrado" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
