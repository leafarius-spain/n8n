import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SOCIAL MEDIA DETECT EXPORT
// Nodes   : 14  |  Connections: 15
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// TestWebhook                        webhook
// ManualTrigger                      manualTrigger
// ScheduleTrigger                    scheduleTrigger
// ReadDicEtiquetas                   googleSheets               [creds]
// PackDic                            code
// GetAndLockPosts                    postgres                   [creds]
// ClassifyAndDetect                  code
// SavePostAnalysis                   postgres                   [creds]
// SaveCandidateEvents                postgres                   [creds]
// MarkPostsDone                      postgres                   [creds]
// FilterExportable                   postgres                   [onError→out(1)] [creds]
// ExportPostsToSheet                 googleSheets               [creds]
// ExportCandidatesToSheet            googleSheets               [creds]
// MarkSheetExported                  postgres                   [creds]
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
//    → FilterExportable
//      → ExportPostsToSheet
//        → ExportCandidatesToSheet
//          → MarkSheetExported
// ManualTrigger
//    → ReadDicEtiquetas (↩ loop)
//    → FilterExportable (↩ loop)
// ScheduleTrigger
//    → ReadDicEtiquetas (↩ loop)
//    → FilterExportable (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'B9X1iY7jFdGCAcK9',
    name: 'SOCIAL MEDIA DETECT EXPORT',
    active: true,
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
export class SocialMediaDetectExportWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'detect-test-webhook',
        webhookId: 'b3c58a2e-7d91-4f05-9e34-1a0b2c3d4e5f',
        name: 'Test Webhook',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1280, 160],
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
        position: [-1280, -320],
    })
    ManualTrigger = {};

    @node({
        id: 'detect-schedule-trigger',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.3,
        position: [-1280, -80],
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
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [-1040, -208],
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
        id: 'detect-pack-dic',
        name: 'Pack DIC',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-800, -208],
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
        position: [-560, -208],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    GetAndLockPosts = {
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
        position: [-320, -208],
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

function buildFingerprint(etiqueta, aytoId) {
  const e = norm(etiqueta || 'NOEVENTO').slice(0, 40);
  const a = norm(aytoId || 'UNKNOWN').slice(0, 20);
  return e + '::' + a;
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
  let exportToSheet = false;
  let matchedLabels = [];

  if (bestMatch) {
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
    eventName = bestMatch.etiqueta;
    eventType = bestMatch.tipo;
    matchedLabels = uniqueEtiquetas;

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

  const fingerprint = buildFingerprint(eventName || candidateStatus, post.ayto_id);
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
    event_fingerprint: fingerprint,
    sheet_export_key: sheetExportKey,
    export_to_sheet: exportToSheet,
    needs_review: needsManualReview,
    confidence_score: detectionScore,
  }});
}

return results;`,
    };

    @node({
        id: 'detect-save-analysis',
        name: 'Save Post Analysis',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-80, -208],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    SavePostAnalysis = {
        operation: 'executeQuery',
        query: `INSERT INTO post_analysis (
  social_post_id, analysis_version, analysis_status,
  has_relevant_media, has_relevant_text,
  combined_text, combined_signals_json, matched_labels_json,
  event_detection_status, event_detection_score, event_detection_reason,
  ambiguity_status, needs_manual_review, source_detection, processed_at
) VALUES (
  $1::bigint, $2::text, $3::text,
  $4::boolean, $5::boolean,
  $6::text, $7::jsonb, $8::jsonb,
  $9::text, $10::numeric, $11::text,
  $12::text, $13::boolean, $14::text, NOW()
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
  processed_at              = NOW(),
  updated_at                = NOW()
RETURNING id AS post_analysis_id, social_post_id, event_detection_status;`,
        options: {
            queryReplacement:
                '={{ [$json.social_post_id, $json.analysis_version, $json.analysis_status, $json.has_relevant_media, $json.has_relevant_text, $json.combined_text, $json.combined_signals_json, $json.matched_labels_json, $json.event_detection_status, $json.event_detection_score, $json.event_detection_reason, $json.ambiguity_status, $json.needs_manual_review, $json.source_detection] }}',
        },
    };

    @node({
        id: 'detect-save-candidates',
        name: 'Save Candidate Events',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [160, -208],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    SaveCandidateEvents = {
        operation: 'executeQuery',
        query: `INSERT INTO candidate_events (
  social_post_id, post_analysis_id, analysis_version, candidate_index,
  candidate_status, event_fingerprint,
  event_name_candidate, event_type_candidate,
  source_detection, confidence_score,
  needs_review, is_processed_final, export_to_sheet, sheet_export_key
) VALUES (
  $1::bigint, $2::bigint, $3::text, 1,
  $4::text, $5::text,
  $6::text, $7::text,
  $8::text, $9::numeric,
  $10::boolean, true, $11::boolean, $12::text
)
ON CONFLICT (social_post_id, analysis_version, candidate_index) DO UPDATE SET
  post_analysis_id    = EXCLUDED.post_analysis_id,
  candidate_status    = EXCLUDED.candidate_status,
  event_fingerprint   = EXCLUDED.event_fingerprint,
  event_name_candidate = EXCLUDED.event_name_candidate,
  event_type_candidate = EXCLUDED.event_type_candidate,
  source_detection    = EXCLUDED.source_detection,
  confidence_score    = EXCLUDED.confidence_score,
  needs_review        = EXCLUDED.needs_review,
  is_processed_final  = EXCLUDED.is_processed_final,
  export_to_sheet     = EXCLUDED.export_to_sheet,
  sheet_export_key    = EXCLUDED.sheet_export_key,
  updated_at          = NOW()
RETURNING id AS candidate_event_id, social_post_id, candidate_status, export_to_sheet;`,
        options: {
            queryReplacement:
                '={{ [$("Classify And Detect").item.json.social_post_id, $json.post_analysis_id, $("Classify And Detect").item.json.analysis_version, $("Classify And Detect").item.json.candidate_status, $("Classify And Detect").item.json.event_fingerprint, $("Classify And Detect").item.json.event_name_candidate, $("Classify And Detect").item.json.event_type_candidate, $("Classify And Detect").item.json.source_detection, $("Classify And Detect").item.json.confidence_score, $("Classify And Detect").item.json.needs_review, $("Classify And Detect").item.json.export_to_sheet, $("Classify And Detect").item.json.sheet_export_key] }}',
        },
    };

    @node({
        id: 'detect-mark-done',
        name: 'Mark Posts Done',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [400, -208],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    MarkPostsDone = {
        operation: 'executeQuery',
        query: `UPDATE social_posts
SET analysis_status = 'DETECT_DONE', updated_at = NOW()
WHERE id = $1::bigint
RETURNING id, analysis_status;`,
        options: {
            queryReplacement: '={{ [$("Classify And Detect").item.json.social_post_id] }}',
        },
    };

    @node({
        id: 'detect-filter-exportable',
        name: 'Filter Exportable',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-560, -480],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
        onError: 'continueErrorOutput',
    })
    FilterExportable = {
        operation: 'executeQuery',
        query: `SELECT
  ce.id AS candidate_event_id,
  ce.social_post_id,
  ce.candidate_status,
  ce.event_fingerprint,
  ce.sheet_export_key,
  ce.event_name_candidate,
  ce.event_type_candidate,
  COALESCE(ce.location_candidate, '') AS location_candidate,
  COALESCE(ce.municipio_candidate, '') AS municipio_candidate,
  COALESCE(ce.organizer_candidate, '') AS organizer_candidate,
  ce.source_detection,
  ce.confidence_score,
  ce.needs_review,
  COALESCE(ce.review_notes, '') AS review_notes,
  sp.idempot_key,
  COALESCE(sp.text_post_clean, '') AS text_post_clean,
  sp.is_reel,
  sp.is_video_post,
  sp.has_text,
  COALESCE(sp.post_url, '') AS post_url,
  TO_CHAR(sp.published_at, 'YYYY-MM-DD') AS published_at_fmt,
  COALESCE((SELECT ayto_id FROM publisher_accounts WHERE id = sp.publisher_account_id), '') AS ayto_id,
  (SELECT code FROM sources WHERE id = sp.source_id) AS source_code,
  (SELECT account_name FROM publisher_accounts WHERE id = sp.publisher_account_id) AS account_name,
  COALESCE((
    SELECT string_agg(mo.ocr_text_raw, ' | ' ORDER BY pm.media_index)
    FROM post_media pm
    JOIN media_ocr mo ON mo.post_media_id = pm.id
    WHERE pm.social_post_id = sp.id AND mo.has_meaningful_text = true
  ), '') AS ocr_combined_text,
  COALESCE(pa.event_detection_reason, '') AS detection_reason,
  TO_CHAR(ce.created_at, 'YYYY-MM-DD HH24:MI') AS created_at_fmt
FROM candidate_events ce
JOIN social_posts sp ON sp.id = ce.social_post_id
LEFT JOIN post_analysis pa ON pa.id = ce.post_analysis_id
WHERE ce.candidate_status IN ('OK_EVENTO', 'DUDA_EVENTO', 'REVISION_MANUAL')
  AND ce.export_to_sheet = true
  AND ce.sheet_exported_at IS NULL
ORDER BY ce.created_at ASC
LIMIT 50;`,
        options: {},
    };

    @node({
        id: 'detect-export-posts',
        name: 'Export Posts To Sheet',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [-320, -480],
        credentials: { googleSheetsOAuth2Api: { id: 'dvmGtqHi4eph1ywU', name: 'Google Sheets account' } },
    })
    ExportPostsToSheet = {
        operation: 'appendOrUpdate',
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
            value: 'gid=0',
            mode: 'list',
            cachedResultName: 'FB_POSTS_LIMPIOS ',
            cachedResultUrl:
                'https://docs.google.com/spreadsheets/d/1MmFKDvSUkyyOl9XEI_sYPrPaAsbdVhS8lGzZkcjsaFc/edit#gid=0',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                IDEMPOT_KEY: '={{ $json.idempot_key }}',
                POST_URL: '={{ $json.post_url }}',
                FECHA_PUBLICACION: '={{ $json.published_at_fmt }}',
                FUENTE: '={{ $json.source_code }}',
                AYTO_ID: '={{ $json.ayto_id }}',
                TIPO_EVENTO: '={{ $json.event_type_candidate }}',
                EVENTO_CANDIDATO: '={{ $json.event_name_candidate }}',
                STATUS_DETECCION: '={{ $json.candidate_status }}',
                MOTIVO_DETECCION: '={{ $json.detection_reason }}',
                NECESITA_REVISION: '={{ $json.needs_review }}',
                NOTAS_REVISION: '={{ $json.review_notes }}',
                EVENT_FINGERPRINT: '={{ $json.event_fingerprint }}',
                FECHA_CREACION: '={{ $now }}',
            },
            matchingColumns: ['IDEMPOT_KEY'],
            schema: [
                {
                    id: 'IDEMPOT_KEY',
                    displayName: 'IDEMPOT_KEY',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'POST_URL',
                    displayName: 'POST_URL',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'FECHA_PUBLICACION',
                    displayName: 'FECHA_PUBLICACION',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'FUENTE',
                    displayName: 'FUENTE',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'AYTO_ID',
                    displayName: 'AYTO_ID',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'TIPO_EVENTO',
                    displayName: 'TIPO_EVENTO',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'EVENTO_CANDIDATO',
                    displayName: 'EVENTO_CANDIDATO',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'STATUS_DETECCION',
                    displayName: 'STATUS_DETECCION',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'MOTIVO_DETECCION',
                    displayName: 'MOTIVO_DETECCION',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'NECESITA_REVISION',
                    displayName: 'NECESITA_REVISION',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'NOTAS_REVISION',
                    displayName: 'NOTAS_REVISION',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'EVENT_FINGERPRINT',
                    displayName: 'EVENT_FINGERPRINT',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'FECHA_CREACION',
                    displayName: 'FECHA_CREACION',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
            attemptToConvertTypes: false,
            convertFieldsToString: false,
        },
        options: {},
    };

    @node({
        id: 'detect-export-candidates',
        name: 'Export Candidates To Sheet',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [-80, -480],
        credentials: { googleSheetsOAuth2Api: { id: 'dvmGtqHi4eph1ywU', name: 'Google Sheets account' } },
    })
    ExportCandidatesToSheet = {
        operation: 'appendOrUpdate',
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
            value: 2061535902,
            mode: 'list',
            cachedResultName: 'EVENTOS_CANDIDATOS ',
            cachedResultUrl:
                'https://docs.google.com/spreadsheets/d/1MmFKDvSUkyyOl9XEI_sYPrPaAsbdVhS8lGzZkcjsaFc/edit#gid=2061535902',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                SHEET_KEY: '={{ $json.event_fingerprint }}',
                IDEMPOT_KEY: '={{ $json.idempot_key }}',
                EVENT_FINGERPRINT: '={{ $json.event_fingerprint }}',
                NOMBRE_EVENTO_CANDIDATO: '={{ $json.event_name_candidate }}',
                TIPO_EVENTO_CANDIDATO: '={{ $json.event_type_candidate }}',
                MUNICIPIO_CANDIDATO: '={{ $json.municipio_candidate }}',
                SOURCE_DETECTION: '={{ $json.source_detection }}',
                MOTIVO_DETECCION: '={{ $json.detection_reason }}',
                NECESITA_REVISION: '={{ $json.needs_review }}',
                NOTAS_REVISION: '={{ $json.review_notes }}',
                FECHA_CREACION: '={{ $json.created_at_fmt }}',
            },
            matchingColumns: ['SHEET_KEY'],
            schema: [
                {
                    id: 'SHEET_KEY',
                    displayName: 'SHEET_KEY',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'IDEMPOT_KEY',
                    displayName: 'IDEMPOT_KEY',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'EVENT_FINGERPRINT',
                    displayName: 'EVENT_FINGERPRINT',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'NOMBRE_EVENTO_CANDIDATO',
                    displayName: 'NOMBRE_EVENTO_CANDIDATO',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'TIPO_EVENTO_CANDIDATO',
                    displayName: 'TIPO_EVENTO_CANDIDATO',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'MUNICIPIO_CANDIDATO',
                    displayName: 'MUNICIPIO_CANDIDATO',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'SOURCE_DETECTION',
                    displayName: 'SOURCE_DETECTION',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'MOTIVO_DETECCION',
                    displayName: 'MOTIVO_DETECCION',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'NECESITA_REVISION',
                    displayName: 'NECESITA_REVISION',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'NOTAS_REVISION',
                    displayName: 'NOTAS_REVISION',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'FECHA_CREACION',
                    displayName: 'FECHA_CREACION',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
            attemptToConvertTypes: false,
            convertFieldsToString: false,
        },
        options: {},
    };

    @node({
        id: 'detect-mark-exported',
        name: 'Mark Sheet Exported',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [160, -480],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    MarkSheetExported = {
        operation: 'executeQuery',
        query: `UPDATE candidate_events
SET sheet_exported_at = NOW(), updated_at = NOW()
WHERE id = $1::bigint
RETURNING id, sheet_exported_at;`,
        options: {
            queryReplacement: '={{ [$("Filter Exportable").item.json.candidate_event_id] }}',
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.TestWebhook.out(0).to(this.ReadDicEtiquetas.in(0));
        this.TestWebhook.out(0).to(this.FilterExportable.in(0));
        this.ManualTrigger.out(0).to(this.ReadDicEtiquetas.in(0));
        this.ManualTrigger.out(0).to(this.FilterExportable.in(0));
        this.ScheduleTrigger.out(0).to(this.ReadDicEtiquetas.in(0));
        this.ScheduleTrigger.out(0).to(this.FilterExportable.in(0));
        this.ReadDicEtiquetas.out(0).to(this.PackDic.in(0));
        this.PackDic.out(0).to(this.GetAndLockPosts.in(0));
        this.GetAndLockPosts.out(0).to(this.ClassifyAndDetect.in(0));
        this.ClassifyAndDetect.out(0).to(this.SavePostAnalysis.in(0));
        this.SavePostAnalysis.out(0).to(this.SaveCandidateEvents.in(0));
        this.SaveCandidateEvents.out(0).to(this.MarkPostsDone.in(0));
        this.FilterExportable.out(0).to(this.ExportPostsToSheet.in(0));
        this.ExportPostsToSheet.out(0).to(this.ExportCandidatesToSheet.in(0));
        this.ExportCandidatesToSheet.out(0).to(this.MarkSheetExported.in(0));
    }
}
