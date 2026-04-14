import { Op } from 'sequelize';

// Benjamin Orellana - 27/03/2026 - Adaptar estas rutas si el nombre real de la carpeta/modelo difiere en tu proyecto.
import DebitosAutomaticosPeriodosModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPeriodos.js';
import DebitosAutomaticosClientesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosClientes.js';
import DebitosAutomaticosBancosModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosBancos.js';
import DebitosAutomaticosPlanesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPlanes.js';
import DebitosAutomaticosClientesAdicionalesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosClientesAdicionales.js';
// Benjamin Orellana - 2026/04/13 - Se centraliza seguridad de tarjeta del cliente relacionado al período.
import {
  hasDebitosFullAccess,
  resolveCardData,
  resolveCardPresentation
} from '../../Helpers/DebitosAutomaticos/cardSecurity.js';
// Benjamin Orellana - 2026/04/10 - Reutilizar exactamente el helper real de cifrado ya usado por el módulo para mantener consistencia del formato almacenado.

const ESTADOS_ENVIO_VALIDOS = ['PENDIENTE', 'ENVIADO', 'NO_ENVIADO'];
const ESTADOS_COBRO_VALIDOS = [
  'PENDIENTE',
  'COBRADO',
  'RECHAZADO',
  'PAGO_MANUAL',
  'BAJA'
];
const ACCIONES_VALIDAS = [
  'NINGUNA',
  'CAMBIO_TARJETA',
  'COBRO_MANUAL',
  'BAJA',
  'REINTENTO'
];
const MOTIVOS_VALIDOS = [
  'MAL_NUMERO_TARJETA',
  'TIPO_TARJETA_ERRONEO',
  'TARJETA_DEBITO',
  'SIN_MARGEN',
  'INHABILITADA',
  'OTRO'
];
const ESTADOS_CLIENTE_ELEGIBLES_GENERACION = ['PENDIENTE_INICIO', 'ACTIVO'];

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const buildHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getTransactionProvider = () => {
  return (
    DebitosAutomaticosPeriodosModel.sequelize ||
    DebitosAutomaticosClientesModel.sequelize ||
    DebitosAutomaticosBancosModel.sequelize ||
    DebitosAutomaticosPlanesModel.sequelize
  );
};

const parsePositiveInt = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseNonNegativeNumber = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  return ['true', '1', 'si', 'sí', 'yes'].includes(normalized);
};

const pad2 = (value) => String(value).padStart(2, '0');

const formatDateOnly = (date) => {
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  return `${year}-${month}-${day}`;
};

const isValidDateInput = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const normalizeDateBoundary = (value, endOfDay = false) => {
  if (!value) return null;

  if (!isValidDateInput(value)) {
    throw buildHttpError(400, `La fecha "${value}" no es válida.`);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) {
    return `${String(value).trim()} ${endOfDay ? '23:59:59' : '00:00:00'}`;
  }

  return value;
};

/* Benjamin Orellana - 2026/04/10 - Normaliza el número de tarjeta dejando solo dígitos. */
const normalizeCardDigits = (value = '') => String(value).replace(/\D/g, '');

/* Benjamin Orellana - 2026/04/10 - Construye una máscara visual estándar a partir de los últimos 4 dígitos. */
const buildCardMask = (last4 = '') =>
  `**** **** **** ${String(last4 || '').slice(-4)}`;

const roundMoney = (value) => {
  const number = Number(value || 0);
  return Number(number.toFixed(2));
};

const validarEnum = (value, allowed, fieldName, { allowNull = false } = {}) => {
  if (value === undefined) return undefined;
  if ((value === null || value === '') && allowNull) return null;

  const normalized = String(value).trim().toUpperCase();

  if (!allowed.includes(normalized)) {
    throw buildHttpError(
      400,
      `${fieldName} debe ser uno de estos valores: ${allowed.join(', ')}.`
    );
  }

  return normalized;
};

const validarMes = (mes) => {
  const parsedMes = parsePositiveInt(mes);
  if (!parsedMes || parsedMes < 1 || parsedMes > 12) {
    throw buildHttpError(400, 'periodo_mes debe estar entre 1 y 12.');
  }
  return parsedMes;
};

const normalizarPeriodo = (anioInput, mesInput) => {
  const periodoAnio = parsePositiveInt(anioInput);
  const periodoMes = validarMes(mesInput);

  if (!periodoAnio || periodoAnio < 2000 || periodoAnio > 2100) {
    throw buildHttpError(400, 'periodo_anio no es válido.');
  }

  const monthStartDate = new Date(Date.UTC(periodoAnio, periodoMes - 1, 1));
  const monthEndDate = new Date(Date.UTC(periodoAnio, periodoMes, 0));

  return {
    periodoAnio,
    periodoMes,
    monthStart: formatDateOnly(monthStartDate),
    monthEnd: formatDateOnly(monthEndDate),
    monthKey: `${periodoAnio}-${pad2(periodoMes)}`
  };
};

const monthIndex = (anio, mes) => anio * 12 + mes;

const getMonthPositionFromStart = (
  fechaInicioCobro,
  periodoAnio,
  periodoMes
) => {
  if (!fechaInicioCobro) return null;

  const date = new Date(
    String(fechaInicioCobro).length <= 10
      ? `${String(fechaInicioCobro).slice(0, 10)}T00:00:00Z`
      : fechaInicioCobro
  );

  if (Number.isNaN(date.getTime())) return null;

  const inicioAnio = date.getUTCFullYear();
  const inicioMes = date.getUTCMonth() + 1;

  return (
    monthIndex(periodoAnio, periodoMes) - monthIndex(inicioAnio, inicioMes) + 1
  );
};

const calcularReintegroAplicadoDesdeCliente = (
  cliente,
  periodoAnio,
  periodoMes
) => {
  const pct = Number(cliente?.beneficio_reintegro_pct_snapshot || 0);
  const desdeMes = Number(cliente?.beneficio_reintegro_desde_mes_snapshot || 0);
  const duracion = Number(
    cliente?.beneficio_reintegro_duracion_meses_snapshot || 0
  );

  if (!pct || !desdeMes || !cliente?.fecha_inicio_cobro) return 0;

  const posicion = getMonthPositionFromStart(
    cliente.fecha_inicio_cobro,
    periodoAnio,
    periodoMes
  );

  if (!posicion || posicion < desdeMes) return 0;

  if (duracion > 0 && posicion > desdeMes + duracion - 1) return 0;

  return roundMoney(pct);
};

const calcularMontoNeto = (
  montoBruto,
  descuentoOffPctAplicado = 0,
  reintegroPctAplicado = 0
) => {
  const bruto = Number(montoBruto || 0);
  const descuento = Number(descuentoOffPctAplicado || 0);
  const reintegro = Number(reintegroPctAplicado || 0);

  if (!Number.isFinite(bruto) || bruto < 0) {
    throw buildHttpError(
      400,
      'monto_bruto debe ser un número mayor o igual a 0.'
    );
  }

  if (!Number.isFinite(descuento) || descuento < 0 || descuento > 100) {
    throw buildHttpError(
      400,
      'descuento_off_pct_aplicado debe estar entre 0 y 100.'
    );
  }

  if (!Number.isFinite(reintegro) || reintegro < 0 || reintegro > 100) {
    throw buildHttpError(
      400,
      'reintegro_pct_aplicado debe estar entre 0 y 100.'
    );
  }

  const montoConDescuento = bruto - bruto * (descuento / 100);
  const montoFinal = montoConDescuento - montoConDescuento * (reintegro / 100);

  return roundMoney(montoFinal);
};
// Benjamin Orellana - 10/04/2026 - Calcula el monto bruto del período a partir del snapshot comercial del cliente aplicado
const calcularMontoBrutoDesdeSnapshotCliente = (
  montoInicialClienteAplicado,
  descuentoClientePctAplicado = 0
) => {
  const montoInicial = Number(montoInicialClienteAplicado || 0);
  const descuentoPct = Number(descuentoClientePctAplicado || 0);

  if (!Number.isFinite(montoInicial) || montoInicial < 0) {
    throw buildHttpError(
      400,
      'monto_inicial_cliente_aplicado debe ser un número mayor o igual a 0.'
    );
  }

  if (
    !Number.isFinite(descuentoPct) ||
    descuentoPct < 0 ||
    descuentoPct > 100
  ) {
    throw buildHttpError(
      400,
      'descuento_cliente_pct_aplicado debe estar entre 0 y 100.'
    );
  }

  const montoBruto = montoInicial - montoInicial * (descuentoPct / 100);
  return roundMoney(montoBruto);
};

// Benjamin Orellana - 2026/04/13 - Incluye tarjeta_numero_cifrado solo cuando el request puede ver tarjeta completa.
const buildPeriodoClienteAttributes = ({ includeEncrypted = false } = {}) => {
  if (includeEncrypted) {
    return {
      exclude: []
    };
  }

  return {
    exclude: ['tarjeta_numero_cifrado']
  };
};

// Benjamin Orellana - 2026/04/13 - Sanitiza el período y resuelve la tarjeta del cliente relacionado sin exponer jamás el cifrado.
const sanitizePeriodo = (
  periodo,
  { includeFullCard = false, req = null } = {}
) => {
  const row =
    typeof periodo?.toJSON === 'function' ? periodo.toJSON() : periodo;

  if (row?.cliente) {
    const cardData = resolveCardPresentation({
      req,
      cliente: row.cliente,
      forceFullAccess: includeFullCard
    });

    delete row.cliente.tarjeta_numero_cifrado;

    row.cliente.tarjeta_mascara = cardData.tarjeta_mascara || null;
    row.cliente.tarjeta_ultimos4 = cardData.tarjeta_ultimos4 || null;

    if (cardData.tarjeta_numero_completo) {
      row.cliente.tarjeta_numero_completo = cardData.tarjeta_numero_completo;
    } else {
      delete row.cliente.tarjeta_numero_completo;
    }
  }

  return row;
};

// Benjamin Orellana - 2026/04/13 - El include del cliente del período excluye cifrado salvo para correos habilitados.
const buildPeriodoIncludes = ({ includeEncrypted = false } = {}) => {
  return [
    {
      model: DebitosAutomaticosClientesModel,
      as: 'cliente',
      required: false,
      attributes: buildPeriodoClienteAttributes({
        includeEncrypted
      }),
      include: [
        {
          model: DebitosAutomaticosBancosModel,
          as: 'banco',
          required: false
        },
        {
          model: DebitosAutomaticosPlanesModel,
          as: 'plan_titular',
          required: false
        },
        {
          model: DebitosAutomaticosClientesAdicionalesModel,
          as: 'adicional',
          required: false
        }
      ]
    }
  ];
};

const buildWhere = (query = {}) => {
  const where = {};
  const andConditions = [];

  const clienteId = parsePositiveInt(query.cliente_id);
  const periodoAnio = parsePositiveInt(query.periodo_anio);
  const periodoMes =
    query.periodo_mes !== undefined ? validarMes(query.periodo_mes) : null;
  const bancoId = parsePositiveInt(query.banco_id);
  const planId = parsePositiveInt(query.plan_id);
  const sedeId = parsePositiveInt(query.sede_id);
  const q = String(query.q || '').trim();

  if (clienteId) where.cliente_id = clienteId;
  if (periodoAnio) where.periodo_anio = periodoAnio;
  if (periodoMes) where.periodo_mes = periodoMes;

  if (query.estado_envio !== undefined && query.estado_envio !== '') {
    where.estado_envio = validarEnum(
      query.estado_envio,
      ESTADOS_ENVIO_VALIDOS,
      'estado_envio'
    );
  }

  if (query.estado_cobro !== undefined && query.estado_cobro !== '') {
    where.estado_cobro = validarEnum(
      query.estado_cobro,
      ESTADOS_COBRO_VALIDOS,
      'estado_cobro'
    );
  }

  if (query.accion_requerida !== undefined && query.accion_requerida !== '') {
    where.accion_requerida = validarEnum(
      query.accion_requerida,
      ACCIONES_VALIDAS,
      'accion_requerida'
    );
  }

  if (bancoId) {
    andConditions.push({ '$cliente.banco_id$': bancoId });
  }

  if (planId) {
    andConditions.push({ '$cliente.titular_plan_id$': planId });
  }

  if (sedeId) {
    andConditions.push({ '$cliente.sede_id$': sedeId });
  }

  if (q) {
    andConditions.push({
      [Op.or]: [
        { '$cliente.titular_nombre$': { [Op.like]: `%${q}%` } },
        { '$cliente.titular_dni$': { [Op.like]: `%${q}%` } }
      ]
    });
  }

  if (andConditions.length) {
    where[Op.and] = andConditions;
  }

  return where;
};
// Benjamin Orellana - 2026/04/14 - Permite ordenar períodos por campos propios y por datos del cliente relacionado para paginación real en backend.
const buildOrder = (query = {}) => {
  const orderBy = String(query.order_by || 'created_at').trim();
  const orderDirection =
    String(query.order_direction || 'DESC')
      .trim()
      .toUpperCase() === 'ASC'
      ? 'ASC'
      : 'DESC';

  const directFieldMap = {
    id: 'id',
    periodo_anio: 'periodo_anio',
    periodo_mes: 'periodo_mes',
    estado_envio: 'estado_envio',
    estado_cobro: 'estado_cobro',
    accion_requerida: 'accion_requerida',
    fecha_envio: 'fecha_envio',
    fecha_resultado: 'fecha_resultado',
    monto_inicial_cliente_aplicado: 'monto_inicial_cliente_aplicado',
    descuento_cliente_pct_aplicado: 'descuento_cliente_pct_aplicado',
    monto_bruto: 'monto_bruto',
    monto_neto_estimado: 'monto_neto_estimado',
    monto: 'monto_neto_estimado',
    created_at: 'created_at',
    updated_at: 'updated_at'
  };

  const clienteFieldMap = {
    titular_nombre: 'titular_nombre',
    titular_dni: 'titular_dni',
    alta: 'created_at'
  };

  if (clienteFieldMap[orderBy]) {
    return [
      [
        { model: DebitosAutomaticosClientesModel, as: 'cliente' },
        clienteFieldMap[orderBy],
        orderDirection
      ],
      ['id', 'DESC']
    ];
  }

  const resolvedField = directFieldMap[orderBy] || 'created_at';

  return [
    [resolvedField, orderDirection],
    ['id', 'DESC']
  ];
};

const appendObservacion = (actual = '', nueva = '', prefijo = '') => {
  const base = String(actual || '').trim();
  const extra = String(nueva || '').trim();

  if (!extra) return base;

  const bloque = prefijo ? `[${prefijo}] ${extra}` : extra;
  return base ? `${base}\n${bloque}` : bloque;
};

const validateArchivoBancoId = (archivoBancoId) => {
  if (archivoBancoId === undefined) return undefined;
  if (archivoBancoId === null || archivoBancoId === '') return null;

  const parsed = parsePositiveInt(archivoBancoId);
  if (!parsed) {
    throw buildHttpError(400, 'archivo_banco_id debe ser un entero positivo.');
  }

  return parsed;
};

const findClienteById = async (clienteId, transaction = null) => {
  const cliente = await DebitosAutomaticosClientesModel.findByPk(clienteId, {
    transaction,
    include: [
      {
        model: DebitosAutomaticosBancosModel,
        as: 'banco',
        required: false
      },
      {
        model: DebitosAutomaticosPlanesModel,
        as: 'plan_titular',
        required: false
      },
      {
        model: DebitosAutomaticosClientesAdicionalesModel,
        as: 'adicional',
        required: false
      }
    ]
  });

  if (!cliente) {
    throw buildHttpError(400, `No existe un cliente con id ${clienteId}.`);
  }

  return cliente;
};

const findPeriodoDuplicado = async (
  clienteId,
  periodoAnio,
  periodoMes,
  transaction = null
) => {
  return DebitosAutomaticosPeriodosModel.findOne({
    where: {
      cliente_id: clienteId,
      periodo_anio: periodoAnio,
      periodo_mes: periodoMes
    },
    transaction
  });
};

// Benjamin Orellana - 10/04/2026 - Construye el período tomando snapshot comercial completo del cliente y recalculando monto bruto y neto
const construirPayloadPeriodo = ({
  cliente,
  body = {},
  periodoAnio,
  periodoMes,
  defaultEstadoEnvio = 'PENDIENTE',
  defaultEstadoCobro = 'PENDIENTE',
  defaultAccionRequerida = 'NINGUNA'
}) => {
  const montoInicialClienteAplicado =
    body.monto_inicial_cliente_aplicado !== undefined &&
    body.monto_inicial_cliente_aplicado !== null &&
    body.monto_inicial_cliente_aplicado !== ''
      ? parseNonNegativeNumber(body.monto_inicial_cliente_aplicado)
      : parseNonNegativeNumber(cliente?.monto_inicial_vigente, null);

  if (
    body.monto_inicial_cliente_aplicado !== undefined &&
    body.monto_inicial_cliente_aplicado !== '' &&
    montoInicialClienteAplicado === null
  ) {
    throw buildHttpError(
      400,
      'monto_inicial_cliente_aplicado debe ser un número mayor o igual a 0.'
    );
  }

  const descuentoClientePctAplicado =
    body.descuento_cliente_pct_aplicado !== undefined &&
    body.descuento_cliente_pct_aplicado !== null &&
    body.descuento_cliente_pct_aplicado !== ''
      ? Number(body.descuento_cliente_pct_aplicado)
      : Number(cliente?.descuento_vigente || 0);

  if (
    !Number.isFinite(descuentoClientePctAplicado) ||
    descuentoClientePctAplicado < 0 ||
    descuentoClientePctAplicado > 100
  ) {
    throw buildHttpError(
      400,
      'descuento_cliente_pct_aplicado debe estar entre 0 y 100.'
    );
  }

  let montoBruto = null;

  if (
    body.monto_bruto !== undefined &&
    body.monto_bruto !== null &&
    body.monto_bruto !== ''
  ) {
    montoBruto = parseNonNegativeNumber(body.monto_bruto);

    if (montoBruto === null) {
      throw buildHttpError(
        400,
        'monto_bruto debe ser un número mayor o igual a 0.'
      );
    }
  } else if (
    montoInicialClienteAplicado !== null &&
    montoInicialClienteAplicado !== undefined
  ) {
    montoBruto = calcularMontoBrutoDesdeSnapshotCliente(
      montoInicialClienteAplicado,
      descuentoClientePctAplicado
    );
  } else {
    montoBruto = parseNonNegativeNumber(cliente?.monto_base_vigente, 0);
  }

  if (montoBruto === null) {
    throw buildHttpError(
      400,
      'No se pudo determinar monto_bruto. Enviarlo manualmente o revisar la estructura comercial del cliente.'
    );
  }

  const descuentoOffPctAplicado =
    body.descuento_off_pct_aplicado !== undefined &&
    body.descuento_off_pct_aplicado !== null &&
    body.descuento_off_pct_aplicado !== ''
      ? Number(body.descuento_off_pct_aplicado)
      : Number(cliente?.beneficio_descuento_off_pct_snapshot || 0);

  const reintegroPctAplicado =
    body.reintegro_pct_aplicado !== undefined &&
    body.reintegro_pct_aplicado !== null &&
    body.reintegro_pct_aplicado !== ''
      ? Number(body.reintegro_pct_aplicado)
      : calcularReintegroAplicadoDesdeCliente(cliente, periodoAnio, periodoMes);

  const montoNetoEstimado =
    body.monto_neto_estimado !== undefined &&
    body.monto_neto_estimado !== null &&
    body.monto_neto_estimado !== ''
      ? parseNonNegativeNumber(body.monto_neto_estimado)
      : calcularMontoNeto(
          montoBruto,
          descuentoOffPctAplicado,
          reintegroPctAplicado
        );

  if (montoNetoEstimado === null) {
    throw buildHttpError(
      400,
      'monto_neto_estimado debe ser un número mayor o igual a 0.'
    );
  }

  const estadoEnvio = body.estado_envio
    ? validarEnum(body.estado_envio, ESTADOS_ENVIO_VALIDOS, 'estado_envio')
    : defaultEstadoEnvio;

  const estadoCobro = body.estado_cobro
    ? validarEnum(body.estado_cobro, ESTADOS_COBRO_VALIDOS, 'estado_cobro')
    : defaultEstadoCobro;

  const accionRequerida = body.accion_requerida
    ? validarEnum(body.accion_requerida, ACCIONES_VALIDAS, 'accion_requerida')
    : defaultAccionRequerida;

  if (['COBRADO', 'PAGO_MANUAL', 'BAJA'].includes(estadoCobro)) {
    throw buildHttpError(
      400,
      'Para crear un período con estado final usá los endpoints específicos de aprobación, baja o pago manual.'
    );
  }

  const motivoCodigo =
    body.motivo_codigo !== undefined
      ? validarEnum(body.motivo_codigo, MOTIVOS_VALIDOS, 'motivo_codigo', {
          allowNull: true
        })
      : null;

  const motivoDetalle =
    body.motivo_detalle !== undefined && body.motivo_detalle !== null
      ? String(body.motivo_detalle).trim()
      : null;

  if (motivoCodigo === 'OTRO' && !motivoDetalle) {
    throw buildHttpError(
      400,
      'motivo_detalle es obligatorio cuando motivo_codigo es OTRO.'
    );
  }

  return {
    cliente_id: cliente.id,
    periodo_anio: periodoAnio,
    periodo_mes: periodoMes,
    estado_envio: estadoEnvio,
    estado_cobro: estadoCobro,
    accion_requerida: accionRequerida,
    motivo_codigo: motivoCodigo,
    motivo_detalle: motivoDetalle,
    monto_inicial_cliente_aplicado:
      montoInicialClienteAplicado !== null
        ? roundMoney(montoInicialClienteAplicado)
        : null,
    descuento_cliente_pct_aplicado: roundMoney(descuentoClientePctAplicado),
    monto_bruto: roundMoney(montoBruto),
    descuento_off_pct_aplicado: roundMoney(descuentoOffPctAplicado),
    reintegro_pct_aplicado: roundMoney(reintegroPctAplicado),
    monto_neto_estimado: roundMoney(montoNetoEstimado),
    fecha_envio:
      body.fecha_envio !== undefined &&
      body.fecha_envio !== null &&
      body.fecha_envio !== ''
        ? normalizeDateBoundary(body.fecha_envio, false)
        : null,
    fecha_resultado:
      body.fecha_resultado !== undefined &&
      body.fecha_resultado !== null &&
      body.fecha_resultado !== ''
        ? normalizeDateBoundary(body.fecha_resultado, false)
        : null,
    archivo_banco_id: validateArchivoBancoId(body.archivo_banco_id),
    observaciones:
      body.observaciones !== undefined && body.observaciones !== null
        ? String(body.observaciones)
        : null,
    creado_por:
      body.creado_por !== undefined ? parsePositiveInt(body.creado_por) : null,
    updated_by:
      body.updated_by !== undefined ? parsePositiveInt(body.updated_by) : null
  };
};

export const OBRS_DebitosAutomaticosPeriodos_CTS = async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
    const limit = Math.min(
      parsePositiveInt(req.query.limit, DEFAULT_LIMIT),
      MAX_LIMIT
    );
    const offset = (page - 1) * limit;

    const where = buildWhere(req.query);
    const order = buildOrder(req.query);

    // Benjamin Orellana - 2026/04/13 - El listado de períodos permite tarjeta completa solo para correos privilegiados del módulo.
    const includeFullCard = hasDebitosFullAccess(req);

    const { rows, count } =
      await DebitosAutomaticosPeriodosModel.findAndCountAll({
        where,
        include: buildPeriodoIncludes({
          includeEncrypted: includeFullCard
        }),
        order,
        limit,
        offset,
        distinct: true,
        subQuery: false
      });

    return res.status(200).json({
      ok: true,
      rows: rows.map((item) =>
        sanitizePeriodo(item, {
          includeFullCard,
          req
        })
      ),
      total: Number(count || 0),
      page,
      limit
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al listar los períodos de débitos automáticos.'
    });
  }
};

export const OBR_DebitosAutomaticosPeriodos_CTS = async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        mensajeError: 'El id enviado no es válido.'
      });
    }

    // Benjamin Orellana - 2026/04/13 - El detalle del período también resuelve tarjeta completa solo para correos habilitados.
    const includeFullCard = hasDebitosFullAccess(req);

    const row = await DebitosAutomaticosPeriodosModel.findByPk(id, {
      include: buildPeriodoIncludes({
        includeEncrypted: includeFullCard
      })
    });

    if (!row) {
      return res.status(404).json({
        ok: false,
        mensajeError: 'Período de débito automático no encontrado.'
      });
    }

    return res.status(200).json({
      ok: true,
      row: sanitizePeriodo(row, {
        includeFullCard,
        req
      })
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al obtener el período de débito automático.'
    });
  }
};

export const CR_DebitosAutomaticosPeriodos_CTS = async (req, res) => {
  try {
    const clienteId = parsePositiveInt(req.body.cliente_id);
    const { periodoAnio, periodoMes } = normalizarPeriodo(
      req.body.periodo_anio,
      req.body.periodo_mes
    );

    if (!clienteId) {
      return res.status(400).json({
        ok: false,
        mensajeError: 'cliente_id es obligatorio y debe ser un entero positivo.'
      });
    }

    const cliente = await findClienteById(clienteId);

    const periodoExistente = await findPeriodoDuplicado(
      clienteId,
      periodoAnio,
      periodoMes
    );

    if (periodoExistente) {
      return res.status(400).json({
        ok: false,
        mensajeError:
          'Ya existe un período para ese cliente en el mes y año indicados.'
      });
    }

    const payload = construirPayloadPeriodo({
      cliente,
      body: req.body,
      periodoAnio,
      periodoMes
    });

    // Benjamin Orellana - 27/03/2026 - Alta manual individual del período mensual con cálculo de montos y snapshots del cliente.
    const created = await DebitosAutomaticosPeriodosModel.create(payload);

    // Benjamin Orellana - 2026/04/13 - La respuesta de alta manual del período respeta permiso de tarjeta completa.
    const includeFullCard = hasDebitosFullAccess(req);

    const row = await DebitosAutomaticosPeriodosModel.findByPk(created.id, {
      include: buildPeriodoIncludes({
        includeEncrypted: includeFullCard
      })
    });

    return res.status(201).json({
      ok: true,
      row: sanitizePeriodo(row, {
        includeFullCard,
        req
      })
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al crear el período de débito automático.'
    });
  }
};

export const CR_DebitosAutomaticosPeriodosGenerarMes_CTS = async (req, res) => {
  const sequelize = getTransactionProvider();
  const transaction = await sequelize.transaction();

  try {
    const { periodoAnio, periodoMes, monthEnd } = normalizarPeriodo(
      req.body.periodo_anio,
      req.body.periodo_mes
    );

    const sedeId = parsePositiveInt(req.body.sede_id);
    const bancoId = parsePositiveInt(req.body.banco_id);
    const planId = parsePositiveInt(req.body.plan_id);
    const creadoPor =
      req.body.creado_por !== undefined
        ? parsePositiveInt(req.body.creado_por)
        : null;
    const updatedBy =
      req.body.updated_by !== undefined
        ? parsePositiveInt(req.body.updated_by)
        : null;

    /* Benjamin Orellana - 2026/04/10 - Excluye de la generación mensual a clientes dados de baja, incluso si quedó un estado inconsistente pero ya tienen fecha_baja cargada. */
    const clienteWhere = {
      estado_general: {
        [Op.in]: ESTADOS_CLIENTE_ELEGIBLES_GENERACION
      },
      fecha_inicio_cobro: {
        [Op.ne]: null,
        [Op.lte]: monthEnd
      },
      [Op.or]: [
        { fecha_baja: { [Op.is]: null } },
        { fecha_baja: { [Op.gt]: monthEnd } }
      ]
    };

    if (sedeId) clienteWhere.sede_id = sedeId;
    if (bancoId) clienteWhere.banco_id = bancoId;
    if (planId) clienteWhere.titular_plan_id = planId;

    // Benjamin Orellana - 27/03/2026 - Generación masiva del mes para clientes elegibles según estado y fecha de inicio.
    const clientes = await DebitosAutomaticosClientesModel.findAll({
      where: clienteWhere,
      transaction
    });

    if (!clientes.length) {
      await transaction.commit();

      return res.status(200).json({
        ok: true,
        resumen: {
          creados: 0,
          omitidos: 0,
          errores: 0
        },
        detalle: {
          creados: [],
          omitidos: [],
          errores: []
        }
      });
    }

    const clienteIds = clientes.map((item) => item.id);

    const existentes = await DebitosAutomaticosPeriodosModel.findAll({
      attributes: ['id', 'cliente_id'],
      where: {
        cliente_id: { [Op.in]: clienteIds },
        periodo_anio: periodoAnio,
        periodo_mes: periodoMes
      },
      transaction
    });

    const existentesMap = new Map(
      existentes.map((item) => [Number(item.cliente_id), Number(item.id)])
    );

    const paraCrear = [];
    const omitidos = [];
    const errores = [];

    for (const cliente of clientes) {
      if (existentesMap.has(Number(cliente.id))) {
        omitidos.push({
          cliente_id: cliente.id,
          titular_nombre: cliente.titular_nombre,
          motivo: 'Ya existe período para ese cliente en el mes indicado.'
        });
        continue;
      }

      try {
        const payload = construirPayloadPeriodo({
          cliente,
          body: {
            creado_por: creadoPor,
            updated_by: updatedBy
          },
          periodoAnio,
          periodoMes,
          defaultEstadoEnvio: 'PENDIENTE',
          defaultEstadoCobro: 'PENDIENTE',
          defaultAccionRequerida: 'NINGUNA'
        });

        paraCrear.push(payload);
      } catch (error) {
        errores.push({
          cliente_id: cliente.id,
          titular_nombre: cliente.titular_nombre,
          mensajeError:
            error?.message ||
            'No se pudo preparar el período para este cliente.'
        });
      }
    }

    let createdRows = [];

    if (paraCrear.length) {
      await DebitosAutomaticosPeriodosModel.bulkCreate(paraCrear, {
        transaction
      });

      createdRows = await DebitosAutomaticosPeriodosModel.findAll({
        where: {
          cliente_id: {
            [Op.in]: paraCrear.map((item) => item.cliente_id)
          },
          periodo_anio: periodoAnio,
          periodo_mes: periodoMes
        },
        transaction
      });
    }

    await transaction.commit();

    return res.status(201).json({
      ok: true,
      resumen: {
        creados: createdRows.length,
        omitidos: omitidos.length,
        errores: errores.length
      },
      detalle: {
        creados: createdRows.map((item) => ({
          id: item.id,
          cliente_id: item.cliente_id,
          periodo_anio: item.periodo_anio,
          periodo_mes: item.periodo_mes
        })),
        omitidos,
        errores
      }
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al generar masivamente los períodos del mes.'
    });
  }
};

export const UR_DebitosAutomaticosPeriodos_CTS = async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        mensajeError: 'El id enviado no es válido.'
      });
    }

    const periodo = await DebitosAutomaticosPeriodosModel.findByPk(id);

    if (!periodo) {
      return res.status(404).json({
        ok: false,
        mensajeError: 'Período de débito automático no encontrado.'
      });
    }

    if (req.body.cliente_id !== undefined) {
      return res.status(400).json({
        ok: false,
        mensajeError: 'No se permite editar cliente_id desde este endpoint.'
      });
    }

    if (
      req.body.periodo_anio !== undefined ||
      req.body.periodo_mes !== undefined
    ) {
      return res.status(400).json({
        ok: false,
        mensajeError:
          'No se permite editar periodo_anio o periodo_mes desde este endpoint.'
      });
    }

    if (
      req.body.estado_cobro !== undefined ||
      req.body.accion_requerida !== undefined
    ) {
      return res.status(400).json({
        ok: false,
        mensajeError:
          'Para cambiar estado_cobro o accion_requerida usá los endpoints específicos del negocio mensual.'
      });
    }

    const payload = {};

    if (req.body.estado_envio !== undefined) {
      payload.estado_envio = validarEnum(
        req.body.estado_envio,
        ESTADOS_ENVIO_VALIDOS,
        'estado_envio'
      );
    }

    if (req.body.motivo_codigo !== undefined) {
      payload.motivo_codigo = validarEnum(
        req.body.motivo_codigo,
        MOTIVOS_VALIDOS,
        'motivo_codigo',
        { allowNull: true }
      );
    }

    if (req.body.motivo_detalle !== undefined) {
      payload.motivo_detalle =
        req.body.motivo_detalle === null
          ? null
          : String(req.body.motivo_detalle).trim();
    }

    if (payload.motivo_codigo === 'OTRO' && !payload.motivo_detalle) {
      return res.status(400).json({
        ok: false,
        mensajeError:
          'motivo_detalle es obligatorio cuando motivo_codigo es OTRO.'
      });
    }

    // Benjamin Orellana - 10/04/2026 - Se permite editar el snapshot comercial aplicado del período
    if (req.body.monto_inicial_cliente_aplicado !== undefined) {
      const montoInicial = parseNonNegativeNumber(
        req.body.monto_inicial_cliente_aplicado
      );

      if (montoInicial === null) {
        return res.status(400).json({
          ok: false,
          mensajeError:
            'monto_inicial_cliente_aplicado debe ser un número mayor o igual a 0.'
        });
      }

      payload.monto_inicial_cliente_aplicado = roundMoney(montoInicial);
    }

    if (req.body.descuento_cliente_pct_aplicado !== undefined) {
      const descuentoCliente = Number(req.body.descuento_cliente_pct_aplicado);

      if (
        !Number.isFinite(descuentoCliente) ||
        descuentoCliente < 0 ||
        descuentoCliente > 100
      ) {
        return res.status(400).json({
          ok: false,
          mensajeError:
            'descuento_cliente_pct_aplicado debe estar entre 0 y 100.'
        });
      }

      payload.descuento_cliente_pct_aplicado = roundMoney(descuentoCliente);
    }

    if (req.body.monto_bruto !== undefined) {
      const montoBruto = parseNonNegativeNumber(req.body.monto_bruto);
      if (montoBruto === null) {
        return res.status(400).json({
          ok: false,
          mensajeError: 'monto_bruto debe ser un número mayor o igual a 0.'
        });
      }
      payload.monto_bruto = roundMoney(montoBruto);
    }

    if (req.body.descuento_off_pct_aplicado !== undefined) {
      const descuento = Number(req.body.descuento_off_pct_aplicado);
      if (!Number.isFinite(descuento) || descuento < 0 || descuento > 100) {
        return res.status(400).json({
          ok: false,
          mensajeError: 'descuento_off_pct_aplicado debe estar entre 0 y 100.'
        });
      }
      payload.descuento_off_pct_aplicado = roundMoney(descuento);
    }

    if (req.body.reintegro_pct_aplicado !== undefined) {
      const reintegro = Number(req.body.reintegro_pct_aplicado);
      if (!Number.isFinite(reintegro) || reintegro < 0 || reintegro > 100) {
        return res.status(400).json({
          ok: false,
          mensajeError: 'reintegro_pct_aplicado debe estar entre 0 y 100.'
        });
      }
      payload.reintegro_pct_aplicado = roundMoney(reintegro);
    }

    // Benjamin Orellana - 10/04/2026 - Si cambia el snapshot comercial del período, se recalcula el monto bruto antes del neto
    if (
      payload.monto_bruto === undefined &&
      (payload.monto_inicial_cliente_aplicado !== undefined ||
        payload.descuento_cliente_pct_aplicado !== undefined)
    ) {
      const montoInicialFinal =
        payload.monto_inicial_cliente_aplicado !== undefined
          ? payload.monto_inicial_cliente_aplicado
          : periodo.monto_inicial_cliente_aplicado;

      const descuentoClientePctFinal =
        payload.descuento_cliente_pct_aplicado !== undefined
          ? payload.descuento_cliente_pct_aplicado
          : periodo.descuento_cliente_pct_aplicado;

      if (
        montoInicialFinal === null ||
        montoInicialFinal === undefined ||
        montoInicialFinal === ''
      ) {
        return res.status(400).json({
          ok: false,
          mensajeError:
            'No se pudo recalcular monto_bruto porque falta monto_inicial_cliente_aplicado.'
        });
      }

      payload.monto_bruto = calcularMontoBrutoDesdeSnapshotCliente(
        montoInicialFinal,
        descuentoClientePctFinal
      );
    }

    if (req.body.monto_neto_estimado !== undefined) {
      const neto = parseNonNegativeNumber(req.body.monto_neto_estimado);
      if (neto === null) {
        return res.status(400).json({
          ok: false,
          mensajeError:
            'monto_neto_estimado debe ser un número mayor o igual a 0.'
        });
      }
      payload.monto_neto_estimado = roundMoney(neto);
    }

    if (
      payload.monto_neto_estimado === undefined &&
      (payload.monto_inicial_cliente_aplicado !== undefined ||
        payload.descuento_cliente_pct_aplicado !== undefined ||
        payload.monto_bruto !== undefined ||
        payload.descuento_off_pct_aplicado !== undefined ||
        payload.reintegro_pct_aplicado !== undefined)
    ) {
      payload.monto_neto_estimado = calcularMontoNeto(
        payload.monto_bruto !== undefined
          ? payload.monto_bruto
          : periodo.monto_bruto,
        payload.descuento_off_pct_aplicado !== undefined
          ? payload.descuento_off_pct_aplicado
          : periodo.descuento_off_pct_aplicado,
        payload.reintegro_pct_aplicado !== undefined
          ? payload.reintegro_pct_aplicado
          : periodo.reintegro_pct_aplicado
      );
    }

    if (req.body.fecha_envio !== undefined) {
      payload.fecha_envio =
        req.body.fecha_envio === null || req.body.fecha_envio === ''
          ? null
          : normalizeDateBoundary(req.body.fecha_envio, false);
    }

    if (req.body.fecha_resultado !== undefined) {
      payload.fecha_resultado =
        req.body.fecha_resultado === null || req.body.fecha_resultado === ''
          ? null
          : normalizeDateBoundary(req.body.fecha_resultado, false);
    }

    if (req.body.archivo_banco_id !== undefined) {
      payload.archivo_banco_id = validateArchivoBancoId(
        req.body.archivo_banco_id
      );
    }

    if (req.body.observaciones !== undefined) {
      payload.observaciones =
        req.body.observaciones === null ? null : String(req.body.observaciones);
    }

    if (req.body.updated_by !== undefined) {
      const updatedBy = parsePositiveInt(req.body.updated_by);
      if (!updatedBy) {
        return res.status(400).json({
          ok: false,
          mensajeError: 'updated_by debe ser un entero positivo.'
        });
      }
      payload.updated_by = updatedBy;
    }

    if (!Object.keys(payload).length) {
      return res.status(400).json({
        ok: false,
        mensajeError: 'No se enviaron campos válidos para actualizar.'
      });
    }

    // Benjamin Orellana - 27/03/2026 - Update administrativo controlado sin alterar el corazón del flujo mensual.
    // Benjamin Orellana - 10/04/2026 - Se amplía para soportar snapshot comercial del período y recálculo automático de bruto/neto
    await periodo.update(payload);

    // Benjamin Orellana - 2026/04/13 - La respuesta de actualización del período respeta permiso de tarjeta completa.
    const includeFullCard = hasDebitosFullAccess(req);

    const row = await DebitosAutomaticosPeriodosModel.findByPk(id, {
      include: buildPeriodoIncludes({
        includeEncrypted: includeFullCard
      })
    });

    return res.status(200).json({
      ok: true,
      row: sanitizePeriodo(row, {
        includeFullCard,
        req
      })
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al actualizar el período de débito automático.'
    });
  }
};

export const UR_DebitosAutomaticosPeriodosAprobar_CTS = async (req, res) => {
  const sequelize = getTransactionProvider();
  const transaction = await sequelize.transaction();

  try {
    const id = parsePositiveInt(req.params.id);

    if (!id) {
      throw buildHttpError(400, 'El id enviado no es válido.');
    }

    const periodo = await DebitosAutomaticosPeriodosModel.findByPk(id, {
      transaction
    });

    if (!periodo) {
      throw buildHttpError(404, 'Período de débito automático no encontrado.');
    }

    const cliente = await DebitosAutomaticosClientesModel.findByPk(
      periodo.cliente_id,
      {
        transaction
      }
    );

    if (!cliente) {
      throw buildHttpError(400, 'No existe el cliente asociado al período.');
    }

    const payloadPeriodo = {
      estado_cobro: 'COBRADO',
      accion_requerida: 'NINGUNA',
      fecha_resultado:
        req.body.fecha_resultado !== undefined &&
        req.body.fecha_resultado !== ''
          ? normalizeDateBoundary(req.body.fecha_resultado, false)
          : new Date(),
      motivo_codigo: null,
      motivo_detalle: null
    };

    if (req.body.estado_envio !== undefined) {
      payloadPeriodo.estado_envio = validarEnum(
        req.body.estado_envio,
        ESTADOS_ENVIO_VALIDOS,
        'estado_envio'
      );
    } else if (parseBoolean(req.body.marcar_enviado, false)) {
      payloadPeriodo.estado_envio = 'ENVIADO';
    }

    if (req.body.archivo_banco_id !== undefined) {
      payloadPeriodo.archivo_banco_id = validateArchivoBancoId(
        req.body.archivo_banco_id
      );
    }

    if (req.body.observaciones !== undefined) {
      payloadPeriodo.observaciones =
        req.body.observaciones === null ? null : String(req.body.observaciones);
    }

    if (req.body.updated_by !== undefined) {
      const updatedBy = parsePositiveInt(req.body.updated_by);
      if (!updatedBy) {
        throw buildHttpError(400, 'updated_by debe ser un entero positivo.');
      }
      payloadPeriodo.updated_by = updatedBy;
    }

    // Benjamin Orellana - 27/03/2026 - Aprobación del cobro mensual y activación automática del cliente si estaba pendiente de inicio.
    await periodo.update(payloadPeriodo, { transaction });

    if (cliente.estado_general === 'PENDIENTE_INICIO') {
      await cliente.update(
        {
          estado_general: 'ACTIVO',
          updated_by:
            req.body.updated_by !== undefined
              ? parsePositiveInt(req.body.updated_by)
              : cliente.updated_by
        },
        { transaction }
      );
    }

    await transaction.commit();

    // Benjamin Orellana - 2026/04/13 - La respuesta de aprobación del período respeta permiso de tarjeta completa.
    const includeFullCard = hasDebitosFullAccess(req);

    const row = await DebitosAutomaticosPeriodosModel.findByPk(id, {
      include: buildPeriodoIncludes({
        includeEncrypted: includeFullCard
      })
    });

    return res.status(200).json({
      ok: true,
      row: sanitizePeriodo(row, {
        includeFullCard,
        req
      })
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al aprobar el período de débito automático.'
    });
  }
};

export const UR_DebitosAutomaticosPeriodosMarcarBaja_CTS = async (req, res) => {
  const sequelize = getTransactionProvider();
  const transaction = await sequelize.transaction();

  try {
    const id = parsePositiveInt(req.params.id);
    const motivoDetalle = String(req.body.motivo_detalle || '').trim();

    if (!id) {
      throw buildHttpError(400, 'El id enviado no es válido.');
    }

    if (!motivoDetalle) {
      throw buildHttpError(
        400,
        'motivo_detalle es obligatorio para marcar el período como BAJA.'
      );
    }

    const periodo = await DebitosAutomaticosPeriodosModel.findByPk(id, {
      transaction
    });

    if (!periodo) {
      throw buildHttpError(404, 'Período de débito automático no encontrado.');
    }

    const cliente = await DebitosAutomaticosClientesModel.findByPk(
      periodo.cliente_id,
      {
        transaction
      }
    );

    if (!cliente) {
      throw buildHttpError(400, 'No existe el cliente asociado al período.');
    }

    const payloadPeriodo = {
      estado_cobro: 'BAJA',
      accion_requerida: 'BAJA',
      fecha_resultado:
        req.body.fecha_resultado !== undefined &&
        req.body.fecha_resultado !== ''
          ? normalizeDateBoundary(req.body.fecha_resultado, false)
          : new Date(),
      motivo_detalle: motivoDetalle
    };

    if (req.body.motivo_codigo !== undefined && req.body.motivo_codigo !== '') {
      payloadPeriodo.motivo_codigo = validarEnum(
        req.body.motivo_codigo,
        MOTIVOS_VALIDOS,
        'motivo_codigo'
      );
    }

    if (req.body.updated_by !== undefined) {
      const updatedBy = parsePositiveInt(req.body.updated_by);
      if (!updatedBy) {
        throw buildHttpError(400, 'updated_by debe ser un entero positivo.');
      }
      payloadPeriodo.updated_by = updatedBy;
    }

    if (req.body.observaciones !== undefined) {
      payloadPeriodo.observaciones =
        req.body.observaciones === null ? null : String(req.body.observaciones);
    }

    // Benjamin Orellana - 27/03/2026 - Baja del período con posibilidad de impactar el estado general del cliente.
    await periodo.update(payloadPeriodo, { transaction });

    const actualizarCliente = parseBoolean(req.body.actualizar_cliente, true);

    if (actualizarCliente) {
      const fechaBaja =
        req.body.fecha_baja !== undefined && req.body.fecha_baja !== ''
          ? normalizeDateBoundary(req.body.fecha_baja, false)
          : new Date();

      await cliente.update(
        {
          estado_general: 'BAJA',
          fecha_baja: fechaBaja,
          observaciones_internas: appendObservacion(
            cliente.observaciones_internas,
            motivoDetalle,
            'BAJA POR PERIODO'
          ),
          updated_by:
            req.body.updated_by !== undefined
              ? parsePositiveInt(req.body.updated_by)
              : cliente.updated_by
        },
        { transaction }
      );
    }

    await transaction.commit();

    // Benjamin Orellana - 2026/04/13 - La respuesta de baja del período respeta permiso de tarjeta completa.
    const includeFullCard = hasDebitosFullAccess(req);

    const row = await DebitosAutomaticosPeriodosModel.findByPk(id, {
      include: buildPeriodoIncludes({
        includeEncrypted: includeFullCard
      })
    });

    return res.status(200).json({
      ok: true,
      row: sanitizePeriodo(row, {
        includeFullCard,
        req
      })
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message || 'Ocurrió un error al marcar la baja del período.'
    });
  }
};

export const UR_DebitosAutomaticosPeriodosIntentarCambioTarjeta_CTS = async (
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

    const motivoCodigo = validarEnum(
      req.body.motivo_codigo,
      MOTIVOS_VALIDOS,
      'motivo_codigo'
    );

    const motivoDetalle =
      req.body.motivo_detalle !== undefined && req.body.motivo_detalle !== null
        ? String(req.body.motivo_detalle).trim()
        : null;

    if (motivoCodigo === 'OTRO' && !motivoDetalle) {
      return res.status(400).json({
        ok: false,
        mensajeError:
          'motivo_detalle es obligatorio cuando motivo_codigo es OTRO.'
      });
    }

    const periodo = await DebitosAutomaticosPeriodosModel.findByPk(id);

    if (!periodo) {
      return res.status(404).json({
        ok: false,
        mensajeError: 'Período de débito automático no encontrado.'
      });
    }

    const payload = {
      estado_cobro: 'PENDIENTE',
      accion_requerida: 'CAMBIO_TARJETA',
      motivo_codigo: motivoCodigo,
      motivo_detalle: motivoDetalle,
      fecha_resultado:
        req.body.fecha_resultado !== undefined &&
        req.body.fecha_resultado !== ''
          ? normalizeDateBoundary(req.body.fecha_resultado, false)
          : new Date()
    };

    if (req.body.updated_by !== undefined) {
      const updatedBy = parsePositiveInt(req.body.updated_by);
      if (!updatedBy) {
        return res.status(400).json({
          ok: false,
          mensajeError: 'updated_by debe ser un entero positivo.'
        });
      }
      payload.updated_by = updatedBy;
    }

    if (req.body.observaciones !== undefined) {
      payload.observaciones =
        req.body.observaciones === null ? null : String(req.body.observaciones);
    }

    // Benjamin Orellana - 27/03/2026 - Marcado de cambio de tarjeta manteniendo el período visualmente pendiente.
    await periodo.update(payload);

    // Benjamin Orellana - 2026/04/13 - La respuesta de cambio de tarjeta del período respeta permiso de tarjeta completa.
    const includeFullCard = hasDebitosFullAccess(req);

    const row = await DebitosAutomaticosPeriodosModel.findByPk(id, {
      include: buildPeriodoIncludes({
        includeEncrypted: includeFullCard
      })
    });

    return res.status(200).json({
      ok: true,
      row: sanitizePeriodo(row, {
        includeFullCard,
        req
      }),
      mensaje:
        'Recordá cambiar la fecha de vencimiento del pendiente en Socioplus'
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al registrar el cambio de tarjeta del período.'
    });
  }
};

export const UR_DebitosAutomaticosPeriodosIntentarPagoManual_CTS = async (
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

    const periodo = await DebitosAutomaticosPeriodosModel.findByPk(id);

    if (!periodo) {
      return res.status(404).json({
        ok: false,
        mensajeError: 'Período de débito automático no encontrado.'
      });
    }

    const payload = {
      estado_cobro: 'PAGO_MANUAL',
      accion_requerida: 'COBRO_MANUAL',
      fecha_resultado:
        req.body.fecha_resultado !== undefined &&
        req.body.fecha_resultado !== ''
          ? normalizeDateBoundary(req.body.fecha_resultado, false)
          : new Date()
    };

    if (req.body.motivo_detalle !== undefined) {
      payload.motivo_detalle =
        req.body.motivo_detalle === null
          ? null
          : String(req.body.motivo_detalle).trim();
    }

    if (req.body.updated_by !== undefined) {
      const updatedBy = parsePositiveInt(req.body.updated_by);
      if (!updatedBy) {
        return res.status(400).json({
          ok: false,
          mensajeError: 'updated_by debe ser un entero positivo.'
        });
      }
      payload.updated_by = updatedBy;
    }

    if (req.body.observaciones !== undefined) {
      payload.observaciones =
        req.body.observaciones === null ? null : String(req.body.observaciones);
    }

    // Benjamin Orellana - 27/03/2026 - Marcado de cobro manual como acción administrativa del período.
    await periodo.update(payload);

    // Benjamin Orellana - 2026/04/13 - La respuesta de pago manual del período respeta permiso de tarjeta completa.
    const includeFullCard = hasDebitosFullAccess(req);

    const row = await DebitosAutomaticosPeriodosModel.findByPk(id, {
      include: buildPeriodoIncludes({
        includeEncrypted: includeFullCard
      })
    });

    return res.status(200).json({
      ok: true,
      row: sanitizePeriodo(row, {
        includeFullCard,
        req
      }),
      mensaje:
        'Recordá cambiar la fecha de vencimiento del pendiente en Socioplus'
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al marcar el período para pago manual.'
    });
  }
};

export const UR_DebitosAutomaticosPeriodosReintentar_CTS = async (req, res) => {
  const sequelize = getTransactionProvider();
  const transaction = await sequelize.transaction();

  try {
    const id = parsePositiveInt(req.params.id);

    if (!id) {
      throw buildHttpError(400, 'El id enviado no es válido.');
    }

    const periodo = await DebitosAutomaticosPeriodosModel.findByPk(id, {
      transaction
    });

    if (!periodo) {
      throw buildHttpError(404, 'Período de débito automático no encontrado.');
    }

    const cliente = await DebitosAutomaticosClientesModel.findByPk(
      periodo.cliente_id,
      { transaction }
    );

    if (!cliente) {
      throw buildHttpError(400, 'No existe el cliente asociado al período.');
    }

    const updatedBy =
      req.body.updated_by !== undefined
        ? parsePositiveInt(req.body.updated_by)
        : null;

    if (req.body.updated_by !== undefined && !updatedBy) {
      throw buildHttpError(400, 'updated_by debe ser un entero positivo.');
    }

    const payload = {
      estado_cobro: 'PENDIENTE',
      accion_requerida: 'REINTENTO',
      fecha_resultado:
        req.body.fecha_resultado !== undefined &&
        req.body.fecha_resultado !== ''
          ? normalizeDateBoundary(req.body.fecha_resultado, false)
          : new Date()
    };

    const limpiarMotivos = parseBoolean(req.body.limpiar_motivos, true);
    if (limpiarMotivos) {
      payload.motivo_codigo = null;
      payload.motivo_detalle = null;
    }

    if (parseBoolean(req.body.reabrir_envio, false)) {
      payload.estado_envio = 'PENDIENTE';
    }

    if (updatedBy) {
      payload.updated_by = updatedBy;
    }

    if (req.body.observaciones !== undefined) {
      payload.observaciones =
        req.body.observaciones === null ? null : String(req.body.observaciones);
    }

    /* Benjamin Orellana - 2026/04/10 - Permite actualizar la tarjeta del cliente al confirmar el reintento del período reutilizando el mismo cifrado del módulo de solicitudes. */
    if (parseBoolean(req.body.actualizar_tarjeta, false)) {
      const marcaTarjeta = validarEnum(
        req.body.marca_tarjeta,
        ['VISA', 'MASTER'],
        'marca_tarjeta'
      );

      const cardData = resolveCardData({
        tarjeta_numero: req.body.tarjeta_numero
      });

      if (!cardData.ok) {
        throw buildHttpError(400, cardData.message);
      }

      await cliente.update(
        {
          marca_tarjeta: marcaTarjeta,
          confirmo_tarjeta_credito: 1,
          tarjeta_numero_cifrado: cardData.tarjeta_numero_cifrado,
          tarjeta_ultimos4: cardData.tarjeta_ultimos4,
          tarjeta_mascara: cardData.tarjeta_mascara,
          updated_by: updatedBy || cliente.updated_by
        },
        { transaction }
      );
    }

    // Benjamin Orellana - 27/03/2026 - Reapertura del mismo período para reintento sin duplicar registro.
    await periodo.update(payload, { transaction });

    await transaction.commit();

    // Benjamin Orellana - 2026/04/13 - La respuesta de reintento del período respeta permiso de tarjeta completa.
    const includeFullCard = hasDebitosFullAccess(req);

    const row = await DebitosAutomaticosPeriodosModel.findByPk(id, {
      include: buildPeriodoIncludes({
        includeEncrypted: includeFullCard
      })
    });

    return res.status(200).json({
      ok: true,
      row: sanitizePeriodo(row, {
        includeFullCard,
        req
      })
    });
  } catch (error) {
    await transaction.rollback();

    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message || 'Ocurrió un error al dejar el período en reintento.'
    });
  }
};

export const ER_DebitosAutomaticosPeriodos_CTS = async (_req, res) => {
  return res.status(405).json({
    ok: false,
    mensajeError:
      'No se permite eliminar períodos de débito automático. Usá los endpoints de negocio para aprobar, baja, cambio de tarjeta, pago manual o reintento.'
  });
};
