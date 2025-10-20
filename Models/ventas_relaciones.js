import { VentasComisionesModel } from './MD_TB_ventas_comisiones.js';
import { VentasProspectosModel } from './MD_TB_ventas_prospectos.js';
import UsersModel from './MD_TB_Users.js';

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

