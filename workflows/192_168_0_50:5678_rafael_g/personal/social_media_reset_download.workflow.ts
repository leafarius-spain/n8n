import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : 35 SOCIAL MEDIA RESET DOWNLOAD
// Nodes   : 3  |  Connections: 2
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// FormTrigger                        formTrigger
// SetResetParameters                 set
// ResetByAytoYear                    postgres                   [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// FormTrigger
//    → SetResetParameters
//      → ResetByAytoYear
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'SFKqyb5yDuEfi6nj',
    name: '35 SOCIAL MEDIA RESET DOWNLOAD',
    active: false,
    settings: {
        timezone: 'Europe/Madrid',
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
        binaryMode: 'separate',
    },
})
export class _35SocialMediaResetDownloadWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'social-reset-form-trigger',
        webhookId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'Form Trigger',
        type: 'n8n-nodes-base.formTrigger',
        version: 2.2,
        position: [-896, -96],
    })
    FormTrigger = {
        formTitle: 'Reset Media Download',
        formDescription: 'Resetea el estado de descarga de posts para un ayuntamiento y año',
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
            ],
        },
        responseMode: 'onReceived',
        options: {},
    };

    @node({
        id: 'social-reset-set-params',
        name: 'Set Reset Parameters',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [-672, -96],
    })
    SetResetParameters = {
        mode: 'manual',
        assignments: {
            assignments: [
                {
                    id: '1',
                    name: 'ayto_id',
                    value: '={{ $json.ayto_id }}',
                    type: 'string',
                },
                {
                    id: '2',
                    name: 'year',
                    value: '={{ $json.year }}',
                    type: 'string',
                },
            ],
        },
        options: {},
    };

    @node({
        id: 'social-reset-ayto-year',
        name: 'Reset By Ayto + Year',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-448, -96],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    ResetByAytoYear = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `WITH validated_input AS (
  SELECT
    LOWER(NULLIF($1::text, '')) AS ayto_id,
    NULLIF($2::text, '')::int AS year_val
  WHERE $1 IS NOT NULL
    AND $2 IS NOT NULL
    AND $1::text != ''
    AND $2::text ~ '^\\d{4}$'
), affected AS (
  SELECT sp.id, sp.idempot_key
  FROM social_posts sp
  JOIN publisher_accounts pa ON sp.publisher_account_id = pa.id
  CROSS JOIN validated_input vi
  WHERE vi.ayto_id IS NOT NULL
    AND vi.year_val IS NOT NULL
    AND LOWER(pa.ayto_id) = vi.ayto_id
    AND sp.published_at IS NOT NULL
    AND EXTRACT(YEAR FROM sp.published_at)::int = vi.year_val
  FOR UPDATE SKIP LOCKED
), updated AS (
  UPDATE social_posts
  SET media_status = 'MEDIA_PENDING', updated_at = NOW()
  FROM affected a
  WHERE social_posts.id = a.id
  RETURNING social_posts.id, social_posts.idempot_key
), reset_media AS (
  UPDATE post_media pm
  SET download_status = 'MEDIA_PENDING', downloaded_at = NULL, file_size = NULL, storage_path = NULL, updated_at = NOW()
  FROM updated u
  WHERE pm.social_post_id = u.id
  RETURNING pm.id
)
SELECT
  (SELECT COUNT(*) FROM affected) AS posts_matched,
  (SELECT COUNT(*) FROM updated) AS posts_reset,
  (SELECT COUNT(*) FROM reset_media) AS media_rows_reset;`,
        options: {
            queryReplacement: '={{ [$json.ayto_id, $json.year] }}',
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.FormTrigger.out(0).to(this.SetResetParameters.in(0));
        this.SetResetParameters.out(0).to(this.ResetByAytoYear.in(0));
    }
}
