/*
/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 17 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_TestClass.js) contiene controladores para manejar operaciones CRUD en dos modelos Sequelize: 
  * Tema: Controladores - TestClass
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla TestClassModel
// ----------------------------------------------------------------

// Importa los modelos necesarios desde el archivo Modelos_Tablas.js
import MD_TB_TestClass from '../Models/MD_TB_TestClass.js';

// Asigna los modelos a variables para su uso en los controladores
const TestClassModel = MD_TB_TestClass.TestClassModel;
import NotificationModel from '../Models/MD_TB_Notifications.js'; // Asegúrate de importar tu modelo de notificación

// Mostrar todos los registros de TestClassModel
export const OBRS_TestClass_CTS = async (req, res) => {
  try {
    const registros = await TestClassModel.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de TestClassModel por su ID
export const OBR_TestClass_CTS = async (req, res) => {
  try {
    const registro = await TestClassModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en TestClassModel y generar notificación
export const CR_TestClass_CTS = async (req, res) => {
  const { name, dni, sede, userName } = req.body;

  try {
    // 1. Crear el registro de la clase de prueba
    const registro = await TestClassModel.create(req.body); // Se utiliza req.body como ya funciona

    // 2. Crear la notificación relacionada usando Sequelize
    const notiTitle = 'Nueva clase de prueba registrada';
    const notiMessage = `Clase de prueba registrada para el alumno ${name} (${dni}), Sede: ${sede}`;
    const module = 'clases_de_prueba'; // El módulo de clases de prueba
    const reference_id = registro.id; // ID de la nueva clase de prueba
    const seen_by = []; // Lista de usuarios que han visto la notificación (vacío por ahora)
    const created_by = userName || 'admin'; // Usuario que creó la clase, por defecto es 'admin'

    // 3. Crear la notificación en la base de datos
    await NotificationModel.create({
      title: notiTitle,
      message: notiMessage,
      module: module,
      reference_id: reference_id,
      seen_by: seen_by,
      created_by: created_by
    });

    // Responder con un mensaje de éxito
    res.json({
      message: 'Clase de prueba registrada y notificación enviada correctamente'
    });
  } catch (error) {
    // Manejo de errores
    console.error(error);
    res.status(500).json({ mensajeError: error.message });
  }
};



// Eliminar un registro en TestClassModel por su ID
export const ER_TestClass_CTS = async (req, res) => {
  try {
    await TestClassModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Actualizar un registro en TestClass por su ID
export const UR_TestClass_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await TestClassModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await TestClassModel.findByPk(id);
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

