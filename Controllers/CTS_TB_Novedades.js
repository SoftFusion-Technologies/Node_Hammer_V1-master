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
import NovedadesModel from '../Models/MD_TB_Novedades.js';
import NovedadUserModel from '../Models/MD_TB_NovedadUser.js';
import UsersModel from '../Models/MD_TB_Users.js';

import NotificationModel from '../Models/MD_TB_Notifications.js'; // Asegúrate de importar tu modelo de notificación
import NotificationUserModel from '../Models/MD_TB_NotificationsUsers.js'; // Asegúrate de importar tu modelo de notificación

//Asigna los modelos a variables para su uso en los controladores
//const NovedadesModel = MD_TB_Novedades.NovedadesModel;
//const NovedadUserModel = MD_TB_NovedadUser.NovedadUserModel;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'Novedades'
// ----------------------------------------------------------------
// Mostrar todos los registros de la tabla Novedades

export const OBRS_Novedades_CTS = async (req, res) => {
  try {
    const registros = await NovedadesModel.findAll({
      include: {
        model: NovedadUserModel,
        as: 'novedadUsers',
        include: {
          model: UsersModel,
          as: 'user',
          attributes: ['id', 'name']
        }
      }
    });
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

// Crear un nuevo registro en NovedadesModel y disparar la notificación
export const CR_Novedades_CTS = async (req, res) => {
  const { sede, titulo, mensaje, vencimiento, estado, user, userName } = req.body;

  try {
    // 1. Crear el registro de la novedad
    const nuevaNovedad = await NovedadesModel.create({
      sede,
      titulo,
      mensaje,
      vencimiento,
      estado,
      userName
    });

    // 2. Crear la notificación relacionada usando Sequelize
    const notiTitle = 'Nueva novedad registrada';
    const notiMessage = `Novedad: ${titulo}. Mensaje: ${mensaje}.`;
    const module = 'novedades';
    const reference_id = nuevaNovedad.id;
    const seen_by = []; // Aquí puedes agregar los usuarios que ya han visto la notificación, si es necesario
    const created_by = userName; // Aquí pasamos el usuario que creó la novedad (userName)

    // Crear la notificación en la base de datos
    const nuevaNotificacion = await NotificationModel.create({
      title: notiTitle,
      message: notiMessage,
      module: module,
      reference_id: reference_id,
      seen_by: seen_by,
      created_by: created_by // Usuario que creó la novedad
    });

    // 3. Si se proporcionan usuarios, asociarlos con la novedad y la notificación
    if (user && user.length > 0) {
      const userPromises = user.map((userId) =>
        NovedadUserModel.create({
          novedad_id: nuevaNovedad.id,
          user_id: userId
        }).then(() => {
          // Al mismo tiempo que asociamos el usuario a la novedad, creamos la relación con la notificación
          return NotificationUserModel.create({
            notification_id: nuevaNotificacion.id,
            user_id: userId
          });
        })
      );
      await Promise.all(userPromises);
    }

    // Responder con un mensaje de éxito
    res.json({
      message: 'Novedad registrada y notificación enviada correctamente'
    });
  } catch (error) {
    // Manejo de errores
    console.error(error);
    res.status(500).json({ mensajeError: error.message });
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
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await NovedadesModel.findByPk(id);
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
