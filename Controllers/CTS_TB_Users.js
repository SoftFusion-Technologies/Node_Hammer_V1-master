/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 17 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_Users.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - Users
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla Users
// ----------------------------------------------------------------

// Importa los modelos necesarios desde el archivo
import UsersModel from '../Models/MD_TB_Users.js';


// Mostrar todos los registros de UsersModel o filtrar por sede
export const OBRS_Users_CTS = async (req, res) => {
  try {
    const { sede } = req.query;
    const whereClause = sede ? { sede } : {};
    const registros = await UsersModel.findAll({ where: whereClause });
    res.json(registros);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ mensajeError: 'Error al obtener usuarios' });
  }
};



// Mostrar un registro específico de UsersModel por su ID
export const OBR_Users_CTS = async (req, res) => {
  try {
    const registro = await UsersModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en UsersModel
export const CR_Users_CTS = async (req, res) => {
  try {
    const registro = await UsersModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Eliminar un registro en UsersModel por su ID
export const ER_Users_CTS = async (req, res) => {
  try {
    await UsersModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Actualizar un registro en Users por su ID
export const UR_Users_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await UsersModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await UsersModel.findByPk(id);
      res.json({
        message: 'Registro actualizado correctamente',
        registroActualizado
      });
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};


