// Archivo: /DataBase/asociaciones.js

// 1. Importamos todos los modelos que vamos a relacionar
import ClientesPilatesModel from "./MD_TB_ClientesPilates.js";
import InscripcionesPilatesModel from "./MD_TB_InscripcionesPilates.js";
import AsistenciasPilatesModel from "./MD_TB_AsistenciasPilates.js";
import { HorariosPilatesModel } from "./MD_TB_HorariosPilates.js";
import UsersModel from "./MD_TB_Users.js";
import AuditoriaFechaFinModificadaPilatesModel from "./MD_TB_AuditoriaFechaFinModificadaPilates.js";

// 2. Creamos una función para configurar las asociaciones
const setupAssociations = () => {
  // Relaciones de ClientesPilates
  ClientesPilatesModel.hasMany(InscripcionesPilatesModel, {
    foreignKey: "id_cliente",
    as: "inscripciones",
  });
  // Un cliente tiene UN solo registro de auditoría de fecha.
  ClientesPilatesModel.hasOne(AuditoriaFechaFinModificadaPilatesModel, {
    foreignKey: "cliente_id",
    as: "auditoriaFecha",
  });

  // Relaciones de InscripcionesPilates
  InscripcionesPilatesModel.belongsTo(ClientesPilatesModel, {
    foreignKey: "id_cliente",
    as: "cliente",
  });
  InscripcionesPilatesModel.hasMany(AsistenciasPilatesModel, {
    foreignKey: "id_inscripcion",
    as: "asistencias",
  });
  InscripcionesPilatesModel.belongsTo(HorariosPilatesModel, {
    foreignKey: "id_horario",
    as: "horario",
  });

  // Relaciones de AsistenciasPilates
  AsistenciasPilatesModel.belongsTo(InscripcionesPilatesModel, {
    foreignKey: "id_inscripcion",
    as: "inscripcion",
  });

  // --- Relaciones de AuditoriaFechaFinPilates ---
  // Un registro de auditoría pertenece a un cliente.
  AuditoriaFechaFinModificadaPilatesModel.belongsTo(ClientesPilatesModel, {
    foreignKey: "cliente_id",
    as: "cliente",
  });
  // Un registro de auditoría es creado por un usuario.
  AuditoriaFechaFinModificadaPilatesModel.belongsTo(UsersModel, {
    foreignKey: "usuario_id",
    as: "usuario",
  });
  console.log("Relaciones de Sequelize configuradas correctamente.");
};

// 3. Exportamos la función
export default setupAssociations;
