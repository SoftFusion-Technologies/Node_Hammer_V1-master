// Archivo: /Models/Asociaciones.js

// 1. Importamos todos los modelos que vamos a relacionar
import ClientesPilatesModel from "./MD_TB_ClientesPilates.js";
import InscripcionesPilatesModel from "./MD_TB_InscripcionesPilates.js";
import AsistenciasPilatesModel from "./MD_TB_AsistenciasPilates.js";
import { HorariosPilatesModel } from "./MD_TB_HorariosPilates.js";
import UsersModel from "./MD_TB_Users.js";
import AuditoriaFechaFinModificadaPilatesModel from "./MD_TB_AuditoriaFechaFinModificadaPilates.js";
import ClientesPilatesHistorialModel from "./MD_TB_ClientesPilatesHistorial.js";
import ClientesPilatesHistorialDetalleModel from "./MD_TB_ClientesPilatesHistorialDetalle.js";
import HistorialContactosPilatesModel from "./MD_TB_HistorialContactosPilates.js"; 

// 2. Creamos una función para configurar las asociaciones
const setupAssociations = () => {
  // ===============================
  // Relaciones de ClientesPilates
  // ===============================
  ClientesPilatesModel.hasMany(InscripcionesPilatesModel, {
    foreignKey: "id_cliente",
    as: "inscripciones",
  });

  // Un cliente tiene UN solo registro de auditoría de fecha.
  ClientesPilatesModel.hasOne(AuditoriaFechaFinModificadaPilatesModel, {
    foreignKey: "cliente_id",
    as: "auditoriaFecha",
  });

  // ===============================
  // Relaciones de InscripcionesPilates
  // ===============================
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

  // ===============================
  // Relaciones de AsistenciasPilates
  // ===============================
  AsistenciasPilatesModel.belongsTo(InscripcionesPilatesModel, {
    foreignKey: "id_inscripcion",
    as: "inscripcion",
  });

  // ===============================
  // Relaciones de AuditoriaFechaFinPilates
  // ===============================
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

  // =====================================================
  // Relaciones de Historial de Clientes Pilates
  // =====================================================

  // Un cliente tiene MUCHOS registros de historial
  ClientesPilatesModel.hasMany(ClientesPilatesHistorialModel, {
    foreignKey: "cliente_id",
    as: "historial",
    onDelete: "CASCADE",
  });

  // Un historial tiene MUCHOS detalles
  ClientesPilatesHistorialModel.hasMany(
    ClientesPilatesHistorialDetalleModel,
    {
      foreignKey: "historial_id",
      as: "detalles",
      onDelete: "CASCADE",
    }
  );

  // Un detalle pertenece a un historial
  ClientesPilatesHistorialDetalleModel.belongsTo(
    ClientesPilatesHistorialModel,
    {
      foreignKey: "historial_id",
    }
  );

  // Un historial pertenece a un cliente
  ClientesPilatesHistorialModel.belongsTo(ClientesPilatesModel, {
    foreignKey: "cliente_id",
    as: "cliente",
  });

  // Un historial pertenece a un usuario (gestión)
  ClientesPilatesHistorialModel.belongsTo(UsersModel, {
    foreignKey: "usuario_id",
    as: "informacion_usuario",
  });

  // =================================================================
  //  NUEVAS RELACIONES: HISTORIAL DE CONTACTOS (Ausentes/Seguimiento)
  // =================================================================

  // 1. Un Cliente tiene MUCHOS registros en el historial de contactos
  ClientesPilatesModel.hasMany(HistorialContactosPilatesModel, {
    foreignKey: 'id_cliente',
    as: 'historial_contactos' 
  });

  // 2. Un registro de historial pertenece a UN Cliente
  HistorialContactosPilatesModel.belongsTo(ClientesPilatesModel, {
    foreignKey: 'id_cliente',
    as: 'cliente' 
  });

  // 3. Un registro de historial es creado por UN Usuario
  HistorialContactosPilatesModel.belongsTo(UsersModel, {
    foreignKey: 'id_usuario',
    as: 'usuario' 
  });

  // 4. (Opcional) Un Usuario puede tener muchos contactos realizados
  UsersModel.hasMany(HistorialContactosPilatesModel, {
    foreignKey: 'id_usuario',
    as: 'contactos_realizados_pilates'
  });

  console.log("Relaciones de Sequelize configuradas correctamente.");
};

// 3. Exportamos la función
export default setupAssociations;