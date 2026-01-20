import { VentasComisionesModel } from './MD_TB_ventas_comisiones.js';
import { VentasProspectosModel } from './MD_TB_ventas_prospectos.js';
import VentasRemarketingModel from './MD_TB_VentasRemarketing.js';
import UsersModel from './MD_TB_Users.js';
import { VentasComisionesRemarketingModel } from './MD_TB_Ventas_comisiones_remarketing.js';

// ========== VentasComisiones -> Prospecto / Users ==========
VentasComisionesModel.belongsTo(VentasProspectosModel, {
  foreignKey: 'prospecto_id',
  as: 'prospecto',
  onDelete: 'CASCADE',   // coincide con tu FK en SQL
  onUpdate: 'CASCADE'
});

VentasComisionesModel.belongsTo(UsersModel, {
  foreignKey: 'vendedor_id',
  as: 'vendedor',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

VentasComisionesModel.belongsTo(UsersModel, {
  foreignKey: 'aprobado_por',
  as: 'aprobador',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

VentasComisionesModel.belongsTo(UsersModel, {
  foreignKey: 'rechazado_por',
  as: 'rechazador',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

// ========== Prospecto -> VentasComisiones ==========
// 1) relación por FK "natural" (prospecto tiene una solicitud de comisión)
VentasProspectosModel.hasOne(VentasComisionesModel, {
  foreignKey: 'prospecto_id',
  as: 'solicitud_comision',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// ========== Remarketing -> VentasProspectos ==========
// Relación: ventas_remarketing tiene FK ventas_prospecto_id
VentasRemarketingModel.belongsTo(VentasProspectosModel, {
  foreignKey: 'ventas_prospecto_id',
  as: 'prospecto_origen',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

// Inversa: Un prospecto puede tener muchos remarketings
VentasProspectosModel.hasMany(VentasRemarketingModel, {
  foreignKey: 'ventas_prospecto_id',
  as: 'remarketings',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

// ========== Remarketing -> VentasComisiones Remarketing ==========
// Relación INVERSA: ventas_remarketing tiene la FK comision_id
VentasRemarketingModel.belongsTo(VentasComisionesRemarketingModel, {
  foreignKey: 'comision_id',
  as: 'comision_remarketing',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

// Relación DIRECTA: Una comisión puede tener UN remarketing
VentasComisionesRemarketingModel.hasOne(VentasRemarketingModel, {
  foreignKey: 'comision_id',
  as: 'remarketing',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});