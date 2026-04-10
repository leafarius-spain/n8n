import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SOCIAL MEDIA PREPARE DOWNLOAD
// Nodes   : 10  |  Connections: 9
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// TestWebhook                        webhook
// ManualTrigger                      manualTrigger
// ScheduleTrigger                    scheduleTrigger
// GetAndLockPosts                    postgres                   [creds]
// BuildMediaTasks                    code
// RegisterMediaRow                   postgres                   [creds]
// DownloadMediaHttp                  httpRequest
// WriteMediaFile                     readWriteFile
// UpdateMediaDownload                postgres                   [creds]
// FinalizePostsStatus                postgres                   [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// TestWebhook
//    → GetAndLockPosts
//      → BuildMediaTasks
//        → RegisterMediaRow
//          → DownloadMediaHttp
//            → WriteMediaFile
//              → UpdateMediaDownload
//                → FinalizePostsStatus
// ManualTrigger
//    → GetAndLockPosts (↩ loop)
// ScheduleTrigger
//    → GetAndLockPosts (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'Vr4f9GrXTrYIIEtp',
    name: 'SOCIAL MEDIA PREPARE DOWNLOAD',
    active: true,
    settings: {
        errorWorkflow: 'IkqnFDu34CjPjXBj',
        timezone: 'Europe/Madrid',
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
    },
})
export class SocialMediaPrepareDownloadWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'social-media-test-webhook',
        webhookId: '455241b6-afbd-4d7b-a69d-947d0d7b5964',
        name: 'Test Webhook',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1280, 160],
    })
    TestWebhook = {
        httpMethod: 'GET',
        path: 'social-media-prepare-download-test',
        responseMode: 'onReceived',
        responseCode: 200,
    };

    @node({
        id: 'social-media-manual-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-1280, -320],
    })
    ManualTrigger = {};

    @node({
        id: 'social-media-schedule-trigger',
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
        id: 'social-media-get-lock-posts',
        name: 'Get And Lock Posts',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-1040, -200],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    GetAndLockPosts = {
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
SET media_status = 'MEDIA_PROCESSING', updated_at = NOW()
WHERE id IN (
  SELECT id FROM social_posts
  WHERE media_status = 'MEDIA_PENDING'
    AND media_count_total > 0
    AND media_items_json IS NOT NULL
    AND jsonb_array_length(media_items_json) > 0
  ORDER BY processing_priority DESC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 20
)
RETURNING
  id AS social_post_id,
  idempot_key,
  media_items_json,
  (SELECT code FROM sources WHERE id = source_id) AS source_code,
  (SELECT COALESCE(NULLIF(account_handle, ''), NULLIF(account_url, ''), 'unknown')
   FROM publisher_accounts WHERE id = publisher_account_id) AS account_identifier,
  COALESCE(EXTRACT(YEAR FROM published_at)::integer, EXTRACT(YEAR FROM NOW())::integer) AS pub_year,
  COALESCE(EXTRACT(MONTH FROM published_at)::integer, EXTRACT(MONTH FROM NOW())::integer) AS pub_month;`,
        options: {},
    };

    @node({
        id: 'social-media-build-tasks',
        name: 'Build Media Tasks',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-784, -200],
    })
    BuildMediaTasks = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `const storageBase = '/datos/social-media/downloads';

function extFromUrl(url) {
  try {
    const pathname = new URL(String(url)).pathname;
    const lastDot = pathname.lastIndexOf('.');
    if (lastDot > 0) {
      const ext = pathname.slice(lastDot + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi'].includes(ext)) {
        return ext === 'jpeg' ? 'jpg' : ext;
      }
    }
  } catch (err) {}
  return 'jpg';
}

const items = $input.all();
const tasks = [];

for (const item of items) {
  const { social_post_id, idempot_key, media_items_json } = item.json;

  let mediaItems = [];
  try {
    mediaItems = Array.isArray(media_items_json) ? media_items_json : JSON.parse(media_items_json || '[]');
  } catch (err) {
    mediaItems = [];
  }

  if (!mediaItems.length) continue;

  for (const mediaItem of mediaItems) {
    const ext = extFromUrl(mediaItem.source_url || '');
    // Flat filename: {idempot_key}__idx{media_index}__{media_type}.{ext}
    // idempot_key may contain special chars — sanitize to filesystem-safe
    const safeKey = String(idempot_key || social_post_id).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const fileName = safeKey + '__idx' + mediaItem.media_index + '__' + (mediaItem.media_type || 'IMAGE') + '.' + ext;
    tasks.push({
      social_post_id,
      media_index: mediaItem.media_index,
      media_type: mediaItem.media_type || 'IMAGE',
      source_url: mediaItem.source_url || '',
      normalized_source_url: mediaItem.normalized_source_url || mediaItem.source_url || '',
      storage_path: storageBase + '/' + fileName,
    });
  }
}

if (!tasks.length) {
  return []; // no items = stop execution cleanly at this node
}

return tasks.map((t) => ({ json: t }));`,
    };

    @node({
        id: 'social-media-register-row',
        name: 'Register Media Row',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-528, -200],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    RegisterMediaRow = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'post_media',
        },
        query: `INSERT INTO post_media (social_post_id, media_index, media_type, source_url, normalized_source_url, download_status)
VALUES ($1::bigint, $2::integer, $3::text, $4::text, $5::text, 'MEDIA_PENDING')
ON CONFLICT (social_post_id, media_index) DO UPDATE SET
  source_url = EXCLUDED.source_url,
  normalized_source_url = EXCLUDED.normalized_source_url,
  updated_at = NOW()
RETURNING
  id AS media_id,
  social_post_id,
  media_index,
  media_type,
  source_url,
  $6::text AS storage_path;`,
        options: {
            queryReplacement:
                '={{ [$json.social_post_id, $json.media_index, $json.media_type, $json.source_url, $json.normalized_source_url, $json.storage_path] }}',
        },
    };

    @node({
        id: 'social-media-download-http',
        name: 'Download Media HTTP',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-256, -200],
    })
    DownloadMediaHttp = {
        method: 'GET',
        url: '={{ $json.source_url }}',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'User-Agent',
                    value: 'Mozilla/5.0 (compatible; social-ingest/1.0)',
                },
            ],
        },
        options: {
            response: {
                response: {
                    responseFormat: 'file',
                    outputPropertyName: 'download_data',
                },
            },
            redirect: {
                redirect: {
                    followRedirects: true,
                    maxRedirects: 10,
                },
            },
            timeout: 60000,
        },
    };

    @node({
        id: 'social-media-write-file',
        name: 'Write Media File',
        type: 'n8n-nodes-base.readWriteFile',
        version: 1.1,
        position: [16, -200],
    })
    WriteMediaFile = {
        operation: 'write',
        fileName: '={{ $("Register Media Row").item.json.storage_path }}',
        dataPropertyName: 'download_data',
    };

    @node({
        id: 'social-media-update-download',
        name: 'Update Media Download',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [288, -200],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    UpdateMediaDownload = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'post_media',
        },
        query: `UPDATE post_media SET
  download_status = $2::text,
  storage_path = CASE WHEN $2 = 'DOWNLOADED' THEN $3::text ELSE storage_path END,
  file_size = CASE WHEN $2 = 'DOWNLOADED' THEN $4::bigint ELSE file_size END,
  downloaded_at = CASE WHEN $2 = 'DOWNLOADED' THEN NOW() ELSE downloaded_at END,
  updated_at = NOW()
WHERE id = $1::bigint
RETURNING id AS media_id, social_post_id, download_status;`,
        options: {
            queryReplacement: '={{ [$("Register Media Row").item.json.media_id, \'DOWNLOADED\', $json.fileName, 0] }}',
        },
    };

    @node({
        id: 'social-media-finalize-status',
        name: 'Finalize Posts Status',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [560, -200],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    FinalizePostsStatus = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'social_posts',
        },
        query: `WITH post_summary AS (
  SELECT
    pm.social_post_id,
    COUNT(*) AS total_items,
    SUM(CASE WHEN pm.download_status = 'DOWNLOADED' THEN 1 ELSE 0 END) AS downloaded_count,
    SUM(CASE WHEN pm.download_status = 'DOWNLOAD_ERROR' THEN 1 ELSE 0 END) AS error_count
  FROM post_media pm
  WHERE pm.social_post_id IN (
    SELECT id FROM social_posts WHERE media_status = 'MEDIA_PROCESSING'
  )
  GROUP BY pm.social_post_id
  HAVING COUNT(*) = SUM(CASE WHEN pm.download_status IN ('DOWNLOADED', 'DOWNLOAD_ERROR') THEN 1 ELSE 0 END)
)
UPDATE social_posts sp SET
  media_status = CASE
    WHEN ps.downloaded_count = 0 THEN 'MEDIA_ERROR'
    WHEN ps.error_count > 0 THEN 'MEDIA_PARTIAL'
    ELSE 'MEDIA_DONE'
  END,
  updated_at = NOW()
FROM post_summary ps
WHERE sp.id = ps.social_post_id
  AND sp.media_status = 'MEDIA_PROCESSING'
RETURNING sp.id AS post_id, sp.media_status, ps.total_items, ps.downloaded_count, ps.error_count;`,
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.TestWebhook.out(0).to(this.GetAndLockPosts.in(0));
        this.ManualTrigger.out(0).to(this.GetAndLockPosts.in(0));
        this.ScheduleTrigger.out(0).to(this.GetAndLockPosts.in(0));
        this.GetAndLockPosts.out(0).to(this.BuildMediaTasks.in(0));
        this.BuildMediaTasks.out(0).to(this.RegisterMediaRow.in(0));
        this.RegisterMediaRow.out(0).to(this.DownloadMediaHttp.in(0));
        this.DownloadMediaHttp.out(0).to(this.WriteMediaFile.in(0));
        this.WriteMediaFile.out(0).to(this.UpdateMediaDownload.in(0));
        this.UpdateMediaDownload.out(0).to(this.FinalizePostsStatus.in(0));
    }
}
