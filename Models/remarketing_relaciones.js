import VentasRemarketingModel from './MD_TB_VentasRemarketing.js';
import UsersModel from './MD_TB_Users.js';
import { VentasProspectosModel } from './MD_TB_ventas_prospectos.js';
import { VentasComisionesModel } from './MD_TB_ventas_comisiones.js';

// Relación con Usuario principal
VentasRemarketingModel.belongsTo(UsersModel, {
  foreignKey: 'usuario_id',
  as: 'usuario',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// Relación con Usuario que envió
VentasRemarketingModel.belongsTo(UsersModel, {
  foreignKey: 'enviado_by_user_id',
  as: 'enviado_por',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

// Relación con Usuario de comisión
VentasRemarketingModel.belongsTo(UsersModel, {
  foreignKey: 'comision_usuario_id',
  as: 'comision_usuario',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

// Relación con Prospecto (opcional)
VentasRemarketingModel.belongsTo(VentasProspectosModel, {
  foreignKey: 'ventas_prospecto_id',
  as: 'prospecto',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

// Relación con Comisión (opcional)
VentasRemarketingModel.belongsTo(VentasComisionesModel, {
  foreignKey: 'comision_id',
  as: 'comision',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

export default VentasRemarketingModel;