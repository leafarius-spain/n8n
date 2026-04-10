import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SOCIAL MEDIA ANALYZE
// Nodes   : 8  |  Connections: 7
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// TestWebhook                        webhook
// ManualTrigger                      manualTrigger
// ScheduleTrigger                    scheduleTrigger
// GetMediaToAnalyze                  postgres                   [creds]
// CallOcr                            httpRequest
// ParseOcrResult                     code
// SaveOcrResult                      postgres                   [creds]
// FinalizeAnalysisStatus             postgres                   [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// TestWebhook
//    → GetMediaToAnalyze
//      → CallOcr
//        → ParseOcrResult
//          → SaveOcrResult
//            → FinalizeAnalysisStatus
// ManualTrigger
//    → GetMediaToAnalyze (↩ loop)
// ScheduleTrigger
//    → GetMediaToAnalyze (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'sPi5BYzQkcIfRIdl',
    name: 'SOCIAL MEDIA ANALYZE',
    active: true,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class SocialMediaAnalyzeWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'social-analyze-test-webhook',
        webhookId: '6a3e7f92-1bc4-4e85-adf3-8c9b2d5e1047',
        name: 'Test Webhook',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1280, 160],
    })
    TestWebhook = {
        httpMethod: 'GET',
        path: 'social-media-analyze-test',
        responseMode: 'onReceived',
        responseCode: 200,
    };

    @node({
        id: 'fa780893-2285-446f-be14-bc3309c167c8',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-1280, -320],
    })
    ManualTrigger = {};

    @node({
        id: 'social-analyze-schedule-trigger',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
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
        id: 'social-analyze-get-media',
        name: 'Get Media To Analyze',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-1056, -320],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    GetMediaToAnalyze = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'post_media',
        },
        query: `SELECT
  pm.id       AS media_id,
  pm.social_post_id,
  pm.storage_path,
  pm.media_index,
  pm.media_type,
  sp.idempot_key
FROM post_media pm
JOIN social_posts sp ON sp.id = pm.social_post_id
WHERE pm.download_status = 'DOWNLOADED'
  AND pm.media_type = 'IMAGE'
  AND pm.relevance_status = 'IMG_DUDOSA'
  AND pm.storage_path IS NOT NULL
ORDER BY sp.processing_priority DESC, pm.id ASC
LIMIT 20;`,
    };

    @node({
        id: 'social-analyze-call-ocr',
        name: 'Call OCR',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-848, -320],
    })
    CallOcr = {
        method: 'POST',
        url: 'http://paddleocr:5000/predict',
        sendBody: true,
        contentType: 'json',
        specifyBody: 'keypair',
        bodyParameters: {
            parameters: [
                {
                    name: 'path',
                    value: '={{ $json.storage_path }}',
                },
            ],
        },
        options: {
            timeout: 120000,
        },
    };

    @node({
        id: 'social-analyze-parse-result',
        name: 'Parse OCR Result',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-640, -320],
    })
    ParseOcrResult = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `// PaddleOCR response: { OCR_LEN, OCR_RAW, OCR_SCORE, resultado }
const results = [];

for (const item of $input.all()) {
  const ocr = item.json;
  let ocr_status = 'OCR_ERROR';
  let error_message = null;
  let ocr_text = '';
  let ocr_confidence = 0;

  if (ocr && typeof ocr.OCR_RAW !== 'undefined') {
    ocr_status = 'OCR_DONE';
    ocr_text = String(ocr.OCR_RAW || '').trim();
    ocr_confidence = Number(ocr.OCR_SCORE) || 0;
  } else {
    error_message = 'Unexpected OCR response: ' + JSON.stringify(ocr).substring(0, 200);
  }

  const has_meaningful_text = ocr_status === 'OCR_DONE' && ocr_text.length > 3;
  const relevance_status = ocr_status === 'OCR_ERROR'
    ? 'IMG_DUDOSA'
    : (has_meaningful_text ? 'IMG_CON_TEXTO' : 'IMG_SIN_TEXTO');
  const relevance_reason = has_meaningful_text
    ? ('Texto detectado por PaddleOCR: ' + ocr_text.substring(0, 80))
    : (ocr_status === 'OCR_ERROR' ? error_message : 'Sin texto significativo en imagen');

  results.push({
    json: {
      analysis_version: 'v1',
      ocr_status,
      ocr_engine: 'paddle-v1',
      ocr_confidence,
      ocr_text_raw: ocr_text,
      has_meaningful_text,
      provider_payload_json: { OCR_LEN: ocr.OCR_LEN, OCR_RAW: ocr.OCR_RAW, OCR_SCORE: ocr.OCR_SCORE },
      relevance_status,
      relevance_reason: String(relevance_reason || '').substring(0, 500),
      error_message,
    },
  });
}

return results;`,
    };

    @node({
        id: 'social-analyze-save-ocr',
        name: 'Save OCR Result',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-432, -320],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    SaveOcrResult = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'media_ocr',
        },
        query: `WITH ocr_upsert AS (
  INSERT INTO media_ocr (
    post_media_id, analysis_version, ocr_status, ocr_engine,
    ocr_confidence, ocr_text_raw, has_meaningful_text, provider_payload_json,
    processed_at, error_message
  ) VALUES (
    $1::bigint, $2::text, $3::text, $4::text,
    $5::numeric, $6::text, $7::boolean, $8::jsonb,
    NOW(), $9::text
  )
  ON CONFLICT (post_media_id, analysis_version) DO UPDATE SET
    ocr_status            = EXCLUDED.ocr_status,
    ocr_engine            = EXCLUDED.ocr_engine,
    ocr_confidence        = EXCLUDED.ocr_confidence,
    ocr_text_raw          = EXCLUDED.ocr_text_raw,
    has_meaningful_text   = EXCLUDED.has_meaningful_text,
    provider_payload_json = EXCLUDED.provider_payload_json,
    processed_at          = EXCLUDED.processed_at,
    error_message         = EXCLUDED.error_message,
    updated_at            = NOW()
  RETURNING id AS ocr_id, post_media_id
)
UPDATE post_media pm SET
  relevance_status = $10::text,
  relevance_reason = $11::text,
  updated_at = NOW()
FROM ocr_upsert oi
WHERE pm.id = oi.post_media_id
RETURNING pm.id AS media_id, pm.social_post_id, pm.relevance_status, oi.ocr_id;`,
        options: {
            queryReplacement:
                '={{ [$("Get Media To Analyze").item.json.media_id, $json.analysis_version, $json.ocr_status, $json.ocr_engine, $json.ocr_confidence, $json.ocr_text_raw, $json.has_meaningful_text, $json.provider_payload_json, $json.error_message, $json.relevance_status, $json.relevance_reason] }}',
        },
    };

    @node({
        id: 'social-analyze-finalize',
        name: 'Finalize Analysis Status',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-224, -320],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    FinalizeAnalysisStatus = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `WITH post_ocr_summary AS (
  SELECT
    pm.social_post_id,
    COUNT(*) AS total_image_items,
    SUM(CASE WHEN pm.relevance_status = 'IMG_DUDOSA' THEN 1 ELSE 0 END) AS still_pending
  FROM post_media pm
  WHERE pm.download_status = 'DOWNLOADED'
    AND pm.media_type = 'IMAGE'
    AND pm.social_post_id IN (
      SELECT id FROM social_posts
      WHERE analysis_status = 'PEND_ANALISIS' AND media_status = 'MEDIA_DONE'
    )
  GROUP BY pm.social_post_id
  HAVING SUM(CASE WHEN pm.relevance_status = 'IMG_DUDOSA' THEN 1 ELSE 0 END) = 0
)
UPDATE social_posts sp SET
  analysis_status = 'OCR_DONE',
  updated_at = NOW()
FROM post_ocr_summary pos
WHERE sp.id = pos.social_post_id
  AND sp.analysis_status = 'PEND_ANALISIS'
RETURNING sp.id AS post_id, sp.idempot_key, sp.analysis_status, pos.total_image_items;`,
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.TestWebhook.out(0).to(this.GetMediaToAnalyze.in(0));
        this.ManualTrigger.out(0).to(this.GetMediaToAnalyze.in(0));
        this.ScheduleTrigger.out(0).to(this.GetMediaToAnalyze.in(0));
        this.GetMediaToAnalyze.out(0).to(this.CallOcr.in(0));
        this.CallOcr.out(0).to(this.ParseOcrResult.in(0));
        this.ParseOcrResult.out(0).to(this.SaveOcrResult.in(0));
        this.SaveOcrResult.out(0).to(this.FinalizeAnalysisStatus.in(0));
    }
}
