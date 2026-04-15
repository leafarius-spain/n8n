import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : 37 SOCIAL MEDIA PREFILTER EVENTS
// Nodes   : 6  |  Connections: 5
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ManualTrigger                      manualTrigger
// ScheduleTrigger                    scheduleTrigger
// GetPostsToPrefilter                postgres                   [creds]
// ClassifyTextOnly                   code
// FilterDiscarded                    if
// UpdateDiscarded                    postgres                   [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ManualTrigger
//    → GetPostsToPrefilter
//      → ClassifyTextOnly
//        → FilterDiscarded
//          → UpdateDiscarded
// ScheduleTrigger
//    → GetPostsToPrefilter (↩ loop)
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
        id: 'prefilter-get-posts',
        name: 'Get Posts To Prefilter',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-1056, -100],
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
        id: 'prefilter-classify',
        name: 'Classify Text Only',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-832, -100],
    })
    ClassifyTextOnly = {
        jsCode: `// Keyword-based pre-filter: decide BEFORE OCR if a post is clearly NOT a cultural event.
// Rule: if NEGATIVE terms match AND NO POSITIVE term matches → DESCARTADO_NO_EVENTO.
// Otherwise (positive match, both, or none) → keep as PEND_ANALISIS (goes to OCR).

const POSITIVE = [
  { tag: 'CONCIERTO',   syn: ['concierto','conciertos','en concierto','musica','musical','actuacion musical'] },
  { tag: 'ORQUESTA',    syn: ['orquesta','orquestas','banda sinfonica','banda municipal'] },
  { tag: 'PASACALLES',  syn: ['pasacalles','pasacalle','charanga','charangas','batucada'] },
  { tag: 'FESTIVAL',    syn: ['festival','festivales','festividad'] },
  { tag: 'TEATRO',      syn: ['teatro','danza','ballet','comedia','obra de teatro','monologo','representacion'] },
  { tag: 'ACTUACION',   syn: ['actuacion','actuaciones'] },
  { tag: 'SINFONICA',   syn: ['sinfonica','sinfonico','recital'] },
  { tag: 'DUO',         syn: ['duo','dúo','trio','cuarteto'] },
  { tag: 'DJ',          syn: ['dj','sesion dj','musica con dj'] },
  { tag: 'PARTY',       syn: ['fiesta','fiestas','celebracion','verbena','verbenas'] },
  { tag: 'MAGIA',       syn: ['magia','mago','maga','ilusionismo','prestidigitacion'] },
  { tag: 'BANDA',       syn: ['banda','bandas','agrupacion'] },
  { tag: 'CINE',        syn: ['cine','pelicula','film','cineforum'] },
  { tag: 'CABALGATA',   syn: ['cabalgata','cabalgatas'] },
  { tag: 'REYES',       syn: ['reyes magos','rey mago','sus majestades los reyes'] },
  { tag: 'CORO',        syn: ['coro','coros','coral','corales'] },
  { tag: 'GOSPEL',      syn: ['gospel','góspel','musica gospel'] },
  { tag: 'CARNAVAL',    syn: ['carnaval','carnavales'] },
  { tag: 'HUMOR',       syn: ['humor','humorista','comedian','stand up'] },
  { tag: 'FLAMENCO',    syn: ['flamenco','cante jondo','zambomba','copla'] },
  { tag: 'ROCK',        syn: ['rock','pop','indie','reggaeton','trap','hip hop','rap'] },
  { tag: 'FERIA',       syn: ['feria','ferial','feriantes'] },
  { tag: 'ROMERIA',     syn: ['romeria','romerias','procesion'] },
  { tag: 'BAILE',       syn: ['baile','bailes','bailar','sevillanas','rumba'] },
];

const NEGATIVE = [
  { tag: 'TALLER',      syn: ['taller','talleres','workshop'] },
  { tag: 'EXCURSION',   syn: ['excursion','excursiones','viaje organizado','ruta senderista','senderismo'] },
  { tag: 'CURSO',       syn: ['curso','cursos','formacion','seminario','clases de','academia'] },
  { tag: 'BANDO',       syn: ['bando','bandos','aviso','comunicado','notificacion','pleno','ordenanza','convocatoria publica','edicto'] },
  { tag: 'SERVICIO',    syn: ['reciclaje','reciclar','contenedor','contenedores','impuesto','impuestos','tasa municipal','obras','empleo','vacunacion','vacuna','horario de atencion','oficina de atencion','servicios sociales','ayuda domicilio','dependencia','recogida de'] },
  { tag: 'SALUD',       syn: ['campaña de salud','vacunacion','revision medica','donacion de sangre'] },
  { tag: 'TRAFICO',     syn: ['corte de trafico','corte de calle','desvio'] },
  { tag: 'DEPORTE',     syn: ['entrenamiento','federacion','inscripcion deportiva','liga municipal','club deportivo','torneo de padel','torneo de tenis','escuela deportiva'] },
];

function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\\s]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function findMatches(text, dict) {
  const matches = [];
  for (const entry of dict) {
    for (const syn of entry.syn) {
      const n = normalize(syn);
      if (!n) continue;
      const re = new RegExp('\\\\b' + n.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&') + '\\\\b');
      if (re.test(text)) {
        matches.push({ tag: entry.tag, synonym: syn });
        break; // one synonym per tag is enough
      }
    }
  }
  return matches;
}

const results = [];
for (const item of $input.all()) {
  const j = item.json;
  const combined = [
    j.text_post_clean,
    j.text_post_raw,
    j.text_base,
    j.bd_post_external_title,
    j.bd_link_description_text,
  ].filter(Boolean).join(' ');
  const norm = normalize(combined);

  const posMatches = findMatches(norm, POSITIVE);
  const negMatches = findMatches(norm, NEGATIVE);

  let decision;
  let reason;
  if (negMatches.length > 0 && posMatches.length === 0) {
    decision = 'DESCARTADO_NO_EVENTO';
    reason = 'Neg: ' + negMatches.map(m => m.tag).join(',');
  } else if (posMatches.length > 0) {
    decision = 'KEEP_EVENT';
    reason = 'Pos: ' + posMatches.map(m => m.tag).join(',');
  } else {
    decision = 'KEEP_AMBIGUOUS';
    reason = norm.length === 0 ? 'No text — let OCR decide' : 'No keyword match — let OCR decide';
  }

  results.push({
    json: {
      post_id: j.post_id,
      decision,
      reason,
      matched_positive: posMatches,
      matched_negative: negMatches,
      matched_labels_json: { positive: posMatches, negative: negMatches },
      text_length: norm.length,
    },
  });
}

return results;`,
    };

    @node({
        id: 'prefilter-filter-discarded',
        name: 'Filter Discarded',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [-608, -100],
    })
    FilterDiscarded = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 2,
            },
            conditions: [
                {
                    id: '1',
                    leftValue: '={{ $json.decision }}',
                    rightValue: 'DESCARTADO_NO_EVENTO',
                    operator: {
                        type: 'string',
                        operation: 'equals',
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: 'prefilter-update-discarded',
        name: 'Update Discarded',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-384, -100],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    UpdateDiscarded = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `WITH upd AS (
  UPDATE social_posts
  SET analysis_status = 'DESCARTADO_NO_EVENTO', updated_at = NOW()
  WHERE id = $1::bigint AND analysis_status = 'PEND_ANALISIS'
  RETURNING id
)
INSERT INTO post_analysis (
  social_post_id, analysis_version, analysis_status,
  event_detection_status, event_detection_reason,
  matched_labels_json, source_detection, processed_at
)
SELECT upd.id, 'prefilter-v1', 'DONE',
       'NO_EVENT', $2::text,
       $3::jsonb, 'prefilter-text', NOW()
FROM upd
ON CONFLICT (social_post_id, analysis_version) DO UPDATE SET
  event_detection_status = EXCLUDED.event_detection_status,
  event_detection_reason = EXCLUDED.event_detection_reason,
  matched_labels_json = EXCLUDED.matched_labels_json,
  processed_at = EXCLUDED.processed_at,
  updated_at = NOW()
RETURNING social_post_id, event_detection_status;`,
        options: {
            queryReplacement: '={{ [$json.post_id, $json.reason, JSON.stringify($json.matched_labels_json)] }}',
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ManualTrigger.out(0).to(this.GetPostsToPrefilter.in(0));
        this.ScheduleTrigger.out(0).to(this.GetPostsToPrefilter.in(0));
        this.GetPostsToPrefilter.out(0).to(this.ClassifyTextOnly.in(0));
        this.ClassifyTextOnly.out(0).to(this.FilterDiscarded.in(0));
        this.FilterDiscarded.out(0).to(this.UpdateDiscarded.in(0));
    }
}
