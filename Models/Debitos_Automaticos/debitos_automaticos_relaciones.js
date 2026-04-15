/* Programador: Benjamin Orellana
 * Fecha Creación: 12/03/2026
 * Versión: 1.1
 *
 * Descripción:
 *  Archivo central de relaciones para el módulo Débitos Automáticos.
 *  asociaciones entre:
 *   - DebitosAutomaticosBancosModel
 *   - DebitosAutomaticosPlanesModel
 *   - DebitosAutomaticosTerminosModel
 *   - DebitosAutomaticosSolicitudesModel
 *   - DebitosAutomaticosSolicitudesAdicionalesModel
 *   - DebitosAutomaticosClientesModel
 *   - DebitosAutomaticosClientesAdicionalesModel
 *
 * Tema: Asociaciones - Débitos Automáticos
 * Capa: Backend
 */

import DebitosAutomaticosBancosModel from './MD_TB_DebitosAutomaticosBancos.js';
import DebitosAutomaticosPlanesModel from './MD_TB_DebitosAutomaticosPlanes.js';
import DebitosAutomaticosTerminosModel from './MD_TB_DebitosAutomaticosTerminos.js';
import DebitosAutomaticosSolicitudesModel from './MD_TB_DebitosAutomaticosSolicitudes.js';
import DebitosAutomaticosSolicitudesAdicionalesModel from './MD_TB_DebitosAutomaticosSolicitudesAdicionales.js';
import DebitosAutomaticosClientesModel from './MD_TB_DebitosAutomaticosClientes.js';
import DebitosAutomaticosClientesAdicionalesModel from './MD_TB_DebitosAutomaticosClientesAdicionales.js';
import DebitosAutomaticosPeriodosModel from './MD_TB_DebitosAutomaticosPeriodos.js';
import DebitosAutomaticosPlanesSedesModel from './MD_TB_DebitosAutomaticosPlanesSedes.js';

import UsersModel from '../MD_TB_Users.js';

/* Benjamin Orellana - 07/04/2026 - Se importa el modelo de sedes para relacionarlo con solicitudes y clientes del módulo de débitos automáticos */
import { SedeModel } from '../MD_TB_sedes.js';
/**
 * Inicializa todas las asociaciones de Débitos Automáticos.
 * Llamar una sola vez al iniciar la app (antes de sync/usar los modelos).
 *
 * @returns {object} models
 */
export default function initDebitosAutomaticosRelaciones() {
  // =========================================================
  // 1) Banco 1 - n Solicitudes
  // =========================================================
  DebitosAutomaticosBancosModel.hasMany(DebitosAutomaticosSolicitudesModel, {
    foreignKey: 'banco_id',
    as: 'solicitudes',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  });

  DebitosAutomaticosSolicitudesModel.belongsTo(DebitosAutomaticosBancosModel, {
    foreignKey: 'banco_id',
    as: 'banco'
  });

  // =========================================================
  // 2) Plan titular 1 - n Solicitudes
  // =========================================================
  DebitosAutomaticosPlanesModel.hasMany(DebitosAutomaticosSolicitudesModel, {
    foreignKey: 'titular_plan_id',
    as: 'solicitudes_titular',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  });

  DebitosAutomaticosSolicitudesModel.belongsTo(DebitosAutomaticosPlanesModel, {
    foreignKey: 'titular_plan_id',
    as: 'plan_titular'
  });

  // =========================================================
  // 3) Términos 1 - n Solicitudes
  // =========================================================
  DebitosAutomaticosTerminosModel.hasMany(DebitosAutomaticosSolicitudesModel, {
    foreignKey: 'terminos_id',
    as: 'solicitudes',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  });

  DebitosAutomaticosSolicitudesModel.belongsTo(
    DebitosAutomaticosTerminosModel,
    {
      foreignKey: 'terminos_id',
      as: 'terminos'
    }
  );

  // =========================================================
  // 4) Solicitud 1 - 1 Solicitud Adicional
  //    (por ahora una sola persona adicional por solicitud)
  // =========================================================
  DebitosAutomaticosSolicitudesModel.hasOne(
    DebitosAutomaticosSolicitudesAdicionalesModel,
    {
      foreignKey: 'solicitud_id',
      as: 'adicional',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    }
  );

  DebitosAutomaticosSolicitudesAdicionalesModel.belongsTo(
    DebitosAutomaticosSolicitudesModel,
    {
      foreignKey: 'solicitud_id',
      as: 'solicitud'
    }
  );

  // =========================================================
  // 5) Plan 1 - n Solicitudes Adicionales
  // =========================================================
  DebitosAutomaticosPlanesModel.hasMany(
    DebitosAutomaticosSolicitudesAdicionalesModel,
    {
      foreignKey: 'plan_id',
      as: 'solicitudes_adicionales',
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    }
  );

  DebitosAutomaticosSolicitudesAdicionalesModel.belongsTo(
    DebitosAutomaticosPlanesModel,
    {
      foreignKey: 'plan_id',
      as: 'plan'
    }
  );

  // =========================================================
  // 6) Solicitud 1 - 1 Cliente activo
  //    (nace cuando la solicitud se aprueba)
  // =========================================================
  DebitosAutomaticosSolicitudesModel.hasOne(DebitosAutomaticosClientesModel, {
    foreignKey: 'solicitud_id',
    as: 'cliente',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  });

  DebitosAutomaticosClientesModel.belongsTo(
    DebitosAutomaticosSolicitudesModel,
    {
      foreignKey: 'solicitud_id',
      as: 'solicitud'
    }
  );

  // =========================================================
  // 7) Banco 1 - n Clientes activos
  // =========================================================
  DebitosAutomaticosBancosModel.hasMany(DebitosAutomaticosClientesModel, {
    foreignKey: 'banco_id',
    as: 'clientes',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  });

  DebitosAutomaticosClientesModel.belongsTo(DebitosAutomaticosBancosModel, {
    foreignKey: 'banco_id',
    as: 'banco'
  });

  // =========================================================
  // 8) Plan titular 1 - n Clientes activos
  // =========================================================
  DebitosAutomaticosPlanesModel.hasMany(DebitosAutomaticosClientesModel, {
    foreignKey: 'titular_plan_id',
    as: 'clientes_titular',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  });

  DebitosAutomaticosClientesModel.belongsTo(DebitosAutomaticosPlanesModel, {
    foreignKey: 'titular_plan_id',
    as: 'plan_titular'
  });

  // =========================================================
  // 9) Cliente activo 1 - 1 Cliente adicional
  // =========================================================
  DebitosAutomaticosClientesModel.hasOne(
    DebitosAutomaticosClientesAdicionalesModel,
    {
      foreignKey: 'cliente_id',
      as: 'adicional',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    }
  );

  DebitosAutomaticosClientesAdicionalesModel.belongsTo(
    DebitosAutomaticosClientesModel,
    {
      foreignKey: 'cliente_id',
      as: 'cliente'
    }
  );

  // =========================================================
  // 10) Plan 1 - n Clientes Adicionales
  // =========================================================
  DebitosAutomaticosPlanesModel.hasMany(
    DebitosAutomaticosClientesAdicionalesModel,
    {
      foreignKey: 'plan_id',
      as: 'clientes_adicionales',
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    }
  );

  DebitosAutomaticosClientesAdicionalesModel.belongsTo(
    DebitosAutomaticosPlanesModel,
    {
      foreignKey: 'plan_id',
      as: 'plan'
    }
  );

  DebitosAutomaticosSolicitudesModel.belongsTo(UsersModel, {
    foreignKey: 'usuario_carga_id',
    as: 'usuario_carga'
  });

  UsersModel.hasMany(DebitosAutomaticosSolicitudesModel, {
    foreignKey: 'usuario_carga_id',
    as: 'solicitudes_cargadas'
  });

  // =========================================================
  // 11) Cliente activo 1 - n Períodos mensuales
  // =========================================================
  // Benjamin Orellana - 27/03/2026 - Asociación entre clientes activos y períodos mensuales para permitir includes desde periodos hacia cliente y desde cliente hacia periodos.
  DebitosAutomaticosClientesModel.hasMany(DebitosAutomaticosPeriodosModel, {
    foreignKey: 'cliente_id',
    as: 'periodos',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  });

  // Benjamin Orellana - 27/03/2026 - Asociación inversa para que cada período pertenezca a un cliente activo y pueda resolverse el alias 'cliente' en los controllers.
  DebitosAutomaticosPeriodosModel.belongsTo(DebitosAutomaticosClientesModel, {
    foreignKey: 'cliente_id',
    as: 'cliente'
  });

  // =========================================================
  // 12) Sede 1 - n Solicitudes
  // =========================================================

  // Benjamin Orellana - 07/04/2026 - Relación entre sedes y solicitudes para incluir la sede elegida desde el alta inicial.
  SedeModel.hasMany(DebitosAutomaticosSolicitudesModel, {
    foreignKey: 'sede_id',
    as: 'solicitudes_debitos_automaticos',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  });

  // Benjamin Orellana - 07/04/2026 - Asociación inversa para que cada solicitud pueda resolver su sede mediante el alias 'sede'.
  DebitosAutomaticosSolicitudesModel.belongsTo(SedeModel, {
    foreignKey: 'sede_id',
    as: 'sede'
  });

  // =========================================================
  // 13) Sede 1 - n Clientes activos
  // =========================================================

  // Benjamin Orellana - 07/04/2026 - Relación entre sedes y clientes activos para incluir la sede operativa consolidada al aprobar.
  SedeModel.hasMany(DebitosAutomaticosClientesModel, {
    foreignKey: 'sede_id',
    as: 'clientes_debitos_automaticos',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  });

  // Benjamin Orellana - 07/04/2026 - Asociación inversa para que cada cliente activo pueda resolver su sede mediante el alias 'sede'.
  DebitosAutomaticosClientesModel.belongsTo(SedeModel, {
    foreignKey: 'sede_id',
    as: 'sede'
  });

  // =========================================================
  // 14) Plan 1 - n Precios por Sede
  // =========================================================

  // Benjamin Orellana - 2026/04/15 - Relación entre planes globales y su configuración de precio por sede para resolver precios base según ciudad.
  DebitosAutomaticosPlanesModel.hasMany(DebitosAutomaticosPlanesSedesModel, {
    foreignKey: 'plan_id',
    as: 'planes_sedes',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  });

  // Benjamin Orellana - 2026/04/15 - Asociación inversa para que cada registro de precio por sede pueda resolver su plan mediante el alias 'plan'.
  DebitosAutomaticosPlanesSedesModel.belongsTo(DebitosAutomaticosPlanesModel, {
    foreignKey: 'plan_id',
    as: 'plan'
  });

  // =========================================================
  // 15) Sede 1 - n Precios de Planes
  // =========================================================

  // Benjamin Orellana - 2026/04/15 - Relación entre sedes y precios de planes por sede para resolver el precio base vigente de cada plan en cada ciudad.
  SedeModel.hasMany(DebitosAutomaticosPlanesSedesModel, {
    foreignKey: 'sede_id',
    as: 'planes_debitos_automaticos',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
  });

  // Benjamin Orellana - 2026/04/15 - Asociación inversa para que cada precio por sede pueda resolver la sede mediante el alias 'sede'.
  DebitosAutomaticosPlanesSedesModel.belongsTo(SedeModel, {
    foreignKey: 'sede_id',
    as: 'sede'
  });

  return {
    SedeModel,
    DebitosAutomaticosBancosModel,
    DebitosAutomaticosPlanesModel,
    DebitosAutomaticosPlanesSedesModel,
    DebitosAutomaticosTerminosModel,
    DebitosAutomaticosSolicitudesModel,
    DebitosAutomaticosSolicitudesAdicionalesModel,
    DebitosAutomaticosClientesModel,
    DebitosAutomaticosClientesAdicionalesModel,
    DebitosAutomaticosPeriodosModel
  };
}
