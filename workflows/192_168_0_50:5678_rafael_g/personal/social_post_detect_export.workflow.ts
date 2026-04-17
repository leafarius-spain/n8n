import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : 50 SOCIAL MEDIA DETECT EXPORT
// Nodes   : 15  |  Connections: 14
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// TestWebhook                        webhook
// ManualTrigger                      manualTrigger
// ScheduleTrigger                    scheduleTrigger
// ReadDicEtiquetas                   postgres                   [creds]
// PackDic                            code
// GetAndLockPosts                    postgres                   [creds]
// ClassifyAndDetect                  code
// SavePostAnalysis                   postgres                   [creds]
// SaveCandidateEvents                postgres                   [creds]
// MarkPostsDone                      postgres                   [creds]
// GetMediaForMove                    postgres                   [creds]
// BuildMediaMovePaths                code
// MoveMediaToFinalFolder             executeCommand             [onError→out(1)]
// UpdateMovedMediaPath               postgres                   [creds]
// LogMediaMoveError                  postgres                   [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// TestWebhook
//    → ReadDicEtiquetas
//      → PackDic
//        → GetAndLockPosts
//          → ClassifyAndDetect
//            → SavePostAnalysis
//              → SaveCandidateEvents
//                → MarkPostsDone
//                  → GetMediaForMove
//                    → BuildMediaMovePaths
//                      → MoveMediaToFinalFolder
//                        → UpdateMovedMediaPath
//                       .out(1) → LogMediaMoveError
// ManualTrigger
//    → ReadDicEtiquetas (↩ loop)
// ScheduleTrigger
//    → ReadDicEtiquetas (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'B9X1iY7jFdGCAcK9',
    name: '50 SOCIAL MEDIA DETECT EXPORT',
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
export class _50SocialMediaDetectExportWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'detect-test-webhook',
        webhookId: 'b3c58a2e-7d91-4f05-9e34-1a0b2c3d4e5f',
        name: 'Test Webhook',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1280, -96],
    })
    TestWebhook = {
        path: 'social-detect-export-test',
        options: {},
    };

    @node({
        id: 'detect-manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-1280, -480],
    })
    ManualTrigger = {};

    @node({
        id: 'detect-schedule-trigger',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.3,
        position: [-1280, -288],
    })
    ScheduleTrigger = {
        rule: {
            interval: [
                {
                    field: 'minutes',
                    minutesInterval: 15,
                },
            ],
        },
    };

    @node({
        id: 'detect-read-dic',
        name: 'Read DIC Etiquetas',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-1056, -288],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    ReadDicEtiquetas = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'dic_etiquetas',
        },
        query: `SELECT
  etiqueta                                          AS "ETIQUETA",
  sinonimos                                         AS "SINONIMOS",
  tipo_evento                                       AS "TIPO_EVENTO",
  prioridad                                         AS "PRIORIDAD",
  CASE WHEN activa         THEN 'YES' ELSE 'NO' END AS "ACTIVA",
  CASE WHEN require_imagen THEN 'YES' ELSE 'NO' END AS "REQUIRE_IMAGEN"
FROM dic_etiquetas
WHERE activa = true
ORDER BY prioridad ASC, etiqueta ASC;`,
        options: {},
    };

    @node({
        id: 'detect-pack-dic',
        name: 'Pack DIC',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-832, -288],
    })
    PackDic = {
        jsCode: `// Collapse N DIC_ETIQUETAS rows into 1 item for downstream reference
const rows = $input.all().map(i => i.json).filter(r => r && Object.keys(r).length > 0);
return [{ json: { __DIC_ETIQUETAS: rows, __DIC_COUNT: rows.length } }];`,
    };

    @node({
        id: 'detect-get-lock-posts',
        name: 'Get And Lock Posts',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-608, -288],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    GetAndLockPosts = {
        schema: 'public',
        table: 'social_posts',
        operation: 'executeQuery',
        query: `UPDATE social_posts SET analysis_status = 'DETECT_PROCESSING', updated_at = NOW()
WHERE id IN (
  SELECT id FROM social_posts
  WHERE (analysis_status = 'OCR_DONE')
     OR (analysis_status = 'PEND_ANALISIS' AND media_count_total = 0 AND has_text = true)
  ORDER BY CASE processing_priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END ASC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 20
)
RETURNING
  id AS social_post_id,
  idempot_key,
  text_post_clean,
  text_base,
  has_text,
  text_length,
  is_reel,
  is_video_post,
  media_has_photo,
  media_has_video,
  media_count_total,
  (SELECT code FROM sources WHERE id = source_id) AS source_code,
  (SELECT account_name FROM publisher_accounts WHERE id = publisher_account_id) AS account_name,
  COALESCE((SELECT ayto_id FROM publisher_accounts WHERE id = publisher_account_id), '') AS ayto_id,
  COALESCE(post_url, '') AS post_url,
  COALESCE(bd_post_external_title, '') AS bd_post_external_title,
  COALESCE(bd_link_description_text, '') AS bd_link_description_text,
  TO_CHAR(published_at, 'YYYY-MM-DD') AS published_at_fmt,
  COALESCE((
    SELECT string_agg(mo.ocr_text_raw, ' | ' ORDER BY pm.media_index)
    FROM post_media pm
    JOIN media_ocr mo ON mo.post_media_id = pm.id
    WHERE pm.social_post_id = social_posts.id
      AND pm.relevance_status = 'IMG_CON_TEXTO'
      AND mo.has_meaningful_text = true
  ), '') AS ocr_combined_text,
  COALESCE((
    SELECT COUNT(*)
    FROM post_media pm
    WHERE pm.social_post_id = social_posts.id AND pm.relevance_status = 'IMG_CON_TEXTO'
  ), 0)::integer AS img_con_texto_count,
  COALESCE((
    SELECT MAX(mo.ocr_confidence)
    FROM post_media pm
    JOIN media_ocr mo ON mo.post_media_id = pm.id
    WHERE pm.social_post_id = social_posts.id
  ), 0)::numeric AS max_ocr_confidence;`,
        options: {},
    };

    @node({
        id: 'detect-classify',
        name: 'Classify And Detect',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-384, -288],
    })
    ClassifyAndDetect = {
        jsCode: `// ──────────────────────────────────────────────────────────────────
// CLASSIFY AND DETECT — Phase 5 heuristic v1
// Based on legacy "Code: Clasificar por Nombre/Texto" logic
// Rules: see workflow documentation
// ──────────────────────────────────────────────────────────────────

function stripAccentsKeepEnye(s) {
  return String(s || '')
    .replace(/[ÁÀÄÂ]/g, 'A').replace(/[ÉÈËÊ]/g, 'E')
    .replace(/[ÍÌÏÎ]/g, 'I').replace(/[ÓÒÖÔ]/g, 'O')
    .replace(/[ÚÙÜÛ]/g, 'U').replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u');
}

function norm(s) {
  if (!s) return '';
  return stripAccentsKeepEnye(String(s).trim())
    .toUpperCase()
    .replace(/[\\r\\n\\t]+/g, ' ')
    .replace(/\\s{2,}/g, ' ')
    .trim();
}

function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^{}$()|[\\]\\\\]/g, '\\\\$&');
}

function containsWordOrPhrase(haystack, needle) {
  if (!needle || !haystack) return false;
  const n = needle.trim();
  if (!n) return false;
  if (/\\s/.test(n)) return haystack.includes(n);
  const re = new RegExp('(^|[^A-Z0-9Ñ])' + escapeRegExp(n) + '($|[^A-Z0-9Ñ])', 'i');
  return re.test(haystack);
}

// ────────── Extractor de NOMBRE HUMANO (P1: acto principal, P2: evento cultural) ──────────
const P1_NAME_PATTERNS = [
  /\\b(actuaci[oó]n(?:es)?\\s+(?:de|del|de la|de los|de las)\\s+[^.,;!?\\n]{3,100}?)(?=[.,;!?\\n]|\\s+(?:en|con|para|y|donde|a las)\\s)/i,
  /\\b(concierto\\s+(?:de|del|de la)?\\s*[^.,;!?\\n]{3,100}?)(?=[.,;!?\\n]|\\s+(?:en|con|para|y|donde|a las)\\s)/i,
  /\\b(obra\\s+(?:de\\s+teatro\\s+)?["«']?[^.,;!?\\n"»']{3,100}?["»']?)(?=[.,;!?\\n]|\\s+(?:en|con|para|y|donde)\\s)/i,
  /\\b(festival\\s+[^.,;!?\\n]{3,100}?)(?=[.,;!?\\n]|\\s+(?:en|con|para|y|donde|a las)\\s)/i,
  /\\b(gala\\s+(?:de|del|de la|benefica|flamenca)?\\s*[^.,;!?\\n]{2,100}?)(?=[.,;!?\\n]|\\s+(?:en|con|para|y|donde|a las)\\s)/i,
  /\\b(cine\\s+de\\s+verano)\\b/i,
  /\\b(recital\\s+(?:de|del|de la)?\\s*[^.,;!?\\n]{2,100}?)(?=[.,;!?\\n]|\\s+(?:en|con|para|y)\\s)/i,
  /\\b(mon[oó]logo\\s+(?:de|del)?\\s*[^.,;!?\\n]{2,100}?)(?=[.,;!?\\n]|\\s+(?:en|con|para|y)\\s)/i,
];
const P2_NAME_PATTERNS = [
  /\\b(d[íi]a\\s+(?:de|del)\\s+[^.,;!?\\n]{2,60}?(?:\\s+\\d{4})?)(?=[.,;!?\\n]|\\s+(?:en|con|para|y|como|donde)\\s)/i,
  /\\b(fiestas?\\s+(?:patronales?|mayores|de|del|de la|en honor)[^.,;!?\\n]{0,60}?)(?=[.,;!?\\n]|\\s+(?:en|con|para|y|donde|a las)\\s)/i,
  /\\b(semana\\s+(?:cultural|santa|de)\\s+[^.,;!?\\n]{2,60}?)(?=[.,;!?\\n]|\\s+(?:en|con|para|y|donde)\\s)/i,
  /\\b(premios\\s+[^.,;!?\\n]{2,60}?(?:\\s+\\d{4})?)(?=[.,;!?\\n]|\\s+(?:en|con|para|y|donde)\\s)/i,
  /\\b(feria\\s+(?:de|del|de la|medieval|del libro)[^.,;!?\\n]{2,60}?)(?=[.,;!?\\n]|\\s+(?:en|con|para|y|donde)\\s)/i,
  /\\b(carnaval(?:es)?\\s+(?:de|del)?[^.,;!?\\n]{0,60}?)(?=[.,;!?\\n]|\\s+(?:en|con|para|y)\\s)/i,
  /\\b(romer[íi]a(?:s)?\\s+(?:de|del|de la)?[^.,;!?\\n]{0,60}?)(?=[.,;!?\\n]|\\s+(?:en|con|para|y)\\s)/i,
  /\\b(cabalgata\\s+(?:de|del|de los)?[^.,;!?\\n]{2,60}?)(?=[.,;!?\\n]|\\s+(?:en|con|para|y)\\s)/i,
];

function cleanupName(s) {
  if (!s) return '';
  let out = String(s).trim();
  out = out.replace(/\\s+(?:de|del|de la|de los|de las|y|e|o|u|con|en|para)$/i, '').trim();
  out = out.replace(/^[¡!\\s]+/, '')
           .replace(/^(el próximo|la próxima|este|esta|hoy|ayer|mañana)\\s+\\S+[,:]?\\s+/i, '')
           .trim();
  if (out.length > 120) {
    const cut = out.slice(0, 120);
    const lastSpace = cut.lastIndexOf(' ');
    out = lastSpace > 40 ? cut.slice(0, lastSpace) : cut;
  }
  return out;
}

const NAME_BLOCKERS = /^(?:obra\\s+(?:de\\s+la\\s+plaza|del\\s+colegio|de\\s+instalaci[oó]n|p[uú]blica|de\\s+restauraci[oó]n|se\\s+realizar[aá]|del\\s+pfea)|actuaci[oó]n\\s+(?:de\\s+este\\s+plan|municipal|en\\s+la\\s+restauraci[oó]n|de\\s+este|polic[ií]al|administrativa)|plan\\s+(?:municipal|de\\s+control|sanitario|de\\s+emergencia))/i;

function extractHumanName(textClean, ocrText, externalTitle, tagFallback) {
  const sources = [textClean, ocrText].filter(Boolean).join(' \\n ');
  for (const re of P1_NAME_PATTERNS) {
    const m = sources.match(re);
    if (m) {
      const clean = cleanupName(m[1]);
      if (clean.length >= 5 && !NAME_BLOCKERS.test(clean)) return clean;
    }
  }
  for (const re of P2_NAME_PATTERNS) {
    const m = sources.match(re);
    if (m) {
      const clean = cleanupName(m[1]);
      if (clean.length >= 5 && !NAME_BLOCKERS.test(clean)) return clean;
    }
  }
  const t = String(externalTitle || '').trim();
  if (t.length >= 4 && t.length <= 120) return t;
  if (textClean) {
    const first = String(textClean).trim().split(/[.\\n]|[!¡]{2,}/)[0];
    const cleaned = cleanupName(first);
    if (cleaned.length >= 10) return cleaned.slice(0, 120);
    return String(textClean).trim().slice(0, 80);
  }
  return tagFallback || 'EVENTO';
}

// ────────── Extractor de LOCATION ──────────
const VENUE_ANCHORS = [
  'teatro','plaza','auditorio','pabellon','pabellón','castillo','biblioteca',
  'ermita','iglesia','parroquia','recinto','parque','jardines','jardin','jardín',
  'cine','polideportivo','estadio','sala','museo','convento','monasterio',
  'alcazaba','anfiteatro','explanada','paseo','mercado','casino','ateneo',
  'centro cultural','casa de la cultura','casa cultural','salon de actos',
  'salón de actos','complejo deportivo','complejo polideportivo','recinto ferial',
];
const GENERIC_STANDALONE = new Set([
  'plaza','teatro','cine','sala','club','parque','recinto','centro','casa','salon','salón','castillo'
]);
const LOCATION_STOP_RE = /^(?:y|e|o|u|con|en|para|donde|cuando|como|pero|mientras|desde|hasta|durante|sobre|bajo|entre|cerca|que|quien|quienes|hoy|mañana|ayer|esta|este|lunes|martes|mi[ée]rcoles|jueves|viernes|s[aá]bado|domingo|a|acontinuaci[oó]n|organizada?|organizado|preparados|habian|se|nos|todos|todas|os|esperamos|invitados?|llen[oó]|llena|fuegos|degustaci[oó]n|recibiremos|inmortalizado|compartimos|han|ha|informa|invitan)$/i;
const VENUE_BLACKLIST = [
  /\\bhinchable\\b/i,
  /\\bde\\s+fuegos\\s+artificiales\\b/i,
  /^cine\\s+de\\s+verano$/i,
  /^plaza\\s+(degustaci[oó]n|fiesta|se)/i,
  /^ermita\\s+(todos|acontinuaci[oó]n)/i,
  /^iglesia\\s+(recibiremos|nos|ha)/i,
  /^biblioteca\\s+(ha|nos)/i,
  /^mercado\\s+laboral/i,
  /^parroquia\\s+(nos|informa)/i,
];
const TIME_TOKEN_RE = /^\\d{1,2}[:.hH]\\d{0,2}h?$/;

function extractLocation(text) {
  if (!text) return null;
  const normalized = String(text).toLowerCase();
  const sorted = [...VENUE_ANCHORS].sort((a, b) => b.length - a.length);
  for (const anchor of sorted) {
    const anchorRe = new RegExp(
      '(?:^|[^\\\\wáéíóúñ])(' + anchor.replace(/ /g, '\\\\s+') + ')(?=[^\\\\wáéíóúñ]|$)',
      'i'
    );
    const m = normalized.match(anchorRe);
    if (!m) continue;
    const offset = m.index + (m[0].length - m[1].length);
    const tail = text.slice(offset);
    const tokens = tail.split(/\\s+/);
    const out = [];
    for (let i = 0; i < Math.min(tokens.length, 6); i++) {
      const raw = tokens[i];
      const noTrail = raw.replace(/[.,;:!?\\n()"«»]+$/, '');
      const clean = noTrail.replace(/[^\\wáéíóúñÁÉÍÓÚÑ]/g, '');
      if (i > 0) {
        if (LOCATION_STOP_RE.test(clean)) break;
        if (TIME_TOKEN_RE.test(noTrail)) break;
      }
      out.push(noTrail);
      if (/[.,;:!?\\n]$/.test(raw)) break;
    }
    if (out.length < 2 && GENERIC_STANDALONE.has(anchor.toLowerCase())) continue;
    const captured = out.join(' ').trim();
    if (VENUE_BLACKLIST.some(re => re.test(captured))) continue;
    return captured;
  }
  return null;
}

function buildFingerprint(etiqueta, aytoId, publishedAtFmt, idempotKey, candidateStatus) {
  // Stable fingerprint rules:
  //   - OK_EVENTO with named etiqueta + date: etiqueta::ayto::YYYY-MM  (cross-post dedup same month)
  //   - DUDA / NO_EVENTO / missing name:      status::ayto::idempot8    (unique per post, no collision)
  const base = norm(etiqueta || candidateStatus || 'NOEVENTO').slice(0, 40);
  const a = norm(aytoId || 'UNKNOWN').slice(0, 20);
  const isNamedEvent = Boolean(etiqueta) && candidateStatus === 'OK_EVENTO';
  let suffix;
  if (isNamedEvent && publishedAtFmt && /^\\d{4}-\\d{2}/.test(String(publishedAtFmt))) {
    suffix = String(publishedAtFmt).slice(0, 7); // YYYY-MM
  } else {
    const key = String(idempotKey || '').replace(/[^A-Za-z0-9]/g, '');
    suffix = key ? key.slice(-10) : 'NOID';
  }
  return base + '::' + a + '::' + suffix;
}

// Derive SGAE rights classification (orthogonal to candidate_status).
// Returns CON_DERECHOS | SIN_DERECHOS | DUDOSO | null (NULL when no event detected).
function computeRights(candidateStatus, eventType, score, ocrConf, hasDicMatch, hasRelevantSignal) {
  if (candidateStatus === 'NO_EVENTO') return null;
  if (candidateStatus === 'DUDA_EVENTO' || candidateStatus === 'REVISION_MANUAL') return 'DUDOSO';
  if (typeof score === 'number' && score < 0.70) return 'DUDOSO';
  if (typeof ocrConf === 'number' && ocrConf > 0 && ocrConf < 0.50) return 'DUDOSO';
  if (!hasDicMatch && hasRelevantSignal) return 'DUDOSO';
  const et = String(eventType || '').toUpperCase();
  const SIN = ['SIN DERECHOS', 'SIN_DERECHOS', 'SINDERECHOS'];
  if (SIN.some(v => et === v) || et.includes('SIN_DERECH') || et.includes('SIN DERECH')) return 'SIN_DERECHOS';
  const CON = ['VARIEDADES', 'HUMANA', 'DRAMATICOS', 'SINFONICA', 'MECANICA', 'CINE', 'REVISION_HUMANA'];
  if (CON.includes(et)) return 'CON_DERECHOS';
  return 'DUDOSO';
}

// ── Load DIC_ETIQUETAS from PackDic node ──────────────────────────
const dic = ($('Pack DIC').first().json.__DIC_ETIQUETAS) || [];

const results = [];

for (const item of $input.all()) {
  const post = item.json;
  // Skip empty items (e.g. when Get And Lock Posts returns no rows)
  if (!post || !post.social_post_id) continue;
  const socialPostId = Number(post.social_post_id);
  const idempotKey = String(post.idempot_key || '');
  const textClean = norm(post.text_post_clean || post.text_base || '');
  const ocrRaw = String(post.ocr_combined_text || '').trim();
  const ocrNorm = norm(ocrRaw);
  const hasText = Boolean(post.has_text) || textClean.length > 2;
  const isReel = Boolean(post.is_reel);
  const isVideo = Boolean(post.is_video_post);
  const mediaHasPhoto = Boolean(post.media_has_photo);
  const maxOcrConf = Number(post.max_ocr_confidence) || 0;
  const imgConTextoCount = Number(post.img_con_texto_count) || 0;

  const combinedText = [
    post.text_post_clean || '',
    ocrRaw ? ('[OCR] ' + ocrRaw) : ''
  ].filter(Boolean).join(' | ').slice(0, 2000);

  // ── A) Context blockers: forzar NO_EVENTO si el texto es claramente no-SGAE ──
  const INFRASTRUCTURE_RE = /\\b(pfea|r[eé]gimen\\s+general|r[eé]gimen\\s+agrario|trabajos?\\s+de\\s+(pintura|z[oó]calo|demolici[oó]n|restauraci[oó]n|adecuaci[oó]n|instalaci[oó]n)|obra\\s+(p[uú]blica|del\\s+colegio|de\\s+la\\s+plaza|municipal)|reforma\\s+(integral|del)|plan\\s+(municipal|de\\s+control|de\\s+emergencia|sanitario)|campa[ñn]a\\s+(sanitaria|antimosquitos|de\\s+salud)|virus\\s+del\\s+nilo|tuber[ií]as?|muro\\s+de\\s+calle|pavimento|placas\\s+solares|dus\\s+5000|inyecciones\\s+de\\s+vitaminas|escultura\\s+del\\s+ferroviario|musealizaci[oó]n)\\b/i;
  const ADMIN_NONEVENT_RE = /\\b(bando|aviso\\s+(oficial|municipal|importante)|comunicado\\s+oficial|corte\\s+de\\s+(tr[aá]fico|calle|carretera)|informaci[oó]n\\s+importante|recordatorio|cambio\\s+de\\s+hora|impuesto|tasa\\s+municipal|oficina\\s+de\\s+atenci[oó]n|registro\\s+de\\s+explotaciones|bus\\s+playa|bus\\s+a\\s+la|d[ií]as?\\s+de\\s+luto|fallecimiento|d[ií]a\\s+(de\\s+la\\s+madre|de\\s+la\\s+hispanidad|del\\s+padre|de\\s+todos\\s+los\\s+santos|mundial\\s+de|internacional\\s+contra|de\\s+la\\s+bicicleta|de\\s+la\\s+filatelia|de\\s+la\\s+constituci[oó]n|de\\s+todos\\s+los\\s+santos|mundial\\s+de\\s+la)|visita\\s+institucional|desplegada\\s+la\\s+bandera|cambiamos\\s+la\\s+hora|reparto\\s+de\\s+parras|cena\\s+de\\s+navidad|feliz\\s+nochebuena|feliz\\s+navidad)\\b/i;
  const SPORTS_RE = /\\b(zumba|aquagym|baloncesto|f[uú]tbol|atletismo|liga\\s+(municipal|del\\s+bajo)|club\\s+deportivo|campeonato|torneo|san\\s+silvestre|carrera\\s+(de\\s+cintas|infantil|de\\s+coches)|partido|reto\\s+beactive|escuela\\s+de\\s+deporte|tiro\\s+(al\\s+plato|con\\s+carabina)|senderismo|d[ií]a\\s+de\\s+la\\s+bicicleta|parque\\s+acu[aá]tico|travesia\\s+en\\s+kayak|ruta\\s+en\\s+kayak|aquavera|equipo\\s+de\\s+baloncesto|la\\s+des[eé]rtica|desertica|tirada\\s+para\\s+socios)\\b/i;
  const EXCURSION_RE = /\\b(excursi[oó]n|viaje\\s+(organizado|al\\s+parque|a\\s+la\\s+cala|a\\s+macael|a\\s+tahal|de\\s+navidad\\s+para\\s+visitar)|equipaje\\s+de\\s+experiencias|balneario\\s+de\\s+archena)\\b/i;
  const TALK_RE = /\\b(conferencia|charla|coloquio|coloquios|presentaci[oó]n\\s+(del\\s+libro|del\\s+proyecto|del\\s+plan|institucional)|entrevista|rueda\\s+de\\s+prensa|jornada\\s+(t[eé]cnica|formativa|sobre)|mesa\\s+redonda|ponencia|debate\\s+p[uú]blico)\\b/i;

  let forceNoEvent = false;
  let forceReason = '';
  if (INFRASTRUCTURE_RE.test(textClean)) {
    forceNoEvent = true; forceReason = 'infrastructure/construction/plan';
  } else if (ADMIN_NONEVENT_RE.test(textClean)) {
    forceNoEvent = true; forceReason = 'administrative/institutional';
  } else if (SPORTS_RE.test(textClean) && !/\\b(concierto|actuaci[oó]n\\s+(de|del)|pasacalles|verbena)\\b/i.test(textClean)) {
    forceNoEvent = true; forceReason = 'sports without music';
  } else if (EXCURSION_RE.test(textClean) && !/\\b(concierto|actuaci[oó]n\\s+(de|del)|orquesta|festival\\s+de\\s+m[uú]sica)\\b/i.test(textClean)) {
    forceNoEvent = true; forceReason = 'excursion/trip';
  } else if (TALK_RE.test(textClean) && !/\\b(concierto|actuaci[oó]n\\s+(de|del)|orquesta|coro|recital|m[uú]sica\\s+en\\s+vivo)\\b/i.test(textClean)) {
    forceNoEvent = true; forceReason = 'talk/conference without music';
  }

  // ── DIC matching ──────────────────────────────────────────────
  const textMatches = [];
  const ocrMatches = [];

  for (const row of dic) {
    const etiqueta = norm(row.ETIQUETA || row.Etiqueta || row.etiqueta || '');
    const tipo = norm(row.TIPO_EVENTO || row.Tipo_Evento || row.tipo_evento || '');
    const prioridad = Number(row.PRIORIDAD || row.Prioridad || row.prioridad);
    const sinRaw = String(row.SINONIMOS || row.Sinonimos || row.sinonimos || '').trim();

    if (!etiqueta || !Number.isFinite(prioridad) || !sinRaw) continue;

    const synonyms = sinRaw.split(';').map(s => norm(s)).filter(Boolean);

    if (textClean) {
      for (const syn of synonyms) {
        if (containsWordOrPhrase(textClean, syn)) {
          textMatches.push({ etiqueta, tipo, prioridad, token: syn, tokenLen: syn.length });
          break;
        }
      }
    }
    if (ocrNorm) {
      for (const syn of synonyms) {
        if (containsWordOrPhrase(ocrNorm, syn)) {
          ocrMatches.push({ etiqueta, tipo, prioridad, token: syn, tokenLen: syn.length });
          break;
        }
      }
    }
  }

  const sortMatches = (arr) =>
    arr.sort((a, b) => a.prioridad !== b.prioridad
      ? a.prioridad - b.prioridad
      : b.tokenLen - a.tokenLen);

  sortMatches(textMatches);
  sortMatches(ocrMatches);

  const bestText = textMatches[0] || null;
  const bestOcr = ocrMatches[0] || null;

  let sourceDetection = 'HEURISTIC';
  let bestMatch = null;
  let allMatchesCombined = [];

  if (bestText && bestOcr) {
    sourceDetection = 'BOTH';
    bestMatch = bestText.prioridad <= bestOcr.prioridad ? bestText : bestOcr;
    allMatchesCombined = textMatches.concat(ocrMatches);
  } else if (bestText) {
    sourceDetection = 'TEXT';
    bestMatch = bestText;
    allMatchesCombined = textMatches;
  } else if (bestOcr) {
    sourceDetection = 'OCR';
    bestMatch = bestOcr;
    allMatchesCombined = ocrMatches;
  }

  // ── Decision rules V1 ──────────────────────────────────────────
  let candidateStatus;
  let needsManualReview = false;
  let ambiguityStatus = null;
  let detectionScore = 0;
  let detectionReason = '';
  let eventName = '';
  let eventType = '';
  let eventClass = '';
  let exportToSheet = false;
  let matchedLabels = [];

  // ── B) Match blockers: invalidar match del DIC en contextos que lo contradicen ──
  // "fiesta patronal local" y similares → DUDA_EVENTO (softer), no NO_EVENTO
  const MATCH_SOFT_TO_DUDA = {
    'PARTY': /\\bfiesta\\s+(patronal\\s+local|familiar|privada|de\\s+graduaci[oó]n)\\b/i,
  };
  const MATCH_HARD_BLOCKERS = {
    'ACTUACION':   /\\b(actuaci[oó]n\\s+(de\\s+este\\s+plan|municipal|polic[ií]al|administrativa|de\\s+seguridad|para\\s+nuestros|que\\s+se\\s+ten[ií]a\\s+que\\s+hacer)|actuar\\s+en\\s+la\\s+restauraci[oó]n|actuando\\s+en\\s+la\\s+restauraci[oó]n|actuado\\s+como\\s+(aut[eé]nticos\\s+periodistas|periodistas))\\b/i,
    'TEATRO':      /\\b(obra\\s+(p[uú]blica|del\\s+colegio|de\\s+la\\s+plaza|de\\s+instalaci[oó]n|de\\s+restauraci[oó]n|de\\s+pintura|del\\s+pfea|se\\s+realizar[aá])|trabajos\\s+del\\s+pfea|obras?\\s+de\\s+(adecuaci[oó]n|demolici[oó]n|restauraci[oó]n|mejora))\\b/i,
    'MAGIA':       /\\b(ilusi[oó]n\\s+(de\\s+trabajar|por\\s+la)|con\\s+ilusi[oó]n\\s+han?\\s+escrito|caritas?\\s+de\\s+ilusi[oó]n|carta\\s+a\\s+pap[aá]\\s+noel)\\b/i,
    'GRUPO':       /\\b(grupo\\s+(de\\s+(vecinos|vecinas|santafere[nñ]@s|turistas|trabajadores|ecologista|personas|amigos|baloncesto)|ecologista\\s+mediterraneo))\\b/i,
    'CONCIERTO':   /\\b(festival\\s+de\\s+juegos)\\b/i,
  };

  if (bestMatch) {
    const hardBlocker = MATCH_HARD_BLOCKERS[bestMatch.etiqueta];
    const softBlocker = MATCH_SOFT_TO_DUDA[bestMatch.etiqueta];
    if (hardBlocker && hardBlocker.test(textClean)) {
      const blockedEtiqueta = bestMatch.etiqueta;  // guardar antes de nullear
      bestMatch = null;
      allMatchesCombined = [];
      sourceDetection = 'HEURISTIC';
      detectionReason = 'DIC match [' + blockedEtiqueta + '] invalidated by hard context blocker';
    } else if (softBlocker && softBlocker.test(textClean)) {
      // marcar para forzar DUDA_EVENTO más abajo
      ambiguityStatus = 'SOFT_BLOCKER_' + bestMatch.etiqueta;
    }
  }

  // Si A) contextblockers forzó NO_EVENTO, saltar decisión del bestMatch
  if (forceNoEvent) {
    candidateStatus = 'NO_EVENTO';
    detectionScore = 0.02;
    detectionReason = 'Context blocker: ' + forceReason;
    exportToSheet = false;
  } else if (bestMatch) {
    const samePrio = allMatchesCombined.filter(m => m.prioridad === bestMatch.prioridad);
    const uniqueEtiquetas = [...new Set(samePrio.map(m => m.etiqueta))];

    const textEtiqueta = bestText ? bestText.etiqueta : null;
    const ocrEtiqueta = bestOcr ? bestOcr.etiqueta : null;
    const hasConflict = bestText && bestOcr
      && bestText.prioridad === bestOcr.prioridad
      && textEtiqueta !== ocrEtiqueta;

    if (hasConflict) {
      candidateStatus = 'REVISION_MANUAL';
      needsManualReview = true;
      ambiguityStatus = 'CONFLICT_TEXT_OCR';
      detectionScore = 0.50;
      detectionReason = ('Conflict: text→' + textEtiqueta + ' vs OCR→' + ocrEtiqueta).slice(0, 200);
      exportToSheet = true;
    } else if (uniqueEtiquetas.length === 1) {
      if (sourceDetection === 'OCR' && maxOcrConf < 0.5) {
        candidateStatus = 'DUDA_EVENTO';
        detectionScore = 0.55;
        detectionReason = ('OCR match [' + bestMatch.token + '] low confidence ' + maxOcrConf.toFixed(2)).slice(0, 200);
        exportToSheet = true;
      } else {
        candidateStatus = 'OK_EVENTO';
        detectionScore = sourceDetection === 'BOTH' ? 0.95
          : sourceDetection === 'TEXT' ? 0.88
          : 0.75;
        detectionReason = ('Unique DIC match [' + bestMatch.token + '] via ' + sourceDetection).slice(0, 200);
        exportToSheet = true;
      }
    } else {
      ambiguityStatus = 'AMBIGUOUS_MULTIPLE_LABELS';
      if (sourceDetection === 'BOTH' && maxOcrConf >= 0.7) {
        candidateStatus = 'OK_EVENTO';
        detectionScore = 0.72;
        detectionReason = ('Ambiguous [' + uniqueEtiquetas.join(', ') + '] resolved by OCR conf=' + maxOcrConf.toFixed(2)).slice(0, 200);
        exportToSheet = true;
      } else {
        candidateStatus = 'DUDA_EVENTO';
        detectionScore = 0.50;
        detectionReason = ('Ambiguous labels at same priority: [' + uniqueEtiquetas.join(', ') + ']').slice(0, 200);
        exportToSheet = true;
      }
    }
    const fullText = [post.text_post_clean, post.text_base, post.bd_link_description_text]
                     .filter(Boolean).join(' \\n ');
    eventName  = extractHumanName(fullText, ocrRaw, post.bd_post_external_title, bestMatch.etiqueta);
    eventType  = bestMatch.etiqueta;  // ETIQUETA (ACTUACION, CONCIERTO, ...)
    eventClass = bestMatch.tipo;      // CLASE SGAE (HUMANA, VARIEDADES, ...)
    matchedLabels = uniqueEtiquetas;

    // B) soft blocker: bajar OK_EVENTO a DUDA_EVENTO si contexto lo sugiere
    if (candidateStatus === 'OK_EVENTO' && String(ambiguityStatus || '').startsWith('SOFT_BLOCKER_')) {
      candidateStatus = 'DUDA_EVENTO';
      detectionScore = Math.min(detectionScore, 0.55);
      detectionReason = (detectionReason + ' | downgraded by soft blocker').slice(0, 200);
    }

  } else if (imgConTextoCount > 0 && maxOcrConf >= 0.5 && ocrRaw.length > 10) {
    candidateStatus = 'DUDA_EVENTO';
    sourceDetection = 'OCR';
    detectionScore = 0.40;
    detectionReason = ('No DIC match; OCR found in ' + imgConTextoCount + ' image(s), conf=' + maxOcrConf.toFixed(2)).slice(0, 200);
    exportToSheet = true;
  } else if (!hasText && (isReel || isVideo)) {
    candidateStatus = 'NO_EVENTO';
    detectionScore = 0.05;
    detectionReason = 'Video/reel without text and no DIC match';
  } else {
    candidateStatus = 'NO_EVENTO';
    detectionScore = 0.00;
    detectionReason = 'No DIC match and no usable signals';
  }

  const hasDicMatch = Boolean(bestMatch);
  const hasRelevantSignal = hasText || imgConTextoCount > 0 || mediaHasPhoto;
  const rightsClassification = computeRights(
    candidateStatus, eventClass, detectionScore, maxOcrConf, hasDicMatch, hasRelevantSignal
  );

  const titleHuman = (eventName
    ? eventName + ' — ' + String(post.ayto_id || '').toUpperCase() + ' (' + String(post.published_at_fmt || '') + ')'
    : (String(post.text_post_clean || '').trim().replace(/\\s+/g, ' ').slice(0, 80) || '(sin texto)')
  ).slice(0, 120);

  const fingerprint = buildFingerprint(eventName, post.ayto_id, post.published_at_fmt, idempotKey, candidateStatus);
  // Location extraction from combined text + OCR (heurística venue anchors)
  const locCandidate = extractLocation(
    [post.text_post_clean, post.text_base, post.bd_link_description_text, ocrRaw].filter(Boolean).join(' \\n ')
  );
  // sheet_export_key is unique per (post, candidate) in the DB; SHEET_KEY in Sheets uses
  // event_fingerprint for cross-post deduplication (same event from reposts merges to one row)
  const sheetExportKey = fingerprint + '::' + socialPostId;

  const combinedSignals = JSON.stringify({
    has_text: hasText, is_reel: isReel, is_video: isVideo,
    media_has_photo: mediaHasPhoto,
    img_con_texto_count: imgConTextoCount,
    max_ocr_confidence: maxOcrConf,
    text_matches: textMatches.length,
    ocr_matches: ocrMatches.length,
    best_text_match: bestText ? bestText.etiqueta : null,
    best_ocr_match: bestOcr ? bestOcr.etiqueta : null,
  });

  results.push({ json: {
    // identity
    social_post_id: socialPostId,
    idempot_key: idempotKey,
    // post signals (for Sheets export)
    has_text: hasText,
    is_reel: isReel,
    is_video: isVideo,
    source_code: String(post.source_code || ''),
    account_name: String(post.account_name || ''),
    ayto_id: String(post.ayto_id || ''),
    text_post_clean: String(post.text_post_clean || '').slice(0, 500),
    ocr_combined_text: ocrRaw.slice(0, 500),
    max_ocr_confidence: maxOcrConf,
    post_url: String(post.post_url || ''),
    published_at_fmt: String(post.published_at_fmt || ''),
    municipio_candidate: null,
    // analysis fields (for post_analysis)
    analysis_version: 'v1',
    analysis_status: 'DONE',
    has_relevant_media: imgConTextoCount > 0,
    has_relevant_text: hasText,
    combined_text: combinedText,
    combined_signals_json: combinedSignals,
    matched_labels_json: JSON.stringify(matchedLabels),
    event_detection_status: candidateStatus,
    event_detection_score: detectionScore,
    event_detection_reason: detectionReason,
    ambiguity_status: ambiguityStatus,
    needs_manual_review: needsManualReview,
    source_detection: sourceDetection,
    // candidate fields (for candidate_events)
    candidate_status: candidateStatus,
    event_name_candidate: eventName || null,
    event_type_candidate: eventType || null,
    event_class_candidate: eventClass || null,
    location_candidate: locCandidate || null,
    event_fingerprint: fingerprint,
    sheet_export_key: sheetExportKey,
    export_to_sheet: exportToSheet,
    needs_review: needsManualReview,
    confidence_score: detectionScore,
    rights_classification: rightsClassification,
    event_title_human: titleHuman,
  }});
}

return results;`,
    };

    @node({
        id: 'detect-save-analysis',
        name: 'Save Post Analysis',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-160, -288],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    SavePostAnalysis = {
        schema: 'public',
        table: 'post_analysis',
        operation: 'executeQuery',
        query: `INSERT INTO post_analysis (
  social_post_id, analysis_version, analysis_status,
  has_relevant_media, has_relevant_text,
  combined_text, combined_signals_json, matched_labels_json,
  event_detection_status, event_detection_score, event_detection_reason,
  ambiguity_status, needs_manual_review, source_detection, rights_classification, processed_at
) VALUES (
  $1::bigint, $2::text, $3::text,
  $4::boolean, $5::boolean,
  $6::text, $7::jsonb, $8::jsonb,
  $9::text, $10::numeric, $11::text,
  $12::text, $13::boolean, $14::text, NULLIF($15::text, ''), NOW()
)
ON CONFLICT (social_post_id, analysis_version) DO UPDATE SET
  analysis_status           = EXCLUDED.analysis_status,
  has_relevant_media        = EXCLUDED.has_relevant_media,
  has_relevant_text         = EXCLUDED.has_relevant_text,
  combined_text             = EXCLUDED.combined_text,
  combined_signals_json     = EXCLUDED.combined_signals_json,
  matched_labels_json       = EXCLUDED.matched_labels_json,
  event_detection_status    = EXCLUDED.event_detection_status,
  event_detection_score     = EXCLUDED.event_detection_score,
  event_detection_reason    = EXCLUDED.event_detection_reason,
  ambiguity_status          = EXCLUDED.ambiguity_status,
  needs_manual_review       = EXCLUDED.needs_manual_review,
  source_detection          = EXCLUDED.source_detection,
  rights_classification     = EXCLUDED.rights_classification,
  processed_at              = NOW(),
  updated_at                = NOW()
RETURNING id AS post_analysis_id, social_post_id, event_detection_status;`,
        options: {
            queryReplacement:
                '={{ [$json.social_post_id, $json.analysis_version, $json.analysis_status, $json.has_relevant_media, $json.has_relevant_text, $json.combined_text, $json.combined_signals_json, $json.matched_labels_json, $json.event_detection_status, $json.event_detection_score, $json.event_detection_reason, $json.ambiguity_status, $json.needs_manual_review, $json.source_detection, ($json.rights_classification || "")] }}',
        },
    };

    @node({
        id: 'detect-save-candidates',
        name: 'Save Candidate Events',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [64, -288],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    SaveCandidateEvents = {
        schema: 'public',
        table: 'candidate_events',
        operation: 'executeQuery',
        query: `INSERT INTO candidate_events (
  social_post_id, post_analysis_id, analysis_version, candidate_index,
  candidate_status, event_fingerprint,
  event_name_candidate, event_type_candidate, event_class_candidate,
  location_candidate,
  source_detection, confidence_score,
  needs_review, is_processed_final, export_to_sheet, sheet_export_key,
  rights_classification
) VALUES (
  $1::bigint, $2::bigint, $3::text, 1,
  $4::text, $5::text,
  $6::text, $7::text, $14::text,
  $15::text,
  $8::text, $9::numeric,
  $10::boolean, true, $11::boolean, $12::text,
  NULLIF($13::text, '')
)
ON CONFLICT (social_post_id, analysis_version, candidate_index) DO UPDATE SET
  post_analysis_id      = EXCLUDED.post_analysis_id,
  candidate_status      = EXCLUDED.candidate_status,
  event_fingerprint     = EXCLUDED.event_fingerprint,
  event_name_candidate  = EXCLUDED.event_name_candidate,
  event_type_candidate  = EXCLUDED.event_type_candidate,
  event_class_candidate = EXCLUDED.event_class_candidate,
  location_candidate    = EXCLUDED.location_candidate,
  source_detection      = EXCLUDED.source_detection,
  confidence_score      = EXCLUDED.confidence_score,
  needs_review          = EXCLUDED.needs_review,
  is_processed_final    = EXCLUDED.is_processed_final,
  export_to_sheet       = EXCLUDED.export_to_sheet,
  sheet_export_key      = EXCLUDED.sheet_export_key,
  rights_classification = EXCLUDED.rights_classification,
  updated_at            = NOW()
RETURNING id AS candidate_event_id, social_post_id, candidate_status, export_to_sheet, rights_classification;`,
        options: {
            queryReplacement:
                '={{ [$("Classify And Detect").item.json.social_post_id, $json.post_analysis_id, $("Classify And Detect").item.json.analysis_version, $("Classify And Detect").item.json.candidate_status, $("Classify And Detect").item.json.event_fingerprint, $("Classify And Detect").item.json.event_name_candidate, $("Classify And Detect").item.json.event_type_candidate, $("Classify And Detect").item.json.source_detection, $("Classify And Detect").item.json.confidence_score, $("Classify And Detect").item.json.needs_review, $("Classify And Detect").item.json.export_to_sheet, $("Classify And Detect").item.json.sheet_export_key, ($("Classify And Detect").item.json.rights_classification || ""), ($("Classify And Detect").item.json.event_class_candidate || ""), ($("Classify And Detect").item.json.location_candidate || "")] }}',
        },
    };

    @node({
        id: 'detect-mark-done',
        name: 'Mark Posts Done',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [288, -288],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    MarkPostsDone = {
        schema: 'public',
        table: 'social_posts',
        operation: 'executeQuery',
        query: `UPDATE social_posts
SET analysis_status = 'DETECT_REVIEW', updated_at = NOW()
WHERE id = $1::bigint
  AND analysis_status = 'DETECT_PROCESSING'
  RETURNING id AS social_post_id, analysis_status;`,
        options: {
            queryReplacement: '={{ [$("Classify And Detect").item.json.social_post_id] }}',
        },
    };

    @node({
        id: 'detect-get-media-for-move',
        name: 'Get Media For Move',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [512, -192],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    GetMediaForMove = {
        schema: 'public',
        table: 'post_media',
        operation: 'executeQuery',
        query: `SELECT
  pm.id AS media_id,
  pm.social_post_id,
  pm.storage_path,
  COALESCE(pm.media_type, 'IMAGE') AS media_type,
  COALESCE($2::text, '') AS candidate_status,
  COALESCE($3::text, '') AS event_type_candidate,
  COALESCE($4::text, '') AS rights_classification
FROM post_media pm
WHERE pm.social_post_id = $1::bigint
  AND pm.download_status = 'DOWNLOADED'
  AND pm.storage_path IS NOT NULL
  AND POSITION('/sin_clasificar/' IN pm.storage_path) > 0
ORDER BY pm.media_index ASC;`,
        options: {
            queryReplacement:
                '={{ [$json.social_post_id, $("Classify And Detect").item.json.candidate_status, $("Classify And Detect").item.json.event_type_candidate, ($("Classify And Detect").item.json.rights_classification || "")] }}',
        },
    };

    @node({
        id: 'detect-build-media-move-paths',
        name: 'Build Media Move Paths',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [736, -192],
    })
    BuildMediaMovePaths = {
        jsCode: `const row = $input.first().json;

const rights = String(row.rights_classification || '').toUpperCase();

let targetFolder = 'sin_clasificar';
if (rights === 'CON_DERECHOS') targetFolder = 'con_derechos';
else if (rights === 'SIN_DERECHOS') targetFolder = 'sin_derechos';
else if (rights === 'DUDOSO') targetFolder = 'dudosos';

const sourcePath = String(row.storage_path || '');
const targetPath = sourcePath.includes('/sin_clasificar/')
  ? sourcePath.replace('/sin_clasificar/', '/' + targetFolder + '/')
  : sourcePath;

const targetDir = targetPath.includes('/') ? targetPath.slice(0, targetPath.lastIndexOf('/')) : '';

return {
  media_id: row.media_id,
  social_post_id: row.social_post_id,
  source_path: sourcePath,
  target_path: targetPath,
  target_dir: targetDir,
  target_folder: targetFolder,
};`,
    };

    @node({
        id: 'detect-move-media-file',
        name: 'Move Media To Final Folder',
        type: 'n8n-nodes-base.executeCommand',
        version: 1,
        position: [960, -192],
        onError: 'continueErrorOutput',
    })
    MoveMediaToFinalFolder = {
        command:
            '={{ "mkdir -p \\"" + $json.target_dir + "\\" && if [ -f \\"" + $json.source_path + "\\" ]; then mv \\"" + $json.source_path + "\\" \\"" + $json.target_path + "\\"; fi" }}',
    };

    @node({
        id: 'detect-update-moved-media-path',
        name: 'Update Moved Media Path',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1184, -288],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    UpdateMovedMediaPath = {
        schema: 'public',
        table: 'post_media',
        operation: 'executeQuery',
        query: `UPDATE post_media
SET storage_path = $2::text,
    updated_at = NOW()
WHERE id = $1::bigint
RETURNING id AS media_id, social_post_id, storage_path;`,
        options: {
            queryReplacement:
                '={{ [$("Build Media Move Paths").item.json.media_id, $("Build Media Move Paths").item.json.target_path] }}',
        },
    };

    @node({
        id: 'detect-log-media-move-error',
        name: 'Log Media Move Error',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1184, -96],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    LogMediaMoveError = {
        schema: 'public',
        table: 'processing_logs',
        operation: 'executeQuery',
        query: `INSERT INTO processing_logs
  (entity_type, entity_id, workflow_name, phase, status, message, details_json)
VALUES
  ('media', $1::bigint, 'social_post_detect_export', 'MOVE_MEDIA', 'ERROR', $2::text, $3::jsonb)
RETURNING id;`,
        options: {
            queryReplacement: `={{ [
  $('Build Media Move Paths').item.json.media_id,
  'Failed moving media file to classified folder',
  JSON.stringify({
    social_post_id: $('Build Media Move Paths').item.json.social_post_id,
    source_path: $('Build Media Move Paths').item.json.source_path,
    target_path: $('Build Media Move Paths').item.json.target_path,
    target_folder: $('Build Media Move Paths').item.json.target_folder,
    command_output: $json,
  }),
] }}`,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.TestWebhook.out(0).to(this.ReadDicEtiquetas.in(0));
        this.ManualTrigger.out(0).to(this.ReadDicEtiquetas.in(0));
        this.ScheduleTrigger.out(0).to(this.ReadDicEtiquetas.in(0));
        this.ReadDicEtiquetas.out(0).to(this.PackDic.in(0));
        this.PackDic.out(0).to(this.GetAndLockPosts.in(0));
        this.GetAndLockPosts.out(0).to(this.ClassifyAndDetect.in(0));
        this.ClassifyAndDetect.out(0).to(this.SavePostAnalysis.in(0));
        this.SavePostAnalysis.out(0).to(this.SaveCandidateEvents.in(0));
        this.SaveCandidateEvents.out(0).to(this.MarkPostsDone.in(0));
        this.MarkPostsDone.out(0).to(this.GetMediaForMove.in(0));
        this.GetMediaForMove.out(0).to(this.BuildMediaMovePaths.in(0));
        this.BuildMediaMovePaths.out(0).to(this.MoveMediaToFinalFolder.in(0));
        this.MoveMediaToFinalFolder.out(0).to(this.UpdateMovedMediaPath.in(0));
        this.MoveMediaToFinalFolder.out(1).to(this.LogMediaMoveError.in(0));
    }
}
