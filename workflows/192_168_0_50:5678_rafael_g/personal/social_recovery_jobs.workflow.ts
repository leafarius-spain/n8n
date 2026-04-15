import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : 60 SOCIAL RECOVERY JOBS
// Nodes   : 9  |  Connections: 10
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ScheduleTrigger                    scheduleTrigger
// FindStalledPosts                   postgres                   [creds]
// FindStalledMedia                   postgres                   [creds]
// FindStalledDownloads               postgres                   [creds]
// RecoverStalledDownloads            postgres                   [creds]
// RecoverStalledPosts                postgres                   [creds]
// RecoverStalledMedia                postgres                   [creds]
// LogRecovery                        postgres                   [creds]
// Summary                            code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ScheduleTrigger
//    → FindStalledPosts
//      → RecoverStalledPosts
//        → LogRecovery
//          → Summary
//    → FindStalledMedia
//      → RecoverStalledMedia
//        → Summary (↩ loop)
//    → FindStalledDownloads
//      → RecoverStalledDownloads
//        → Summary (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'RbOs3DSPUdUmekXW',
    name: '60 SOCIAL RECOVERY JOBS',
    active: true,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class _60SocialRecoveryJobsWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'recovery-schedule',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [-800, 0],
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
        id: 'recovery-find-posts',
        name: 'Find Stalled Posts',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-540, -120],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    FindStalledPosts = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `SELECT id AS social_post_id, idempot_key, analysis_status,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 AS stuck_minutes
FROM social_posts
WHERE analysis_status = 'DETECT_PROCESSING'
  AND updated_at < NOW() - INTERVAL '30 minutes'
ORDER BY updated_at ASC
LIMIT 100;`,
        options: {},
    };

    @node({
        id: 'recovery-find-media',
        name: 'Find Stalled Media',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-540, 120],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    FindStalledMedia = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'post_media',
        },
        query: `SELECT pm.id AS post_media_id, pm.social_post_id, pm.download_status,
  COALESCE(mo.ocr_status, 'N/A') AS ocr_status,
  EXTRACT(EPOCH FROM (NOW() - pm.updated_at)) / 60 AS stuck_minutes
FROM post_media pm
LEFT JOIN media_ocr mo ON mo.post_media_id = pm.id
WHERE (
  (pm.download_status = 'DOWNLOAD_PROCESSING' AND pm.updated_at < NOW() - INTERVAL '60 minutes')
  OR (mo.ocr_status IN ('OCR_PROCESSING', 'OCR_QUEUED') AND mo.updated_at < NOW() - INTERVAL '60 minutes')
)
ORDER BY pm.updated_at ASC
LIMIT 200;`,
        options: {},
    };

    @node({
        id: 'recovery-find-stalled-downloads',
        name: 'Find Stalled Downloads',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-540, 320],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    FindStalledDownloads = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `SELECT id AS social_post_id, idempot_key, media_status,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 AS stuck_minutes
FROM social_posts
WHERE media_status = 'MEDIA_PROCESSING'
  AND updated_at < NOW() - INTERVAL '30 minutes'
ORDER BY updated_at ASC
LIMIT 100;`,
        options: {},
    };

    @node({
        id: 'recovery-recover-downloads',
        name: 'Recover Stalled Downloads',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-260, 320],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    RecoverStalledDownloads = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `UPDATE social_posts
SET media_status = 'MEDIA_PENDING', updated_at = NOW()
WHERE id = ANY(
  ARRAY(SELECT (json_array_elements($1::json))::text::bigint)
)
AND media_status = 'MEDIA_PROCESSING'
AND updated_at < NOW() - INTERVAL '30 minutes'
RETURNING id AS social_post_id, media_status AS new_status;`,
        options: {
            queryReplacement: `={{ [
  JSON.stringify(
    $('Find Stalled Downloads').all().length > 0
      ? $('Find Stalled Downloads').all().map(i => i.json.social_post_id)
      : []
  )
] }}`,
        },
    };

    @node({
        id: 'recovery-recover-posts',
        name: 'Recover Stalled Posts',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-260, -120],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    RecoverStalledPosts = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `UPDATE social_posts
SET analysis_status = 'OCR_DONE', updated_at = NOW()
WHERE id = ANY(
  ARRAY(SELECT (json_array_elements($1::json))::text::bigint)
)
AND analysis_status = 'DETECT_PROCESSING'
AND updated_at < NOW() - INTERVAL '30 minutes'
RETURNING id AS social_post_id, analysis_status AS new_status;`,
        options: {
            queryReplacement: `={{ [
  JSON.stringify(
    $('Find Stalled Posts').all().length > 0
      ? $('Find Stalled Posts').all().map(i => i.json.social_post_id)
      : []
  )
] }}`,
        },
    };

    @node({
        id: 'recovery-recover-media',
        name: 'Recover Stalled Media',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-260, 120],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    RecoverStalledMedia = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'post_media',
        },
        query: `DO $$
DECLARE
  v_media_ids bigint[] := ARRAY(
    SELECT (json_array_elements($1::json))::text::bigint
  );
BEGIN
  -- Reset stuck downloads
  UPDATE post_media
  SET download_status = 'MEDIA_PENDING', updated_at = NOW()
  WHERE id = ANY(v_media_ids)
    AND download_status = 'DOWNLOAD_PROCESSING'
    AND updated_at < NOW() - INTERVAL '60 minutes';

  -- Reset stuck OCR
  UPDATE media_ocr
  SET ocr_status = 'OCR_PENDING', updated_at = NOW()
  WHERE post_media_id = ANY(v_media_ids)
    AND ocr_status IN ('OCR_PROCESSING', 'OCR_QUEUED')
    AND updated_at < NOW() - INTERVAL '60 minutes';
END$$;
SELECT COUNT(*) AS media_recovered
FROM post_media
WHERE id = ANY(ARRAY(SELECT (json_array_elements($1::json))::text::bigint))
  AND download_status = 'MEDIA_PENDING';`,
        options: {
            queryReplacement: `={{ [
  JSON.stringify(
    $('Find Stalled Media').all().length > 0
      ? $('Find Stalled Media').all().map(i => i.json.post_media_id)
      : []
  ),
  JSON.stringify(
    $('Find Stalled Media').all().length > 0
      ? $('Find Stalled Media').all().map(i => i.json.post_media_id)
      : []
  )
] }}`,
        },
    };

    @node({
        id: 'recovery-log',
        name: 'Log Recovery',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [20, 0],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    LogRecovery = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'processing_logs',
        },
        query: `INSERT INTO processing_logs
  (entity_type, entity_id, workflow_name, phase, status, message, details_json)
SELECT
  'post',
  sp_id,
  'social_recovery_jobs',
  'REPROCESS',
  'SUCCESS',
  'Auto-recovered stalled post from DETECT_PROCESSING → OCR_DONE',
  $1::jsonb
FROM unnest(ARRAY(
  SELECT (json_array_elements($2::json))::text::bigint
)) AS sp_id
WHERE $3::int > 0
RETURNING id;`,
        options: {
            queryReplacement: `={{ [
  JSON.stringify({ recovered_posts: $('Recover Stalled Posts').all().map(i => i.json.social_post_id) }),
  JSON.stringify($('Find Stalled Posts').all().map(i => i.json.social_post_id)),
  $('Find Stalled Posts').all().length
] }}`,
        },
    };

    @node({
        id: 'recovery-summary',
        name: 'Summary',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [280, 0],
    })
    Summary = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `const stalledPosts = $('Find Stalled Posts').all().length;
const stalledMedia = $('Find Stalled Media').all().length;

// Only log if something was found
if (stalledPosts > 0 || stalledMedia > 0) {
  console.log('[RECOVERY] stalled_posts=' + stalledPosts + ' stalled_media=' + stalledMedia);
}

return [{ json: {
  run_at: new Date().toISOString(),
  stalled_posts_found: stalledPosts,
  stalled_media_found: stalledMedia,
  action: (stalledPosts > 0 || stalledMedia > 0) ? 'RECOVERED' : 'NOTHING_TO_DO',
}}];`,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ScheduleTrigger.out(0).to(this.FindStalledPosts.in(0));
        this.ScheduleTrigger.out(0).to(this.FindStalledMedia.in(0));
        this.ScheduleTrigger.out(0).to(this.FindStalledDownloads.in(0));
        this.FindStalledPosts.out(0).to(this.RecoverStalledPosts.in(0));
        this.FindStalledMedia.out(0).to(this.RecoverStalledMedia.in(0));
        this.RecoverStalledPosts.out(0).to(this.LogRecovery.in(0));
        this.RecoverStalledMedia.out(0).to(this.Summary.in(0));
        this.LogRecovery.out(0).to(this.Summary.in(0));
        this.FindStalledDownloads.out(0).to(this.RecoverStalledDownloads.in(0));
        this.RecoverStalledDownloads.out(0).to(this.Summary.in(0));
    }
}
