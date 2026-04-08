/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 08 / 04 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * * Provee acceso al desglose individual de los conceptos aplicados en una liquidación.
 * * Vincula marcaciones específicas con los montos de horas liquidados para auditoría.
 * Tema: Controladores - RRHH Liquidación Detalle
 * * Capa: Backend 
 *
 * Nomenclatura: 
 * * OBRS_ obtenerRegistros (Filtrado por liquidación o tipo)
 * * OBR_ obtenerRegistro
 */
import RRHHLiquidacionDetalleModel from '../../Models/RRHH/MD_TB_RRHHLiquidacionDetalle.js';
import RRHHLiquidacionesModel from '../../Models/RRHH/MD_TB_RRHHLiquidaciones.js';
import RRHHMarcacionesModel from '../../Models/RRHH/MD_TB_RRHHMarcaciones.js';

// Mostrar todos los detalles de liquidación
export const OBRS_RRHHLiquidacionDetalle_CTS = async (req, res) => {
  try {
    const { liquidacion_id, tipo_detalle } = req.query;

    const filtros = { eliminado: 0 };

    if (liquidacion_id) filtros.liquidacion_id = liquidacion_id;
    if (tipo_detalle) filtros.tipo_detalle = tipo_detalle;

    const registros = await RRHHLiquidacionDetalleModel.findAll({
      where: filtros,
      include: [
        {
          model: RRHHLiquidacionesModel,
          as: 'liquidacion'
        },
        {
          model: RRHHMarcacionesModel,
          as: 'marcacion',
          required: false
        }
      ],
      order: [['fecha', 'ASC'], ['id', 'ASC']]
    });

    return res.json(registros);
  } catch (error) {
    console.error('ERROR EN OBRS_RRHHLiquidacionDetalle_CTS:', error);
    return res.status(500).json({ message: error.message });
  }
};

// Mostrar un detalle por ID
export const OBR_RRHHLiquidacionDetalle_CTS = async (req, res) => {
  try {
    const registro = await RRHHLiquidacionDetalleModel.findOne({
      where: { id: req.params.id, eliminado: 0 },
      include: [
        {
          model: RRHHLiquidacionesModel,
          as: 'liquidacion'
        },
        {
          model: RRHHMarcacionesModel,
          as: 'marcacion',
          required: false
        }
      ]
    });

    if (!registro) {
      return res.status(404).json({
        message: 'Detalle de liquidación no encontrado'
      });
    }

    return res.json(registro);
  } catch (error) {
    console.error('ERROR EN OBR_RRHHLiquidacionDetalle_CTS:', error);
    return res.status(500).json({ message: error.message });
  }
};