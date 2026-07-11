import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SCRAPPER EMMA
// Nodes   : 19  |  Connections: 21
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
// ParsearListadoEmma                 code
// Wait                               wait
// SplitOut                           splitOut
// NormalizarTitulo                   code
// UpsertRawFrontEventos              postgres                   [creds]
// SelectFrontSinDetalle              postgres                   [creds]
// LoopEventos                        splitInBatches
// ConsolidarDetalleEmma              code
// UpsertRawDetalleEventos            postgres                   [creds]
// PrepararCartel                     code
// TieneCartel                        if
// GuardarCartelDropbox               dropbox                    [creds]
// RegistrarAdjuntoCartel             postgres                   [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ScheduleTrigger
//    → LoadPromoterConfig
//      → ScrapeListado
//        → ParsearListadoEmma
//          → Wait
//            → SplitOut
//              → NormalizarTitulo
//                → UpsertRawFrontEventos
//                  → SelectFrontSinDetalle
//                    → LoopEventos
//                     .out(1) → ConsolidarDetalleEmma
//                        → UpsertRawDetalleEventos
//                          → PrepararCartel
//                            → TieneCartel
//                              → GuardarCartelDropbox
//                                → RegistrarAdjuntoCartel
//                                  → LoopEventos (↩ loop)
//                             .out(1) → LoopEventos (↩ loop)
//       .out(1) → FallbackListado
//          → ParsearListadoEmma (↩ loop)
// ManualTrigger
//    → LoadPromoterConfig (↩ loop)
// WebhookTrigger
//    → LoadPromoterConfig (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'OzrMrzx0ifRQCjPQ',
    name: 'SCRAPPER EMMA',
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
export class ScrapperEmmaWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'emma-schedule-trigger',
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
                    expression: '0 3 * * 1-6',
                },
            ],
        },
    };

    @node({
        id: 'emma-manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-1600, 192],
    })
    ManualTrigger = {};

    @node({
        id: 'emma-webhook-trigger',
        webhookId: 'emma-trigger-test',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1600, 384],
    })
    WebhookTrigger = {
        httpMethod: 'POST',
        path: 'emma-trigger-test',
        responseMode: 'lastNode',
        options: {},
    };

    @node({
        id: 'emma-load-promoter-config',
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
WHERE promotor_id = 'emma'
  AND habilitado = true;`,
        options: {},
    };

    @node({
        id: 'emma-scrape-listado',
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
                waitFor: 6000,
                proxy: 'stealth',
            },
        },
        requestOptions: {},
    };

    @node({
        id: 'emma-fallback-listado',
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
            '={{ JSON.stringify({ url: ($json.url_lista || $(\'Load Promoter Config\').first().json.url_lista), formats: ["html"], wait_ms: 6000 }) }}',
        options: {},
    };

    @node({
        id: 'emma-parsear-listado',
        name: 'Parsear Listado EMMA',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-928, 0],
    })
    ParsearListadoEmma = {
        jsCode: `const cheerio = require('cheerio');
const html = ($json.data && $json.data.html) || ($json.data && $json.data.rawHtml) || '';

if (!html) {
  return [{ json: { data: { data: { events: [] } } } }];
}

const $ = cheerio.load(html);
const events = [];

function clean(t) {
  return String(t || '').replace(/\\s+/g, ' ').trim();
}

function slugifyEs(value, fallback) {
  const out = String(value || '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return out || (fallback || 'sin-valor');
}

const MONTHS_ES = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
  JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12',
};

function parseFechaES(text) {
  const norm = String(text || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase();
  // formatos: "SABADO, 9 DE MAYO, 2026" o "9 DE MAYO DE 2026"
  const m = norm.match(/(\\d{1,2})\\s+DE\\s+([A-Z]+)(?:\\s+DE)?[,\\s]+(\\d{4})/);
  if (!m) return '';
  const mes = MONTHS_ES[m[2]];
  if (!mes) return '';
  return m[3] + '-' + mes + '-' + String(m[1]).padStart(2, '0');
}

$('.card').each((_, c) => {
  const $c = $(c);
  const $title = $c.find('.card-title').first();
  // titulo crudo = texto del h4 sin el contenido del <small>
  const tituloRaw = clean($title.clone().find('small').remove().end().text());
  const categoria = clean($title.find('small .badge').first().text());

  if (!tituloRaw) return;

  // .card-text vienen ordenados: [0] fecha, [1] hora, [2] vacío, [3] precio
  const textos = $c.find('.card-text').map((_i, el) => clean($(el).text())).get().filter(Boolean);
  const fecha_text = textos[0] || '';
  const hora_text = textos[1] || '';
  const precio_text = textos.length >= 3 ? textos[textos.length - 1] : (textos[2] || '');

  // ticketera: link del botón Comprar / Más info (puede no haber)
  let ticketera_url = '';
  $c.find('a[href]').each((_i, a) => {
    if (ticketera_url) return;
    const h = clean($(a).attr('href') || '');
    if (/compralaentrada|salaemma/i.test(h)) ticketera_url = h;
  });

  // event_id: estable. Preferimos id ticketera; fallback slug+fecha.
  let event_id = '';
  const tk = ticketera_url.match(/\\/eventos\\/(\\d+)\\/(\\d+)/);
  const fecha_iso = parseFechaES(fecha_text);
  if (tk) {
    event_id = 'emma_' + tk[1] + '_' + tk[2];
  } else {
    const slugT = slugifyEs(tituloRaw, 'evento');
    const fechaTag = fecha_iso || 'sin-fecha';
    event_id = 'emma_' + slugT + '_' + fechaTag;
  }

  // cartel base64 (data: URL inline). Lo guardamos crudo; la decodificación va más abajo en el flujo.
  const cartel_src = clean($c.find('.card-img-top').first().attr('src') || '');
  let cartel_base64 = '';
  let cartel_mime = 'image/jpeg';
  if (cartel_src.startsWith('data:')) {
    const m = cartel_src.match(/^data:([^;]+);base64,(.+)$/);
    if (m) {
      cartel_mime = m[1];
      cartel_base64 = m[2];
    }
  }

  events.push({
    event_id,
    name: tituloRaw,
    datetime_text: clean([fecha_text, hora_text].filter(Boolean).join(' · ')),
    venue: 'Sala EMMA',
    event_url: ticketera_url || 'https://entradasemma.azurewebsites.net/',
    ticketera_url,
    categoria,
    fecha_text,
    hora_text,
    precio_text,
    estado_listado: ticketera_url ? 'Comprar' : 'Sin venta',
    cartel_mime,
    cartel_base64,
  });
});

return [{ json: { data: { data: { events } } } }];`,
    };

    @node({
        id: 'emma-wait',
        webhookId: 'emma-wait-1',
        name: 'Wait',
        type: 'n8n-nodes-base.wait',
        version: 1.1,
        position: [-704, 0],
    })
    Wait = {};

    @node({
        id: 'emma-split-out',
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
        id: 'emma-normalizar-titulo',
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
        id: 'emma-upsert-raw-front',
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
    'emma_almeria',
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
        id: 'emma-select-front-sin-detalle',
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
WHERE f.source_storefront = 'emma_almeria'
  AND f.event_url IS NOT NULL
  AND d.id IS NULL
ORDER BY f.id;`,
        options: {},
    };

    @node({
        id: 'emma-loop-eventos',
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
        id: 'emma-consolidar-detalle',
        name: 'Consolidar Detalle EMMA',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [640, 96],
    })
    ConsolidarDetalleEmma = {
        mode: 'runOnceForEachItem',
        jsCode: `// Toma datos del front (que YA tiene todo lo del listado pre-renderizado)
// y construye el objeto final para raw_detalle_eventos. Sin scrape extra.

const front = $json || {};
const fp = front.payload_json || {};

const event_id = front.event_id || fp.event_id || '';
const titulo_norm = front.name || fp.name || '';
const titulo_raw = fp.name || titulo_norm;
const categoria = fp.categoria || '';
const ticketera_url = fp.ticketera_url || '';
const fecha_text = fp.fecha_text || '';
const hora_text = fp.hora_text || '';
const precio_text = fp.precio_text || '';
const estado_listado = fp.estado_listado || '';
const cartel_base64 = fp.cartel_base64 || '';
const cartel_mime = fp.cartel_mime || 'image/jpeg';

const MONTHS_ES = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
  JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12',
};

function clean(t) { return String(t || '').replace(/\\s+/g, ' ').trim(); }

function parseFechaES(text) {
  const norm = String(text || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase();
  const m = norm.match(/(\\d{1,2})\\s+DE\\s+([A-Z]+)(?:\\s+DE)?[,\\s]+(\\d{4})/);
  if (!m) return '';
  const mes = MONTHS_ES[m[2]];
  if (!mes) return '';
  return m[3] + '-' + mes + '-' + String(m[1]).padStart(2, '0');
}

function parseHora(text) {
  // "8:00 PM" -> "20:00", "20:30 h" -> "20:30"
  const t = String(text || '').trim().toUpperCase();
  const m = t.match(/(\\d{1,2}):(\\d{2})\\s*(AM|PM)?/);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  const mm = m[2];
  const ampm = m[3];
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return String(h).padStart(2, '0') + ':' + mm;
}

function parsePrecio(text) {
  const t = String(text || '').replace(',', '.');
  const m = t.match(/(\\d+(?:\\.\\d{1,2})?)/);
  return m ? parseFloat(m[1]) : 0;
}

const fecha_inicio = parseFechaES(fecha_text);
const hora_inicio = parseHora(hora_text);
const precio = parsePrecio(precio_text);

const tipo_fecha = fecha_inicio ? 'simple' : 'texto_no_parseable';
const num_sesiones_estimadas = fecha_inicio ? 1 : null;

const tk = ticketera_url.match(/\\/eventos\\/(\\d+)\\/(\\d+)/);
const ticketera_id = tk ? (tk[1] + '_' + tk[2]) : '';

// Slug + dropbox path para el cartel
function normalizeSegment(value, fallback) {
  const out = String(value || '')
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return out || (fallback || 'sin-valor');
}
const promotor_seg = 'emma';
const anio = fecha_inicio ? fecha_inicio.slice(0, 4) : String(new Date().getUTCFullYear());
const titulo_slug = normalizeSegment(titulo_norm || titulo_raw, 'evento');
const event_slug = event_id + '+' + titulo_slug;
const ext = cartel_mime && cartel_mime.indexOf('/') > -1 ? cartel_mime.split('/')[1] : 'jpg';
const cartel_filename = 'cartel.' + (ext === 'jpeg' ? 'jpg' : ext);
const dropbox_folder = '/0-CANCERBERO/EVENTOS/' + promotor_seg + '/' + anio + '/' + event_slug;
const dropbox_path = dropbox_folder + '/' + cartel_filename;

const has_cartel = !!cartel_base64;

const payload = {
  fuente: 'emma_almeria',
  categoria,
  ticketera: ticketera_url ? {
    proveedor: 'compralaentrada',
    id_externo: ticketera_id,
    url: ticketera_url,
  } : null,
  estado_listado,
  precio_unico: precio,
  precio_text_original: precio_text,
  fecha_text,
  hora_text,
  has_cartel,
};

return {
  json: {
    // campos para raw_detalle_eventos
    event_id,
    titulo: titulo_norm || titulo_raw,
    titulo_original: titulo_raw,
    observacion: categoria,
    datetime_text_original: clean([fecha_text, hora_text].filter(Boolean).join(' · ')),
    fecha_inicio,
    fecha_fin: fecha_inicio,
    hora_inicio,
    tipo_fecha,
    num_sesiones_estimadas,
    tiene_multiples_sesiones: false,
    precio_entradas: precio,
    precio_medio_entradas: precio,
    local: 'Sala EMMA',
    es_gratuito: precio === 0,
    cartel_url: '',
    screenshot_url: '',
    ticketera_url,
    payload_json: payload,
    // campos auxiliares para subir el cartel a Dropbox
    has_cartel,
    cartel_base64,
    cartel_mime,
    cartel_filename,
    dropbox_path,
    dropbox_folder,
    promotor: promotor_seg,
    anio,
    titulo_slug,
    event_slug,
  },
};`,
    };

    @node({
        id: 'emma-upsert-raw-detalle',
        name: 'Upsert raw_detalle_eventos',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [864, 96],
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
        id: 'emma-preparar-cartel',
        name: 'Preparar Cartel',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1088, 96],
    })
    PrepararCartel = {
        mode: 'runOnceForEachItem',
        jsCode: `// El Upsert SQL devuelve sólo {success:true} y pierde el JSON original;
// rescatamos los datos del Consolidar Detalle EMMA via pairedItem.
const j = $('Consolidar Detalle EMMA').item.json || {};
const has = !!j.has_cartel && !!j.cartel_base64;
if (!has) {
  return { json: { ...j, has_cartel_binary: false } };
}

return {
  json: {
    ...j,
    has_cartel_binary: true,
  },
  binary: {
    data: {
      data: j.cartel_base64,
      mimeType: j.cartel_mime || 'image/jpeg',
      fileExtension: (j.cartel_filename || 'cartel.jpg').split('.').pop() || 'jpg',
      fileName: j.cartel_filename || 'cartel.jpg',
    },
  },
};`,
    };

    @node({
        id: 'emma-if-tiene-cartel',
        name: 'Tiene cartel',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1312, 96],
    })
    TieneCartel = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 2,
            },
            conditions: [
                {
                    leftValue: '={{ $json.has_cartel_binary }}',
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
        id: 'emma-guardar-cartel-dropbox',
        name: 'Guardar Cartel Dropbox',
        type: 'n8n-nodes-base.dropbox',
        version: 1,
        position: [1536, 0],
        credentials: { dropboxOAuth2Api: { id: 'mp4rjzvmnH1bwU8C', name: 'Dropbox account' } },
    })
    GuardarCartelDropbox = {
        authentication: 'oAuth2',
        path: '={{ $json.dropbox_path }}',
        binaryData: true,
    };

    @node({
        id: 'emma-registrar-adjunto',
        name: 'Registrar Adjunto Cartel',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1760, 0],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    RegistrarAdjuntoCartel = {
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
    '{{ ($('Consolidar Detalle EMMA').item.json.event_id || "").replace(/'/g, "''") }}',
    'cartel',
    'inline:base64',
    '{{ ($('Consolidar Detalle EMMA').item.json.dropbox_path || "").replace(/'/g, "''") }}',
    '{{ ($('Consolidar Detalle EMMA').item.json.cartel_filename || "cartel.jpg").replace(/'/g, "''") }}',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM raw_eventos_adjuntos
    WHERE event_id = '{{ ($('Consolidar Detalle EMMA').item.json.event_id || "").replace(/'/g, "''") }}'
      AND tipo = 'cartel'
);`,
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
        this.ScrapeListado.out(0).to(this.ParsearListadoEmma.in(0));
        this.ScrapeListado.out(1).to(this.FallbackListado.in(0));
        this.FallbackListado.out(0).to(this.ParsearListadoEmma.in(0));
        this.ParsearListadoEmma.out(0).to(this.Wait.in(0));
        this.Wait.out(0).to(this.SplitOut.in(0));
        this.SplitOut.out(0).to(this.NormalizarTitulo.in(0));
        this.NormalizarTitulo.out(0).to(this.UpsertRawFrontEventos.in(0));
        this.UpsertRawFrontEventos.out(0).to(this.SelectFrontSinDetalle.in(0));
        this.SelectFrontSinDetalle.out(0).to(this.LoopEventos.in(0));
        this.LoopEventos.out(1).to(this.ConsolidarDetalleEmma.in(0));
        this.ConsolidarDetalleEmma.out(0).to(this.UpsertRawDetalleEventos.in(0));
        this.UpsertRawDetalleEventos.out(0).to(this.PrepararCartel.in(0));
        this.PrepararCartel.out(0).to(this.TieneCartel.in(0));
        this.TieneCartel.out(0).to(this.GuardarCartelDropbox.in(0));
        this.TieneCartel.out(1).to(this.LoopEventos.in(0));
        this.GuardarCartelDropbox.out(0).to(this.RegistrarAdjuntoCartel.in(0));
        this.RegistrarAdjuntoCartel.out(0).to(this.LoopEventos.in(0));
    }
}
