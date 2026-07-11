import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SCRAPPER QCONCIERTOS ALMERIA
// Nodes   : 22  |  Connections: 22
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ScheduleTrigger                    scheduleTrigger
// ManualTrigger                      manualTrigger
// WebhookTrigger                     webhook
// LoadPromoterConfig                 postgres                   [creds]
// FetchListado                       httpRequest                [onError→regular]
// ParsearListado                     code
// SplitOut                           splitOut
// NormalizarTitulo                   code
// UpsertRawFrontEventos              postgres                   [creds]
// SelectFrontSinDetalle              postgres                   [creds]
// LoopEventos                        splitInBatches
// FetchDetalle                       httpRequest                [onError→regular]
// ParsearDetalle                     code
// UpsertRawDetalleEventos            postgres                   [creds]
// LeerAdjuntosPendientes             postgres                   [creds]
// LoopAdjuntos                       splitInBatches
// FiltrarAdjuntosValidos             code
// PrepararAdjuntoDropbox             code
// DescargarAdjunto                   httpRequest                [onError→regular]
// GuardarEnDropbox                   dropbox                    [onError→regular] [creds]
// RegistrarAdjunto                   postgres                   [creds]
// MarcarAdjuntosDescargados          postgres                   [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ScheduleTrigger
//    → LoadPromoterConfig
//      → FetchListado
//        → ParsearListado
//          → SplitOut
//            → NormalizarTitulo
//              → UpsertRawFrontEventos
//                → SelectFrontSinDetalle
//                  → LoopEventos
//                    → LeerAdjuntosPendientes
//                      → LoopAdjuntos
//                       .out(1) → FiltrarAdjuntosValidos
//                          → PrepararAdjuntoDropbox
//                            → DescargarAdjunto
//                              → GuardarEnDropbox
//                                → RegistrarAdjunto
//                                  → MarcarAdjuntosDescargados
//                                    → LoopAdjuntos (↩ loop)
//                   .out(1) → ParsearDetalle
//                      → UpsertRawDetalleEventos
//                        → LoopEventos (↩ loop)
// ManualTrigger
//    → LoadPromoterConfig (↩ loop)
// WebhookTrigger
//    → LoadPromoterConfig (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'TQX2pQJK7RSLijE4',
    name: 'SCRAPPER QCONCIERTOS ALMERIA',
    // Desactivado 2026-07-11: la fuente solo metía duplicados (y llevaba parada
    // desde el 2-jun). Estado real: inactivo en n8n (API deactivate) +
    // habilitado=false en promotores_configuracion. n8nac ignora 'active'.
    active: false,
    isArchived: false,
    settings: {
        errorWorkflow: 'IkqnFDu34CjPjXBj',
        timezone: 'Europe/Madrid',
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
    },
})
export class ScrapperQconciertosAlmeriaWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'qconc-schedule-trigger',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.3,
        position: [-1820, 0],
    })
    ScheduleTrigger = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 22 * * 1-6',
                },
            ],
        },
    };

    @node({
        id: 'qconc-manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-1820, 192],
    })
    ManualTrigger = {};

    @node({
        id: 'qconc-webhook-trigger',
        webhookId: 'qconc-trigger-test',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1820, 384],
    })
    WebhookTrigger = {
        httpMethod: 'POST',
        path: 'qconc-trigger-test',
        responseMode: 'lastNode',
        options: {},
    };

    @node({
        id: 'qconc-load-promoter-config',
        name: 'Load Promoter Config',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-1600, 0],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    LoadPromoterConfig = {
        operation: 'executeQuery',
        schema: {
            __rl: true,
            value: 'public',
            mode: 'list',
        },
        table: {
            __rl: true,
            value: 'promotores_configuracion',
            mode: 'list',
        },
        query: `SELECT
    promotor_id, promotor_nombre, url_lista, localidad_default,
    parser_lista_tipo, dropbox_folder_base
FROM promotores_configuracion
WHERE promotor_id = 'qconciertos_almeria'
  AND habilitado = true;`,
        options: {},
    };

    @node({
        id: 'qconc-fetch-listado',
        name: 'Fetch Listado',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [-1376, 0],
        onError: 'continueRegularOutput',
    })
    FetchListado = {
        method: 'GET',
        url: '={{ $json.url_lista }}',
        sendHeaders: true,
        specifyHeaders: 'keypair',
        headerParameters: {
            parameters: [
                {
                    name: 'User-Agent',
                    value: 'Mozilla/5.0 (sgae-c15-scraper)',
                },
                {
                    name: 'Accept',
                    value: 'text/html',
                },
            ],
        },
        options: {
            response: {
                response: {
                    responseFormat: 'text',
                    fullResponse: false,
                },
            },
        },
    };

    @node({
        id: 'qconc-parsear-listado',
        name: 'Parsear Listado',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-1152, 0],
    })
    ParsearListado = {
        jsCode: `// Qconciertos: WordPress con JSON-LD ItemList que enumera todos los conciertos
// de la provincia. Cada item es un schema.org Event con location.address.addressLocality.
// Filtramos C15 vía addressLocality.
const cheerio = require('cheerio');

const C15 = new Set([
  'almeria','nijar','tabernas','lucainena de las torres','turrillas',
  'huercal de almeria','viator','pechina','rioja','sorbas',
  'alhama de almeria','benahadux','santa fe de mondujar','finana',
  'abla','abrucena','tres villas las','las tres villas','nacimiento','gergal','gador'
]);

function municipioNorm(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase().replace(/[\\(\\)\\[\\]\\.,;:'"!\\?\\-–—\\/]/g, ' ').replace(/\\s+/g, ' ').trim();
}
function detectarMunicipioC15(loc) {
  if (!loc) return null;
  const last = loc.split(',').pop().trim();
  let norm = municipioNorm(last);
  if (C15.has(norm)) return norm;
  if (/\\btres villas\\b/.test(norm)) return 'las tres villas';
  const sinProv = norm.replace(/\\s+almeria$/, '').trim();
  if (sinProv !== norm && C15.has(sinProv)) return sinProv;
  return null;
}
function clean(t) { return String(t == null ? '' : t).replace(/\\s+/g, ' ').trim(); }
function decodeHtml(t) {
  return String(t || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#8211;/g, '–').replace(/&#8217;/g, "'");
}

const html = String($json.data || $json.body || '');
const _$ = cheerio.load(html);

const events = [];
const seenIds = new Set();

// Extraer JSON-LD ItemList
_$('script[type="application/ld+json"]').each((_, sc) => {
  let d;
  try { d = JSON.parse(_$(sc).html()); } catch (e) { return; }
  const arr = Array.isArray(d) ? d : [d];
  for (const o of arr) {
    if (o['@type'] !== 'ItemList' || !Array.isArray(o.itemListElement)) continue;
    for (const li of o.itemListElement) {
      const ev = li.item || li;
      if (!ev || !(ev['@type'] === 'Event' || (Array.isArray(ev['@type']) && ev['@type'].includes('Event')))) continue;
      const url = clean(ev.url || '');
      if (!url) continue;
      const slug = (url.match(/\\/conciertos\\/([^\\/?#]+)/) || [])[1] || '';
      if (!slug) continue;
      const event_id = 'qconc_' + slug.slice(0, 80);
      if (seenIds.has(event_id)) continue;
      seenIds.add(event_id);

      const titulo = decodeHtml(ev.name || '');
      if (!titulo) continue;
      const startDate = clean(ev.startDate || '').slice(0, 10);
      const endDate = clean(ev.endDate || startDate).slice(0, 10);
      const startTime = (clean(ev.startDate || '').match(/T(\\d{2}:\\d{2})/) || [])[1] || '';

      const loc = ev.location || {};
      const venueName = clean(loc.name || '');
      const ciudad = clean(loc.address?.addressLocality || '');
      const muniNorm = detectarMunicipioC15(ciudad);
      if (!muniNorm) continue;  // fuera C15

      const image = Array.isArray(ev.image) ? clean(ev.image[0]) : clean(ev.image || '');
      const status = clean(ev.eventStatus || '');

      events.push({
        event_id,
        name: titulo,
        datetime_text: startDate + (startTime ? ' ' + startTime : ''),
        venue: venueName,
        event_url: url,
        cartel_url: image,
        slug,
        fecha_inicio_listado: startDate,
        fecha_fin_listado: endDate,
        hora_listado: startTime,
        venue_name: venueName,
        venue_city: ciudad,
        venue_country: clean(loc.address?.addressCountry || ''),
        venue_region: clean(loc.address?.addressRegion || ''),
        municipio_norm: muniNorm,
        eventStatus: status,
        es_espectaculo: true,
        estado_listado: /Cancelled|Postponed/i.test(status) ? 'Modificado' : 'En agenda',
      });
    }
  }
});

return [{ json: { data: { data: { events } } } }];`,
    };

    @node({
        id: 'qconc-split-out',
        name: 'Split Out',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [-928, 0],
    })
    SplitOut = {
        fieldToSplitOut: 'data.data.events',
        include: 'allOtherFields',
        options: {
            disableDotNotation: false,
        },
    };

    @node({
        id: 'qconc-normalizar-titulo',
        name: 'Normalizar Titulo',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-704, 0],
    })
    NormalizarTitulo = {
        mode: 'runOnceForEachItem',
        jsCode: `const event = $json["data.data.events"];
if (!event || !event.name) return $json;

let result = String(event.name).trim();
result = result.replace(/Ñ/g, '__ENE_MAY__').replace(/ñ/g, '__ENE_MIN__');
result = result.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
result = result.replace(/__ENE_MAY__/g, 'Ñ').replace(/__ENE_MIN__/g, 'ñ');
result = result.toUpperCase();
result = result.replace(/[^A-ZÑ0-9,.:+\\- ]/g, '');
result = result.replace(/\\s+/g, ' ').trim();

$json["data.data.events"].name = result;
return $json;`,
    };

    @node({
        id: 'qconc-upsert-raw-front',
        name: 'Upsert raw_front_eventos',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-480, 0],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    UpsertRawFrontEventos = {
        operation: 'executeQuery',
        schema: {
            __rl: true,
            value: 'public',
            mode: 'list',
        },
        table: {
            __rl: true,
            value: 'raw_front_eventos',
            mode: 'list',
        },
        query: `INSERT INTO raw_front_eventos (
    event_id, name, datetime_text, venue, event_url,
    source_storefront, payload_json, last_seen
)
VALUES (
    '{{ $json["data.data.events"].event_id }}',
    '{{ ($json["data.data.events"].name || "").replace(/'/g, "''") }}',
    '{{ ($json["data.data.events"].datetime_text || "").replace(/'/g, "''") }}',
    '{{ ($json["data.data.events"].venue || "").replace(/'/g, "''") }}',
    '{{ ($json["data.data.events"].event_url || "").replace(/'/g, "''") }}',
    'qconciertos_almeria',
    '{{ JSON.stringify($json["data.data.events"]).replace(/'/g, "''") }}'::jsonb,
    NOW()
)
ON CONFLICT (event_id)
DO UPDATE SET
    name = EXCLUDED.name,
    datetime_text = EXCLUDED.datetime_text,
    venue = EXCLUDED.venue,
    event_url = EXCLUDED.event_url,
    source_storefront = EXCLUDED.source_storefront,
    payload_json = EXCLUDED.payload_json,
    last_seen = NOW();`,
        options: {},
    };

    @node({
        id: 'qconc-select-front-sin-detalle',
        name: 'Select front sin detalle',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-256, 0],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    SelectFrontSinDetalle = {
        operation: 'executeQuery',
        schema: {
            __rl: true,
            value: 'public',
            mode: 'list',
        },
        table: {
            __rl: true,
            value: 'raw_front_eventos',
            mode: 'list',
        },
        query: `SELECT f.id, f.event_id, f.name, f.event_url, f.venue, f.payload_json
FROM raw_front_eventos f
LEFT JOIN raw_detalle_eventos d ON f.event_id = d.event_id
WHERE f.source_storefront = 'qconciertos_almeria'
  AND f.event_url IS NOT NULL
  AND d.id IS NULL
  AND COALESCE((f.payload_json->>'es_espectaculo')::boolean, true) = true
ORDER BY f.id;`,
        options: {},
    };

    @node({
        id: 'qconc-loop-eventos',
        name: 'Loop eventos',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [-32, 0],
    })
    LoopEventos = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: 'qconc-fetch-detalle',
        name: 'Fetch Detalle',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [192, 96],
        onError: 'continueRegularOutput',
    })
    FetchDetalle = {
        method: 'GET',
        url: '={{ $json.event_url }}',
        sendHeaders: true,
        specifyHeaders: 'keypair',
        headerParameters: {
            parameters: [
                {
                    name: 'User-Agent',
                    value: 'Mozilla/5.0 (sgae-c15-scraper)',
                },
                {
                    name: 'Accept',
                    value: 'text/html',
                },
            ],
        },
        options: {
            response: {
                response: {
                    responseFormat: 'text',
                    fullResponse: false,
                },
            },
        },
    };

    @node({
        id: 'qconc-parsear-detalle',
        name: 'Parsear Detalle',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [416, 96],
    })
    ParsearDetalle = {
        mode: 'runOnceForEachItem',
        jsCode: `// Qconciertos: el detalle ya viene completo del JSON-LD del listado.
const front = $json || {};
const fp = front.payload_json || {};

const event_id = front.event_id || fp.event_id || '';
const titulo = front.name || fp.name || '';
const event_url = front.event_url || fp.event_url || '';

const fecha_inicio = String(fp.fecha_inicio_listado || '');
const fecha_fin = String(fp.fecha_fin_listado || fecha_inicio);
const hora = String(fp.hora_listado || '');

const tipo_fecha = fecha_inicio
  ? (fecha_fin && fecha_fin !== fecha_inicio ? 'rango' : 'simple')
  : 'texto_no_parseable';

const venue = String(fp.venue_name || front.venue || '');
const ciudad = String(fp.venue_city || '');
const local = ciudad && ciudad !== venue ? venue + ' — ' + ciudad : venue;
const cartel_url = String(fp.cartel_url || '');

const payload = {
  fuente: 'qconciertos_almeria',
  tipo_evento: 'CONCIERTO',
  ticketera: null,
  ticketera_url: event_url,
  estado_listado: fp.estado_listado || 'En agenda',
  precio_min: 0,
  precio_max: 0,
  precio_medio: 0,
  aforo_total: null,
  venue: {
    name: venue,
    city: ciudad,
    region: fp.venue_region || '',
    country: fp.venue_country || '',
  },
  municipio_norm: String(fp.municipio_norm || ''),
  event_status: fp.eventStatus || '',
  slug: fp.slug || '',
};

return {
  json: {
    event_id,
    titulo,
    titulo_original: titulo,
    observacion: '',
    datetime_text_original: front.datetime_text || '',
    fecha_inicio,
    fecha_fin,
    hora_inicio: hora,
    tipo_fecha,
    num_sesiones_estimadas: fecha_inicio ? 1 : null,
    tiene_multiples_sesiones: false,
    precio_entradas: 0,
    precio_medio_entradas: 0,
    local,
    es_gratuito: false,
    cartel_url,
    screenshot_url: '',
    ticketera_url: event_url,
    payload_json: payload,
  },
};`,
    };

    @node({
        id: 'qconc-upsert-raw-detalle',
        name: 'Upsert raw_detalle_eventos',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [640, 96],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    UpsertRawDetalleEventos = {
        operation: 'executeQuery',
        schema: {
            __rl: true,
            value: 'public',
            mode: 'list',
        },
        table: {
            __rl: true,
            value: 'raw_detalle_eventos',
            mode: 'list',
        },
        query: `INSERT INTO raw_detalle_eventos (
    event_id, titulo, titulo_original, observacion,
    datetime_text_original, fecha_inicio, fecha_fin, hora_inicio,
    tipo_fecha, num_sesiones_estimadas, tiene_multiples_sesiones,
    precio_entradas, precio_medio_entradas, local, es_gratuito,
    cartel_url, screenshot_url, ticketera_url, payload_json
)
VALUES (
    '{{ $json.event_id }}',
    '{{ ($json.titulo || "").replace(/'/g, "''") }}',
    '{{ ($json.titulo_original || "").replace(/'/g, "''") }}',
    '{{ ($json.observacion || "").replace(/'/g, "''") }}',
    '{{ ($json.datetime_text_original || "").replace(/'/g, "''") }}',
    CAST(NULLIF('{{ $json.fecha_inicio }}', '') AS DATE),
    CAST(NULLIF('{{ $json.fecha_fin }}', '') AS DATE),
    '{{ $json.hora_inicio || "" }}',
    '{{ $json.tipo_fecha || "texto_no_parseable" }}',
    {{ $json.num_sesiones_estimadas ?? 'NULL' }},
    {{ $json.tiene_multiples_sesiones ? 'true' : 'false' }},
    {{ $json.precio_entradas || 0 }},
    {{ $json.precio_medio_entradas || 0 }},
    '{{ ($json.local || "").replace(/'/g, "''") }}',
    {{ $json.es_gratuito || false }},
    '{{ ($json.cartel_url || "").replace(/'/g, "''") }}',
    '{{ ($json.screenshot_url || "").replace(/'/g, "''") }}',
    '{{ ($json.ticketera_url || "").replace(/'/g, "''") }}',
    '{{ JSON.stringify($json.payload_json || {}).replace(/'/g, "''") }}'::jsonb
)
ON CONFLICT (event_id)
DO UPDATE SET
    titulo = EXCLUDED.titulo,
    titulo_original = EXCLUDED.titulo_original,
    observacion = EXCLUDED.observacion,
    datetime_text_original = EXCLUDED.datetime_text_original,
    fecha_inicio = EXCLUDED.fecha_inicio,
    fecha_fin = EXCLUDED.fecha_fin,
    hora_inicio = EXCLUDED.hora_inicio,
    tipo_fecha = EXCLUDED.tipo_fecha,
    num_sesiones_estimadas = EXCLUDED.num_sesiones_estimadas,
    tiene_multiples_sesiones = EXCLUDED.tiene_multiples_sesiones,
    precio_entradas = EXCLUDED.precio_entradas,
    precio_medio_entradas = EXCLUDED.precio_medio_entradas,
    local = EXCLUDED.local,
    es_gratuito = EXCLUDED.es_gratuito,
    cartel_url = EXCLUDED.cartel_url,
    screenshot_url = EXCLUDED.screenshot_url,
    ticketera_url = EXCLUDED.ticketera_url,
    payload_json = EXCLUDED.payload_json,
    fecha_captura = NOW();`,
        options: {},
    };

    @node({
        id: 'qconc-leer-adjuntos-pendientes',
        name: 'Leer Adjuntos Pendientes',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-32, -320],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    LeerAdjuntosPendientes = {
        operation: 'executeQuery',
        schema: {
            __rl: true,
            value: 'public',
            mode: 'list',
        },
        table: {
            __rl: true,
            value: 'raw_eventos_adjuntos',
            mode: 'list',
        },
        query: `WITH detail_context AS (
    SELECT
      d.event_id, d.titulo, d.fecha_captura, d.fecha_inicio,
      d.cartel_url,
      f.source_storefront AS promotor,
      COALESCE(EXTRACT(YEAR FROM d.fecha_inicio)::text, TO_CHAR(d.fecha_captura, 'YYYY')) AS anio
    FROM raw_detalle_eventos d
    LEFT JOIN raw_front_eventos f ON f.event_id = d.event_id
    WHERE f.source_storefront = 'qconciertos_almeria'
      AND COALESCE(d.cartel_url, '') <> ''
      AND COALESCE(d.adjuntos_descargados, false) = false
)
SELECT pending.event_id, 'cartel' AS tipo, pending.cartel_url AS url_origen,
       pending.titulo, pending.fecha_captura, pending.promotor, pending.anio
FROM detail_context pending
WHERE NOT EXISTS (
    SELECT 1 FROM raw_eventos_adjuntos a
    WHERE a.event_id = pending.event_id AND a.tipo = 'cartel'
)
ORDER BY pending.fecha_captura NULLS LAST, pending.event_id;`,
        options: {},
    };

    @node({
        id: 'qconc-loop-adjuntos',
        name: 'Loop Adjuntos',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [192, -320],
    })
    LoopAdjuntos = {
        batchSize: 10,
        options: {},
    };

    @node({
        id: 'qconc-filtrar-adjuntos',
        name: 'Filtrar Adjuntos Validos',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [416, -384],
    })
    FiltrarAdjuntosValidos = {
        jsCode: `return $input
  .all()
  .filter((item) => String(item.json.url_origen || '').trim().length > 0);`,
    };

    @node({
        id: 'qconc-preparar-adjunto',
        name: 'Preparar Adjunto Dropbox',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [640, -384],
    })
    PrepararAdjuntoDropbox = {
        mode: 'runOnceForEachItem',
        jsCode: `function normalizeSegment(value, fallback = 'sin-valor') {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return normalized || fallback;
}

function extractExtension(url, tipo) {
  const cleanUrl = String(url || '').split('?')[0];
  const match = cleanUrl.match(/\\.([A-Za-z0-9]{2,5})$/);
  if (match) return match[1].toLowerCase();
  return tipo === 'screenshot' ? 'png' : 'jpg';
}

const eventId = String($json.event_id || '').trim();
const tipo = String($json.tipo || '').trim();
const titulo = String($json.titulo || '').trim();
const promotor = normalizeSegment($json.promotor, 'conciertos-club');
const anio = String($json.anio || '').trim() || 'sin-anio';
const tituloSlug = normalizeSegment(titulo, 'evento');
const eventSlug = eventId + '+' + tituloSlug;
const extension = extractExtension($json.url_origen, tipo);
const nombreArchivo = tipo + '.' + extension;
const dropboxFolder = '/0-CANCERBERO/EVENTOS/' + promotor + '/' + anio + '/' + eventSlug;

return {
  ...$json,
  promotor,
  anio,
  titulo_slug: tituloSlug,
  event_slug: eventSlug,
  nombre_archivo: nombreArchivo,
  dropbox_folder: dropboxFolder,
  dropbox_path: dropboxFolder + '/' + nombreArchivo,
};`,
    };

    @node({
        id: 'qconc-descargar-adjunto',
        name: 'Descargar Adjunto',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [864, -384],
        onError: 'continueRegularOutput',
    })
    DescargarAdjunto = {
        url: '={{ $json.url_origen }}',
        options: {
            response: {
                response: {
                    responseFormat: 'file',
                },
            },
        },
    };

    @node({
        id: 'qconc-guardar-dropbox',
        name: 'Guardar en Dropbox',
        type: 'n8n-nodes-base.dropbox',
        version: 1,
        position: [1088, -384],
        credentials: { dropboxOAuth2Api: { id: 'mp4rjzvmnH1bwU8C', name: 'Dropbox account' } },
        onError: 'continueRegularOutput',
    })
    GuardarEnDropbox = {
        authentication: 'oAuth2',
        path: '={{ $json.dropbox_path }}',
        binaryData: true,
    };

    @node({
        id: 'qconc-registrar-adjunto',
        name: 'Registrar Adjunto',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1312, -384],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    RegistrarAdjunto = {
        operation: 'executeQuery',
        schema: {
            __rl: true,
            value: 'public',
            mode: 'list',
        },
        table: {
            __rl: true,
            value: 'raw_eventos_adjuntos',
            mode: 'list',
        },
        query: `INSERT INTO raw_eventos_adjuntos (
    event_id, tipo, url_origen, url_dropbox, nombre_archivo, fecha_captura
)
SELECT
    '{{ (($('Preparar Adjunto Dropbox').item.json.event_id) || "").replace(/'/g, "''") }}',
    '{{ (($('Preparar Adjunto Dropbox').item.json.tipo) || "").replace(/'/g, "''") }}',
    '{{ (($('Preparar Adjunto Dropbox').item.json.url_origen) || "").replace(/'/g, "''") }}',
    '{{ (($('Preparar Adjunto Dropbox').item.json.dropbox_path) || "").replace(/'/g, "''") }}',
    '{{ (($('Preparar Adjunto Dropbox').item.json.nombre_archivo) || "").replace(/'/g, "''") }}',
    COALESCE(CAST(NULLIF('{{ $('Preparar Adjunto Dropbox').item.json.fecha_captura || "" }}', '') AS timestamptz), NOW())
WHERE NOT EXISTS (
    SELECT 1 FROM raw_eventos_adjuntos
    WHERE event_id = '{{ (($('Preparar Adjunto Dropbox').item.json.event_id) || "").replace(/'/g, "''") }}'
      AND tipo = '{{ (($('Preparar Adjunto Dropbox').item.json.tipo) || "").replace(/'/g, "''") }}'
);`,
        options: {
            queryBatching: 'independently',
        },
    };

    @node({
        id: 'qconc-marcar-descargados',
        name: 'Marcar Adjuntos Descargados',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1536, -320],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    MarcarAdjuntosDescargados = {
        operation: 'executeQuery',
        schema: {
            __rl: true,
            value: 'public',
            mode: 'list',
        },
        table: {
            __rl: true,
            value: 'raw_detalle_eventos',
            mode: 'list',
        },
        query: `UPDATE raw_detalle_eventos d
SET adjuntos_descargados = (
    COALESCE(d.cartel_url, '') = '' OR EXISTS (
        SELECT 1 FROM raw_eventos_adjuntos a
        WHERE a.event_id = d.event_id AND a.tipo = 'cartel'
    )
)
WHERE d.event_id = '{{ (($('Preparar Adjunto Dropbox').item.json.event_id) || "").replace(/'/g, "''") }}';`,
        options: {
            queryBatching: 'independently',
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ScheduleTrigger.out(0).to(this.LoadPromoterConfig.in(0));
        this.ManualTrigger.out(0).to(this.LoadPromoterConfig.in(0));
        this.WebhookTrigger.out(0).to(this.LoadPromoterConfig.in(0));
        this.LoadPromoterConfig.out(0).to(this.FetchListado.in(0));
        this.FetchListado.out(0).to(this.ParsearListado.in(0));
        this.ParsearListado.out(0).to(this.SplitOut.in(0));
        this.SplitOut.out(0).to(this.NormalizarTitulo.in(0));
        this.NormalizarTitulo.out(0).to(this.UpsertRawFrontEventos.in(0));
        this.UpsertRawFrontEventos.out(0).to(this.SelectFrontSinDetalle.in(0));
        this.SelectFrontSinDetalle.out(0).to(this.LoopEventos.in(0));
        this.LoopEventos.out(0).to(this.LeerAdjuntosPendientes.in(0));
        this.LoopEventos.out(1).to(this.ParsearDetalle.in(0));
        this.ParsearDetalle.out(0).to(this.UpsertRawDetalleEventos.in(0));
        this.UpsertRawDetalleEventos.out(0).to(this.LoopEventos.in(0));
        this.LeerAdjuntosPendientes.out(0).to(this.LoopAdjuntos.in(0));
        this.LoopAdjuntos.out(1).to(this.FiltrarAdjuntosValidos.in(0));
        this.FiltrarAdjuntosValidos.out(0).to(this.PrepararAdjuntoDropbox.in(0));
        this.PrepararAdjuntoDropbox.out(0).to(this.DescargarAdjunto.in(0));
        this.DescargarAdjunto.out(0).to(this.GuardarEnDropbox.in(0));
        this.GuardarEnDropbox.out(0).to(this.RegistrarAdjunto.in(0));
        this.RegistrarAdjunto.out(0).to(this.MarcarAdjuntosDescargados.in(0));
        this.MarcarAdjuntosDescargados.out(0).to(this.LoopAdjuntos.in(0));
    }
}
