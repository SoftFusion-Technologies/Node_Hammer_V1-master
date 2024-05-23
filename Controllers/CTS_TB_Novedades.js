/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 16 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_Novedades.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - Novedades
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_Novedades from '../Models/MD_TB_Novedades.js';

// Asigna los modelos a variables para su uso en los controladores
const NovedadesModel = MD_TB_Novedades.NovedadesModel;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'Novedades'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla Novedades

export const OBRS_Novedades_CTS = async (req, res) => {
  try {
    const registros = await NovedadesModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de NovedadesModel por su ID
export const OBR_Novedades_CTS = async (req, res) => {
  try {
    const registro = await NovedadesModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en NovedadesModel
export const CR_Novedades_CTS = async (req, res) => {
  try {
    const registro = await NovedadesModel.create(req.body);
    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Eliminar un registro en NovedadesModel por su ID
export const ER_Novedades_CTS = async (req, res) => {
  try {
    await NovedadesModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Actualizar un registro en NovedadesModel por su ID
export const UR_Novedades_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await NovedadesModel.update(req.body, {
      where: { id },
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await NovedadesModel.findByPk(id);
      res.json({ message: 'Registro actualizado correctamente', registroActualizado });
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
