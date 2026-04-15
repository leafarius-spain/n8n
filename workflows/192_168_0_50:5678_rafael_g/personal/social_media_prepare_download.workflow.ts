import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : 30 SOCIAL MEDIA PREPARE DOWNLOAD
// Nodes   : 18  |  Connections: 19
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// TestWebhook                        webhook
// ManualTrigger                      manualTrigger
// ScheduleTrigger                    scheduleTrigger
// GetAndLockPosts                    postgres                   [creds]
// BuildMediaTasks                    code
// LoopMediaBatches                   splitInBatches
// RegisterMediaRow                   postgres                   [creds]
// ReadCachedMediaFile                readBinaryFile             [onError→out(1)]
// BuildCacheHitMeta                  code
// DownloadMediaHttp                  httpRequest                [onError→out(1)]
// MarkDownloadError                  postgres                   [creds]
// EnsureMediaDirectory               executeCommand
// ReattachDownloadBinary             code                       [onError→out(1)]
// WriteMediaFile                     readWriteFile
// UpdateMediaDownload                postgres                   [creds]
// FinalizePostsStatus                postgres                   [creds]
// ExecutionData                      executionData
// StickyNote                         stickyNote
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// TestWebhook
//    → GetAndLockPosts
//      → BuildMediaTasks
//        → LoopMediaBatches
//         .out(1) → RegisterMediaRow
//            → ReadCachedMediaFile
//              → BuildCacheHitMeta
//                → UpdateMediaDownload
//                  → FinalizePostsStatus
//                    → LoopMediaBatches (↩ loop)
//             .out(1) → DownloadMediaHttp
//                → EnsureMediaDirectory
//                  → ReattachDownloadBinary
//                    → WriteMediaFile
//                      → UpdateMediaDownload (↩ loop)
//                   .out(1) → MarkDownloadError
//                      → FinalizePostsStatus (↩ loop)
//               .out(1) → MarkDownloadError (↩ loop)
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
    name: '30 SOCIAL MEDIA PREPARE DOWNLOAD',
    active: false,
    settings: {
        errorWorkflow: 'IkqnFDu34CjPjXBj',
        timezone: 'Europe/Madrid',
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
        binaryMode: 'separate',
    },
})
export class _30SocialMediaPrepareDownloadWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'social-media-test-webhook',
        webhookId: '455241b6-afbd-4d7b-a69d-947d0d7b5964',
        name: 'Test Webhook',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-1280, 80],
    })
    TestWebhook = {
        path: 'social-media-prepare-download-test',
        options: {},
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
        position: [-1280, -128],
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
        position: [-1056, -128],
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
        query: `WITH locked AS (
  UPDATE social_posts
  SET media_status = 'MEDIA_PROCESSING', updated_at = NOW()
  WHERE id IN (
    SELECT id FROM social_posts
    WHERE media_status = 'MEDIA_PENDING'
      AND (
        (media_count_total > 0
         AND media_items_json IS NOT NULL
         AND jsonb_array_length(media_items_json) > 0)
        OR (NULLIF(bd_post_external_link, '') IS NOT NULL)
      )
    ORDER BY processing_priority DESC, created_at ASC
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    id AS social_post_id,
    idempot_key,
    media_items_json,
    publisher_account_id,
    source_id,
    published_at,
    bd_post_external_link,
    bd_post_external_title
),
skip_videos AS (
  UPDATE post_media
  SET download_status = 'LINK_ONLY', updated_at = NOW()
  WHERE social_post_id IN (SELECT social_post_id FROM locked)
    AND UPPER(COALESCE(media_type, '')) LIKE '%VIDEO%'
    AND download_status = 'MEDIA_PENDING'
  RETURNING 1
)
SELECT
  l.social_post_id,
  l.idempot_key,
  l.media_items_json,
  COALESCE((SELECT ayto_id FROM publisher_accounts WHERE id = l.publisher_account_id), '') AS ayto_id,
  (SELECT code FROM sources WHERE id = l.source_id) AS source_code,
  (SELECT COALESCE(NULLIF(account_handle, ''), NULLIF(account_url, ''), 'unknown')
   FROM publisher_accounts WHERE id = l.publisher_account_id) AS account_identifier,
  COALESCE(EXTRACT(YEAR FROM l.published_at)::integer, EXTRACT(YEAR FROM NOW())::integer) AS pub_year,
  COALESCE(EXTRACT(MONTH FROM l.published_at)::integer, EXTRACT(MONTH FROM NOW())::integer) AS pub_month,
  NULLIF(l.bd_post_external_link, '') AS external_link,
  NULLIF(l.bd_post_external_title, '') AS external_title,
  (SELECT COUNT(*) FROM skip_videos) AS videos_marked_link_only
FROM locked l;`,
        options: {},
    };

    @node({
        id: 'social-media-build-tasks',
        name: 'Build Media Tasks',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-832, -128],
    })
    BuildMediaTasks = {
        jsCode: `const storageBase = '/srv/storage/redessociales';

function safeSegment(value, fallback = 'unknown') {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || fallback;
}

function extFromUrl(url, mediaType) {
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
    if (String(mediaType || '').toUpperCase().includes('VIDEO')) {
        return 'mp4';
    }
  return 'jpg';
}

function detectExternalMediaType(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes('.pdf') || u.includes('drive.google')) return 'EXTERNAL_PDF';
  const imgRe = new RegExp('[.](jpg|jpeg|png|gif|webp|bmp|svg)([?]|$)', 'i');
  if (imgRe.test(u)) return 'EXTERNAL_IMAGE';
  return null;
}

function normalizeDownloadUrl(url) {
  if (!url) return url;
  // Google Drive: transform view/preview URLs to direct download
  const m1 = String(url).match(/drive\\.google\\.com\\/file\\/d\\/([^\\/?#]+)/i);
  if (m1) return 'https://drive.google.com/uc?export=download&id=' + m1[1];
  const m2 = String(url).match(/drive\\.google\\.com\\/open\\?id=([^&]+)/i);
  if (m2) return 'https://drive.google.com/uc?export=download&id=' + m2[1];
  return url;
}

function extFromExternalUrl(url, mediaType) {
  if (mediaType === 'EXTERNAL_PDF') return 'pdf';
  if (mediaType === 'EXTERNAL_IMAGE') {
    try {
      const pathname = new URL(String(url)).pathname;
      const lastDot = pathname.lastIndexOf('.');
      if (lastDot > 0) {
        const ext = pathname.slice(lastDot + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
      }
    } catch (err) {}
    return 'jpg';
  }
  try {
    const pathname = new URL(String(url)).pathname;
    const lastDot = pathname.lastIndexOf('.');
    if (lastDot > 0) return pathname.slice(lastDot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  } catch (err) {}
  return 'bin';
}

const items = $input.all();
const tasks = [];

for (const item of items) {
  const { social_post_id, idempot_key, media_items_json, ayto_id, account_identifier, pub_year, external_link, external_title } = item.json;
  const realAyto = (ayto_id && ayto_id !== 'unknown') ? ayto_id : (account_identifier || '');
  const aytoSegment = safeSegment(realAyto || social_post_id, 'unknown_ayto');
  const yearNumber = Number(pub_year);
  const yearSegment = Number.isFinite(yearNumber) && yearNumber > 2000 ? String(Math.trunc(yearNumber)) : String(new Date().getFullYear());

  let mediaItems = [];
  try {
    mediaItems = Array.isArray(media_items_json) ? media_items_json : JSON.parse(media_items_json || '[]');
  } catch (err) {
    mediaItems = [];
  }

  // Process media items from Bright Data (skip videos — marked LINK_ONLY by GetAndLockPosts)
  for (const mediaItem of mediaItems) {
    const mType = String(mediaItem.media_type || 'IMAGE').toUpperCase();
    if (mType.includes('VIDEO')) continue;
    const ext = extFromUrl(mediaItem.source_url || '', mediaItem.media_type || '');
    const safeKey = String(idempot_key || social_post_id).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const fileName = safeKey + '__idx' + mediaItem.media_index + '__' + (mediaItem.media_type || 'IMAGE') + '.' + ext;
    tasks.push({
      social_post_id,
      media_index: mediaItem.media_index,
      media_type: mediaItem.media_type || 'IMAGE',
      source_url: mediaItem.source_url || '',
      normalized_source_url: mediaItem.normalized_source_url || mediaItem.source_url || '',
      storage_path: storageBase + '/' + aytoSegment + '/' + yearSegment + '/sin_clasificar/' + fileName,
    });
  }

  // Process external link (only PDF or image — skip YouTube, video, shortlinks, web)
  const extMediaType = detectExternalMediaType(external_link);
  if (extMediaType) {
    const ext = extFromExternalUrl(external_link, extMediaType);
    const safeKey = String(idempot_key || social_post_id).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const label = extMediaType === 'EXTERNAL_PDF' ? 'PDF' : 'EXT_IMG';
    const fileName = safeKey + '__ext__' + label + '.' + ext;
    const downloadUrl = normalizeDownloadUrl(external_link);
    tasks.push({
      social_post_id,
      media_index: -1,
      media_type: extMediaType,
      source_url: downloadUrl,
      normalized_source_url: external_link,
      external_title: external_title || '',
      storage_path: storageBase + '/' + aytoSegment + '/' + yearSegment + '/sin_clasificar/' + fileName,
    });
  }
}

if (!tasks.length) {
  return []; // no items = stop execution cleanly at this node
}

return tasks.map((t) => ({ json: t }));`,
    };

    @node({
        id: 'social-media-loop-batches',
        name: 'Loop Media Batches',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [-608, -208],
    })
    LoopMediaBatches = {
        options: {},
    };

    @node({
        id: 'social-media-register-row',
        name: 'Register Media Row',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-384, -112],
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
        id: 'social-media-read-cached-file',
        name: 'Read Cached Media File',
        type: 'n8n-nodes-base.readBinaryFile',
        version: 1,
        position: [-160, -192],
        onError: 'continueErrorOutput',
    })
    ReadCachedMediaFile = {
        filePath: '={{ $json.storage_path }}',
        dataPropertyName: 'cached_data',
    };

    @node({
        id: 'social-media-build-cache-hit-meta',
        name: 'Build Cache Hit Meta',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [736, -384],
    })
    BuildCacheHitMeta = {
        mode: 'runOnceForEachItem',
        jsCode: `const item = $input.item;
const binary = await this.helpers.getBinaryDataBuffer(0, 'cached_data');

return {
  ...item.json,
  fileName: item.json.storage_path,
  file_size: binary.length,
  cache_hit: true,
};`,
    };

    @node({
        id: 'social-media-download-http',
        name: 'Download Media HTTP',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [64, -96],
        onError: 'continueErrorOutput',
    })
    DownloadMediaHttp = {
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
            redirect: {
                redirect: {
                    maxRedirects: 10,
                },
            },
            response: {
                response: {
                    responseFormat: 'file',
                    outputPropertyName: 'download_data',
                },
            },
            timeout: 60000,
        },
    };

    @node({
        id: 'social-media-mark-download-error',
        name: 'Mark Download Error',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [960, -32],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    MarkDownloadError = {
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
  download_status = 'DOWNLOAD_ERROR',
  updated_at = NOW()
WHERE id = $1::bigint
RETURNING id AS media_id, social_post_id, download_status;`,
        options: {
            queryReplacement: "={{ [$('Register Media Row').item.json.media_id] }}",
        },
    };

    @node({
        id: 'social-media-ensure-directory',
        name: 'Ensure Media Directory',
        type: 'n8n-nodes-base.executeCommand',
        version: 1,
        position: [288, -192],
    })
    EnsureMediaDirectory = {
        command:
            '={{ "mkdir -p \\"" + $("Register Media Row").item.json.storage_path.slice(0, $("Register Media Row").item.json.storage_path.lastIndexOf("/")) + "\\"" }}',
    };

    @node({
        id: 'social-media-reattach-download-binary',
        name: 'Reattach Download Binary',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [512, -192],
        onError: 'continueErrorOutput',
    })
    ReattachDownloadBinary = {
        mode: 'runOnceForEachItem',
        jsCode: `const downloaded = $('Download Media HTTP').item;
const binary = downloaded.binary?.download_data;

if (!binary) {
    throw new Error('Missing download_data binary from Download Media HTTP');
}

const mediaType = $json.media_type;
if (mediaType === 'EXTERNAL_PDF') {
    const buf = await this.helpers.getBinaryDataBuffer(0, 'download_data');
    const head = buf.slice(0, 5).toString('latin1');
    if (head !== '%PDF-') {
        const snippet = buf.slice(0, 80).toString('latin1').replace(/[^\\x20-\\x7e]/g, '.');
        throw new Error('Invalid PDF magic bytes (got "' + head + '"). Head: ' + snippet);
    }
}

return {
    json: {
        ...$json,
    },
    binary: {
        download_data: binary,
    },
};`,
    };

    @node({
        id: 'social-media-write-file',
        name: 'Write Media File',
        type: 'n8n-nodes-base.readWriteFile',
        version: 1.1,
        position: [736, -192],
    })
    WriteMediaFile = {
        operation: 'write',
        fileName: '={{ $("Register Media Row").item.json.storage_path }}',
        dataPropertyName: 'download_data',
        options: {},
    };

    @node({
        id: 'social-media-update-download',
        name: 'Update Media Download',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [960, -288],
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
            queryReplacement:
                '={{ [$("Register Media Row").item.json.media_id, \'DOWNLOADED\', ($json.fileName || $("Register Media Row").item.json.storage_path), Number($json.file_size || 0)] }}',
        },
    };

    @node({
        id: 'social-media-finalize-status',
        name: 'Finalize Posts Status',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1184, -48],
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
    SUM(CASE WHEN pm.download_status = 'DOWNLOAD_ERROR' THEN 1 ELSE 0 END) AS error_count,
    SUM(CASE WHEN pm.download_status = 'LINK_ONLY' THEN 1 ELSE 0 END) AS link_only_count
  FROM post_media pm
  WHERE pm.social_post_id IN (
    SELECT id FROM social_posts WHERE media_status = 'MEDIA_PROCESSING'
  )
  GROUP BY pm.social_post_id
  HAVING COUNT(*) = SUM(CASE WHEN pm.download_status IN ('DOWNLOADED', 'DOWNLOAD_ERROR', 'LINK_ONLY') THEN 1 ELSE 0 END)
)
UPDATE social_posts sp SET
  media_status = CASE
    WHEN ps.downloaded_count = 0 AND ps.link_only_count = 0 THEN 'MEDIA_ERROR'
    WHEN ps.error_count > 0 THEN 'MEDIA_PARTIAL'
    ELSE 'MEDIA_DONE'
  END,
  updated_at = NOW()
FROM post_summary ps
WHERE sp.id = ps.social_post_id
  AND sp.media_status = 'MEDIA_PROCESSING'
RETURNING sp.id AS post_id, sp.media_status, ps.total_items, ps.downloaded_count, ps.error_count, ps.link_only_count;`,
        options: {},
    };

    @node({
        id: 'c7c693a3-1a27-49e6-aecd-08a1706e393b',
        name: 'Execution Data',
        type: 'n8n-nodes-base.executionData',
        version: 1.1,
        position: [-1280, 304],
    })
    ExecutionData = {};

    @node({
        id: '8f4ffb4a-38ff-42b2-ab19-f3579b9114cb',
        name: 'Sticky Note',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-240, 336],
    })
    StickyNote = {
        content: 'MEDIA_PENDING',
        height: 200,
        width: 400,
        color: 4,
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
        this.BuildMediaTasks.out(0).to(this.LoopMediaBatches.in(0));
        this.LoopMediaBatches.out(1).to(this.RegisterMediaRow.in(0));
        this.RegisterMediaRow.out(0).to(this.ReadCachedMediaFile.in(0));
        this.ReadCachedMediaFile.out(0).to(this.BuildCacheHitMeta.in(0));
        this.ReadCachedMediaFile.out(1).to(this.DownloadMediaHttp.in(0));
        this.BuildCacheHitMeta.out(0).to(this.UpdateMediaDownload.in(0));
        this.DownloadMediaHttp.out(0).to(this.EnsureMediaDirectory.in(0));
        this.DownloadMediaHttp.out(1).to(this.MarkDownloadError.in(0));
        this.EnsureMediaDirectory.out(0).to(this.ReattachDownloadBinary.in(0));
        this.ReattachDownloadBinary.out(0).to(this.WriteMediaFile.in(0));
        this.ReattachDownloadBinary.out(1).to(this.MarkDownloadError.in(0));
        this.MarkDownloadError.out(0).to(this.FinalizePostsStatus.in(0));
        this.WriteMediaFile.out(0).to(this.UpdateMediaDownload.in(0));
        this.UpdateMediaDownload.out(0).to(this.FinalizePostsStatus.in(0));
        this.FinalizePostsStatus.out(0).to(this.LoopMediaBatches.in(0));
    }
}
