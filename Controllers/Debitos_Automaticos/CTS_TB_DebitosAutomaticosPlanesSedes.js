/*
 * Programador: Benjamin Orellana
 * Fecha Creación: 15 / 04 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * Controladores CRUD para la tabla 'debitos_automaticos_planes_sedes'.
 * Incluye listado con filtros, obtención por ID, creación, actualización
 * y eliminación mediante baja lógica.
 *
 * Tema: Controladores - Débitos Automáticos Planes por Sede
 * Capa: Backend
 *
 * Nomenclatura: OBR_  obtenerRegistro
 *              OBRS_ obtenerRegistros(plural)
 *              CR_   crearRegistro
 *              ER_   eliminarRegistro
 *              UR_   updateRegistro
 */

import { Op } from 'sequelize';
import db from '../../DataBase/db.js';
import DebitosAutomaticosPlanesSedesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPlanesSedes.js';
import DebitosAutomaticosPlanesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPlanes.js';
import DebitosAutomaticosClientesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosClientes.js';
import DebitosAutomaticosPeriodosModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPeriodos.js';

import { SedeModel } from '../../Models/MD_TB_sedes.js';

/* =========================
   Helpers
========================= */
const toIntOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
};

const toDecOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(2));
};

const toFlagOrUndefined = (v) => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;

  const s = String(v).trim().toLowerCase();

  if (
    v === 1 ||
    v === true ||
    s === '1' ||
    s === 'true' ||
    s === 'si' ||
    s === 'sí'
  ) {
    return 1;
  }

  if (v === 0 || v === false || s === '0' || s === 'false' || s === 'no') {
    return 0;
  }

  return null;
};

/* Benjamin Orellana - 2026/04/15 - Normaliza el payload de precios por sede para crear o actualizar registros con validaciones reutilizables. */
const pickPlanSedePayload = (body = {}) => {
  return {
    plan_id: toIntOrNull(body.plan_id),
    sede_id: toIntOrNull(body.sede_id),
    precio_base: toDecOrNull(body.precio_base),
    activo: toFlagOrUndefined(body.activo)
  };
};

/* Benjamin Orellana - 2026/04/15 - Include centralizado para resolver plan y sede en listados y detalles del módulo. */
const buildInclude = () => [
  {
    model: DebitosAutomaticosPlanesModel,
    as: 'plan',
    attributes: [
      'id',
      'codigo',
      'nombre',
      'descripcion',
      'activo',
      'orden_visual'
    ]
  },
  {
    model: SedeModel,
    as: 'sede',
    attributes: ['id', 'nombre', 'estado', 'es_ciudad']
  }
];

/* Benjamin Orellana - 2026/04/23 - Helpers para previsualizar y aplicar actualización masiva de precio por plan+sede sobre clientes seleccionados y períodos futuros. */
const ESTADOS_CLIENTE_ACTUALIZABLES = ['ACTIVO', 'PENDIENTE_INICIO', 'PAUSADO'];
const ESTADOS_COBRO_CERRADOS = ['COBRADO', 'BAJA', 'PAGO_MANUAL'];

const toDecimalOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
};

const cleanStringOrNull = (v, max = null) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (max && s.length > max) return s.slice(0, max);
  return s;
};

const roundMoney = (value) => {
  const n = Number(value || 0);
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

const getActorUserId = (req) => {
  return (
    req?.user?.id ||
    req?.auth?.id ||
    toIntOrNull(req?.body?.updated_by) ||
    toIntOrNull(req?.body?.usuario_id) ||
    null
  );
};

const buildPeriodoDesdeWhere = (anio, mes) => ({
  [Op.or]: [
    { periodo_anio: { [Op.gt]: anio } },
    {
      [Op.and]: [{ periodo_anio: anio }, { periodo_mes: { [Op.gte]: mes } }]
    }
  ]
});

const sanitizeIds = (values = []) => {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((item) => toIntOrNull(item)).filter(Boolean))];
};

const calcularMontoBruto = (montoInicial, descuentoClientePct) => {
  const inicial = Number(montoInicial || 0);
  const descuento = Number(descuentoClientePct || 0);

  return roundMoney(inicial - (inicial * descuento) / 100);
};

/* Benjamin Orellana - 2026/04/23 - El neto estimado mantiene la lógica actual del período: sobre monto_bruto aplica descuento_off y luego reintegro. */
const calcularMontoNetoEstimado = (
  montoBruto,
  descuentoOffPct,
  reintegroPct
) => {
  const bruto = Number(montoBruto || 0);
  const descuentoOff = Number(descuentoOffPct || 0);
  const reintegro = Number(reintegroPct || 0);

  const conDescuentoOff = bruto - (bruto * descuentoOff) / 100;
  const neto = conDescuentoOff - (conDescuentoOff * reintegro) / 100;

  return roundMoney(neto);
};

/* =========================
   OBRS - listar
   Filtros:
   ?activo=1
   ?plan_id=1
   ?sede_id=2
   ?q=texto
========================= */
export const OBRS_DebitosAutomaticosPlanesSedes_CTS = async (req, res) => {
  try {
    const { activo, plan_id, sede_id, q } = req.query;

    const where = {};
    const include = buildInclude();

    if (activo !== undefined) {
      const activoInt = toIntOrNull(activo);

      if (activoInt === null || ![0, 1].includes(activoInt)) {
        return res.status(400).json({
          mensajeError: 'La query activo es inválida. Use 0 o 1.'
        });
      }

      where.activo = activoInt;
    }

    if (plan_id !== undefined) {
      const planIdInt = toIntOrNull(plan_id);

      if (!planIdInt) {
        return res.status(400).json({
          mensajeError: 'La query plan_id es inválida.'
        });
      }

      where.plan_id = planIdInt;
    }

    if (sede_id !== undefined) {
      const sedeIdInt = toIntOrNull(sede_id);

      if (!sedeIdInt) {
        return res.status(400).json({
          mensajeError: 'La query sede_id es inválida.'
        });
      }

      where.sede_id = sedeIdInt;
    }

    /* Benjamin Orellana - 2026/04/15 - Se permite búsqueda textual por código/nombre del plan y nombre de la sede usando includes requeridos. */
    if (q && String(q).trim()) {
      const search = String(q).trim();

      include[0].required = true;
      include[1].required = true;

      where[Op.or] = [
        { '$plan.codigo$': { [Op.like]: `%${search}%` } },
        { '$plan.nombre$': { [Op.like]: `%${search}%` } },
        { '$sede.nombre$': { [Op.like]: `%${search}%` } }
      ];
    }

    const registros = await DebitosAutomaticosPlanesSedesModel.findAll({
      where,
      include,
      order: [
        ['activo', 'DESC'],
        [
          { model: DebitosAutomaticosPlanesModel, as: 'plan' },
          'orden_visual',
          'ASC'
        ],
        [{ model: DebitosAutomaticosPlanesModel, as: 'plan' }, 'nombre', 'ASC'],
        [{ model: SedeModel, as: 'sede' }, 'nombre', 'ASC']
      ]
    });

    return res.json(registros);
  } catch (error) {
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   OBR - por ID
========================= */
export const OBR_DebitosAutomaticosPlanesSedes_CTS = async (req, res) => {
  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const registro = await DebitosAutomaticosPlanesSedesModel.findByPk(id, {
      include: buildInclude()
    });

    if (!registro) {
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    return res.json(registro);
  } catch (error) {
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   CR - crear
========================= */
export const CR_DebitosAutomaticosPlanesSedes_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const payload = pickPlanSedePayload(req.body);

    if (!payload.plan_id) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'plan_id es obligatorio.'
      });
    }

    if (!payload.sede_id) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'sede_id es obligatorio.'
      });
    }

    if (payload.precio_base === null) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'precio_base es obligatorio y debe ser numérico.'
      });
    }

    if (payload.precio_base < 0) {
      await t.rollback();
      return res.status(400).json({
        mensajeError: 'precio_base no puede ser negativo.'
      });
    }

    const plan = await DebitosAutomaticosPlanesModel.findByPk(payload.plan_id, {
      transaction: t
    });

    if (!plan) {
      await t.rollback();
      return res.status(404).json({
        mensajeError: 'El plan indicado no existe.'
      });
    }

    const sede = await SedeModel.findByPk(payload.sede_id, {
      transaction: t
    });

    if (!sede) {
      await t.rollback();
      return res.status(404).json({
        mensajeError: 'La sede indicada no existe.'
      });
    }

    const creado = await DebitosAutomaticosPlanesSedesModel.create(
      {
        plan_id: payload.plan_id,
        sede_id: payload.sede_id,
        precio_base: payload.precio_base,
        activo: payload.activo ?? 1
      },
      { transaction: t }
    );

    await t.commit();

    const registro = await DebitosAutomaticosPlanesSedesModel.findByPk(
      creado.id,
      {
        include: buildInclude()
      }
    );

    return res.status(201).json({
      message: 'Registro creado correctamente',
      registro
    });
  } catch (error) {
    await t.rollback();

    if (
      error?.name === 'SequelizeUniqueConstraintError' ||
      String(error?.original?.code || '').includes('ER_DUP_ENTRY')
    ) {
      return res.status(409).json({
        mensajeError:
          'Ya existe una configuración de precio para ese plan en esa sede.'
      });
    }

    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   UR - update
========================= */
export const UR_DebitosAutomaticosPlanesSedes_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const current = await DebitosAutomaticosPlanesSedesModel.findByPk(id, {
      transaction: t
    });

    if (!current) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    const body = req.body || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

    const updateBody = {};

    if (has('plan_id')) {
      const planId = toIntOrNull(body.plan_id);

      if (!planId) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'plan_id debe ser numérico.'
        });
      }

      const plan = await DebitosAutomaticosPlanesModel.findByPk(planId, {
        transaction: t
      });

      if (!plan) {
        await t.rollback();
        return res.status(404).json({
          mensajeError: 'El plan indicado no existe.'
        });
      }

      updateBody.plan_id = planId;
    }

    if (has('sede_id')) {
      const sedeId = toIntOrNull(body.sede_id);

      if (!sedeId) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'sede_id debe ser numérico.'
        });
      }

      const sede = await SedeModel.findByPk(sedeId, {
        transaction: t
      });

      if (!sede) {
        await t.rollback();
        return res.status(404).json({
          mensajeError: 'La sede indicada no existe.'
        });
      }

      updateBody.sede_id = sedeId;
    }

    if (has('precio_base')) {
      const precioBase = toDecOrNull(body.precio_base);

      if (
        body.precio_base !== null &&
        body.precio_base !== '' &&
        precioBase === null
      ) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'precio_base debe ser numérico.'
        });
      }

      if (precioBase === null) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'precio_base no puede ser null.'
        });
      }

      if (precioBase < 0) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'precio_base no puede ser negativo.'
        });
      }

      updateBody.precio_base = precioBase;
    }

    if (has('activo')) {
      const activo = toFlagOrUndefined(body.activo);

      if (activo === null) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'activo debe ser 0 o 1.'
        });
      }

      updateBody.activo = activo;
    }

    const [numRowsUpdated] = await DebitosAutomaticosPlanesSedesModel.update(
      updateBody,
      {
        where: { id },
        transaction: t
      }
    );

    if (numRowsUpdated !== 1) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    await t.commit();

    const registroActualizado =
      await DebitosAutomaticosPlanesSedesModel.findByPk(id, {
        include: buildInclude()
      });

    return res.json({
      message: 'Registro actualizado correctamente',
      registroActualizado
    });
  } catch (error) {
    await t.rollback();

    if (
      error?.name === 'SequelizeUniqueConstraintError' ||
      String(error?.original?.code || '').includes('ER_DUP_ENTRY')
    ) {
      return res.status(409).json({
        mensajeError:
          'Ya existe una configuración de precio para ese plan en esa sede.'
      });
    }

    return res.status(500).json({ mensajeError: error.message });
  }
};

/* =========================
   ER - eliminar (baja lógica)
========================= */
export const ER_DebitosAutomaticosPlanesSedes_CTS = async (req, res) => {
  const t = await db.transaction();

  try {
    const id = toIntOrNull(req.params.id);

    if (!id) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    const registro = await DebitosAutomaticosPlanesSedesModel.findByPk(id, {
      transaction: t
    });

    if (!registro) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado.' });
    }

    await DebitosAutomaticosPlanesSedesModel.update(
      { activo: 0 },
      { where: { id }, transaction: t }
    );

    await t.commit();

    return res.json({
      message: 'Registro dado de baja correctamente'
    });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({ mensajeError: error.message });
  }
};

/* Benjamin Orellana - 2026/04/23 - Previsualiza el impacto de una actualización de precio por plan+sede, filtrando clientes elegibles y contando períodos futuros alcanzados. */
export const OBRS_DebitosAutomaticosPlanesSedesPreviewActualizacionPrecio_CTS =
  async (req, res) => {
    try {
      const id = toIntOrNull(req.params.id);
      const nuevoPrecioBase = toDecimalOrNull(req.body?.nuevo_precio_base);
      const aplicarDesdeAnio = toIntOrNull(req.body?.aplicar_desde_anio);
      const aplicarDesdeMes = toIntOrNull(req.body?.aplicar_desde_mes);
      const q = cleanStringOrNull(req.body?.q, 150);

      if (!id) {
        return res.status(400).json({ mensajeError: 'ID inválido.' });
      }

      if (nuevoPrecioBase === null || nuevoPrecioBase < 0) {
        return res.status(400).json({
          mensajeError: 'nuevo_precio_base es obligatorio y debe ser >= 0.'
        });
      }

      if (!aplicarDesdeAnio || aplicarDesdeAnio < 2000) {
        return res.status(400).json({
          mensajeError: 'aplicar_desde_anio es obligatorio y debe ser válido.'
        });
      }

      if (!aplicarDesdeMes || aplicarDesdeMes < 1 || aplicarDesdeMes > 12) {
        return res.status(400).json({
          mensajeError: 'aplicar_desde_mes es obligatorio y debe estar entre 1 y 12.'
        });
      }

      const planSede = await DebitosAutomaticosPlanesSedesModel.findByPk(id);

      if (!planSede) {
        return res.status(404).json({
          mensajeError: 'Configuración plan+sede no encontrada.'
        });
      }

      const [plan, sede] = await Promise.all([
        DebitosAutomaticosPlanesModel.findByPk(planSede.plan_id),
        SedeModel.findByPk(planSede.sede_id)
      ]);

      const whereClientes = {
        titular_plan_id: planSede.plan_id,
        sede_id: planSede.sede_id,
        estado_general: {
          [Op.in]: ESTADOS_CLIENTE_ACTUALIZABLES
        }
      };

      if (q) {
        whereClientes[Op.or] = [
          { titular_nombre: { [Op.like]: `%${q}%` } },
          { titular_dni: { [Op.like]: `%${q}%` } }
        ];
      }

      const clientes = await DebitosAutomaticosClientesModel.findAll({
        where: whereClientes,
        attributes: [
          'id',
          'titular_nombre',
          'titular_dni',
          'estado_general',
          'fecha_inicio_cobro',
          'monto_inicial_vigente',
          'descuento_vigente',
          'monto_base_vigente',
          'sede_id',
          'titular_plan_id'
        ],
        order: [['titular_nombre', 'ASC']]
      });

      const clientesIds = clientes.map((item) => item.id);

      let periodosPorClienteMap = {};

      if (clientesIds.length > 0) {
        const periodosAgrupados = await DebitosAutomaticosPeriodosModel.findAll({
          where: {
            cliente_id: { [Op.in]: clientesIds },
            ...buildPeriodoDesdeWhere(aplicarDesdeAnio, aplicarDesdeMes),
            estado_cobro: {
              [Op.notIn]: ESTADOS_COBRO_CERRADOS
            }
          },
          attributes: [
            'cliente_id',
            [db.fn('COUNT', db.col('id')), 'total_periodos']
          ],
          group: ['cliente_id'],
          raw: true
        });

        periodosPorClienteMap = periodosAgrupados.reduce((acc, row) => {
          acc[row.cliente_id] = Number(row.total_periodos || 0);
          return acc;
        }, {});
      }

      const clientesPreview = clientes.map((cliente) => {
        const montoActual = Number(cliente.monto_inicial_vigente || 0);
        const descuentoClientePct = Number(cliente.descuento_vigente || 0);
        const nuevoMontoBruto = calcularMontoBruto(
          nuevoPrecioBase,
          descuentoClientePct
        );

        return {
          id: cliente.id,
          titular_nombre: cliente.titular_nombre,
          titular_dni: cliente.titular_dni,
          estado_general: cliente.estado_general,
          fecha_inicio_cobro: cliente.fecha_inicio_cobro,
          monto_actual: roundMoney(montoActual),
          monto_nuevo: roundMoney(nuevoPrecioBase),
          descuento_vigente: roundMoney(descuentoClientePct),
          monto_base_actual: roundMoney(cliente.monto_base_vigente || 0),
          monto_base_nuevo: nuevoMontoBruto,
          diferencia_monto_inicial: roundMoney(
            Number(nuevoPrecioBase) - montoActual
          ),
          periodos_impactados: periodosPorClienteMap[cliente.id] || 0
        };
      });

      return res.json({
        plan_sede_id: planSede.id,
        plan_id: planSede.plan_id,
        plan_nombre: plan?.nombre || null,
        sede_id: planSede.sede_id,
        sede_nombre: sede?.nombre || null,
        precio_base_actual: roundMoney(planSede.precio_base || 0),
        nuevo_precio_base: roundMoney(nuevoPrecioBase),
        aplicar_desde_anio: aplicarDesdeAnio,
        aplicar_desde_mes: aplicarDesdeMes,
        total_clientes_alcanzados: clientesPreview.length,
        total_periodos_alcanzados: clientesPreview.reduce(
          (acc, item) => acc + Number(item.periodos_impactados || 0),
          0
        ),
        clientes: clientesPreview
      });
    } catch (error) {
      return res.status(500).json({
        mensajeError: error.message
      });
    }
  };

  /* Benjamin Orellana - 2026/04/23 - Aplica una actualización masiva de precio por plan+sede solo a los clientes seleccionados y recalcula períodos futuros no cerrados. */
export const UR_DebitosAutomaticosPlanesSedesAplicarActualizacionPrecio_CTS =
  async (req, res) => {
    const t = await db.transaction();

    try {
      const id = toIntOrNull(req.params.id);
      const nuevoPrecioBase = toDecimalOrNull(req.body?.nuevo_precio_base);
      const aplicarDesdeAnio = toIntOrNull(req.body?.aplicar_desde_anio);
      const aplicarDesdeMes = toIntOrNull(req.body?.aplicar_desde_mes);
      const clientesIds = sanitizeIds(req.body?.clientes_ids);
      const actorUserId = getActorUserId(req);

      if (!id) {
        await t.rollback();
        return res.status(400).json({ mensajeError: 'ID inválido.' });
      }

      if (nuevoPrecioBase === null || nuevoPrecioBase < 0) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'nuevo_precio_base es obligatorio y debe ser >= 0.'
        });
      }

      if (!aplicarDesdeAnio || aplicarDesdeAnio < 2000) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'aplicar_desde_anio es obligatorio y debe ser válido.'
        });
      }

      if (!aplicarDesdeMes || aplicarDesdeMes < 1 || aplicarDesdeMes > 12) {
        await t.rollback();
        return res.status(400).json({
          mensajeError: 'aplicar_desde_mes es obligatorio y debe estar entre 1 y 12.'
        });
      }

      const planSede = await DebitosAutomaticosPlanesSedesModel.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!planSede) {
        await t.rollback();
        return res.status(404).json({
          mensajeError: 'Configuración plan+sede no encontrada.'
        });
      }

      await DebitosAutomaticosPlanesSedesModel.update(
        {
          precio_base: roundMoney(nuevoPrecioBase)
        },
        {
          where: { id: planSede.id },
          transaction: t
        }
      );

      if (clientesIds.length === 0) {
        await t.commit();

        return res.json({
          message:
            'Precio plan+sede actualizado correctamente. No se seleccionaron clientes para recalcular.',
          resumen: {
            plan_sede_id: planSede.id,
            plan_id: planSede.plan_id,
            sede_id: planSede.sede_id,
            clientes_actualizados: 0,
            periodos_actualizados: 0
          }
        });
      }

      const clientes = await DebitosAutomaticosClientesModel.findAll({
        where: {
          id: { [Op.in]: clientesIds },
          titular_plan_id: planSede.plan_id,
          sede_id: planSede.sede_id,
          estado_general: {
            [Op.in]: ESTADOS_CLIENTE_ACTUALIZABLES
          }
        },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      const clientesMap = new Map();
      let clientesActualizados = 0;

      for (const cliente of clientes) {
        const descuentoClientePct = Number(cliente.descuento_vigente || 0);
        const nuevoMontoBase = calcularMontoBruto(
          nuevoPrecioBase,
          descuentoClientePct
        );

        await DebitosAutomaticosClientesModel.update(
          {
            monto_inicial_vigente: roundMoney(nuevoPrecioBase),
            monto_base_vigente: nuevoMontoBase,
            updated_by: actorUserId
          },
          {
            where: { id: cliente.id },
            transaction: t
          }
        );

        clientesMap.set(cliente.id, {
          descuento_vigente: descuentoClientePct
        });

        clientesActualizados += 1;
      }

      const clientesIdsActualizados = Array.from(clientesMap.keys());

      let periodosActualizados = 0;

      if (clientesIdsActualizados.length > 0) {
        const periodos = await DebitosAutomaticosPeriodosModel.findAll({
          where: {
            cliente_id: { [Op.in]: clientesIdsActualizados },
            ...buildPeriodoDesdeWhere(aplicarDesdeAnio, aplicarDesdeMes),
            estado_cobro: {
              [Op.notIn]: ESTADOS_COBRO_CERRADOS
            }
          },
          transaction: t,
          lock: t.LOCK.UPDATE
        });

        for (const periodo of periodos) {
          const clienteSnapshot = clientesMap.get(periodo.cliente_id);

          if (!clienteSnapshot) continue;

          const descuentoClientePct = Number(
            clienteSnapshot.descuento_vigente || 0
          );

          const nuevoMontoBruto = calcularMontoBruto(
            nuevoPrecioBase,
            descuentoClientePct
          );

          const nuevoMontoNetoEstimado = calcularMontoNetoEstimado(
            nuevoMontoBruto,
            periodo.descuento_off_pct_aplicado,
            periodo.reintegro_pct_aplicado
          );

          await DebitosAutomaticosPeriodosModel.update(
            {
              monto_inicial_cliente_aplicado: roundMoney(nuevoPrecioBase),
              descuento_cliente_pct_aplicado: roundMoney(descuentoClientePct),
              monto_bruto: nuevoMontoBruto,
              monto_neto_estimado: nuevoMontoNetoEstimado,
              updated_by: actorUserId
            },
            {
              where: { id: periodo.id },
              transaction: t
            }
          );

          periodosActualizados += 1;
        }
      }

      await t.commit();

      return res.json({
        message:
          'Actualización de precio aplicada correctamente sobre clientes seleccionados y períodos futuros.',
        resumen: {
          plan_sede_id: planSede.id,
          plan_id: planSede.plan_id,
          sede_id: planSede.sede_id,
          aplicar_desde_anio: aplicarDesdeAnio,
          aplicar_desde_mes: aplicarDesdeMes,
          clientes_seleccionados: clientesIds.length,
          clientes_actualizados: clientesActualizados,
          periodos_actualizados: periodosActualizados
        }
      });
    } catch (error) {
      await t.rollback();
      return res.status(500).json({
        mensajeError: error.message
      });
    }
  };