import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : COMPROBACION TAQUILLA
// Nodes   : 13  |  Connections: 14
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WhenClickingExecuteWorkflow        manualTrigger
// ScheduleTrigger                    scheduleTrigger
// WebhookTrigger                     webhook
// AsegurarTablaChecksTaquilla        postgres                   [creds]
// SeleccionarChecksTaquilla          postgres                   [creds]
// LoopOverChecksTaquilla             splitInBatches
// InspeccionarTicketera              firecrawl                  [onError→out(1)] [creds] [retry]
// FallbackInspeccion                 httpRequest                [onError→regular]
// ClasificarEstadoTaquilla           code
// PrepararEvidenciaDropbox           code
// DescargarCapturaTaquilla           httpRequest                [onError→regular]
// GuardarEvidenciaTaquillaDropbox    dropbox                    [onError→regular] [creds]
// RegistrarCheckTaquilla             postgres                   [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenClickingExecuteWorkflow
//    → AsegurarTablaChecksTaquilla
//      → SeleccionarChecksTaquilla
//        → LoopOverChecksTaquilla
//         .out(1) → InspeccionarTicketera
//            → ClasificarEstadoTaquilla
//              → PrepararEvidenciaDropbox
//                → DescargarCapturaTaquilla
//                  → GuardarEvidenciaTaquillaDropbox
//                    → RegistrarCheckTaquilla
//                      → LoopOverChecksTaquilla (↩ loop)
//           .out(1) → FallbackInspeccion
//              → ClasificarEstadoTaquilla (↩ loop)
// ScheduleTrigger
//    → AsegurarTablaChecksTaquilla (↩ loop)
// WebhookTrigger
//    → AsegurarTablaChecksTaquilla (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'eE0zwAWao7Axsdi9',
    name: 'COMPROBACION TAQUILLA',
    active: true,
    isArchived: false,
    settings: {
        timezone: 'Europe/Madrid',
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
        binaryMode: 'separate',
        timeSavedMode: 'fixed',
        errorWorkflow: 'IkqnFDu34CjPjXBj',
    },
})
export class ComprobacionTaquillaWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'taquilla-manual-trigger',
        name: 'When clicking "Execute workflow"',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-928, -784],
    })
    WhenClickingExecuteWorkflow = {};

    @node({
        id: 'taquilla-schedule-trigger',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.3,
        position: [-928, -624],
    })
    ScheduleTrigger = {
        rule: {
            interval: [
                {
                    triggerAtHour: 21,
                    triggerAtMinute: 11,
                },
            ],
        },
    };

    @node({
        id: 'taquilla-webhook-trigger',
        webhookId: 'comprobacion-taquilla-trigger-2026',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-928, -464],
    })
    WebhookTrigger = {
        httpMethod: 'POST',
        path: 'comprobacion-taquilla-trigger-2026',
        responseMode: 'lastNode',
        options: {},
    };

    @node({
        id: 'taquilla-ensure-table',
        name: 'Asegurar Tabla Checks Taquilla',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-704, -704],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    AsegurarTablaChecksTaquilla = {
        operation: 'executeQuery',
        schema: {
            __rl: true,
            value: 'public',
            mode: 'list',
        },
        table: {
            __rl: true,
            value: 'raw_eventos_taquilla_checks',
            mode: 'list',
        },
        query: `CREATE TABLE IF NOT EXISTS raw_eventos_taquilla_checks (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL,
  checkpoint_dias INTEGER NOT NULL,
  checkpoint_codigo TEXT NOT NULL,
  checkpoint_fecha_objetivo DATE NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,
  status_motivo TEXT,
  ticketera_url TEXT NOT NULL,
  http_status INTEGER,
  texto_detectado TEXT,
  screenshot_origen TEXT,
  screenshot_dropbox TEXT,
  evento_lectura TEXT,
  payload_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE raw_eventos_taquilla_checks
  ADD COLUMN IF NOT EXISTS evento_lectura TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_raw_eventos_taquilla_checks_checkpoint
  ON raw_eventos_taquilla_checks (event_id, checkpoint_dias, checkpoint_fecha_objetivo);

CREATE INDEX IF NOT EXISTS idx_raw_eventos_taquilla_checks_status
  ON raw_eventos_taquilla_checks (status, checked_at DESC);`,
        options: {},
    };

    @node({
        id: 'taquilla-select-checks',
        name: 'Seleccionar Checks Taquilla',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-480, -704],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    SeleccionarChecksTaquilla = {
        operation: 'executeQuery',
        schema: {
            __rl: true,
            value: 'public',
            mode: 'list',
        },
        table: {
            __rl: true,
            value: 'raw_eventos_taquilla_checks',
            mode: 'list',
        },
        query: `WITH event_history AS (
  SELECT
    t.event_id,
    BOOL_OR(t.status IN ('cancelado', 'despublicado', 'celebrado')) AS has_terminal_status,
    BOOL_OR(t.checkpoint_dias = 0 AND t.status = 'online') AS has_zero_day_online
  FROM raw_eventos_taquilla_checks t
  GROUP BY t.event_id
),
due_checks AS (
  SELECT
    d.event_id,
    d.titulo,
    d.local,
    d.fecha_inicio,
    d.fecha_captura,
    d.ticketera_url,
    f.event_url,
    f.source_storefront,
    COALESCE(pc.promotor_id, f.source_storefront, 'sin_promotor') AS promotor,
    COALESCE(EXTRACT(YEAR FROM d.fecha_inicio)::text, TO_CHAR(CURRENT_DATE, 'YYYY')) AS anio,
    (d.fecha_inicio - CURRENT_DATE) AS checkpoint_dias,
    CASE
      WHEN (d.fecha_inicio - CURRENT_DATE) = 15 THEN '15d'
      WHEN (d.fecha_inicio - CURRENT_DATE) = 5 THEN '5d'
      WHEN (d.fecha_inicio - CURRENT_DATE) = 3 THEN '3d'
      WHEN (d.fecha_inicio - CURRENT_DATE) = 0 THEN '0d'
      WHEN (d.fecha_inicio - CURRENT_DATE) = -1 THEN '-1d'
      ELSE 'otro'
    END AS checkpoint_codigo
  FROM raw_detalle_eventos d
  LEFT JOIN raw_front_eventos f ON f.event_id = d.event_id
  LEFT JOIN promotores_configuracion pc
    ON f.event_url LIKE split_part(pc.url_lista, '?', 1) || '%'
  WHERE COALESCE(d.ticketera_url, '') <> ''
    AND d.fecha_inicio IS NOT NULL
    AND (d.fecha_inicio - CURRENT_DATE) IN (15, 5, 3, 0, -1)
    -- Excluir AGENDAS/agregadores culturales: no son ticketeras reales, así
    -- que comprobar su "taquilla" no aporta. Las ticketeras de verdad
    -- (eventbrite, tomaticket, etc.) SÍ se comprueban. 2026-06-17.
    AND d.ticketera_url NOT ILIKE '%conciertos.club%'
    AND d.ticketera_url NOT ILIKE '%turismodealmeria.org%'
    AND d.ticketera_url NOT ILIKE '%fundacionunicaja.com%'
)
SELECT
  c.event_id,
  c.titulo,
  c.local,
  c.fecha_inicio,
  c.fecha_captura,
  c.ticketera_url,
  c.event_url,
  c.source_storefront,
  c.promotor,
  c.anio,
  c.checkpoint_dias,
  c.checkpoint_codigo,
  c.fecha_inicio AS checkpoint_fecha_objetivo
FROM due_checks c
LEFT JOIN event_history h ON h.event_id = c.event_id
WHERE NOT EXISTS (
  SELECT 1
  FROM raw_eventos_taquilla_checks t
  WHERE t.event_id = c.event_id
    AND t.checkpoint_dias = c.checkpoint_dias
    AND t.checkpoint_fecha_objetivo = c.fecha_inicio
)
  AND COALESCE(h.has_terminal_status, false) = false
  AND (
    c.checkpoint_dias <> -1
    OR COALESCE(h.has_zero_day_online, false) = true
  )
ORDER BY c.fecha_inicio, c.event_id
LIMIT 20;`,
        options: {},
    };

    @node({
        id: 'taquilla-loop-checks',
        name: 'Loop Over Checks Taquilla',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [-256, -704],
    })
    LoopOverChecksTaquilla = {
        batchSize: 10,
        options: {},
    };

    @node({
        id: 'taquilla-firecrawl-inspection',
        name: 'Inspeccionar Ticketera',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [-32, -704],
        credentials: { firecrawlApi: { id: '3FsKPT3ZQeVfmMkM', name: 'Firecrawl account' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
        waitBetweenTries: 5000,
    })
    InspeccionarTicketera = {
        operation: 'scrape',
        url: '={{ $json.ticketera_url }}',
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
                            viewportWidth: 1440,
                            viewportHeight: 2600,
                        },
                    ],
                },
                onlyMainContent: false,
                headers: {},
                waitFor: 10000,
                proxy: 'stealth',
            },
        },
        requestOptions: {},
    };

    @node({
        id: 'taquilla-fallback-inspection',
        name: 'Fallback Inspeccion',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [-32, -480],
        onError: 'continueRegularOutput',
    })
    FallbackInspeccion = {
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
            '={{ JSON.stringify({ url: ($json.ticketera_url || $(\'Loop Over Checks Taquilla\').all()[$itemIndex].json.ticketera_url), formats: ["html"], wait_ms: 3000 }) }}',
        options: {},
    };

    @node({
        id: 'taquilla-classify-status',
        name: 'Clasificar Estado Taquilla',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [192, -704],
    })
    ClasificarEstadoTaquilla = {
        jsCode: `const cheerio = require('cheerio');

const items = $input.all();
if (!items || items.length === 0) return [];
const selectedItems = $('Seleccionar Checks Taquilla').all();

function collapseWhitespace(value) {
  return String(value || '').replace(/s+/g, ' ').trim();
}

function normalizeText(value) {
  return collapseWhitespace(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return collapseWhitespace(match[0]);
  }
  return '';
}

const cancelPatterns = [
  /EVENTOs+CANCELADO/,
  /CANCELAD[OA]S?/,
  /SEs+HAs+CANCELADO/,
  /ANULAD[OA]S?/,
  /SUSPENDID[OA]S?/
];

const soldOutPatterns = [
  /SOLDs+OUT/,
  /ENTRADAS?s+AGOTADAS?/,
  /AGOTAD[OA]S?/,
  /SINs+ENTRADAS?/,
  /NOs+HAYs+ENTRADAS?/,
  /AFOROs+COMPLETO/,
  /COMPLETO/
];

const celebradoPatterns = [
  /YAs+SEs+HAs+CELEBRADO/,
  /YAs+HAs+TENIDOs+LUGAR/,
  /HAs+TENIDOs+LUGAR/,
  /EVENTOs+FINALIZADO/,
  /EVENTOs+PASADO/
];

const despublicadoPatterns = [
  /YAs+NOs+ESTAs+DISPONIBLE/,
  /NOs+ESTAs+DISPONIBLE/,
  /RETIRAD[OA]S?s+DEs+LAs+VENTA/,
  /EVENTOs+NOs+DISPONIBLE/,
  /CONTENIDOs+NOs+DISPONIBLE/,
  /PAGINAs+NOs+ENCONTRADA/,
  /NOs+SEs+ENCUENTRA/,
  /ERRORs+404/,
  /NOTs+FOUND/
];

const results = [];

for (let index = 0; index < items.length; index++) {
  const item = items[index];
  const json = item.json || {};
  const pairedIndex = typeof item.pairedItem?.item === 'number' ? item.pairedItem.item : index;
  const selected = selectedItems[pairedIndex]?.json || {};
  const data = json.data || {};
  const metadata = data.metadata || {};
  const html = data.html || data.rawHtml || '';
  const screenshotSourceUrl = data.screenshot || '';
  const pageTitle = collapseWhitespace(metadata.title || metadata['og:title'] || '');
  const sourceUrl = metadata.sourceURL || metadata['og:url'] || metadata.url || selected.ticketera_url || json.ticketera_url || '';
  const checkpointDays = Number(selected.checkpoint_dias);
  const isPostEventCheck = Number.isFinite(checkpointDays) && checkpointDays < 0;

  let bodyText = '';
  if (html) {
    try {
      const $ = cheerio.load(html);
      bodyText = collapseWhitespace($('body').text());
    } catch (error) {
      bodyText = '';
    }
  }

  const combinedText = [pageTitle, bodyText].filter(Boolean).join(' ');
  const normalizedText = normalizeText(combinedText);
  const httpStatusRaw = metadata.statusCode || metadata.httpStatusCode || data.statusCode || data.httpStatus || json.statusCode || '';
  const httpStatus = Number(httpStatusRaw);
  const hasHttpStatus = Number.isFinite(httpStatus);

  const cancelHit = firstMatch(normalizedText, cancelPatterns);
  const soldOutHit = firstMatch(normalizedText, soldOutPatterns);
  const celebradoHit = firstMatch(normalizedText, celebradoPatterns);
  const despublicadoHit = firstMatch(normalizedText, despublicadoPatterns);
  const htmlLength = collapseWhitespace(html).length;
  const bodyLength = collapseWhitespace(bodyText).length;
  const hasEvidence = htmlLength >= 80 || bodyLength >= 40 || Boolean(screenshotSourceUrl);

  let status = 'otro';
  let statusMotivo = 'No hay senales concluyentes en la ticketera';
  let textoDetectado = '';

  if ((hasHttpStatus && httpStatus >= 400) || (!html && !screenshotSourceUrl)) {
    status = isPostEventCheck ? 'despublicado' : 'inaccesible';
    statusMotivo = hasHttpStatus
      ? 'La ticketera devolvio HTTP ' + httpStatus
      : 'Sin HTML ni captura de evidencia';
  } else if (cancelHit) {
    status = 'cancelado';
    statusMotivo = 'Se detecto una senal textual de cancelacion';
    textoDetectado = cancelHit;
  } else if (soldOutHit) {
    status = 'sold_out';
    statusMotivo = 'Se detecto una senal textual de agotado';
    textoDetectado = soldOutHit;
  } else if (celebradoHit) {
    status = 'celebrado';
    statusMotivo = 'Se detecto una senal textual de evento ya celebrado';
    textoDetectado = celebradoHit;
  } else if (despublicadoHit) {
    status = 'despublicado';
    statusMotivo = 'Se detecto una senal textual de retirada o despublicacion';
    textoDetectado = despublicadoHit;
  } else if (hasEvidence) {
    status = 'online';
    statusMotivo = 'La ticketera sigue accesible y no muestra senales negativas';
  }

  const checkedAt = new Date().toISOString();

  results.push({
    json: {
      event_id: selected.event_id || '',
      titulo: selected.titulo || '',
      local: selected.local || '',
      fecha_inicio: selected.fecha_inicio || '',
      fecha_captura: selected.fecha_captura || '',
      ticketera_url: selected.ticketera_url || sourceUrl || '',
      event_url: selected.event_url || '',
      source_storefront: selected.source_storefront || '',
      promotor: selected.promotor || 'sin_promotor',
      anio: selected.anio || '',
      checkpoint_dias: selected.checkpoint_dias ?? null,
      checkpoint_codigo: selected.checkpoint_codigo || '',
      checkpoint_fecha_objetivo: selected.checkpoint_fecha_objetivo || selected.fecha_inicio || '',
      checked_at: checkedAt,
      status,
      status_motivo: statusMotivo,
      texto_detectado: textoDetectado,
      http_status: hasHttpStatus ? httpStatus : null,
      screenshot_source_url: screenshotSourceUrl,
      html_excerpt: collapseWhitespace(bodyText).slice(0, 1500),
      payload_json: {
        selected_context: selected,
        source_url: sourceUrl,
        page_title: pageTitle,
        http_status: hasHttpStatus ? httpStatus : null,
        screenshot_source_url: screenshotSourceUrl,
        html_excerpt: collapseWhitespace(bodyText).slice(0, 4000),
        checkpoint_dias: selected.checkpoint_dias ?? null,
        checkpoint_codigo: selected.checkpoint_codigo || '',
        is_post_event_check: isPostEventCheck,
        metadata,
      },
    },
    pairedItem: item.pairedItem,
  });
}

return results;`,
    };

    @node({
        id: 'taquilla-prepare-dropbox',
        name: 'Preparar Evidencia Dropbox',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [416, -704],
    })
    PrepararEvidenciaDropbox = {
        jsCode: `const items = $input.all();
if (!items || items.length === 0) return [];

function normalizeSegment(value, fallback) {
  const cleaned = String(value || '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return cleaned || fallback;
}

function extractExtension(value) {
  const match = String(value || '').match(/\\.([A-Za-z0-9]{2,5})(?:[?#].*)?$/);
  return match ? match[1].toLowerCase() : 'png';
}

function formatDisplayDate(value) {
  const normalized = String(value || '').slice(0, 10);
  const match = normalized.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
  if (!match) return normalized || 'sin fecha';
  return match[3] + '/' + match[2] + '/' + match[1];
}

return items.map((item) => {
  const json = item.json || {};
  const eventId = String(json.event_id || '').trim();
  const titulo = String(json.titulo || '').trim();
  const promotor = normalizeSegment(json.promotor, 'sin-promotor');
  const anio = String(json.anio || new Date().getFullYear());
  const checkpointCodigo = String(json.checkpoint_codigo || 'check');
  const checkedDate = String(json.checked_at || new Date().toISOString()).slice(0, 10);
  const tituloSlug = normalizeSegment(titulo, 'evento');
  const eventSlug = eventId + '+' + tituloSlug;
  const extension = extractExtension(json.screenshot_source_url);
  const eventoLectura = formatDisplayDate(json.checkpoint_fecha_objetivo || json.fecha_inicio) + ' | ' + (titulo || eventId || 'evento');
  const nombreArchivo = 'taquilla-' + checkpointCodigo + '-' + checkedDate + '.' + extension;
  const dropboxFolder = '/0-CANCERBERO/EVENTOS/' + promotor + '/' + anio + '/' + eventSlug;

  return {
    json: {
      event_id: eventId,
      titulo,
      local: json.local || '',
      fecha_inicio: json.fecha_inicio || '',
      fecha_captura: json.fecha_captura || '',
      ticketera_url: json.ticketera_url || '',
      event_url: json.event_url || '',
      source_storefront: json.source_storefront || '',
      promotor,
      anio,
      checkpoint_dias: json.checkpoint_dias,
      checkpoint_codigo: checkpointCodigo,
      checkpoint_fecha_objetivo: json.checkpoint_fecha_objetivo || json.fecha_inicio || '',
      checked_at: json.checked_at || new Date().toISOString(),
      status: json.status || 'otro',
      status_motivo: json.status_motivo || '',
      texto_detectado: json.texto_detectado || '',
      http_status: json.http_status ?? null,
      screenshot_source_url: json.screenshot_source_url || '',
      evento_lectura: eventoLectura,
      payload_json: json.payload_json || {},
      event_slug: eventSlug,
      nombre_archivo: nombreArchivo,
      dropbox_folder: dropboxFolder,
      dropbox_path: dropboxFolder + '/' + nombreArchivo,
    },
    pairedItem: item.pairedItem,
  };
});`,
    };

    @node({
        id: 'taquilla-download-screenshot',
        name: 'Descargar Captura Taquilla',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [640, -704],
        onError: 'continueRegularOutput',
    })
    DescargarCapturaTaquilla = {
        url: '={{ $json.screenshot_source_url }}',
        options: {
            response: {
                response: {
                    responseFormat: 'file',
                },
            },
        },
    };

    @node({
        id: 'taquilla-upload-dropbox',
        name: 'Guardar Evidencia Taquilla Dropbox',
        type: 'n8n-nodes-base.dropbox',
        version: 1,
        position: [864, -704],
        credentials: { dropboxOAuth2Api: { id: 'mp4rjzvmnH1bwU8C', name: 'Dropbox account' } },
        onError: 'continueRegularOutput',
    })
    GuardarEvidenciaTaquillaDropbox = {
        authentication: 'oAuth2',
        path: '={{ $json.dropbox_path }}',
        binaryData: true,
    };

    @node({
        id: 'taquilla-register-check',
        name: 'Registrar Check Taquilla',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1088, -704],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    RegistrarCheckTaquilla = {
        operation: 'executeQuery',
        schema: {
            __rl: true,
            value: 'public',
            mode: 'list',
        },
        table: {
            __rl: true,
            value: 'raw_eventos_taquilla_checks',
            mode: 'list',
        },
        query: `INSERT INTO raw_eventos_taquilla_checks (
  event_id,
  checkpoint_dias,
  checkpoint_codigo,
  checkpoint_fecha_objetivo,
  checked_at,
  status,
  status_motivo,
  ticketera_url,
  http_status,
  texto_detectado,
  screenshot_origen,
  screenshot_dropbox,
  evento_lectura,
  payload_json,
  updated_at
)
VALUES (
  '{{ (($('Preparar Evidencia Dropbox').item.json.event_id) || '').replace(/'/g, "''") }}',
  {{ $('Preparar Evidencia Dropbox').item.json.checkpoint_dias ?? 'NULL' }},
  '{{ (($('Preparar Evidencia Dropbox').item.json.checkpoint_codigo) || '').replace(/'/g, "''") }}',
  CAST(NULLIF('{{ $('Preparar Evidencia Dropbox').item.json.checkpoint_fecha_objetivo || '' }}', '') AS DATE),
  COALESCE(CAST(NULLIF('{{ $('Preparar Evidencia Dropbox').item.json.checked_at || '' }}', '') AS timestamptz), NOW()),
  '{{ (($('Preparar Evidencia Dropbox').item.json.status) || 'otro').replace(/'/g, "''") }}',
  '{{ (($('Preparar Evidencia Dropbox').item.json.status_motivo) || '').replace(/'/g, "''").split('$').join('') }}',
  '{{ (($('Preparar Evidencia Dropbox').item.json.ticketera_url) || '').replace(/'/g, "''") }}',
  {{ $('Preparar Evidencia Dropbox').item.json.http_status ?? 'NULL' }},
  '{{ (($('Preparar Evidencia Dropbox').item.json.texto_detectado) || '').replace(/'/g, "''").split('$').join('') }}',
  '{{ (($('Preparar Evidencia Dropbox').item.json.screenshot_source_url) || '').replace(/'/g, "''") }}',
  '{{ (($('Preparar Evidencia Dropbox').item.json.dropbox_path) || '').replace(/'/g, "''") }}',
  '{{ (($('Preparar Evidencia Dropbox').item.json.evento_lectura) || '').replace(/'/g, "''").split('$').join('') }}',
  '{{ JSON.stringify($('Preparar Evidencia Dropbox').item.json.payload_json || {}).replace(/'/g, "''").split('$').join('') }}'::jsonb,
  NOW()
)
ON CONFLICT (event_id, checkpoint_dias, checkpoint_fecha_objetivo)
DO UPDATE SET
  checked_at = EXCLUDED.checked_at,
  status = EXCLUDED.status,
  status_motivo = EXCLUDED.status_motivo,
  ticketera_url = EXCLUDED.ticketera_url,
  http_status = EXCLUDED.http_status,
  texto_detectado = EXCLUDED.texto_detectado,
  screenshot_origen = EXCLUDED.screenshot_origen,
  screenshot_dropbox = EXCLUDED.screenshot_dropbox,
  evento_lectura = EXCLUDED.evento_lectura,
  payload_json = EXCLUDED.payload_json,
  updated_at = NOW();`,
        options: {
            queryBatching: 'independently',
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhenClickingExecuteWorkflow.out(0).to(this.AsegurarTablaChecksTaquilla.in(0));
        this.ScheduleTrigger.out(0).to(this.AsegurarTablaChecksTaquilla.in(0));
        this.WebhookTrigger.out(0).to(this.AsegurarTablaChecksTaquilla.in(0));
        this.AsegurarTablaChecksTaquilla.out(0).to(this.SeleccionarChecksTaquilla.in(0));
        this.SeleccionarChecksTaquilla.out(0).to(this.LoopOverChecksTaquilla.in(0));
        this.LoopOverChecksTaquilla.out(1).to(this.InspeccionarTicketera.in(0));
        this.InspeccionarTicketera.out(0).to(this.ClasificarEstadoTaquilla.in(0));
        this.InspeccionarTicketera.out(1).to(this.FallbackInspeccion.in(0));
        this.FallbackInspeccion.out(0).to(this.ClasificarEstadoTaquilla.in(0));
        this.ClasificarEstadoTaquilla.out(0).to(this.PrepararEvidenciaDropbox.in(0));
        this.PrepararEvidenciaDropbox.out(0).to(this.DescargarCapturaTaquilla.in(0));
        this.DescargarCapturaTaquilla.out(0).to(this.GuardarEvidenciaTaquillaDropbox.in(0));
        this.GuardarEvidenciaTaquillaDropbox.out(0).to(this.RegistrarCheckTaquilla.in(0));
        this.RegistrarCheckTaquilla.out(0).to(this.LoopOverChecksTaquilla.in(0));
    }
}
