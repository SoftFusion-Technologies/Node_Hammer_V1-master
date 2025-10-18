/* Programador: Benjamin Orellana
 * Fecha Creación: 07/10/2025
 * Versión: 1.0
 *
 * Descripción:
 *  Archivo central de relaciones (associations) para el módulo HammerX.
 *  Declara todas las asociaciones entre:
 *   - HxClienteModel (hx_clientes)
 *   - HxInformeModel (hx_informes)
 *   - HxInformeComidaModel (hx_informe_comidas)
 *
 * Tema: Asociaciones - HammerX
 * Capa: Backend
 */

import HxClienteModel from './MD_TB_HxClientes.js';
import HxInformeModel from './MD_TB_HxInformes.js';
import HxInformeComidaModel from './MD_TB_HxInformesComidas.js';
import HxImagenBalanzaModel from './MD_TB_HxImagenesBalanza.js';
/**
 * Inicializa todas las asociaciones de HammerX.
 * Llamar una sola vez al iniciar la app (antes de sync/usar los modelos).
 *
 * @returns {object} models: { HxClienteModel, HxInformeModel, HxInformeComidaModel }
 */
export default function initHxRelaciones() {
  // 1) Cliente 1 — n Informes
  HxClienteModel.hasMany(HxInformeModel, {
    foreignKey: 'cliente_id',
    as: 'informes',
    onDelete: 'RESTRICT', // no borrar informes si se borra cliente (ajustable)
    onUpdate: 'CASCADE'
  });

  HxInformeModel.belongsTo(HxClienteModel, {
    foreignKey: 'cliente_id',
    as: 'cliente'
  });

  // 2) Informe 1 — n Comidas
  HxInformeModel.hasMany(HxInformeComidaModel, {
    foreignKey: 'informe_id',
    as: 'comidas',
    onDelete: 'CASCADE', // si se borra el informe, caen sus comidas
    onUpdate: 'CASCADE'
  });

  HxInformeComidaModel.belongsTo(HxInformeModel, {
    foreignKey: 'informe_id',
    as: 'informe'
  });

  // (Opcional) Retornar los modelos por conveniencia
  return { HxClienteModel, HxInformeModel, HxInformeComidaModel };
}


// En hx_relaciones.js
HxImagenBalanzaModel.belongsTo(HxClienteModel, { foreignKey: 'cliente_id' });
HxImagenBalanzaModel.belongsTo(HxInformeModel, { foreignKey: 'informe_id' });
// y opcionalmente:
HxClienteModel.hasMany(HxImagenBalanzaModel, { foreignKey: 'cliente_id' });
HxInformeModel.hasMany(HxImagenBalanzaModel, { foreignKey: 'informe_id', onDelete: 'CASCADE' });
