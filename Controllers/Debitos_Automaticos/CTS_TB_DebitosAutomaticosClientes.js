import { Op, fn, col } from 'sequelize';

import DebitosAutomaticosClientesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosClientes.js';
import DebitosAutomaticosClientesAdicionalesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosClientesAdicionales.js';
import DebitosAutomaticosBancosModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosBancos.js';
import DebitosAutomaticosPlanesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPlanes.js';
import DebitosAutomaticosSolicitudesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosSolicitudes.js';
import DebitosAutomaticosSolicitudesAdicionalesModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosSolicitudesAdicionales.js';
import DebitosAutomaticosPeriodosModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosPeriodos.js';
import DebitosAutomaticosTerminosModel from '../../Models/Debitos_Automaticos/MD_TB_DebitosAutomaticosTerminos.js';

// Benjamin Orellana - 2026/04/13 - Se centraliza seguridad de tarjeta en helper compartido para cifrado, descifrado y permisos.
import {
  hasDebitosFullAccess,
  resolveCardPresentation,
  resolveCardData
} from '../../Helpers/DebitosAutomaticos/cardSecurity.js';

const ESTADOS_VALIDOS = [
  'PENDIENTE_INICIO',
  'ACTIVO',
  'PAUSADO',
  'BAJA',
  'BLOQUEADO'
];

const MARCAS_VALIDAS = ['VISA', 'MASTER'];
const MODALIDADES_VALIDAS = ['TITULAR_SOLO', 'AMBOS', 'SOLO_ADICIONAL'];
const ROLES_CARGA_ORIGEN_VALIDOS = [
  'CLIENTE',
  'RECEPCION',
  'VENDEDOR',
  'COORDINADOR',
  'ADMIN'
];
const CAMPOS_ORDEN_VALIDOS = [
  'titular_nombre',
  'fecha_aprobacion',
  'fecha_inicio_cobro',
  'monto_base_vigente',
  'estado_general',
  'created_at'
];
const TRANSICIONES_VALIDAS = {
  PENDIENTE_INICIO: ['ACTIVO', 'PAUSADO', 'BAJA', 'BLOQUEADO'],
  ACTIVO: ['PAUSADO', 'BAJA', 'BLOQUEADO', 'PENDIENTE_INICIO'],
  PAUSADO: ['ACTIVO', 'BAJA', 'BLOQUEADO', 'PENDIENTE_INICIO'],
  BLOQUEADO: ['ACTIVO', 'PAUSADO', 'BAJA', 'PENDIENTE_INICIO'],
  BAJA: ['PENDIENTE_INICIO', 'ACTIVO', 'PAUSADO', 'BLOQUEADO']
};
const CAMPOS_NO_EDITABLES = [
  'id',
  'solicitud_id',
  'estado_general',
  'fecha_aprobacion',
  'fecha_baja',
  'titular_nombre',
  'titular_dni',
  'creado_por',
  'confirmo_tarjeta_credito',
  'tarjeta_numero_cifrado'
];
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

const parseNonNegativeNumber = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
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
    return `${value.trim()} ${endOfDay ? '23:59:59' : '00:00:00'}`;
  }

  return value;
};

// Benjamin Orellana - 2026/04/06 - Extrae YYYY-MM-DD desde strings, datetime SQL o Date sin corrimientos innecesarios.
const toDateOnlyString = (value) => {
  if (!value) return null;

  const raw = String(value).trim();
  const directMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch) {
    return directMatch[1];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  return ['true', '1', 'si', 'sí', 'yes'].includes(normalized);
};

// Benjamin Orellana - 2026/04/13 - Incluye tarjeta_numero_cifrado solo cuando el request tiene permiso de tarjeta completa.
const buildClienteAttributes = ({ includeEncrypted = false } = {}) => {
  if (includeEncrypted) {
    return {
      exclude: []
    };
  }

  return {
    exclude: ['tarjeta_numero_cifrado']
  };
};

// Benjamin Orellana - 2026/04/13 - Sanitiza cliente y resuelve tarjeta completa solo para correos habilitados, sin exponer jamás el cifrado.
const sanitizeCliente = (
  cliente,
  pagosCobrados = 0,
  { includeFullCard = false, req = null } = {}
) => {
  const row =
    typeof cliente?.toJSON === 'function'
      ? cliente.toJSON()
      : { ...(cliente || {}) };

  const cardData = resolveCardPresentation({
    req,
    cliente: row,
    forceFullAccess: includeFullCard
  });

  delete row.tarjeta_numero_cifrado;

  row.tarjeta_mascara = cardData.tarjeta_mascara || null;
  row.tarjeta_ultimos4 = cardData.tarjeta_ultimos4 || null;

  if (cardData.tarjeta_numero_completo) {
    row.tarjeta_numero_completo = cardData.tarjeta_numero_completo;
  } else {
    delete row.tarjeta_numero_completo;
  }

  if (row.solicitud) {
    const solicitudCardData = resolveCardPresentation({
      req,
      solicitud: row.solicitud,
      forceFullAccess: includeFullCard
    });

    delete row.solicitud.tarjeta_numero_cifrado;

    row.solicitud.tarjeta_mascara = solicitudCardData.tarjeta_mascara || null;
    row.solicitud.tarjeta_ultimos4 = solicitudCardData.tarjeta_ultimos4 || null;

    if (solicitudCardData.tarjeta_numero_completo) {
      row.solicitud.tarjeta_numero_completo =
        solicitudCardData.tarjeta_numero_completo;
    } else {
      delete row.solicitud.tarjeta_numero_completo;
    }
  }

  row.pagos_cobrados = Number(pagosCobrados || 0);

  return row;
};

const appendObservacion = (actual = '', nueva = '', prefijo = '') => {
  const base = String(actual || '').trim();
  const extra = String(nueva || '').trim();

  if (!extra) return base;

  const bloque = prefijo ? `[${prefijo}] ${extra}` : extra;
  return base ? `${base}\n${bloque}` : bloque;
};

const validarTransicionEstado = (estadoActual, estadoNuevo) => {
  if (estadoActual === estadoNuevo) return true;
  return (TRANSICIONES_VALIDAS[estadoActual] || []).includes(estadoNuevo);
};

const buildRangeFilter = (desde, hasta, endOfDay = false) => {
  const range = {};

  if (desde) {
    range[Op.gte] = normalizeDateBoundary(desde, false);
  }

  if (hasta) {
    range[Op.lte] = normalizeDateBoundary(hasta, endOfDay);
  }

  return Object.keys(range).length ? range : null;
};

const buildOrder = (query = {}) => {
  const requestedField =
    query.order_by || query.orderBy || query.sortBy || 'created_at';
  const requestedDirection =
    query.order_direction ||
    query.orderDirection ||
    query.sortDirection ||
    'DESC';

  const field = CAMPOS_ORDEN_VALIDOS.includes(requestedField)
    ? requestedField
    : 'created_at';

  const direction =
    String(requestedDirection).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  return [[field, direction]];
};

const buildClienteWhere = (query = {}) => {
  const where = {};
  const andConditions = [];

  const q = String(query.q || '').trim();
  const sedeId = parsePositiveInt(query.sede_id);
  const bancoId = parsePositiveInt(query.banco_id);
  const planId = parsePositiveInt(query.titular_plan_id);
  const estadoGeneral = query.estado_general;
  const modalidadAdhesion = query.modalidad_adhesion;
  const montoDesde = parseNonNegativeNumber(query.monto_desde);
  const montoHasta = parseNonNegativeNumber(query.monto_hasta);

  if (q) {
    andConditions.push({
      [Op.or]: [
        { titular_nombre: { [Op.like]: `%${q}%` } },
        { titular_dni: { [Op.like]: `%${q}%` } }
      ]
    });
  }

  if (sedeId) where.sede_id = sedeId;
  if (bancoId) where.banco_id = bancoId;
  if (planId) where.titular_plan_id = planId;

  if (estadoGeneral) {
    if (!ESTADOS_VALIDOS.includes(estadoGeneral)) {
      throw buildHttpError(
        400,
        `El estado_general "${estadoGeneral}" no es válido.`
      );
    }
    where.estado_general = estadoGeneral;
  }

  if (modalidadAdhesion) {
    where.modalidad_adhesion = modalidadAdhesion;
  }

  if (montoDesde !== null || montoHasta !== null) {
    where.monto_base_vigente = {};
    if (montoDesde !== null) where.monto_base_vigente[Op.gte] = montoDesde;
    if (montoHasta !== null) where.monto_base_vigente[Op.lte] = montoHasta;
  }

  const fechaInicioRange = buildRangeFilter(
    query.fecha_inicio_desde,
    query.fecha_inicio_hasta,
    true
  );
  if (fechaInicioRange) {
    where.fecha_inicio_cobro = fechaInicioRange;
  }

  const fechaAprobacionRange = buildRangeFilter(
    query.fecha_aprobacion_desde,
    query.fecha_aprobacion_hasta,
    true
  );
  if (fechaAprobacionRange) {
    where.fecha_aprobacion = fechaAprobacionRange;
  }

  if (andConditions.length) {
    where[Op.and] = andConditions;
  }

  return where;
};

// Benjamin Orellana - 2026/04/13 - Las relaciones del cliente también pueden incluir cifrado solo si el usuario está habilitado.
const buildClienteIncludes = ({
  withSolicitud = false,
  includeEncrypted = false
} = {}) => {
  const includes = [
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
  ];

  if (withSolicitud) {
    includes.push({
      model: DebitosAutomaticosSolicitudesModel,
      as: 'solicitud',
      required: false,
      attributes: includeEncrypted
        ? { exclude: [] }
        : {
            exclude: ['tarjeta_numero_cifrado']
          }
    });
  }

  return includes;
};

const obtenerMapaPagosCobrados = async (clienteIds = []) => {
  if (!clienteIds.length) return {};

  const rows = await DebitosAutomaticosPeriodosModel.findAll({
    attributes: ['cliente_id', [fn('COUNT', col('id')), 'pagos_cobrados']],
    where: {
      cliente_id: { [Op.in]: clienteIds },
      estado_cobro: 'COBRADO'
    },
    group: ['cliente_id'],
    raw: true
  });

  return rows.reduce((acc, item) => {
    acc[item.cliente_id] = Number(item.pagos_cobrados || 0);
    return acc;
  }, {});
};

const obtenerUltimosPeriodos = async (clienteId, limit = 6) => {
  return DebitosAutomaticosPeriodosModel.findAll({
    where: { cliente_id: clienteId },
    order: [
      ['periodo_anio', 'DESC'],
      ['periodo_mes', 'DESC']
    ],
    limit
  });
};

const validarExistenciaBanco = async (bancoId, transaction = null) => {
  if (!bancoId) return;
  const banco = await DebitosAutomaticosBancosModel.findByPk(bancoId, {
    transaction
  });
  if (!banco) {
    throw buildHttpError(400, `No existe un banco con id ${bancoId}.`);
  }
};

const validarExistenciaPlan = async (planId, transaction = null) => {
  if (!planId) return;
  const plan = await DebitosAutomaticosPlanesModel.findByPk(planId, {
    transaction
  });
  if (!plan) {
    throw buildHttpError(400, `No existe un plan con id ${planId}.`);
  }
};
// Benjamin Orellana - 08/04/2026 - Calcula el monto final vigente del cliente aplicando descuento porcentual con piso en cero
const calcularMontoFinalVigenteCliente = (
  montoInicialVigente,
  descuentoVigente = 0
) => {
  if (
    montoInicialVigente === null ||
    montoInicialVigente === undefined ||
    montoInicialVigente === ''
  ) {
    return null;
  }

  const inicial = Number(montoInicialVigente || 0);
  const descuentoPct = Number(descuentoVigente || 0);

  if (!Number.isFinite(inicial) || !Number.isFinite(descuentoPct)) {
    return null;
  }

  const montoFinal = inicial - inicial * (descuentoPct / 100);

  return Number(Math.max(montoFinal, 0).toFixed(2));
};
// Benjamin Orellana - 08/04/2026 - Resuelve el plan comercial aplicable al cliente según la modalidad vigente
const obtenerPlanComercialCliente = async ({
  modalidadAdhesion,
  titularPlanId = null,
  adicionalPlanId = null,
  transaction = null
}) => {
  const planId =
    modalidadAdhesion === 'SOLO_ADICIONAL' ? adicionalPlanId : titularPlanId;

  if (!planId) return null;

  return DebitosAutomaticosPlanesModel.findByPk(planId, {
    transaction
  });
};
// Benjamin Orellana - 08/04/2026 - Resuelve monto inicial, descuento porcentual y monto final del cliente desde body, plan o valores actuales
const resolverMontosVigentesCliente = ({
  body = {},
  current = null,
  planComercial = null
}) => {
  const hasMontoInicial = Object.prototype.hasOwnProperty.call(
    body,
    'monto_inicial_vigente'
  );
  const hasDescuento = Object.prototype.hasOwnProperty.call(
    body,
    'descuento_vigente'
  );
  const hasMontoFinalLegacy = Object.prototype.hasOwnProperty.call(
    body,
    'monto_base_vigente'
  );

  let montoInicialVigente = null;
  let descuentoVigente = 0;

  if (hasMontoInicial) {
    montoInicialVigente = parseNonNegativeNumber(body.monto_inicial_vigente);
    if (body.monto_inicial_vigente !== '' && montoInicialVigente === null) {
      throw buildHttpError(
        400,
        'monto_inicial_vigente debe ser un número mayor o igual a 0.'
      );
    }
  } else if (
    current?.monto_inicial_vigente !== null &&
    current?.monto_inicial_vigente !== undefined
  ) {
    montoInicialVigente = Number(current.monto_inicial_vigente);
  } else if (
    planComercial?.precio_referencia !== null &&
    planComercial?.precio_referencia !== undefined
  ) {
    montoInicialVigente = Number(planComercial.precio_referencia);
  } else if (hasMontoFinalLegacy) {
    montoInicialVigente = parseNonNegativeNumber(body.monto_base_vigente);
    if (body.monto_base_vigente !== '' && montoInicialVigente === null) {
      throw buildHttpError(
        400,
        'monto_base_vigente debe ser un número mayor o igual a 0.'
      );
    }
  } else if (
    current?.monto_base_vigente !== null &&
    current?.monto_base_vigente !== undefined
  ) {
    montoInicialVigente = Number(current.monto_base_vigente);
  }

  if (hasDescuento) {
    descuentoVigente = parseNonNegativeNumber(body.descuento_vigente);
    if (body.descuento_vigente !== '' && descuentoVigente === null) {
      throw buildHttpError(
        400,
        'descuento_vigente debe ser un número mayor o igual a 0.'
      );
    }
  } else if (
    current?.descuento_vigente !== null &&
    current?.descuento_vigente !== undefined
  ) {
    descuentoVigente = Number(current.descuento_vigente);
  } else if (
    planComercial?.descuento !== null &&
    planComercial?.descuento !== undefined
  ) {
    descuentoVigente = Number(planComercial.descuento);
  }

  if (descuentoVigente !== null && descuentoVigente > 100) {
    throw buildHttpError(400, 'descuento_vigente no puede ser mayor que 100.');
  }

  return {
    monto_inicial_vigente:
      montoInicialVigente !== null
        ? Number(montoInicialVigente.toFixed(2))
        : null,
    descuento_vigente:
      descuentoVigente !== null ? Number(descuentoVigente.toFixed(2)) : 0,
    monto_base_vigente: calcularMontoFinalVigenteCliente(
      montoInicialVigente,
      descuentoVigente
    )
  };
};

const validarExistenciaTerminos = async (terminosId, transaction = null) => {
  if (!terminosId) {
    throw buildHttpError(
      400,
      'terminos_id es obligatorio para crear el cliente directo.'
    );
  }

  const terminos = await DebitosAutomaticosTerminosModel.findByPk(terminosId, {
    transaction
  });

  if (!terminos) {
    throw buildHttpError(400, `No existe términos con id ${terminosId}.`);
  }
};

// Benjamin Orellana - 2026/04/13 - Obtiene cliente por id incluyendo cifrado solo cuando luego puede resolverse tarjeta completa.
const obtenerClientePorId = async (
  id,
  withSolicitud = false,
  includeEncrypted = false
) => {
  return DebitosAutomaticosClientesModel.findByPk(id, {
    attributes: buildClienteAttributes({ includeEncrypted }),
    include: buildClienteIncludes({
      withSolicitud,
      includeEncrypted
    })
  });
};

const getActorIdFromReq = (req = {}) => {
  return (
    parsePositiveInt(req.body?.creado_por) ||
    parsePositiveInt(req.body?.updated_by) ||
    parsePositiveInt(req.body?.usuario_carga_id) ||
    parsePositiveInt(req.user?.id) ||
    parsePositiveInt(req.usuario?.id) ||
    null
  );
};

const normalizarMarcaTarjeta = (value) => {
  const marca = String(value || '')
    .trim()
    .toUpperCase();

  if (!MARCAS_VALIDAS.includes(marca)) {
    throw buildHttpError(
      400,
      `marca_tarjeta debe ser uno de estos valores: ${MARCAS_VALIDAS.join(', ')}.`
    );
  }

  return marca;
};

const normalizarModalidad = (value) => {
  const modalidad = String(value || '')
    .trim()
    .toUpperCase();

  if (!MODALIDADES_VALIDAS.includes(modalidad)) {
    throw buildHttpError(
      400,
      `modalidad_adhesion debe ser uno de estos valores: ${MODALIDADES_VALIDAS.join(', ')}.`
    );
  }

  return modalidad;
};

const normalizarRolCargaOrigen = (value) => {
  const rol = String(value || 'ADMIN')
    .trim()
    .toUpperCase();

  if (!ROLES_CARGA_ORIGEN_VALIDOS.includes(rol)) {
    throw buildHttpError(
      400,
      `rol_carga_origen debe ser uno de estos valores: ${ROLES_CARGA_ORIGEN_VALIDOS.join(', ')}.`
    );
  }

  return rol;
};

const normalizarEstadoGeneral = (value) => {
  const estado = String(value || 'PENDIENTE_INICIO')
    .trim()
    .toUpperCase();

  if (!ESTADOS_VALIDOS.includes(estado)) {
    throw buildHttpError(
      400,
      `estado_general debe ser uno de estos valores: ${ESTADOS_VALIDOS.join(', ')}.`
    );
  }

  return estado;
};

const validarAdicionalSegunModalidad = ({
  modalidad,
  adicional,
  titularPlanId
}) => {
  const necesitaAdicional =
    modalidad === 'AMBOS' || modalidad === 'SOLO_ADICIONAL';

  if (modalidad === 'SOLO_ADICIONAL' && titularPlanId) {
    throw buildHttpError(
      400,
      'titular_plan_id debe ser null o no enviarse cuando modalidad_adhesion es SOLO_ADICIONAL.'
    );
  }

  if (
    (modalidad === 'TITULAR_SOLO' || modalidad === 'AMBOS') &&
    !titularPlanId
  ) {
    throw buildHttpError(
      400,
      'titular_plan_id es obligatorio cuando modalidad_adhesion es TITULAR_SOLO o AMBOS.'
    );
  }

  if (!necesitaAdicional && adicional) {
    throw buildHttpError(
      400,
      'No debe enviar adicional cuando modalidad_adhesion es TITULAR_SOLO.'
    );
  }

  if (necesitaAdicional && !adicional) {
    throw buildHttpError(
      400,
      `Debe enviar el objeto adicional cuando modalidad_adhesion es ${modalidad}.`
    );
  }

  if (!necesitaAdicional) return null;

  const nombre = String(adicional?.nombre || '').trim();
  const dni = String(adicional?.dni || '').trim();
  const email = String(adicional?.email || '')
    .trim()
    .toLowerCase();
  const telefono = String(adicional?.telefono || '').trim();
  const planId = parsePositiveInt(adicional?.plan_id);

  if (!nombre) {
    throw buildHttpError(400, 'adicional.nombre es obligatorio.');
  }

  if (!dni) {
    throw buildHttpError(400, 'adicional.dni es obligatorio.');
  }

  if (!email) {
    throw buildHttpError(400, 'adicional.email es obligatorio.');
  }

  if (!planId) {
    throw buildHttpError(400, 'adicional.plan_id debe ser un entero positivo.');
  }

  return {
    nombre,
    dni,
    email,
    telefono: telefono || null,
    plan_id: planId
  };
};

// Benjamin Orellana - 2026/04/06 - Convierte una fecha del cliente en estructura de período utilizable para sincronizaciones mensuales.
const getPeriodoDesdeFecha = (value) => {
  const fecha = toDateOnlyString(value);
  if (!fecha) return null;

  const [anio, mes] = fecha.split('-').map(Number);
  if (!anio || !mes) return null;

  return { anio, mes, fecha };
};

// Benjamin Orellana - 2026/04/06 - Obtiene el período calendario actual en formato año/mes.
const getPeriodoActual = () => {
  const hoy = new Date();
  return {
    anio: hoy.getFullYear(),
    mes: hoy.getMonth() + 1
  };
};

// Benjamin Orellana - 2026/04/06 - Compara dos períodos mensuales y devuelve diferencia en meses.
const compararPeriodos = (anioA, mesA, anioB, mesB) =>
  (Number(anioA) - Number(anioB)) * 12 + (Number(mesA) - Number(mesB));

// Benjamin Orellana - 2026/04/06 - Construye un where para afectar períodos desde un mes dado en adelante.
const buildPeriodoDesdeWhere = (anio, mes) => ({
  [Op.or]: [
    { periodo_anio: { [Op.gt]: anio } },
    {
      periodo_anio: anio,
      periodo_mes: { [Op.gte]: mes }
    }
  ]
});

// Benjamin Orellana - 2026/04/06 - Calcula el número relativo de mes de un período respecto del inicio de cobro del cliente.
const calcularNumeroMesRelativo = (cliente, periodoAnio, periodoMes) => {
  if (!cliente?.fecha_inicio_cobro) return null;

  const inicio = getPeriodoDesdeFecha(cliente.fecha_inicio_cobro);
  if (!inicio) return null;

  const diff = compararPeriodos(
    periodoAnio,
    periodoMes,
    inicio.anio,
    inicio.mes
  );
  return diff >= 0 ? diff + 1 : null;
};

// Benjamin Orellana - 2026/04/06 - Determina el reintegro aplicable a un período usando el snapshot vigente del cliente.
const calcularReintegroAplicado = (cliente, periodoAnio, periodoMes) => {
  const pct = Number(cliente?.beneficio_reintegro_pct_snapshot || 0);
  const desdeMes = Number(cliente?.beneficio_reintegro_desde_mes_snapshot || 0);
  const duracion = Number(
    cliente?.beneficio_reintegro_duracion_meses_snapshot || 0
  );

  if (!pct || !desdeMes) return 0;

  const numeroMes = calcularNumeroMesRelativo(cliente, periodoAnio, periodoMes);
  if (!numeroMes || numeroMes < desdeMes) return 0;

  if (duracion > 0 && numeroMes >= desdeMes + duracion) return 0;

  return Number(pct.toFixed(2));
};

// Benjamin Orellana - 2026/04/06 - Recalcula el neto estimado del período según bruto, descuento off y reintegro.
const calcularMontoNetoPeriodo = ({
  montoBruto,
  descuentoOffPct,
  reintegroPct
}) => {
  if (montoBruto === null || montoBruto === undefined || montoBruto === '') {
    return null;
  }

  const bruto = Number(montoBruto || 0);
  const off = Number(descuentoOffPct || 0);
  const reintegro = Number(reintegroPct || 0);

  const luegoOff = bruto * (1 - off / 100);
  const neto = luegoOff * (1 - reintegro / 100);

  return Number(neto.toFixed(2));
};

// Benjamin Orellana - 10/04/2026 - Genera defaults consistentes de período a partir del snapshot comercial actual del cliente.
const buildPeriodoPayloadDesdeCliente = ({
  cliente,
  periodoAnio,
  periodoMes,
  actorId = null
}) => {
  const montoInicialClienteAplicado =
    cliente?.monto_inicial_vigente !== null &&
    cliente?.monto_inicial_vigente !== undefined
      ? Number(cliente.monto_inicial_vigente)
      : null;

  const descuentoClientePctAplicado = Number(cliente?.descuento_vigente || 0);

  const montoBruto =
    cliente?.monto_base_vigente !== null &&
    cliente?.monto_base_vigente !== undefined
      ? Number(cliente.monto_base_vigente)
      : null;

  const descuentoOffPct = Number(
    cliente?.beneficio_descuento_off_pct_snapshot || 0
  );
  const reintegroPct = calcularReintegroAplicado(
    cliente,
    periodoAnio,
    periodoMes
  );

  return {
    cliente_id: cliente.id,
    periodo_anio: periodoAnio,
    periodo_mes: periodoMes,
    estado_envio: 'PENDIENTE',
    estado_cobro: cliente.estado_general === 'BAJA' ? 'BAJA' : 'PENDIENTE',
    accion_requerida: cliente.estado_general === 'BAJA' ? 'BAJA' : 'NINGUNA',
    monto_inicial_cliente_aplicado: montoInicialClienteAplicado,
    descuento_cliente_pct_aplicado: descuentoClientePctAplicado,
    monto_bruto: montoBruto,
    descuento_off_pct_aplicado: descuentoOffPct,
    reintegro_pct_aplicado: reintegroPct,
    monto_neto_estimado: calcularMontoNetoPeriodo({
      montoBruto,
      descuentoOffPct,
      reintegroPct
    }),
    creado_por: actorId || cliente.creado_por || null,
    updated_by: actorId || cliente.updated_by || cliente.creado_por || null
  };
};

// Benjamin Orellana - 2026/04/06 - Obtiene o crea el período actual editable si el cliente ya está operativo para el mes corriente.
const obtenerOCrearPeriodoActualEditable = async ({
  cliente,
  actorId = null,
  transaction
}) => {
  if (!cliente?.id) return null;
  if (cliente.estado_general === 'BAJA') return null;

  const inicio = getPeriodoDesdeFecha(cliente.fecha_inicio_cobro);
  if (!inicio) return null;

  const actual = getPeriodoActual();
  if (compararPeriodos(actual.anio, actual.mes, inicio.anio, inicio.mes) < 0) {
    return null;
  }

  const defaults = buildPeriodoPayloadDesdeCliente({
    cliente,
    periodoAnio: actual.anio,
    periodoMes: actual.mes,
    actorId
  });

  const [periodo] = await DebitosAutomaticosPeriodosModel.findOrCreate({
    where: {
      cliente_id: cliente.id,
      periodo_anio: actual.anio,
      periodo_mes: actual.mes
    },
    defaults,
    transaction
  });

  if (['COBRADO', 'PAGO_MANUAL', 'BAJA'].includes(periodo.estado_cobro)) {
    return null;
  }

  return periodo;
};

// Benjamin Orellana - 2026/04/06 - Sincroniza monto vigente y cálculo económico del período actual cuando el cliente cambia valores base.
const sincronizarPeriodoActualCliente = async ({
  cliente,
  actorId = null,
  transaction,
  syncMonto = false,
  ensurePeriodoActual = false
}) => {
  if (!cliente?.id) return;
  if (!syncMonto && !ensurePeriodoActual) return;

  const periodoActual = await obtenerOCrearPeriodoActualEditable({
    cliente,
    actorId,
    transaction
  });

  if (!periodoActual) return;

  const payload = {};

  if (syncMonto) {
    const montoBruto =
      cliente.monto_base_vigente !== null &&
      cliente.monto_base_vigente !== undefined
        ? Number(cliente.monto_base_vigente)
        : null;

    const descuentoOffPct = Number(
      periodoActual.descuento_off_pct_aplicado || 0
    );
    const reintegroPct = Number(periodoActual.reintegro_pct_aplicado || 0);

    // Benjamin Orellana - 10/04/2026 - La sincronización del período actual replica también monto inicial y descuento porcentual del cliente
    const montoInicialClienteAplicado =
      cliente.monto_inicial_vigente !== null &&
      cliente.monto_inicial_vigente !== undefined
        ? Number(cliente.monto_inicial_vigente)
        : null;

    const descuentoClientePctAplicado = Number(cliente.descuento_vigente || 0);

    payload.monto_inicial_cliente_aplicado = montoInicialClienteAplicado;
    payload.descuento_cliente_pct_aplicado = descuentoClientePctAplicado;
    payload.monto_bruto = montoBruto;
    payload.monto_neto_estimado = calcularMontoNetoPeriodo({
      montoBruto,
      descuentoOffPct,
      reintegroPct
    });
  }

  if (actorId) {
    payload.updated_by = actorId;
  }

  if (!Object.keys(payload).length) return;

  await periodoActual.update(payload, { transaction });
};

// Benjamin Orellana - 2026/04/06 - Marca períodos abiertos desde la baja del cliente en adelante para mantener consistencia operativa.
const marcarPeriodosBajaDesde = async ({
  clienteId,
  fechaBaja,
  updatedBy = null,
  transaction
}) => {
  const periodo = getPeriodoDesdeFecha(fechaBaja);
  if (!clienteId || !periodo) return;

  await DebitosAutomaticosPeriodosModel.update(
    {
      estado_cobro: 'BAJA',
      accion_requerida: 'BAJA',
      fecha_resultado: periodo.fecha,
      updated_by: updatedBy || null
    },
    {
      where: {
        cliente_id: clienteId,
        ...buildPeriodoDesdeWhere(periodo.anio, periodo.mes),
        estado_cobro: {
          [Op.notIn]: ['COBRADO', 'PAGO_MANUAL', 'BAJA']
        }
      },
      transaction
    }
  );
};

// Benjamin Orellana - 2026/04/06 - Reactiva períodos en BAJA desde el inicio de cobro al volver a activar el cliente.
const reactivarPeriodosBajaDesde = async ({
  clienteId,
  fechaInicioCobro,
  updatedBy = null,
  transaction
}) => {
  const periodo = getPeriodoDesdeFecha(fechaInicioCobro);
  if (!clienteId || !periodo) return;

  await DebitosAutomaticosPeriodosModel.update(
    {
      estado_cobro: 'PENDIENTE',
      accion_requerida: 'NINGUNA',
      motivo_codigo: null,
      motivo_detalle: null,
      fecha_resultado: null,
      updated_by: updatedBy || null
    },
    {
      where: {
        cliente_id: clienteId,
        ...buildPeriodoDesdeWhere(periodo.anio, periodo.mes),
        estado_cobro: 'BAJA'
      },
      transaction
    }
  );
};

// Benjamin Orellana - 10/04/2026 - Crea el período inicial guardando también el snapshot comercial del cliente aplicado al mes
const crearPeriodoInicialSiCorresponde = async ({
  clienteId,
  fechaInicioCobro,
  estadoGeneral,
  montoInicialClienteAplicado = null,
  descuentoClientePctAplicado = 0,
  montoBaseVigente = null,
  beneficioDescuentoOffPctSnapshot = 0,
  beneficioReintegroPctSnapshot = 0,
  beneficioReintegroDesdeMesSnapshot = null,
  beneficioReintegroDuracionMesesSnapshot = null,
  creadoPor = null,
  updatedBy = null,
  transaction
}) => {
  if (!fechaInicioCobro) return null;

  const periodoInicio = getPeriodoDesdeFecha(fechaInicioCobro);
  if (!periodoInicio) return null;

  const clienteVirtual = {
    fecha_inicio_cobro: fechaInicioCobro,
    beneficio_reintegro_pct_snapshot: beneficioReintegroPctSnapshot,
    beneficio_reintegro_desde_mes_snapshot: beneficioReintegroDesdeMesSnapshot,
    beneficio_reintegro_duracion_meses_snapshot:
      beneficioReintegroDuracionMesesSnapshot
  };

  const montoInicial =
    montoInicialClienteAplicado !== null &&
    montoInicialClienteAplicado !== undefined
      ? Number(montoInicialClienteAplicado)
      : null;

  const descuentoClientePct = Number(descuentoClientePctAplicado || 0);

  const montoBruto =
    montoBaseVigente !== null && montoBaseVigente !== undefined
      ? Number(montoBaseVigente)
      : null;

  const descuentoOffPct = Number(beneficioDescuentoOffPctSnapshot || 0);
  const reintegroPct = calcularReintegroAplicado(
    clienteVirtual,
    periodoInicio.anio,
    periodoInicio.mes
  );

  const [periodo] = await DebitosAutomaticosPeriodosModel.findOrCreate({
    where: {
      cliente_id: clienteId,
      periodo_anio: periodoInicio.anio,
      periodo_mes: periodoInicio.mes
    },
    defaults: {
      cliente_id: clienteId,
      periodo_anio: periodoInicio.anio,
      periodo_mes: periodoInicio.mes,
      estado_envio: 'PENDIENTE',
      estado_cobro: estadoGeneral === 'BAJA' ? 'BAJA' : 'PENDIENTE',
      accion_requerida: estadoGeneral === 'BAJA' ? 'BAJA' : 'NINGUNA',
      monto_inicial_cliente_aplicado: montoInicial,
      descuento_cliente_pct_aplicado: descuentoClientePct,
      monto_bruto: montoBruto,
      descuento_off_pct_aplicado: descuentoOffPct,
      reintegro_pct_aplicado: reintegroPct,
      monto_neto_estimado: calcularMontoNetoPeriodo({
        montoBruto,
        descuentoOffPct,
        reintegroPct
      }),
      creado_por: creadoPor,
      updated_by: updatedBy
    },
    transaction
  });

  return periodo;
};

/* -------------------------------------------------------------------------- */
/*                              CREATE DIRECTO                                 */
/* -------------------------------------------------------------------------- */
export const CR_DebitosAutomaticosClientes_CTS = async (req, res) => {
  const transaction =
    await DebitosAutomaticosClientesModel.sequelize.transaction();

  try {
    const actorId = getActorIdFromReq(req);

    const sedeId = parsePositiveInt(req.body.sede_id);
    const titularNombre = String(req.body.titular_nombre || '').trim();
    const titularDni = String(req.body.titular_dni || '').trim();
    const titularEmail = String(req.body.titular_email || '')
      .trim()
      .toLowerCase();
    const titularTelefono = String(req.body.titular_telefono || '').trim();
    const bancoId = parsePositiveInt(req.body.banco_id);
    const marcaTarjeta = normalizarMarcaTarjeta(req.body.marca_tarjeta);
    const modalidadAdhesion = normalizarModalidad(req.body.modalidad_adhesion);
    const estadoGeneral = normalizarEstadoGeneral(req.body.estado_general);
    const rolCargaOrigen = normalizarRolCargaOrigen(req.body.rol_carga_origen);
    const titularPlanId = parsePositiveInt(req.body.titular_plan_id);
    const terminosId = parsePositiveInt(req.body.terminos_id);
    // Benjamin Orellana - 08/04/2026 - El cliente directo ahora trabaja con monto inicial, descuento y monto final calculado
    const montoBaseVigenteLegacy = parseNonNegativeNumber(
      req.body.monto_base_vigente
    );
    const moneda = String(req.body.moneda || 'ARS').trim() || 'ARS';

    const beneficioDescripcionSnapshot = String(
      req.body.beneficio_descripcion_snapshot || ''
    ).trim();

    const beneficioDescuentoOffPctSnapshot =
      parseNonNegativeNumber(
        req.body.beneficio_descuento_off_pct_snapshot,
        0
      ) ?? 0;

    const beneficioReintegroPctSnapshot =
      parseNonNegativeNumber(req.body.beneficio_reintegro_pct_snapshot, 0) ?? 0;

    const beneficioReintegroDesdeMesSnapshot =
      req.body.beneficio_reintegro_desde_mes_snapshot === null ||
      req.body.beneficio_reintegro_desde_mes_snapshot === ''
        ? null
        : parsePositiveInt(req.body.beneficio_reintegro_desde_mes_snapshot);

    const beneficioReintegroDuracionMesesSnapshot =
      req.body.beneficio_reintegro_duracion_meses_snapshot === null ||
      req.body.beneficio_reintegro_duracion_meses_snapshot === ''
        ? null
        : parsePositiveInt(
            req.body.beneficio_reintegro_duracion_meses_snapshot
          );

    const fechaAprobacion = req.body.fecha_aprobacion
      ? normalizeDateBoundary(req.body.fecha_aprobacion, false)
      : new Date();

    const fechaInicioCobro = req.body.fecha_inicio_cobro
      ? normalizeDateBoundary(req.body.fecha_inicio_cobro, false)
      : null;

    const fechaBaja =
      estadoGeneral === 'BAJA'
        ? req.body.fecha_baja
          ? normalizeDateBoundary(req.body.fecha_baja, true)
          : new Date()
        : null;

    const observacionesInternas = req.body.observaciones_internas ?? null;
    const observacionesCliente = req.body.observaciones_cliente ?? null;
    const confirmoTarjetaCredito = parseBoolean(
      req.body.confirmo_tarjeta_credito,
      true
    );
    const crearPeriodoInicial = parseBoolean(
      req.body.crear_periodo_inicial,
      true
    );
    // Benjamin Orellana - 08/04/2026 - Se toma el texto especial opcional para guardar una promoción o condición particular del cliente
    const especial = String(req.body.especial || '').trim() || null;

    // Benjamin Orellana - 2026/04/13 - Se unifica la resolución de tarjeta usando el helper compartido del módulo.
    const cardData = resolveCardData(req.body);

    if (!cardData.ok) {
      throw buildHttpError(400, cardData.message);
    }

    const tarjetaNumeroCifrado = cardData.tarjeta_numero_cifrado;
    const tarjetaUltimos4 = cardData.tarjeta_ultimos4;
    const tarjetaMascara = cardData.tarjeta_mascara;

    if (!sedeId) {
      throw buildHttpError(400, 'sede_id debe ser un entero positivo.');
    }

    if (!titularNombre) {
      throw buildHttpError(400, 'titular_nombre es obligatorio.');
    }

    if (!titularDni) {
      throw buildHttpError(400, 'titular_dni es obligatorio.');
    }

    if (!titularEmail) {
      throw buildHttpError(400, 'titular_email es obligatorio.');
    }
    if (!bancoId) {
      throw buildHttpError(400, 'banco_id debe ser un entero positivo.');
    }

    if (!beneficioDescripcionSnapshot) {
      throw buildHttpError(
        400,
        'beneficio_descripcion_snapshot es obligatorio.'
      );
    }

    if (!fechaInicioCobro) {
      throw buildHttpError(
        400,
        'fecha_inicio_cobro es obligatoria para crear el cliente directo.'
      );
    }

    const adicionalNormalizado = validarAdicionalSegunModalidad({
      modalidad: modalidadAdhesion,
      adicional: req.body.adicional,
      titularPlanId
    });

    await validarExistenciaBanco(bancoId, transaction);
    await validarExistenciaTerminos(terminosId, transaction);

    if (titularPlanId) {
      await validarExistenciaPlan(titularPlanId, transaction);
    }

    if (adicionalNormalizado?.plan_id) {
      await validarExistenciaPlan(adicionalNormalizado.plan_id, transaction);
    }

    // Benjamin Orellana - 08/04/2026 - Se resuelve el plan comercial aplicable para snapshotear monto inicial, descuento porcentual y monto final del cliente
    const planComercial = await obtenerPlanComercialCliente({
      modalidadAdhesion,
      titularPlanId,
      adicionalPlanId: adicionalNormalizado?.plan_id || null,
      transaction
    });

    const montosVigentes = resolverMontosVigentesCliente({
      body: {
        ...req.body,
        monto_base_vigente: montoBaseVigenteLegacy
      },
      current: null,
      planComercial
    });

    if (
      montosVigentes.monto_inicial_vigente === null ||
      montosVigentes.monto_inicial_vigente === undefined
    ) {
      throw buildHttpError(
        400,
        'No se pudo resolver el monto inicial del cliente. Verifica el plan o envía monto_inicial_vigente.'
      );
    }

    const solicitudPayload = {
      canal_origen: 'INTERNO',
      rol_carga_origen: rolCargaOrigen,
      usuario_carga_id: actorId,
      sede_id: sedeId,
      estado: 'APROBADA',

      titular_nombre: titularNombre,
      titular_dni: titularDni,
      titular_email: titularEmail,
      titular_telefono: titularTelefono || null,

      banco_id: bancoId,
      marca_tarjeta: marcaTarjeta,
      confirmo_tarjeta_credito: confirmoTarjetaCredito ? 1 : 0,

      tarjeta_numero_cifrado: tarjetaNumeroCifrado,
      tarjeta_ultimos4: tarjetaUltimos4,
      tarjeta_mascara: tarjetaMascara,

      modalidad_adhesion: modalidadAdhesion,
      titular_plan_id:
        modalidadAdhesion === 'SOLO_ADICIONAL' ? null : titularPlanId,

      terminos_id: terminosId,
      terminos_aceptados: 1,
      terminos_aceptados_at: fechaAprobacion,
      terminos_ip: req.body.terminos_ip || req.ip || null,
      terminos_user_agent:
        req.body.terminos_user_agent || req.headers['user-agent'] || null,

      beneficio_descripcion_snapshot: beneficioDescripcionSnapshot,
      beneficio_descuento_off_pct_snapshot: beneficioDescuentoOffPctSnapshot,
      beneficio_reintegro_pct_snapshot: beneficioReintegroPctSnapshot,
      beneficio_reintegro_desde_mes_snapshot:
        beneficioReintegroDesdeMesSnapshot,
      beneficio_reintegro_duracion_meses_snapshot:
        beneficioReintegroDuracionMesesSnapshot,

      observaciones_cliente: observacionesCliente,
      observaciones_internas: observacionesInternas,

      revisado_por: actorId,
      revisado_at: fechaAprobacion,
      motivo_rechazo: null
    };

    // Benjamin Orellana - 06/04/2026 - Alta directa de cliente: crea una solicitud técnica interna aprobada para respetar FK/flujo histórico sin pasar por la pantalla de solicitudes.
    const solicitud = await DebitosAutomaticosSolicitudesModel.create(
      solicitudPayload,
      { transaction }
    );

    if (adicionalNormalizado) {
      // Benjamin Orellana - 06/04/2026 - Snapshot de adicional también a nivel solicitud técnica para mantener consistencia histórica.
      await DebitosAutomaticosSolicitudesAdicionalesModel.create(
        {
          solicitud_id: solicitud.id,
          nombre: adicionalNormalizado.nombre,
          dni: adicionalNormalizado.dni,
          email: adicionalNormalizado.email,
          telefono: adicionalNormalizado.telefono,
          plan_id: adicionalNormalizado.plan_id
        },
        { transaction }
      );
    }

    const clientePayload = {
      solicitud_id: solicitud.id,
      estado_general: estadoGeneral,

      sede_id: sedeId,
      creado_por: actorId,
      updated_by: parsePositiveInt(req.body.updated_by) || actorId,

      fecha_aprobacion: fechaAprobacion,
      fecha_inicio_cobro: fechaInicioCobro,
      fecha_baja: fechaBaja,

      titular_nombre: titularNombre,
      titular_dni: titularDni,

      banco_id: bancoId,
      marca_tarjeta: marcaTarjeta,
      confirmo_tarjeta_credito: confirmoTarjetaCredito ? 1 : 0,

      tarjeta_numero_cifrado: tarjetaNumeroCifrado,
      tarjeta_ultimos4: tarjetaUltimos4,
      tarjeta_mascara: tarjetaMascara,

      modalidad_adhesion: modalidadAdhesion,
      titular_plan_id:
        modalidadAdhesion === 'SOLO_ADICIONAL' ? null : titularPlanId,

      beneficio_descripcion_snapshot: beneficioDescripcionSnapshot,
      beneficio_descuento_off_pct_snapshot: beneficioDescuentoOffPctSnapshot,
      beneficio_reintegro_pct_snapshot: beneficioReintegroPctSnapshot,
      beneficio_reintegro_desde_mes_snapshot:
        beneficioReintegroDesdeMesSnapshot,
      beneficio_reintegro_duracion_meses_snapshot:
        beneficioReintegroDuracionMesesSnapshot,

      monto_inicial_vigente: montosVigentes.monto_inicial_vigente,
      descuento_vigente: montosVigentes.descuento_vigente,
      monto_base_vigente: montosVigentes.monto_base_vigente,
      especial: especial,
      moneda,
      observaciones_internas: observacionesInternas
    };

    // Benjamin Orellana - 06/04/2026 - Creación directa del cliente operativo a partir de la solicitud técnica interna.
    const cliente = await DebitosAutomaticosClientesModel.create(
      clientePayload,
      {
        transaction
      }
    );

    if (adicionalNormalizado) {
      // Benjamin Orellana - 06/04/2026 - Snapshot operativo del adicional ya aprobado para el cliente activo.
      await DebitosAutomaticosClientesAdicionalesModel.create(
        {
          cliente_id: cliente.id,
          nombre: adicionalNormalizado.nombre,
          dni: adicionalNormalizado.dni,
          plan_id: adicionalNormalizado.plan_id
        },
        { transaction }
      );
    }

    if (crearPeriodoInicial) {
      // Benjamin Orellana - 10/04/2026 - El período inicial del alta directa guarda snapshot comercial completo del cliente
      await crearPeriodoInicialSiCorresponde({
        clienteId: cliente.id,
        fechaInicioCobro,
        estadoGeneral,
        montoInicialClienteAplicado: montosVigentes.monto_inicial_vigente,
        descuentoClientePctAplicado: montosVigentes.descuento_vigente,
        montoBaseVigente: montosVigentes.monto_base_vigente,
        beneficioDescuentoOffPctSnapshot,
        beneficioReintegroPctSnapshot,
        beneficioReintegroDesdeMesSnapshot,
        beneficioReintegroDuracionMesesSnapshot,
        creadoPor: actorId,
        updatedBy: parsePositiveInt(req.body.updated_by) || actorId,
        transaction
      });
    }

    await transaction.commit();

    // Benjamin Orellana - 2026/04/13 - La respuesta del alta directa también respeta permiso de tarjeta completa.
    const includeFullCard = hasDebitosFullAccess(req);

    const clienteCreado = await obtenerClientePorId(
      cliente.id,
      true,
      includeFullCard
    );
    const pagosMap = await obtenerMapaPagosCobrados([cliente.id]);
    const ultimosPeriodos = await obtenerUltimosPeriodos(cliente.id, 6);

    const row = sanitizeCliente(clienteCreado, pagosMap[cliente.id] || 0, {
      includeFullCard,
      req
    });
    row.ultimos_periodos = ultimosPeriodos.map((item) =>
      typeof item?.toJSON === 'function' ? item.toJSON() : item
    );

    return res.status(201).json({
      ok: true,
      mensaje: 'Cliente creado correctamente.',
      row
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al crear el cliente de débito automático.'
    });
  }
};

export const OBRS_DebitosAutomaticosClientes_CTS = async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
    const limit = Math.min(
      parsePositiveInt(req.query.limit, DEFAULT_LIMIT),
      MAX_LIMIT
    );
    const offset = (page - 1) * limit;

    const where = buildClienteWhere(req.query);
    const order = buildOrder(req.query);

    // Benjamin Orellana - 2026/04/13 - El listado de clientes incluye cifrado solo para correos habilitados a ver tarjeta completa.
    const includeFullCard = hasDebitosFullAccess(req);

    const { rows, count } =
      await DebitosAutomaticosClientesModel.findAndCountAll({
        attributes: buildClienteAttributes({
          includeEncrypted: includeFullCard
        }),
        where,
        include: buildClienteIncludes({
          withSolicitud: false,
          includeEncrypted: includeFullCard
        }),
        order,
        limit,
        offset,
        distinct: true
      });

    const clienteIds = rows.map((item) => item.id);
    const pagosMap = await obtenerMapaPagosCobrados(clienteIds);

    const sanitizedRows = rows.map((item) =>
      sanitizeCliente(item, pagosMap[item.id] || 0, {
        includeFullCard,
        req
      })
    );

    return res.status(200).json({
      ok: true,
      rows: sanitizedRows,
      total: Number(count || 0),
      page,
      limit
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al listar los clientes de débitos automáticos.'
    });
  }
};

export const OBR_DebitosAutomaticosClientes_CTS = async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        mensajeError: 'El id enviado no es válido.'
      });
    }

    // Benjamin Orellana - 2026/04/13 - El detalle de cliente incluye cifrado solo para correos habilitados.
    const includeFullCard = hasDebitosFullAccess(req);

    const cliente = await obtenerClientePorId(id, true, includeFullCard);

    if (!cliente) {
      return res.status(404).json({
        ok: false,
        mensajeError: 'Cliente de débito automático no encontrado.'
      });
    }

    const pagosMap = await obtenerMapaPagosCobrados([id]);
    const ultimosPeriodos = await obtenerUltimosPeriodos(id, 6);

    const row = sanitizeCliente(cliente, pagosMap[id] || 0, {
      includeFullCard,
      req
    });

    row.ultimos_periodos = ultimosPeriodos.map((item) =>
      typeof item?.toJSON === 'function' ? item.toJSON() : item
    );

    return res.status(200).json({
      ok: true,
      row
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al obtener el cliente de débito automático.'
    });
  }
};

export const UR_DebitosAutomaticosClientes_CTS = async (req, res) => {
  const transaction =
    await DebitosAutomaticosClientesModel.sequelize.transaction();

  try {
    const id = parsePositiveInt(req.params.id);

    if (!id) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      return res.status(400).json({
        ok: false,
        mensajeError: 'El id enviado no es válido.'
      });
    }

    const forbiddenFields = CAMPOS_NO_EDITABLES.filter(
      (field) => req.body[field] !== undefined
    );

    if (forbiddenFields.length) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      return res.status(400).json({
        ok: false,
        mensajeError: `No está permitido editar los siguientes campos desde este endpoint: ${forbiddenFields.join(', ')}.`
      });
    }

    const cliente = await DebitosAutomaticosClientesModel.findByPk(id, {
      transaction
    });

    if (!cliente) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      return res.status(404).json({
        ok: false,
        mensajeError: 'Cliente de débito automático no encontrado.'
      });
    }

    const payload = {};

    const modalidadSolicitada =
      req.body.modalidad_adhesion !== undefined
        ? normalizarModalidad(req.body.modalidad_adhesion)
        : cliente.modalidad_adhesion;

    if (req.body.sede_id !== undefined) {
      const sedeId = parsePositiveInt(req.body.sede_id);
      if (!sedeId) {
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }

        return res.status(400).json({
          ok: false,
          mensajeError: 'sede_id debe ser un entero positivo.'
        });
      }
      payload.sede_id = sedeId;
    }

    if (req.body.fecha_inicio_cobro !== undefined) {
      if (
        !req.body.fecha_inicio_cobro ||
        !isValidDateInput(req.body.fecha_inicio_cobro)
      ) {
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }

        return res.status(400).json({
          ok: false,
          mensajeError: 'fecha_inicio_cobro no es una fecha válida.'
        });
      }
      payload.fecha_inicio_cobro = req.body.fecha_inicio_cobro;
    }

    // Benjamin Orellana - 08/04/2026 - La edición del cliente ahora permite modificar monto inicial y descuento, recalculando el monto final
    if (req.body.monto_inicial_vigente !== undefined) {
      const montoInicial = parseNonNegativeNumber(
        req.body.monto_inicial_vigente
      );

      if (req.body.monto_inicial_vigente !== '' && montoInicial === null) {
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }

        return res.status(400).json({
          ok: false,
          mensajeError:
            'monto_inicial_vigente debe ser un número mayor o igual a 0.'
        });
      }

      payload.monto_inicial_vigente = montoInicial;
    }

    if (req.body.descuento_vigente !== undefined) {
      const descuento = parseNonNegativeNumber(req.body.descuento_vigente);

      if (req.body.descuento_vigente !== '' && descuento === null) {
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }

        return res.status(400).json({
          ok: false,
          mensajeError:
            'descuento_vigente debe ser un número mayor o igual a 0.'
        });
      }

      payload.descuento_vigente = descuento ?? 0;
    }

    // Benjamin Orellana - 08/04/2026 - Compatibilidad temporal con front antiguo que aún envía monto_base_vigente
    if (
      req.body.monto_base_vigente !== undefined &&
      req.body.monto_inicial_vigente === undefined &&
      req.body.descuento_vigente === undefined
    ) {
      const montoLegacy = parseNonNegativeNumber(req.body.monto_base_vigente);

      if (montoLegacy === null) {
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }

        return res.status(400).json({
          ok: false,
          mensajeError:
            'monto_base_vigente debe ser un número mayor o igual a 0.'
        });
      }

      payload.monto_inicial_vigente = montoLegacy;
      payload.descuento_vigente = 0;
    }

    if (req.body.moneda !== undefined) {
      const moneda = String(req.body.moneda || '').trim();
      if (!moneda) {
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }

        return res.status(400).json({
          ok: false,
          mensajeError: 'moneda es obligatoria cuando se envía.'
        });
      }
      payload.moneda = moneda;
    }

    if (req.body.observaciones_internas !== undefined) {
      payload.observaciones_internas = req.body.observaciones_internas;
    }

    if (req.body.modalidad_adhesion !== undefined) {
      // Benjamin Orellana - 2026/04/06 - Se habilita la edición de modalidad operativa del cliente desde el endpoint de actualización.
      payload.modalidad_adhesion = modalidadSolicitada;

      if (
        modalidadSolicitada === 'SOLO_ADICIONAL' &&
        req.body.titular_plan_id === undefined
      ) {
        payload.titular_plan_id = null;
      }
    }

    if (req.body.titular_plan_id !== undefined) {
      // Benjamin Orellana - 2026/04/06 - Se permite limpiar el plan titular únicamente cuando la modalidad final es SOLO_ADICIONAL.
      if (
        req.body.titular_plan_id === null ||
        req.body.titular_plan_id === ''
      ) {
        if (modalidadSolicitada !== 'SOLO_ADICIONAL') {
          if (transaction && !transaction.finished) {
            await transaction.rollback();
          }

          return res.status(400).json({
            ok: false,
            mensajeError:
              'titular_plan_id es obligatorio cuando la modalidad final es TITULAR_SOLO o AMBOS.'
          });
        }

        payload.titular_plan_id = null;
      } else {
        const planId = parsePositiveInt(req.body.titular_plan_id);
        if (!planId) {
          if (transaction && !transaction.finished) {
            await transaction.rollback();
          }

          return res.status(400).json({
            ok: false,
            mensajeError: 'titular_plan_id debe ser un entero positivo.'
          });
        }

        await validarExistenciaPlan(planId, transaction);
        payload.titular_plan_id = planId;
      }
    }

    if (req.body.banco_id !== undefined) {
      const bancoId = parsePositiveInt(req.body.banco_id);
      if (!bancoId) {
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }

        return res.status(400).json({
          ok: false,
          mensajeError: 'banco_id debe ser un entero positivo.'
        });
      }
      await validarExistenciaBanco(bancoId, transaction);
      payload.banco_id = bancoId;
    }

    if (req.body.marca_tarjeta !== undefined) {
      const marca = String(req.body.marca_tarjeta || '')
        .trim()
        .toUpperCase();
      if (!MARCAS_VALIDAS.includes(marca)) {
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }

        return res.status(400).json({
          ok: false,
          mensajeError: `marca_tarjeta debe ser uno de estos valores: ${MARCAS_VALIDAS.join(', ')}.`
        });
      }
      payload.marca_tarjeta = marca;
    }

    // Benjamin Orellana - 2026/04/13 - Si se envía una nueva tarjeta, se recalculan y persisten en conjunto el cifrado, la máscara y los últimos cuatro dígitos.
    if (req.body.tarjeta_numero !== undefined) {
      const rawCard = String(req.body.tarjeta_numero || '').trim();

      if (rawCard) {
        const cardData = resolveCardData({
          tarjeta_numero: rawCard
        });

        if (!cardData.ok) {
          if (transaction && !transaction.finished) {
            await transaction.rollback();
          }

          return res.status(400).json({
            ok: false,
            mensajeError: cardData.message
          });
        }

        payload.tarjeta_numero_cifrado = cardData.tarjeta_numero_cifrado;
        payload.tarjeta_ultimos4 = cardData.tarjeta_ultimos4;
        payload.tarjeta_mascara = cardData.tarjeta_mascara;
      }
    }

    // Benjamin Orellana - 2026/04/13 - Solo se permite tocar máscara y últimos 4 por separado si no se envió una nueva tarjeta completa.
    if (req.body.tarjeta_numero === undefined) {
      if (req.body.tarjeta_mascara !== undefined) {
        const mascara = String(req.body.tarjeta_mascara || '').trim();
        if (!mascara) {
          if (transaction && !transaction.finished) {
            await transaction.rollback();
          }

          return res.status(400).json({
            ok: false,
            mensajeError: 'tarjeta_mascara no puede enviarse vacía.'
          });
        }
        payload.tarjeta_mascara = mascara;
      }

      if (req.body.tarjeta_ultimos4 !== undefined) {
        const ultimos4 = String(req.body.tarjeta_ultimos4 || '').trim();
        if (!/^\d{4}$/.test(ultimos4)) {
          if (transaction && !transaction.finished) {
            await transaction.rollback();
          }

          return res.status(400).json({
            ok: false,
            mensajeError:
              'tarjeta_ultimos4 debe contener exactamente 4 dígitos.'
          });
        }
        payload.tarjeta_ultimos4 = ultimos4;
      }
    }


    if (req.body.updated_by !== undefined) {
      const updatedBy = parsePositiveInt(req.body.updated_by);
      if (!updatedBy) {
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }

        return res.status(400).json({
          ok: false,
          mensajeError: 'updated_by debe ser un entero positivo.'
        });
      }
      payload.updated_by = updatedBy;
    }

    // Benjamin Orellana - 08/04/2026 - Se permite editar el campo especial del cliente como texto libre controlado
    if (req.body.especial !== undefined) {
      payload.especial = String(req.body.especial || '').trim() || null;
    }

    const modalidadFinal =
      payload.modalidad_adhesion !== undefined
        ? payload.modalidad_adhesion
        : cliente.modalidad_adhesion;

    const titularPlanFinal =
      payload.titular_plan_id !== undefined
        ? payload.titular_plan_id
        : cliente.titular_plan_id;

    // Benjamin Orellana - 2026/04/06 - Validación final de consistencia entre modalidad y plan titular.
    if (
      ['TITULAR_SOLO', 'AMBOS'].includes(modalidadFinal) &&
      !titularPlanFinal
    ) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      return res.status(400).json({
        ok: false,
        mensajeError:
          'titular_plan_id es obligatorio cuando modalidad_adhesion es TITULAR_SOLO o AMBOS.'
      });
    }

    if (!Object.keys(payload).length) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      return res.status(400).json({
        ok: false,
        mensajeError: 'No se enviaron campos válidos para actualizar.'
      });
    }

    // Benjamin Orellana - 08/04/2026 - Se recalcula el monto final vigente del cliente a partir del monto inicial y descuento finales
    if (
      req.body.monto_inicial_vigente !== undefined ||
      req.body.descuento_vigente !== undefined ||
      req.body.monto_base_vigente !== undefined
    ) {
      const montoInicialFinal =
        payload.monto_inicial_vigente !== undefined
          ? payload.monto_inicial_vigente
          : cliente.monto_inicial_vigente !== null &&
              cliente.monto_inicial_vigente !== undefined
            ? Number(cliente.monto_inicial_vigente)
            : cliente.monto_base_vigente !== null &&
                cliente.monto_base_vigente !== undefined
              ? Number(cliente.monto_base_vigente)
              : null;

      const descuentoFinal =
        payload.descuento_vigente !== undefined
          ? payload.descuento_vigente
          : cliente.descuento_vigente !== null &&
              cliente.descuento_vigente !== undefined
            ? Number(cliente.descuento_vigente)
            : 0;

      if (descuentoFinal !== null && descuentoFinal > 100) {
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }

        return res.status(400).json({
          ok: false,
          mensajeError: 'descuento_vigente no puede ser mayor que 100.'
        });
      }

      payload.monto_base_vigente = calcularMontoFinalVigenteCliente(
        montoInicialFinal,
        descuentoFinal
      );
    }

    // Benjamin Orellana - 27/03/2026 - Update controlado de datos operativos del cliente.
    // Benjamin Orellana - 2026/04/06 - Se agrega soporte para edición de modalidad y sincronización del período actual cuando cambia el monto vigente.
    await cliente.update(payload, { transaction });

    await sincronizarPeriodoActualCliente({
      cliente,
      actorId:
        payload.updated_by || cliente.updated_by || cliente.creado_por || null,
      transaction,
      syncMonto:
        req.body.monto_inicial_vigente !== undefined ||
        req.body.descuento_vigente !== undefined ||
        req.body.monto_base_vigente !== undefined,
      ensurePeriodoActual: req.body.fecha_inicio_cobro !== undefined
    });

    await transaction.commit();
    // Benjamin Orellana - 2026/04/13 - La respuesta de actualización del cliente también respeta permiso de tarjeta completa.
    const includeFullCard = hasDebitosFullAccess(req);

    const clienteActualizado = await obtenerClientePorId(
      id,
      false,
      includeFullCard
    );
    const pagosMap = await obtenerMapaPagosCobrados([id]);

    return res.status(200).json({
      ok: true,
      row: sanitizeCliente(clienteActualizado, pagosMap[id] || 0, {
        includeFullCard,
        req
      })
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al actualizar el cliente de débito automático.'
    });
  }
};

export const UR_DebitosAutomaticosClientesEstado_CTS = async (req, res) => {
  const transaction =
    await DebitosAutomaticosClientesModel.sequelize.transaction();

  try {
    const id = parsePositiveInt(req.params.id);
    const estadoNuevo = String(req.body.estado_general || '')
      .trim()
      .toUpperCase();

    if (!id) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      return res.status(400).json({
        ok: false,
        mensajeError: 'El id enviado no es válido.'
      });
    }

    if (!ESTADOS_VALIDOS.includes(estadoNuevo)) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      return res.status(400).json({
        ok: false,
        mensajeError: `estado_general debe ser uno de estos valores: ${ESTADOS_VALIDOS.join(', ')}.`
      });
    }

    const cliente = await DebitosAutomaticosClientesModel.findByPk(id, {
      transaction
    });

    if (!cliente) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      return res.status(404).json({
        ok: false,
        mensajeError: 'Cliente de débito automático no encontrado.'
      });
    }

    if (!validarTransicionEstado(cliente.estado_general, estadoNuevo)) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      return res.status(400).json({
        ok: false,
        mensajeError: `No se permite la transición de ${cliente.estado_general} a ${estadoNuevo}.`
      });
    }

    const payload = {
      estado_general: estadoNuevo
    };

    if (req.body.updated_by !== undefined) {
      const updatedBy = parsePositiveInt(req.body.updated_by);
      if (!updatedBy) {
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }

        return res.status(400).json({
          ok: false,
          mensajeError: 'updated_by debe ser un entero positivo.'
        });
      }
      payload.updated_by = updatedBy;
    }

    if (req.body.observaciones_internas !== undefined) {
      payload.observaciones_internas = req.body.observaciones_internas;
    }

    if (estadoNuevo === 'BAJA') {
      payload.fecha_baja = req.body.fecha_baja
        ? normalizeDateBoundary(req.body.fecha_baja, true)
        : new Date();
    } else {
      const limpiarFechaBaja = parseBoolean(req.body.clear_fecha_baja, false);
      if (cliente.estado_general === 'BAJA' && limpiarFechaBaja) {
        payload.fecha_baja = null;
      }
    }

    // Benjamin Orellana - 2026/04/06 - Permite reactivar por endpoint general fijando fecha_inicio_cobro si hace falta para sincronizar períodos.
    if (estadoNuevo === 'ACTIVO') {
      if (!cliente.fecha_inicio_cobro) {
        payload.fecha_inicio_cobro = req.body.fecha_inicio_cobro
          ? normalizeDateBoundary(req.body.fecha_inicio_cobro, false)
          : new Date();
      } else if (req.body.fecha_inicio_cobro !== undefined) {
        if (!isValidDateInput(req.body.fecha_inicio_cobro)) {
          if (transaction && !transaction.finished) {
            await transaction.rollback();
          }

          return res.status(400).json({
            ok: false,
            mensajeError: 'fecha_inicio_cobro no es una fecha válida.'
          });
        }
        payload.fecha_inicio_cobro = req.body.fecha_inicio_cobro;
      }
    }

    // Benjamin Orellana - 27/03/2026 - Cambio de estado con validación de transición y baja controlada.
    // Benjamin Orellana - 2026/04/06 - Sincronización automática de períodos al pasar a BAJA o volver a ACTIVO desde el endpoint general.
    await cliente.update(payload, { transaction });

    if (estadoNuevo === 'BAJA') {
      await marcarPeriodosBajaDesde({
        clienteId: id,
        fechaBaja: payload.fecha_baja,
        updatedBy: payload.updated_by || null,
        transaction
      });
    }

    if (estadoNuevo === 'ACTIVO') {
      await reactivarPeriodosBajaDesde({
        clienteId: id,
        fechaInicioCobro:
          payload.fecha_inicio_cobro || cliente.fecha_inicio_cobro,
        updatedBy: payload.updated_by || null,
        transaction
      });
    }

    await transaction.commit();

    // Benjamin Orellana - 2026/04/13 - La respuesta de cambio de estado también respeta permiso de tarjeta completa.
    const includeFullCard = hasDebitosFullAccess(req);

    const clienteActualizado = await obtenerClientePorId(
      id,
      false,
      includeFullCard
    );
    const pagosMap = await obtenerMapaPagosCobrados([id]);

    return res.status(200).json({
      ok: true,
      row: sanitizeCliente(clienteActualizado, pagosMap[id] || 0, {
        includeFullCard,
        req
      })
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message ||
        'Ocurrió un error al actualizar el estado del cliente.'
    });
  }
};

export const UR_DebitosAutomaticosClientesDarBaja_CTS = async (req, res) => {
  const transaction =
    await DebitosAutomaticosClientesModel.sequelize.transaction();

  try {
    const id = parsePositiveInt(req.params.id);
    const motivo = String(
      req.body.motivo || req.body.observaciones_internas || ''
    ).trim();

    if (!id) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      return res.status(400).json({
        ok: false,
        mensajeError: 'El id enviado no es válido.'
      });
    }

    if (!motivo) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      return res.status(400).json({
        ok: false,
        mensajeError:
          'Debe enviar un motivo u observación para dar de baja al cliente.'
      });
    }

    const cliente = await DebitosAutomaticosClientesModel.findByPk(id, {
      transaction
    });

    if (!cliente) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      return res.status(404).json({
        ok: false,
        mensajeError: 'Cliente de débito automático no encontrado.'
      });
    }

    if (!validarTransicionEstado(cliente.estado_general, 'BAJA')) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      return res.status(400).json({
        ok: false,
        mensajeError: `No se permite la transición de ${cliente.estado_general} a BAJA.`
      });
    }

    const payload = {
      estado_general: 'BAJA',
      fecha_baja: req.body.fecha_baja
        ? normalizeDateBoundary(req.body.fecha_baja, true)
        : new Date(),
      observaciones_internas: appendObservacion(
        cliente.observaciones_internas,
        motivo,
        'BAJA'
      )
    };

    if (req.body.updated_by !== undefined) {
      const updatedBy = parsePositiveInt(req.body.updated_by);
      if (!updatedBy) {
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }

        return res.status(400).json({
          ok: false,
          mensajeError: 'updated_by debe ser un entero positivo.'
        });
      }
      payload.updated_by = updatedBy;
    }

    // Benjamin Orellana - 27/03/2026 - Endpoint específico para baja con motivo obligatorio.
    // Benjamin Orellana - 2026/04/06 - Baja del cliente y marcado automático de períodos abiertos o futuros como BAJA.
    await cliente.update(payload, { transaction });

    await marcarPeriodosBajaDesde({
      clienteId: id,
      fechaBaja: payload.fecha_baja,
      updatedBy: payload.updated_by || null,
      transaction
    });

    await transaction.commit();

    // Benjamin Orellana - 2026/04/13 - La respuesta de baja también respeta permiso de tarjeta completa.
    const includeFullCard = hasDebitosFullAccess(req);

    const clienteActualizado = await obtenerClientePorId(
      id,
      false,
      includeFullCard
    );
    const pagosMap = await obtenerMapaPagosCobrados([id]);

    return res.status(200).json({
      ok: true,
      row: sanitizeCliente(clienteActualizado, pagosMap[id] || 0, {
        includeFullCard,
        req
      })
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError:
        error?.message || 'Ocurrió un error al dar de baja el cliente.'
    });
  }
};

export const UR_DebitosAutomaticosClientesActivar_CTS = async (req, res) => {
  const transaction =
    await DebitosAutomaticosClientesModel.sequelize.transaction();

  try {
    const id = parsePositiveInt(req.params.id);

    if (!id) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      return res.status(400).json({
        ok: false,
        mensajeError: 'El id enviado no es válido.'
      });
    }

    const cliente = await DebitosAutomaticosClientesModel.findByPk(id, {
      transaction
    });

    if (!cliente) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      return res.status(404).json({
        ok: false,
        mensajeError: 'Cliente de débito automático no encontrado.'
      });
    }

    if (!validarTransicionEstado(cliente.estado_general, 'ACTIVO')) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }

      return res.status(400).json({
        ok: false,
        mensajeError: `No se permite la transición de ${cliente.estado_general} a ACTIVO.`
      });
    }

    const payload = {
      estado_general: 'ACTIVO'
    };

    if (!cliente.fecha_inicio_cobro) {
      payload.fecha_inicio_cobro = req.body.fecha_inicio_cobro
        ? normalizeDateBoundary(req.body.fecha_inicio_cobro, false)
        : new Date();
    } else if (req.body.fecha_inicio_cobro !== undefined) {
      if (!isValidDateInput(req.body.fecha_inicio_cobro)) {
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }

        return res.status(400).json({
          ok: false,
          mensajeError: 'fecha_inicio_cobro no es una fecha válida.'
        });
      }
      payload.fecha_inicio_cobro = req.body.fecha_inicio_cobro;
    }

    const limpiarFechaBaja =
      req.body.clear_fecha_baja !== undefined
        ? parseBoolean(req.body.clear_fecha_baja, false)
        : cliente.estado_general === 'BAJA';

    if (limpiarFechaBaja) {
      payload.fecha_baja = null;
    }

    if (req.body.observaciones_internas !== undefined) {
      payload.observaciones_internas = req.body.observaciones_internas;
    }

    if (req.body.updated_by !== undefined) {
      const updatedBy = parsePositiveInt(req.body.updated_by);
      if (!updatedBy) {
        if (transaction && !transaction.finished) {
          await transaction.rollback();
        }

        return res.status(400).json({
          ok: false,
          mensajeError: 'updated_by debe ser un entero positivo.'
        });
      }
      payload.updated_by = updatedBy;
    }

    // Benjamin Orellana - 27/03/2026 - Endpoint específico para activar cliente e iniciar cobro si corresponde.
    // Benjamin Orellana - 2026/04/06 - Reactivación del cliente y rehabilitación automática de períodos que estaban en BAJA.
    await cliente.update(payload, { transaction });

    await reactivarPeriodosBajaDesde({
      clienteId: id,
      fechaInicioCobro:
        payload.fecha_inicio_cobro || cliente.fecha_inicio_cobro,
      updatedBy: payload.updated_by || null,
      transaction
    });

    await transaction.commit();

    // Benjamin Orellana - 2026/04/13 - La respuesta de activación también respeta permiso de tarjeta completa.
    const includeFullCard = hasDebitosFullAccess(req);

    const clienteActualizado = await obtenerClientePorId(
      id,
      false,
      includeFullCard
    );
    const pagosMap = await obtenerMapaPagosCobrados([id]);

    return res.status(200).json({
      ok: true,
      row: sanitizeCliente(clienteActualizado, pagosMap[id] || 0, {
        includeFullCard,
        req
      })
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return res.status(error.statusCode || 500).json({
      ok: false,
      mensajeError: error?.message || 'Ocurrió un error al activar el cliente.'
    });
  }
};
