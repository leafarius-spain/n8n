import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SCRAPPER CLASIJAZZ
// Nodes   : 27  |  Connections: 29
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ScheduleTrigger                    scheduleTrigger
// ManualTrigger                      manualTrigger
// WebhookTrigger                     webhook
// LoadPromoterConfig                 postgres                   [creds]
// GenerarPaginas                     code
// ScrapeListado                      firecrawl                  [creds]
// ParsearListadoClasijazz            code
// Wait                               wait
// SplitOut                           splitOut
// NormalizarTitulo                   code
// UpsertRawFrontEventos              postgres                   [creds]
// SelectFrontSinDetalle              postgres                   [creds]
// LoopEventos                        splitInBatches
// ScrapeDetalleClasijazz             firecrawl                  [onError→regular] [creds] [retry]
// ParsearDetalleClasijazz            code
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
//          → ParsearListadoClasijazz
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
//                       .out(1) → ScrapeDetalleClasijazz
//                          → ParsearDetalleClasijazz
//                            → ConsolidarDetalle
//                              → AceptarEspectaculo
//                                → UpsertRawDetalleEventos
//                                  → LoopEventos (↩ loop)
//                               .out(1) → MarcarNoEspectaculoEnFront
//                                  → LoopEventos (↩ loop)
// ManualTrigger
//    → LoadPromoterConfig (↩ loop)
// WebhookTrigger
//    → LoadPromoterConfig (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: '3GANMceX1JQdPXj1',
    name: 'SCRAPPER CLASIJAZZ',
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
export class ScrapperClasijazzWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'clasi-schedule-trigger',
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
                    expression: '0 5 * * 1-6',
                },
            ],
        },
    };

    @node({
        id: 'clasi-manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-1820, 192],
    })
    ManualTrigger = {};

    @node({
        id: 'clasi-webhook-trigger',
        webhookId: 'clasijazz-trigger-test',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1820, 384],
    })
    WebhookTrigger = {
        httpMethod: 'POST',
        path: 'clasijazz-trigger-test',
        responseMode: 'lastNode',
        options: {},
    };

    @node({
        id: 'clasi-load-promoter-config',
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
WHERE promotor_id = 'clasijazz'
  AND habilitado = true;`,
        options: {},
    };

    @node({
        id: 'clasi-generar-paginas',
        name: 'Generar Paginas',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-1376, 0],
    })
    GenerarPaginas = {
        jsCode: `const promoter = ($input.all()[0] && $input.all()[0].json) || {};
const TOTAL_PAGES = 3;
const out = [];
for (let p = 1; p <= TOTAL_PAGES; p++) {
  const url = p === 1
    ? 'https://clasijazz.com/eventos/'
    : 'https://clasijazz.com/eventos/lista/p%C3%A1gina/' + p + '/';
  out.push({
    json: { ...promoter, url_lista: url, page_index: p },
  });
}
return out;`,
    };

    @node({
        id: 'clasi-scrape-listado',
        name: 'Scrape Listado',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [-1152, 0],
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
        id: 'clasi-parsear-listado',
        name: 'Parsear Listado CLASIJAZZ',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-928, 0],
    })
    ParsearListadoClasijazz = {
        jsCode: `const cheerio = require('cheerio');

const items = $input.all();
const seen = new Set();
const events = [];

function clean(t) {
  return String(t || '').replace(/\\s+/g, ' ').trim();
}

function normalize(t) {
  return clean(t).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase();
}

// Reglas de filtrado (2026-06-22): NO se filtra por precio. Un concierto a 3-5€
// o gratis genera derechos igual, y si descartamos por precio aquí, otra fuente
// SIN precio nos lo cuela igual y perdemos el dedup. Se aceptan TODOS los que
// por título sean espectáculo (conciertos a cualquier precio, incl. gratis);
// solo se descarta por TÍTULO lo que claramente no es espectáculo (talleres,
// cursos, audiciones de alumnos, charlas…). Cancerbero filtra/unifica luego.
const NOT_ESPECTACULO_BASE = /TALLER|MASTERCLASS|MASTER\\s+CLASS|WORKSHOP|CURSO|CLASE\\s+DE|INTERCAMBIO|APERITIVO|CHARLA|COLOQUIO|CONFERENCIA|MESA\\s+REDONDA|JORNADA\\s+DE\\s+CONVIVENCIA|VISITA\\s+GUIADA|RUTA\\s+GUIADA|AUDICION|ALUMN|ENSAYO/;
const ES_CINE = /CICLOS?\\s+DE\\s+CINE|CINE\\s*-?\\s*FORUM|PROYECCION/;
const PRECIO_MINIMO = 12;

function detectarPrecioListado(text) {
  // Devuelve null si desconocido, 0 si gratuito, o el precio del PÚBLICO
  // (el más alto). En Clasijazz los precios vienen "12€ NS / 6€ S": cuenta
  // el de NO socio (público) para el umbral, no el de socio. Fix 2026-06-19.
  const t = String(text || '');
  if (/ENTRADA\\s+LIBRE|GRATUIT[OA]|GRATIS/i.test(t)) return 0;
  const matches = [...t.matchAll(/(\\d+(?:[.,]\\d{1,2})?)\\s*€/g)]
    .map((m) => parseFloat(m[1].replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 1000);
  return matches.length ? Math.max(...matches) : null;
}

function clasificarEspectaculo(tituloNorm, precio) {
  // YA NO se filtra por precio (2026-06-22): conciertos a cualquier precio o
  // gratis entran; lo que no es espectáculo se descarta SOLO por título.
  // (precio se sigue capturando en el payload, solo a título informativo.)
  if (ES_CINE.test(tituloNorm)) return true;
  if (NOT_ESPECTACULO_BASE.test(tituloNorm)) return false;
  return true;
}

function pickCartelUrl($c) {
  const $img = $c.find('img').first();
  if (!$img.length) return '';
  const candidates = [
    $img.attr('data-lazy-src'),
    $img.attr('data-src'),
    $img.attr('src'),
  ].filter(Boolean);
  for (const u of candidates) {
    if (u && !u.startsWith('data:')) return u.trim();
  }
  // fallback noscript
  const ns = $c.find('noscript img').first();
  if (ns.length) {
    const src = ns.attr('src') || '';
    if (src && !src.startsWith('data:')) return src.trim();
  }
  return '';
}

for (const it of items) {
  const html = (it.json && it.json.data && it.json.data.html) || '';
  if (!html) continue;
  const $ = cheerio.load(html);

  $('article.tribe-events-calendar-list__event').each((_, c) => {
    const $c = $(c);
    const $a = $c.find('.tribe-events-calendar-list__event-title-link, h3 a').first();
    const titulo = clean($a.text());
    const href = clean($a.attr('href') || '');
    if (!titulo || !href) return;

    // event_id estable: path post-/evento/ con / -> _
    const path = href.replace(/^https?:\\/\\/[^\\/]+\\/evento\\//, '').replace(/^\\/+|\\/+$/g, '');
    if (!path || path.startsWith('http')) return;
    const event_id = 'clasijazz_' + path.replace(/\\//g, '_');
    if (seen.has(event_id)) return;
    seen.add(event_id);

    const $time = $c.find('time').first();
    const datetime_iso = clean($time.attr('datetime') || '');
    const datetime_text = clean($time.text());

    let fecha_inicio = '';
    let hora_inicio = '';
    if (datetime_iso) {
      const m = datetime_iso.match(/^(\\d{4}-\\d{2}-\\d{2})(?:T(\\d{2}):(\\d{2}))?/);
      if (m) {
        fecha_inicio = m[1];
        if (m[2]) hora_inicio = m[2] + ':' + m[3];
      }
    }
    if (!hora_inicio) {
      const horaTxt = datetime_text.match(/(\\d{1,2}):(\\d{2})/);
      if (horaTxt) hora_inicio = String(parseInt(horaTxt[1], 10)).padStart(2, '0') + ':' + horaTxt[2];
    }

    const desc = clean($c.find('.tribe-events-calendar-list__event-description, .tribe-events-content-description, .tribe-events-calendar-list__event-description-content').first().text());
    const cartel_url = pickCartelUrl($c);

    const titNorm = normalize(titulo);
    const precio_listado = detectarPrecioListado(desc);
    const es_espectaculo = clasificarEspectaculo(titNorm, precio_listado);

    events.push({
      event_id,
      name: titulo,
      datetime_text,
      venue: '',
      event_url: href,
      cartel_url,
      slug: path,
      datetime_iso,
      fecha_inicio_listado: fecha_inicio,
      hora_listado: hora_inicio,
      descripcion_listado: desc,
      precio_listado,
      es_espectaculo,
      es_cine: ES_CINE.test(titNorm),
      estado_listado: es_espectaculo ? 'En cartelera' : 'Otra actividad',
    });
  });
}

return [{ json: { data: { data: { events } } } }];`,
    };

    @node({
        id: 'clasi-wait',
        webhookId: 'clasi-wait-1',
        name: 'Wait',
        type: 'n8n-nodes-base.wait',
        version: 1.1,
        position: [-704, 0],
    })
    Wait = {};

    @node({
        id: 'clasi-split-out',
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
        id: 'clasi-normalizar-titulo',
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
        id: 'clasi-upsert-raw-front',
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
    '{{ ($json["data.data.events"].event_id || "").replace(/'/g, "''") }}',
    '{{ ($json["data.data.events"].name || "").replace(/'/g, "''") }}',
    '{{ ($json["data.data.events"].datetime_text || "").replace(/'/g, "''") }}',
    '{{ ($json["data.data.events"].venue || "").replace(/'/g, "''") }}',
    '{{ ($json["data.data.events"].event_url || "").replace(/'/g, "''") }}',
    'clasijazz',
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
        id: 'clasi-select-front-sin-detalle',
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
WHERE f.source_storefront = 'clasijazz'
  AND f.event_url IS NOT NULL
  AND d.id IS NULL
  AND COALESCE((f.payload_json->>'es_espectaculo')::boolean, true) = true
ORDER BY f.id;`,
        options: {},
    };

    @node({
        id: 'clasi-loop-eventos',
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
        id: 'clasi-scrape-detalle',
        name: 'Scrape Detalle CLASIJAZZ',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [640, 96],
        credentials: { firecrawlApi: { id: '3FsKPT3ZQeVfmMkM', name: 'Firecrawl account' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        waitBetweenTries: 5000,
    })
    ScrapeDetalleClasijazz = {
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
        id: 'clasi-parsear-detalle',
        name: 'Parsear Detalle CLASIJAZZ',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [864, 96],
    })
    ParsearDetalleClasijazz = {
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
const slug = fp.slug || (event_id || '').replace(/^clasijazz_/, '');
const fecha_inicio_listado = fp.fecha_inicio_listado || '';
const hora_listado = fp.hora_listado || '';
const datetime_text_listado = front.datetime_text || fp.datetime_text || '';
const desc_listado = fp.descripcion_listado || '';

function clean(t) { return String(t || '').replace(/\\s+/g, ' ').trim(); }

function parsePrecioDesc(text) {
  // Formatos típicos clasijazz: "3 € NS / 5 € S", "3€ No Soci@ / gratuito Soci@", "Entrada Libre",
  // "10€ NS / 3€ S", "Entrada Libre"
  const t = String(text || '');
  if (/ENTRADA\\s+LIBRE|GRATUIT[OA]|GRATIS/i.test(t)) return { precio_min: 0, precio_max: 0, gratis: true, entradas: [] };
  const matches = [...t.matchAll(/(\\d+(?:[.,]\\d{1,2})?)\\s*€/g)].map((m) => parseFloat(m[1].replace(',', '.'))).filter((n) => Number.isFinite(n));
  const valid = matches.filter((n) => n > 0 && n < 1000);
  if (!valid.length) return { precio_min: 0, precio_max: 0, gratis: false, entradas: [] };
  const precio_min = Math.min(...valid);
  const precio_max = Math.max(...valid);
  return {
    precio_min,
    precio_max,
    gratis: false,
    entradas: valid.map((p) => ({ nombre: '', precio: p, aforo: 0 })),
  };
}

let titulo_detalle = '';
let observacion = desc_listado;
let venue_detalle = '';
let categoria = '';
let bodyText = '';

if (html) {
  try {
    const $$ = cheerio.load(html);
    titulo_detalle = clean($$('h1.tribe-events-single-event-title, h1').first().text());
    venue_detalle = clean($$('.tribe-events-meta-group-venue .tribe-venue, .tribe-events-venue, dd.tribe-venue').first().text());
    categoria = clean($$('.tribe-events-event-categories a, .tribe-events-meta-group-details .tribe-events-event-categories').first().text());
    bodyText = clean($$('.tribe-events-single-event-description, .tribe-events-content, article.tribe-events-event').first().text());
    if (!observacion && bodyText) observacion = bodyText.slice(0, 2000);
  } catch (err) {
    console.log('Parsear Detalle CLASIJAZZ - error:', err.message);
  }
}

const pricingSrc = bodyText || desc_listado;
const pricing = parsePrecioDesc(pricingSrc);

const fecha_inicio = fecha_inicio_listado;
const hora_inicio = hora_listado;
const tipo_fecha = fecha_inicio ? 'simple' : 'texto_no_parseable';

return {
  json: {
    event_id,
    slug,
    titulo: titulo_listado || titulo_detalle,
    titulo_original: titulo_listado || titulo_detalle,
    observacion,
    datetime_text_original: datetime_text_listado || clean(fecha_inicio + ' ' + hora_inicio),
    fecha_inicio,
    fecha_fin: fecha_inicio,
    hora_inicio,
    tipo_fecha,
    num_sesiones_estimadas: fecha_inicio ? 1 : null,
    tiene_multiples_sesiones: false,
    precio_entradas: pricing.precio_min,
    precio_medio_entradas: pricing.precio_min,
    precio_max: pricing.precio_max,
    aforo_total: 0,
    entradas: pricing.entradas,
    local: venue_detalle || 'Clasijazz',
    es_gratuito: !!pricing.gratis,
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
        id: 'clasi-consolidar-detalle',
        name: 'Consolidar Detalle',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1088, 96],
    })
    ConsolidarDetalle = {
        mode: 'runOnceForEachItem',
        jsCode: `const j = $json || {};
const front_payload = ($('Loop eventos').item.json.payload_json) || {};
const es_cine = !!front_payload.es_cine;
const PRECIO_MINIMO = 12;
const entradas = Array.isArray(j.entradas) ? j.entradas : [];
// Precio del PÚBLICO (no socio) para el umbral de 12€: en Clasijazz
// '12€ NS / 6€ S' debe contar como 12€. Fix 2026-06-19.
const precio = (j.precio_max ?? j.precio_entradas) || 0;

// Aplica filtro post-detalle:
//   - cine: aceptamos si precio>0 (cualquier importe)
//   - resto: aceptamos si precio>=12
// Lo no aceptado se marcará en raw_front (es_espectaculo=false) y NO entrará en raw_detalle.
// Clasijazz: cine siempre acepta. Resto: filtro precio>=12€.
let aceptar;
if (es_cine) aceptar = true;
else aceptar = precio >= PRECIO_MINIMO;

const payload = {
  fuente: 'clasijazz',
  ticketera: j.ticketera_url ? {
    proveedor: 'clasijazz',
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
        id: 'clasi-if-aceptar',
        name: 'Aceptar espectaculo',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1248, 96],
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
        id: 'clasi-marcar-no-espectaculo',
        name: 'Marcar No Espectaculo en Front',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1408, 256],
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
  AND source_storefront = 'clasijazz';`,
        options: {
            queryBatching: 'independently',
        },
    };

    @node({
        id: 'clasi-upsert-raw-detalle',
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
    '{{ ($json.event_id || "").replace(/'/g, "''") }}',
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
        id: 'clasi-leer-adjuntos-pendientes',
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
    WHERE f.source_storefront = 'clasijazz'
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
        id: 'clasi-loop-adjuntos',
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
        id: 'clasi-filtrar-adjuntos',
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
        id: 'clasi-preparar-adjunto',
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
const promotor = normalizeSegment($json.promotor, 'clasijazz');
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
        id: 'clasi-descargar-adjunto',
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
        id: 'clasi-guardar-dropbox',
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
        id: 'clasi-registrar-adjunto',
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
        id: 'clasi-marcar-descargados',
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
        this.ScrapeListado.out(0).to(this.ParsearListadoClasijazz.in(0));
        this.ParsearListadoClasijazz.out(0).to(this.Wait.in(0));
        this.Wait.out(0).to(this.SplitOut.in(0));
        this.SplitOut.out(0).to(this.NormalizarTitulo.in(0));
        this.NormalizarTitulo.out(0).to(this.UpsertRawFrontEventos.in(0));
        this.UpsertRawFrontEventos.out(0).to(this.SelectFrontSinDetalle.in(0));
        this.SelectFrontSinDetalle.out(0).to(this.LoopEventos.in(0));
        this.LoopEventos.out(0).to(this.LeerAdjuntosPendientes.in(0));
        this.LoopEventos.out(1).to(this.ScrapeDetalleClasijazz.in(0));
        this.ScrapeDetalleClasijazz.out(0).to(this.ParsearDetalleClasijazz.in(0));
        this.ParsearDetalleClasijazz.out(0).to(this.ConsolidarDetalle.in(0));
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
