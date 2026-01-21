/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 15 /03 / 2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (routes.js) define las rutas HTTP para operaciones CRUD en la tabla
  * Tema: Rutas
  
  * Capa: Backend 
*/

import express from 'express'; // Importa la librería Express

import {
  OBR_Trabajo_CTS,
  OBRS_Trabajo_CTS,
  CR_Trabajo_CTS,
  ER_Trabajo_CTS
  // Importa los controladores necesarios para la tabla trabajo_CTS - tb_1
} from '../Controllers/CTS_TB_FailedJobs.js';

import {
  // Importa los controladores necesarios para la tabla frec_asks tb_2
  OBR_FrecAsk_CTS,
  OBRS_FrecAsk_CTS,
  CR_FrecAsk_CTS,
  ER_FrecAsk_CTS,
  UR_FrecAsk_CTS
} from '../Controllers/CTS_TB_FrecAsk.js';

import {
  OBR_Migration_CTS,
  OBRS_Migration_CTS,
  CR_Migration_CTS,
  ER_Migration_CTS
  // Importa los controladores necesarios para la tabla migrations tb_3
} from '../Controllers/CTS_TB_Migrations.js';

import {
  OBR_Novedades_CTS,
  OBRS_Novedades_CTS,
  CR_Novedades_CTS,
  ER_Novedades_CTS,
  UR_Novedades_CTS
  // Importa los controladores necesarios para la tabla Novedades - tb_5
} from '../Controllers/CTS_TB_Novedades.js';

import {
  OBR_NovedadUser_CTS,
  OBRS_NovedadUser_CTS,
  CR_NovedadUser_CTS,
  ER_NovedadUser_CTS,
  UPDATE_NovedadUser_CTS
  // Importa los controladores necesarios para la tabla NovedadUser - tb_6
} from '../Controllers/CTS_TB_NovedadUser.js';

import {
  OBR_NovedadUserDestino_CTS,
  OBRS_NovedadUserDestino_CTS,
  CR_NovedadUserDestino_CTS,
  ER_NovedadUserDestino_CTS
  // Importa los controladores necesarios para la tabla NovedadUserDestino - tb_7
} from '../Controllers/CTS_TB_NovedadUserDestino.js';

import {
  OBR_PassReset_CTS,
  OBRS_PassReset_CTS,
  CR_PassReset_CTS,
  ER_PassReset_CTS
  // Importa los controladores necesarios para la tabla password_reset - tb_8
} from '../Controllers/CTS_TB_PassReset.js';

import {
  OBR_PersonalAccessTokens_CTS,
  OBRS_PersonalAccessTokens_CTS,
  CR_PersonalAccessTokens_CTS,
  ER_PersonalAccessTokens_CTS
  // Importa los controladores necesarios para la tabla password_reset - tb_9
} from '../Controllers/CTS_TB_PersonalAccessTokens.js';

import {
  OBR_Postulante_CTS,
  OBRS_Postulante_CTS,
  CR_Postulante_CTS,
  ER_Postulante_CTS,
  UR_Postulante_CTS
  // Importa los controladores necesarios para la tabla password_reset - tb_10
} from '../Controllers/CTS_TB_Postulante.js';

import {
  OBR_SchedulerTaskUser_CTS,
  OBRS_SchedulerTaskUser_CTS,
  CR_SchedulerTaskUser_CTS,
  ER_SchedulerTaskUser_CTS
  // Importa los controladores necesarios para la tabla password_reset - tb_11
} from '../Controllers/CTS_TB_SchedulerTaskUser.js';

import {
  OBR_SchedulerTask_CTS,
  OBRS_SchedulerTask_CTS,
  CR_SchedulerTask_CTS,
  ER_SchedulerTask_CTS,
  UR_SchedulerTask_CTS

  // Importa los controladores necesarios para la tabla password_reset - tb_12
} from '../Controllers/CTS_TB_SchedulerTask.js';

import {
  OBR_TestClass_CTS,
  OBRS_TestClass_CTS,
  CR_TestClass_CTS,
  ER_TestClass_CTS,
  UR_TestClass_CTS,
  MOVER_A_VENTAS_CTS
  // Importa los controladores necesarios para la tabla password_reset - tb_13
} from '../Controllers/CTS_TB_TestClass.js';

import {
  OBR_TextContents_CTS,
  OBRS_TextContents_CTS,
  CR_TextContents_CTS,
  ER_TextContents_CTS
  // Importa los controladores necesarios para la tabla password_reset - tb_14
} from '../Controllers/CTS_TB_TextContents.js';

import {
  OBR_Users_CTS,
  OBRS_Users_CTS,
  OBRS_Instructores_CTS,
  CR_Users_CTS,
  ER_Users_CTS,
  UR_Users_CTS
  // Importa los controladores necesarios para la tabla password_reset - tb_15
} from '../Controllers/CTS_TB_Users.js';

// PARTE NUEVA CONVENIOS

import {
  OBR_AdmConve_CTS,
  OBRS_AdmConve_CTS,
  CR_AdmConve_CTS,
  ER_AdmConve_CTS,
  UR_AdmConve_CTS
  // Importa los controladores necesarios para la tabla password_reset - tb_15
} from '../Controllers/CTS_TB_AdmConve.js';

import {
  OBR_AdmConveniosImages_CTS,
  OBRS_AdmConveniosImages_CTS,
  CR_AdmConveniosImages_CTS,
  ER_AdmConveniosImages_CTS,
  UR_AdmConveniosImages_CTS
  // Importa los controladores necesarios para la tabla password_reset - tb_15
} from '../Controllers/CTS_TB_AdmImages.js';

import {
  OBR_AdmConveniosFac_CTS,
  OBRS_AdmConveniosFac_CTS,
  CR_AdmConveniosFac_CTS,
  ER_AdmConveniosFac_CTS,
  UR_AdmConveniosFac_CTS
  // Importa los controladores necesarios para la tabla password_reset - tb_15
} from '../Controllers/CTS_TB_AdmFac.js';

import {
  OBR_IntegrantesConve_CTS,
  OBRS_IntegrantesConve_CTS,
  OBRS_IntegrantesConve_PDF_CTS,
  CR_IntegrantesConve_CTS,
  ER_IntegrantesConve_CTS,
  UR_IntegrantesConve_CTS,
  Autorizar_Integrante_CTS,
  Autorizar_Integrantes_Por_Convenio
  // Importa los controladores necesarios para la tabla password_reset - tb_15
} from '../Controllers/CTS_TB_IntegrantesConve.js';

import {
  OBRS_ConveniosMesAcciones_CTS,
  OBR_ConveniosMesAcciones_CTS,
  CR_ConveniosMesAcciones_CTS,
  CR_ConveniosMesAcciones_Finalizar_CTS,
  CR_ConveniosMesAcciones_Enviar_CTS,
  MARCAR_LEIDO_ConveniosMesAcciones_CTS,
  COUNT_PENDIENTES_ConveniosMesAcciones_CTS
} from '../Controllers/CTS_TB_ConveniosMesAcciones.js';

import {
  OBR_FamIntegrante_CTS,
  OBRS_FamIntegrante_CTS,
  CR_FamIntegrante_CTS,
  ER_FamIntegrante_CTS,
  UR_FamIntegrante_CTS
  // Importa los controladores necesarios para la tabla password_reset - tb_15
} from '../Controllers/CTS_TB_FamIntegrante.js';

import importIntegrantes from '../Controllers/importIntegrantes.js';
import RT_Import_Recaptacion from '../Controllers/RT_Import_Recaptacion.js';
// NUEVA PARTE DE ADMINISTRACION DE PRECIOS PARA CONVENIOS

// R5-SUBIR ARCHIVOS A NOVEDADES - 16-09-2024 - Benjamin Orellana - INICIO
import {
  OBR_NovedadArchivos_CTS,
  OBRS_NovedadArchivos_CTS,
  CR_NovedadArchivos_CTS,
  ER_NovedadArchivos_CTS,
  UR_NovedadArchivos_CTS
  // Importa los controladores necesarios para la tabla password_reset - tb_15
} from '../Controllers/CTS_TB_NovedadesArchivos.js';

// R5-SUBIR ARCHIVOS A NOVEDADES - 16-09-2024 - Benjamin Orellana - FINAL

// R6- Agregar mas fechas a novedades  18-09-2024 - Benjamin Orellana - INICIO

// R6- Agregar mas fechas a novedades  18-09-2024 - Benjamin Orellana - FINAL

// R9- Planilla Instructores  22-10-2024 - Benjamin Orellana - INICIO
import {
  OBRS_Alumnos_CTS,
  OBR_Alumnos_CTS,
  CR_Alumnos_CTS,
  ER_Alumnos_CTS,
  UR_Alumnos_CTS
} from '../Controllers/CTS_TB_Alumnos.js';

import {
  OBRS_Asistencias_CTS,
  OBR_Asistencias_CTS,
  CR_Asistencias_CTS,
  ER_Asistencias_CTS,
  UR_Asistencias_CTS,
  GET_Asistencia
} from '../Controllers/CTS_TB_Asistencias.js';

import {
  OBRS_Agendas_CTS,
  OBR_Agendas_CTS,
  CR_Agendas_CTS,
  ER_Agendas_CTS,
  UR_Agendas_CTS,
  GET_Agenda_CTS,
  CR_ActualizarAgendaEstado_CTS
} from '../Controllers/CTS_TB_Agendas.js';
// R9- Planilla Instructores  22-10-2024 - Benjamin Orellana - FINAL

import {
  OBRS_AgendaImagenes_CTS,
  ER_AgendaImagenes_CTS
} from '../Controllers/CTS_TB_AgendaImages.js';

import {
  OBRS_AgendaMotivos_CTS,
  OBR_AgendaMotivos_CTS,
  CR_AgendaMotivos_CTS,
  ER_AgendaMotivos_CTS,
  UR_AgendaMotivos_CTS
} from '../Controllers/CTS_TB_AgendaMotivos.js';

import {
  OBRS_ImagenesPreguntasFrec_CTS,
  ER_ImagenesPreguntasFrec_CTS,
  OBR_ImagenPorPregunta_CTS
} from '../Controllers/CTS_TB_ImagenesPreguntasFrec.js';

/* Nuevo modulo para gestionar las sedes del select
 * Programador: Benjamin Orellana
 * Fecha Creación: 17 de Abril 2025
 */

import {
  OBRS_Sede_CTS,
  OBR_Sede_CTS,
  CR_Sede_CTS,
  ER_Sede_CTS,
  UR_Sede_CTS,
  OBRS_SedesCiudad_CTS,
  ObtenerCantidadAlumnosPorSede_CTS
} from '../Controllers/CTS_TB_Sedes.js';
/* Nuevo módulo para gestionar las quejas internas
 * Programador: Benjamin Orellana
 * Fecha Creación: 30 de Abril 2025
 */

/* AGREGADO por Sergio Manrique - 21/01/2026 */
import { uploadQuejas } from '../utils/uploadConfig.js';
/* FIN por Sergio Manrique - 21/01/2026 */
import {
  OBRS_Quejas_CTS,
  OBR_Queja_CTS,
  CR_Queja_CTS,
  ER_Queja_CTS,
  UR_Queja_CTS,
  MARCAR_Resuelto_Queja_CTS,
  MARCAR_NoResuelto_Queja_CTS
} from '../Controllers/CTS_TB_QuejasInternas.js'
import {
  CR_QuejaPilates_CTS,
  UR_QuejaPilates_CTS,
  ER_QuejaPilates_CTS,
  MARCAR_Resuelto_QuejaPilates,
  MARCAR_NoResuelto_QuejaPilates
} from '../Controllers/CTS_TB_QuejasPilates.js';

import {
  OBRS_UserDailyTasks_CTS,
  CR_UserDailyTask_CTS,
  ER_UserDailyTask_CTS,
  OBRS_TasksByUser_CTS,
  CR_BulkUserDailyTasks_CTS
} from '../Controllers/CTS_TB_UserDailyTasks.js';

import {
  OBRS_TareasDiarias_CTS,
  CR_TareaDiaria_CTS,
  ER_TareaDiaria_CTS,
  OBR_TareaDiaria_CTS,
  UR_TareaDiaria_CTS
} from '../Controllers/CTS_TB_DailyTasks.js';

import {
  OBR_Recaptacion_CTS,
  OBRS_Recaptacion_CTS,
  CNT_RecaptacionPendientes_CTS,
  CR_Recaptacion_CTS,
  ER_Recaptacion_CTS,
  UR_Recaptacion_CTS,
  OBRS_ColaboradoresConRecaptacion,
  ER_RecaptacionMasiva_CTS,
  ER_RecaptacionMasivaPorUsuario_CTS
} from '../Controllers/CTS_TB_Recaptacion.js';

import {
  OBR_VentasProspecto_CTS,
  OBRS_VentasProspectos_CTS,
  OBRS_VentasProspectosUltimaSemanaMesAnterior_CTS,
  CR_VentasProspecto_CTS,
  ER_VentasProspecto_CTS,
  UR_VentasProspecto_CTS,
  OBRS_ColaboradoresConVentasProspectos,
  CR_VentasProspectoConHorario_CTS
} from '../Controllers/CTS_TB_VentasProspectos.js';

import {
  GET_AgendaHoy,
  GET_AgendaHoyCount,
  PATCH_AgendaDone,
  POST_GenerarAgendaHoy // opcional (para pruebas/manual)
} from '../Controllers/CTS_TB_VentasAgenda.js';

import {
  GET_AgendaHoyRemarketing,
  GET_AgendaHoyCountRemarketing,
  PATCH_AgendaDoneRemarketing,
  POST_GenerarAgendaHoyRemarketing // opcional (para pruebas/manual)
} from "../Controllers/CTS_TB_VentasAgendaRemarketing.js"

import {
  OBRS_ClientesPilates_CTS,
  OBR_ClientesPilates_CTS,
  CR_ClientesPilates_CTS,
  UR_ClientesPilates_CTS,
  UR_ClientesPilates_Observaciones_CTS,
  BUSCAR_ClientesPilates_CTS,
  OBRS_ClientesPorEstado_CTS,
  OBRS_ClientesProximosVencer_CTS,
  ESP_OBRS_HorarioClientesPilates_CTS,
  ER_ClienteConInscripciones_CTS,
  ESP_OBRS_HorariosDisponibles_CTS,
  EXISTE_ClientePruebaPorNombre_CTS,
  UR_ClientesPilates_PlanRenovacion_CTS
} from '../Controllers/CTS_TB_ClientesPilates.js';

import {
  OBRS_InscripcionesPilates_CTS,
  OBR_InscripcionesPilates_CTS,
  CR_InscripcionesPilates_CTS,
  UR_InscripcionesPilates_CTS,
  UR_CambiarTurnoInscripcion_CTS
} from '../Controllers/CTS_TB_InscripcionesPilates.js';

import {
  OBRS_ListaEsperaPilates,
  OBR_ListaEsperaPilates,
  CR_ListaEsperaPilates,
  UR_ListaEsperaPilates,
  ER_ListaEsperaPilates
} from '../Controllers/CTS_TB_ListaEsperaPilates.js';

import {
  OBRS_UsuariosPilates_CTS,
  OBRS_UsuariosPilatesNombreCompleto_CTS,
  OBRS_UsuariosPilatesPorSede_CTS,
  OBR_UsuarioPilates_CTS,
  CR_UsuarioPilates_CTS,
  UR_UsuarioPilates_CTS,
  ER_UsuarioPilates_CTS
} from '../Controllers/CTS_TB_UsuariosPilates.js';

import {
  OBRS_HorariosPilates_CTS,
  UR_InstructorHorarioPilates_CTS
} from '../Controllers/CTS_TB_HorariosPilates.js';

/* --------------------------------------------
-------CÓDIGO AGREGADO POR Sergio Manrique---------
-------------------------------------------- */

import {
  OBRS_HorariosDeshabilitadosPilates_CTS,
  CR_HorarioDeshabilitadoPilates_CTS,
  ER_HorarioDeshabilitadoPilates_CTS,
  UR_HorarioDeshabilitadoPilates_CTS
} from '../Controllers/CTS_TB_HorariosDeshabilitadosPilates.js';

/* --------------------------------------------
-------FIN DE CODIGO MODIFICADO Sergio Manrique---------
-------------------------------------------- */
import {
  OBRS_VentasProspectosHorario_CTS,
  CR_VentasProspectosHorario_CTS,
  PUT_VentasProspectosHorarioPorProspecto_CTS
} from '../Controllers/CTS_TB_VentasProspectosHorarios.js';

import {
  OBRS_VentasRemarketingHorario_CTS,
  CR_VentasRemarketingHorario_CTS,
  PUT_VentasRemarketingHorarioPorRemarketing_CTS,
}from "../Controllers/CTS_TB_VentasRemarketingHorarios.js";

import {
  OBRS_AsistenciasFormato_CTS,
  UR_AsistenciaCliente_CTS,
  DEBUG_DispararCreacionAsistencias_CTS,
  OBRS_ReporteAsistenciaPrueba_CTS
} from '../Controllers/CTS_TB_AsistenciasPilates.js';

import {
  CR_crearContacto,
  UR_modificarEstadoContacto
} from '../Controllers/CTS_TB_ContactosListaEsperaPilates.js';

import {
  OBR_AuditoriaPorCliente_CTS,
  UR_AuditoriaFechaFin_CTS
} from '../Controllers/CTS_TB_AuditoriaFechaFinModificadaPilates.js';

import {
  OBRS_AlumnosAusentes_Dashboard_CTS,
  CR_HistorialContacto_CTS,
  OBR_HistorialContacto_PorIdCliente_CTS,
  UR_HistorialContacto_CTS,
  ER_HistorialContacto_CTS
} from '../Controllers/CTS_TB_HistorialContactosPilates.js';

import {
  OBRS_HistorialPorCliente_CTS,
  CR_EventoHistorial_CTS
} from '../Controllers/CTS_TB_ClientesPilatesHistorial.js';

// BENJAMIN ORELLANA 21 DIC 2025 INI
import {
  OBR_ConveniosPlanesDisponibles_CTS,
  OBRS_ConveniosPlanesDisponibles_CTS,
  CR_ConveniosPlanesDisponibles_CTS,
  ER_ConveniosPlanesDisponibles_CTS,
  UR_ConveniosPlanesDisponibles_CTS
} from '../Controllers/CTS_TB_ConveniosPlanesDisponibles.js';

import {
  OBR_IntegrantesConveNotas_CTS,
  OBRS_IntegrantesConveNotas_CTS,
  OBRS_IntegrantesConveNotasCounts_CTS,
  CR_IntegrantesConveNotas_CTS,
  ER_IntegrantesConveNotas_CTS,
  UR_IntegrantesConveNotas_CTS
} from '../Controllers/CTS_TB_IntegrantesConveNotas.js';
// BENJAMIN ORELLANA 21 DIC 2025 FIN

// Crea un enrutador de Express
const router = express.Router();

// Define las rutas para cada método del controlador

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de Trabajo_CTS - tb_1
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de Trabajo_CTS

router.get('/jobs', OBRS_Trabajo_CTS);

// Ruta para obtener un registro específico de Trabajo_CTS_CTS por su ID
router.get('/jobs/:id', OBR_Trabajo_CTS);

// Ruta para crear un nuevo registro en Trabajo_CTS_CTS
router.post('/jobs', CR_Trabajo_CTS);

// Ruta para eliminar un registro en Trabajo_CTS_CTS por su ID
router.delete('/jobs/:id', ER_Trabajo_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de frec_asks tb_2
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de FrecAsk_CTS

router.get('/ask', OBRS_FrecAsk_CTS);

// Ruta para obtener un registro específico de FrecAsk_CTS por su ID
router.get('/ask/:id', OBR_FrecAsk_CTS);

// Ruta para crear un nuevo registro en FrecAsk_CTS
router.post('/ask', CR_FrecAsk_CTS);

// Ruta para eliminar un registro en FrecAsk_CTS por su ID
router.delete('/ask/:id', ER_FrecAsk_CTS);

// Ruta para actualizar un registro en FrecAsk_CTS por su ID
router.put('/ask/:id', UR_FrecAsk_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de migration tb_3
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de Notifications

router.get('/migrations', OBRS_Migration_CTS);

// Ruta para obtener un registro específico de Notifications por su ID
router.get('/migrations/:id', OBR_Migration_CTS);

// Ruta para crear un nuevo registro en Notifications
router.post('/migrations', CR_Migration_CTS);

// Ruta para eliminar un registro en Notifications por su ID
router.delete('/migrations/:id', ER_Migration_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de Novedades tb_5
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de Novedades

router.get('/novedades', OBRS_Novedades_CTS);

// Ruta para obtener un registro específico de Novedades por su ID
router.get('/novedades/:id', OBR_Novedades_CTS);

// Ruta para crear un nuevo registro en Novedades
router.post('/novedades', CR_Novedades_CTS);

// Ruta para eliminar un registro en Novedades por su ID
router.delete('/novedades/:id', ER_Novedades_CTS);

// Ruta para actualizar un registro en Novedades por su ID
router.put('/novedades/:id', UR_Novedades_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de NovedadUser tb_6
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de NovedadUser

router.get('/novedad_user', OBRS_NovedadUser_CTS);

// Ruta para obtener un registro específico de Novedad por su ID
router.get('/novedad_user/:id', OBR_NovedadUser_CTS);

// Ruta para crear un nuevo registro en Novedad
router.post('/novedad_user', CR_NovedadUser_CTS);

// Ruta para eliminar un registro en Novedad por su ID
router.delete('/novedad_user/:id', ER_NovedadUser_CTS);
// Ruta para marcar una novedad como leída
router.put('/novedad_user/:id', UPDATE_NovedadUser_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de NovedadUserDestino tb_7
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de NovedadUserDestino

router.get('/novedad_users_destino', OBRS_NovedadUserDestino_CTS);

// Ruta para obtener un registro específico de NovedadUser por su ID
router.get('/novedad_users_destino/:id', OBR_NovedadUserDestino_CTS);

// Ruta para crear un nuevo registro en NovedadUser
router.post('/novedad_users_destino', CR_NovedadUserDestino_CTS);

// Ruta para eliminar un registro en NovedadUser por su ID
router.delete('/novedad_users_destino/:id', ER_NovedadUserDestino_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de PassReset tb_8
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de PassReset

router.get('/passreset', OBRS_PassReset_CTS);

// Ruta para obtener un registro específico de PassReset por su ID
router.get('/passreset/:id', OBR_PassReset_CTS);

// Ruta para crear un nuevo registro en PassReset
router.post('/passreset', CR_PassReset_CTS);

// Ruta para eliminar un registro en PassReset por su ID
router.delete('/passreset/:id', ER_PassReset_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de PersonalAccessTokens tb_9
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de PersonalAccessTokens

router.get('/personalaccess', OBRS_PersonalAccessTokens_CTS);

// Ruta para obtener un registro específico de PersonalAccessTokens por su ID
router.get('/personalaccess/:id', OBR_PersonalAccessTokens_CTS);

// Ruta para crear un nuevo registro en PersonalAccessTokens
router.post('/personalaccess', CR_PersonalAccessTokens_CTS);

// Ruta para eliminar un registro en PersonalAccessTokens por su ID
router.delete('/personalaccess/:id', ER_PersonalAccessTokens_CTS);
// ----------------------------------------------------------------
// Ruta para obtener todos los registros de Postulante_CTS tb_10
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de Postulante

router.get('/postulantes', OBRS_Postulante_CTS);

// Ruta para obtener un registro específico de Postulante_CTS por su ID
router.get('/postulantes/:id', OBR_Postulante_CTS);

// Ruta para crear un nuevo registro en Postulante_CTS
router.post('/postulantes', CR_Postulante_CTS);

// Ruta para eliminar un registro en Postulante_CTS por su ID
router.delete('/postulantes/:id', ER_Postulante_CTS);

router.put('/postulantes/:id', UR_Postulante_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de SchedulerTaskUser tb_11
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de SchedulerTaskUser

router.get('/schedulertask_user', OBRS_SchedulerTaskUser_CTS);

// Ruta para obtener un registro específico de SchedulerTaskUser por su ID
router.get('/schedulertask_user/:id', OBR_SchedulerTaskUser_CTS);

// Ruta para crear un nuevo registro en SchedulerTaskUser
router.post('/schedulertask_user', CR_SchedulerTaskUser_CTS);

// Ruta para eliminar un registro en SchedulerTaskUser por su ID
router.delete('/schedulertask_user/:id', ER_SchedulerTaskUser_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de SchedulerTask tb_12
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de SchedulerTaskUser

router.get('/schedulertask', OBRS_SchedulerTask_CTS);

// Ruta para obtener un registro específico de SchedulerTask por su ID
router.get('/schedulertask/:id', OBR_SchedulerTask_CTS);

// Ruta para crear un nuevo registro en SchedulerTask
router.post('/schedulertask', CR_SchedulerTask_CTS);

// Ruta para eliminar un registro en SchedulerTask por su ID
router.delete('/schedulertask/:id', ER_SchedulerTask_CTS);

// Ruta para actualizar un registro en SchedulerTask por su ID
router.put('/schedulertask/:id', UR_SchedulerTask_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de TestClass_CTS tb_13
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de TestClass_CTS

router.get('/testclass', OBRS_TestClass_CTS);

// Obtener un registro específico de TestClass_CTS por su ID
router.get('/testclass/:id', OBR_TestClass_CTS);

// Crear un nuevo registro en TestClass_CTS
router.post('/testclass', CR_TestClass_CTS);

// Eliminar un registro en TestClass_CTS por su ID
router.delete('/testclass/:id', ER_TestClass_CTS);
// Actualizar un registro en TestClass_CTS por su ID
router.put('/testclass/:id', UR_TestClass_CTS);

router.post('/testclass/mover-a-ventas', MOVER_A_VENTAS_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de TextContents_CTS tb_14
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de TextContents_CTS

router.get('/textcontents', OBRS_TextContents_CTS);

// Obtener un registro específico de TextContents_CTS por su ID
router.get('/textcontents/:id', OBR_TextContents_CTS);

// Crear un nuevo registro en TextContents_CTS
router.post('/textcontents', CR_TextContents_CTS);

// Eliminar un registro en TextContents_CTS por su ID
router.delete('/textcontents/:id', ER_TextContents_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de Users_CTS tb_15
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de Users_CTS

router.get('/users', OBRS_Users_CTS);

// Obtener un registro específico de Users_CTS por su ID
router.get('/users/:id', OBR_Users_CTS);

// Crear un nuevo registro en Users_CTS
router.post('/users', CR_Users_CTS);

// Eliminar un registro en Users_CTS por su ID
router.delete('/users/:id', ER_Users_CTS);

// Actualizar un registro en Users_CTS por su ID
router.put('/users/:id', UR_Users_CTS);

// Ruta para obtener solo usuarios con level = 'instructor'
router.get('/instructores', OBRS_Instructores_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de AdmConve tb_15
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de AdmConve

router.get('/admconvenios', OBRS_AdmConve_CTS);

// Obtener un registro específico de AdmConve por su ID
router.get('/admconvenios/:id', OBR_AdmConve_CTS);

// Crear un nuevo registro en AdmConve
router.post('/admconvenios', CR_AdmConve_CTS);

// Eliminar un registro en AdmConve por su ID
router.delete('/admconvenios/:id', ER_AdmConve_CTS);

router.put('/admconvenios/:id', UR_AdmConve_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de Imagenes
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de imagenes

router.get('/imagesget', OBRS_AdmConveniosImages_CTS);

// Obtener un registro específico de AdmConveniosImages por su ID
router.get('/imagesget/:id', OBR_AdmConveniosImages_CTS);

// Crear un nuevo registro en AdmConveniosImages
router.post('/imagesget', CR_AdmConveniosImages_CTS);

// Eliminar un registro en AdmConveniosImages por su ID
router.delete('/imagesget/:id', ER_AdmConveniosImages_CTS);

router.put('/imagesget/:id', UR_AdmConveniosImages_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de Facturas
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de Facturas

router.get('/facget', OBRS_AdmConveniosFac_CTS);

// Obtener un registro específico de AdmConveniosFac por su ID
router.get('/facget/:id', OBR_AdmConveniosFac_CTS);

// Crear un nuevo registro en AdmConveniosFac
router.post('/facget', CR_AdmConveniosFac_CTS);

// Eliminar un registro en AdmConveniosFac por su ID
router.delete('/facget/:id', ER_AdmConveniosFac_CTS);

router.put('/facget/:id', UR_AdmConveniosFac_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de IntegrantesConve tb_15
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de IntegrantesConve

router.get('/integrantes-conve/descargar-pdf', OBRS_IntegrantesConve_PDF_CTS);

router.get('/integrantes', OBRS_IntegrantesConve_CTS);

// Obtener un registro específico de IntegrantesConve por su ID
router.get('/integrantes/:id', OBR_IntegrantesConve_CTS);

// Crear un nuevo registro en IntegrantesConve
router.post('/integrantes', CR_IntegrantesConve_CTS);

// Eliminar un registro en IntegrantesConve por su ID
router.delete('/integrantes/:id', ER_IntegrantesConve_CTS);

// Actualizar un registro en IntegrantesConve por su ID
router.put('/integrantes/:id', UR_IntegrantesConve_CTS);

//R6 - Autorizar Integrantes - BO- 15-09-24 - inicio
// Ruta para autorizar un integrante
router.put('/integrantes/:id/autorizar', Autorizar_Integrante_CTS);
//R6 - Autorizar Integrantes - BO- 15-09-24 - final

//R7 - Autorizar todos los integrantes de un convenio - BO - 15-09-24 - inicio
router.put(
  '/integrantes/autorizar-convenio/:id_conv',
  Autorizar_Integrantes_Por_Convenio
);
//R7 - Autorizar todos los integrantes de un convenio - BO - 15-09-24 - final

router.get('/integrantesfam', OBRS_FamIntegrante_CTS);

// Obtener un registro específico de FamIntegrante por su ID
router.get('/integrantesfam/:id', OBR_FamIntegrante_CTS);

// Crear un nuevo registro en FamIntegrante
router.post('/integrantesfam', CR_FamIntegrante_CTS);

// Eliminar un registro en FamIntegrante por su ID
router.delete('/integrantesfam/:id', ER_FamIntegrante_CTS);

// Actualizar un registro en FamIntegrante por su ID
router.put('/integrantesfam/:id', UR_FamIntegrante_CTS);

router.get('/convenios-mes-acciones', OBRS_ConveniosMesAcciones_CTS);
router.get(
  '/convenios-mes-acciones/pendientes-count',
  COUNT_PENDIENTES_ConveniosMesAcciones_CTS
);
router.get('/convenios-mes-acciones/:id', OBR_ConveniosMesAcciones_CTS);

router.post('/convenios-mes-acciones', CR_ConveniosMesAcciones_CTS);
router.post(
  '/convenios-mes-acciones/finalizar',
  CR_ConveniosMesAcciones_Finalizar_CTS
);
router.post(
  '/convenios-mes-acciones/enviar',
  CR_ConveniosMesAcciones_Enviar_CTS
);
router.patch(
  '/convenios-mes-acciones/:id/leido',
  MARCAR_LEIDO_ConveniosMesAcciones_CTS
);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de AdmPrecio tb_15
// ----------------------------------------------------------------
// Define las rutas para cada método del controlador de AdmPrecio

router.use('/integrantesImport', importIntegrantes);
router.use('/recaptacionImport', RT_Import_Recaptacion);

// R5-SUBIR ARCHIVOS A NOVEDADES - 16-09-2024 - Benjamin Orellana - INICIO

router.get('/novedadesarch', OBRS_NovedadArchivos_CTS);

// Obtener un registro específico de NovedadArchivos por su ID
// router.get('/novedadesarch/:id', OBR_NovedadArchivos_CTS);

// Crear un nuevo registro en NovedadArchivos
router.post('/novedadesarch', CR_NovedadArchivos_CTS);

// Eliminar un registro en NovedadArchivos por su ID
router.delete('/novedadesarch/:id', ER_NovedadArchivos_CTS);

// Actualizar un registro en NovedadArchivos por su ID
router.put('/novedadesarch/:id', UR_NovedadArchivos_CTS);
// R5-SUBIR ARCHIVOS A NOVEDADES - 16-09-2024 - Benjamin Orellana - FINAL

// R6- Agregar mas fechas a novedades  18-09-2024 - Benjamin Orellana - INICIO

// router.get('/novedades-vencimientos', OBRS_NovedadesVencimientos_CTS);
// Ruta para obtener un vencimiento por ID
// router.get('/novedades-vencimientos/:id', OBR_NovedadesVencimientos_CTS);

// Ruta para crear un nuevo vencimiento

// Ruta para actualizar un vencimiento por ID

// Ruta para eliminar un vencimiento por ID
// R6- Agregar mas fechas a novedades  18-09-2024 - Benjamin Orellana - FINAL

// R9- Planilla Instructores  22-10-2024 - Benjamin Orellana - INICIO

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de Alumnos tb_15
// ----------------------------------------------------------------
// Ruta para obtener todos los registros de Alumnos
router.get('/alumnos', OBRS_Alumnos_CTS);

// Obtener un registro específico de Alumnos por su ID
router.get('/alumnos/:id', OBR_Alumnos_CTS);

// Crear un nuevo registro en Alumnos
router.post('/alumnos', CR_Alumnos_CTS);

// Eliminar un registro en Alumnos por su ID
router.delete('/alumnos/:id', ER_Alumnos_CTS);

// Actualizar un registro en Alumnos por su ID
router.put('/alumnos/:id', UR_Alumnos_CTS);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de Asistencias tb_15
// ----------------------------------------------------------------
// Ruta para obtener todos los registros de Asistencias
router.get('/asistencias', OBRS_Asistencias_CTS);

// Obtener un registro específico de Asistencias por su ID
router.get('/asistencias/:id', OBR_Asistencias_CTS);

// Crear un nuevo registro en Asistencias
router.post('/asistencias', CR_Asistencias_CTS);

// Eliminar un registro en Asistencias por su ID
router.delete('/asistencias/:id', ER_Asistencias_CTS);

// Actualizar un registro en Asistencias por su ID
router.put('/asistencias/:id', UR_Asistencias_CTS);

// Nueva ruta para verificar asistencia
router.get('/asistencias/:alumno_id/:dia/:mes/:anio', GET_Asistencia);

// ----------------------------------------------------------------
// Ruta para obtener todos los registros de Agendas tb_15
// ----------------------------------------------------------------
// Ruta para obtener todos los registros de Agendas
router.get('/agendas', OBRS_Agendas_CTS);

// Obtener un registro específico de Agendas por su ID
router.get('/agendas/:id', OBR_Agendas_CTS);

// Crear un nuevo registro en Agendas
router.post('/agendas', CR_Agendas_CTS);

// Verificar si existe una agenda específica
router.get('/agendas/:alumno_id/:agenda_num', GET_Agenda_CTS);

// Eliminar un registro en Agendas por su ID
router.delete('/agendas/:id', ER_Agendas_CTS);

// Actualizar un registro en Agendas por su ID
router.put('/agendas/:id', UR_Agendas_CTS);

// Ruta para actualizar el estado de la agenda
router.put('/update-agenda-status/:agendaId', CR_ActualizarAgendaEstado_CTS);

// Rutas para Agenda Imagenes (Archivos de la Agenda)
router.get('/get-agenda-files/:agenda_id', OBRS_AgendaImagenes_CTS);
router.delete('/delete-agenda-file/:archivoId', ER_AgendaImagenes_CTS); // Eliminar un archivo de la agenda

// R9- Planilla Instructores  22-10-2024 - Benjamin Orellana - FINAL
// ----------------------------------------------------------------
// Definición de rutas para la tabla agenda_motivos
// ----------------------------------------------------------------

// Ruta para obtener todos los registros
router.get('/agenda-motivos/:agenda_id', OBRS_AgendaMotivos_CTS);

// Ruta para obtener un registro por ID
router.get('/agenda-motivos/:id', OBR_AgendaMotivos_CTS);

// Ruta para crear un nuevo registro
router.post('/agenda-motivos', CR_AgendaMotivos_CTS);

// Ruta para actualizar un registro por ID
router.put('/agenda-motivos/:id', UR_AgendaMotivos_CTS);

// Ruta para eliminar un registro por ID
router.delete('/agenda-motivos/:id', ER_AgendaMotivos_CTS);

// ----------------------------------------------------------------
// Rutas para operaciones CRUD en la tabla 'imagenes_preguntas_frec'
// ----------------------------------------------------------------

// Obtener todos los registros
router.get(
  '/imagenes_preguntas_frec/:pregunta_id',
  OBRS_ImagenesPreguntasFrec_CTS
);

// Crear un nuevo registro

// Eliminar un registro por ID
router.delete('/imagenes_preguntas_frec/:id', ER_ImagenesPreguntasFrec_CTS);

// Nueva ruta para obtener la imagen por pregunta_id
router.get(
  '/imagenes-preguntas/pregunta/:pregunta_id',
  OBR_ImagenPorPregunta_CTS
);

// Rutas para sedes
router.get('/sedes/ciudad', OBRS_SedesCiudad_CTS); // Obtener sedes que son ciudades - DEBE IR ANTES que /sedes
router.get('/sedes', OBRS_Sede_CTS); // Obtener todas las sedes
router.get('/sedes/:id', OBR_Sede_CTS); // Obtener sede por ID
router.get('/sedes/alumnos/por/sede', ObtenerCantidadAlumnosPorSede_CTS); // Obtener sedes por ciudad
router.post('/sedes', CR_Sede_CTS); // Crear nueva sede
router.delete('/sedes/:id', ER_Sede_CTS); // Eliminar sede por ID
router.put('/sedes/:id', UR_Sede_CTS); // Actualizar sede por ID

// Rutas básicas CRUD
router.get('/quejas', OBRS_Quejas_CTS);
router.get('/quejas/:id', OBR_Queja_CTS);
router.post('/quejas', uploadQuejas.array('imagenes', 3), CR_Queja_CTS);// Crear una nueva queja con hasta 3 imágenes
router.put('/quejas/:id', UR_Queja_CTS);
router.delete('/quejas/:id', ER_Queja_CTS);

// Rutas adicionales para cambiar estado de resolución
router.put('/quejas/:id/resolver', MARCAR_Resuelto_Queja_CTS);
router.put('/quejas/:id/no-resuelto', MARCAR_NoResuelto_Queja_CTS);

// Rutas para quejas de pilates
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
/* COMIENZO DE CODIGO HECHO POR SERGIO MANRIQUE. FECHA 21/11/2025 */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
router.post('/quejas-pilates', CR_QuejaPilates_CTS); // Crear una nueva queja de pilates
router.put('/quejas-pilates/:id', UR_QuejaPilates_CTS); // Actualizar una queja de pilates por ID
router.delete('/quejas-pilates/:id', ER_QuejaPilates_CTS); // Eliminar una queja de pilates por ID
router.put('/quejas-pilates/:id/resolver', MARCAR_Resuelto_QuejaPilates); // PUT: Marcar una queja como RESUELTA
router.put('/quejas-pilates/:id/no-resuelto', MARCAR_NoResuelto_QuejaPilates); // PUT: Marcar una queja como NO RESUELTA
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
/* FIN DE CODIGO HECHO POR SERGIO MANRIQUE. FECHA 21/11/2025 */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */

//--------------------- SECCION DE REMARKETING ---------------------------//
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
/* COMIENZO DE CODIGO HECHO POR MATIAS PALLERO. FECHA 27/11/2025 */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
import {
  OBRS_VentasRemarketing_CTS,
  OBR_VentaRemarketing_CTS,
  CR_VentaRemarketing_CTS,
  UR_VentaRemarketing_CTS,
  ER_VentaRemarketing_CTS,
  UR_MarcarEnviado_CTS,
  UR_MarcarRespondido_CTS,
  UR_AgendarVenta_CTS,
  UR_MarcarConvertido_CTS,
  UR_RegistrarComision_CTS,
  OBRS_VentasPorUsuario_CTS,
  OBRS_VentasPorSede_CTS,
  OBRS_VentasPorFecha_CTS,
  CR_ProcesoAutomaticoRemarketing_CTS,
  OBRS_ClasesHoy_CTS
} from '../Controllers/CTS_TB_VentasRemarketing.js';

// Rutas CRUD básicas
router.get('/ventas-remarketing', OBRS_VentasRemarketing_CTS);
router.post('/ventas-remarketing', CR_VentaRemarketing_CTS); // -- Crear general

// Ruta para el proceso automático de remarketing
router.post(
  '/ventas-remarketing/proceso-automatico',
  CR_ProcesoAutomaticoRemarketing_CTS
);

// Ruta para obtener las clases del día
router.get('/ventas-remarketing/clases-hoy', OBRS_ClasesHoy_CTS);

// Rutas que usan :id
router.get('/ventas-remarketing/:id', OBR_VentaRemarketing_CTS);
router.put('/ventas-remarketing/:id', UR_VentaRemarketing_CTS);
router.delete('/ventas-remarketing/:id', ER_VentaRemarketing_CTS);

// Rutas de estados (Estas también usan :id, así que están bien después de la específica)
router.patch('/ventas-remarketing/:id/marcar-enviado', UR_MarcarEnviado_CTS);
router.patch(
  '/ventas-remarketing/:id/marcar-respondido',
  UR_MarcarRespondido_CTS
);
router.patch('/ventas-remarketing/:id/agendar', UR_AgendarVenta_CTS);
router.patch(
  '/ventas-remarketing/:id/marcar-convertido',
  UR_MarcarConvertido_CTS
);
router.patch(
  '/ventas-remarketing/:id/registrar-comision',
  UR_RegistrarComision_CTS
);

// Rutas de consultas específicas
router.get(
  '/ventas-remarketing/usuario/:usuario_id',
  OBRS_VentasPorUsuario_CTS
);
router.get('/ventas-remarketing/sede/:sede', OBRS_VentasPorSede_CTS);
router.get('/ventas-remarketing/fecha/rango', OBRS_VentasPorFecha_CTS);

/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
/* FIN DE CODIGO HECHO POR MATIAS PALLERO. FECHA 27/11/2025 */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
//--------------------- FIN SECCION DE REMARKETING -----------------------//

router.get('/tareasdiarias', OBRS_TareasDiarias_CTS);
router.get('/tareasdiarias/:id', OBR_TareaDiaria_CTS);
router.post('/tareasdiarias', CR_TareaDiaria_CTS);
router.put('/tareasdiarias/:id', UR_TareaDiaria_CTS);
router.delete('/tareasdiarias/:id', ER_TareaDiaria_CTS);

router.get('/user-daily-tasks', OBRS_UserDailyTasks_CTS);
router.post('/user-daily-tasks', CR_UserDailyTask_CTS);
router.delete(
  '/user-daily-tasks/:user_id/:daily_task_id',
  ER_UserDailyTask_CTS
);
router.get('/user-daily-tasks/user/:user_id', OBRS_TasksByUser_CTS);
router.post('/user-daily-tasks/bulk', CR_BulkUserDailyTasks_CTS); // <-- NUEVA RUTA

// Obtener todos los registros (puede filtrar por usuario o ser admin/coordinador)
router.get('/recaptacion', OBRS_Recaptacion_CTS);
router.get('/recaptacion/pendientes/count', CNT_RecaptacionPendientes_CTS);

// Obtener un registro específico
router.get('/recaptacion/:id', OBR_Recaptacion_CTS);

// Crear uno o varios registros nuevos
router.post('/recaptacion', CR_Recaptacion_CTS);

// Eliminar un registro
router.delete('/recaptacion/:id', ER_Recaptacion_CTS);

// Actualizar un registro
router.put('/recaptacion/:id', UR_Recaptacion_CTS);

router.get('/usuarios-con-registros', OBRS_ColaboradoresConRecaptacion);

router.delete('/recaptacion-masivo', ER_RecaptacionMasiva_CTS);

// Ejemplo: DELETE /recaptacion-masiva-usuario?usuario_id=10
router.delete(
  '/recaptacion-masiva-usuario',
  ER_RecaptacionMasivaPorUsuario_CTS
);

// Obtener todos los prospectos (con filtros opcionales)
router.get('/ventas_prospectos', OBRS_VentasProspectos_CTS);

/* RUTAS INTGEGRADAS POR SERGIO MANRIQUE 14-01-2025 */
//Obtener los alumons no convertidos del mes anterior para mostrarlos en remarketing
router.get(
  '/ventas_prospectos/alumnos-ultima-semana-mes-anterior',
  OBRS_VentasProspectosUltimaSemanaMesAnterior_CTS
);
/* FIN DE RUTAS INTEGRADAS POR SERGIO MANRIQUE 14-01-2025 */

// Obtener un prospecto por ID
router.get('/ventas_prospectos/:id', OBR_VentasProspecto_CTS);

// Crear un prospecto
router.post('/ventas_prospectos', CR_VentasProspecto_CTS);

// Actualizar un prospecto
router.put('/ventas_prospectos/:id', UR_VentasProspecto_CTS);

// Eliminar un prospecto
router.delete('/ventas_prospectos/:id', ER_VentasProspecto_CTS);

// Obtener lista de usuarios que cargaron prospectos
router.get(
  '/ventas_prospectos_colaboradores',
  OBRS_ColaboradoresConVentasProspectos
);

router.post(
  '/ventas-prospectos/sincronizar-completo',
  CR_VentasProspectoConHorario_CTS
);

import {
  OBRS_PreguntasIA_CTS,
  OBR_PreguntaIA_CTS,
  CR_PreguntaIA_CTS,
  ER_PreguntaIA_CTS,
  preguntarIAConContexto
} from '../Controllers/CTS_TB_PreguntasIA.js';

router.get('/preguntas-ia', OBRS_PreguntasIA_CTS);
router.get('/pregFuntas-ia/:id', OBR_PreguntaIA_CTS);
router.post('/preguntas-ia', CR_PreguntaIA_CTS);
router.delete('/preguntas-ia/:id', ER_PreguntaIA_CTS);
router.post('/preguntar-ia-con-contexto', preguntarIAConContexto);

import {
  CR_ChunkIA_CTS,
  OBRS_ChunksIA_Similares_CTS,
  crearChunkSiNoExiste,
  OBRT_ChunksIA_CTS,
  OBRS_ChunkIA_PorID_CTS,
  UPD_ChunkIA_CTS,
  DEL_ChunkIA_CTS
} from '../Controllers/CTS_TB_ChunksIA.js';

router.post('/chunks-ia', CR_ChunkIA_CTS);
router.get('/chunks-ia/similar', OBRS_ChunksIA_Similares_CTS);
router.post('/chunks-ia/crear-si-no-existe', crearChunkSiNoExiste);
router.get('/chunks-ia', OBRT_ChunksIA_CTS); // Obtener todos
router.get('/chunks-ia/:id', OBRS_ChunkIA_PorID_CTS); // Obtener por ID
router.put('/chunks-ia/:id', UPD_ChunkIA_CTS); // Editar
router.delete('/chunks-ia/:id', DEL_ChunkIA_CTS); // Eliminar

// Agenda de HOY (pendientes). Admin ve todo; user por usuario_id
// GET /api/ventas/agenda/hoy?usuario_id=123&level=user&with_prospect=1
router.get('/ventas/agenda/hoy', /* requireAuth, */ GET_AgendaHoy);

// Contador para badge
// GET /api/ventas/agenda/hoy/count?usuario_id=123&level=user
router.get('/ventas/agenda/hoy/count', /* requireAuth, */ GET_AgendaHoyCount);

// Marcar seguimiento como realizado
// PATCH /api/ventas/agenda/:id/done
router.patch('/ventas/agenda/:id/done', /* requireAuth, */ PATCH_AgendaDone);

// Forzar generación hoy (útil para pruebas)
// POST /api/ventas/agenda/generar-hoy
router.post(
  '/ventas/agenda/generar-hoy',
  /* requireAuth, */ POST_GenerarAgendaHoy
);

/* RUTAS INTGEGRADAS POR SERGIO MANRIQUE 14-01-2025 */
router.get('/ventas-remarketing/agenda/hoy', /* requireAuth, */ GET_AgendaHoyRemarketing);
router.get('/ventas-remarketing/agenda/hoy/count', /* requireAuth, */ GET_AgendaHoyCountRemarketing);
router.patch('/ventas-remarketing/agenda/:id/done', /* requireAuth, */ PATCH_AgendaDoneRemarketing);
router.post(
  '/ventas-remarketing/agenda/generar-hoy',
  /* requireAuth, */ POST_GenerarAgendaHoyRemarketing
);
/* FIN DE RUTAS INTEGRADAS POR SERGIO MANRIQUE 14-01-2025 */


// ----------------------------------------------------------------
// Rutas para operaciones CRUD en la tabla 'inscripciones_pilates'
router.get('/clientes-pilates/horarios', ESP_OBRS_HorarioClientesPilates_CTS);
router.get('/clientes-pilates', OBRS_ClientesPilates_CTS);
router.get('/clientes-pilates/buscar', BUSCAR_ClientesPilates_CTS);
router.get('/clientes-pilates/estado/:estado', OBRS_ClientesPorEstado_CTS);
router.get(
  '/clientes-pilates/proximos-vencer',
  OBRS_ClientesProximosVencer_CTS
);
router.get(
  '/clientes-pilates/existe-prueba-por-nombre',
  EXISTE_ClientePruebaPorNombre_CTS
);
router.get('/clientes-pilates/:id', OBR_ClientesPilates_CTS);
router.get(
  '/clientes-pilates/horarios-disponibles/ventas',
  ESP_OBRS_HorariosDisponibles_CTS
);
router.put('/clientes-pilates/:id', UR_ClientesPilates_CTS);
router.put(
  '/clientes-pilates/plan-renovacion/:id',
  UR_ClientesPilates_PlanRenovacion_CTS
);
router.patch(
  '/clientesPilates/:id/observaciones',
  UR_ClientesPilates_Observaciones_CTS
);
router.post('/clientes/insertar', CR_ClientesPilates_CTS);
router.delete(
  '/clientes-pilates/con-inscripciones/:id',
  ER_ClienteConInscripciones_CTS
);

router.get(
  '/auditoria-pilates/cliente/:cliente_id',
  OBR_AuditoriaPorCliente_CTS
);
router.put('/auditoria-pilates/cliente/:cliente_id', UR_AuditoriaFechaFin_CTS);

// ----------------------------------------------------------------
// Rutas para operaciones CRUD en la tabla 'inscripciones_pilates'
router.get('/inscripciones-pilates', OBRS_InscripcionesPilates_CTS);
router.get('/inscripciones-pilates/:id', OBR_InscripcionesPilates_CTS);
router.post('/inscripciones-pilates', CR_InscripcionesPilates_CTS);
router.put('/inscripciones-pilates/:id', UR_InscripcionesPilates_CTS);
router.patch(
  '/inscripciones-pilates/cambiar-turno',
  UR_CambiarTurnoInscripcion_CTS
);

router.get('/lista-espera-pilates', OBRS_ListaEsperaPilates);
router.get('/lista-espera-pilates/:id', OBR_ListaEsperaPilates);
router.post('/lista-espera-pilates', CR_ListaEsperaPilates);
router.put('/lista-espera-pilates/:id', UR_ListaEsperaPilates);
router.delete('/lista-espera-pilates/:id', ER_ListaEsperaPilates);

router.get('/usuarios-pilates', OBRS_UsuariosPilates_CTS);
router.get('/usuarios-pilates/nombres', OBRS_UsuariosPilatesNombreCompleto_CTS);
router.get('/usuarios-pilates/sede', OBRS_UsuariosPilatesPorSede_CTS); // Nueva ruta para filtrar por sede
router.get('/usuarios-pilates/:id', OBR_UsuarioPilates_CTS);
router.post('/usuarios-pilates', CR_UsuarioPilates_CTS); // Crear
router.put('/usuarios-pilates/:id', UR_UsuarioPilates_CTS); // Actualizar
router.delete('/usuarios-pilates/:id', ER_UsuarioPilates_CTS); // Eliminar

router.put(
  '/horarios-pilates/cambiar-instructor',
  UR_InstructorHorarioPilates_CTS
);

router.get('/asistencias-pilates/formato', OBRS_AsistenciasFormato_CTS);
router.put('/asistencias-pilates/marcar', UR_AsistenciaCliente_CTS);
router.get(
  '/asistencias-pilates/crear-diarias',
  DEBUG_DispararCreacionAsistencias_CTS
);
router.get(
  '/asistencias-pilates/reportes/asistencia-clases-prueba',
  OBRS_ReporteAsistenciaPrueba_CTS
);
// Historial de clientes pilates 15/12/2025
//--INICIO: Sergio Manrique
router.get(
  '/clientes-pilates/:cliente_id/historial',
  OBRS_HistorialPorCliente_CTS
);
router.post('/clientes-pilates/historial', CR_EventoHistorial_CTS);
//--FIN: Sergio Manrique

// Horarios deshabilitados de pilates
//--INICIO: Sergio Manrique
router.get(
  '/horarios-deshabilitados/:sedeId',
  OBRS_HorariosDeshabilitadosPilates_CTS
);
router.post('/horarios-deshabilitados', CR_HorarioDeshabilitadoPilates_CTS);
router.delete(
  '/horarios-deshabilitados/:id',
  ER_HorarioDeshabilitadoPilates_CTS
);
router.patch(
  '/horarios-deshabilitados/:id',
  UR_HorarioDeshabilitadoPilates_CTS
);
//--FIN: Sergio Manrique

// =======================================================
//  HECHO POR SERGIO MANRIQUE, FECHA: 22/12/2025
//  MÓDULO: ALUMNOS AUSENTES Y SEGUIMIENTO (Pilates)
// =======================================================
router.get('/pilates/ausentes-dashboard', OBRS_AlumnosAusentes_Dashboard_CTS);
router.get(
  '/pilates/historial-contactos/:id',
  OBR_HistorialContacto_PorIdCliente_CTS
);
router.post('/pilates/historial-contactos', CR_HistorialContacto_CTS);
router.patch("/pilates/historial-contactos/:id", UR_HistorialContacto_CTS);
router.delete("/pilates/historial-contactos/:id", ER_HistorialContacto_CTS);
// =======================================================
//  HECHO POR SERGIO MANRIQUE, FECHA: 22/12/2025
//  FIN DE MODULO: ALUMNOS AUSENTES Y SEGUIMIENTO (Pilates)
// =======================================================

router.post('/ventas-prospectos-horarios', CR_VentasProspectosHorario_CTS);
router.get(
  '/ventas-prospectos-horarios/:prospecto_id',
  OBRS_VentasProspectosHorario_CTS
);
router.put(
  '/ventas-prospectos-horarios/modificar-por-prospecto',
  PUT_VentasProspectosHorarioPorProspecto_CTS
);

// =======================================================
//  HECHO POR SERGIO MANRIQUE, FECHA: 12/01/2026
//  INICIO DE MODULO
// =======================================================
// Rutas para ventas remarketing horarios
router.post('/ventas-remarketing-horarios', CR_VentasRemarketingHorario_CTS);
// Obtener horarios por prospecto_id
router.get(
  '/ventas-remarketing-horarios/:prospecto_id',
  OBRS_VentasRemarketingHorario_CTS
);
// Modificar horarios por remarketing_id
router.put(
  '/ventas-remarketing-horarios/modificar-por-remarketing',
  PUT_VentasRemarketingHorarioPorRemarketing_CTS
);
// =======================================================
//  HECHO POR SERGIO MANRIQUE, FECHA: 12/01/2026
//  FIN DE MODULO
// =======================================================

router.post('/contactos-lista-espera', CR_crearContacto);
router.put(
  '/contactos-lista-espera/:id_lista_espera',
  UR_modificarEstadoContacto
);

import { POST_InformeFromOCR } from '../Controllers/CTS_TB_HxController.js';

router.post('/hx/informes/from-ocr', POST_InformeFromOCR);

import { GET_InformePDF } from '../Controllers/CTS_TB_HxInformePdf.js';

router.get('/hx/informes/:id/pdf', GET_InformePDF); // descarga por informe_id

// routes/hx.js  (o donde definas las rutas)
import { GET_InformeByBatch } from '../Controllers/CTS_TB_HxResolve.js';

// preferible usar camelCase
router.get('/hx/informes/by-batch/:batchId', GET_InformeByBatch);

import {
  POST_UploadImagenesBalanza,
  GET_ListImagenesBalanza,
  GET_DownloadImagenBalanza,
  GET_ListUltimosBatches
} from '../Controllers/CTS_TB_HxImagenBalanza.js';

router.get('/hx/imagenes-balanza/latest', GET_ListUltimosBatches);

// Subir lote 2..4 imágenes
router.post('/hx/imagenes-balanza', POST_UploadImagenesBalanza);

// Listar por batch_id (path) o por informe_id/cliente_id (query)
router.get('/hx/imagenes-balanza/:batch_id', GET_ListImagenesBalanza);
router.get('/hx/imagenes-balanza', GET_ListImagenesBalanza);

// Servir/descargar archivo por id
router.get('/hx/imagenes-balanza/file/:id', GET_DownloadImagenBalanza);

import {
  POST_convertirProspecto_CTS,
  GET_listarVentasComisiones_CTS,
  GET_obtenerVentaComision_CTS,
  PUT_actualizarVentaComision_CTS,
  PUT_aprobarVentaComision_CTS,
  PUT_rechazarVentaComision_CTS,
  DEL_eliminarVentaComision_CTS,
  GET_resumenComisionesVendedor_CTS,
  GET_listarComisionesVendedor_CTS
} from '../Controllers/CTS_TB_VentasComision.js';

import {
  GET_listarVentasComisionesRemarketing_CTS,
  PUT_actualizarVentaComisionRemarketing_CTS,
  PUT_aprobarVentaComisionRemarketing_CTS,
  PUT_rechazarVentaComisionRemarketing_CTS
} from '../Controllers/CTS_TB_VentasComisionRemarketing.js';

router.get('/ventas-comisiones/resumen', GET_resumenComisionesVendedor_CTS);
router.get('/ventas-comisiones/vendedor', GET_listarComisionesVendedor_CTS);

// Conversión (crea comisión en revisión si esComision = true)
router.post('/ventas-prospectos/:id/convertir', POST_convertirProspecto_CTS);

// Comisiones
router.get('/ventas-comisiones', GET_listarVentasComisiones_CTS);
router.get('/ventas-comisiones/:id', GET_obtenerVentaComision_CTS);
router.patch('/ventas-comisiones/:id', PUT_actualizarVentaComision_CTS);
router.put('/ventas-comisiones/:id/aprobar', PUT_aprobarVentaComision_CTS);
router.put('/ventas-comisiones/:id/rechazar', PUT_rechazarVentaComision_CTS);
router.delete('/ventas-comisiones/:id', DEL_eliminarVentaComision_CTS);

/* RUTAS INTGEGRADAS POR SERGIO MANRIQUE 14-01-2025 */
//Comisiones remarketing
router.get('/ventas-comisiones-remarketing', GET_listarVentasComisionesRemarketing_CTS);
router.patch('/ventas-comisiones-remarketing/:id', PUT_actualizarVentaComisionRemarketing_CTS);
router.put('/ventas-comisiones-remarketing/:id/aprobar', PUT_aprobarVentaComisionRemarketing_CTS);
router.put('/ventas-comisiones-remarketing/:id/rechazar', PUT_rechazarVentaComisionRemarketing_CTS);
router.delete('/ventas-comisiones-remarketing/:id', DEL_eliminarVentaComision_CTS);
/* FIN RUTAS INTGEGRADAS POR SERGIO MANRIQUE 14-01-2025 */

// Import controlador Comisiones Vigentes
import ComisionesVigentesCtrl from '../Controllers/CTS_TB_VentasComisionesVigentes.js';
const {
  OBRS_ComisionesVigentes_CTS,
  OBR_ComisionVigente_CTS,
  CR_ComisionVigente_CTS,
  UR_ComisionVigente_CTS,
  ER_ComisionVigente_CTS,
  DUP_Comisiones_Mes_CTS,
  DESACTIVAR_Comisiones_Mes_CTS,
  OBR_ComisionPorCodigo_CTS
} = ComisionesVigentesCtrl;

import ComisionesVigentesRemarketing from "../Controllers/CTS_TB_VentasComisionesVigentesRemarketing.js";
const {
    OBRS_ComisionesVigentesRemarketing_CTS,
  OBR_ComisionVigenteRemarketing_CTS,
  CR_ComisionVigenteRemarketing_CTS,
  UR_ComisionVigenteRemarketing_CTS,
  ER_ComisionVigenteRemarketing_CTS,
  DUP_ComisionesRemarketing_Mes_CTS,
  DESACTIVAR_ComisionesRemarketing_Mes_CTS,
  OBR_ComisionRemarketingPorCodigo_CTS
} = ComisionesVigentesRemarketing;

// --- Rutas Comisiones Vigentes ---
router.get('/comisiones-vigentes', OBRS_ComisionesVigentes_CTS); // list (filtros: mes,anio,solo_activas,codigo)
router.get('/comisiones-vigentes/:id', OBR_ComisionVigente_CTS); // get by id
router.post('/comisiones-vigentes', CR_ComisionVigente_CTS); // create
router.put('/comisiones-vigentes/:id', UR_ComisionVigente_CTS); // update
router.delete('/comisiones-vigentes/:id', ER_ComisionVigente_CTS); // delete (hard)

// Utilitarios de período
router.post('/comisiones-vigentes/duplicar', DUP_Comisiones_Mes_CTS); // body: origen_mes,origen_anio,destino_mes,destino_anio
router.post('/comisiones-vigentes/desactivar', DESACTIVAR_Comisiones_Mes_CTS); // body/query: mes,anio o periodo_inicio

// Búsqueda rápida por código
router.get('/comisiones-vigentes/by-codigo', OBR_ComisionPorCodigo_CTS); // query: codigo,mes,anio

/* RUTAS INTGEGRADAS POR SERGIO MANRIQUE 14-01-2025 */
router.get('/comisiones-vigentes-remarketing', OBRS_ComisionesVigentesRemarketing_CTS); // list (filtros: mes,anio,solo_activas,codigo)
router.get('/comisiones-vigentes-remarketing/:id', OBR_ComisionVigenteRemarketing_CTS); // get by id
router.post('/comisiones-vigentes-remarketing', CR_ComisionVigenteRemarketing_CTS); // create
router.put('/comisiones-vigentes-remarketing/:id', UR_ComisionVigenteRemarketing_CTS); // update
router.delete('/comisiones-vigentes-remarketing/:id', ER_ComisionVigenteRemarketing_CTS); // delete (hard)
// Utilitarios de período
router.post('/comisiones-vigentes-remarketing/duplicar', DUP_ComisionesRemarketing_Mes_CTS); // body: origen_mes,origen_anio,destino_mes,destino_anio
router.post('/comisiones-vigentes-remarketing/desactivar', DESACTIVAR_ComisionesRemarketing_Mes_CTS); // body/query: mes,anio o periodo_inicio
router.get('/comisiones-vigentes-remarketing/by-codigo', OBR_ComisionRemarketingPorCodigo_CTS); // query: codigo,mes,anio
/* FIN RUTAS INTGEGRADAS POR SERGIO MANRIQUE 14-01-2025 */

// SE ADICIONAN LAS RUTAS RELACIONADAS A CONVENIOS Y PLANES DE CONVENIO
// BENJAMIN ORELLANA 21 DIC 2025 INI
// =========================================================
// Planes de convenio
// =========================================================
router.get('/convenios-planes', OBRS_ConveniosPlanesDisponibles_CTS); // ?convenio_id= &activo=
router.get('/convenios-planes/:id', OBR_ConveniosPlanesDisponibles_CTS);
router.post('/convenios-planes', CR_ConveniosPlanesDisponibles_CTS);
router.delete('/convenios-planes/:id', ER_ConveniosPlanesDisponibles_CTS);
router.put('/convenios-planes/:id', UR_ConveniosPlanesDisponibles_CTS);

// =========================================================
// Notas de integrante
// =========================================================
router.get(
  '/integrantes-conve-notas/counts',
  OBRS_IntegrantesConveNotasCounts_CTS
);
router.get('/integrantes-notas', OBRS_IntegrantesConveNotas_CTS); // ?integrante_conve_id=
router.get('/integrantes-notas/:id', OBR_IntegrantesConveNotas_CTS);
router.post('/integrantes-notas', CR_IntegrantesConveNotas_CTS);
router.delete('/integrantes-notas/:id', ER_IntegrantesConveNotas_CTS);
router.put('/integrantes-notas/:id', UR_IntegrantesConveNotas_CTS);
// BENJAMIN ORELLANA 21 DIC 2025 FIN

// BENJAMIN ORELLANA 28 DIC 2025 INI
import {
  OBR_ConvenioChatThread_ByConvenio_CTS,
  UPD_ConvenioChatThread_SetNombre_CTS,
  OBRS_ConvenioChatMessages_CTS,
  CR_ConvenioChatMessage_CTS,
  UPD_ConvenioChatMessage_CTS,
  ER_ConvenioChatMessage_SoftDelete_CTS,
  MARCAR_LEIDO_ConvenioChatAccion_CTS,
  CR_ConvenioChatMessageRead_CTS
} from '../Controllers/CTS_TB_ConvenioChat.js';

// Convenio Chat
router.get('/convenio-chat/thread', OBR_ConvenioChatThread_ByConvenio_CTS);
router.patch('/convenio-chat/thread/:id/nombre', UPD_ConvenioChatThread_SetNombre_CTS);

router.get('/convenio-chat/messages', OBRS_ConvenioChatMessages_CTS);
router.post('/convenio-chat/messages', CR_ConvenioChatMessage_CTS);
router.patch('/convenio-chat/messages/:id', UPD_ConvenioChatMessage_CTS);
router.delete('/convenio-chat/messages/:id', ER_ConvenioChatMessage_SoftDelete_CTS);

router.post('/convenio-chat/acciones/marcar-leido', MARCAR_LEIDO_ConvenioChatAccion_CTS);

router.post('/convenio-chat/messages/:id/read', CR_ConvenioChatMessageRead_CTS);

// BENJAMIN ORELLANA 28 DIC 2025 FIN

// Exporta el enrutador
export default router;
