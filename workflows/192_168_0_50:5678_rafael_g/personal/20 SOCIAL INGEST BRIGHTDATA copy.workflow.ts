import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : 20 SOCIAL INGEST BRIGHTDATA copy
// Nodes   : 9  |  Connections: 8
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// BrightDataWebhook                  webhook                    
// ManualTrigger                      manualTrigger              
// BuildSampleBrightDataPayload       code                       
// ParseBrightDataEnvelope            code                       
// SplitOutPosts                      splitOut                   
// UpsertSocialPost                   postgres                   [creds]
// SummarizeIngest                    code                       
// FinalizeIngestRun                  postgres                   [creds]
// UpdateLastCapturedPost             postgres                   [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// BrightDataWebhook
//    → ParseBrightDataEnvelope
//      → SplitOutPosts
//        → UpsertSocialPost
//          → SummarizeIngest
//            → FinalizeIngestRun
//              → UpdateLastCapturedPost
// ManualTrigger
//    → BuildSampleBrightDataPayload
//      → ParseBrightDataEnvelope (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: "ivcw7PKBN2oTUQ7s",
    name: "20 SOCIAL INGEST BRIGHTDATA copy",
    active: false,
    settings: { errorWorkflow: "IkqnFDu34CjPjXBj", timezone: "Europe/Madrid", executionOrder: "v1", callerPolicy: "workflowsFromSameOwner", availableInMCP: false, binaryMode: "separate", timeSavedMode: "dynamic" }
})
export class _20SocialIngestBrightdataCopyWorkflow {

    // =====================================================================
// CONFIGURATION DES NOEUDS
// =====================================================================

    @node({
        id: "f35df941-fdc2-4a08-92ab-c3f877ec1a9d",
        webhookId: "092a1010-29ff-41f0-b1f0-c7a2b364aaf4",
        name: "Bright Data Webhook",
        type: "n8n-nodes-base.webhook",
        version: 2.1,
        position: [-1280, -32]
    })
    BrightDataWebhook = {
        responseBinaryPropertyName: "data",
        httpMethod: "POST",
        path: "092a1010-29ff-41f0-b1f0-c7a2b364aaf4",
        authentication: "none",
        responseMode: "onReceived",
        responseCode: 202,
        responseData: "noData"
    };

    @node({
        id: "2313eb86-548c-4dfb-a372-44e2ec4c6e0a",
        name: "Manual Trigger",
        type: "n8n-nodes-base.manualTrigger",
        version: 1,
        position: [-1280, -320]
    })
    ManualTrigger = {};

    @node({
        id: "88b97c45-5f73-492a-b076-12a832fbd9f1",
        name: "Build Sample Bright Data Payload",
        type: "n8n-nodes-base.code",
        version: 2,
        position: [-1040, -320]
    })
    BuildSampleBrightDataPayload = {
        mode: "runOnceForAllItems",
        language: "javaScript",
        jsCode: `const now = new Date().toISOString();

return [
  {
    json: {
      body: {
        source_code: 'FACEBOOK',
        run_id: 'manual-sample-' + Date.now(),
        year_target: new Date().getUTCFullYear(),
        posts: [
          {
            post_id: 'sample-post-1',
            post_url: 'https://www.facebook.com/ayuntamiento.demo/posts/1234567890',
            text: 'Concierto de primavera este viernes a las 21:00 en la Plaza Mayor. Entrada libre.',
            created_at: now,
            page_id: 'page-demo-001',
            page_name: 'Ayuntamiento Demo',
            page_url: 'https://www.facebook.com/ayuntamiento.demo',
            post_type: 'PHOTO',
            attachments: [
              {
                type: 'image',
                image_url: 'https://example.com/cartel-foto.jpg',
              },
            ],
          },
          {
            post_id: 'sample-post-2',
            post_url: 'https://www.facebook.com/ayuntamiento.demo/reel/9876543210',
            text: 'Resumen del festival de verano. ¡Gran éxito de participación!',
            created_at: now,
            page_id: 'page-demo-001',
            page_name: 'Ayuntamiento Demo',
            page_url: 'https://www.facebook.com/ayuntamiento.demo',
            post_type: 'REEL',
            attachments: [
              {
                type: 'video',
                video_url: 'https://example.com/video-festival.mp4',
                thumbnail: 'https://example.com/thumb-festival.jpg',
              },
            ],
          },
          {
            post_id: 'sample-post-3',
            post_url: 'https://www.facebook.com/ayuntamiento.demo/posts/1111111111',
            text: '',
            created_at: now,
            page_id: 'page-demo-001',
            page_name: 'Ayuntamiento Demo',
            page_url: 'https://www.facebook.com/ayuntamiento.demo',
            post_type: 'STATUS',
            attachments: [],
          },
        ],
      },
    },
  },
];`
    };

    @node({
        id: "e01d043b-23b9-4e7d-b1f5-2e6a7d370433",
        name: "Parse Bright Data Envelope",
        type: "n8n-nodes-base.code",
        version: 2,
        position: [-784, -160]
    })
    ParseBrightDataEnvelope = {
        mode: "runOnceForAllItems",
        language: "javaScript",
        jsCode: `function collapseWhitespace(value) {
  const newline = String.fromCharCode(10);
  const cr = String.fromCharCode(13);
  const tab = String.fromCharCode(9);
  return String(value ?? '')
    .split(newline).join(' ')
    .split(cr).join(' ')
    .split(tab).join(' ')
    .replace(/  +/g, ' ')
    .trim();
}

function toTextBase(value) {
  return collapseWhitespace(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

function firstDefined(obj, paths) {
  for (const path of paths) {
    const parts = path.split('.');
    let current = obj;
    let found = true;
    for (const part of parts) {
      if (current && Object.prototype.hasOwnProperty.call(current, part)) {
        current = current[part];
      } else {
        found = false;
        break;
      }
    }
    if (found && current !== undefined && current !== null && String(current) !== '') {
      return current;
    }
  }
  return undefined;
}

function normalizeUrl(value) {
  const raw = collapseWhitespace(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.hostname === 'm.facebook.com') {
      url.hostname = 'www.facebook.com';
    }
    ['fbclid', '__cft__[0]', '__tn__', 'refsrc', 'locale', 'mibextid'].forEach((key) => url.searchParams.delete(key));
    url.hash = '';
    const normalizedUrl = url.toString();
    return normalizedUrl.endsWith('/') ? normalizedUrl.slice(0, -1) : normalizedUrl;
  } catch (err) {
    return raw;
  }
}

function deterministicHash(value) {
  const str = String(value);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h0 = (Math.imul(h0 ^ ch, 2246822507) + i) >>> 0;
    h1 = (Math.imul(h1 ^ ch, 3266489909) ^ h0) >>> 0;
    h2 = (Math.imul(h2 ^ h1, 668265261) + ch) >>> 0;
    h3 = (Math.imul(h3 ^ h2, 374761393) ^ i) >>> 0;
  }
  h0 = (h0 ^ h1 ^ str.length) >>> 0;
  h1 = (h1 ^ h2 ^ (str.length << 3)) >>> 0;
  h2 = (h2 ^ h3 ^ (str.length << 7)) >>> 0;
  h3 = (h3 ^ h0 ^ (str.length << 11)) >>> 0;
  return [h0, h1, h2, h3].map((v) => v.toString(16).padStart(8, '0')).join('');
}

function normalizeTimestamp(value, fallbackValue) {
  const raw = collapseWhitespace(value || fallbackValue || '');
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function inferMediaType(rawItem, fallbackType) {
  const mediaType = toTextBase(firstDefined(rawItem, ['media_type', 'type', 'kind']) || fallbackType || 'IMAGE');
  if (mediaType.includes('VIDEO') || mediaType.includes('REEL')) return 'VIDEO';
  if (mediaType.includes('THUMB')) return 'THUMB';
  return 'IMAGE';
}

function pushMedia(target, sourceUrl, mediaType, originalName) {
  const normalizedSourceUrl = normalizeUrl(sourceUrl);
  if (!normalizedSourceUrl) return;
  if (target.some((item) => item.normalized_source_url === normalizedSourceUrl && item.media_type === mediaType)) return;
  target.push({
    media_index: target.length,
    media_type: mediaType,
    source_url: sourceUrl,
    normalized_source_url: normalizedSourceUrl,
    original_name: originalName || '',
  });
}

function collectMedia(raw) {
  const media = [];
  const arrayFields = [
    ['media', 'IMAGE'],
    ['media_items', 'IMAGE'],
    ['attachments', 'IMAGE'],
    ['images', 'IMAGE'],
    ['photos', 'IMAGE'],
    ['videos', 'VIDEO'],
    ['image_urls', 'IMAGE'],
    ['img_urls', 'IMAGE'],
  ];

  for (const [field, fallbackType] of arrayFields) {
    const value = raw[field];
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (typeof entry === 'string') {
        pushMedia(media, entry, fallbackType, '');
        continue;
      }
      if (!entry || typeof entry !== 'object') continue;
      const videoUrl = entry.video_url || entry.videoUrl || null;
      const imageUrl = entry.image_url || entry.img_url || entry.imageUrl || null;
      const thumbUrl = entry.thumbnail || entry.thumbnail_url || null;
      if (videoUrl || imageUrl || thumbUrl) {
        if (videoUrl) pushMedia(media, videoUrl, 'VIDEO', entry.filename || entry.name || '');
        const previewUrl = thumbUrl || (videoUrl ? imageUrl : null);
        if (previewUrl) pushMedia(media, previewUrl, 'THUMB', '');
        if (!videoUrl && imageUrl) pushMedia(media, imageUrl, 'IMAGE', entry.filename || entry.name || '');
      } else {
        const sourceUrl = firstDefined(entry, ['url', 'src', 'media_url', 'download_url']);
        if (sourceUrl) pushMedia(media, sourceUrl, inferMediaType(entry, fallbackType), firstDefined(entry, ['filename', 'name']) || '');
      }
    }
  }

  const singleFields = [
    ['image_url', 'IMAGE'],
    ['thumbnail_url', 'THUMB'],
    ['video_url', 'VIDEO'],
  ];

  for (const [field, mediaType] of singleFields) {
    const sourceUrl = firstDefined(raw, [field]);
    if (sourceUrl) {
      pushMedia(media, sourceUrl, mediaType, '');
    }
  }

  return media;
}

function pickPosts(body) {
  if (Array.isArray(body)) return body;
  const candidates = [body.posts, body.data, body.items, body.records, body.results, body.output];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  if (body.snapshot && Array.isArray(body.snapshot.records)) return body.snapshot.records;
  if (body.result && Array.isArray(body.result.items)) return body.result.items;
  if (body.post_url || body.url || body.id || body.post_id) return [body];
  return [];
}

const input = $input.first().json || {};
const body = input.body ?? input;
const sourceCode = String(firstDefined(body, ['source_code', 'source', 'platform']) || 'FACEBOOK').toUpperCase();
const rawPosts = pickPosts(body);

if (!rawPosts.length) {
  throw new Error('No posts found in Bright Data payload');
}

const externalRunId = collapseWhitespace(String(firstDefined(body, ['external_run_id', 'run_id', 'snapshot_id', 'dataset_id', 'request_id', 'job_id']) || '')) || ('webhook-' + Date.now());
const yearTargetRaw = firstDefined(body, ['year_target', 'year']);
const yearTarget = yearTargetRaw ? Number(yearTargetRaw) : null;
const notes = collapseWhitespace(String(firstDefined(body, ['notes', 'dataset_name']) || 'Bright Data ingest'));
const scrapedAt = new Date().toISOString();

const posts = rawPosts.map((raw) => {
  const postUrl = collapseWhitespace(firstDefined(raw, ['post_url', 'url', 'postUrl', 'permalink']) || '');
  const normalizedPostUrl = normalizeUrl(postUrl);
    const externalPostId = collapseWhitespace(firstDefined(raw, ['external_post_id', 'post_id', 'id', 'postId']) || '');
    const textPostRaw = collapseWhitespace(firstDefined(raw, ['text_post_raw', 'text', 'message', 'post_text', 'description', 'caption']) || '') || '';
    const textPostClean = collapseWhitespace(textPostRaw) || '';
  const textBase = toTextBase(textPostClean);
  const mediaItems = collectMedia(raw);
  const mediaHasVideo = mediaItems.some((item) => item.media_type === 'VIDEO');
  const mediaHasPhoto = mediaItems.some((item) => item.media_type === 'IMAGE' || item.media_type === 'THUMB');
  const isReel = normalizedPostUrl.includes('/reel/') || toTextBase(firstDefined(raw, ['post_type', 'type']) || '').includes('REEL');
  const isVideoPost = mediaHasVideo || Boolean(firstDefined(raw, ['has_video', 'is_video']));
  const publishedAt = normalizeTimestamp(firstDefined(raw, ['published_at', 'created_at', 'date', 'post_date', 'timestamp']), scrapedAt);
  const accountHandleRaw = collapseWhitespace(firstDefined(raw, ['account_handle', 'page_handle', 'profile_handle', 'author_handle']) || '');
  const processingPriority = mediaItems.length > 0 || textPostClean.length >= 80 ? 'HIGH' : (textPostClean ? 'MEDIUM' : 'LOW');
  const idempotKey = externalPostId ? (sourceCode + ':' + externalPostId) : deterministicHash(sourceCode + ':' + (normalizedPostUrl || JSON.stringify(raw)));

  return {
    source_code: sourceCode,
    run_type: 'INCREMENTAL',
    external_run_id: externalRunId,
    year_target: Number.isFinite(yearTarget) ? yearTarget : null,
    records_received: rawPosts.length,
    notes,
    ayto_id: collapseWhitespace(firstDefined(raw, ['ayto_id', 'municipality_id', 'city_id']) || ''),
    account_name: collapseWhitespace(firstDefined(raw, ['account_name', 'page_name', 'profile_name', 'author_name', 'publisher_name']) || 'Unknown account'),
    account_handle: accountHandleRaw.replace(/^@/, ''),
    account_url: collapseWhitespace(firstDefined(raw, ['account_url', 'page_url', 'profile_url', 'author_url']) || ''),
    external_account_id: collapseWhitespace(firstDefined(raw, ['external_account_id', 'page_id', 'profile_id', 'author_id']) || ''),
    idempot_key: idempotKey,
    external_post_id: externalPostId,
    normalized_post_url: normalizedPostUrl,
    post_url: postUrl,
    post_type: collapseWhitespace(firstDefined(raw, ['post_type', 'type']) || ''),
    is_reel: isReel,
    is_video_post: isVideoPost,
    published_at: publishedAt,
    scraped_at: scrapedAt,
    text_post_raw: textPostRaw,
    text_post_clean: textPostClean,
    text_base: textBase,
    has_text: Boolean(textPostClean),
    text_length: textPostClean.length,
    media_count_total: mediaItems.length,
    media_items_json: mediaItems,
    media_has_photo: mediaHasPhoto,
    media_has_video: mediaHasVideo,
    processing_priority: processingPriority,
    raw_payload_json: raw,
  };
}).filter((post) => post.external_post_id || post.normalized_post_url);

if (!posts.length) {
  throw new Error('Payload parsed correctly but no valid posts remained after normalization');
}

return [
  {
    json: {
      source_code: sourceCode,
      run_type: 'INCREMENTAL',
      external_run_id: externalRunId,
      year_target: Number.isFinite(yearTarget) ? yearTarget : null,
      records_received: posts.length,
      notes,
      posts,
    },
  },
];`
    };

    @node({
        id: "e2313e23-04cb-4201-a14b-ed1c583a4314",
        name: "Split Out Posts",
        type: "n8n-nodes-base.splitOut",
        version: 1,
        position: [-528, -160]
    })
    SplitOutPosts = {
        fieldToSplitOut: "posts",
        include: "allOtherFields",
        options: {}
    };

    @node({
        id: "697b8f13-b2d9-4587-a8bf-950459497d36",
        name: "Upsert Social Post",
        type: "n8n-nodes-base.postgres",
        version: 2.6,
        position: [-256, -160],
        credentials: {postgres:{id:"E2XU4m84S5WN82lK",name:"Postgres social account"}}
    })
    UpsertSocialPost = {
        operation: "executeQuery",
        schema: {
            mode: "list",
            value: "public"
        },
        table: {
            mode: "list",
            value: "social_posts"
        },
        query: `WITH run_ctx AS (
  SELECT ingest_run_id
  FROM social_register_ingest_run($1::jsonb)
), payload AS (
  SELECT ($1::jsonb->'posts') || jsonb_build_object('ingest_run_id', (SELECT ingest_run_id FROM run_ctx)) AS payload_json
)
SELECT
  (SELECT ingest_run_id FROM run_ctx) AS ingest_run_id,
  result.*
FROM upsert_social_post_payload((SELECT payload_json FROM payload)) AS result;`,
        options: {
            queryReplacement: "={{ [$json] }}"
        }
    };

    @node({
        id: "7b06d6c1-b695-4eb0-885d-b8d57f8de29c",
        name: "Summarize Ingest",
        type: "n8n-nodes-base.code",
        version: 2,
        position: [16, -160]
    })
    SummarizeIngest = {
        mode: "runOnceForAllItems",
        language: "javaScript",
        jsCode: `const items = $input.all();

if (!items.length) {
  return [{ json: { status: 'EMPTY', posts_processed: 0, posts_inserted: 0, posts_updated: 0 } }];
}

const ingestRunId = items[0].json.ingest_run_id;
const postsInserted = items.filter((item) => item.json.was_inserted).length;
const postsUpdated = items.length - postsInserted;

return [
  {
    json: {
      ingest_run_id: ingestRunId,
      posts_processed: items.length,
      posts_inserted: postsInserted,
      posts_updated: postsUpdated,
      summary_note: 'Processed ' + items.length + ' posts (' + postsInserted + ' inserted, ' + postsUpdated + ' updated)',
    },
  },
];`
    };

    @node({
        id: "291b11a9-f54c-440c-936c-29c6dc102f53",
        name: "Finalize Ingest Run",
        type: "n8n-nodes-base.postgres",
        version: 2.6,
        position: [288, -160],
        credentials: {postgres:{id:"E2XU4m84S5WN82lK",name:"Postgres social account"}}
    })
    FinalizeIngestRun = {
        operation: "executeQuery",
        schema: {
            mode: "list",
            value: "public"
        },
        table: {
            mode: "list",
            value: "ingest_runs"
        },
        query: `UPDATE ingest_runs
SET
  status = 'COMPLETED',
  processed = TRUE,
  is_enabled = TRUE,
  finished_at = NOW(),
  records_inserted = $1::integer,
  records_updated = $2::integer,
  error_count = 0,
  notes = CASE
    WHEN COALESCE(notes, '') = '' THEN $3::text
    ELSE notes || E'\\n' || $3::text
  END,
  updated_at = NOW()
WHERE id = $4::bigint
RETURNING id AS ingest_run_id, status, processed, is_enabled, records_received, records_inserted, records_updated, finished_at;`,
        options: {
            queryReplacement: "={{ [$json.posts_inserted, $json.posts_updated, $json.summary_note, $json.ingest_run_id] }}"
        }
    };

    @node({
        id: "14210282-dbaa-4523-b092-fab1c7a27d59",
        name: "Update Last Captured Post",
        type: "n8n-nodes-base.postgres",
        version: 2.6,
        position: [560, -160],
        credentials: {postgres:{id:"E2XU4m84S5WN82lK",name:"Postgres social account"}}
    })
    UpdateLastCapturedPost = {
        operation: "executeQuery",
        schema: {
            mode: "list",
            value: "public"
        },
        table: {
            mode: "list",
            value: "publisher_accounts"
        },
        query: `UPDATE publisher_accounts pa
SET
  ultimo_post_capturado_fecha = latest.published_at,
  ultimo_post_capturado_id    = latest.external_post_id,
  updated_at = NOW()
FROM (
  SELECT sp.publisher_account_id, sp.published_at, sp.external_post_id
  FROM social_posts sp
  WHERE sp.ingest_run_id = $1::bigint
    AND sp.published_at IS NOT NULL
  ORDER BY sp.published_at DESC
  LIMIT 1
) AS latest
WHERE pa.id = latest.publisher_account_id
  AND (pa.ultimo_post_capturado_fecha IS NULL OR latest.published_at > pa.ultimo_post_capturado_fecha)
RETURNING pa.id, pa.ayto_id, pa.ultimo_post_capturado_fecha, pa.ultimo_post_capturado_id;`,
        options: {
            queryReplacement: "={{ [$json.ingest_run_id] }}"
        }
    };


    // =====================================================================
// ROUTAGE ET CONNEXIONS
// =====================================================================

    @links()
    defineRouting() {
        this.ManualTrigger.out(0).to(this.BuildSampleBrightDataPayload.in(0));
        this.BuildSampleBrightDataPayload.out(0).to(this.ParseBrightDataEnvelope.in(0));
        this.BrightDataWebhook.out(0).to(this.ParseBrightDataEnvelope.in(0));
        this.ParseBrightDataEnvelope.out(0).to(this.SplitOutPosts.in(0));
        this.SplitOutPosts.out(0).to(this.UpsertSocialPost.in(0));
        this.UpsertSocialPost.out(0).to(this.SummarizeIngest.in(0));
        this.SummarizeIngest.out(0).to(this.FinalizeIngestRun.in(0));
        this.FinalizeIngestRun.out(0).to(this.UpdateLastCapturedPost.in(0));
    }
}