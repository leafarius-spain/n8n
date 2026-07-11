import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SCRAPPER CRASH MUSIC ALMERIA
// Nodes   : 26  |  Connections: 29
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
// ParsearListadoCrash                code
// Wait                               wait
// SplitOut                           splitOut
// NormalizarTitulo                   code
// UpsertRawFrontEventos              postgres                   [creds]
// SelectFrontSinDetalle              postgres                   [creds]
// LoopEventos                        splitInBatches
// ScrapeDetalleCrash                 firecrawl                  [onError→out(1)] [creds] [retry]
// FallbackDetalle                    httpRequest                [onError→regular]
// ParsearDetalleCrash                code
// ConsolidarDetalle                  code
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
//      → ScrapeListado
//        → ParsearListadoCrash
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
//                     .out(1) → ScrapeDetalleCrash
//                        → ParsearDetalleCrash
//                          → ConsolidarDetalle
//                            → UpsertRawDetalleEventos
//                              → LoopEventos (↩ loop)
//                       .out(1) → FallbackDetalle
//                          → ParsearDetalleCrash (↩ loop)
//       .out(1) → FallbackListado
//          → ParsearListadoCrash (↩ loop)
// ManualTrigger
//    → LoadPromoterConfig (↩ loop)
// WebhookTrigger
//    → LoadPromoterConfig (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'UhaMoYMSPmoTdKuC',
    name: 'SCRAPPER CRASH MUSIC ALMERIA',
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
export class ScrapperCrashMusicAlmeriaWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'crash-schedule-trigger',
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
                    expression: '0 1 * * 1-6',
                },
            ],
        },
    };

    @node({
        id: 'crash-manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-1600, 192],
    })
    ManualTrigger = {};

    @node({
        id: 'crash-webhook-trigger',
        webhookId: 'crash-trigger-test',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1600, 384],
    })
    WebhookTrigger = {
        httpMethod: 'POST',
        path: 'crash-trigger-test',
        responseMode: 'lastNode',
        options: {},
    };

    @node({
        id: 'crash-load-promoter-config',
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
WHERE promotor_id = 'crash_music'
  AND habilitado = true;`,
        options: {},
    };

    @node({
        id: 'crash-scrape-listado',
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
                waitFor: 3000,
                proxy: 'stealth',
            },
        },
        requestOptions: {},
    };

    @node({
        id: 'crash-fallback-listado',
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
        id: 'crash-parsear-listado',
        name: 'Parsear Listado CRASH',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-928, 0],
    })
    ParsearListadoCrash = {
        jsCode: `const cheerio = require('cheerio');
const html = ($json.data && $json.data.html) || ($json.data && $json.data.rawHtml) || '';

if (!html) {
  return [{ json: { data: { data: { events: [] } } } }];
}

const BASE = 'https://entradas.crashmusic.es/';
const $ = cheerio.load(html);

function clean(t) {
  return String(t || '').replace(/\\s+/g, ' ').trim();
}

function absoluteUrl(rel) {
  const r = String(rel || '').trim();
  if (!r) return '';
  if (r.startsWith('http://') || r.startsWith('https://')) return r;
  return BASE + r.replace(/^\\/+/, '');
}

const MONTHS_ABBR = {
  ENE: '01', JAN: '01',
  FEB: '02',
  MAR: '03',
  ABR: '04', APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AGO: '08', AUG: '08',
  SEP: '09', SEPT: '09',
  OCT: '10',
  NOV: '11',
  DIC: '12', DEC: '12',
};

function parseFechaCorta(text) {
  const m = String(text || '').match(/(\\d{1,2})\\s+([A-Za-zñÑ]{3,5})\\.?\\s+(\\d{4})/);
  if (!m) return '';
  const mes = MONTHS_ABBR[m[2].toUpperCase().replace(/\\.$/, '')];
  if (!mes) return '';
  return m[3] + '-' + mes + '-' + String(m[1]).padStart(2, '0');
}

function splitTitulo(h5) {
  return String(h5 || '')
    .split(/\\s*-\\s*|\\s*–\\s*/)
    .map((p) => clean(p))
    .filter(Boolean);
}

function looksLikeDate(s) {
  const norm = String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase();
  if (/^\\d/.test(norm)) return true;
  if (/DE\\s+(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)/.test(norm)) return true;
  if (/^(LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO|DOMINGO)/.test(norm)) return true;
  return false;
}

const seen = new Set();
const events = [];

$('.card').each((_, c) => {
  const $c = $(c);
  const img = $c.find('img').first();
  const alt = clean(img.attr('alt') || '');
  if (!/CONCIERTO|FEST|ALMER|HUERCAL/i.test(alt)) return;

  const $a = $c.parent('a');
  const href = clean($a.attr('href') || '');
  if (!href || seen.has(href)) return;
  seen.add(href);

  const slug = href.split('?')[0].split('#')[0].replace(/\\/+$/, '').split('/').filter(Boolean).pop() || '';
  if (!slug) return;
  const event_id = 'crash_' + slug;
  const event_url = href.startsWith('http') ? href : absoluteUrl(href);

  const cartel_url = absoluteUrl(img.attr('src') || '');
  const date_text = clean($c.find('.card-body p').first().text());
  const h5 = clean($c.find('.card-body h5').first().text());
  const fecha_inicio = parseFechaCorta(date_text);

  const partes = splitTitulo(h5);
  const titulo = partes[0] || h5;
  const ciudad = partes[1] || '';
  let venue = partes[2] || '';
  let fecha_letras = partes[3] || '';
  // En festivales con sólo 3 partes ("VIVA BOOM FEST 2026 - HUÉRCAL DE ALMERÍA - 23 Y 24 DE MAYO")
  // partes[2] es la fecha, no el venue. Detectamos y reasignamos.
  if (venue && looksLikeDate(venue)) {
    fecha_letras = fecha_letras || venue;
    venue = '';
  }

  events.push({
    event_id,
    name: titulo,
    datetime_text: date_text,
    venue: venue || ciudad,
    event_url,
    ticketera_url: event_url,
    cartel_url,
    slug,
    h5_full: h5,
    ciudad,
    fecha_inicio_listado: fecha_inicio,
    fecha_letras,
    estado_listado: 'Comprar',
  });
});

return [{ json: { data: { data: { events } } } }];`,
    };

    @node({
        id: 'crash-wait',
        webhookId: 'crash-wait-1',
        name: 'Wait',
        type: 'n8n-nodes-base.wait',
        version: 1.1,
        position: [-704, 0],
    })
    Wait = {};

    @node({
        id: 'crash-split-out',
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
        id: 'crash-normalizar-titulo',
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
        id: 'crash-upsert-raw-front',
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
    event_id, name, datetime_text, venue, event_url,
    source_storefront, payload_json, last_seen
)
VALUES (
    '{{ $json["data.data.events"].event_id }}',
    '{{ ($json["data.data.events"].name || "").replace(/'/g, "''") }}',
    '{{ ($json["data.data.events"].datetime_text || "").replace(/'/g, "''") }}',
    '{{ ($json["data.data.events"].venue || "").replace(/'/g, "''") }}',
    '{{ ($json["data.data.events"].event_url || "").replace(/'/g, "''") }}',
    'crash_music_almeria',
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
        id: 'crash-select-front-sin-detalle',
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
WHERE f.source_storefront = 'crash_music_almeria'
  AND f.event_url IS NOT NULL
  AND d.id IS NULL
ORDER BY f.id;`,
        options: {},
    };

    @node({
        id: 'crash-loop-eventos',
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
        id: 'crash-scrape-detalle',
        name: 'Scrape Detalle CRASH',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [640, 96],
        credentials: { firecrawlApi: { id: '3FsKPT3ZQeVfmMkM', name: 'Firecrawl account' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
        waitBetweenTries: 5000,
    })
    ScrapeDetalleCrash = {
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
                waitFor: 4000,
                proxy: 'stealth',
            },
        },
        requestOptions: {},
    };

    @node({
        id: 'crash-fallback-detalle',
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
            '={{ JSON.stringify({ url: ($json.event_url || $(\'Loop eventos\').first().json.event_url), formats: ["html", "metadata"], wait_ms: 4000 }) }}',
        options: {},
    };

    @node({
        id: 'crash-parsear-detalle',
        name: 'Parsear Detalle CRASH',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [864, 96],
    })
    ParsearDetalleCrash = {
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
const slug = fp.slug || (event_id || '').replace(/^crash_/, '');
const fecha_inicio_listado = fp.fecha_inicio_listado || '';
const fecha_letras = fp.fecha_letras || '';
const ciudad = fp.ciudad || '';
const venue_listado = fp.venue || front.venue || '';
const h5_full = fp.h5_full || '';

function clean(t) { return String(t || '').replace(/\\s+/g, ' ').trim(); }
function normalizeUpper(t) { return clean(t).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase(); }

const MONTHS_FULL = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
  JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12',
};

function parseFechaLargaES(text, fallbackYear) {
  const norm = normalizeUpper(text);
  const m = norm.match(/(\\d{1,2})\\s+DE\\s+([A-Z]+)(?:\\s+DE\\s+(\\d{4}))?/);
  if (!m) return '';
  const mes = MONTHS_FULL[m[2]];
  if (!mes) return '';
  const anio = m[3] || fallbackYear || String(new Date().getUTCFullYear());
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

let titulo_detalle = '';
let observacion = '';
let bodyText = '';
let precio_min = 0;
let precio_max = 0;
let precio_medio = 0;
let entradas = [];
let hora_inicio = '';
let fecha_inicio = fecha_inicio_listado;
const fallbackYear = fecha_inicio_listado ? fecha_inicio_listado.slice(0, 4) : '';

if (html) {
  try {
    const $$ = cheerio.load(html);
    titulo_detalle = clean($$('h1').first().text() || $$('h2').first().text() || '');
    bodyText = clean($$('body').text());

    const descCandidates = [];
    $$('section, .description, .event-description, .descripcion, .event-detail, p').each((_i, el) => {
      const t = clean($$(el).text());
      if (t.length > 80 && t.length < 2000) descCandidates.push(t);
    });
    observacion = descCandidates[0] || '';

    const reEur = /(\\d+(?:[.,]\\d{1,2}))\\s*€/g;
    const seen = new Set();
    let m;
    while ((m = reEur.exec(bodyText)) !== null) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (Number.isFinite(val) && val > 0 && val < 1000 && !seen.has(val)) {
        seen.add(val);
        entradas.push({ nombre: '', precio: val, aforo: 0 });
      }
    }
    if (entradas.length) {
      const ps = entradas.map((e) => e.precio).sort((a, b) => a - b);
      precio_min = ps[0];
      precio_max = ps[ps.length - 1];
      precio_medio = Math.round((ps.reduce((s, p) => s + p, 0) / ps.length) * 100) / 100;
    }

    const horaContextMatch = bodyText.match(/(?:PUERTAS|DOORS|HORA|COMIENZA|EMPIEZA|INICIO|CONCIERTO)[^\\d]{0,30}(\\d{1,2}:\\d{2})/i)
      || bodyText.match(/(\\d{1,2}:\\d{2})\\s*(?:H|HORAS|HR)/i)
      || bodyText.match(/(\\d{1,2}:\\d{2})/);
    if (horaContextMatch) hora_inicio = parseHora(horaContextMatch[1] || horaContextMatch[0]);

    const fechaDetalle = parseFechaLargaES(bodyText, fallbackYear);
    if (fechaDetalle) fecha_inicio = fechaDetalle;
  } catch (err) {
    console.log('Parsear Detalle CRASH - error:', err.message);
  }
}

if (!fecha_inicio && fecha_letras) {
  fecha_inicio = parseFechaLargaES(fecha_letras, fallbackYear);
}

const tipo_fecha = fecha_inicio ? 'simple' : 'texto_no_parseable';

return {
  json: {
    event_id,
    slug,
    // El h1 del detalle de crashmusic es el genérico de la web ("AGENDA CRASH MUSIC"),
    // no el título del evento. Usamos siempre el del listado (extraído del h5).
    titulo: titulo_listado || titulo_detalle,
    titulo_original: titulo_listado || titulo_detalle,
    observacion,
    datetime_text_original: clean([fecha_letras, hora_inicio].filter(Boolean).join(' ')) || front.datetime_text || '',
    fecha_inicio,
    fecha_fin: fecha_inicio,
    hora_inicio,
    tipo_fecha,
    num_sesiones_estimadas: fecha_inicio ? 1 : null,
    tiene_multiples_sesiones: false,
    precio_entradas: precio_min,
    precio_medio_entradas: precio_medio,
    precio_max,
    aforo_total: 0,
    entradas,
    local: venue_listado,
    es_gratuito: precio_min === 0 && entradas.length === 0,
    cartel_url: cartel_listado,
    screenshot_url,
    ticketera_url: event_url_resp || front.event_url || '',
    event_url: event_url_resp || front.event_url || '',
    estado_listado: fp.estado_listado || '',
    ciudad,
    h5_full,
    fecha_letras,
  },
};`,
    };

    @node({
        id: 'crash-consolidar-detalle',
        name: 'Consolidar Detalle',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1088, 96],
    })
    ConsolidarDetalle = {
        mode: 'runOnceForEachItem',
        jsCode: `const j = $json || {};
const entradas = Array.isArray(j.entradas) ? j.entradas : [];

const payload = {
  fuente: 'crash_music_almeria',
  ticketera: j.ticketera_url ? {
    proveedor: 'crash_music',
    id_externo: j.slug || '',
    url: j.ticketera_url,
  } : null,
  ciudad: j.ciudad || '',
  venue: j.local || '',
  fecha_letras: j.fecha_letras || '',
  h5_full: j.h5_full || '',
  estado_listado: j.estado_listado || '',
  precio_min: j.precio_entradas || null,
  precio_max: j.precio_max || null,
  precio_medio: j.precio_medio_entradas || null,
  aforo_total: j.aforo_total || null,
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
  },
};`,
    };

    @node({
        id: 'crash-upsert-raw-detalle',
        name: 'Upsert raw_detalle_eventos',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1312, 96],
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
        id: 'crash-leer-adjuntos-pendientes',
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
      d.event_id, d.titulo, d.fecha_captura, d.fecha_inicio,
      d.cartel_url, d.screenshot_url,
      f.source_storefront AS promotor,
      COALESCE(EXTRACT(YEAR FROM d.fecha_inicio)::text, TO_CHAR(d.fecha_captura, 'YYYY')) AS anio
    FROM raw_detalle_eventos d
    LEFT JOIN raw_front_eventos f ON f.event_id = d.event_id
    WHERE f.source_storefront = 'crash_music_almeria'
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
        id: 'crash-loop-adjuntos',
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
        id: 'crash-filtrar-adjuntos',
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
        id: 'crash-preparar-adjunto',
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
const promotor = normalizeSegment($json.promotor, 'crash-music-almeria');
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
        id: 'crash-descargar-adjunto',
        name: 'Descargar Adjunto',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1312, -384],
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
        id: 'crash-guardar-dropbox',
        name: 'Guardar en Dropbox',
        type: 'n8n-nodes-base.dropbox',
        version: 1,
        position: [1536, -384],
        credentials: { dropboxOAuth2Api: { id: 'mp4rjzvmnH1bwU8C', name: 'Dropbox account' } },
        onError: 'continueRegularOutput',
    })
    GuardarEnDropbox = {
        authentication: 'oAuth2',
        path: '={{ $json.dropbox_path }}',
        binaryData: true,
    };

    @node({
        id: 'crash-registrar-adjunto',
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
        id: 'crash-marcar-descargados',
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
        this.LoadPromoterConfig.out(0).to(this.ScrapeListado.in(0));
        this.ScrapeListado.out(0).to(this.ParsearListadoCrash.in(0));
        this.ScrapeListado.out(1).to(this.FallbackListado.in(0));
        this.FallbackListado.out(0).to(this.ParsearListadoCrash.in(0));
        this.ParsearListadoCrash.out(0).to(this.Wait.in(0));
        this.Wait.out(0).to(this.SplitOut.in(0));
        this.SplitOut.out(0).to(this.NormalizarTitulo.in(0));
        this.NormalizarTitulo.out(0).to(this.UpsertRawFrontEventos.in(0));
        this.UpsertRawFrontEventos.out(0).to(this.SelectFrontSinDetalle.in(0));
        this.SelectFrontSinDetalle.out(0).to(this.LoopEventos.in(0));
        this.LoopEventos.out(0).to(this.LeerAdjuntosPendientes.in(0));
        this.LoopEventos.out(1).to(this.ScrapeDetalleCrash.in(0));
        this.ScrapeDetalleCrash.out(0).to(this.ParsearDetalleCrash.in(0));
        this.ScrapeDetalleCrash.out(1).to(this.FallbackDetalle.in(0));
        this.FallbackDetalle.out(0).to(this.ParsearDetalleCrash.in(0));
        this.ParsearDetalleCrash.out(0).to(this.ConsolidarDetalle.in(0));
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
