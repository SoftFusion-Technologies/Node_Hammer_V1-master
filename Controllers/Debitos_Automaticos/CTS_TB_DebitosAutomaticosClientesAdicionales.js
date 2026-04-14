import { Op } from 'sequelize';

import DebitosAutomaticosClientesAdicionalesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosClientesAdicionales.js';
import DebitosAutomaticosClientesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosClientes.js';
import DebitosAutomaticosPlanesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPlanes.js';

const MODALIDADES_PERMITIDAS_CON_ADICIONAL = ['AMBOS', 'SOLO_ADICIONAL'];
const MODALIDADES_CLIENTE = ['TITULAR_SOLO', 'AMBOS', 'SOLO_ADICIONAL'];

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const buildHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parsePositiveInt = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  return ['true', '1', 'si', 'sí', 'yes'].includes(normalized);
};

const sanitizeAdicional = (row) => {
  return typeof row?.toJSON === 'function' ? row.toJSON() : row;
};

const buildAdicionalWhere = (query = {}) => {
  const where = {};
  const andConditions = [];

  const q = String(query.q || '').trim();
  const clienteId = parsePositiveInt(query.cliente_id);
  const planId = parsePositiveInt(query.plan_id);

  if (q) {
    andConditions.push({
      [Op.or]: [
        { nombre: { [Op.like]: `%${q}%` } },
        { dni: { [Op.like]: `%${q}%` } }
      ]
    });
  }

  if (clienteId) where.cliente_id = clienteId;
  if (planId) where.plan_id = planId;

  if (andConditions.length) {
    where[Op.and] = andConditions;
  }

  return where;
};

const buildOrder = (query = {}) => {
  const orderBy = String(query.order_by || 'created_at').trim();
  const orderDirection =
    String(query.order_direction || 'DESC')
      .trim()
      .toUpperCase() === 'ASC'
      ? 'ASC'
      : 'DESC';

  const allowedFields = [
    'id',
    'nombre',
    'dni',
    'cliente_id',
    'plan_id',
    'created_at',
    'updated_at'
  ];

  return [
    [allowedFields.includes(orderBy) ? orderBy : 'created_at', orderDirection]
  ];
};

const buildIncludes = () => {
  // Benjamin Orellana - 27/03/2026 - Si los aliases reales no son 'cliente' y 'plan', adaptar estos as según tus relaciones Sequelize.
  return [
    {
      model: DebitosAutomaticosClientesModel,
      as: 'cliente',
      required: false
    },
    {
      model: DebitosAutomaticosPlanesModel,
      as: 'plan',
      required: false
    }
  ];
};

const getTransactionProvider = () => {
  return (
    DebitosAutomaticosClientesAdicionalesModel.sequelize ||
    DebitosAutomaticosClientesModel.sequelize ||
    DebitosAutomaticosPlanesModel.sequelize
  );
};

const validarClienteExistente = async (clienteId, transaction = null) => {
  const cliente = await DebitosAutomaticosClientesModel.findByPk(clienteId, {
    transaction
  });

  if (!cliente) {
    throw buildHttpError(
      400,
      `No existe un cliente de débito automático con id ${clienteId}.`
    );
  }

  return cliente;
};

const validarPlanExistente = async (planId, transaction = null) => {
  const plan = await DebitosAutomaticosPlanesModel.findByPk(planId, {
    transaction
  });

  if (!plan) {
    throw buildHttpError(400, `No existe un plan con id ${planId}.`);
  }

  return plan;
};

const validarModalidadClienteParaAdicional = (cliente) => {
  if (!MODALIDADES_CLIENTE.includes(cliente.modalidad_adhesion)) {
    throw buildHttpError(
      400,
      `La modalidad_adhesion actual del cliente "${cliente.modalidad_adhesion}" no es válida para esta operación.`
    );
  }

  if (
    !MODALIDADES_PERMITIDAS_CON_ADICIONAL.includes(cliente.modalidad_adhesion)
  ) {
    throw buildHttpError(
      400,
      `Solo se puede gestionar un adicional cuando modalidad_adhesion es AMBOS o SOLO_ADICIONAL.`
    );
  }
};

const buscarAdicionalPorClienteId = async (clienteId, transaction = null) => {
  return DebitosAutomaticosClientesAdicionalesModel.findOne({
    where: { cliente_id: clienteId },
    transaction
  });
};

export const OBRS_DebitosAutomaticosClientesAdicionales_CTS = async (
  req,
  res
) => {
  try {
    const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
    const limit = Math.min(
      parsePositiveInt(req.query.limit, DEFAULT_LIMIT),
      MAX_LIMIT
    );
    const offset = (page - 1) * limit;

    const where = buildAdicionalWhere(req.query);
    const order = buildOrder(req.query);

    // Benjamin Orellana - 27/03/2026 - Listado paginado de adicionales con filtros y relaciones.
    const { rows, count } =
      await DebitosAutomaticosClientesAdicionalesModel.findAndCountAll({
        where,
        include: buildIncludes(),
        order,
        limit,
        offset,
        distinct: true
      });

    return res.status(200).json({
      ok: true,
      rows: rows.map(sanitizeAdicional),
      total: Number(count || 0),
      page,
      limit
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al listar los adicionales de débitos automáticos.'
    });
  }
};

export const OBR_DebitosAutomaticosClientesAdicionales_CTS = async (
  req,
  res
) => {
  try {
    const id = parsePositiveInt(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        mensajeError: 'El id enviado no es válido.'
      });
    }

    // Benjamin Orellana - 27/03/2026 - Detalle por id del adicional.
    const adicional = await DebitosAutomaticosClientesAdicionalesModel.findByPk(
      id,
      {
        include: buildIncludes()
      }
    );

    if (!adicional) {
      return res.status(404).json({
        ok: false,
        mensajeError: 'Adicional de débito automático no encontrado.'
      });
    }

    return res.status(200).json({
      ok: true,
      row: sanitizeAdicional(adicional)
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al obtener el adicional de débito automático.'
    });
  }
};

export const OBR_DebitosAutomaticosClientesAdicionalPorCliente_CTS = async (
  req,
  res
) => {
  try {
    const clienteId =
      parsePositiveInt(req.params.cliente_id) ||
      parsePositiveInt(req.params.clienteId) ||
      parsePositiveInt(req.query.cliente_id);

    if (!clienteId) {
      return res.status(400).json({
        ok: false,
        mensajeError: 'cliente_id es obligatorio y debe ser válido.'
      });
    }

    // Benjamin Orellana - 27/03/2026 - Búsqueda del adicional asociado a un cliente específico.
    const adicional = await DebitosAutomaticosClientesAdicionalesModel.findOne({
      where: { cliente_id: clienteId },
      include: buildIncludes()
    });

    if (!adicional) {
      return res.status(404).json({
        ok: false,
        mensajeError: 'No existe adicional para el cliente indicado.'
      });
    }

    return res.status(200).json({
      ok: true,
      row: sanitizeAdicional(adicional)
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al obtener el adicional por cliente.'
    });
  }
};

export const CR_DebitosAutomaticosClientesAdicionales_CTS = async (
  req,
  res
) => {
  const sequelize = getTransactionProvider();
  const transaction = await sequelize.transaction();

  try {
    const clienteId = parsePositiveInt(req.body.cliente_id);
    const planId = parsePositiveInt(req.body.plan_id);
    const nombre = String(req.body.nombre || '').trim();
    const dni = String(req.body.dni || '').trim();

    if (!clienteId) {
      throw buildHttpError(
        400,
        'cliente_id es obligatorio y debe ser un entero positivo.'
      );
    }

    if (!planId) {
      throw buildHttpError(
        400,
        'plan_id es obligatorio y debe ser un entero positivo.'
      );
    }

    if (!nombre) {
      throw buildHttpError(400, 'nombre es obligatorio.');
    }

    if (!dni) {
      throw buildHttpError(400, 'dni es obligatorio.');
    }

    const cliente = await validarClienteExistente(clienteId, transaction);
    validarModalidadClienteParaAdicional(cliente);

    await validarPlanExistente(planId, transaction);

    const adicionalExistente = await buscarAdicionalPorClienteId(
      clienteId,
      transaction
    );
    if (adicionalExistente) {
      throw buildHttpError(
        400,
        `Ya existe un adicional cargado para el cliente ${clienteId}.`
      );
    }

    // Benjamin Orellana - 27/03/2026 - Alta de adicional validando cliente, plan y modalidad del adherido principal.
    const adicional = await DebitosAutomaticosClientesAdicionalesModel.create(
      {
        cliente_id: clienteId,
        nombre,
        dni,
        plan_id: planId
      },
      { transaction }
    );

    await transaction.commit();

    const row = await DebitosAutomaticosClientesAdicionalesModel.findByPk(
      adicional.id,
      {
        include: buildIncludes()
      }
    );

    return res.status(201).json({
      ok: true,
      row: sanitizeAdicional(row)
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al crear el adicional de débito automático.'
    });
  }
};

export const UR_DebitosAutomaticosClientesAdicionales_CTS = async (
  req,
  res
) => {
  try {
    const id = parsePositiveInt(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        mensajeError: 'El id enviado no es válido.'
      });
    }

    const adicional =
      await DebitosAutomaticosClientesAdicionalesModel.findByPk(id);

    if (!adicional) {
      return res.status(404).json({
        ok: false,
        mensajeError: 'Adicional de débito automático no encontrado.'
      });
    }

    const cliente = await validarClienteExistente(adicional.cliente_id);
    validarModalidadClienteParaAdicional(cliente);

    const payload = {};

    if (req.body.nombre !== undefined) {
      const nombre = String(req.body.nombre || '').trim();
      if (!nombre) {
        return res.status(400).json({
          ok: false,
          mensajeError: 'nombre no puede enviarse vacío.'
        });
      }
      payload.nombre = nombre;
    }

    if (req.body.dni !== undefined) {
      const dni = String(req.body.dni || '').trim();
      if (!dni) {
        return res.status(400).json({
          ok: false,
          mensajeError: 'dni no puede enviarse vacío.'
        });
      }
      payload.dni = dni;
    }

    if (req.body.plan_id !== undefined) {
      const planId = parsePositiveInt(req.body.plan_id);
      if (!planId) {
        return res.status(400).json({
          ok: false,
          mensajeError: 'plan_id debe ser un entero positivo.'
        });
      }

      await validarPlanExistente(planId);
      payload.plan_id = planId;
    }

    if (!Object.keys(payload).length) {
      return res.status(400).json({
        ok: false,
        mensajeError: 'No se enviaron campos válidos para actualizar.'
      });
    }

    // Benjamin Orellana - 27/03/2026 - Update controlado del adicional sin romper consistencia con el cliente.
    await adicional.update(payload);

    const row = await DebitosAutomaticosClientesAdicionalesModel.findByPk(id, {
      include: buildIncludes()
    });

    return res.status(200).json({
      ok: true,
      row: sanitizeAdicional(row)
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al actualizar el adicional de débito automático.'
    });
  }
};

export const ER_DebitosAutomaticosClientesAdicionales_CTS = async (
  req,
  res
) => {
  const sequelize = getTransactionProvider();
  const transaction = await sequelize.transaction();

  try {
    const id = parsePositiveInt(req.params.id);

    if (!id) {
      throw buildHttpError(400, 'El id enviado no es válido.');
    }

    const adicional = await DebitosAutomaticosClientesAdicionalesModel.findByPk(
      id,
      {
        transaction
      }
    );

    if (!adicional) {
      throw buildHttpError(
        404,
        'Adicional de débito automático no encontrado.'
      );
    }

    const cliente = await validarClienteExistente(
      adicional.cliente_id,
      transaction
    );

    if (!MODALIDADES_CLIENTE.includes(cliente.modalidad_adhesion)) {
      throw buildHttpError(
        400,
        `La modalidad_adhesion actual del cliente "${cliente.modalidad_adhesion}" no es válida para esta operación.`
      );
    }

    if (cliente.modalidad_adhesion === 'SOLO_ADICIONAL') {
      throw buildHttpError(
        400,
        'No se puede eliminar el adicional mientras el cliente tenga modalidad_adhesion SOLO_ADICIONAL. Debe corregirse la modalidad del cliente antes de eliminar.'
      );
    }

    if (cliente.modalidad_adhesion === 'TITULAR_SOLO') {
      throw buildHttpError(
        400,
        'El cliente ya se encuentra en modalidad TITULAR_SOLO. Revisá la consistencia antes de eliminar este adicional.'
      );
    }

    const pasarClienteATitularSolo =
      req.body?.pasar_cliente_a_titular_solo !== undefined
        ? parseBoolean(req.body.pasar_cliente_a_titular_solo, true)
        : true;

    if (cliente.modalidad_adhesion === 'AMBOS' && !pasarClienteATitularSolo) {
      throw buildHttpError(
        400,
        'Eliminar el adicional dejando modalidad_adhesion=AMBOS generaría inconsistencia. Enviá pasar_cliente_a_titular_solo=true o ajustá primero la modalidad del cliente.'
      );
    }

    // Benjamin Orellana - 27/03/2026 - Eliminación del adicional con ajuste opcional/automático de modalidad del cliente principal.
    await adicional.destroy({ transaction });

    if (cliente.modalidad_adhesion === 'AMBOS' && pasarClienteATitularSolo) {
      await cliente.update(
        {
          modalidad_adhesion: 'TITULAR_SOLO'
        },
        { transaction }
      );
    }

    await transaction.commit();

    return res.status(200).json({
      ok: true,
      message: 'Adicional eliminado correctamente.'
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al eliminar el adicional de débito automático.'
    });
  }
};
