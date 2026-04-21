// Archivo: /Models/Asociaciones.js

// 1. Importamos todos los modelos que vamos a relacionar
import ClientesPilatesModel from "./MD_TB_ClientesPilates.js";
// ...existing code...
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
const { SedeModel } = Sedes;
import Sedes from "./MD_TB_sedes.js";
import VentasRemarketingModel from "./MD_TB_VentasRemarketing.js";
import PilatesBajasHistorial from "./MD_TB_PilatesBajasHistorial.js";
import PilatesEstadisticasMensuales from "./MD_TB_PilatesEstadisticasMensuales.js";
import PilatesEstadisticasPlanes from "./MD_TB_PilatesEstadisticasPlanes.js";
import PilatesEstadisticasInstructores from "./MD_TB_PilatesEstadisticasInstructores.js";
import PreventaModel from "./MD_TB_Preventas.js";
import UsuarioPilates from "./MD_TB_UsuariosPilates.js";
import { PilatesCuposConDescuentosModel } from "./MD_TB_PilatesCuposConDescuentos.js";
import RRHHCuentasBancariasModel from "./RRHH/MD_TB_RRHH_CuentasBancarias.js";
import RRHHHorariosModel from "./RRHH/MD_TB_RRHHHorarios.js";
import RRHHMarcacionesModel from "./RRHH/MD_TB_RRHHMarcaciones.js";
import RRHHLiquidacionesModel from "./RRHH/MD_TB_RRHHLiquidaciones.js";
import RRHHLiquidacionDetalleModel from "./RRHH//MD_TB_RRHHLiquidacionDetalle.js";
import RRHHCredencialesFacialesModel from "./RRHH/MD_TB_RRHH_CredencialesFaciales.js";
import RRHHConversacionesModel from "./RRHH/MD_TB_RRHHConversaciones.js";
import RRHHConversacionMensajesModel from "./RRHH/MD_TB_RRHHConversacionMensajes.js";
import RRHH_UsuarioSede from "./RRHH/MD_TB_RRHHUsuarioSede.js";
import RRHH_FeriadosProgramados from "./RRHH/MD_RB_RRHH_FeriadosProgramados.js";
import RRHH_VacacionesProgramadas from "./RRHH/MD_RB_RRHH_VacacionesProgramaciones.js";


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

  PreventaModel.belongsTo(SedeModel, {
    foreignKey: "id_sede",
    as: "sede",
  });

  PreventaModel.belongsTo(UsersModel, {
    foreignKey: "id_usuario_contacto",
    as: "usuario_contacto",
  });

  SedeModel.hasMany(PreventaModel, {
    foreignKey: "id_sede",
    as: "preventas",
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


  // ===============================
  // Relaciones de Inteligencia Pilates
  // ===============================
  PilatesBajasHistorial.belongsTo(SedeModel, { foreignKey: 'id_sede', as: 'sede' });

  // Asociación: Baja gestionada por un usuario
  PilatesBajasHistorial.belongsTo(UsersModel, {
    foreignKey: "id_usuario_gestion",
    as: "usuario_gestion"
  });

  // Estadísticas Mensuales y Planes
  PilatesEstadisticasMensuales.belongsTo(SedeModel, { foreignKey: 'id_sede', as: 'sede' });
  PilatesEstadisticasPlanes.belongsTo(SedeModel, { foreignKey: 'id_sede', as: 'sede' });


  // Relación Instructores con Horarios
  UsuarioPilates.hasMany(HorariosPilatesModel, { foreignKey: 'id_instructor', as: 'horarios' });

  // Rendimiento Instructores
  PilatesEstadisticasInstructores.belongsTo(UsuarioPilates, { foreignKey: 'usuario_id', as: 'usuarioInstructor' });
  PilatesEstadisticasInstructores.belongsTo(SedeModel, { foreignKey: 'id_sede', as: 'sede' });

  PilatesCuposConDescuentosModel.belongsTo(SedeModel, {
    foreignKey: 'sede_id',
    as: 'sede'
  });

  // 2. Un Descuento es creado por un Usuario
  PilatesCuposConDescuentosModel.belongsTo(UsersModel, {
    foreignKey: "creado_por",
    as: "usuario_creador",
  });

    // ===============================
  // Relaciones de RRHH_UsuarioSede
  // ===============================
  // Un registro pertenece a un usuario
  RRHH_UsuarioSede.belongsTo(UsersModel, {
    foreignKey: "usuario_id",
    as: "usuario",
  });
  // Un registro pertenece a una sede
  RRHH_UsuarioSede.belongsTo(SedeModel, {
    foreignKey: "sede_id",
    as: "sede",
  });
  // Un usuario puede tener muchas sedes asignadas
  UsersModel.hasMany(RRHH_UsuarioSede, {
    foreignKey: "usuario_id",
    as: "sedes_usuario",
  });
  // Una sede puede tener muchos usuarios asignados
  SedeModel.hasMany(RRHH_UsuarioSede, {
    foreignKey: "sede_id",
    as: "usuarios_sede",
  });

// ===============================
  // Relaciones de Biometría
  // ===============================
  RRHHCredencialesFacialesModel.belongsTo(UsersModel, {
    foreignKey: "id_usuario",
    as: "usuario",
  });

  UsersModel.hasOne(RRHHCredencialesFacialesModel, {
    foreignKey: "id_usuario",
    as: "credencial_facial",
  });

  // ===============================
  // Relaciones de RRHH: Datos Administrativos
  // ===============================

  // Cuentas Bancarias
  UsersModel.hasMany(RRHHCuentasBancariasModel, {
    foreignKey: "usuario_id",
    as: "cuentas_bancarias",
  });

  RRHHCuentasBancariasModel.belongsTo(UsersModel, {
    foreignKey: "usuario_id",
    as: "usuario",
  });

  // Horarios Pactados
  UsersModel.hasMany(RRHHHorariosModel, {
    foreignKey: "usuario_id",
    as: "rrhh_horarios",
  });

  RRHHHorariosModel.belongsTo(UsersModel, {
    foreignKey: "usuario_id",
    as: "usuario",
  });

  SedeModel.hasMany(RRHHHorariosModel, {
    foreignKey: "sede_id",
    as: "rrhh_horarios",
  });

  RRHHHorariosModel.belongsTo(SedeModel, {
    foreignKey: "sede_id",
    as: "sede",
  });

  // ===============================
  // Relaciones de RRHH: Asistencia (Marcaciones)
  // ===============================
  RRHHMarcacionesModel.belongsTo(UsersModel, {
    foreignKey: "usuario_id",
    as: "usuario",
  });

  RRHHMarcacionesModel.belongsTo(UsersModel, {
    foreignKey: "aprobado_por",
    as: "aprobador",
  });

  RRHHMarcacionesModel.belongsTo(SedeModel, {
    foreignKey: "sede_id",
    as: "sede",
  });

    RRHHMarcacionesModel.belongsTo(RRHHHorariosModel, {
  foreignKey: "horario_id",
  as: "horario",
  });

  UsersModel.hasMany(RRHHMarcacionesModel, {
    foreignKey: "usuario_id",
    as: "marcaciones",
  });

  UsersModel.hasMany(RRHHMarcacionesModel, {
    foreignKey: "aprobado_por",
    as: "marcaciones_aprobadas",
  });

  SedeModel.hasMany(RRHHMarcacionesModel, {
    foreignKey: "sede_id",
    as: "marcaciones",
  });

    RRHHHorariosModel.hasMany(RRHHMarcacionesModel, {
    foreignKey: "horario_id",
    as: "marcaciones",
  });

  // ===============================
  // Relaciones de RRHHLiquidaciones
  // ===============================
  RRHHLiquidacionesModel.belongsTo(UsersModel, {
    foreignKey: "usuario_id",
    as: "usuario",
  });

  RRHHLiquidacionesModel.belongsTo(SedeModel, {
    foreignKey: "sede_id",
    as: "sede",
  });

  RRHHLiquidacionesModel.belongsTo(RRHHCuentasBancariasModel, {
    foreignKey: "cuenta_bancaria_id",
    as: "cuenta_bancaria",
  });

  RRHHLiquidacionesModel.belongsTo(UsersModel, {
    foreignKey: "liquidado_por",
    as: "liquidador",
  });

  UsersModel.hasMany(RRHHLiquidacionesModel, {
    foreignKey: "usuario_id",
    as: "liquidaciones_recibidas",
  });

  UsersModel.hasMany(RRHHLiquidacionesModel, {
    foreignKey: "liquidado_por",
    as: "liquidaciones_realizadas",
  });

  SedeModel.hasMany(RRHHLiquidacionesModel, {
    foreignKey: "sede_id",
    as: "rrhh_liquidaciones",
  });

// ===============================
  // Relaciones de RRHHLiquidacionDetalle
  // ===============================
  RRHHLiquidacionesModel.hasMany(RRHHLiquidacionDetalleModel, {
    foreignKey: "liquidacion_id",
    as: "detalles",
  });

  RRHHLiquidacionDetalleModel.belongsTo(RRHHLiquidacionesModel, {
    foreignKey: "liquidacion_id",
    as: "liquidacion",
  });

  RRHHLiquidacionDetalleModel.belongsTo(RRHHMarcacionesModel, {
    foreignKey: "marcacion_id",
    as: "marcacion",
  });

  RRHHMarcacionesModel.hasMany(RRHHLiquidacionDetalleModel, {
    foreignKey: "marcacion_id",
    as: "detalles_liquidacion",
  });

  // ===============================
  //Vinculación directa marcaciones <-> liquidación
  // ===============================
  RRHHMarcacionesModel.belongsTo(RRHHLiquidacionesModel, {
    foreignKey: "liquidacion_id",
    as: "liquidacion",
  });

  RRHHLiquidacionesModel.hasMany(RRHHMarcacionesModel, {
    foreignKey: "liquidacion_id",
    as: "marcaciones_liquidadas",
  });

  // ===============================
  // Relaciones de RRHH Conversaciones
  // ===============================
  RRHHConversacionesModel.belongsTo(UsersModel, {
    foreignKey: "usuario_id",
    as: "usuario",
  });

  RRHHConversacionesModel.belongsTo(SedeModel, {
    foreignKey: "sede_id",
    as: "sede",
  });

  RRHHConversacionesModel.belongsTo(UsersModel, {
  foreignKey: "cerrado_por",
  as: "cerrador",
});

  UsersModel.hasOne(RRHHConversacionesModel, {
    foreignKey: "usuario_id",
    as: "rrhh_conversacion",
  });

  SedeModel.hasMany(RRHHConversacionesModel, {
    foreignKey: "sede_id",
    as: "rrhh_conversaciones",
  });

  // ===============================
  // Relaciones de RRHH Conversacion Mensajes
  // ===============================
  RRHHConversacionMensajesModel.belongsTo(RRHHConversacionesModel, {
    foreignKey: "conversacion_id",
    as: "conversacion",
  });

  RRHHConversacionesModel.hasMany(RRHHConversacionMensajesModel, {
    foreignKey: "conversacion_id",
    as: "mensajes",
  });

  RRHHConversacionMensajesModel.belongsTo(UsersModel, {
    foreignKey: "emisor_user_id",
    as: "emisor",
  });

  RRHHConversacionMensajesModel.belongsTo(UsersModel, {
    foreignKey: "resuelto_por",
    as: "resolutor",
  });

  RRHHConversacionMensajesModel.belongsTo(RRHHMarcacionesModel, {
    foreignKey: "marcacion_id",
    as: "marcacion",
  });

  RRHHMarcacionesModel.hasMany(RRHHConversacionMensajesModel, {
    foreignKey: "marcacion_id",
    as: "mensajes_aclaracion",
  });

  RRHH_FeriadosProgramados.belongsTo(UsersModel, {
  foreignKey: "usuario_id",
  as: "usuario",
});

// ===============================
// Relaciones de RRHH Vacaciones Programadas
// ===============================

// Vacación pertenece al empleado
RRHH_VacacionesProgramadas.belongsTo(UsersModel, {
  foreignKey: "usuario_emp_id",
  as: "empleado",
});

// Vacación pertenece al admin que la creó
RRHH_VacacionesProgramadas.belongsTo(UsersModel, {
  foreignKey: "usuario_adm_id",
  as: "admin",
});

// Vacación pertenece a una sede
RRHH_VacacionesProgramadas.belongsTo(SedeModel, {
  foreignKey: "sede_id",
  as: "sede",
});

// (Opcional pero recomendable) relaciones inversas

UsersModel.hasMany(RRHH_VacacionesProgramadas, {
  foreignKey: "usuario_emp_id",
  as: "vacaciones",
});

UsersModel.hasMany(RRHH_VacacionesProgramadas, {
  foreignKey: "usuario_adm_id",
  as: "vacaciones_creadas",
});

SedeModel.hasMany(RRHH_VacacionesProgramadas, {
  foreignKey: "sede_id",
  as: "vacaciones",
});




  console.log("Relaciones de Inteligencia Pilates configuradas correctamente.");
};

// 3. Exportamos la función
export default setupAssociations;
