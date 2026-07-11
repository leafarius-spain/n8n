import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SCRAPPER ENTRADAS COM ALMERIA
// Nodes   : 26  |  Connections: 28
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ScheduleTrigger                    scheduleTrigger
// ManualTrigger                      manualTrigger
// WebhookTrigger                     webhook
// LoadPromoterConfig                 postgres                   [creds]
// GenerarSitemaps                    code
// FetchListado                       httpRequest                [onError→regular]
// DescomprimirSitemap                compression                [onError→regular]
// ExtraerXml                         extractFromFile            [onError→regular]
// ParsearListado                     code
// SplitOut                           splitOut
// NormalizarTitulo                   code
// UpsertRawFrontEventos              postgres                   [creds]
// SelectFrontSinDetalle              postgres                   [creds]
// LoopEventos                        splitInBatches
// FetchDetalle                       firecrawl                  [onError→out(1)] [creds] [retry]
// FallbackDetalle                    httpRequest                [onError→regular]
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
//      → GenerarSitemaps
//        → FetchListado
//          → DescomprimirSitemap
//            → ExtraerXml
//              → ParsearListado
//                → SplitOut
//                  → NormalizarTitulo
//                    → UpsertRawFrontEventos
//                      → SelectFrontSinDetalle
//                        → LoopEventos
//                          → LeerAdjuntosPendientes
//                            → LoopAdjuntos
//                             .out(1) → FiltrarAdjuntosValidos
//                                → PrepararAdjuntoDropbox
//                                  → DescargarAdjunto
//                                    → GuardarEnDropbox
//                                      → RegistrarAdjunto
//                                        → MarcarAdjuntosDescargados
//                                          → LoopAdjuntos (↩ loop)
//                         .out(1) → FetchDetalle
//                            → ParsearDetalle
//                              → UpsertRawDetalleEventos
//                                → LoopEventos (↩ loop)
//                           .out(1) → FallbackDetalle
//                              → ParsearDetalle (↩ loop)
// ManualTrigger
//    → LoadPromoterConfig (↩ loop)
// WebhookTrigger
//    → LoadPromoterConfig (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'f18YFbCMFf1J2WB5',
    name: 'SCRAPPER ENTRADAS COM ALMERIA',
    active: true,
    isArchived: false,
    settings: {
        errorWorkflow: 'IkqnFDu34CjPjXBj',
        timezone: 'Europe/Madrid',
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
    },
})
export class ScrapperEntradasComAlmeriaWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'entradascom-schedule-trigger',
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
                    expression: '0 13 * * 1-6',
                },
            ],
        },
    };

    @node({
        id: 'entradascom-manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-1820, 192],
    })
    ManualTrigger = {};

    @node({
        id: 'entradascom-webhook-trigger',
        webhookId: 'entradascom-trigger-test',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1820, 384],
    })
    WebhookTrigger = {
        httpMethod: 'POST',
        path: 'entradascom-trigger-test',
        responseMode: 'lastNode',
        options: {},
    };

    @node({
        id: 'entradascom-load-promoter-config',
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
WHERE promotor_id = 'entradas_almeria'
  AND habilitado = true;`,
        options: {},
    };

    @node({
        id: 'entradascom-generar-sitemaps',
        name: 'Generar Sitemaps',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-1480, 0],
    })
    GenerarSitemaps = {
        jsCode: `const promoter = ($input.all()[0] && $input.all()[0].json) || {};
const baseSitemap = String(promoter.url_lista || 'https://www.entradas.com/staticsite/sitemap/EES/').replace(/\\/?$/, '/');
const out = [];
for (const f of ['events1_es', 'events2_es', 'events3_es']) {
  out.push({
    json: {
      ...promoter,
      url_listado: baseSitemap + f + '.xml.gz',
      sitemap_name: f,
    },
  });
}
return out;`,
    };

    @node({
        id: 'entradascom-fetch-listado',
        name: 'Fetch Listado',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [-1376, 0],
        onError: 'continueRegularOutput',
    })
    FetchListado = {
        method: 'GET',
        url: '={{ $json.url_listado }}',
        sendHeaders: true,
        specifyHeaders: 'keypair',
        headerParameters: {
            parameters: [
                {
                    name: 'User-Agent',
                    value: 'Mozilla/5.0 (sgae-c15-scraper)',
                },
            ],
        },
        options: {
            response: {
                response: {
                    responseFormat: 'file',
                    outputPropertyName: 'data',
                },
            },
        },
    };

    @node({
        id: 'entradascom-descomprimir',
        name: 'Descomprimir Sitemap',
        type: 'n8n-nodes-base.compression',
        version: 1.1,
        position: [-1264, 0],
        onError: 'continueRegularOutput',
    })
    DescomprimirSitemap = {
        operation: 'decompress',
        binaryPropertyName: 'data',
        outputFormat: 'gzip',
        binaryPropertyOutput: 'data',
        fileName: '',
        outputPrefix: 'data',
    };

    @node({
        id: 'entradascom-extraer-xml',
        name: 'Extraer XML',
        type: 'n8n-nodes-base.extractFromFile',
        version: 1.1,
        position: [-1216, 0],
        onError: 'continueRegularOutput',
    })
    ExtraerXml = {
        operation: 'text',
        binaryPropertyName: 'data0',
        destinationKey: 'data',
        options: {},
    };

    @node({
        id: 'entradascom-parsear-listado',
        name: 'Parsear Listado',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-1152, 0],
    })
    ParsearListado = {
        jsCode: `// entradas.com publica un sitemap gzip. La descompresión la hace el nodo
// previo (Compression → ExtractFromFile), aquí solo recibimos el XML como
// string en $json.data. Filtramos:
// 1) URLs con 'almeria'
// 2) Blacklist por base name (funbox, prisionia → atracciones)
// 3) Dedup por id numérico al final del path /event/<slug>-<id>/

const BLACKLIST_BASE = /\\b(funbox|prisionia)\\b/i;

function deriveTitleFromSlug(slug) {
  return String(slug || '').replace(/-/g, ' ').replace(/\\s+/g, ' ').trim();
}

function extractEventInfo(url) {
  const m = String(url).match(/\\/event\\/(.+?)-(\\d+)\\/?$/);
  if (!m) return null;
  return { slug: m[1], id: m[2], url };
}

function parseSitemap(xml) {
  const out = [];
  const re = /<loc>([^<]+)<\\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

const seenIds = new Set();
const events = [];

const all = $input.all();
for (const item of all) {
  const xml = String((item.json && (item.json.data || item.json.body)) || '');
  if (!xml) continue;

  const urls = parseSitemap(xml);
  for (const url of urls) {
    if (!/almeria/i.test(url)) continue;
    if (BLACKLIST_BASE.test(url)) continue;
    const info = extractEventInfo(url);
    if (!info) continue;
    if (seenIds.has(info.id)) continue;
    seenIds.add(info.id);

    const tituloPlaceholder = deriveTitleFromSlug(info.slug);
    events.push({
      event_id: 'entradas_' + info.id,
      name: tituloPlaceholder,
      datetime_text: '',
      venue: '',
      event_url: url,
      cartel_url: '',
      slug: info.slug,
      api_id: info.id,
      es_espectaculo: true,
      estado_listado: 'En agenda',
    });
  }
}

return [{ json: { data: { data: { events } } } }];`,
    };

    @node({
        id: 'entradascom-split-out',
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
        id: 'entradascom-normalizar-titulo',
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
        id: 'entradascom-upsert-raw-front',
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
    'entradas_almeria',
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
        id: 'entradascom-select-front-sin-detalle',
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
WHERE f.source_storefront = 'entradas_almeria'
  AND f.event_url IS NOT NULL
  AND d.id IS NULL
  AND COALESCE((f.payload_json->>'es_espectaculo')::boolean, true) = true
ORDER BY f.id;`,
        options: {},
    };

    @node({
        id: 'entradascom-loop-eventos',
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
        id: 'entradascom-fetch-detalle',
        name: 'Fetch Detalle',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [192, 96],
        credentials: { firecrawlApi: { id: '3FsKPT3ZQeVfmMkM', name: 'Firecrawl account' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
    })
    FetchDetalle = {
        operation: 'scrape',
        url: '={{ $json.event_url }}',
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
                proxy: 'stealth',
                headers: {},
                waitFor: 2500,
            },
        },
        requestOptions: {},
    };

    @node({
        id: 'entradascom-fallback-detalle',
        name: 'Fallback Detalle',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [192, 288],
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
            '={{ JSON.stringify({ url: ($json.event_url || $(\'Loop eventos\').first().json.event_url), formats: ["html", "metadata"], wait_ms: 3000 }) }}',
        options: {},
    };

    @node({
        id: 'entradascom-parsear-detalle',
        name: 'Parsear Detalle',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [416, 96],
    })
    ParsearDetalle = {
        mode: 'runOnceForEachItem',
        jsCode: `// Firecrawl devuelve $json.data = { metadata: {ogTitle, ogImage, ...}, html, warning? }.
// Usamos la metadata (ya parseada) cuando está. Si statusCode=403 (Cloudflare bloqueo),
// devolvemos detalle minimal con datos del front.
const front = $('Loop eventos').item.json || {};
const fp = front.payload_json || {};
const fcData = ($json.data && typeof $json.data === 'object') ? $json.data : {};
const fcMeta = fcData.metadata || {};
const html = String(fcData.html || fcData.rawHtml || '');
const blocked = Number(fcMeta.statusCode || 0) >= 400;

function getOg(prop) {
  const re = new RegExp('<meta[^>]*property=["\\']og:' + prop + '["\\'][^>]*content=["\\']([^"\\']+)["\\']', 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}
function decodeHtml(t) {
  return String(t || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
}
function clean(t) { return String(t || '').replace(/\\s+/g, ' ').trim(); }

let ldEvent = null;
const ldRe = /<script[^>]*type=["\\']application\\/ld\\+json["\\'][^>]*>([\\s\\S]*?)<\\/script>/g;
let mm;
while ((mm = ldRe.exec(html)) !== null) {
  try {
    const obj = JSON.parse(mm[1]);
    const arr = Array.isArray(obj) ? obj : [obj];
    for (const o of arr) {
      if (o && (o['@type'] === 'Event' || (Array.isArray(o['@type']) && o['@type'].includes('Event')))) {
        ldEvent = o;
        break;
      }
    }
    if (ldEvent) break;
  } catch (e) { /* skip */ }
}

// Preferir metadata de Firecrawl. Si está vacía, fallback a regex sobre HTML.
const og_image = decodeHtml(fcMeta.ogImage || fcMeta['og:image'] || getOg('image'));
const og_description = decodeHtml(fcMeta.ogDescription || fcMeta.description || getOg('description'));
const og_title = decodeHtml(fcMeta.ogTitle || fcMeta['og:title'] || getOg('title'));

const event_id = front.event_id || fp.event_id || '';
const event_url = front.event_url || fp.event_url || '';

let titulo = '';
let venue = '';
let venueAddress = '';
let venueCity = '';
let fecha_inicio = '';
let fecha_fin = '';
let hora_inicio = '';
let precio_min = 0;

if (ldEvent) {
  titulo = clean(ldEvent.name || og_title);
  if (ldEvent.location) {
    const loc = Array.isArray(ldEvent.location) ? ldEvent.location[0] : ldEvent.location;
    venue = clean(loc.name);
    if (loc.address) {
      const addr = typeof loc.address === 'string'
        ? loc.address
        : (loc.address.streetAddress || '') + ' ' + (loc.address.addressLocality || '');
      venueAddress = clean(addr);
      venueCity = clean(loc.address.addressLocality);
    }
  }
  if (ldEvent.startDate) {
    fecha_inicio = String(ldEvent.startDate).slice(0, 10);
    const t = String(ldEvent.startDate).match(/T(\\d{2}:\\d{2})/);
    hora_inicio = t ? t[1] : '';
  }
  if (ldEvent.endDate) fecha_fin = String(ldEvent.endDate).slice(0, 10);
  if (ldEvent.offers) {
    const offers = Array.isArray(ldEvent.offers) ? ldEvent.offers : [ldEvent.offers];
    const prices = offers
      .map(o => parseFloat(o.price || o.lowPrice || 0))
      .filter(n => !isNaN(n) && n > 0);
    if (prices.length) precio_min = Math.min(...prices);
  }
}

if (!titulo) titulo = clean(og_title) || clean(fp.name || '');

// Fallback de fecha: parsear DD/MM/YYYY del og:title formato entradas.com
// "<artista> @ <venue> | <CIUDAD> - <dia>, DD/MM/YYYY"
if (!fecha_inicio && og_title) {
  const fm = og_title.match(/(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})/);
  if (fm) {
    fecha_inicio = fm[3] + '-' + String(fm[2]).padStart(2,'0') + '-' + String(fm[1]).padStart(2,'0');
  }
}

// Fallback de venue: parsear del og:title "<artista> @ <venue> | ..."
if (!venue && og_title) {
  const vm = og_title.match(/@\\s*([^|]+?)\\s*\\|/);
  if (vm) venue = clean(vm[1]);
}

// Si Firecrawl bloqueado por Cloudflare, devolver detalle minimal (operador completará)
if (blocked && !titulo) {
  titulo = clean(fp.name || '');
}

if (!fecha_fin) fecha_fin = fecha_inicio;

const tipo_fecha = fecha_inicio ? 'simple' : 'texto_no_parseable';
const cartel_url = og_image;
const local = venueAddress ? venue + ' — ' + venueAddress : venue;
const ticketera_url = event_url;

const payload = {
  fuente: 'entradas_almeria',
  tipo_evento: 'ESPECTACULO',
  ticketera: 'entradas_com',
  ticketera_url: event_url,
  estado_listado: fp.estado_listado || '',
  precio_min,
  precio_max: precio_min,
  precio_medio: precio_min,
  aforo_total: null,
  venue: {
    name: venue,
    full_address: venueAddress,
    city: venueCity,
  },
  api_id: fp.api_id || '',
  slug: fp.slug || '',
  og_title,
  og_description,
  og_image,
  jsonld_present: !!ldEvent,
  firecrawl_blocked: blocked,
  firecrawl_status: fcMeta.statusCode || null,
};

return {
  json: {
    event_id,
    titulo,
    titulo_original: titulo,
    observacion: og_description.slice(0, 500),
    datetime_text_original: front.datetime_text || '',
    fecha_inicio,
    fecha_fin,
    hora_inicio,
    tipo_fecha,
    num_sesiones_estimadas: fecha_inicio ? 1 : null,
    tiene_multiples_sesiones: false,
    precio_entradas: precio_min,
    precio_medio_entradas: precio_min,
    local,
    es_gratuito: precio_min === 0,
    cartel_url,
    screenshot_url: '',
    ticketera_url,
    payload_json: payload,
  },
};`,
    };

    @node({
        id: 'entradascom-upsert-raw-detalle',
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
        id: 'entradascom-leer-adjuntos-pendientes',
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
    WHERE f.source_storefront = 'entradas_almeria'
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
        id: 'entradascom-loop-adjuntos',
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
        id: 'entradascom-filtrar-adjuntos',
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
        id: 'entradascom-preparar-adjunto',
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
        id: 'entradascom-descargar-adjunto',
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
        id: 'entradascom-guardar-dropbox',
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
        id: 'entradascom-registrar-adjunto',
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
        id: 'entradascom-marcar-descargados',
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
        this.LoadPromoterConfig.out(0).to(this.GenerarSitemaps.in(0));
        this.GenerarSitemaps.out(0).to(this.FetchListado.in(0));
        this.FetchListado.out(0).to(this.DescomprimirSitemap.in(0));
        this.DescomprimirSitemap.out(0).to(this.ExtraerXml.in(0));
        this.ExtraerXml.out(0).to(this.ParsearListado.in(0));
        this.ParsearListado.out(0).to(this.SplitOut.in(0));
        this.SplitOut.out(0).to(this.NormalizarTitulo.in(0));
        this.NormalizarTitulo.out(0).to(this.UpsertRawFrontEventos.in(0));
        this.UpsertRawFrontEventos.out(0).to(this.SelectFrontSinDetalle.in(0));
        this.SelectFrontSinDetalle.out(0).to(this.LoopEventos.in(0));
        this.LoopEventos.out(0).to(this.LeerAdjuntosPendientes.in(0));
        this.LoopEventos.out(1).to(this.FetchDetalle.in(0));
        this.FetchDetalle.out(0).to(this.ParsearDetalle.in(0));
        this.FetchDetalle.out(1).to(this.FallbackDetalle.in(0));
        this.FallbackDetalle.out(0).to(this.ParsearDetalle.in(0));
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
