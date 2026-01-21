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
import QuejasInternasImagenesModel from "./MD_TB_QuejasInternasImagenes.js";
import MD_TB_QuejasInternas from "./MD_TB_QuejasInternas.js";
import HistorialContactosPilatesModel from "./MD_TB_HistorialContactosPilates.js"; 
import ListaEsperaPilates from "./MD_TB_ListaEsperaPilates.js";
import ContactosListaEsperaPilatesModel from "./MD_TB_ContactosListaEsperaPilates.js";
import { VentasComisionesRemarketingModel } from "./MD_TB_Ventas_comisiones_remarketing.js";
import VentasRemarketingModel from "./MD_TB_VentasRemarketing.js";

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

  MD_TB_QuejasInternas.QuejasInternasModel.hasMany(QuejasInternasImagenesModel.QuejasInternasImagenesModel, {
    foreignKey: "id_queja",
    as: "imagenes"
  });

  QuejasInternasImagenesModel.QuejasInternasImagenesModel.belongsTo(MD_TB_QuejasInternas.QuejasInternasModel, {
    foreignKey: "id_queja",
    as: "queja"
  });
  

  // Un contacto pertenece a una persona de la lista de espera
  ContactosListaEsperaPilatesModel.belongsTo(ListaEsperaPilates, {
    foreignKey: "id_lista_espera",
    as: "persona_espera", // IMPORTANTE: Este alias debe coincidir con el usado en el controlador
  });

  // Una persona de la lista de espera tiene muchos contactos
  ListaEsperaPilates.hasMany(ContactosListaEsperaPilatesModel, {
    foreignKey: "id_lista_espera",
    as: "contacto_cliente",
  });

  // Relación con el usuario que hizo el contacto
  ContactosListaEsperaPilatesModel.belongsTo(UsersModel, {
    foreignKey: "id_usuario_contacto",
    as: "usuario_autor",
  });

  // ===============================
  // VentasComisionesRemarketingModel -> Users (vendedor)
  // ===============================
  VentasComisionesRemarketingModel.belongsTo(UsersModel, {
    foreignKey: "vendedor_id",
    as: "vendedor",
    onDelete: "SET NULL",
    onUpdate: "CASCADE"
  });

  // ===============================
  // VentasComisionesRemarketingModel -> VentasRemarketingModel (prospecto)
  // ===============================
  VentasComisionesRemarketingModel.belongsTo(VentasRemarketingModel, {
    foreignKey: "prospecto_id",
    as: "prospecto",
    onDelete: "CASCADE",
    onUpdate: "CASCADE"
  });

  console.log("Relaciones de Sequelize configuradas correctamente.");
};

// 3. Exportamos la función
export default setupAssociations;