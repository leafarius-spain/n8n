import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SCRAPPER SALA BERLIN
// Nodes   : 29  |  Connections: 33
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ScheduleTrigger                    scheduleTrigger
// ManualTrigger                      manualTrigger
// WebhookTrigger                     webhook
// LoadPromoterConfig                 postgres                   [creds]
// GenerarPaginas                     code
// ScrapeListado                      firecrawl                  [onError→out(1)] [creds] [retry]
// FallbackListado                    httpRequest                [onError→regular]
// ParsearListadoBerlin               code
// Wait                               wait
// SplitOut                           splitOut
// NormalizarTitulo                   code
// UpsertRawFrontEventos              postgres                   [creds]
// SelectFrontSinDetalle              postgres                   [creds]
// LoopEventos                        splitInBatches
// ScrapeDetalleBerlin                firecrawl                  [onError→out(1)] [creds] [retry]
// FallbackDetalle                    httpRequest                [onError→regular]
// ParsearDetalleBerlin               code
// ConsolidarDetalle                  code
// AceptarEspectaculo                 if
// MarcarNoEspectaculoEnFront         postgres                   [creds]
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
//      → GenerarPaginas
//        → ScrapeListado
//          → ParsearListadoBerlin
//            → Wait
//              → SplitOut
//                → NormalizarTitulo
//                  → UpsertRawFrontEventos
//                    → SelectFrontSinDetalle
//                      → LoopEventos
//                        → LeerAdjuntosPendientes
//                          → LoopAdjuntos
//                           .out(1) → FiltrarAdjuntosValidos
//                              → PrepararAdjuntoDropbox
//                                → DescargarAdjunto
//                                  → GuardarEnDropbox
//                                    → RegistrarAdjunto
//                                      → MarcarAdjuntosDescargados
//                                        → LoopAdjuntos (↩ loop)
//                       .out(1) → ScrapeDetalleBerlin
//                          → ParsearDetalleBerlin
//                            → ConsolidarDetalle
//                              → AceptarEspectaculo
//                                → UpsertRawDetalleEventos
//                                  → LoopEventos (↩ loop)
//                               .out(1) → MarcarNoEspectaculoEnFront
//                                  → LoopEventos (↩ loop)
//                         .out(1) → FallbackDetalle
//                            → ParsearDetalleBerlin (↩ loop)
//         .out(1) → FallbackListado
//            → ParsearListadoBerlin (↩ loop)
// ManualTrigger
//    → LoadPromoterConfig (↩ loop)
// WebhookTrigger
//    → LoadPromoterConfig (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'Bot2Ur1fW6NC9fgv',
    name: 'SCRAPPER SALA BERLIN',
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
export class ScrapperSalaBerlinWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'berlin-schedule-trigger',
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
                    expression: '0 8 * * 1-6',
                },
            ],
        },
    };

    @node({
        id: 'berlin-manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-1820, 192],
    })
    ManualTrigger = {};

    @node({
        id: 'berlin-webhook-trigger',
        webhookId: 'berlin-trigger-test',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1820, 384],
    })
    WebhookTrigger = {
        httpMethod: 'POST',
        path: 'berlin-trigger-test',
        responseMode: 'lastNode',
        options: {},
    };

    @node({
        id: 'berlin-load-promoter-config',
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
WHERE promotor_id = 'sala_berlin_social_club'
  AND habilitado = true;`,
        options: {},
    };

    @node({
        id: 'berlin-generar-paginas',
        name: 'Generar Paginas',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-1480, 0],
    })
    GenerarPaginas = {
        jsCode: `const promoter = ($input.all()[0] && $input.all()[0].json) || {};
const TOTAL_PAGES = 4;
const out = [];
for (let p = 1; p <= TOTAL_PAGES; p++) {
  const url = p === 1
    ? 'https://berlinalmeria.com/eventos/'
    : 'https://berlinalmeria.com/eventos/?product-page=' + p;
  out.push({ json: { ...promoter, url_lista: url, page_index: p } });
}
return out;`,
    };

    @node({
        id: 'berlin-scrape-listado',
        name: 'Scrape Listado',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [-1280, 0],
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
                waitFor: 2500,
            },
        },
        requestOptions: {},
    };

    @node({
        id: 'berlin-fallback-listado',
        name: 'Fallback Listado',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [-1280, 224],
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
            '={{ JSON.stringify({ url: ($json.url_lista || $(\'Generar Paginas\').all()[$itemIndex].json.url_lista), formats: ["html"], wait_ms: 3000 }) }}',
        options: {},
    };

    @node({
        id: 'berlin-parsear-listado',
        name: 'Parsear Listado BERLIN',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-1152, 0],
    })
    ParsearListadoBerlin = {
        jsCode: `const cheerio = require('cheerio');
const html = ($json.data && $json.data.html) || ($json.data && $json.data.rawHtml) || '';

if (!html) {
  return [{ json: { data: { data: { events: [] } } } }];
}

const $ = cheerio.load(html);

function clean(t) { return String(t || '').replace(/\\s+/g, ' ').trim(); }
function normalize(t) { return clean(t).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase(); }

const NOT_ESPECTACULO_BASE = /TALLER|MASTERCLASS|MASTER\\s+CLASS|WORKSHOP|CURSO|CLASE\\s+DE|INTERCAMBIO|APERITIVO|CHARLA|COLOQUIO|CONFERENCIA|MESA\\s+REDONDA|JORNADA\\s+DE\\s+CONVIVENCIA|VISITA\\s+GUIADA|RUTA\\s+GUIADA|DEPORTE|ESCAPE\\s+ROOM|TARJETA\\s+REGALO|GIFT\\s+CARD|YELMO/;
const ES_CINE = /CINE|PELICULA|FILM\\b|PROYECCION/;
const PRECIO_MINIMO = 12;

const MONTHS_ES = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
  JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', SEPT: '09', OCTUBRE: '10',
  NOVIEMBRE: '11', DICIEMBRE: '12',
  ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06',
  JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

function parseFechaDeTitulo(titulo) {
  // Formatos: "16 MAYO – COMPRO ORO + ORINA" / "9 mayo – LORNA" / "30 MAYO – Desert" / "1 AGOSTO"
  // Devuelve { fecha_inicio (YYYY-MM-DD), titulo_limpio (sin la fecha), mes }
  const norm = normalize(titulo);
  const m = norm.match(/^\\s*(\\d{1,2})\\s+(?:DE\\s+)?([A-Z]+)\\s*[–-]\\s*(.*)$/);
  if (!m) return { fecha_inicio: '', titulo_limpio: titulo, mes: '' };
  const dia = m[1];
  const mes = MONTHS_ES[m[2]];
  if (!mes) return { fecha_inicio: '', titulo_limpio: titulo, mes: '' };
  // El año se infiere: si el mes/dia es anterior al actual, asumir año siguiente
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(today.getUTCDate()).padStart(2, '0');
  const candidato = yyyy + '-' + mes + '-' + String(dia).padStart(2, '0');
  let anio = yyyy;
  if (candidato < (yyyy + '-' + mm + '-' + dd)) anio = yyyy + 1;
  // Limpia titulo: quitamos la parte de la fecha del título original (no el normalizado)
  const tit_clean = String(titulo).replace(/^\\s*\\d{1,2}\\s+(?:de\\s+|DE\\s+)?[A-Za-zñÑÁÉÍÓÚáéíóú]+\\s*[–-]\\s*/, '').trim();
  return { fecha_inicio: anio + '-' + mes + '-' + String(dia).padStart(2, '0'), titulo_limpio: tit_clean, mes };
}

function detectarPrecioListado(text) {
  const t = String(text || '');
  if (/ENTRADA\\s+LIBRE|GRATUIT[OA]|GRATIS/i.test(t)) return 0;
  const matches = [...t.matchAll(/(\\d+(?:[.,]\\d{1,2})?)\\s*€/g)]
    .map((m) => parseFloat(m[1].replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 1000);
  return matches.length ? Math.min(...matches) : null;
}

// Sala Berlin: regla general — todo entra. Los precio<12€ se etiquetan como
// 'DISCO 328' en payload_json.tipo_evento. Cine también entra siempre.
function clasificarEspectaculo(tituloNorm, precio) {
  if (NOT_ESPECTACULO_BASE.test(tituloNorm)) return false;
  return true;
}

const seen = new Set();
const events = [];

$('ul.products li.product, .products .product').each((_, c) => {
  const $c = $(c);
  const $a = $c.find('a').first();
  const href = clean($a.attr('href') || '');
  if (!href) return;
  // Quitamos /producto/ si está y derivamos slug del último segmento.
  const slugMatch = href.match(/\\/producto\\/([^\\/?#]+)/);
  if (!slugMatch) return;
  const slug = slugMatch[1];
  const event_id = 'berlin_' + slug;
  if (seen.has(event_id)) return;
  seen.add(event_id);

  const titulo_raw = clean($c.find('.woocommerce-loop-product__title, h2, h3').first().text());
  if (!titulo_raw) return;

  const priceRaw = clean($c.find('.amount').first().text());
  const cartel_url = clean($c.find('img').first().attr('src') || $c.find('img').first().attr('data-src') || '');

  const fecha = parseFechaDeTitulo(titulo_raw);
  const titNorm = normalize(fecha.titulo_limpio || titulo_raw);
  const precio_listado = detectarPrecioListado(priceRaw);
  const es_espectaculo = clasificarEspectaculo(titNorm, precio_listado);

  events.push({
    event_id,
    name: fecha.titulo_limpio || titulo_raw,
    datetime_text: titulo_raw,
    venue: 'Sala Berlin Social Club',
    event_url: href,
    cartel_url,
    slug,
    fecha_inicio_listado: fecha.fecha_inicio,
    precio_listado,
    descripcion_listado: '',
    es_espectaculo,
    es_cine: ES_CINE.test(titNorm),
    estado_listado: es_espectaculo ? 'En cartelera' : 'Otra actividad',
  });
});

return [{ json: { data: { data: { events } } } }];`,
    };

    @node({
        id: 'berlin-wait',
        webhookId: 'berlin-wait-1',
        name: 'Wait',
        type: 'n8n-nodes-base.wait',
        version: 1.1,
        position: [-928, 0],
    })
    Wait = {};

    @node({
        id: 'berlin-split-out',
        name: 'Split Out',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [-704, 0],
    })
    SplitOut = {
        fieldToSplitOut: 'data.data.events',
        include: 'allOtherFields',
        options: {
            disableDotNotation: false,
        },
    };

    @node({
        id: 'berlin-normalizar-titulo',
        name: 'Normalizar Titulo',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-480, 0],
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
        id: 'berlin-upsert-raw-front',
        name: 'Upsert raw_front_eventos',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-256, 0],
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
    'sala_berlin_social_club',
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
        id: 'berlin-select-front-sin-detalle',
        name: 'Select front sin detalle',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-32, 0],
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
WHERE f.source_storefront = 'sala_berlin_social_club'
  AND f.event_url IS NOT NULL
  AND d.id IS NULL
  AND COALESCE((f.payload_json->>'es_espectaculo')::boolean, true) = true
ORDER BY f.id;`,
        options: {},
    };

    @node({
        id: 'berlin-loop-eventos',
        name: 'Loop eventos',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [192, 0],
    })
    LoopEventos = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: 'berlin-scrape-detalle',
        name: 'Scrape Detalle BERLIN',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [416, 96],
        credentials: { firecrawlApi: { id: '3FsKPT3ZQeVfmMkM', name: 'Firecrawl account' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
        waitBetweenTries: 5000,
    })
    ScrapeDetalleBerlin = {
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
                waitFor: 3500,
                proxy: 'stealth',
            },
        },
        requestOptions: {},
    };

    @node({
        id: 'berlin-fallback-detalle',
        name: 'Fallback Detalle',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [416, 288],
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
        id: 'berlin-parsear-detalle',
        name: 'Parsear Detalle BERLIN',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [640, 96],
    })
    ParsearDetalleBerlin = {
        mode: 'runOnceForEachItem',
        jsCode: `const cheerio = require('cheerio');

const it = $json || {};
const data = it.data || {};
const html = data.html || data.rawHtml || '';
const screenshot_url = data.screenshot || '';
const meta = data.metadata || {};
const event_url_resp = (meta.sourceURL || meta['og:url'] || meta.url || '').toString();

const front = $('Loop eventos').item.json || {};
const fp = front.payload_json || {};
const event_id = front.event_id || fp.event_id || '';
const titulo_listado = front.name || fp.name || '';
const cartel_listado = fp.cartel_url || '';
const slug = fp.slug || (event_id || '').replace(/^feverup_/, '');
const venue_listado = fp.venue || front.venue || '';
const date_listado = fp.datetime_text || front.datetime_text || '';
const precio_listado = (typeof fp.precio_listado === 'number') ? fp.precio_listado : null;

function clean(t) { return String(t || '').replace(/\\s+/g, ' ').trim(); }
function normalize(t) { return clean(t).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase(); }

const MONTHS = {
  ENE: '01', ENERO: '01', FEB: '02', FEBRERO: '02', MAR: '03', MARZO: '03',
  ABR: '04', ABRIL: '04', MAY: '05', MAYO: '05', JUN: '06', JUNIO: '06',
  JUL: '07', JULIO: '07', AGO: '08', AGOSTO: '08', SEP: '09', SEPT: '09', SEPTIEMBRE: '09',
  OCT: '10', OCTUBRE: '10', NOV: '11', NOVIEMBRE: '11', DIC: '12', DICIEMBRE: '12',
};

function parseFechaCorta(text) {
  // "10 may - 12 jul" -> primer fecha "2026-05-10"
  const norm = normalize(text);
  const m = norm.match(/(\\d{1,2})\\s+([A-Z]{3,12})/);
  if (!m) return '';
  const mes = MONTHS[m[2].slice(0, 3)] || MONTHS[m[2]];
  if (!mes) return '';
  const yearMatch = norm.match(/(\\d{4})/);
  const anio = yearMatch ? yearMatch[1] : String(new Date().getUTCFullYear());
  return anio + '-' + mes + '-' + String(m[1]).padStart(2, '0');
}

function parseHora(text) {
  const norm = String(text || '').toUpperCase();
  const m = norm.match(/(\\d{1,2}):(\\d{2})/);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  const mm = m[2];
  if (/(\\d{1,2}):(\\d{2})\\s*PM/.test(norm) && h < 12) h += 12;
  if (/(\\d{1,2}):(\\d{2})\\s*AM/.test(norm) && h === 12) h = 0;
  return String(h).padStart(2, '0') + ':' + mm;
}

function parsePrecio(text) {
  const t = String(text || '');
  if (/GRATU|GRATIS|ENTRADA\\s+LIBRE/i.test(t)) return 0;
  const matches = [...t.matchAll(/(\\d+(?:[.,]\\d{1,2})?)\\s*€/g)]
    .map((m) => parseFloat(m[1].replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 1000);
  return matches.length ? Math.min(...matches) : 0;
}

let titulo_detalle = '';
let observacion = '';
let bodyText = '';
let venue_detalle = '';
let categoria = '';
// Priorizamos el precio del LISTADO (más fiable: viene de plan-price__amount).
// El detalle suele tener varios precios (tarjeta regalo, newsletter, etc.) y el min()
// escoge el más bajo, falseando el precio real. Sólo usamos el del detalle si el
// listado no tenía precio.
let precio = (precio_listado !== null && precio_listado > 0) ? precio_listado : 0;
let hora_inicio = '';

if (html) {
  try {
    const $$ = cheerio.load(html);
    titulo_detalle = clean($$('h1').first().text());
    bodyText = clean($$('main, [role=main], body').first().text());
    venue_detalle = clean($$('.fv-plan-info-location, [class*=plan-info-location], [class*=venue-name]').first().text());
    categoria = clean($$('[class*=plan-categories], [class*=category]').first().text());

    if (!precio) {
      const precioBody = parsePrecio(bodyText);
      if (precioBody > 0) precio = precioBody;
    }

    const horaCtx = bodyText.match(/(?:HORA|HORARIO|COMIENZA|EMPIEZA|INICIO|APERTURA)[^\\d]{0,30}(\\d{1,2}:\\d{2})/i)
      || bodyText.match(/(\\d{1,2}:\\d{2})\\s*H/i);
    if (horaCtx) hora_inicio = parseHora(horaCtx[1] || horaCtx[0]);
  } catch (err) {
    console.log('Parsear Detalle BERLIN - error:', err.message);
  }
}

const fecha_inicio = parseFechaCorta(date_listado);
const tipo_fecha = fecha_inicio ? 'simple' : 'texto_no_parseable';

return {
  json: {
    event_id,
    slug,
    titulo: titulo_listado || titulo_detalle,
    titulo_original: titulo_listado || titulo_detalle,
    observacion: bodyText.slice(0, 1500),
    datetime_text_original: date_listado,
    fecha_inicio,
    fecha_fin: fecha_inicio,
    hora_inicio,
    tipo_fecha,
    num_sesiones_estimadas: fecha_inicio ? 1 : null,
    tiene_multiples_sesiones: false,
    precio_entradas: precio,
    precio_medio_entradas: precio,
    precio_max: precio,
    aforo_total: 0,
    entradas: precio > 0 ? [{ nombre: '', precio, aforo: 0 }] : [],
    local: venue_detalle || venue_listado,
    es_gratuito: precio === 0,
    cartel_url: cartel_listado,
    screenshot_url,
    ticketera_url: event_url_resp || front.event_url || '',
    event_url: event_url_resp || front.event_url || '',
    estado_listado: fp.estado_listado || '',
    categoria,
  },
};`,
    };

    @node({
        id: 'berlin-consolidar-detalle',
        name: 'Consolidar Detalle',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [864, 96],
    })
    ConsolidarDetalle = {
        mode: 'runOnceForEachItem',
        jsCode: `const j = $json || {};
const front_payload = ($('Loop eventos').item.json.payload_json) || {};
const es_cine = !!front_payload.es_cine;
const PRECIO_MINIMO = 12;
const entradas = Array.isArray(j.entradas) ? j.entradas : [];
const precio = j.precio_entradas || 0;

// Sala Berlin: todo entra. Etiquetado:
//   - cine -> 'CINE'
//   - precio >= 12 -> 'ESPECTACULO'
//   - 0 < precio < 12 -> 'DISCO 328'
//   - precio == 0 -> 'GRATUITO'
let aceptar = true;
let tipo_evento;
if (es_cine) tipo_evento = 'CINE';
else if (precio >= PRECIO_MINIMO) tipo_evento = 'ESPECTACULO';
else if (precio > 0) tipo_evento = 'DISCO 328';
else tipo_evento = 'GRATUITO';

const payload = {
  fuente: 'sala_berlin_social_club',
  tipo_evento,
  ticketera: j.ticketera_url ? {
    proveedor: 'sala_berlin_social_club',
    id_externo: j.slug || '',
    url: j.ticketera_url,
  } : null,
  categoria: j.categoria || '',
  es_cine,
  estado_listado: j.estado_listado || '',
  precio_min: j.precio_entradas ?? null,
  precio_max: j.precio_max ?? null,
  precio_medio: j.precio_medio_entradas ?? null,
  aforo_total: j.aforo_total ?? null,
  entradas,
};

return {
  json: {
    event_id: j.event_id || '',
    titulo: j.titulo || '',
    titulo_original: j.titulo_original || '',
    observacion: j.observacion || '',
    datetime_text_original: j.datetime_text_original || '',
    fecha_inicio: j.fecha_inicio || '',
    fecha_fin: j.fecha_fin || j.fecha_inicio || '',
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
    es_cine,
    aceptar_espectaculo: aceptar,
  },
};`,
    };

    @node({
        id: 'berlin-if-aceptar',
        name: 'Aceptar espectaculo',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1024, 96],
    })
    AceptarEspectaculo = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 2,
            },
            conditions: [
                {
                    leftValue: '={{ $json.aceptar_espectaculo }}',
                    rightValue: true,
                    operator: {
                        type: 'boolean',
                        operation: 'true',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: 'berlin-marcar-no-espectaculo',
        name: 'Marcar No Espectaculo en Front',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1184, 256],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    MarcarNoEspectaculoEnFront = {
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
        query: `UPDATE raw_front_eventos
SET payload_json = jsonb_set(
      COALESCE(payload_json, '{}'::jsonb),
      '{es_espectaculo}',
      'false'::jsonb
    ),
    last_seen = NOW()
WHERE event_id = '{{ ($json.event_id || "").replace(/'/g, "''") }}'
  AND source_storefront = 'sala_berlin_social_club';`,
        options: {
            queryBatching: 'independently',
        },
    };

    @node({
        id: 'berlin-upsert-raw-detalle',
        name: 'Upsert raw_detalle_eventos',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1184, 0],
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
        id: 'berlin-leer-adjuntos-pendientes',
        name: 'Leer Adjuntos Pendientes',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [192, -320],
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
      d.event_id, d.titulo, d.fecha_captura, d.fecha_inicio,
      d.cartel_url, d.screenshot_url,
      f.source_storefront AS promotor,
      COALESCE(EXTRACT(YEAR FROM d.fecha_inicio)::text, TO_CHAR(d.fecha_captura, 'YYYY')) AS anio
    FROM raw_detalle_eventos d
    LEFT JOIN raw_front_eventos f ON f.event_id = d.event_id
    WHERE f.source_storefront = 'sala_berlin_social_club'
      AND (COALESCE(d.cartel_url, '') <> '' OR COALESCE(d.screenshot_url, '') <> '')
      AND COALESCE(d.adjuntos_descargados, false) = false
)
SELECT pending.event_id, pending.tipo, pending.url_origen, pending.titulo,
       pending.fecha_captura, pending.promotor, pending.anio
FROM (
    SELECT d.event_id, 'cartel' AS tipo, d.cartel_url AS url_origen,
           d.titulo, d.fecha_captura, d.promotor, d.anio
    FROM detail_context d
    WHERE COALESCE(d.cartel_url, '') <> ''
      AND NOT EXISTS (
        SELECT 1 FROM raw_eventos_adjuntos a
        WHERE a.event_id = d.event_id AND a.tipo = 'cartel'
      )
    UNION ALL
    SELECT d.event_id, 'screenshot' AS tipo, d.screenshot_url AS url_origen,
           d.titulo, d.fecha_captura, d.promotor, d.anio
    FROM detail_context d
    WHERE COALESCE(d.screenshot_url, '') <> ''
      AND NOT EXISTS (
        SELECT 1 FROM raw_eventos_adjuntos a
        WHERE a.event_id = d.event_id AND a.tipo = 'screenshot'
      )
) pending
ORDER BY pending.fecha_captura NULLS LAST, pending.event_id, pending.tipo;`,
        options: {},
    };

    @node({
        id: 'berlin-loop-adjuntos',
        name: 'Loop Adjuntos',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [416, -320],
    })
    LoopAdjuntos = {
        batchSize: 10,
        options: {},
    };

    @node({
        id: 'berlin-filtrar-adjuntos',
        name: 'Filtrar Adjuntos Validos',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [640, -384],
    })
    FiltrarAdjuntosValidos = {
        jsCode: `return $input
  .all()
  .filter((item) => String(item.json.url_origen || '').trim().length > 0);`,
    };

    @node({
        id: 'berlin-preparar-adjunto',
        name: 'Preparar Adjunto Dropbox',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [864, -384],
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
const promotor = normalizeSegment($json.promotor, 'feverup');
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
        id: 'berlin-descargar-adjunto',
        name: 'Descargar Adjunto',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1088, -384],
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
        id: 'berlin-guardar-dropbox',
        name: 'Guardar en Dropbox',
        type: 'n8n-nodes-base.dropbox',
        version: 1,
        position: [1312, -384],
        credentials: { dropboxOAuth2Api: { id: 'mp4rjzvmnH1bwU8C', name: 'Dropbox account' } },
        onError: 'continueRegularOutput',
    })
    GuardarEnDropbox = {
        authentication: 'oAuth2',
        path: '={{ $json.dropbox_path }}',
        binaryData: true,
    };

    @node({
        id: 'berlin-registrar-adjunto',
        name: 'Registrar Adjunto',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1536, -384],
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
        id: 'berlin-marcar-descargados',
        name: 'Marcar Adjuntos Descargados',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1760, -320],
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
        SELECT 1 FROM raw_eventos_adjuntos a
        WHERE a.event_id = d.event_id AND a.tipo = 'cartel'
    ))
    AND
    (COALESCE(d.screenshot_url, '') = '' OR EXISTS (
        SELECT 1 FROM raw_eventos_adjuntos a
        WHERE a.event_id = d.event_id AND a.tipo = 'screenshot'
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
        this.LoadPromoterConfig.out(0).to(this.GenerarPaginas.in(0));
        this.GenerarPaginas.out(0).to(this.ScrapeListado.in(0));
        this.ScrapeListado.out(0).to(this.ParsearListadoBerlin.in(0));
        this.ScrapeListado.out(1).to(this.FallbackListado.in(0));
        this.FallbackListado.out(0).to(this.ParsearListadoBerlin.in(0));
        this.ParsearListadoBerlin.out(0).to(this.Wait.in(0));
        this.Wait.out(0).to(this.SplitOut.in(0));
        this.SplitOut.out(0).to(this.NormalizarTitulo.in(0));
        this.NormalizarTitulo.out(0).to(this.UpsertRawFrontEventos.in(0));
        this.UpsertRawFrontEventos.out(0).to(this.SelectFrontSinDetalle.in(0));
        this.SelectFrontSinDetalle.out(0).to(this.LoopEventos.in(0));
        this.LoopEventos.out(0).to(this.LeerAdjuntosPendientes.in(0));
        this.LoopEventos.out(1).to(this.ScrapeDetalleBerlin.in(0));
        this.ScrapeDetalleBerlin.out(0).to(this.ParsearDetalleBerlin.in(0));
        this.ScrapeDetalleBerlin.out(1).to(this.FallbackDetalle.in(0));
        this.FallbackDetalle.out(0).to(this.ParsearDetalleBerlin.in(0));
        this.ParsearDetalleBerlin.out(0).to(this.ConsolidarDetalle.in(0));
        this.ConsolidarDetalle.out(0).to(this.AceptarEspectaculo.in(0));
        this.AceptarEspectaculo.out(0).to(this.UpsertRawDetalleEventos.in(0));
        this.AceptarEspectaculo.out(1).to(this.MarcarNoEspectaculoEnFront.in(0));
        this.UpsertRawDetalleEventos.out(0).to(this.LoopEventos.in(0));
        this.MarcarNoEspectaculoEnFront.out(0).to(this.LoopEventos.in(0));
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
