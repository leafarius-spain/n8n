import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SCRAPPER ALMERIA CIUDAD
// Nodes   : 27  |  Connections: 30
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
// ParsearListadoAciudad              code
// Wait                               wait
// SplitOut                           splitOut
// NormalizarTitulo                   code
// UpsertRawFrontEventos              postgres                   [creds]
// SelectFrontSinDetalle              postgres                   [creds]
// LoopEventos                        splitInBatches
// ScrapeDetalleAciudad               firecrawl                  [onError→out(1)] [creds] [retry]
// FallbackDetalle                    httpRequest                [onError→regular]
// ParsearDetalleAciudad              code
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
//      → GenerarPaginas
//        → ScrapeListado
//          → ParsearListadoAciudad
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
//                       .out(1) → ScrapeDetalleAciudad
//                          → ParsearDetalleAciudad
//                            → ConsolidarDetalle
//                              → UpsertRawDetalleEventos
//                                → LoopEventos (↩ loop)
//                         .out(1) → FallbackDetalle
//                            → ParsearDetalleAciudad (↩ loop)
//         .out(1) → FallbackListado
//            → ParsearListadoAciudad (↩ loop)
// ManualTrigger
//    → LoadPromoterConfig (↩ loop)
// WebhookTrigger
//    → LoadPromoterConfig (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'P4IrI1Y3YMShdyYL',
    name: 'SCRAPPER ALMERIA CIUDAD',
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
export class ScrapperAlmeriaCiudadWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'aciudad-schedule-trigger',
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
                    expression: '0 4 * * 1-6',
                },
            ],
        },
    };

    @node({
        id: 'aciudad-manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-1820, 192],
    })
    ManualTrigger = {};

    @node({
        id: 'aciudad-webhook-trigger',
        webhookId: 'aciudad-trigger-test',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1820, 384],
    })
    WebhookTrigger = {
        httpMethod: 'POST',
        path: 'aciudad-trigger-test',
        responseMode: 'lastNode',
        options: {},
    };

    @node({
        id: 'aciudad-load-promoter-config',
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
WHERE promotor_id = 'almeria_ciudad'
  AND habilitado = true;`,
        options: {},
    };

    @node({
        id: 'aciudad-generar-paginas',
        name: 'Generar Paginas',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-1376, 0],
    })
    GenerarPaginas = {
        jsCode: `const promoter = ($input.all()[0] && $input.all()[0].json) || {};
const urlBase = String(promoter.url_lista || 'https://almeriaciudad.es/cultura/agenda').split('?')[0];
const TOTAL_PAGES = 2;
const out = [];
for (let p = 0; p < TOTAL_PAGES; p++) {
  out.push({
    json: {
      ...promoter,
      url_lista: urlBase + '?page=' + p,
      page_index: p,
    },
  });
}
return out;`,
    };

    @node({
        id: 'aciudad-scrape-listado',
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
                waitFor: 2500,
            },
        },
        requestOptions: {},
    };

    @node({
        id: 'aciudad-fallback-listado',
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
            '={{ JSON.stringify({ url: ($json.url_lista || $(\'Generar Paginas\').all()[$itemIndex].json.url_lista), formats: ["html"], wait_ms: 3000 }) }}',
        options: {},
    };

    @node({
        id: 'aciudad-parsear-listado',
        name: 'Parsear Listado ACIUDAD',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-928, 0],
    })
    ParsearListadoAciudad = {
        jsCode: `const cheerio = require('cheerio');

const items = $input.all();
const BASE = 'https://almeriaciudad.es';
const seen = new Set();
const events = [];

function clean(t) {
  return String(t || '').replace(/\\s+/g, ' ').trim();
}

function absoluteUrl(rel) {
  const r = String(rel || '').trim();
  if (!r) return '';
  if (r.startsWith('http://') || r.startsWith('https://')) return r;
  return BASE + (r.startsWith('/') ? r : '/' + r);
}

for (const it of items) {
  const html = (it.json && it.json.data && it.json.data.html) || '';
  if (!html) continue;
  const $ = cheerio.load(html);

  $('.card.card-blog-entry').each((_, c) => {
    const $c = $(c);
    const $a = $c.find('.h6 a').first();
    const titulo = clean($a.text());
    const href = clean($a.attr('href') || '');
    if (!titulo || !href) return;

    const slug = href.split('?')[0].split('#')[0].replace(/\\/+$/, '').split('/').filter(Boolean).pop() || '';
    if (!slug) return;
    const event_id = 'aciudad_' + slug;
    if (seen.has(event_id)) return;
    seen.add(event_id);

    const event_url = absoluteUrl(href);
    const subtitulo = clean($c.find('.card-text').first().text());
    const $time = $c.find('time.datetime').first();
    const datetime_iso = clean($time.attr('datetime') || '');
    const datetime_text = clean($time.text());
    const cartel_url = absoluteUrl($c.find('img.img-fluid').first().attr('src') || '');

    let fecha_inicio = '';
    let hora_listado = '';
    if (datetime_iso) {
      const m = datetime_iso.match(/^(\\d{4}-\\d{2}-\\d{2})T(\\d{2}):(\\d{2})/);
      if (m) {
        fecha_inicio = m[1];
        const h = m[2] + ':' + m[3];
        if (h !== '00:00') hora_listado = h;
      }
    }

    events.push({
      event_id,
      name: titulo,
      datetime_text,
      venue: '',
      event_url,
      cartel_url,
      slug,
      subtitulo,
      datetime_iso,
      fecha_inicio_listado: fecha_inicio,
      hora_listado,
      estado_listado: 'En cartelera',
    });
  });
}

return [{ json: { data: { data: { events } } } }];`,
    };

    @node({
        id: 'aciudad-wait',
        webhookId: 'aciudad-wait-1',
        name: 'Wait',
        type: 'n8n-nodes-base.wait',
        version: 1.1,
        position: [-704, 0],
    })
    Wait = {};

    @node({
        id: 'aciudad-split-out',
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
        id: 'aciudad-normalizar-titulo',
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
        id: 'aciudad-upsert-raw-front',
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
    'almeria_ciudad',
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
        id: 'aciudad-select-front-sin-detalle',
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
WHERE f.source_storefront = 'almeria_ciudad'
  AND f.event_url IS NOT NULL
  AND d.id IS NULL
ORDER BY f.id;`,
        options: {},
    };

    @node({
        id: 'aciudad-loop-eventos',
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
        id: 'aciudad-scrape-detalle',
        name: 'Scrape Detalle ACIUDAD',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [640, 96],
        credentials: { firecrawlApi: { id: '3FsKPT3ZQeVfmMkM', name: 'Firecrawl account' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
        waitBetweenTries: 5000,
    })
    ScrapeDetalleAciudad = {
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
                waitFor: 2500,
            },
        },
        requestOptions: {},
    };

    @node({
        id: 'aciudad-fallback-detalle',
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
        id: 'aciudad-parsear-detalle',
        name: 'Parsear Detalle ACIUDAD',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [864, 96],
    })
    ParsearDetalleAciudad = {
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
const slug = fp.slug || (event_id || '').replace(/^aciudad_/, '');
const fecha_inicio_listado = fp.fecha_inicio_listado || '';
const hora_listado = fp.hora_listado || '';
const datetime_text_listado = front.datetime_text || fp.datetime_text || '';

function clean(t) { return String(t || '').replace(/\\s+/g, ' ').trim(); }

function stripFieldPrefix(text, prefix) {
  const re = new RegExp('^\\\\s*' + prefix + '\\\\s+', 'i');
  return clean(text).replace(re, '');
}

function fieldText($$, name) {
  return clean($$('.field--name-' + name).first().text());
}

function fieldHref($$, name) {
  return clean($$('.field--name-' + name + ' a').first().attr('href') || '');
}

function parseHora(text) {
  // "8 - 8:30pm" o "20:00 h" o "8pm"
  const norm = String(text || '').toUpperCase();
  const m = norm.match(/(\\d{1,2}):(\\d{2})/) || norm.match(/(\\d{1,2})\\s*(AM|PM)/);
  if (!m) return '';
  let h, mm;
  if (m[2] && /^\\d{2}$/.test(m[2])) {
    h = parseInt(m[1], 10);
    mm = m[2];
  } else {
    h = parseInt(m[1], 10);
    mm = '00';
  }
  if (/PM/.test(norm) && h < 12) h += 12;
  if (/AM/.test(norm) && h === 12) h = 0;
  return String(h).padStart(2, '0') + ':' + mm;
}

function parsePrecio(text) {
  // "PRECIO DE LAS ENTRADAS: 12 EUROS" / "12,00 €" / "Gratuito"
  const t = String(text || '');
  if (/GRATU|GRATIS|ENTRADA\\s+LIBRE/i.test(t)) return { precio: 0, gratis: true };
  const m = t.match(/(\\d+(?:[.,]\\d{1,2})?)\\s*(?:€|EUR(?:OS)?)/i);
  if (!m) return { precio: 0, gratis: false };
  return { precio: parseFloat(m[1].replace(',', '.')), gratis: false };
}

let titulo_detalle = '';
let observacion = '';
let venue_detalle = '';
let categoria = '';
let precio = 0;
let es_gratuito = false;
let ticketera_url = '';
let hora_inicio = hora_listado;
let fecha_inicio = fecha_inicio_listado;

if (html) {
  try {
    const $$ = cheerio.load(html);
    titulo_detalle = clean($$('h1').first().text());
    venue_detalle = stripFieldPrefix(fieldText($$, 'field-event-location'), 'Localizaci[oó]n');
    const dateSmart = fieldText($$, 'field-date-smart');
    categoria = fieldText($$, 'field-taxon-types');
    const precioRaw = fieldText($$, 'field-txt150');
    const sub = fieldText($$, 'field-txt255');
    const body = clean($$('.field--name-body').first().text());
    observacion = body || sub || '';

    const pricing = parsePrecio(precioRaw);
    precio = pricing.precio;
    es_gratuito = pricing.gratis;

    ticketera_url = fieldHref($$, 'field-link');
    if (ticketera_url && !ticketera_url.startsWith('http')) {
      ticketera_url = 'https://almeriaciudad.es' + (ticketera_url.startsWith('/') ? ticketera_url : '/' + ticketera_url);
    }

    // hora del field-date-smart si el listado no la tenía
    if (!hora_inicio) {
      const fromDate = parseHora(dateSmart.replace(/^Fecha\\s+/i, ''));
      if (fromDate) hora_inicio = fromDate;
    }
  } catch (err) {
    console.log('Parsear Detalle ACIUDAD - error:', err.message);
  }
}

const tipo_fecha = fecha_inicio ? 'simple' : 'texto_no_parseable';

return {
  json: {
    event_id,
    slug,
    titulo: titulo_listado || titulo_detalle,
    titulo_original: titulo_listado || titulo_detalle,
    observacion,
    datetime_text_original: clean([datetime_text_listado, hora_inicio].filter(Boolean).join(' ')) || datetime_text_listado,
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
    local: venue_detalle,
    es_gratuito,
    cartel_url: cartel_listado,
    screenshot_url,
    ticketera_url: ticketera_url || event_url_resp || front.event_url || '',
    event_url: event_url_resp || front.event_url || '',
    estado_listado: fp.estado_listado || '',
    categoria,
    subtitulo_listado: fp.subtitulo || '',
  },
};`,
    };

    @node({
        id: 'aciudad-consolidar-detalle',
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
  fuente: 'almeria_ciudad',
  ticketera: j.ticketera_url ? {
    proveedor: j.ticketera_url.includes('almeriaciudad.es') ? 'almeria_ciudad' : 'externo',
    id_externo: j.slug || '',
    url: j.ticketera_url,
  } : null,
  categoria: j.categoria || '',
  subtitulo: j.subtitulo_listado || '',
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
  },
};`,
    };

    @node({
        id: 'aciudad-upsert-raw-detalle',
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
        id: 'aciudad-leer-adjuntos-pendientes',
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
    WHERE f.source_storefront = 'almeria_ciudad'
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
        id: 'aciudad-loop-adjuntos',
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
        id: 'aciudad-filtrar-adjuntos',
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
        id: 'aciudad-preparar-adjunto',
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
const promotor = normalizeSegment($json.promotor, 'almeria-ciudad');
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
        id: 'aciudad-descargar-adjunto',
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
        id: 'aciudad-guardar-dropbox',
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
        id: 'aciudad-registrar-adjunto',
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
        id: 'aciudad-marcar-descargados',
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
        this.LoadPromoterConfig.out(0).to(this.GenerarPaginas.in(0));
        this.GenerarPaginas.out(0).to(this.ScrapeListado.in(0));
        this.ScrapeListado.out(0).to(this.ParsearListadoAciudad.in(0));
        this.ScrapeListado.out(1).to(this.FallbackListado.in(0));
        this.FallbackListado.out(0).to(this.ParsearListadoAciudad.in(0));
        this.ParsearListadoAciudad.out(0).to(this.Wait.in(0));
        this.Wait.out(0).to(this.SplitOut.in(0));
        this.SplitOut.out(0).to(this.NormalizarTitulo.in(0));
        this.NormalizarTitulo.out(0).to(this.UpsertRawFrontEventos.in(0));
        this.UpsertRawFrontEventos.out(0).to(this.SelectFrontSinDetalle.in(0));
        this.SelectFrontSinDetalle.out(0).to(this.LoopEventos.in(0));
        this.LoopEventos.out(0).to(this.LeerAdjuntosPendientes.in(0));
        this.LoopEventos.out(1).to(this.ScrapeDetalleAciudad.in(0));
        this.ScrapeDetalleAciudad.out(0).to(this.ParsearDetalleAciudad.in(0));
        this.ScrapeDetalleAciudad.out(1).to(this.FallbackDetalle.in(0));
        this.FallbackDetalle.out(0).to(this.ParsearDetalleAciudad.in(0));
        this.ParsearDetalleAciudad.out(0).to(this.ConsolidarDetalle.in(0));
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
