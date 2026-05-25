import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : 10 SOCIAL BRIGHTDATA TRIGGER
// Nodes   : 12  |  Connections: 0
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ManualTrigger                      manualTrigger
// GetActiveAccounts                  postgres                   [creds]
// TriggerBrightdata                  httpRequest                [creds]
// CheckProgress                      httpRequest                [creds]
// IsReady                            if
// WaitBeforeRetry                    wait
// DownloadSnapshot                   httpRequest                [creds]
// BuildSnapshotFilePath              code
// WriteSnapshotFile                  readWriteFile              [onError→out(1)]
// ConvertNdjson                      code
// ProcessingLogStart                 postgres                   [creds]
// ProcessingLogEnd                   postgres                   [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'gZKx629rYPKsJzyf',
    name: '10 SOCIAL BRIGHTDATA TRIGGER',
    active: false,
    isArchived: false,
    settings: {
        timezone: 'Europe/Madrid',
        executionOrder: 'v1',
        availableInMCP: false,
        callerPolicy: 'workflowsFromSameOwner',
    },
})
export class _10SocialBrightdataTriggerWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'brightdata-trigger-manual',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-800, 0],
    })
    ManualTrigger = {};

    @node({
        id: 'brightdata-get-accounts',
        name: 'Get Active Accounts',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-560, 0],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    GetActiveAccounts = {
        operation: 'executeQuery',
        schema: {
            mode: 'list',
            value: 'public',
        },
        table: {
            mode: 'list',
            value: 'publisher_accounts',
        },
        query: `SELECT
  pa.id          AS publisher_account_id,
  pa.ayto_id,
  pa.account_name,
  pa.account_url AS fb_page_url,
  TO_CHAR(
    COALESCE(pa.ultimo_post_capturado_fecha::date, pa.fecha_inicio_historico),
    'MM-DD-YYYY'
  ) AS start_date,
  TO_CHAR(NOW()::date, 'MM-DD-YYYY') AS end_date
FROM publisher_accounts pa
WHERE pa.is_active = true
  AND pa.account_url IS NOT NULL
  AND pa.source_id = 1
ORDER BY pa.id;`,
        options: {},
    };

    @node({
        id: 'brightdata-http-trigger',
        name: 'Trigger BrightData',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-320, 0],
        credentials: { httpBearerAuth: { id: 'ZuO7wHiFEa3EziZR', name: 'BRIGHT DATA' } },
    })
    TriggerBrightdata = {
        method: 'POST',
        url: 'https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_lkaxegm826bjpoo9m5&notify=false&include_errors=true',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpBearerAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={{JSON.stringify([{ url: $json.fb_page_url, num_of_posts: 10000, start_date: $json.start_date, end_date: $json.end_date }])}}',
        options: {
            response: {},
            timeout: 60000,
        },
    };

    @node({
        id: 'brightdata-check-progress',
        name: 'Check Progress',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-80, 0],
        credentials: { httpBearerAuth: { id: 'ZuO7wHiFEa3EziZR', name: 'BRIGHT DATA' } },
    })
    CheckProgress = {
        method: 'GET',
        url: "={{ 'https://api.brightdata.com/datasets/v3/progress/' + $('Trigger BrightData').item.json.snapshot_id }}",
        authentication: 'genericCredentialType',
        genericAuthType: 'httpBearerAuth',
        options: {},
    };

    @node({
        id: 'brightdata-is-ready',
        name: 'Is Ready',
        type: 'n8n-nodes-base.if',
        version: 2.3,
        position: [160, 0],
    })
    IsReady = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 3,
            },
            conditions: [
                {
                    id: 'brightdata-ready-check',
                    leftValue: '={{ $json.status }}',
                    rightValue: 'ready',
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
        id: 'brightdata-wait-retry',
        name: 'Wait Before Retry',
        type: 'n8n-nodes-base.wait',
        version: 1.1,
        position: [160, 200],
    })
    WaitBeforeRetry = {
        amount: 360,
        unit: 'seconds',
    };

    @node({
        id: 'brightdata-download-snapshot',
        name: 'Download Snapshot',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [400, 0],
        credentials: { httpBearerAuth: { id: 'ZuO7wHiFEa3EziZR', name: 'BRIGHT DATA' } },
    })
    DownloadSnapshot = {
        method: 'GET',
        url: "={{ 'https://api.brightdata.com/datasets/v3/snapshot/' + $('Trigger BrightData').item.json.snapshot_id + '?format=ndjson' }}",
        authentication: 'genericCredentialType',
        genericAuthType: 'httpBearerAuth',
        options: {
            response: {
                response: {
                    responseFormat: 'text',
                },
            },
        },
    };

    @node({
        id: 'brightdata-build-snapshot-path',
        name: 'Build Snapshot File Path',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [560, 0],
    })
    BuildSnapshotFilePath = {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `const item = $input.first();
const text = item.json.data || item.json.body || '';
const snapshotId = String($('Trigger BrightData').item.json.snapshot_id || 'unknown');
const aytoRaw = String($('Get Active Accounts').item.json.ayto_id || 'unknown_ayto');
const startDate = String($('Get Active Accounts').item.json.start_date || '');
const yearFromStart = Number(startDate.slice(0, 4));
const year = Number.isFinite(yearFromStart) && yearFromStart > 2000
    ? String(Math.trunc(yearFromStart))
    : String(new Date().getFullYear());

const safeAyto = aytoRaw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'unknown_ayto';

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dirPath = '/srv/storage/redessociales/brightdata/' + safeAyto + '/' + year;
const filePath = dirPath + '/snapshot_' + snapshotId + '_' + stamp + '.ndjson';
// Ensure directory exists
const fs = require('fs');
try { fs.mkdirSync(dirPath, { recursive: true }); } catch (e) { /* ignore if exists */ }
const binaryData = await this.helpers.prepareBinaryData(Buffer.from(String(text), 'utf8'), 'snapshot.ndjson', 'text/plain');

return {
    json: {
        ...item.json,
        snapshot_file_path: filePath,
        snapshot_id: snapshotId,
        snapshot_ayto_id: safeAyto,
        snapshot_year: year,
    },
    binary: {
        snapshot_data: binaryData,
    },
};`,
    };

    @node({
        id: 'brightdata-write-snapshot-file',
        name: 'Write Snapshot File',
        type: 'n8n-nodes-base.readWriteFile',
        version: 1.1,
        position: [720, 0],
        onError: 'continueErrorOutput',
    })
    WriteSnapshotFile = {
        operation: 'write',
        fileName: '={{ $json.snapshot_file_path }}',
        dataPropertyName: 'snapshot_data',
    };

    @node({
        id: 'brightdata-convert-ndjson',
        name: 'Convert Ndjson',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [640, 0],
    })
    ConvertNdjson = {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: 'var text = $input.item.json.data || $input.item.json.body || ""; if (typeof text !== "string") text = String(text); if (text && text.charCodeAt(0) === 0xFEFF) text = text.slice(1); var snapshotId = $("Trigger BrightData").item.json.snapshot_id || ""; var accountId = $("Get Active Accounts").item.json.publisher_account_id; var aytoId = $("Get Active Accounts").item.json.ayto_id; var accountName = $("Get Active Accounts").item.json.account_name; var rawLines = text.split("\\n"); var lines = []; for (var i = 0; i < rawLines.length; i++) { var l = rawLines[i]; if (typeof l === "string") { if (l.trim().length > 0) lines.push(l); } } var posts = []; for (var j = 0; j < lines.length; j++) { try { var obj = JSON.parse(lines[j]); if (obj && (obj.url || obj.post_url || obj.post_id || obj.id)) { obj._ayto_id = aytoId; obj._account_name = accountName; obj._publisher_account_id = accountId; posts.push(obj); } } catch (e) { /* skip malformed lines */ } } return [{ json: { posts: posts, snapshot_id: snapshotId, publisher_account_id: accountId } }];',
    };

    @node({
        id: 'brightdata-log-processing-start',
        name: 'Processing Log Start',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [480, -120],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    ProcessingLogStart = {
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
VALUES ('publisher_account', $1::bigint, 'social_brightdata_trigger', 'DOWNLOAD', $2, $3, $4::jsonb)
RETURNING id;`,
        options: {
            queryReplacement: `={{ [
  Number($('Get Active Accounts').item.json.publisher_account_id),
  'IN_PROGRESS',
  'Download started for batch: ' + ($('Trigger BrightData').item.json.snapshot_id || ''),
  JSON.stringify({
    batch_name: ($('Trigger BrightData').item.json.snapshot_id || ''),
    snapshot_file_path: '',
    ayto_id: $('Get Active Accounts').item.json.ayto_id,
    account_name: $('Get Active Accounts').item.json.account_name
  })
] }}`,
        },
    };

    @node({
        id: 'brightdata-log-processing-end',
        name: 'Processing Log End',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [840, -120],
        credentials: { postgres: { id: 'E2XU4m84S5WN82lK', name: 'Postgres social account' } },
    })
    ProcessingLogEnd = {
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
VALUES ('publisher_account', $1::bigint, 'social_brightdata_trigger', 'DOWNLOAD_COMPLETE', $2, $3, $4::jsonb)
RETURNING id;`,
        options: {
            queryReplacement: `={{ [
  Number($('Get Active Accounts').item.json.publisher_account_id),
  ($input.first().json.statusCode || 200) < 400 ? 'SUCCESS' : 'ERROR',
  'Download finished for batch: ' + ($('Trigger BrightData').item.json.snapshot_id || ''),
  JSON.stringify({
    batch_name: ($('Trigger BrightData').item.json.snapshot_id || ''),
    snapshot_file_path: ($('Build Snapshot File Path').item.json.snapshot_file_path || ''),
    processed: (($input.first().json.statusCode || 200) < 400)
  })
] }}`,
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        // No connections defined
    }
}
