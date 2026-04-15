import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : 70 SOCIAL REPROCESS ADMIN
// Nodes   : 11  |  Connections: 12
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ReprocessWebhook                   webhook
// ValidateInput                      code
// ResolvePostIds                     postgres                   [creds]
// RouteByMode                        switch
// ApplyResetFull                     postgres                   [creds]
// ApplyResetDetection                postgres                   [creds]
// ApplyResetExport                   postgres                   [creds]
// LogReprocess                       postgres                   [creds]
// RespondOk                          respondToWebhook
// CheckValid                         if
// RespondError                       respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ReprocessWebhook
//    → ValidateInput
//      → CheckValid
//        → ResolvePostIds
//          → RouteByMode
//            → ApplyResetFull
//              → LogReprocess
//                → RespondOk
//           .out(1) → ApplyResetDetection
//              → LogReprocess (↩ loop)
//           .out(2) → ApplyResetExport
//              → LogReprocess (↩ loop)
//       .out(1) → RespondError
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'bXCOUsi00u5wFJUh',
    name: '70 SOCIAL REPROCESS ADMIN',
    active: true,
    settings: {
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
        binaryMode: 'separate',
    },
})
export class _70SocialReprocessAdminWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'reprocess-webhook',
        webhookId: '7b9544a6-b15d-4d42-94d7-e2731fb6828c',
        name: 'Reprocess Webhook',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-800, 0],
    })
    ReprocessWebhook = {
        path: 'social-reprocess',
        httpMethod: 'POST',
        responseMode: 'responseNode',
        options: {},
    };

    @node({
        id: 'reprocess-validate',
        name: 'Validate Input',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-560, 0],
    })
    ValidateInput = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `const VALID_MODES = ['REPROCESS_FULL', 'REPROCESS_DETECTION_ONLY', 'REPROCESS_EXPORT_ONLY'];

const body = $input.first().json.body || $input.first().json;
const mode = String(body.mode || '').trim().toUpperCase();

if (!VALID_MODES.includes(mode)) {
  return [{ json: { ok: false, error: 'Invalid mode. Must be one of: ' + VALID_MODES.join(', '), received: body.mode } }];
}

const hasFilter = body.social_post_id || body.idempot_key || body.ayto_id
                  || body.date_from || body.date_to || body.analysis_version;
if (!hasFilter) {
  return [{ json: { ok: false, error: 'At least one filter is required (social_post_id, idempot_key, ayto_id, date_from/date_to, analysis_version)' } }];
}

return [{ json: {
  ok: true,
  mode,
  social_post_id: body.social_post_id ? Number(body.social_post_id) : null,
  idempot_key:    body.idempot_key    ? String(body.idempot_key)    : null,
  ayto_id:        body.ayto_id        ? String(body.ayto_id)        : null,
  date_from:      body.date_from      ? String(body.date_from)      : null,
  date_to:        body.date_to        ? String(body.date_to)        : null,
  analysis_version: body.analysis_version ? String(body.analysis_version) : null,
} }];`,
    };

    @node({
        id: 'reprocess-resolve',
        name: 'Resolve Post IDs',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-280, -80],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    ResolvePostIds = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `SELECT sp.id AS social_post_id, sp.idempot_key, sp.analysis_status,
  COALESCE((SELECT ayto_id FROM publisher_accounts WHERE id = sp.publisher_account_id), '') AS ayto_id
FROM social_posts sp
WHERE 1=1
  AND ($1::bigint  IS NULL OR sp.id = $1::bigint)
  AND ($2::text    IS NULL OR sp.idempot_key = $2)
  AND ($3::text    IS NULL OR EXISTS (
        SELECT 1 FROM publisher_accounts pa
        WHERE pa.id = sp.publisher_account_id AND pa.ayto_id = $3))
  AND ($4::date    IS NULL OR sp.published_at::date >= $4::date)
  AND ($5::date    IS NULL OR sp.published_at::date <= $5::date)
  AND ($6::text    IS NULL OR EXISTS (
        SELECT 1 FROM post_analysis pa
        WHERE pa.social_post_id = sp.id AND pa.analysis_version = $6))
ORDER BY sp.id
LIMIT 500;`,
        options: {
            queryReplacement: `={{ [
  $json.social_post_id,
  $json.idempot_key,
  $json.ayto_id,
  $json.date_from,
  $json.date_to,
  $json.analysis_version
] }}`,
        },
    };

    @node({
        id: 'reprocess-route-by-mode',
        name: 'Route By Mode',
        type: 'n8n-nodes-base.switch',
        version: 3.2,
        position: [-60, -80],
    })
    RouteByMode = {
        mode: 'rules',
        looseTypeValidation: true,
        rules: {
            values: [
                {
                    conditions: {
                        options: {
                            caseSensitive: false,
                            leftValue: '',
                            typeValidation: 'loose',
                        },
                        combinator: 'and',
                        conditions: [
                            {
                                id: 'cond-full',
                                leftValue: "={{ $('Validate Input').first().json.mode }}",
                                rightValue: 'REPROCESS_FULL',
                                operator: {
                                    type: 'string',
                                    operation: 'equals',
                                },
                            },
                        ],
                    },
                    renameOutput: false,
                },
                {
                    conditions: {
                        options: {
                            caseSensitive: false,
                            leftValue: '',
                            typeValidation: 'loose',
                        },
                        combinator: 'and',
                        conditions: [
                            {
                                id: 'cond-detect',
                                leftValue: "={{ $('Validate Input').first().json.mode }}",
                                rightValue: 'REPROCESS_DETECTION_ONLY',
                                operator: {
                                    type: 'string',
                                    operation: 'equals',
                                },
                            },
                        ],
                    },
                    renameOutput: false,
                },
                {
                    conditions: {
                        options: {
                            caseSensitive: false,
                            leftValue: '',
                            typeValidation: 'loose',
                        },
                        combinator: 'and',
                        conditions: [
                            {
                                id: 'cond-export',
                                leftValue: "={{ $('Validate Input').first().json.mode }}",
                                rightValue: 'REPROCESS_EXPORT_ONLY',
                                operator: {
                                    type: 'string',
                                    operation: 'equals',
                                },
                            },
                        ],
                    },
                    renameOutput: false,
                },
            ],
        },
        options: {},
    };

    @node({
        id: 'reprocess-reset-full',
        name: 'Apply Reset Full',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [0, -240],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    ApplyResetFull = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `WITH ids AS (
  SELECT (json_array_elements($1::json) #>> '{}')::bigint AS id
),
del_candidates AS (
  DELETE FROM candidate_events WHERE social_post_id IN (SELECT id FROM ids) RETURNING 1
),
del_analysis AS (
  DELETE FROM post_analysis WHERE social_post_id IN (SELECT id FROM ids) RETURNING 1
),
upd AS (
  UPDATE social_posts
  SET analysis_status = 'OCR_DONE', updated_at = NOW()
  WHERE id IN (SELECT id FROM ids)
  RETURNING id
)
SELECT COUNT(*) AS posts_reset FROM upd;`,
        options: {
            queryReplacement:
                "={{ [JSON.stringify($('Resolve Post IDs').all().map(i => Number(i.json.social_post_id)))] }}",
        },
    };

    @node({
        id: 'reprocess-reset-detect',
        name: 'Apply Reset Detection',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [0, 0],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    ApplyResetDetection = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `WITH ids AS (
  SELECT (json_array_elements($1::json) #>> '{}')::bigint AS id
),
del_candidates AS (
  DELETE FROM candidate_events WHERE social_post_id IN (SELECT id FROM ids) RETURNING 1
),
del_analysis AS (
  DELETE FROM post_analysis WHERE social_post_id IN (SELECT id FROM ids) RETURNING 1
),
upd AS (
  UPDATE social_posts
  SET analysis_status = 'OCR_DONE', updated_at = NOW()
  WHERE id IN (SELECT id FROM ids)
    AND analysis_status IN ('DETECT_DONE', 'DETECT_PROCESSING')
  RETURNING id
)
SELECT COUNT(*) AS posts_reset FROM upd;`,
        options: {
            queryReplacement:
                "={{ [JSON.stringify($('Resolve Post IDs').all().map(i => Number(i.json.social_post_id)))] }}",
        },
    };

    @node({
        id: 'reprocess-reset-export',
        name: 'Apply Reset Export',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [0, 240],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    ApplyResetExport = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'candidate_events',
        },
        query: `WITH ids AS (
  SELECT (json_array_elements($1::json) #>> '{}')::bigint AS id
)
UPDATE candidate_events
SET sheet_export_status = 'PENDING',
    sheet_export_error  = NULL,
    sheet_exported_at   = NULL,
    updated_at          = NOW()
WHERE social_post_id IN (SELECT id FROM ids)
  AND export_to_sheet = true
  AND sheet_export_status IN ('ERROR', 'PENDING')
RETURNING id, social_post_id, sheet_export_status;`,
        options: {
            queryReplacement:
                "={{ [JSON.stringify($('Resolve Post IDs').all().map(i => Number(i.json.social_post_id)))] }}",
        },
    };

    @node({
        id: 'reprocess-log',
        name: 'Log Reprocess',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [280, 0],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    LogReprocess = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'processing_logs',
        },
        query: `WITH ids AS (
  SELECT (json_array_elements($1::json) #>> '{}')::bigint AS id
)
INSERT INTO processing_logs
  (entity_type, entity_id, workflow_name, phase, status, message, details_json)
SELECT
  'post',
  id,
  'social_reprocess_admin',
  'REPROCESS',
  'SUCCESS',
  $2::text,
  $3::jsonb
FROM ids
RETURNING id;`,
        options: {
            queryReplacement: `={{ [
  JSON.stringify($('Resolve Post IDs').all().map(i => Number(i.json.social_post_id))),
  'Reprocess triggered: mode=' + $('Validate Input').first().json.mode,
  JSON.stringify({ mode: $('Validate Input').first().json.mode, filters: { social_post_id: $('Validate Input').first().json.social_post_id, idempot_key: $('Validate Input').first().json.idempot_key, ayto_id: $('Validate Input').first().json.ayto_id } })
] }}`,
        },
    };

    @node({
        id: 'reprocess-respond-ok',
        name: 'Respond OK',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [520, 0],
    })
    RespondOk = {
        respondWith: 'json',
        responseBody: `={{ JSON.stringify({
  ok: true,
  mode: $('Validate Input').first().json.mode,
  posts_resolved: $('Resolve Post IDs').all().length,
  message: 'Reprocess queued. Trigger social_post_detect_export to re-run detection/export.'
}) }}`,
        options: {
            responseCode: 200,
        },
    };

    @node({
        id: 'reprocess-check-valid',
        name: 'Check Valid',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [-420, 0],
    })
    CheckValid = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
            },
            combinator: 'and',
            conditions: [
                {
                    id: 'ok-check',
                    leftValue: '={{ $json.ok }}',
                    rightValue: true,
                    operator: {
                        type: 'boolean',
                        operation: 'true',
                    },
                },
            ],
        },
    };

    @node({
        id: 'reprocess-respond-error',
        name: 'Respond Error',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [-280, 200],
    })
    RespondError = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ ok: false, error: $json.error, received: $json.received }) }}',
        options: {
            responseCode: 400,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ReprocessWebhook.out(0).to(this.ValidateInput.in(0));
        this.ValidateInput.out(0).to(this.CheckValid.in(0));
        this.CheckValid.out(0).to(this.ResolvePostIds.in(0));
        this.CheckValid.out(1).to(this.RespondError.in(0));
        this.ResolvePostIds.out(0).to(this.RouteByMode.in(0));
        this.RouteByMode.out(0).to(this.ApplyResetFull.in(0));
        this.RouteByMode.out(1).to(this.ApplyResetDetection.in(0));
        this.RouteByMode.out(2).to(this.ApplyResetExport.in(0));
        this.ApplyResetFull.out(0).to(this.LogReprocess.in(0));
        this.ApplyResetDetection.out(0).to(this.LogReprocess.in(0));
        this.ApplyResetExport.out(0).to(this.LogReprocess.in(0));
        this.LogReprocess.out(0).to(this.RespondOk.in(0));
    }
}
