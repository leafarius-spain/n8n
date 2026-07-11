import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SCRAPPER SIENTE LA PLAZA ALMERIA
// Nodes   : 30  |  Connections: 35
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ScheduleTrigger                    scheduleTrigger
// ManualTrigger                      manualTrigger
// WebhookTrigger                     webhook
// LoadPromoterConfig                 postgres                   [creds]
// ScrapeListado                      firecrawl                  [onError→out(1)] [creds] [retry]
// FallbackListado                    httpRequest                [onError→regular]
// ParsearListadoSlp                  code
// Wait                               wait
// SplitOut                           splitOut
// NormalizarTitulo                   code
// UpsertRawFrontEventos              postgres                   [creds]
// SelectFrontSinDetalle              postgres                   [creds]
// LoopEventos                        splitInBatches
// ScrapeDetalleSlp                   firecrawl                  [onError→out(1)] [creds] [retry]
// FallbackDetalle                    httpRequest                [onError→regular]
// ParsearDetalleSlp                  code
// TieneTicketera                     if
// ScrapeEnterticket                  firecrawl                  [onError→out(1)] [creds] [retry]
// FallbackEnterticket                httpRequest                [onError→regular]
// ParsearEnterticket                 code
// ConsolidarDetalle                  code
// UpsertRawDetalleEventos            postgres                   [creds]
// LeerAdjuntosPendientes             postgres                   [creds]
// LoopAdjuntos                       splitInBatches
// FiltrarAdjuntosValidos             code
// PrepararAdjuntoDropbox             code
// DescargarAdjunto                   httpRequest                [onError→out(1)]
// GuardarEnDropbox                   dropbox                    [creds]
// RegistrarAdjunto                   postgres                   [creds]
// MarcarAdjuntosDescargados          postgres                   [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ScheduleTrigger
//    → LoadPromoterConfig
//      → ScrapeListado
//        → ParsearListadoSlp
//          → Wait
//            → SplitOut
//              → NormalizarTitulo
//                → UpsertRawFrontEventos
//                  → SelectFrontSinDetalle
//                    → LoopEventos
//                      → LeerAdjuntosPendientes
//                        → LoopAdjuntos
//                         .out(1) → FiltrarAdjuntosValidos
//                            → PrepararAdjuntoDropbox
//                              → DescargarAdjunto
//                                → GuardarEnDropbox
//                                  → RegistrarAdjunto
//                                    → MarcarAdjuntosDescargados
//                                      → LoopAdjuntos (↩ loop)
//                     .out(1) → ScrapeDetalleSlp
//                        → ParsearDetalleSlp
//                          → TieneTicketera
//                            → ScrapeEnterticket
//                              → ParsearEnterticket
//                                → ConsolidarDetalle
//                                  → UpsertRawDetalleEventos
//                                    → LoopEventos (↩ loop)
//                             .out(1) → FallbackEnterticket
//                                → ParsearEnterticket (↩ loop)
//                           .out(1) → ConsolidarDetalle (↩ loop)
//                       .out(1) → FallbackDetalle
//                          → ParsearDetalleSlp (↩ loop)
//       .out(1) → FallbackListado
//          → ParsearListadoSlp (↩ loop)
// ManualTrigger
//    → LoadPromoterConfig (↩ loop)
// WebhookTrigger
//    → LoadPromoterConfig (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'U50oZWDCMenx7ug1',
    name: 'SCRAPPER SIENTE LA PLAZA ALMERIA',
    active: true,
    isArchived: false,
    settings: {
        errorWorkflow: 'IkqnFDu34CjPjXBj',
        timezone: 'Europe/Madrid',
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
        binaryMode: 'separate',
        timeSavedMode: 'dynamic',
        executionTimeout: 3600,
    },
})
export class ScrapperSienteLaPlazaAlmeriaWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'slp-schedule-trigger',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.3,
        position: [-1600, 0],
    })
    ScheduleTrigger = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 2 * * 1-6',
                },
            ],
        },
    };

    @node({
        id: 'slp-manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-1600, 192],
    })
    ManualTrigger = {};

    @node({
        id: 'slp-webhook-trigger',
        webhookId: 'siente-trigger-test',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1600, 384],
    })
    WebhookTrigger = {
        httpMethod: 'POST',
        path: 'siente-trigger-test',
        responseMode: 'lastNode',
        options: {},
    };

    @node({
        id: 'slp-load-promoter-config',
        name: 'Load Promoter Config',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-1376, 0],
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
WHERE promotor_id = 'siente_plaza'
  AND habilitado = true;`,
        options: {},
    };

    @node({
        id: 'slp-scrape-listado',
        name: 'Scrape Listado',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [-1152, 0],
        credentials: { firecrawlApi: { id: '3FsKPT3ZQeVfmMkM', name: 'Firecrawl account' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
    })
    ScrapeListado = {
        operation: 'scrape',
        url: '={{ $json.url_lista }}',
        scrapeOptions: {
            options: {
                formats: {
                    format: [
                        {
                            type: 'html',
                        },
                    ],
                },
                onlyMainContent: false,
                headers: {},
            },
        },
        requestOptions: {},
    };

    @node({
        id: 'slp-fallback-listado',
        name: 'Fallback Listado',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [-1152, 224],
        onError: 'continueRegularOutput',
    })
    FallbackListado = {
        method: 'POST',
        url: 'http://172.18.0.1:8021/scrape',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'X-Api-Key',
                    value: '={{ $env.SGF_API_KEY }}',
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={{ JSON.stringify({ url: ($json.url_lista || $(\'Load Promoter Config\').first().json.url_lista), formats: ["html"], wait_ms: 3000 }) }}',
        options: {},
    };

    @node({
        id: 'slp-parsear-listado',
        name: 'Parsear Listado SLP',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-928, 0],
    })
    ParsearListadoSlp = {
        jsCode: `const cheerio = require('cheerio');
const html = ($json.data && $json.data.html) || '';

if (!html) {
  return [{ json: { data: { data: { events: [] } } } }];
}

const BASE = 'https://sientelaplaza.com/';
const $ = cheerio.load(html);
const events = [];

function clean(t) {
  return String(t || '').replace(/\\s+/g, ' ').trim();
}

function absoluteUrl(rel) {
  const r = String(rel || '').trim();
  if (!r) return '';
  if (r.startsWith('http://') || r.startsWith('https://')) return r;
  return BASE + r.replace(/^\\/+/, '');
}

// host esperado: el listado pertenece a sientelaplaza.com.
// Algunas tarjetas (p.ej. Aguilera y Meni) enlazan a otra ticketera externa
// (crashmusic, etc.) — esas no son eventos parseables con este flujo y se descartan.
const HOST = 'sientelaplaza.com';

// extrae slug + host sin usar new URL() (no disponible en el sandbox del Code node)
function extractSlug(rawHref) {
  const u = String(rawHref || '').trim();
  if (!u) return { slug: '', host: '' };
  let host = HOST;
  let path = u;
  const m = u.match(/^https?:\\/\\/([^\\/?#]+)(\\/[^?#]*)?/);
  if (m) {
    host = (m[1] || '').toLowerCase();
    path = m[2] || '';
  }
  const cleanPath = String(path || '').replace(/^\\/+/, '').replace(/\\/+$/, '').replace(/[?#].*$/, '');
  if (!cleanPath) return { slug: '', host };
  const segs = cleanPath.split('/').filter(Boolean);
  const last = segs.length ? segs[segs.length - 1] : '';
  return { slug: last, host };
}

$('a.enlace_evento.col-agenda').each((_, a) => {
  const $a = $(a);
  const href = clean($a.attr('href') || '');
  if (!href) return;

  const { slug, host } = extractSlug(href);
  if (!slug) return;
  if (host && host.replace(/^www\\./, '') !== HOST) return; // ignora externos (crashmusic, etc.)

  const event_id = 'slp_' + slug;
  const event_url = absoluteUrl(href);

  const card = $a.find('.concert-card').first();
  const styleAttr = card.find('.concert-image').first().attr('style') || '';
  const cartelMatch = styleAttr.match(/url\\(\\s*['"]?([^'"\\)]+)/);
  const cartel_url = cartelMatch ? absoluteUrl(cartelMatch[1]) : '';

  const titles = card.find('.concert-info .concert-title')
    .map((_i, e) => clean($(e).text())).get();
  const details = card.find('.concert-info .concert-details')
    .map((_i, e) => clean($(e).text())).get();

  const titulo = titles[0] || '';
  const fechaHoraText = titles[1] || '';
  const lugar = details[0] || '';
  const estado = details[1] || '';

  if (!titulo) return;

  events.push({
    event_id,
    name: titulo,
    datetime_text: fechaHoraText,
    venue: lugar,
    event_url,
    cartel_url,
    estado_listado: estado,
    slug,
  });
});

return [{ json: { data: { data: { events } } } }];`,
    };

    @node({
        id: 'slp-wait',
        webhookId: 'slp-wait-1',
        name: 'Wait',
        type: 'n8n-nodes-base.wait',
        version: 1.1,
        position: [-704, 0],
    })
    Wait = {};

    @node({
        id: 'slp-split-out',
        name: 'Split Out',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [-480, 0],
    })
    SplitOut = {
        fieldToSplitOut: 'data.data.events',
        include: 'allOtherFields',
        options: {
            disableDotNotation: false,
        },
    };

    @node({
        id: 'slp-normalizar-titulo',
        name: 'Normalizar Titulo',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-256, 0],
    })
    NormalizarTitulo = {
        mode: 'runOnceForEachItem',
        jsCode: `const event = $json["data.data.events"];

if (!event || !event.name) {
  return $json;
}

let result = String(event.name).trim();

result = result
  .replace(/Ñ/g, '__ENE_MAY__')
  .replace(/ñ/g, '__ENE_MIN__');

result = result
  .normalize('NFD')
  .replace(/[\\u0300-\\u036f]/g, '');

result = result
  .replace(/__ENE_MAY__/g, 'Ñ')
  .replace(/__ENE_MIN__/g, 'ñ');

result = result.toUpperCase();
result = result.replace(/[^A-ZÑ0-9,.:+\\- ]/g, '');
result = result.replace(/\\s+/g, ' ').trim();

$json["data.data.events"].name = result;

return $json;`,
    };

    @node({
        id: 'slp-upsert-raw-front',
        name: 'Upsert raw_front_eventos',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-32, 0],
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
    event_id,
    name,
    datetime_text,
    venue,
    event_url,
    source_storefront,
    payload_json,
    last_seen
)
VALUES (
    '{{ $json["data.data.events"].event_id }}',
    '{{ ($json["data.data.events"].name || "").replace(/'/g, "''") }}',
    '{{ ($json["data.data.events"].datetime_text || "").replace(/'/g, "''") }}',
    '{{ ($json["data.data.events"].venue || "").replace(/'/g, "''") }}',
    '{{ ($json["data.data.events"].event_url || "").replace(/'/g, "''") }}',
    'siente_plaza_almeria',
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
        id: 'slp-select-front-sin-detalle',
        name: 'Select front sin detalle',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [192, 0],
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
WHERE f.source_storefront = 'siente_plaza_almeria'
  AND f.event_url IS NOT NULL
  AND d.id IS NULL
ORDER BY f.id;`,
        options: {},
    };

    @node({
        id: 'slp-loop-eventos',
        name: 'Loop eventos',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [416, 0],
    })
    LoopEventos = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: 'slp-scrape-detalle',
        name: 'Scrape Detalle SLP',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [640, 96],
        credentials: { firecrawlApi: { id: '3FsKPT3ZQeVfmMkM', name: 'Firecrawl account' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
        waitBetweenTries: 5000,
    })
    ScrapeDetalleSlp = {
        operation: 'scrape',
        url: '={{ $json.event_url }}',
        scrapeOptions: {
            options: {
                formats: {
                    format: [
                        {
                            type: 'html',
                        },
                        {
                            type: 'rawHtml',
                        },
                        {
                            type: 'screenshot',
                            fullPage: true,
                            quality: 80,
                            viewportWidth: 1920,
                            viewportHeight: 3000,
                        },
                    ],
                },
                onlyMainContent: false,
                headers: {},
                waitFor: 2500,
                proxy: 'stealth',
            },
        },
        requestOptions: {},
    };

    @node({
        id: 'slp-fallback-detalle',
        name: 'Fallback Detalle',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [640, 288],
        onError: 'continueRegularOutput',
    })
    FallbackDetalle = {
        method: 'POST',
        url: 'http://172.18.0.1:8021/scrape',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'X-Api-Key',
                    value: '={{ $env.SGF_API_KEY }}',
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={{ JSON.stringify({ url: ($json.event_url || $(\'Loop eventos\').first().json.event_url), formats: ["html", "metadata"], wait_ms: 3500 }) }}',
        options: {},
    };

    @node({
        id: 'slp-parsear-detalle',
        name: 'Parsear Detalle SLP',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [864, 96],
    })
    ParsearDetalleSlp = {
        mode: 'runOnceForEachItem',
        jsCode: `const cheerio = require('cheerio');

const MONTHS = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
  JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12',
};

function clean(t) {
  return String(t || '').replace(/\\s+/g, ' ').trim();
}

function normalizeUpper(t) {
  return clean(t).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase();
}

function parseFechasES(text) {
  const norm = normalizeUpper(text);
  const fechas = [];
  const horas = [];

  const reFecha = /(\\d{1,2})\\s*\\|\\s*([A-ZÑ]+)\\s*\\|\\s*(\\d{4})/g;
  let m;
  while ((m = reFecha.exec(norm)) !== null) {
    const mes = MONTHS[m[2]];
    if (!mes) continue;
    fechas.push(m[3] + '-' + mes + '-' + String(m[1]).padStart(2, '0'));
  }

  const reHora = /(\\d{1,2}:\\d{2})/g;
  while ((m = reHora.exec(norm)) !== null) {
    if (!horas.includes(m[1])) horas.push(m[1]);
  }

  return { fechas, horas };
}

const it = $json || {};
const data = it.data || {};
// Preferimos el HTML que contenga el iframe de la ticketera (Firecrawl puede
// sanitizar el iframe con data-consent-target en el HTML "limpio" — el rawHtml
// suele preservarlo).
const htmlClean = data.html || '';
const htmlRaw = data.rawHtml || '';
let html = htmlRaw && htmlRaw.includes('enterticket') ? htmlRaw
         : htmlClean && htmlClean.includes('enterticket') ? htmlClean
         : (htmlClean || htmlRaw);
const screenshot_url = data.screenshot || '';
const meta = data.metadata || {};
const event_url = (meta.sourceURL || meta['og:url'] || meta.url || '').toString();

// runOnceForEachItem: $('NodoX').item devuelve el item del nodo X emparejado al actual
const front = $('Loop eventos').item.json || {};
const front_payload = front.payload_json || {};
const event_id = front.event_id || front_payload.event_id || '';
const cartel_listado = front_payload.cartel_url || '';
const titulo_listado = front.name || front_payload.name || '';
const venue_listado = front.venue || front_payload.venue || '';
const slug = front_payload.slug || (event_id || '').replace(/^slp_/, '');
const estado_listado = front_payload.estado_listado || '';
const datetime_text_listado = front_payload.datetime_text || '';

const $$ = cheerio.load(html || '');
const cont = $$('div.contenedor_ventas').first();
const titulo_detalle = clean(cont.find('h3').first().text());
const subtitulo = clean(cont.find('h4').first().text());
const h5s = cont.find('h5').map((_i, e) => clean($$(e).text())).get();
const fechaHora_detalle = h5s[0] || '';
const lugar_detalle = h5s[1] || '';

// Firecrawl convierte el <iframe> de la ticketera en <div data-consent-target src=...>
// (sanitización por seguridad). Probamos primero con iframe estándar, luego con div
// data-consent-target, y por último regex sobre el HTML crudo (más robusto).
let ticketera_url = '';
const ifNode = $$('iframe[src*="enterticket"]').first();
if (ifNode.length) {
  ticketera_url = clean(ifNode.attr('src') || '');
} else {
  const divNode = $$('[data-consent-target][src*="enterticket"]').first();
  if (divNode.length) ticketera_url = clean(divNode.attr('src') || '');
}
if (!ticketera_url) {
  const m = String(html || '').match(/https?:\\/\\/[^\\s'"<>]*enterticket\\.es\\/buy\\/?\\?id=\\d+[^\\s'"<>]*/i);
  if (m) ticketera_url = m[0].replace(/&amp;/g, '&');
}
const idMatch = ticketera_url.match(/[?&]id=(\\d+)/);
const ticketera_id = idMatch ? idMatch[1] : '';
const ticketera_proveedor = ticketera_id ? 'enterticket' : '';

const { fechas, horas } = parseFechasES(fechaHora_detalle || datetime_text_listado);
const fecha_inicio = fechas[0] || '';
const fecha_fin = fechas[fechas.length - 1] || fecha_inicio;
const hora_inicio = horas[0] || '';
const tiene_multiples_sesiones = fechas.length > 1 || horas.length > 1;
const num_sesiones_estimadas = fechas.length || (fecha_inicio ? 1 : null);
let tipo_fecha = 'simple';
if (fechas.length > 1 && horas.length === 1) tipo_fecha = 'rango_misma_hora';
else if (fechas.length > 1) tipo_fecha = 'rango';
else if (horas.length > 1) tipo_fecha = 'multiple_sesiones';
else if (!fecha_inicio) tipo_fecha = 'texto_no_parseable';

const lugarFuente = lugar_detalle || venue_listado || '';
const partsLugar = lugarFuente.split('|').map((s) => s.trim()).filter(Boolean);
const local = partsLugar.length > 1 ? partsLugar.slice(1).join(' | ') : lugarFuente;

const sesiones = fechas.map((f, idx) => ({
  indice: idx,
  fecha: f,
  hora: horas.length === 1 ? horas[0] : (horas[idx] || ''),
}));

return {
  json: {
    event_id,
    slug,
    titulo: titulo_detalle || titulo_listado,
    titulo_original: titulo_listado || titulo_detalle,
    observacion: subtitulo,
    datetime_text_original: fechaHora_detalle || datetime_text_listado,
    fecha_inicio,
    fecha_fin,
    hora_inicio,
    tipo_fecha,
    num_sesiones_estimadas,
    tiene_multiples_sesiones,
    local,
    es_gratuito: false,
    cartel_url: cartel_listado,
    screenshot_url,
    ticketera_url,
    ticketera_id,
    ticketera_proveedor,
    event_url,
    estado_listado,
    sesiones,
  },
};`,
    };

    @node({
        id: 'slp-if-tiene-ticketera',
        name: 'Tiene ticketera',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1088, 96],
    })
    TieneTicketera = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 2,
            },
            conditions: [
                {
                    leftValue: '={{ $json.ticketera_id }}',
                    rightValue: '',
                    operator: {
                        type: 'string',
                        operation: 'notEmpty',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: 'slp-scrape-enterticket',
        name: 'Scrape Enterticket',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [1312, 0],
        credentials: { firecrawlApi: { id: '3FsKPT3ZQeVfmMkM', name: 'Firecrawl account' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
        waitBetweenTries: 5000,
    })
    ScrapeEnterticket = {
        operation: 'scrape',
        url: '={{ $json.ticketera_url }}',
        scrapeOptions: {
            options: {
                formats: {
                    format: [
                        {
                            type: 'html',
                        },
                    ],
                },
                onlyMainContent: false,
                headers: {},
                waitFor: 2500,
                proxy: 'stealth',
            },
        },
        requestOptions: {},
    };

    @node({
        id: 'slp-fallback-enterticket',
        name: 'Fallback Enterticket',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1312, 224],
        onError: 'continueRegularOutput',
    })
    FallbackEnterticket = {
        method: 'POST',
        url: 'http://172.18.0.1:8021/scrape',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'X-Api-Key',
                    value: '={{ $env.SGF_API_KEY }}',
                },
            ],
        },
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={{ JSON.stringify({ url: ($json.ticketera_url || $(\'Parsear Detalle SLP\').first().json.ticketera_url), formats: ["html"], wait_ms: 3000 }) }}',
        options: {},
    };

    @node({
        id: 'slp-parsear-enterticket',
        name: 'Parsear Enterticket',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1536, 0],
    })
    ParsearEnterticket = {
        mode: 'runOnceForEachItem',
        jsCode: `const cheerio = require('cheerio');

function clean(t) {
  return String(t || '').replace(/\\s+/g, ' ').trim();
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

const it = $json || {};
const data = it.data || {};
const html = data.html || data.rawHtml || '';

// runOnceForEachItem: $('Parsear Detalle SLP').item está emparejado con el actual
const detalle = $('Parsear Detalle SLP').item.json || {};

const $$ = cheerio.load(html || '');
const root = $$('[data-id-recinto]').first();
const recinto_id = clean(root.attr('data-id-recinto') || '');
const divisa = clean(root.attr('data-divisa') || 'EUR');

const entradas = [];
$$('li.et-entrada').each((_i, li) => {
  const $li = $$(li);
  const id_categoria = clean($li.attr('data-id-entrada') || '');
  if (!id_categoria) return;
  const nombre = clean($li.find('.et-entrada-nombre-txt').first().text());
  const inp = $li.find('input.et-entrada-cantidad').first();
  const precio = parseFloat(inp.attr('data-precio') || '0') || 0;
  const aforo = parseInt(inp.attr('data-num-asientos') || '0', 10) || 0;
  entradas.push({ id_categoria, nombre, precio, aforo });
});

const conPrecio = entradas.filter((e) => e.precio > 0);
const conAforo = entradas.filter((e) => e.aforo > 0);
const aforo_total = entradas.reduce((s, e) => s + e.aforo, 0);
const precio_min = conPrecio.length ? Math.min(...conPrecio.map((e) => e.precio)) : 0;
const precio_max = conPrecio.length ? Math.max(...conPrecio.map((e) => e.precio)) : 0;

let precio_medio = 0;
if (conAforo.length && conAforo.some((e) => e.precio > 0)) {
  const numerador = conAforo.reduce((s, e) => s + e.precio * e.aforo, 0);
  const denominador = conAforo.reduce((s, e) => s + e.aforo, 0);
  precio_medio = denominador > 0 ? round2(numerador / denominador) : 0;
} else if (conPrecio.length) {
  precio_medio = round2(conPrecio.reduce((s, e) => s + e.precio, 0) / conPrecio.length);
}

return {
  json: {
    ...detalle,
    precio_entradas: precio_min,
    precio_medio_entradas: precio_medio,
    precio_max,
    aforo_total,
    es_gratuito: false,
    ticketera_recinto_id: recinto_id,
    ticketera_divisa: divisa,
    entradas,
  },
};`,
    };

    @node({
        id: 'slp-consolidar-detalle',
        name: 'Consolidar Detalle',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1760, 96],
    })
    ConsolidarDetalle = {
        jsCode: `const items = $input.all();
const out = [];

for (let i = 0; i < items.length; i++) {
  const j = items[i].json || {};
  const entradas = Array.isArray(j.entradas) ? j.entradas : [];

  const payload = {
    ticketera: j.ticketera_url
      ? {
          proveedor: j.ticketera_proveedor || 'enterticket',
          id_externo: j.ticketera_id || '',
          url: j.ticketera_url || '',
          recinto_id: j.ticketera_recinto_id || '',
          divisa: j.ticketera_divisa || 'EUR',
        }
      : null,
    aforo_total: j.aforo_total ?? null,
    precio_min: j.precio_entradas ?? null,
    precio_max: j.precio_max ?? null,
    precio_medio: j.precio_medio_entradas ?? null,
    entradas,
    sesiones: Array.isArray(j.sesiones) ? j.sesiones : [],
    estado_listado: j.estado_listado || '',
    fuente: 'siente_plaza_almeria',
  };

  out.push({
    json: {
      event_id: j.event_id || '',
      titulo: j.titulo || '',
      titulo_original: j.titulo_original || '',
      observacion: j.observacion || '',
      datetime_text_original: j.datetime_text_original || '',
      fecha_inicio: j.fecha_inicio || '',
      fecha_fin: j.fecha_fin || '',
      hora_inicio: j.hora_inicio || '',
      tipo_fecha: j.tipo_fecha || 'texto_no_parseable',
      num_sesiones_estimadas: j.num_sesiones_estimadas ?? null,
      tiene_multiples_sesiones: !!j.tiene_multiples_sesiones,
      precio_entradas: j.precio_entradas ?? 0,
      precio_medio_entradas: j.precio_medio_entradas ?? 0,
      local: j.local || '',
      es_gratuito: !!j.es_gratuito,
      cartel_url: j.cartel_url || '',
      screenshot_url: j.screenshot_url || '',
      ticketera_url: j.ticketera_url || '',
      payload_json: payload,
    },
    pairedItem: { item: i },
  });
}

return out;`,
    };

    @node({
        id: 'slp-upsert-raw-detalle',
        name: 'Upsert raw_detalle_eventos',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1984, 96],
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
    event_id,
    titulo,
    titulo_original,
    observacion,
    datetime_text_original,
    fecha_inicio,
    fecha_fin,
    hora_inicio,
    tipo_fecha,
    num_sesiones_estimadas,
    tiene_multiples_sesiones,
    precio_entradas,
    precio_medio_entradas,
    local,
    es_gratuito,
    cartel_url,
    screenshot_url,
    ticketera_url,
    payload_json
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
        id: 'slp-leer-adjuntos-pendientes',
        name: 'Leer Adjuntos Pendientes',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [416, -320],
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
            value: 'raw_detalle_eventos',
            mode: 'list',
        },
        query: `WITH detail_context AS (
    SELECT
      d.event_id,
      d.titulo,
      d.fecha_captura,
      d.fecha_inicio,
      d.cartel_url,
      d.screenshot_url,
      COALESCE(pc.promotor_id, f.source_storefront, 'sin_promotor') AS promotor,
      COALESCE(EXTRACT(YEAR FROM d.fecha_inicio)::text, TO_CHAR(d.fecha_captura, 'YYYY')) AS anio
    FROM raw_detalle_eventos d
    LEFT JOIN raw_front_eventos f ON f.event_id = d.event_id
    LEFT JOIN promotores_configuracion pc
      ON f.event_url LIKE split_part(pc.url_lista, '?', 1) || '%'
    WHERE f.source_storefront = 'siente_plaza_almeria'
      AND (
        COALESCE(d.cartel_url, '') <> ''
        OR COALESCE(d.screenshot_url, '') <> ''
      )
      AND COALESCE(d.adjuntos_descargados, false) = false
  )
  SELECT
    pending.event_id,
    pending.tipo,
    pending.url_origen,
    pending.titulo,
    pending.fecha_captura,
    pending.promotor,
    pending.anio
  FROM (
    SELECT
      d.event_id,
      'cartel' AS tipo,
      d.cartel_url AS url_origen,
      d.titulo,
      d.fecha_captura,
      d.promotor,
      d.anio
    FROM detail_context d
    WHERE COALESCE(d.cartel_url, '') <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM raw_eventos_adjuntos a
        WHERE a.event_id = d.event_id
          AND a.tipo = 'cartel'
      )

    UNION ALL

    SELECT
      d.event_id,
      'screenshot' AS tipo,
      d.screenshot_url AS url_origen,
      d.titulo,
      d.fecha_captura,
      d.promotor,
      d.anio
    FROM detail_context d
    WHERE COALESCE(d.screenshot_url, '') <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM raw_eventos_adjuntos a
        WHERE a.event_id = d.event_id
          AND a.tipo = 'screenshot'
      )
  ) pending
  ORDER BY pending.fecha_captura NULLS LAST, pending.event_id, pending.tipo
  LIMIT 20;`,
        options: {},
    };

    @node({
        id: 'slp-loop-adjuntos',
        name: 'Loop Adjuntos',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [640, -320],
    })
    LoopAdjuntos = {
        batchSize: 10,
        options: {},
    };

    @node({
        id: 'slp-filtrar-adjuntos',
        name: 'Filtrar Adjuntos Validos',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [864, -384],
    })
    FiltrarAdjuntosValidos = {
        jsCode: `return $input
  .all()
  .filter((item) => String(item.json.url_origen || '').trim().length > 0);`,
    };

    @node({
        id: 'slp-preparar-adjunto',
        name: 'Preparar Adjunto Dropbox',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1088, -384],
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
const promotor = normalizeSegment($json.promotor, 'siente-plaza-almeria');
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
        id: 'slp-descargar-adjunto',
        name: 'Descargar Adjunto',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1312, -384],
        onError: 'continueErrorOutput',
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
        id: 'slp-guardar-dropbox',
        name: 'Guardar en Dropbox',
        type: 'n8n-nodes-base.dropbox',
        version: 1,
        position: [1536, -384],
        credentials: { dropboxOAuth2Api: { id: 'mp4rjzvmnH1bwU8C', name: 'Dropbox account' } },
    })
    GuardarEnDropbox = {
        authentication: 'oAuth2',
        path: '={{ $json.dropbox_path }}',
        binaryData: true,
    };

    @node({
        id: 'slp-registrar-adjunto',
        name: 'Registrar Adjunto',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1760, -384],
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
    event_id,
    tipo,
    url_origen,
    url_dropbox,
    nombre_archivo,
    fecha_captura
  )
  SELECT
      '{{ (($('Preparar Adjunto Dropbox').item.json.event_id) || "").replace(/'/g, "''") }}',
      '{{ (($('Preparar Adjunto Dropbox').item.json.tipo) || "").replace(/'/g, "''") }}',
      '{{ (($('Preparar Adjunto Dropbox').item.json.url_origen) || "").replace(/'/g, "''") }}',
      '{{ (($('Preparar Adjunto Dropbox').item.json.dropbox_path) || "").replace(/'/g, "''") }}',
      '{{ (($('Preparar Adjunto Dropbox').item.json.nombre_archivo) || "").replace(/'/g, "''") }}',
      COALESCE(CAST(NULLIF('{{ $('Preparar Adjunto Dropbox').item.json.fecha_captura || "" }}', '') AS timestamptz), NOW())
  WHERE NOT EXISTS (
    SELECT 1
    FROM raw_eventos_adjuntos
    WHERE event_id = '{{ (($('Preparar Adjunto Dropbox').item.json.event_id) || "").replace(/'/g, "''") }}'
      AND tipo = '{{ (($('Preparar Adjunto Dropbox').item.json.tipo) || "").replace(/'/g, "''") }}'
  );`,
        options: {
            queryBatching: 'independently',
        },
    };

    @node({
        id: 'slp-marcar-descargados',
        name: 'Marcar Adjuntos Descargados',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1984, -320],
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
    (COALESCE(d.cartel_url, '') = '' OR EXISTS (
      SELECT 1
      FROM raw_eventos_adjuntos a
      WHERE a.event_id = d.event_id
        AND a.tipo = 'cartel'
    ))
    AND
    (COALESCE(d.screenshot_url, '') = '' OR EXISTS (
      SELECT 1
      FROM raw_eventos_adjuntos a
      WHERE a.event_id = d.event_id
        AND a.tipo = 'screenshot'
    ))
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
        this.LoadPromoterConfig.out(0).to(this.ScrapeListado.in(0));
        this.ScrapeListado.out(0).to(this.ParsearListadoSlp.in(0));
        this.ScrapeListado.out(1).to(this.FallbackListado.in(0));
        this.FallbackListado.out(0).to(this.ParsearListadoSlp.in(0));
        this.ParsearListadoSlp.out(0).to(this.Wait.in(0));
        this.Wait.out(0).to(this.SplitOut.in(0));
        this.SplitOut.out(0).to(this.NormalizarTitulo.in(0));
        this.NormalizarTitulo.out(0).to(this.UpsertRawFrontEventos.in(0));
        this.UpsertRawFrontEventos.out(0).to(this.SelectFrontSinDetalle.in(0));
        this.SelectFrontSinDetalle.out(0).to(this.LoopEventos.in(0));
        this.LoopEventos.out(0).to(this.LeerAdjuntosPendientes.in(0));
        this.LoopEventos.out(1).to(this.ScrapeDetalleSlp.in(0));
        this.ScrapeDetalleSlp.out(0).to(this.ParsearDetalleSlp.in(0));
        this.ScrapeDetalleSlp.out(1).to(this.FallbackDetalle.in(0));
        this.FallbackDetalle.out(0).to(this.ParsearDetalleSlp.in(0));
        this.ParsearDetalleSlp.out(0).to(this.TieneTicketera.in(0));
        this.TieneTicketera.out(0).to(this.ScrapeEnterticket.in(0));
        this.TieneTicketera.out(1).to(this.ConsolidarDetalle.in(0));
        this.ScrapeEnterticket.out(0).to(this.ParsearEnterticket.in(0));
        this.ScrapeEnterticket.out(1).to(this.FallbackEnterticket.in(0));
        this.FallbackEnterticket.out(0).to(this.ParsearEnterticket.in(0));
        this.ParsearEnterticket.out(0).to(this.ConsolidarDetalle.in(0));
        this.ConsolidarDetalle.out(0).to(this.UpsertRawDetalleEventos.in(0));
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
