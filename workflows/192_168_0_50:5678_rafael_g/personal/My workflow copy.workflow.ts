import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : My workflow copy
// Nodes   : 7  |  Connections: 6
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WhenClickingExecuteWorkflow        manualTrigger              
// AgentAiPoweredWebDataExtractionWaitsForCompletion firecrawl                  [creds]
// SplitOut                           splitOut                   
// ExecuteASqlQuery                   postgres                   [creds]
// ExecuteASqlQuery1                  postgres                   [creds]
// Limit                              limit                      
// Scrape                             firecrawl                  [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhenClickingExecuteWorkflow
//    → AgentAiPoweredWebDataExtractionWaitsForCompletion
//      → SplitOut
//        → ExecuteASqlQuery
//          → ExecuteASqlQuery1
//            → Limit
//              → Scrape
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: "lAT4oN5zdIdvEvG6",
    name: "My workflow copy",
    active: false,
    settings: { executionOrder: "v1", callerPolicy: "workflowsFromSameOwner", availableInMCP: false }
})
export class MyWorkflowCopyWorkflow {

    // =====================================================================
// CONFIGURATION DES NOEUDS
// =====================================================================

    @node({
        id: "5b97971c-8996-465c-ad86-8fc9547a4a07",
        name: "When clicking ‘Execute workflow’",
        type: "n8n-nodes-base.manualTrigger",
        version: 1,
        position: [-1056, -464]
    })
    WhenClickingExecuteWorkflow = {};

    @node({
        id: "efa25b5b-317d-4e63-a8cc-ee5fa34526a5",
        name: "Agent - AI-powered web data extraction (waits for completion)",
        type: "@mendable/n8n-nodes-firecrawl.firecrawl",
        version: 1,
        position: [-848, -464],
        credentials: {firecrawlApi:{id:"3FsKPT3ZQeVfmMkM",name:"Firecrawl account"}}
    })
    AgentAiPoweredWebDataExtractionWaitsForCompletion = {
        resource: "Agent",
        operation: "agent",
        prompt: `Extrae TODOS los eventos visibles del storefront.

Para cada evento devuelve SIEMPRE:

- name: nombre literal del evento
- datetime_text: texto COMPLETO de fecha y hora tal como aparece (sin separar)
- venue: nombre del recinto tal como aparece
- event_url: URL completa del evento
- event_id: valor del parámetro "?e=" de la URL

REGLAS:
- NO separar fecha y hora
- NO interpretar ni convertir fechas
- NO limpiar texto
- NO inventar datos
- SI no hay algún campo → devolver ""

FORMATO:
- JSON
- lista en "events"
- todos los objetos con las mismas claves`,
        specifyUrls: true,
        urls: "https://www.flowte.me/storefront/almeria-cultura-401",
        schemaType: "manual",
        schema: `{
  "type": "object",
  "properties": {
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "datetime_text": { "type": "string" },
          "venue": { "type": "string" },
          "event_id": { "type": "string" },
          "event_url": { "type": "string" }
        },
        "required": ["name", "datetime_text", "event_url"]
      }
    }
  },
  "required": ["events"]
}`,
        maxWaitTime: 600,
        requestOptions: {}
    };

    @node({
        id: "82508742-45ad-4c69-b783-cf5aaf6a2682",
        name: "Split Out",
        type: "n8n-nodes-base.splitOut",
        version: 1,
        position: [-272, -464]
    })
    SplitOut = {
        fieldToSplitOut: "data.events",
        include: "allOtherFields",
        options: {
            disableDotNotation: false
        }
    };

    @node({
        id: "8aac8b14-34d7-459f-bc62-3e88e9c936e7",
        name: "Execute a SQL query",
        type: "n8n-nodes-base.postgres",
        version: 2.6,
        position: [-80, -464],
        credentials: {postgres:{id:"zKHsX0gkTrNFTpm5",name:"Postgres account"}}
    })
    ExecuteASqlQuery = {
        operation: "executeQuery",
        query: `INSERT INTO raw_front_eventos (
    event_id,
    name,
    datetime_text,
    venue,
    event_url,
    source_storefront,
    payload_json,
    last_seen
)
VALUES (
    '{{ $json["data.events"].event_id }}',
    '{{ ($json["data.events"].name || "").replace(/'/g, "''") }}',
    '{{ ($json["data.events"].datetime_text || "").replace(/'/g, "''") }}',
    '{{ ($json["data.events"].venue || "").replace(/'/g, "''") }}',
    '{{ ($json["data.events"].event_url || "").replace(/'/g, "''") }}',
    'almeria-cultura-401',
    '{{ JSON.stringify($json["data.events"]).replace(/'/g, "''") }}'::jsonb,
    NOW()
)
ON CONFLICT (event_id)
DO UPDATE SET
    name = EXCLUDED.name,
    datetime_text = EXCLUDED.datetime_text,
    venue = EXCLUDED.venue,
    event_url = EXCLUDED.event_url,
    source_storefront = EXCLUDED.source_storefront,
    payload_json = EXCLUDED.payload_json,
    last_seen = NOW();`,
        options: {}
    };

    @node({
        id: "ad499990-d491-41af-a511-4562aff3a28a",
        name: "Execute a SQL query1",
        type: "n8n-nodes-base.postgres",
        version: 2.6,
        position: [128, -464],
        credentials: {postgres:{id:"zKHsX0gkTrNFTpm5",name:"Postgres account"}}
    })
    ExecuteASqlQuery1 = {
        operation: "executeQuery",
        query: `SELECT
  event_id,
  event_url,
  name,
  datetime_text,
  venue
FROM raw_front_eventos
WHERE COALESCE(detalle_leido, FALSE) = FALSE
ORDER BY id;`,
        options: {}
    };

    @node({
        id: "72d39baf-cdfa-4f29-94ea-4944ffd1650f",
        name: "Limit",
        type: "n8n-nodes-base.limit",
        version: 1,
        position: [336, -464]
    })
    Limit = {};

    @node({
        id: "6abafc68-591f-47aa-885d-8d60d8f9b063",
        name: "/scrape",
        type: "@mendable/n8n-nodes-firecrawl.firecrawl",
        version: 1,
        position: [544, -464],
        credentials: {firecrawlApi:{id:"3FsKPT3ZQeVfmMkM",name:"Firecrawl account"}}
    })
    Scrape = {
        operation: "scrape",
        url: `=https://www.flowte.me/storefront/almeria-cultura-401?e=37064
`,
        scrapeOptions: {
            options: {
                formats: {
                    format: [
                        {
                            type: "links"
                        },
                        {},
                        {
                            type: "summary"
                        },
                        {
                            type: "screenshot",
                            fullPage: true
                        }
                    ]
                },
                headers: {}
            }
        },
        requestOptions: {}
    };


    // =====================================================================
// ROUTAGE ET CONNEXIONS
// =====================================================================

    @links()
    defineRouting() {
        this.WhenClickingExecuteWorkflow.out(0).to(this.AgentAiPoweredWebDataExtractionWaitsForCompletion.in(0));
        this.AgentAiPoweredWebDataExtractionWaitsForCompletion.out(0).to(this.SplitOut.in(0));
        this.SplitOut.out(0).to(this.ExecuteASqlQuery.in(0));
        this.ExecuteASqlQuery.out(0).to(this.ExecuteASqlQuery1.in(0));
        this.ExecuteASqlQuery1.out(0).to(this.Limit.in(0));
        this.Limit.out(0).to(this.Scrape.in(0));
    }
}