import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : 11 SOCIAL INGESTA
// Nodes   : 7  |  Connections: 6
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// Every10Minutes                     scheduleTrigger
// ListPendientes                     executeCommand
// SplitFiles                         code
// ReadNdjsonFile                     readWriteFile
// ProcessNdjson                      code
// SendToIngest                       httpRequest
// MoveToProcesados                   executeCommand
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Every10Minutes
//    → ListPendientes
//      → SplitFiles
//        → ReadNdjsonFile
//          → ProcessNdjson
//            → SendToIngest
//              → MoveToProcesados
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'azc0jZdfnlrep833',
    name: '11 SOCIAL INGESTA',
    active: false,
    settings: {
        timezone: 'Europe/Madrid',
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
    },
})
export class _11SocialIngestaWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '1d05c62e-f972-49ab-b573-876ca23318ed',
        name: 'Every 10 Minutes',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.1,
        position: [0, 0],
    })
    Every10Minutes = {
        rule: {
            interval: [
                {
                    field: 'minutes',
                    minutesInterval: 10,
                },
            ],
        },
    };

    @node({
        id: 'f0ddeb82-dd7b-4156-8b67-e3d36ae749c1',
        name: 'List Pendientes',
        type: 'n8n-nodes-base.executeCommand',
        version: 1,
        position: [200, 0],
    })
    ListPendientes = {
        command: 'find /srv/storage/redessociales/brightdata/pendientes -name "*.ndjson"',
    };

    @node({
        id: '682e236d-7404-4c58-bef7-a059a9d01523',
        name: 'Split Files',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [400, 0],
    })
    SplitFiles = {
        jsCode: `
const stdout = $input.first().json.stdout || '';
const files = stdout.split('\\n').map(f => f.trim()).filter(f => f.length > 0);
return files.map(f => ({ json: { filePath: f } }));`,
    };

    @node({
        id: 'a7124d6f-3e25-40dd-89be-9c36752de58c',
        name: 'Read NDJSON File',
        type: 'n8n-nodes-base.readWriteFile',
        version: 1.1,
        position: [600, 0],
    })
    ReadNdjsonFile = {
        operation: 'read',
        fileSelector: '={{ $json.filePath }}',
        dataPropertyName: 'data',
    };

    @node({
        id: 'd9adef81-0cca-4b2a-ad28-478040aef4c4',
        name: 'Process NDJSON',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [800, 0],
    })
    ProcessNdjson = {
        mode: 'runOnceForEachItem',
        jsCode: `const runId = 'initial';
const debugLog = (hypothesisId, location, message, data) => {
  try {
    if (typeof fetch === 'function') {
      fetch('http://127.0.0.1:7832/ingest/d099021d-7210-4059-b7eb-63f707ae8bdf',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'661e41'},body:JSON.stringify({sessionId:'661e41',runId,hypothesisId,location,message,data,timestamp:Date.now()})}).catch(()=>{});
    }
  } catch (_) {}
};
let filePath = String($json.filePath || '');
if (!filePath) {
  const itemBinary = (typeof $binary !== 'undefined' && $binary) ? $binary : {};
  const binary = (itemBinary.data || itemBinary.cached_data) || null;
  const metaPath = binary && (binary.filePath || binary.fileName || binary.fileNameResolved || binary.id);
  if (metaPath) {
    filePath = String(metaPath);
  }
}
if (!filePath) {
  try {
    const itemBinary = (typeof $binary !== 'undefined' && $binary) ? $binary : {};
    const binary = (itemBinary.data || itemBinary.cached_data) || null;
    const binaryName = binary && binary.fileName ? String(binary.fileName) : '';
    const candidates = $('Split Files').all().map(i => String((i.json && i.json.filePath) || '')).filter(Boolean);
    if (binaryName) {
      const matches = candidates.filter(p => p === binaryName || p.endsWith('/' + binaryName));
      if (matches.length === 1) {
        filePath = matches[0];
      }
    }
    if (!filePath && candidates.length === 1) {
      filePath = candidates[0];
    }
  } catch (_) {}
}
if (!filePath) {
  throw new Error('filePath ausente en el item de entrada');
}

let buffer;
if (this.helpers && typeof this.helpers.getBinaryDataBuffer === 'function') {
  try {
    buffer = await this.helpers.getBinaryDataBuffer('data');
  } catch (_) {
    buffer = await this.helpers.getBinaryDataBuffer(0, 'data');
  }
} else {
  throw new Error('this.helpers.getBinaryDataBuffer no está disponible en este runtime');
}

const text = buffer.toString('utf8');
const parts = filePath.split('/');
const aytoId = parts[parts.length - 3] || 'unknown';
const year = parts[parts.length - 2] || 'unknown';
const lines = text.split('\\n').filter(l => l.trim());
const posts = [];
for (const line of lines) {
  try {
    const obj = JSON.parse(line);
    if (obj && (obj.url || obj.post_url || obj.post_id || obj.id)) {
      obj.ayto_id = aytoId;
      obj.year = year;
      posts.push(obj);
    }
  } catch (e) { /* skip */ }
}

return { json: { posts, filePath, aytoId, year } };`,
    };

    @node({
        id: '4de086d5-e972-41f8-be61-c0a2af9bc1dd',
        name: 'Send To Ingest',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1000, 0],
    })
    SendToIngest = {
        method: 'POST',
        url: 'https://ingesta.sistechvision.online/webhook/social/brightdata/facebook',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={{ JSON.stringify({ posts: $json.posts, ayto_id: $json.aytoId, year: $json.year, platform: "FACEBOOK" }) }}',
        options: {
            response: {},
            timeout: 30000,
        },
    };

    @node({
        id: 'ab7a8a52-4196-4abb-94a7-8570bc6df9f7',
        name: 'Move to Procesados',
        type: 'n8n-nodes-base.executeCommand',
        version: 1,
        position: [1200, 0],
    })
    MoveToProcesados = {
        command:
            '={{ (() => { const fp = String($(\'Process NDJSON\').item.json.filePath || ""); const ay = String($(\'Process NDJSON\').item.json.aytoId || "unknown"); const yr = String($(\'Process NDJSON\').item.json.year || "unknown"); return "SRC=\\"" + fp.replace(/"/g, "\\\\\\"") + "\\"; AY=\\"" + ay.replace(/"/g, "\\\\\\"") + "\\"; YR=\\"" + yr.replace(/"/g, "\\\\\\"") + "\\"; REAL=\\"\\"; if [ -f \\"$SRC\\" ]; then REAL=\\"$SRC\\"; elif [ -f \\"/srv/storage/redessociales/brightdata/pendientes/$SRC\\" ]; then REAL=\\"/srv/storage/redessociales/brightdata/pendientes/$SRC\\"; elif [ -n \\"$SRC\\" ] && [ \\"$(basename \\"$SRC\\")\\" = \\"$SRC\\" ]; then REAL=\\"$(find /srv/storage/redessociales/brightdata/pendientes -type f -name \\"$SRC\\" | head -n 1)\\"; fi; if [ -z \\"$REAL\\" ] || [ ! -f \\"$REAL\\" ]; then echo \\"source_not_found:$SRC\\"; exit 1; fi; if [ \\"$AY\\" = \\"unknown\\" ] || [ \\"$YR\\" = \\"unknown\\" ]; then D=\\"$(dirname \\"$REAL\\")\\"; YR_AUTO=\\"$(basename \\"$D\\")\\"; AY_AUTO=\\"$(basename \\"$(dirname \\"$D\\")\\")\\"; [ \\"$AY\\" = \\"unknown\\" ] && AY=\\"$AY_AUTO\\"; [ \\"$YR\\" = \\"unknown\\" ] && YR=\\"$YR_AUTO\\"; fi; DEST=\\"/srv/storage/redessociales/brightdata/procesados/$AY/$YR\\"; mkdir -p \\"$DEST\\" && mv \\"$REAL\\" \\"$DEST/\\""; })() }}',
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Every10Minutes.out(0).to(this.ListPendientes.in(0));
        this.ListPendientes.out(0).to(this.SplitFiles.in(0));
        this.SplitFiles.out(0).to(this.ReadNdjsonFile.in(0));
        this.ReadNdjsonFile.out(0).to(this.ProcessNdjson.in(0));
        this.ProcessNdjson.out(0).to(this.SendToIngest.in(0));
        this.SendToIngest.out(0).to(this.MoveToProcesados.in(0));
    }
}
