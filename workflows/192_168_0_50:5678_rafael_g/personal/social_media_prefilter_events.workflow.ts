import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : 37 SOCIAL MEDIA PREFILTER EVENTS
// Nodes   : 7  |  Connections: 6
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ManualTrigger                      manualTrigger
// ScheduleTrigger                    scheduleTrigger
// ReadDicEtiquetas                   googleSheets               [creds]
// PackDic                            code
// GetPostsToPrefilter                postgres                   [creds]
// ClassifyTextSemaphore              code
// UpsertPrefilterAnalysis            postgres                   [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ManualTrigger
//    → ReadDicEtiquetas
//      → PackDic
//        → GetPostsToPrefilter
//          → ClassifyTextSemaphore
//            → UpsertPrefilterAnalysis
// ScheduleTrigger
//    → ReadDicEtiquetas (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'hrBiwMUcKeb3PcBk',
    name: '37 SOCIAL MEDIA PREFILTER EVENTS',
    active: false,
    settings: {
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
        timezone: 'Europe/Madrid',
        binaryMode: 'separate',
    },
})
export class _37SocialMediaPrefilterEventsWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'prefilter-manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-1280, -200],
    })
    ManualTrigger = {};

    @node({
        id: 'prefilter-schedule-trigger',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.3,
        position: [-1280, 0],
    })
    ScheduleTrigger = {
        rule: {
            interval: [
                {
                    field: 'minutes',
                    minutesInterval: 10,
                },
            ],
        },
    };

    @node({
        id: 'prefilter-read-dic',
        name: 'Read Dic Etiquetas',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [-1056, -100],
        credentials: { googleSheetsOAuth2Api: { id: 'dvmGtqHi4eph1ywU', name: 'Google Sheets account' } },
    })
    ReadDicEtiquetas = {
        documentId: {
            __rl: true,
            value: '1MmFKDvSUkyyOl9XEI_sYPrPaAsbdVhS8lGzZkcjsaFc',
            mode: 'list',
            cachedResultName: 'FACEBOOK POST',
            cachedResultUrl:
                'https://docs.google.com/spreadsheets/d/1MmFKDvSUkyyOl9XEI_sYPrPaAsbdVhS8lGzZkcjsaFc/edit?usp=drivesdk',
        },
        sheetName: {
            __rl: true,
            value: 1136108644,
            mode: 'list',
            cachedResultName: 'DIC_ETIQUETAS ',
            cachedResultUrl:
                'https://docs.google.com/spreadsheets/d/1MmFKDvSUkyyOl9XEI_sYPrPaAsbdVhS8lGzZkcjsaFc/edit#gid=1136108644',
        },
        options: {
            returnFirstMatch: false,
        },
    };

    @node({
        id: 'prefilter-pack-dic',
        name: 'Pack Dic',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-832, -100],
    })
    PackDic = {
        jsCode: `// Build normalized event/exclusion synonym indices from DIC_ETIQUETAS rows
function normalize(s) {
  return String(s || '')
    .toUpperCase()
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^A-Z0-9\\s]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

const rows = $input.all().map(i => i.json).filter(r => r && Object.keys(r).length > 0);

const eventSyns = [];
const exclusionSyns = [];

for (const row of rows) {
  const etiqueta = String(row.ETIQUETA || row.Etiqueta || row.etiqueta || '').trim();
  const tipoRaw = String(row.TIPO_EVENTO || row.Tipo_Evento || row.tipo_evento || '').trim();
  const sinRaw = String(row.SINONIMOS || row.Sinonimos || row.sinonimos || '').trim();
  const activa = String(row.ACTIVA || row.Activa || row.activa || 'YES').trim().toUpperCase();
  const prio = Number(row.PRIORIDAD || row.Prioridad || row.prioridad) || 9999;

  if (!etiqueta || !sinRaw || activa !== 'YES') continue;

  const tipoNorm = normalize(tipoRaw);
  const isExclusion = tipoNorm === 'SIN DERECHOS' || tipoNorm.includes('SIN DERECH');

  const synonyms = sinRaw.split(';').map(s => normalize(s)).filter(Boolean);

  for (const syn of synonyms) {
    const entry = { etiqueta, synonym_normalized: syn, priority: prio };
    if (isExclusion) exclusionSyns.push(entry);
    else eventSyns.push(entry);
  }
}

return [{
  json: {
    eventSyns,
    exclusionSyns,
    __DIC_COUNT: rows.length,
    __EVENT_COUNT: eventSyns.length,
    __EXCLUSION_COUNT: exclusionSyns.length,
  },
}];`,
    };

    @node({
        id: 'prefilter-get-posts',
        name: 'Get Posts To Prefilter',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-608, -100],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    GetPostsToPrefilter = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `SELECT
  id AS post_id,
  COALESCE(text_post_clean, '') AS text_post_clean,
  COALESCE(text_post_raw, '') AS text_post_raw,
  COALESCE(text_base, '') AS text_base,
  COALESCE(bd_post_external_title, '') AS bd_post_external_title,
  COALESCE(bd_link_description_text, '') AS bd_link_description_text
FROM social_posts
WHERE analysis_status = 'PEND_ANALISIS'
  AND media_status IN ('MEDIA_DONE', 'MEDIA_PARTIAL', 'MEDIA_ERROR')
ORDER BY id
LIMIT 200;`,
        options: {},
    };

    @node({
        id: 'prefilter-classify-semaphore',
        name: 'Classify Text Semaphore',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-384, -100],
    })
    ClassifyTextSemaphore = {
        jsCode: `// Semaphore pre-filter: decide BEFORE OCR if a post is clearly NOT a cultural event.
//   RED   → no-event keyword matches AND no event keyword → DESCARTADO_NO_EVENTO (skip OCR)
//   GREEN → event keyword matches AND no exclusion         → PEND_ANALISIS (priority OCR)
//   AMBER → everything else (short text, both, none)       → PEND_ANALISIS (normal OCR)

function normalize(s) {
  return String(s || '')
    .toUpperCase()
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^A-Z0-9\\s]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function findMatches(text, syns) {
  const hay = ' ' + text + ' ';
  const hits = [];
  for (const s of syns) {
    const needle = ' ' + s.synonym_normalized + ' ';
    if (hay.includes(needle)) hits.push(s.etiqueta);
  }
  return Array.from(new Set(hits));
}

// Ambiguous terms — must NEVER push to RED alone, always keep as AMBER
const AMBIGUOUS_TOKENS = ['FERIA', 'FIESTAS', 'VELADA', 'NOCHE', 'EVENTO', 'JORNADA', 'ENCUENTRO'];

const packed = $('Pack Dic').first().json;
const eventSyns = packed.eventSyns || [];
const exclusionSyns = packed.exclusionSyns || [];

const post = $json;
const text = normalize([
  post.text_post_clean,
  post.bd_link_description_text,
  post.bd_post_external_title,
  post.text_post_raw,
  post.text_base,
].filter(Boolean).join(' '));

const evtMatches = findMatches(text, eventSyns);
const exclMatches = findMatches(text, exclusionSyns);

const hay = ' ' + text + ' ';
const ambiguousHits = AMBIGUOUS_TOKENS.filter(w => hay.includes(' ' + w + ' '));

let prefilter_status;
let analysis_status;
let event_detection_status;
let reason;

if (exclMatches.length && !evtMatches.length) {
  if (ambiguousHits.length || text.length < 20) {
    prefilter_status = 'AMBER';
    analysis_status = 'PEND_ANALISIS';
    event_detection_status = 'AMBIGUOUS';
    reason = 'Exclusion (' + exclMatches.join(',') + ') but ambiguous/short — keep for OCR';
  } else {
    prefilter_status = 'RED';
    analysis_status = 'DESCARTADO_NO_EVENTO';
    event_detection_status = 'NO_EVENTO';
    reason = 'Exclusion match: ' + exclMatches.join(',');
  }
} else if (evtMatches.length && !exclMatches.length) {
  prefilter_status = 'GREEN';
  analysis_status = 'PEND_ANALISIS';
  event_detection_status = 'PREF_EVENT';
  reason = 'Event match: ' + evtMatches.join(',');
} else if (evtMatches.length && exclMatches.length) {
  prefilter_status = 'AMBER';
  analysis_status = 'PEND_ANALISIS';
  event_detection_status = 'AMBIGUOUS';
  reason = 'Both event (' + evtMatches.join(',') + ') and exclusion (' + exclMatches.join(',') + ')';
} else {
  prefilter_status = 'AMBER';
  analysis_status = 'PEND_ANALISIS';
  event_detection_status = 'AMBIGUOUS';
  reason = text.length === 0 ? 'No text — let OCR decide' : 'No keyword match — let OCR decide';
}

return {
  json: {
    post_id: post.post_id,
    prefilter_status,
    analysis_status,
    event_detection_status,
    reason: String(reason).slice(0, 500),
    matched_event_labels: evtMatches,
    matched_exclusion_labels: exclMatches,
    ambiguous_hits: ambiguousHits,
    text_length: text.length,
    combined_signals_json: {
      prefilter_status,
      event_labels: evtMatches,
      exclusion_labels: exclMatches,
      ambiguous_hits: ambiguousHits,
      text_length: text.length,
    },
    matched_labels_json: { event: evtMatches, exclusion: exclMatches },
  },
};`,
    };

    @node({
        id: 'prefilter-upsert-analysis',
        name: 'Upsert Prefilter Analysis',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-160, -100],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    UpsertPrefilterAnalysis = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'post_analysis',
        },
        query: `WITH upd AS (
  UPDATE social_posts
  SET analysis_status = $2::text, updated_at = NOW()
  WHERE id = $1::bigint AND analysis_status = 'PEND_ANALISIS'
  RETURNING id
)
INSERT INTO post_analysis (
  social_post_id, analysis_version, analysis_status,
  event_detection_status, event_detection_reason,
  combined_signals_json, matched_labels_json,
  source_detection, processed_at
)
VALUES (
  $1::bigint, 'prefilter-v2', 'DONE',
  $3::text, $4::text,
  $5::jsonb, $6::jsonb,
  'prefilter-text-v2', NOW()
)
ON CONFLICT (social_post_id, analysis_version) DO UPDATE SET
  event_detection_status = EXCLUDED.event_detection_status,
  event_detection_reason = EXCLUDED.event_detection_reason,
  combined_signals_json  = EXCLUDED.combined_signals_json,
  matched_labels_json    = EXCLUDED.matched_labels_json,
  processed_at           = NOW(),
  updated_at             = NOW()
RETURNING social_post_id, event_detection_status;`,
        options: {
            queryReplacement:
                '={{ [$json.post_id, $json.analysis_status, $json.event_detection_status, $json.reason, JSON.stringify($json.combined_signals_json), JSON.stringify($json.matched_labels_json)] }}',
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ManualTrigger.out(0).to(this.ReadDicEtiquetas.in(0));
        this.ScheduleTrigger.out(0).to(this.ReadDicEtiquetas.in(0));
        this.ReadDicEtiquetas.out(0).to(this.PackDic.in(0));
        this.PackDic.out(0).to(this.GetPostsToPrefilter.in(0));
        this.GetPostsToPrefilter.out(0).to(this.ClassifyTextSemaphore.in(0));
        this.ClassifyTextSemaphore.out(0).to(this.UpsertPrefilterAnalysis.in(0));
    }
}
