import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : 35 SOCIAL MEDIA RESET DOWNLOAD
// Nodes   : 5  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ManualTrigger                      manualTrigger
// SelectResetMode                    switch
// ResetAllPosts                      postgres                   [creds]
// ResetByAyuntamiento                postgres                   [creds]
// ResetByPostIds                     postgres                   [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ManualTrigger
//    → SelectResetMode
//      → ResetAllPosts
//     .out(1) → ResetByAyuntamiento
//     .out(2) → ResetByPostIds
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
    },
})
export class _35SocialMediaResetDownloadWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'social-reset-manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-896, -96],
    })
    ManualTrigger = {};

    @node({
        id: 'social-reset-set-params',
        name: 'Set Reset Parameters',
        type: 'n8n-nodes-base.set',
        version: 3.4,
        position: [-784, -96],
    })
    SetResetParameters = {
        keepOnlySet: true,
        values: {
            string: [
                {
                    name: 'mode',
                    value: '={{ $json.mode || "all" }}',
                },
                {
                    name: 'ayto_id',
                    value: '={{ $json.ayto_id || "" }}',
                },
                {
                    name: 'year',
                    value: '={{ $json.year || "" }}',
                },
            ],
            number: [
                {
                    name: 'post_ids',
                    value: '={{ $json.post_ids || [] }}',
                },
            ],
        },
        options: {},
    };

    @node({
        id: 'social-reset-filter',
        name: 'Select Reset Mode',
        type: 'n8n-nodes-base.switch',
        version: 3.1,
        position: [-672, -96],
    })
    SelectResetMode = {
        rules: {
            values: [
                {
                    conditions: {
                        string: [
                            {
                                value1: '={{ $json.mode }}',
                                value2: 'all',
                            },
                        ],
                    },
                    output: 0,
                },
                {
                    conditions: {
                        string: [
                            {
                                value1: '={{ $json.mode }}',
                                value2: 'ayto',
                            },
                        ],
                    },
                    output: 1,
                },
                {
                    conditions: {
                        string: [
                            {
                                value1: '={{ $json.mode }}',
                                value2: 'ayto_year',
                            },
                        ],
                    },
                    output: 2,
                },
                {
                    conditions: {
                        string: [
                            {
                                value1: '={{ $json.mode }}',
                                value2: 'ids',
                            },
                        ],
                    },
                    output: 3,
                },
            ],
        },
    };

    @node({
        id: 'social-reset-all',
        name: 'Reset All Posts',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-448, -272],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    ResetAllPosts = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `WITH updated AS (
  UPDATE social_posts
  SET media_status = 'MEDIA_PENDING', updated_at = NOW()
  WHERE media_status IN ('MEDIA_DONE', 'MEDIA_PARTIAL', 'MEDIA_ERROR', 'MEDIA_PROCESSING')
  RETURNING id, idempot_key
), reset_media AS (
  UPDATE post_media pm
  SET download_status = 'MEDIA_PENDING', downloaded_at = NULL, file_size = NULL, storage_path = NULL, updated_at = NOW()
  FROM updated u
  WHERE pm.social_post_id = u.id
  RETURNING pm.id
)
SELECT
  (SELECT COUNT(*) FROM updated) AS posts_reset,
  (SELECT COUNT(*) FROM reset_media) AS media_rows_reset;`,
        options: {},
    };

    @node({
        id: 'social-reset-ayto',
        name: 'Reset By Ayuntamiento',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-448, -24],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    ResetByAyuntamiento = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `WITH affected AS (
  SELECT sp.id, sp.idempot_key
  FROM social_posts sp
  JOIN publisher_accounts pa ON sp.publisher_account_id = pa.id
  WHERE pa.ayto_id = $1
    AND sp.media_status IN ('MEDIA_DONE', 'MEDIA_PARTIAL', 'MEDIA_ERROR', 'MEDIA_PROCESSING')
  FOR UPDATE SKIP LOCKED
), updated AS (
  UPDATE social_posts
  SET media_status = 'MEDIA_PENDING', updated_at = NOW()
  FROM affected a
  WHERE social_posts.id = a.id
  RETURNING id, idempot_key
), reset_media AS (
  UPDATE post_media pm
  SET download_status = 'MEDIA_PENDING', downloaded_at = NULL, file_size = NULL, storage_path = NULL, updated_at = NOW()
  FROM updated u
  WHERE pm.social_post_id = u.id
  RETURNING pm.id
)
SELECT
  (SELECT COUNT(*) FROM updated) AS posts_reset,
  (SELECT COUNT(*) FROM reset_media) AS media_rows_reset;`,
        options: {
            queryReplacement: '={{ [$json.ayto_id] }}',
        },
    };

    @node({
        id: 'social-reset-ids',
        name: 'Reset By Post IDs',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-448, 224],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    ResetByPostIds = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `WITH affected AS (
  SELECT id, idempot_key
  FROM social_posts
  WHERE id = ANY($1::bigint[])
    AND media_status IN ('MEDIA_DONE', 'MEDIA_PARTIAL', 'MEDIA_ERROR', 'MEDIA_PROCESSING')
  FOR UPDATE SKIP LOCKED
), updated AS (
  UPDATE social_posts
  SET media_status = 'MEDIA_PENDING', updated_at = NOW()
  FROM affected a
  WHERE social_posts.id = a.id
  RETURNING id, idempot_key
), reset_media AS (
  UPDATE post_media pm
  SET download_status = 'MEDIA_PENDING', downloaded_at = NULL, file_size = NULL, storage_path = NULL, updated_at = NOW()
  FROM updated u
  WHERE pm.social_post_id = u.id
  RETURNING pm.id
)
SELECT
  (SELECT COUNT(*) FROM updated) AS posts_reset,
  (SELECT COUNT(*) FROM reset_media) AS media_rows_reset;`,
        options: {
            queryReplacement: '={{ [$json.post_ids] }}',
        },
    };

    @node({
        id: 'social-reset-ayto-year',
        name: 'Reset By Ayto + Year',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-448, 120],
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
        query: `WITH affected AS (
  SELECT sp.id, sp.idempot_key
  FROM social_posts sp
  JOIN publisher_accounts pa ON sp.publisher_account_id = pa.id
  WHERE pa.ayto_id = $1
    AND EXTRACT(YEAR FROM sp.published_at) = $2
    AND sp.media_status IN ('MEDIA_DONE', 'MEDIA_PARTIAL', 'MEDIA_ERROR', 'MEDIA_PROCESSING')
  FOR UPDATE SKIP LOCKED
), updated AS (
  UPDATE social_posts
  SET media_status = 'MEDIA_PENDING', updated_at = NOW()
  FROM affected a
  WHERE social_posts.id = a.id
  RETURNING id, idempot_key
), reset_media AS (
  UPDATE post_media pm
  SET download_status = 'MEDIA_PENDING', downloaded_at = NULL, file_size = NULL, storage_path = NULL, updated_at = NOW()
  FROM updated u
  WHERE pm.social_post_id = u.id
  RETURNING pm.id
)
SELECT
  (SELECT COUNT(*) FROM updated) AS posts_reset,
  (SELECT COUNT(*) FROM reset_media) AS media_rows_reset;`,
        options: {
            queryReplacement: '={{ [$json.ayto_id, Number($json.year)] }}',
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ManualTrigger.out(0).to(this.SetResetParameters.in(0));
        this.SetResetParameters.out(0).to(this.SelectResetMode.in(0));
        this.SelectResetMode.out(0).to(this.ResetAllPosts.in(0));
        this.SelectResetMode.out(1).to(this.ResetByAyuntamiento.in(0));
        this.SelectResetMode.out(2).to(this.ResetByAytoYear.in(0));
        this.SelectResetMode.out(3).to(this.ResetByPostIds.in(0));
    }
}
