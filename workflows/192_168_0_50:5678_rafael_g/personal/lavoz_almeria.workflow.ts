import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SCRAPPER LA VOZ ALMERIA
// Nodes   : 23  |  Connections: 25
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
// ParsearListadoLavoz                code
// Wait                               wait
// SplitOut                           splitOut
// NormalizarTitulo                   code
// UpsertRawFrontEventos              postgres                   [creds]
// SelectFrontSinDetalle              postgres                   [creds]
// LoopEventos                        splitInBatches
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
//        → ParsearListadoLavoz
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
//                     .out(1) → ConsolidarDetalle
//                        → UpsertRawDetalleEventos
//                          → LoopEventos (↩ loop)
//       .out(1) → FallbackListado
//          → ParsearListadoLavoz (↩ loop)
// ManualTrigger
//    → LoadPromoterConfig (↩ loop)
// WebhookTrigger
//    → LoadPromoterConfig (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'mmDZtuXAqGMyWzKQ',
    name: 'SCRAPPER LA VOZ ALMERIA',
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
export class ScrapperLaVozAlmeriaWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'lavoz-schedule-trigger',
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
                    expression: '30 2 * * 1-6',
                },
            ],
        },
    };

    @node({
        id: 'lavoz-manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-1820, 192],
    })
    ManualTrigger = {};

    @node({
        id: 'lavoz-webhook-trigger',
        webhookId: 'lavoz-trigger-test',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1820, 384],
    })
    WebhookTrigger = {
        httpMethod: 'POST',
        path: 'lavoz-trigger-test',
        responseMode: 'lastNode',
        options: {},
    };

    @node({
        id: 'lavoz-load-promoter-config',
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
WHERE promotor_id = 'lavoz_almeria'
  AND habilitado = true;`,
        options: {},
    };

    @node({
        id: 'lavoz-scrape-listado',
        name: 'Scrape Listado',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [-1376, 0],
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
        id: 'lavoz-fallback-listado',
        name: 'Fallback Listado',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [-1376, 224],
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
            '={{ JSON.stringify({ url: ($json.url_lista || $(\'Load Promoter Config\').first().json.url_lista), formats: ["html"], wait_ms: 2500 }) }}',
        options: {},
    };

    @node({
        id: 'lavoz-parsear-listado',
        name: 'Parsear Listado LAVOZ',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-1152, 0],
    })
    ParsearListadoLavoz = {
        jsCode: `const cheerio = require('cheerio');
const html = ($json.data && $json.data.html) || ($json.data && $json.data.rawHtml) || '';

if (!html) {
  return [{ json: { data: { data: { events: [] } } } }];
}

const $ = cheerio.load(html);

function clean(t) { return String(t || '').replace(/\\s+/g, ' ').trim(); }
function normalize(t) { return clean(t).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase(); }

const MONTHS_ES = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
  JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12',
  ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06',
  JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

// Lógica de año: si el mes detectado es anterior al actual, asumir año siguiente.
// (Cuando estamos en diciembre y el artículo habla de enero/febrero -> próximo año.)
function inferirAnio(mesNum) {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mmActual = today.getUTCMonth() + 1;
  if (mesNum < mmActual) return yyyy + 1;
  return yyyy;
}

function parseFechaDeTexto(texto) {
  // Detecta el primer "DD de MES" o "DD y DD de MES" o "del DD al DD de MES"
  const norm = normalize(texto);
  const m = norm.match(/(\\d{1,2})\\s*(?:Y\\s*\\d{1,2}\\s*)?DE\\s+([A-Z]+)/);
  if (!m) return '';
  const mes = MONTHS_ES[m[2]];
  if (!mes) return '';
  const dia = String(m[1]).padStart(2, '0');
  const anio = inferirAnio(parseInt(mes, 10));
  return anio + '-' + mes + '-' + dia;
}

// El listado son artículos del periódico — no son eventos vendibles.
// Aceptamos todos (la regla general "todo entra"); el operador filtrará después.
const NOT_ESPECTACULO_BASE = /YELMO/;

function clasificar(tituloNorm) {
  if (NOT_ESPECTACULO_BASE.test(tituloNorm)) return false;
  return true;
}

const seen = new Set();
const events = [];

$('.c-article').each((_, c) => {
  const $c = $(c);
  // Saltamos vídeos y items sin h2/h3
  if ($c.hasClass('c-article--video')) return;
  const $title = $c.find('h2, h3').first();
  const titulo = clean($title.text());
  if (!titulo) return;

  const href = clean($c.find('a').first().attr('href') || '');
  if (!href) return;

  // event_id: extraer número de noticia del path /<categoria>/<id>/<slug>.html
  const idMatch = href.match(/\\/(\\d{4,8})\\/[^\\/]+\\.html?$/);
  const slug = idMatch ? idMatch[1] : href.replace(/[^a-z0-9]+/gi, '-').slice(-60);
  const event_id = 'lavoz_' + slug;
  if (seen.has(event_id)) return;
  seen.add(event_id);

  const epigrafe = clean($c.find('.c-article__epigraph, [class*=epigraph]').first().text());
  const subtitulo = clean($c.find('.c-article__subtitle, [class*=subtitle]').first().text());

  const $img = $c.find('img').first();
  const cartel_url = clean($img.attr('src') || $img.attr('data-src') || '');

  const fecha_inicio = parseFechaDeTexto(titulo + ' ' + subtitulo);
  const titNorm = normalize(titulo);
  const es_espectaculo = clasificar(titNorm);

  events.push({
    event_id,
    name: titulo,
    datetime_text: titulo,
    venue: '',
    event_url: href,
    cartel_url,
    slug,
    epigrafe,
    subtitulo,
    fecha_inicio_listado: fecha_inicio,
    descripcion_listado: subtitulo,
    es_espectaculo,
    estado_listado: 'En agenda',
  });
});

return [{ json: { data: { data: { events } } } }];`,
    };

    @node({
        id: 'lavoz-wait',
        webhookId: 'lavoz-wait-1',
        name: 'Wait',
        type: 'n8n-nodes-base.wait',
        version: 1.1,
        position: [-928, 0],
    })
    Wait = {};

    @node({
        id: 'lavoz-split-out',
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
        id: 'lavoz-normalizar-titulo',
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
        id: 'lavoz-upsert-raw-front',
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
    'lavoz_almeria',
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
        id: 'lavoz-select-front-sin-detalle',
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
WHERE f.source_storefront = 'lavoz_almeria'
  AND f.event_url IS NOT NULL
  AND d.id IS NULL
  AND COALESCE((f.payload_json->>'es_espectaculo')::boolean, true) = true
ORDER BY f.id;`,
        options: {},
    };

    @node({
        id: 'lavoz-loop-eventos',
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
        id: 'lavoz-consolidar-detalle',
        name: 'Consolidar Detalle',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [416, 96],
    })
    ConsolidarDetalle = {
        mode: 'runOnceForEachItem',
        jsCode: `// La Voz de Almería es agenda cultural sin scrape detalle. Construimos directamente
// el detalle a partir del front (titulo, fecha, cartel, link a la noticia).
const front = $json || {};
const fp = front.payload_json || {};
const event_id = front.event_id || fp.event_id || '';
const titulo = front.name || fp.name || '';
const cartel_listado = fp.cartel_url || '';
const slug = fp.slug || (event_id || '').replace(/^lavoz_/, '');
const fecha_inicio = fp.fecha_inicio_listado || '';
const subtitulo = fp.subtitulo || '';
const epigrafe = fp.epigrafe || '';
const event_url = front.event_url || fp.event_url || '';

const tipo_fecha = fecha_inicio ? 'simple' : 'texto_no_parseable';

const payload = {
  fuente: 'lavoz_almeria',
  tipo_evento: 'AGENDA CULTURAL',
  ticketera: null,
  categoria: epigrafe,
  estado_listado: fp.estado_listado || '',
  precio_min: 0,
  precio_max: 0,
  precio_medio: 0,
  aforo_total: null,
  entradas: [],
  enlace_noticia: event_url,
};

return {
  json: {
    event_id,
    titulo,
    titulo_original: titulo,
    observacion: subtitulo,
    datetime_text_original: titulo,
    fecha_inicio,
    fecha_fin: fecha_inicio,
    hora_inicio: '',
    tipo_fecha,
    num_sesiones_estimadas: fecha_inicio ? 1 : null,
    tiene_multiples_sesiones: false,
    precio_entradas: 0,
    precio_medio_entradas: 0,
    local: '',
    es_gratuito: true,
    cartel_url: cartel_listado,
    screenshot_url: '',
    ticketera_url: '',
    payload_json: payload,
  },
};`,
    };

    @node({
        id: 'lavoz-upsert-raw-detalle',
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
        id: 'lavoz-leer-adjuntos-pendientes',
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
    WHERE f.source_storefront = 'lavoz_almeria'
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
        id: 'lavoz-loop-adjuntos',
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
        id: 'lavoz-filtrar-adjuntos',
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
        id: 'lavoz-preparar-adjunto',
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
const promotor = normalizeSegment($json.promotor, 'lavoz-almeria');
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
        id: 'lavoz-descargar-adjunto',
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
        id: 'lavoz-guardar-dropbox',
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
        id: 'lavoz-registrar-adjunto',
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
        id: 'lavoz-marcar-descargados',
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
        this.LoadPromoterConfig.out(0).to(this.ScrapeListado.in(0));
        this.ScrapeListado.out(0).to(this.ParsearListadoLavoz.in(0));
        this.ScrapeListado.out(1).to(this.FallbackListado.in(0));
        this.FallbackListado.out(0).to(this.ParsearListadoLavoz.in(0));
        this.ParsearListadoLavoz.out(0).to(this.Wait.in(0));
        this.Wait.out(0).to(this.SplitOut.in(0));
        this.SplitOut.out(0).to(this.NormalizarTitulo.in(0));
        this.NormalizarTitulo.out(0).to(this.UpsertRawFrontEventos.in(0));
        this.UpsertRawFrontEventos.out(0).to(this.SelectFrontSinDetalle.in(0));
        this.SelectFrontSinDetalle.out(0).to(this.LoopEventos.in(0));
        this.LoopEventos.out(0).to(this.LeerAdjuntosPendientes.in(0));
        this.LoopEventos.out(1).to(this.ConsolidarDetalle.in(0));
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
