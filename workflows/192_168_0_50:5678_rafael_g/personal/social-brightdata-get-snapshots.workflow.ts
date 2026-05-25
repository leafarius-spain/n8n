import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : 10 SOCIAL BRIGHTDATA TRIGGER
// Nodes   : 13  |  Connections: 14
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ManualTrigger                      manualTrigger
// GetActiveAccounts                  postgres                   [creds]
// BuildQuarterlyWindows              code
// LoopQuarters                       splitInBatches
// TriggerBrightdata                  httpRequest                [creds]
// CheckProgress                      httpRequest                [creds]
// IsReady                            if
// WaitBeforeRetry                    wait
// DownloadSnapshot                   httpRequest                [creds]
// BuildSnapshotFilePath              code
// EnsureDirectory                    executeCommand
// RestoreBinaryData                  code
// WriteSnapshotFile                  readWriteFile
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ManualTrigger
//    → GetActiveAccounts
//      → BuildQuarterlyWindows
//        → LoopQuarters
//         .out(1) → TriggerBrightdata
//            → CheckProgress
//              → IsReady
//                → DownloadSnapshot
//                  → BuildSnapshotFilePath
//                    → EnsureDirectory
//                      → RestoreBinaryData
//                        → WriteSnapshotFile
//                          → LoopQuarters (↩ loop)
//               .out(1) → WaitBeforeRetry
//                  → CheckProgress (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'ryH7q9rLu96xKBFw',
    name: '10 SOCIAL BRIGHTDATA TRIGGER',
    active: false,
    isArchived: false,
    settings: {
        timezone: 'Europe/Madrid',
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
        binaryMode: 'separate',
        timeSavedMode: 'dynamic',
    },
})
export class _10SocialBrightdataTriggerWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'b01578c4-e96c-4aaf-a070-cd55d8af0692',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-800, 128],
    })
    ManualTrigger = {};

    @node({
        id: '1fd2f2eb-86c5-475f-915b-2e343412baad',
        name: 'Get Active Accounts',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [-576, 128],
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
            value: '',
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
    };

    @node({
        id: 'c6c9df07-8b00-40c5-9eb4-91434e8ec41e',
        name: 'Build Quarterly Windows',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-464, 128],
    })
    BuildQuarterlyWindows = {
        mode: 'runOnceForAllItems',
        jsCode: `const TARGET_YEAR = 2025;
const q = [
  { quarter: 'Q1', start: '01-01', end: '03-31' },
  { quarter: 'Q2', start: '04-01', end: '06-30' },
  { quarter: 'Q3', start: '07-01', end: '09-30' },
  { quarter: 'Q4', start: '10-01', end: '12-31' },
];

const out = [];
for (const item of $input.all()) {
  const base = item.json || {};
  for (const part of q) {
    out.push({
      json: {
        ...base,
        quarter: part.quarter,
        start_date: part.start + '-' + TARGET_YEAR,
        end_date: part.end + '-' + TARGET_YEAR,
        target_year: TARGET_YEAR,
      },
    });
  }
}

return out;`,
    };

    @node({
        id: 'a3cd0d96-7317-48e2-9747-b426eb3b05b6',
        name: 'Loop Quarters',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [-352, 128],
    })
    LoopQuarters = {
        options: {},
    };

    @node({
        id: '62b4047c-090e-44b0-ab72-c4b56f9f8234',
        name: 'Trigger BrightData',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-352, 128],
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
        id: '769b2569-aacf-4db7-bbcc-4bfd26ce9dc5',
        name: 'Check Progress',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-128, 128],
        credentials: { httpBearerAuth: { id: 'ZuO7wHiFEa3EziZR', name: 'BRIGHT DATA' } },
    })
    CheckProgress = {
        url: "={{ 'https://api.brightdata.com/datasets/v3/progress/' + $('Trigger BrightData').item.json.snapshot_id }}",
        authentication: 'genericCredentialType',
        genericAuthType: 'httpBearerAuth',
    };

    @node({
        id: 'e0740776-c0ab-4acd-b83d-c39223025fb1',
        name: 'Is Ready',
        type: 'n8n-nodes-base.if',
        version: 2.3,
        position: [96, 48],
    })
    IsReady = {
        conditions: {
            options: {
                caseSensitive: true,
                typeValidation: 'strict',
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
    };

    @node({
        id: '9ac1c489-dfbb-4dff-ba5a-02d05b295cbc',
        name: 'Wait Before Retry',
        type: 'n8n-nodes-base.wait',
        version: 1.1,
        position: [320, 224],
    })
    WaitBeforeRetry = {
        amount: 360,
    };

    @node({
        id: 'a049e515-8b8b-4daf-be72-1020882edf2f',
        name: 'Download Snapshot',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [320, 0],
        credentials: { httpBearerAuth: { id: 'ZuO7wHiFEa3EziZR', name: 'BRIGHT DATA' } },
    })
    DownloadSnapshot = {
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
        id: '1ca0e095-920b-4168-9a21-2c8bd79a30fa',
        name: 'Build Snapshot File Path',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [544, 0],
    })
    BuildSnapshotFilePath = {
        jsCode: `const item = $input.first();
const text = item.json.data || item.json.body || '';
const snapshotId = String($('Trigger BrightData').item.json.snapshot_id || 'unknown');
const aytoRaw = String($('Get Active Accounts').item.json.ayto_id || 'unknown_ayto');
const startDate = String($('Get Active Accounts').item.json.start_date || '');

// Extract year from start_date (MM-DD-YYYY or YYYY-MM-DD)
let yearFromStart = NaN;
if (startDate.includes('-')) {
    const parts = startDate.split('-');
    if (parts[0].length === 4) yearFromStart = Number(parts[0]);
    else if (parts[2].length === 4) yearFromStart = Number(parts[2]);
}

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
// Note: Folder changed to 'pendientes'
const filePath = '/srv/storage/redessociales/brightdata/pendientes/' + safeAyto + '/' + year + '/snapshot_' + snapshotId + '_' + stamp + '.ndjson';
const binaryData = await this.helpers.prepareBinaryData(Buffer.from(String(text), 'utf8'), 'snapshot.ndjson', 'text/plain');

return [{
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
}];`,
    };

    @node({
        id: '0297cbec-c54c-49e8-9eb6-4f7a50d28dac',
        name: 'Ensure Directory',
        type: 'n8n-nodes-base.executeCommand',
        version: 1,
        position: [768, -128],
    })
    EnsureDirectory = {
        command: '={{ "mkdir -p $(dirname \'" + $json.snapshot_file_path + "\')" }}',
    };

    @node({
        id: 'restore-binary-data-node-id',
        name: 'Restore Binary Data',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [992, -128],
    })
    RestoreBinaryData = {
        jsCode: `// The previous 'Ensure Directory' node only returns stdout/stderr JSON.
// We need to restore the binary data prepared in 'Build Snapshot File Path'.
const originalItems = $('Build Snapshot File Path').all();
const items = $input.all();
return items.map((item, index) => {
  return {
    json: originalItems[index].json,
    binary: originalItems[index].binary
  };
});`,
    };

    @node({
        id: '4d3b4ca1-fdf0-41c1-ad37-d084ffecd24e',
        name: 'Write Snapshot File',
        type: 'n8n-nodes-base.readWriteFile',
        version: 1.1,
        position: [1216, 0],
    })
    WriteSnapshotFile = {
        operation: 'write',
        fileName: '={{ $json.snapshot_file_path }}',
        dataPropertyName: 'snapshot_data',
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ManualTrigger.out(0).to(this.GetActiveAccounts.in(0));
        this.GetActiveAccounts.out(0).to(this.BuildQuarterlyWindows.in(0));
        this.BuildQuarterlyWindows.out(0).to(this.LoopQuarters.in(0));
        this.LoopQuarters.out(1).to(this.TriggerBrightdata.in(0));
        this.TriggerBrightdata.out(0).to(this.CheckProgress.in(0));
        this.CheckProgress.out(0).to(this.IsReady.in(0));
        this.IsReady.out(0).to(this.DownloadSnapshot.in(0));
        this.IsReady.out(1).to(this.WaitBeforeRetry.in(0));
        this.WaitBeforeRetry.out(0).to(this.CheckProgress.in(0));
        this.DownloadSnapshot.out(0).to(this.BuildSnapshotFilePath.in(0));
        this.BuildSnapshotFilePath.out(0).to(this.EnsureDirectory.in(0));
        this.EnsureDirectory.out(0).to(this.RestoreBinaryData.in(0));
        this.RestoreBinaryData.out(0).to(this.WriteSnapshotFile.in(0));
        this.WriteSnapshotFile.out(0).to(this.LoopQuarters.in(0));
    }
}
