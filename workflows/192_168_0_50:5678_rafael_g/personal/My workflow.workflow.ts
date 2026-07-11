import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SCRAPPER FLOWTE
// Nodes   : 24  |  Connections: 27
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// SplitOut                           splitOut
// ExecuteASqlQuery1                  postgres                   [creds]
// Wait                               wait
// ScheduleTrigger                    scheduleTrigger
// WebhookTrigger                     webhook
// LoadPromoterConfig                 postgres                   [creds]
// FallbackDetalle                    httpRequest                [onError→regular]
// NormalizarEventos                  code
// InsertNormalizedEvents             postgres                   [creds]
// Scrape                             firecrawl                  [onError→out(1)] [creds] [retry]
// LeerAdjuntosPendientes             postgres                   [creds]
// LoopOverPendingAdjuntos            splitInBatches
// FiltrarAdjuntosValidos             code
// PrepararAdjuntoDropbox             code
// DescargarAdjunto                   httpRequest
// GuardarAdjuntoEnDropbox            dropbox                    [creds]
// RegistrarAdjunto                   postgres                   [creds]
// MarcarAdjuntosDescargados          postgres                   [creds]
// NormalizarTitulo                   code
// ExecuteASqlQueryFront              postgres                   [creds]
// Scrape1                            firecrawl                  [onError→out(1)] [creds] [retry]
// FallbackListado                    httpRequest                [onError→regular]
// ParsearEventos                     code
// LoopOverItems                      splitInBatches
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ScheduleTrigger
//    → LoadPromoterConfig
//      → Scrape1
//        → ParsearEventos
//          → Wait
//            → SplitOut
//              → NormalizarTitulo
//                → ExecuteASqlQueryFront
//                  → ExecuteASqlQuery1
//                    → LoopOverItems
//                      → LeerAdjuntosPendientes
//                        → LoopOverPendingAdjuntos
//                         .out(1) → FiltrarAdjuntosValidos
//                            → PrepararAdjuntoDropbox
//                              → DescargarAdjunto
//                                → GuardarAdjuntoEnDropbox
//                                  → RegistrarAdjunto
//                                    → MarcarAdjuntosDescargados
//                                      → LoopOverPendingAdjuntos (↩ loop)
//                     .out(1) → Scrape
//                        → NormalizarEventos
//                          → InsertNormalizedEvents
//                            → LoopOverItems (↩ loop)
//                       .out(1) → FallbackDetalle
//                          → NormalizarEventos (↩ loop)
//       .out(1) → FallbackListado
//          → ParsearEventos (↩ loop)
// WebhookTrigger
//    → LoadPromoterConfig (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: '2qYQ1PxmsJhWhT1q',
    name: 'SCRAPPER FLOWTE',
    active: true,
    isArchived: false,
    tags: ['SCRAPPER'],
    settings: {
        executionOrder: 'v1',
        binaryMode: 'separate',
        timeSavedMode: 'dynamic',
        timezone: 'Europe/Madrid',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
        errorWorkflow: 'IkqnFDu34CjPjXBj',
        executionTimeout: 3600,
    },
})
export class ScrapperFlowteWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '8a1acc99-d655-46e9-98f2-05404992c1ad',
        name: 'Split Out',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [-192, -432],
    })
    SplitOut = {
        fieldToSplitOut: 'data.data.events',
        include: 'allOtherFields',
        options: {
            disableDotNotation: false,
        },
    };

    @node({
        id: '4a2a353c-199b-4c3b-a342-d991fb796764',
        name: 'Execute a SQL query1',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [496, -432],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    ExecuteASqlQuery1 = {
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
        query: `SELECT f.id, f.event_id, f.name, f.event_url, f.venue
FROM raw_front_eventos f
LEFT JOIN raw_detalle_eventos d ON f.event_id = d.event_id
WHERE f.event_url IS NOT NULL
  AND d.id IS NULL
  -- Solo eventos de ESTA fuente (flowte almeria-cultura). Antes cogía los de
  -- menor id de CUALQUIER fuente y, al construir la URL de detalle como flowte,
  -- se atascaba en eventos no-flowte y nunca detallaba los de almeria-cultura
  -- (= sin cartel → sin imagen en cancerbero). Fix 2026-06-18.
  AND f.source_storefront = 'almeria-cultura-401'
ORDER BY f.id
LIMIT 25;`,
        options: {},
    };

    @node({
        id: 'b10be254-fc8c-4106-8218-d3c675bda37d',
        webhookId: '9625beb0-c3fd-4e34-a543-aaa9bfe4e672',
        name: 'Wait',
        type: 'n8n-nodes-base.wait',
        version: 1.1,
        position: [-416, -432],
    })
    Wait = {};

    @node({
        id: '2da4c0a6-a978-4945-ac90-0b83a64e7768',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.3,
        position: [-1312, -432],
    })
    ScheduleTrigger = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 0 * * 1-6',
                },
            ],
        },
    };

    @node({
        id: 'flowte-webhook-trigger',
        webhookId: 'flowte-trigger-test',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1312, -240],
    })
    WebhookTrigger = {
        httpMethod: 'POST',
        path: 'flowte-trigger-test',
        responseMode: 'lastNode',
        options: {},
    };

    @node({
        id: 'load-promoter-config',
        name: 'Load Promoter Config',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-1088, -432],
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
WHERE promotor_id = 'ayto_alm_cul';`,
        options: {},
    };

    @node({
        id: 'flowte-fallback-detalle',
        name: 'Fallback Detalle',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [944, -208],
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
            '={{ JSON.stringify({ url: ($json.event_url || $(\'Loop Over Items\').all()[$itemIndex].json.event_url), formats: ["html", "metadata"], wait_ms: 10000 }) }}',
        options: {},
    };

    @node({
        id: 'normalize-eventos-cheerio',
        name: 'Normalizar Eventos',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1168, -432],
    })
    NormalizarEventos = {
        jsCode: `const cheerio = require('cheerio');

const items = $input.all();
if (!items || items.length === 0) return [];

const MONTHS = {
  JAN: '01', ENERO: '01',
  FEB: '02', FEBRERO: '02',
  MAR: '03', MARZO: '03',
  APR: '04', ABR: '04', ABRIL: '04',
  MAY: '05', MAYO: '05',
  JUN: '06', JUNIO: '06',
  JUL: '07', JULIO: '07',
  AUG: '08', AGO: '08', AGOSTO: '08',
  SEP: '09', SEPT: '09', SEPTIEMBRE: '09',
  OCT: '10', OCTUBRE: '10',
  NOV: '11', NOVIEMBRE: '11',
  DEC: '12', DIC: '12', DICIEMBRE: '12',
};

function collapseWhitespace(value) {
  return (value || '').replace(/[ s]+/g, ' ').trim();
}

function normalizeText(value) {
  return collapseWhitespace(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

function formatDate(year, monthToken, day) {
  const month = MONTHS[monthToken] || '';
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function estimateSessions(startDate, endDate) {
  if (!startDate) return null;
  if (!endDate) return 1;
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

function parseDateTimeText(originalText) {
  const datetimeTextOriginal = collapseWhitespace(originalText);
  const normalized = normalizeText(datetimeTextOriginal);

  if (!normalized) {
    return {
      datetime_text_original: '',
      fecha_inicio: '',
      fecha_fin: '',
      hora_inicio: '',
      tipo_fecha: 'texto_no_parseable',
      num_sesiones_estimadas: null,
      tiene_multiples_sesiones: false,
    };
  }

  const uniqueTimes = Array.from(new Set(
    Array.from(normalized.matchAll(/(d{1,2}:d{2})/g)).map((match) => match[1])
  ));

  const uniqueDates = [];
  const pushDate = (date) => {
    if (date && !uniqueDates.includes(date)) uniqueDates.push(date);
  };

  const englishMatches = Array.from(normalized.matchAll(/(?:MON|TUE|WED|THU|FRI|SAT|SUN)s+(d{1,2})s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)s+(d{4})(?:s+(d{1,2}:d{2}))?/g));
  for (const match of englishMatches) {
    pushDate(formatDate(match[3], match[2], match[1]));
  }

  const spanishMatches = Array.from(normalized.matchAll(/(d{1,2})(?:s+Ys+(d{1,2}))?s+DEs+(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)s+DEs+(d{4})(?:s+As+LASs+(d{1,2}:d{2})(?:s+HORAS?)?)?/g));
  for (const match of spanishMatches) {
    pushDate(formatDate(match[4], match[3], match[1]));
    pushDate(formatDate(match[4], match[3], match[2] || match[1]));
  }

  if (uniqueDates.length === 0) {
    return {
      datetime_text_original: datetimeTextOriginal,
      fecha_inicio: '',
      fecha_fin: '',
      hora_inicio: uniqueTimes[0] || '',
      tipo_fecha: 'texto_no_parseable',
      num_sesiones_estimadas: null,
      tiene_multiples_sesiones: false,
    };
  }

  const fechaInicio = uniqueDates[0];
  const fechaFin = uniqueDates[uniqueDates.length - 1] || fechaInicio;
  const horaInicio = uniqueTimes[0] || '';
  const tieneMultiplesSesiones = uniqueDates.length > 1 || uniqueTimes.length > 1;

  let tipoFecha = 'simple';
  if (uniqueDates.length > 1 && horaInicio) {
    tipoFecha = 'rango_misma_hora';
  } else if (uniqueDates.length > 1) {
    tipoFecha = 'rango';
  } else if (uniqueTimes.length > 1) {
    tipoFecha = 'multiple_sesiones';
  }

  return {
    datetime_text_original: datetimeTextOriginal,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    hora_inicio: horaInicio,
    tipo_fecha: tipoFecha,
    num_sesiones_estimadas: estimateSessions(fechaInicio, fechaFin),
    tiene_multiples_sesiones: tieneMultiplesSesiones,
  };
}

function extractDateTimeText($, observacionText) {
  const selectorCandidates = [
    $('span.in-event-date-new').first().text(),
    $('span.header_event_date').first().text(),
    $('.item-v2-header.in-event-date').first().text(),
    $('div.item-v2-header.in-event-date').first().text(),
  ].map(collapseWhitespace).filter(Boolean);

  for (const candidate of selectorCandidates) {
    const englishMatch = candidate.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)s+d{1,2}s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)s+d{4}(?:s+d{1,2}:d{2})?/i);
    if (englishMatch) return englishMatch[0];

    const spanishMatch = candidate.match(/d{1,2}(?:s+Ys+d{1,2})?s+DEs+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+s+DEs+d{4}(?:s+As+LASs+d{1,2}:d{2}(?:s+HORAS?)?)?/i);
    if (spanishMatch) return spanishMatch[0];
  }

  const performanceDates = $('#perf-select option').map((_, el) => {
    const optionText = collapseWhitespace($(el).text());
    return optionText.replace(/s*([^)]*)s*$/g, '');
  }).get().filter(Boolean);
  if (performanceDates.length > 0) {
    return performanceDates.join(' | ');
  }

  const collapsedObservacion = collapseWhitespace(observacionText);
  if (!collapsedObservacion) return '';

  const englishPrefix = collapsedObservacion.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)s+d{1,2}s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)s+d{4}(?:s+d{1,2}:d{2})?/i);
  if (englishPrefix) return englishPrefix[0];

  const spanishPrefix = collapsedObservacion.match(/d{1,2}(?:s+Ys+d{1,2})?s+DEs+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+s+DEs+d{4}(?:s+As+LASs+d{1,2}:d{2}(?:s+HORAS?)?)?/i);
  if (spanishPrefix) return spanishPrefix[0];

  return '';
}

const result = [];

for (let i = 0; i < items.length; i++) {
  try {
    const json = items[i].json || {};
    const data = json.data || {};
    const metadata = data.metadata || {};

    const sourceUrl = metadata.sourceURL || metadata['og:url'] || metadata.url || '';
    const eventMatch = sourceUrl.match(/[?&]e=([^&]+)/);
    const eventId = eventMatch ? eventMatch[1] : '';

    const html = data.html || data.rawHtml || '';
    const screenshotUrl = data.screenshot || '';
    const ticketeraUrl = sourceUrl;

    if (collapseWhitespace(html).length < 100) {
      console.log('Item', i, ': HTML no disponible, saltando');
      continue;
    }

    const $ = cheerio.load(html);
    const tituloOriginal = collapseWhitespace($('h3.select-event-name').first().text());
    if (!tituloOriginal) {
      console.log('Item', i, ': Sin titulo, saltando');
      continue;
    }

    const titulo = tituloOriginal;
    const local = collapseWhitespace($('span.in-product-event-loc').first().text()) || collapseWhitespace($('.inheader-loc').first().text());
    const observacion = collapseWhitespace($('#select-event-desc').text());
    const dateTimeRaw = extractDateTimeText($, observacion);
    const parsedDateTime = parseDateTimeText(dateTimeRaw);
    // Flowte sirve dos versiones: <id>-<ts>-resize.<ext> (preview) y <id>-<ts>.<ext> (completa).
    // Quitamos "-resize" para guardar y descargar la imagen completa en Dropbox.
    const cartelUrlRaw = $('img#select-event-img').first().attr('src') || '';
    const cartelUrl = cartelUrlRaw.replace(/-resize(\\.[A-Za-z0-9]{2,5})(\\?|$)/, '$1$2');
    const descHtml = $('#select-event-desc').html() || '';
    const es_gratuito = /ENTRADA GRATUITA/i.test(descHtml);

    const prices = [];
    $('.ticket-price span[id]').each((_, el) => {
      const rawValue = $(el).attr('value') || $(el).text();
      const parsedValue = parseFloat(collapseWhitespace(rawValue).replace(',', '.'));
      if (!Number.isNaN(parsedValue)) prices.push(parsedValue);
    });

    const precio_entradas = prices.length > 0 ? Math.min(...prices) : 0;
    const precio_medio_entradas = prices.length > 0
      ? Math.round((prices.reduce((acc, value) => acc + value, 0) / prices.length) * 100) / 100
      : 0;

    result.push({
      json: {
        event_id: eventId,
        titulo,
        titulo_original: tituloOriginal,
        observacion,
        datetime_text_original: parsedDateTime.datetime_text_original,
        fecha_inicio: parsedDateTime.fecha_inicio,
        fecha_fin: parsedDateTime.fecha_fin,
        hora_inicio: parsedDateTime.hora_inicio,
        tipo_fecha: parsedDateTime.tipo_fecha,
        num_sesiones_estimadas: parsedDateTime.num_sesiones_estimadas,
        tiene_multiples_sesiones: parsedDateTime.tiene_multiples_sesiones,
        precio_entradas,
        precio_medio_entradas,
        local,
        es_gratuito,
        cartel_url: cartelUrl,
        screenshot_url: screenshotUrl,
        ticketera_url: ticketeraUrl,
      },
      pairedItem: { item: i },
    });
  } catch (err) {
    console.log('Error en item', i, ':', err.message);
  }
}

return result;`,
    };

    @node({
        id: 'insert-raw-detalle-eventos',
        name: 'Insert Normalized Events',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1376, -432],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    InsertNormalizedEvents = {
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
    '{{ JSON.stringify($json).replace(/'/g, "''") }}'::jsonb
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
    fecha_captura = NOW();`,
        options: {},
    };

    @node({
        id: '5249cb28-b3ee-4de9-8050-d75be3a0f644',
        name: '/scrape',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [944, -432],
        credentials: { firecrawlApi: { id: '3FsKPT3ZQeVfmMkM', name: 'Firecrawl account' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
        waitBetweenTries: 5000,
    })
    Scrape = {
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
                waitFor: 10000,
                actions: {
                    items: [
                        {
                            milliseconds: 5000,
                        },
                    ],
                },
                proxy: 'stealth',
            },
        },
        requestOptions: {},
    };

    @node({
        id: 'fase3-select-pending-adjuntos',
        name: 'Leer Adjuntos Pendientes',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [960, -752],
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
    WHERE (
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
        id: 'fase3-loop-over-pending-adjuntos',
        name: 'Loop Over Pending Adjuntos',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [1184, -752],
    })
    LoopOverPendingAdjuntos = {
        batchSize: 10,
        options: {},
    };

    @node({
        id: 'fase3-filtrar-adjuntos-validos',
        name: 'Filtrar Adjuntos Válidos',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1408, -816],
    })
    FiltrarAdjuntosValidos = {
        jsCode: `return $input
    .all()
    .filter((item) => String(item.json.url_origen || '').trim().length > 0);`,
    };

    @node({
        id: 'fase3-prepare-adjunto-dropbox',
        name: 'Preparar Adjunto Dropbox',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1632, -816],
    })
    PrepararAdjuntoDropbox = {
        mode: 'runOnceForEachItem',
        jsCode: `function normalizeSegment(value, fallback = 'sin-valor') {
    const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

    return normalized || fallback;
  }

  function extractExtension(url, tipo) {
    const cleanUrl = String(url || '').split('?')[0];
    const match = cleanUrl.match(/.([A-Za-z0-9]{2,5})$/);
    if (match) return match[1].toLowerCase();
    return tipo === 'screenshot' ? 'png' : 'jpg';
  }

  const eventId = String($json.event_id || '').trim();
  const tipo = String($json.tipo || '').trim();
  const titulo = String($json.titulo || '').trim();
  const promotor = normalizeSegment($json.promotor, 'sin-promotor');
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
        id: 'fase3-download-adjunto',
        name: 'Descargar Adjunto',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1856, -816],
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
        id: 'fase3-upload-adjunto-dropbox',
        name: 'Guardar Adjunto en Dropbox',
        type: 'n8n-nodes-base.dropbox',
        version: 1,
        position: [2080, -816],
        credentials: { dropboxOAuth2Api: { id: 'mp4rjzvmnH1bwU8C', name: 'Dropbox account' } },
    })
    GuardarAdjuntoEnDropbox = {
        authentication: 'oAuth2',
        path: '={{ $json.dropbox_path }}',
        binaryData: true,
    };

    @node({
        id: 'fase3-register-adjunto',
        name: 'Registrar Adjunto',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [2304, -816],
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
        id: 'fase3-update-adjuntos-descargados',
        name: 'Marcar Adjuntos Descargados',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [2528, -752],
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

    @node({
        id: 'fase0-normalizar-titulo',
        name: 'Normalizar Título',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [32, -432],
    })
    NormalizarTitulo = {
        mode: 'runOnceForEachItem',
        jsCode: `const event = $json["data.data.events"];

if (!event || !event.name) {
  return $json;
}

let result = String(event.name).trim();

// Proteger Ñ y ñ antes de normalizar
result = result
  .replace(/Ñ/g, '__ENE_MAY__')
  .replace(/ñ/g, '__ENE_MIN__');

// Quitar acentos
result = result
  .normalize('NFD')
  .replace(/[\\u0300-\\u036f]/g, '');

// Recuperar Ñ
result = result
  .replace(/__ENE_MAY__/g, 'Ñ')
  .replace(/__ENE_MIN__/g, 'ñ');

// Pasar a mayúsculas
result = result.toUpperCase();

// Permitir letras, números, espacios, Ñ, comas y guiones
result = result.replace(/[^A-ZÑ0-9,.:+\\- ]/g, '');

// Limpiar espacios
result = result.replace(/\\s+/g, ' ').trim();

// Guardar en la ruta correcta
$json["data.data.events"].name = result;

return $json;`,
    };

    @node({
        id: 'e9e4bb2e-97ab-475b-ae87-7a42b1bee842',
        name: 'Execute a SQL query FRONT',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [256, -432],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    ExecuteASqlQueryFront = {
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
    'almeria-cultura-401',
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
        id: '5444ffcb-d2c6-44da-b12a-ea57542ab349',
        name: '/scrape1',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [-864, -432],
        credentials: { firecrawlApi: { id: '3FsKPT3ZQeVfmMkM', name: 'Firecrawl account' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
    })
    Scrape1 = {
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
        id: 'flowte-fallback-listado',
        name: 'Fallback Listado',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [-864, -208],
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
        id: 'fase0-parsear-eventos',
        name: 'Parsear Eventos',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-640, -432],
    })
    ParsearEventos = {
        jsCode: `
const cheerio = require('cheerio');
const html = $json.data.html || '';

if (!html) {
  return { data: { data: { events: [] } } };
}

const $ = cheerio.load(html);
const events = [];

// Buscar para cada tarjeta de evento
$('div.card.mb-4.text-center.events.event-view-card').each((idx, el) => {
  const $card = $(el);
  
  // Extraer nombre del evento
  const name = $card.find('h5').first().text().trim();
  
  // Extraer fecha y hora (estan en small.incard-item-date)
  const datetime_text = $card.find('small.incard-item-date').first().text().trim();
  
  // Extraer venue (despues del icono location-dot)
  let venue = '';
  $card.find('small').each((_, smallEl) => {
    const text = $(smallEl).text();
    if (text.includes('fa-location-dot') || $(smallEl).prev().hasClass('fa-solid')) {
      venue = text.replace(/.*fa-location-dot|.*fa-solid.*/, '').trim();
    }
  });
  
  // Si venue esta vacio, intentar leer el segundo small
  if (!venue) {
    const smalls = $card.find('small');
    if (smalls.length >= 2) {
      venue = $(smalls[1]).text().trim();
    }
  }
  
  // Extraer event_id del atributo value o id
  let event_id = $card.attr('value') || $card.attr('id') || '';
  if (event_id.startsWith('event_')) {
    event_id = event_id.replace('event_', '');
  }
  
  // Construir event_url
  const event_url = event_id ? \`https://www.flowte.me/storefront/almeria-cultura-401?e=\${event_id}\` : '';
  
  // Solo agregar si tiene al menos nombre
  if (name) {
    events.push({
      name,
      event_id: event_id || '',
      datetime_text: datetime_text || '',
      venue: venue || '',
      event_url: event_url || ''
    });
  }
});

return {
  data: {
    data: {
      events
    }
  }
};
`,
    };

    @node({
        id: '572b19c4-a3ba-42e7-b0ec-1b7fc8a44b7f',
        name: 'Loop Over Items',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [720, -480],
    })
    LoopOverItems = {
        batchSize: 10,
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ExecuteASqlQuery1.out(0).to(this.LoopOverItems.in(0));
        this.SplitOut.out(0).to(this.NormalizarTitulo.in(0));
        this.NormalizarTitulo.out(0).to(this.ExecuteASqlQueryFront.in(0));
        this.Wait.out(0).to(this.SplitOut.in(0));
        this.ScheduleTrigger.out(0).to(this.LoadPromoterConfig.in(0));
        this.WebhookTrigger.out(0).to(this.LoadPromoterConfig.in(0));
        this.LoadPromoterConfig.out(0).to(this.Scrape1.in(0));
        this.Scrape1.out(0).to(this.ParsearEventos.in(0));
        this.Scrape1.out(1).to(this.FallbackListado.in(0));
        this.FallbackListado.out(0).to(this.ParsearEventos.in(0));
        this.ParsearEventos.out(0).to(this.Wait.in(0));
        this.Scrape.out(0).to(this.NormalizarEventos.in(0));
        this.Scrape.out(1).to(this.FallbackDetalle.in(0));
        this.FallbackDetalle.out(0).to(this.NormalizarEventos.in(0));
        this.NormalizarEventos.out(0).to(this.InsertNormalizedEvents.in(0));
        this.LoopOverItems.out(0).to(this.LeerAdjuntosPendientes.in(0));
        this.LoopOverItems.out(1).to(this.Scrape.in(0));
        this.InsertNormalizedEvents.out(0).to(this.LoopOverItems.in(0));
        this.LeerAdjuntosPendientes.out(0).to(this.LoopOverPendingAdjuntos.in(0));
        this.LoopOverPendingAdjuntos.out(1).to(this.FiltrarAdjuntosValidos.in(0));
        this.FiltrarAdjuntosValidos.out(0).to(this.PrepararAdjuntoDropbox.in(0));
        this.PrepararAdjuntoDropbox.out(0).to(this.DescargarAdjunto.in(0));
        this.DescargarAdjunto.out(0).to(this.GuardarAdjuntoEnDropbox.in(0));
        this.GuardarAdjuntoEnDropbox.out(0).to(this.RegistrarAdjunto.in(0));
        this.RegistrarAdjunto.out(0).to(this.MarcarAdjuntosDescargados.in(0));
        this.MarcarAdjuntosDescargados.out(0).to(this.LoopOverPendingAdjuntos.in(0));
        this.ExecuteASqlQueryFront.out(0).to(this.ExecuteASqlQuery1.in(0));
    }
}
