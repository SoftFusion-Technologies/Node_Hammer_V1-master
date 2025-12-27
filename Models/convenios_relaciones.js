/* Programador: Benjamin Orellana
 * Fecha Creación: 21/12/2025
 * Versión: 1.0
 *
 * Descripción:
 *  Archivo central de relaciones para Convenios / Planes / Integrantes / Notas.
 *  Declara asociaciones entre:
 *   - AdmConveniosModel (adm_convenios)
 *   - ConveniosPlanesDisponiblesModel (convenios_planes_disponibles)
 *   - IntegrantesConveModel (integrantes_conve)
 *   - IntegrantesConveNotasModel (integrantes_conve_notas)
 *
 * Tema: Asociaciones - Convenios
 * Capa: Backend
 */

import AdmConveniosModel from './MD_TB_AdmConvenios.js';
import IntegrantesConveModel from './MD_TB_IntegrantesConve.js';
import ConveniosPlanesDisponiblesModel from './MD_TB_ConveniosPlanesDisponibles.js';
import IntegrantesConveNotasModel from './MD_TB_IntegrantesConveNotas.js';

/**
 * Inicializa todas las asociaciones del módulo Convenios.
 *
 * @returns {object} models por conveniencia
 */
export default function initConveniosRelaciones() {
  // =========================================================
  // 1) Convenio 1 — n Planes
  // =========================================================
  AdmConveniosModel.AdmConveniosModel.hasMany(
    ConveniosPlanesDisponiblesModel.ConveniosPlanesDisponiblesModel,
    {
      foreignKey: 'convenio_id',
      as: 'planes',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    }
  );

  ConveniosPlanesDisponiblesModel.ConveniosPlanesDisponiblesModel.belongsTo(
    AdmConveniosModel.AdmConveniosModel,
    {
      foreignKey: 'convenio_id',
      as: 'convenio'
    }
  );

  // =========================================================
  // 2) Convenio 1 — n Integrantes (ya existe id_conv)
  // =========================================================
  AdmConveniosModel.AdmConveniosModel.hasMany(
    IntegrantesConveModel.IntegrantesConveModel,
    {
      foreignKey: 'id_conv',
      as: 'integrantes',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    }
  );

  IntegrantesConveModel.IntegrantesConveModel.belongsTo(
    AdmConveniosModel.AdmConveniosModel,
    {
      foreignKey: 'id_conv',
      as: 'convenio'
    }
  );

  // =========================================================
  // 3) Plan 1 — n Integrantes (integrantes_conve.convenio_plan_id)
  // =========================================================
  ConveniosPlanesDisponiblesModel.ConveniosPlanesDisponiblesModel.hasMany(
    IntegrantesConveModel.IntegrantesConveModel,
    {
      foreignKey: 'convenio_plan_id',
      as: 'integrantes_plan',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    }
  );

  IntegrantesConveModel.IntegrantesConveModel.belongsTo(
    ConveniosPlanesDisponiblesModel.ConveniosPlanesDisponiblesModel,
    {
      foreignKey: 'convenio_plan_id',
      as: 'plan'
    }
  );

  // =========================================================
  // 4) Integrante 1 — n Notas (historial)
  // =========================================================
  IntegrantesConveModel.IntegrantesConveModel.hasMany(
    IntegrantesConveNotasModel.IntegrantesConveNotasModel,
    {
      foreignKey: 'integrante_conve_id',
      as: 'notas_historial',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    }
  );

  IntegrantesConveNotasModel.IntegrantesConveNotasModel.belongsTo(
    IntegrantesConveModel.IntegrantesConveModel,
    {
      foreignKey: 'integrante_conve_id',
      as: 'integrante'
    }
  );

  return {
    AdmConveniosModel,
    IntegrantesConveModel,
    ConveniosPlanesDisponiblesModel,
    IntegrantesConveNotasModel
  };
}
