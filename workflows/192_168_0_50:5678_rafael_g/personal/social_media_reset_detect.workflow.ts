import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : 51 SOCIAL MEDIA RESET DETECT
// Nodes   : 4  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// FormTrigger                        formTrigger
// RouteByDryrun                      if
// DryRunPreview                      postgres                   [creds]
// ExecuteReset                       postgres                   [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// FormTrigger
//    → RouteByDryrun
//      → DryRunPreview
//     .out(1) → ExecuteReset
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: '02MdZuxNLWx1jQW4',
    name: '51 SOCIAL MEDIA RESET DETECT',
    active: false,
    settings: {
        timezone: 'Europe/Madrid',
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
    },
})
export class _51SocialMediaResetDetectWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'reset-detect-form-trigger',
        webhookId: 'c5d6e7f8-9012-3456-abcd-ef0123456751',
        name: 'Form Trigger',
        type: 'n8n-nodes-base.formTrigger',
        version: 2.2,
        position: [-896, -96],
    })
    FormTrigger = {
        formTitle: 'Reset Detect (re-clasificar)',
        formDescription:
            'Deshace la clasificación (candidate_events + post_analysis v1) de un ayuntamiento y año. Los posts vuelven a OCR_DONE para que el workflow 50 los re-clasifique. NO toca OCR, media, ni ficheros en disco.',
        formFields: {
            values: [
                {
                    fieldLabel: 'ayto_id',
                    fieldType: 'dropdown',
                    requiredField: true,
                    fieldOptions: {
                        values: [
                            {
                                option: 'SantaFedeMondujar',
                            },
                        ],
                    },
                },
                {
                    fieldLabel: 'year',
                    fieldType: 'dropdown',
                    requiredField: true,
                    fieldOptions: {
                        values: [
                            {
                                option: '2024',
                            },
                            {
                                option: '2025',
                            },
                            {
                                option: '2026',
                            },
                        ],
                    },
                },
                {
                    fieldLabel: 'dry_run',
                    fieldType: 'dropdown',
                    requiredField: true,
                    fieldOptions: {
                        values: [
                            {
                                option: 'true',
                            },
                            {
                                option: 'false',
                            },
                        ],
                    },
                },
            ],
        },
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        id: 'reset-detect-route-dryrun',
        name: 'Route By DryRun',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [-672, -96],
    })
    RouteByDryrun = {
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
                    leftValue: '={{ $json.dry_run }}',
                    rightValue: 'true',
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
        id: 'reset-detect-dry-run-preview',
        name: 'Dry Run Preview',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-448, -208],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    DryRunPreview = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `WITH validated AS (
  SELECT
    LOWER(NULLIF($1::text, '')) AS ayto_id_norm,
    NULLIF($2::text, '')::int   AS year_val
  WHERE $1 IS NOT NULL AND $2 IS NOT NULL
    AND $1::text != '' AND $2::text ~ '^\\d{4}$'
),
affected AS (
  SELECT sp.id
  FROM social_posts sp
  JOIN publisher_accounts pa ON pa.id = sp.publisher_account_id
  CROSS JOIN validated v
  WHERE v.ayto_id_norm IS NOT NULL
    AND v.year_val IS NOT NULL
    AND LOWER(pa.ayto_id) = v.ayto_id_norm
    AND sp.published_at IS NOT NULL
    AND EXTRACT(YEAR FROM sp.published_at)::int = v.year_val
    AND sp.analysis_status IN ('DETECT_REVIEW', 'DETECT_DONE', 'DETECT_PROCESSING')
)
SELECT
  true AS dry_run,
  (SELECT COUNT(*) FROM affected)::bigint AS total_posts_reset,
  (SELECT COUNT(*) FROM candidate_events
    WHERE social_post_id IN (SELECT id FROM affected))::bigint AS total_candidate_events_deleted,
  (SELECT COUNT(*) FROM post_analysis
    WHERE social_post_id IN (SELECT id FROM affected)
      AND analysis_version = 'v1')::bigint AS total_post_analysis_deleted;`,
        options: {
            queryReplacement: '={{ [$json.ayto_id, $json.year] }}',
        },
    };

    @node({
        id: 'reset-detect-execute',
        name: 'Execute Reset',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-448, 16],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    ExecuteReset = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `WITH validated AS (
  SELECT
    LOWER(NULLIF($1::text, '')) AS ayto_id_norm,
    NULLIF($2::text, '')::int   AS year_val
  WHERE $1 IS NOT NULL AND $2 IS NOT NULL
    AND $1::text != '' AND $2::text ~ '^\\d{4}$'
),
affected AS (
  SELECT sp.id
  FROM social_posts sp
  JOIN publisher_accounts pa ON pa.id = sp.publisher_account_id
  CROSS JOIN validated v
  WHERE v.ayto_id_norm IS NOT NULL
    AND v.year_val IS NOT NULL
    AND LOWER(pa.ayto_id) = v.ayto_id_norm
    AND sp.published_at IS NOT NULL
    AND EXTRACT(YEAR FROM sp.published_at)::int = v.year_val
    AND sp.analysis_status IN ('DETECT_REVIEW', 'DETECT_DONE', 'DETECT_PROCESSING')
  FOR UPDATE SKIP LOCKED
),
deleted_candidates AS (
  DELETE FROM candidate_events
  WHERE social_post_id IN (SELECT id FROM affected)
  RETURNING id
),
deleted_analysis AS (
  DELETE FROM post_analysis
  WHERE social_post_id IN (SELECT id FROM affected)
    AND analysis_version = 'v1'
  RETURNING id
),
reset_posts AS (
  UPDATE social_posts
  SET analysis_status = 'OCR_DONE', updated_at = NOW()
  FROM affected a
  WHERE social_posts.id = a.id
  RETURNING social_posts.id
)
SELECT
  false AS dry_run,
  (SELECT COUNT(*) FROM reset_posts)::bigint AS total_posts_reset,
  (SELECT COUNT(*) FROM deleted_candidates)::bigint AS total_candidate_events_deleted,
  (SELECT COUNT(*) FROM deleted_analysis)::bigint AS total_post_analysis_deleted;`,
        options: {
            queryReplacement: '={{ [$json.ayto_id, $json.year] }}',
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.FormTrigger.out(0).to(this.RouteByDryrun.in(0));
        this.RouteByDryrun.out(0).to(this.DryRunPreview.in(0));
        this.RouteByDryrun.out(1).to(this.ExecuteReset.in(0));
    }
}
