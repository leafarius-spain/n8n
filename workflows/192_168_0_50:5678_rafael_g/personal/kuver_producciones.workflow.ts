import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SCRAPPER KUVER PRODUCCIONES
// Nodes   : 26  |  Connections: 28
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ScheduleTrigger                    scheduleTrigger
// ManualTrigger                      manualTrigger
// WebhookTrigger                     webhook
// LoadPromoterConfig                 postgres                   [creds]
// ScrapeListado                      firecrawl                  [creds]
// ParsearListadoKuver                code
// Wait                               wait
// SplitOut                           splitOut
// NormalizarTitulo                   code
// UpsertRawFrontEventos              postgres                   [creds]
// SelectFrontSinDetalle              postgres                   [creds]
// LoopEventos                        splitInBatches
// ScrapeDetalleKuver                 firecrawl                  [onError→regular] [creds] [retry]
// ParsearDetalleKuver                code
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
//      → ScrapeListado
//        → ParsearListadoKuver
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
//                     .out(1) → ScrapeDetalleKuver
//                        → ParsearDetalleKuver
//                          → ConsolidarDetalle
//                            → AceptarEspectaculo
//                              → UpsertRawDetalleEventos
//                                → LoopEventos (↩ loop)
//                             .out(1) → MarcarNoEspectaculoEnFront
//                                → LoopEventos (↩ loop)
// ManualTrigger
//    → LoadPromoterConfig (↩ loop)
// WebhookTrigger
//    → LoadPromoterConfig (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'V3OhPp4BqFJ7l7Us',
    name: 'SCRAPPER KUVER PRODUCCIONES',
    // Desactivado 2026-07-11: la fuente/promotor ha desaparecido (ya no publica).
    // Estado real en n8n = inactivo (vía API deactivate) y habilitado=false en
    // promotores_configuracion. n8nac push NO cambia 'active' (lo ignora la API);
    // si se re-push, deja active:true en el fichero pero el promotor sigue sin
    // scrapear por habilitado=false. Reactivar = ambos flags + quitar esta nota.
    active: false,
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
export class ScrapperKuverProduccionesWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'kuver-schedule-trigger',
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
                    expression: '0 7 * * 1-6',
                },
            ],
        },
    };

    @node({
        id: 'kuver-manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-1820, 192],
    })
    ManualTrigger = {};

    @node({
        id: 'kuver-webhook-trigger',
        webhookId: 'kuver-trigger-test',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1820, 384],
    })
    WebhookTrigger = {
        httpMethod: 'POST',
        path: 'kuver-trigger-test',
        responseMode: 'lastNode',
        options: {},
    };

    @node({
        id: 'kuver-load-promoter-config',
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
WHERE promotor_id = 'kuver_producciones'
  AND habilitado = true;`,
        options: {},
    };

    @node({
        id: 'kuver-scrape-listado',
        name: 'Scrape Listado',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [-1376, 0],
        credentials: { firecrawlApi: { id: '3FsKPT3ZQeVfmMkM', name: 'Firecrawl account' } },
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
        id: 'kuver-parsear-listado',
        name: 'Parsear Listado KUVER',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-1152, 0],
    })
    ParsearListadoKuver = {
        jsCode: `const cheerio = require('cheerio');
const html = ($json.data && $json.data.html) || ($json.data && $json.data.rawHtml) || '';

if (!html) {
  return [{ json: { data: { data: { events: [] } } } }];
}

const $ = cheerio.load(html);

function clean(t) {
  return String(t || '').replace(/\\s+/g, ' ').trim();
}

function normalize(t) {
  return clean(t).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase();
}

const MONTHS_ES = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
  JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12',
};

function parseFechaES(text) {
  // "Lunes 11 de Mayo de 2026" -> "2026-05-11"
  const norm = normalize(text);
  const m = norm.match(/(\\d{1,2})\\s+DE\\s+([A-Z]+)\\s+DE\\s+(\\d{4})/);
  if (!m) return '';
  const mes = MONTHS_ES[m[2]];
  if (!mes) return '';
  return m[3] + '-' + mes + '-' + String(m[1]).padStart(2, '0');
}

function parseHora(text) {
  const m = String(text || '').match(/(\\d{1,2}):(\\d{2})/);
  if (!m) return '';
  return String(parseInt(m[1], 10)).padStart(2, '0') + ':' + m[2];
}

const ES_CINE = /CINE|PELICULA|FILM\\b|SCREENING|PROYECCION/;

const seen = new Set();
const events = [];

$('.event-item').each((_, c) => {
  const $c = $(c);
  const $a = $c.find('a').first();
  const href = clean($a.attr('href') || '');
  if (!href) return;

  const slug = href.replace(/^https?:\\/\\/[^\\/]+\\/evento\\//, '').replace(/^\\/+|\\/+$/g, '');
  if (!slug || slug.startsWith('http')) return;
  const event_id = 'kuver_' + slug.replace(/\\//g, '_');
  if (seen.has(event_id)) return;
  seen.add(event_id);

  const titulo = clean($c.find('.event-title').text());
  if (!titulo) return;

  const loc = clean($c.find('.event-location').text().replace(/^\\s*📍\\s*/, ''));
  const meta = clean($c.find('.event-meta').text());
  const fecha_inicio = parseFechaES(meta);
  const hora_inicio = parseHora(meta);
  const cartel_url = clean($c.find('img').first().attr('src') || $c.find('img').first().attr('data-src') || '');

  const titNorm = normalize(titulo);
  // Para kuver todo es espectáculo (teatro/concierto). Sólo descartamos talleres puntuales.
  const NOT_ESPECTACULO = /TALLER|MASTERCLASS|WORKSHOP|CURSO|CHARLA|COLOQUIO|CONFERENCIA/;
  const es_cine = ES_CINE.test(titNorm);
  const es_espectaculo = !NOT_ESPECTACULO.test(titNorm);

  events.push({
    event_id,
    name: titulo,
    datetime_text: meta,
    venue: loc,
    event_url: href,
    cartel_url,
    slug,
    fecha_inicio_listado: fecha_inicio,
    hora_listado: hora_inicio,
    descripcion_listado: '',
    es_espectaculo,
    es_cine,
    estado_listado: es_espectaculo ? 'En cartelera' : 'Otra actividad',
  });
});

return [{ json: { data: { data: { events } } } }];`,
    };

    @node({
        id: 'kuver-wait',
        webhookId: 'kuver-wait-1',
        name: 'Wait',
        type: 'n8n-nodes-base.wait',
        version: 1.1,
        position: [-928, 0],
    })
    Wait = {};

    @node({
        id: 'kuver-split-out',
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
        id: 'kuver-normalizar-titulo',
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
        id: 'kuver-upsert-raw-front',
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
    'kuver_producciones',
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
        id: 'kuver-select-front-sin-detalle',
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
WHERE f.source_storefront = 'kuver_producciones'
  AND f.event_url IS NOT NULL
  AND d.id IS NULL
  AND COALESCE((f.payload_json->>'es_espectaculo')::boolean, true) = true
ORDER BY f.id;`,
        options: {},
    };

    @node({
        id: 'kuver-loop-eventos',
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
        id: 'kuver-scrape-detalle',
        name: 'Scrape Detalle KUVER',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [416, 96],
        credentials: { firecrawlApi: { id: '3FsKPT3ZQeVfmMkM', name: 'Firecrawl account' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        waitBetweenTries: 5000,
    })
    ScrapeDetalleKuver = {
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
        id: 'kuver-parsear-detalle',
        name: 'Parsear Detalle KUVER',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [640, 96],
    })
    ParsearDetalleKuver = {
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
const slug = fp.slug || (event_id || '').replace(/^kuver_/, '');
const venue_listado = fp.venue || front.venue || '';
const fecha_inicio_listado = fp.fecha_inicio_listado || '';
const hora_listado = fp.hora_listado || '';
const datetime_text_listado = front.datetime_text || fp.datetime_text || '';

function clean(t) { return String(t || '').replace(/\\s+/g, ' ').trim(); }

function parsePrecio(text) {
  const t = String(text || '');
  if (/GRATU|GRATIS|ENTRADA\\s+LIBRE/i.test(t)) return { precio_min: 0, precio_max: 0, gratis: true };
  const matches = [...t.matchAll(/(\\d+(?:[.,]\\d{1,2})?)\\s*€/g)]
    .map((m) => parseFloat(m[1].replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 1000);
  if (!matches.length) return { precio_min: 0, precio_max: 0, gratis: false };
  return { precio_min: Math.min(...matches), precio_max: Math.max(...matches), gratis: false };
}

let titulo_detalle = '';
let observacion = '';
let bodyText = '';
let ticketera_url = '';
let pricing = { precio_min: 0, precio_max: 0, gratis: false };

if (html) {
  try {
    const $$ = cheerio.load(html);
    titulo_detalle = clean($$('h1').first().text());
    bodyText = clean($$('article, main, .entry-content, body').first().text());

    // Ticketera externa: enlaces a todaslasentradas, ticketmaster, etc.
    $$('a[href]').each((_i, a) => {
      if (ticketera_url) return;
      const h = clean($$(a).attr('href') || '');
      if (/todaslasentradas|ticketmaster|entradium|enterticket|secutix|entradas\\./i.test(h)) ticketera_url = h;
    });

    pricing = parsePrecio(bodyText);
    observacion = bodyText.slice(0, 2000);
  } catch (err) {
    console.log('Parsear Detalle KUVER - error:', err.message);
  }
}

const tipo_fecha = fecha_inicio_listado ? 'simple' : 'texto_no_parseable';

return {
  json: {
    event_id,
    slug,
    titulo: titulo_listado || titulo_detalle,
    titulo_original: titulo_listado || titulo_detalle,
    observacion,
    datetime_text_original: datetime_text_listado,
    fecha_inicio: fecha_inicio_listado,
    fecha_fin: fecha_inicio_listado,
    hora_inicio: hora_listado,
    tipo_fecha,
    num_sesiones_estimadas: fecha_inicio_listado ? 1 : null,
    tiene_multiples_sesiones: false,
    precio_entradas: pricing.precio_min,
    precio_medio_entradas: pricing.precio_min,
    precio_max: pricing.precio_max,
    aforo_total: 0,
    entradas: pricing.precio_min > 0 ? [{ nombre: '', precio: pricing.precio_min, aforo: 0 }] : [],
    local: venue_listado,
    es_gratuito: !!pricing.gratis,
    cartel_url: cartel_listado,
    screenshot_url,
    ticketera_url: ticketera_url || event_url_resp || front.event_url || '',
    event_url: event_url_resp || front.event_url || '',
    estado_listado: fp.estado_listado || '',
  },
};`,
    };

    @node({
        id: 'kuver-consolidar-detalle',
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
const entradas = Array.isArray(j.entradas) ? j.entradas : [];
const precio = j.precio_entradas || 0;

// Kuver: regla general — todos los eventos entran (incluido gratuitos y cine).
const aceptar = true;

const ticketera_url = j.ticketera_url || '';
const proveedorMatch = ticketera_url.match(/(?:^|\\/\\/)([^\\/]+)/);
const proveedor_host = proveedorMatch ? proveedorMatch[1].replace(/^www\\./, '') : 'kuver_producciones';

const payload = {
  fuente: 'kuver_producciones',
  ticketera: ticketera_url ? {
    proveedor: proveedor_host,
    id_externo: j.slug || '',
    url: ticketera_url,
  } : null,
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
        id: 'kuver-if-aceptar',
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
        id: 'kuver-marcar-no-espectaculo',
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
  AND source_storefront = 'kuver_producciones';`,
        options: {
            queryBatching: 'independently',
        },
    };

    @node({
        id: 'kuver-upsert-raw-detalle',
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
        id: 'kuver-leer-adjuntos-pendientes',
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
    WHERE f.source_storefront = 'kuver_producciones'
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
        id: 'kuver-loop-adjuntos',
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
        id: 'kuver-filtrar-adjuntos',
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
        id: 'kuver-preparar-adjunto',
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
const promotor = normalizeSegment($json.promotor, 'kuver-producciones');
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
        id: 'kuver-descargar-adjunto',
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
        id: 'kuver-guardar-dropbox',
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
        id: 'kuver-registrar-adjunto',
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
        id: 'kuver-marcar-descargados',
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
        this.LoadPromoterConfig.out(0).to(this.ScrapeListado.in(0));
        this.ScrapeListado.out(0).to(this.ParsearListadoKuver.in(0));
        this.ParsearListadoKuver.out(0).to(this.Wait.in(0));
        this.Wait.out(0).to(this.SplitOut.in(0));
        this.SplitOut.out(0).to(this.NormalizarTitulo.in(0));
        this.NormalizarTitulo.out(0).to(this.UpsertRawFrontEventos.in(0));
        this.UpsertRawFrontEventos.out(0).to(this.SelectFrontSinDetalle.in(0));
        this.SelectFrontSinDetalle.out(0).to(this.LoopEventos.in(0));
        this.LoopEventos.out(0).to(this.LeerAdjuntosPendientes.in(0));
        this.LoopEventos.out(1).to(this.ScrapeDetalleKuver.in(0));
        this.ScrapeDetalleKuver.out(0).to(this.ParsearDetalleKuver.in(0));
        this.ParsearDetalleKuver.out(0).to(this.ConsolidarDetalle.in(0));
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
