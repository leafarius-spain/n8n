# 🛠️ Scraper n8n Template - Flowte Events Architecture

**Document Version**: 1.0  
**Last Updated**: 7 Apr 2026  
**Status**: Production Ready  

---

## 📋 Table of Contents

1. [Quick Reference](#quick-reference)
2. [Architecture Overview](#architecture-overview)
3. [Database Schema](#database-schema)
4. [Workflow Components](#workflow-components)
5. [Data Flow & Operations](#data-flow--operations)
6. [Configuration & Credentials](#configuration--credentials)
7. [Implementation Guide](#implementation-guide)
8. [Testing & Validation](#testing--validation)
9. [Customization Guidelines](#customization-guidelines)
10. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Reference

### Active Workflow
- **Name**: SCRAPPER FLOWTE
- **ID**: `2qYQ1PxmsJhWhT1q`
- **Instance**: `http://192.168.0.50:5678`
- **Trigger**: POST `/webhook/test-scraper`

### Primary Targets
- **Events Source**: Flowte Storefront URLs (e.g., `https://www.flowte.me/storefront/{city}-{category}-{id}`)
- **Database**: PostgreSQL `cancerbero-eventos` at `192.168.0.50:5432`
- **User**: `postgres` / `Cancerbero123!`

### Key Tables
```
raw_front_eventos      → Event listings (RADAR)
raw_detalle_eventos    → Normalized event details (INSPECTION)
raw_eventos_adjuntos   → Media files (cartel, screenshot) links to Dropbox
```

---

## 🏗️ Architecture Overview

### 3-Layer Separation Model

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONT (Raw Listing)                                             │
│ ├─ event_id, name, datetime_text, venue                         │
│ ├─ event_url, source_storefront                                 │
│ └─ detalle_leido = FALSE (pending processing)                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    [FETCH + PARSE]
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ DETALLE (Structured Inspection)                                 │
│ ├─ titulo, observacion, local                                   │
│ ├─ fecha_inicio DATE, fecha_fin DATE, hora_inicio TEXT          │
│ ├─ datetime_text_original, tipo_fecha, num_sesiones_estimadas  │
│ └─ tiene_multiples_sesiones BOOLEAN                            │
│ ├─ precio_entradas NUMERIC, precio_medio_entradas NUMERIC       │
│ ├─ es_gratuito BOOLEAN                                          │
│ ├─ cartel_url (png), screenshot_url, ticketera_url              │
│ └─ payload_json JSONB (full normalized data)                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    [PARSE URLS]
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ ADJUNTOS (Media Files)                                          │
│ ├─ event_id                                                     │
│ ├─ tipo ('cartel', 'screenshot')                                │
│ ├─ url_origen (Flowte/Google Storage)                           │
│ ├─ url_dropbox (after upload)                                   │
│ ├─ nombre_archivo                                               │
│ └─ fecha_captura TIMESTAMPTZ                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Operational Flow

```
1. SELECT raw_front_eventos WHERE detalle_leido = FALSE
   ↓
2. Firecrawl /scrape → HTML + screenshot
   ↓
3. Cheerio parsing → 10 normalized fields
   ↓
4. INSERT raw_detalle_eventos
   ↓
5. [FUTURE] Download cartel + screenshot → Dropbox
   ↓
6. [FUTURE] INSERT raw_eventos_adjuntos
   ↓
7. UPDATE raw_front_eventos SET detalle_leido = TRUE
```

---

## 🧱 Database Schema

### Credentials
```
Host: 192.168.0.50
Port: 5432
Database: cancerbero-eventos
User: postgres
Password: Cancerbero123!
```

### Table 1: `raw_front_eventos` (RADAR)

**Purpose**: Lightweight event listing cache from storefronts

```sql
CREATE TABLE raw_front_eventos (
    id BIGSERIAL PRIMARY KEY,
    
    event_id TEXT NOT NULL UNIQUE,           -- e.g., "37064" from ?e=37064
    name TEXT,                                -- Event name as scraped
    datetime_text TEXT,                       -- Raw datetime string (no parsing)
    venue TEXT,                               -- Location name
    event_url TEXT,                           -- Full event ticketing URL
    source_storefront TEXT,                   -- Storefront ID (e.g., 'almeria-cultura-401')
    
    payload_json JSONB,                       -- Full original event data
    
    first_seen TIMESTAMPTZ DEFAULT NOW(),     -- When first discovered
    last_seen TIMESTAMPTZ DEFAULT NOW(),      -- Last sync timestamp
    
    detalle_leido BOOLEAN DEFAULT FALSE,      -- Processing flag
    detalle_fecha TIMESTAMPTZ                 -- When detalle was processed
);

CREATE UNIQUE INDEX idx_raw_front_event_id ON raw_front_eventos(event_id);
```

**Usage**:
- Source: Firecrawl scrape of storefront listing pages
- Query**: `SELECT * FROM raw_front_eventos WHERE detalle_leido = FALSE`
- After processing: `UPDATE ... SET detalle_leido = TRUE, detalle_fecha = NOW()`

---

### Table 2: `raw_detalle_eventos` (INSPECTION)

**Purpose**: Normalized, structured event details extracted from detail pages

```sql
CREATE TABLE raw_detalle_eventos (
    id BIGSERIAL PRIMARY KEY,
    
    event_id TEXT NOT NULL,                   -- FK → raw_front_eventos.event_id
    
    ticketera_url TEXT,                       -- Final ticketing URL (may redirect)
    
    titulo TEXT,                              -- Event title (clean)
    titulo_original TEXT,                     -- Raw event title from detail page
    observacion TEXT,                         -- Event description
    
    datetime_text_original TEXT,              -- Raw datetime text from detail page
    fecha_inicio DATE,                        -- ISO format YYYY-MM-DD
    fecha_fin DATE,                           -- ISO format YYYY-MM-DD when multi-day
    hora_inicio TEXT,                         -- HH:MM format
    tipo_fecha TEXT,                          -- simple | rango_misma_hora | multiple_sesiones | texto_no_parseable
    num_sesiones_estimadas INTEGER,           -- Conservative estimation only when unambiguous
    tiene_multiples_sesiones BOOLEAN DEFAULT FALSE,
    
    precio_entradas NUMERIC,                  -- Minimum ticket price
    precio_medio_entradas NUMERIC,            -- Average ticket price
    
    local TEXT,                               -- Venue/location name
    es_gratuito BOOLEAN,                      -- Free event flag
    
    cartel_url TEXT,                          -- Artwork/poster URL
    screenshot_url TEXT,                      -- Full page screenshot URL
    
    payload_json JSONB,                       -- Full normalized JSON output
    
    fecha_captura TIMESTAMPTZ DEFAULT NOW(),  -- When extracted
    
    detalle_valido BOOLEAN DEFAULT TRUE,      -- Data quality flag
    
    CONSTRAINT uq_raw_detalle_eventos_event UNIQUE (event_id)
);

CREATE UNIQUE INDEX idx_raw_detalle_event_id ON raw_detalle_eventos(event_id);
```

**Usage**:
- Destination: INSERT from n8n Normalizar Eventos code node
- Query**: `SELECT * FROM raw_detalle_eventos WHERE detalle_valido = TRUE`
- Business layer reads from here for aggregations, exports, etc.

---

### Table 3: `raw_eventos_adjuntos` (FILES)

**Purpose**: Track media files (cartel, screenshot) uploaded to Dropbox

```sql
CREATE TABLE raw_eventos_adjuntos (
    id BIGSERIAL PRIMARY KEY,
    
    event_id TEXT NOT NULL,                   -- FK → raw_detalle_eventos.event_id
    
    tipo TEXT NOT NULL,                       -- 'cartel' or 'screenshot' (enum-like)
    
    url_origen TEXT,                          -- Original URL (Flowte, Google Storage)
    url_dropbox TEXT,                         -- Dropbox shared link (after upload)
    
    nombre_archivo TEXT,                      -- Stored filename in Dropbox
    
    fecha_captura TIMESTAMPTZ DEFAULT NOW()   -- When uploaded
);

CREATE INDEX idx_raw_adjuntos_event_id ON raw_eventos_adjuntos(event_id);
CREATE INDEX idx_raw_adjuntos_tipo ON raw_eventos_adjuntos(tipo);
```

**Usage**:
- Destination: INSERT after Dropbox upload (future phase)
- Queries**:
  - `SELECT * FROM raw_eventos_adjuntos WHERE event_id = 'X' AND tipo = 'cartel'`
  - `SELECT url_dropbox FROM raw_eventos_adjuntos WHERE event_id = 'X' AND tipo = 'screenshot'`

---

### Relationships

```
raw_front_eventos (1)
    ↓ event_id
raw_detalle_eventos (1)
    ↓ event_id
raw_eventos_adjuntos (N)
```

**Rules**:
- `raw_detalle_eventos.event_id` must exist in `raw_front_eventos`
- `raw_eventos_adjuntos.event_id` must exist in `raw_detalle_eventos`
- No cascading deletes (manual cleanup only)

---

## ⚙️ Workflow Components

### Node 1: Webhook Trigger
- **Type**: `n8n-nodes-base.webhook`
- **Path**: `/test-scraper`
- **Method**: POST
- **Purpose**: Entry point for manual tests or external triggers

### Node 2: Execute a SQL Query 1 (SELECT)
- **Type**: `n8n-nodes-base.postgres`
- **Operation**: `executeQuery`
- **Credentials**: `zKHsX0gkTrNFTpm5` (Postgres account)
- **Query**:
  ```sql
  SELECT
    event_id,
    event_url,
    name,
    datetime_text,
    venue
  FROM raw_front_eventos
  WHERE COALESCE(detalle_leido, FALSE) = FALSE
  ORDER BY id;
  ```
- **Output**: Array of pending events with `event_id`, `event_url`, etc.

### Node 3: Limit
- **Type**: `n8n-nodes-base.limit`
- **Purpose**: Restrict batch size for testing (optional, can remove for production)
- **Default**: No limit (1)

### Node 4: Scrape (Firecrawl)
- **Type**: `@mendable/n8n-nodes-firecrawl.firecrawl`
- **Operation**: `scrape`
- **Credentials**: `3FsKPT3ZQeVfmMkM` (Firecrawl account)
- **Parameters**:
  ```typescript
  url: '{{ $json.event_url }}'  // Dynamic from DB
  operation: 'scrape'
  formats: ['html', 'screenshot']  // NO markdown
  screenshot: { fullPage: true }
  ```
- **Output**:
  - `data.html`: Full page HTML (63-848 KB)
  - `data.screenshot`: Base64 Google Storage URL
  - `data.metadata.sourceURL`: Final redirected URL (tracks redirects)

### Node 5: Normalizar Eventos (Code)
- **Type**: `n8n-nodes-base.code`
- **Language**: JavaScript
- **Purpose**: Parse HTML with Cheerio, extract 10 normalized fields
- **Input**: `$input.all()` from Scrape node
- **CSS Selectors Used**:
  ```
  h3.select-event-name        → titulo
  span.in-product-event-loc   → local
  span.in-event-date-new      → datetime_text_original + fecha_inicio + fecha_fin + hora_inicio + tipo_fecha
  #select-event-desc          → observacion, es_gratuito check
  .ticket-price span[id]      → precio_entradas, precio_medio_entradas
  img#select-event-img        → cartel_url (manual .each() loop)
  data.metadata.sourceURL     → ticketera_url
  data.screenshot             → screenshot_url
  ```
- **Output**: detail fields + datetime interpretation:
  ```json
  {
    "event_id": "37064",
    "titulo": "LOVE ME TENDER",
    "titulo_original": "LOVE ME TENDER",
    "observacion": "08 DE ABRIL DE 2026...",
    "datetime_text_original": "Wed 8 Apr 2026 20:00",
    "fecha_inicio": "2026-04-08",
    "fecha_fin": "2026-04-08",
    "hora_inicio": "20:00",
    "tipo_fecha": "simple",
    "num_sesiones_estimadas": 1,
    "tiene_multiples_sesiones": false,
    "precio_entradas": 0,
    "precio_medio_entradas": 0,
    "local": "teatro apolo almeria",
    "es_gratuito": true,
    "cartel_url": "https://www.flowte.me/cabinet/event/img/37064-....png",
    "screenshot_url": "https://storage.googleapis.com/firecrawl-scrape-media/screenshot-...",
    "ticketera_url": "https://www.flowte.me/storefront/almeria-cultura-401?e=37064"
  }
  ```

### Node 6: Insert Normalized Events (PostgreSQL)
- **Type**: `n8n-nodes-base.postgres`
- **Operation**: `executeQuery`
- **Credentials**: `zKHsX0gkTrNFTpm5` (Postgres account)
- **Query**: INSERT with ON CONFLICT UPSERT
  ```sql
  INSERT INTO raw_detalle_eventos (
    event_id, titulo, titulo_original, observacion, datetime_text_original,
    fecha_inicio, fecha_fin, hora_inicio, tipo_fecha, num_sesiones_estimadas, tiene_multiples_sesiones, precio_entradas,
    precio_medio_entradas, local, es_gratuito, cartel_url,
    screenshot_url, ticketera_url, payload_json
  ) VALUES (...)
  ON CONFLICT (event_id) DO UPDATE SET ...
  ```
- **Purpose**: Persist normalized event data
- **Rule**: for simple one-day events, `fecha_inicio` and `fecha_fin` are both set to the same date

### Future Nodes (Not Yet Implemented)
- **Download cartel + screenshot**: HTTP GET nodes to cache files locally
- **Upload to Dropbox**: `n8n-nodes-base.dropbox` (upload)
- **Insert adjuntos**: PostgreSQL INSERT into `raw_eventos_adjuntos`
- **Update front_eventos**: PostgreSQL UPDATE `detalle_leido = TRUE`

---

## 🔄 Data Flow & Operations

### Phase 1: Event Discovery (Already Implemented)
1. **Source**: Firecrawl scrapes Flowte storefront listing page
2. **Target**: `raw_front_eventos` (INSERT with UPSERT)
3. **Data**: Lightweight event listing (no parsing)
4. **Mark**: `detalle_leido = FALSE` (pending detail extraction)

### Phase 2: Detail Extraction (Currently Active)
1. **Fetch**: SELECT pending events from `raw_front_eventos`
2. **Scrape**: Firecrawl fetches full event detail page (HTML + screenshot)
3. **Parse**: Cheerio extracts 10 normalized fields
4. **Store**: INSERT into `raw_detalle_eventos` (UPSERT on event_id)
5. **Mark**: `raw_front_eventos.detalle_leido = TRUE`, `detalle_fecha = NOW()`

### Phase 3: Media Management (Future)
1. **Download**: Cartel (PNG) from Flowte + screenshot from Google Storage
2. **Upload**: Both files to Dropbox → get shared URL
3. **Record**: INSERT into `raw_eventos_adjuntos` with Dropbox URL
4. **Reference**: Store `url_dropbox` for business layer queries

### Phase 4: Business Layer (Future)
- Aggregate events by venue, date, price range
- Export to public API
- Recommend similar events
- Sync to calendar systems

---

## 🔐 Configuration & Credentials

### PostgreSQL Connection
```
n8nac credentials stored as: "Postgres account"
  ID: zKHsX0gkTrNFTpm5
  Host: 192.168.0.50
  Port: 5432
  Database: cancerbero-eventos
  User: postgres
  Password: Cancerbero123!
```

### Firecrawl API
```
n8nac credentials stored as: "Firecrawl account"
  ID: 3FsKPT3ZQeVfmMkM
  API Key: [Ask user if needed]
  Endpoint: https://api.firecrawl.dev/v0/scrape
```

### Environment Variables (Optional)
```
STOREFRONT_URL = https://www.flowte.me/storefront/almeria-cultura-401
  Used in: Firecrawl /scrape resource parameter
  Fallback: If not set, defaults to almeria-cultura-401
```

---

## 📖 Implementation Guide

### For New Scrapers (Different Storefront)

#### Step 1: Update Storefront URL
**File**: `My workflow.workflow.ts`  
**Location**: Firecrawl scrape resource node (execution query)

```typescript
specifyUrls: true,
urls: "={{ $env.STOREFRONT_URL || 'https://www.flowte.me/storefront/{NEW-CITY}-{NEW-CATEGORY}-{NEW-ID}' }}",
```

#### Step 2: Update CSS Selectors
**File**: `My workflow.workflow.ts`  
**Location**: NormalizarEventos code node

Check if CSS classes differ and update selectors:
```javascript
// Example for different site structure:
// Old: $('h3.select-event-name')
// New: $('h2.event-title') ← adjust based on target site

const titulo = $('h2.event-title').first().text().trim();
```

#### Step 3: Update Event URL Pattern
**Purpose**: Ensure `event_url` extraction matches new storefront format

In the SQL SELECT query for `raw_front_eventos`:
```sql
-- Adjust event_url construction if needed:
SELECT 
  event_id,
  event_url  -- Must be clickable full URL to event detail page
FROM raw_front_eventos
WHERE ...
```

#### Step 4: Test Against Sample Event
```bash
# Manually push updated event via webhook
npx --yes n8nac test 2qYQ1PxmsJhWhT1q --prod

# Inspect execution results
npx --yes n8nac execution get <executionId> --include-data --json | \
  jq '.data.resultData.runData["Normalizar Eventos"]'
```

#### Step 5: Verify Database Records
```bash
PGPASSWORD="Cancerbero123!" psql -h 192.168.0.50 -U postgres -d cancerbero-eventos -c \
  "SELECT event_id, titulo, local, precio_entradas FROM raw_detalle_eventos LIMIT 5;"
```

---

## ✅ Testing & Validation

### Unit Test: Normalizar Eventos Code Node

**Test Data**: Raw HTML + screenshot from Firecrawl

```javascript
// Verify all 10 fields extracted:
console.assert(output.event_id, 'Missing event_id');
console.assert(output.titulo, 'Missing titulo');
console.assert(output.fecha_inicio.match(/\d{4}-\d{2}-\d{2}/), 'Invalid fecha_inicio format');
console.assert(typeof output.tiene_multiples_sesiones === 'boolean', 'Invalid tiene_multiples_sesiones');
if (output.hora_inicio) console.assert(output.hora_inicio.match(/\d{2}:\d{2}/), 'Invalid hora_inicio format');
console.assert(typeof output.es_gratuito === 'boolean', 'es_gratuito not bool');
console.assert(output.cartel_url.match(/^https:\/\//), 'Invalid cartel_url');
console.assert(output.screenshot_url.match(/^https:\/\//), 'Invalid screenshot_url');
console.assert(output.ticketera_url.match(/^https:\/\//), 'Invalid ticketera_url');
```

### Integration Test: Full Workflow

**Trigger**: POST to webhook with manual event URL

```bash
curl -X POST http://192.168.0.50:5678/webhook/test-scraper \
  -H "Content-Type: application/json" \
  -d '{"trigger":"webhook"}'
```

**Validation Checklist**:
- [ ] Webhook execution starts
- [ ] SELECT returns pending events
- [ ] Firecrawl scrape completes (check rate limit)
- [ ] Normalizar Eventos outputs 10 fields
- [ ] PostgreSQL INSERT succeeds
- [ ] `raw_detalle_eventos` row created with correct data
- [ ] `raw_front_eventos.detalle_leido` still FALSE (manual update not yet implemented)

### Query Validation

```sql
-- Check most recent normalization
SELECT 
  event_id, titulo, local, fecha_inicio, fecha_fin, hora_inicio, tipo_fecha, precio_entradas, es_gratuito,
  DATE_TRUNC('minute', fecha_captura) as captured_at
FROM raw_detalle_eventos
ORDER BY fecha_captura DESC
LIMIT 5;

-- Check for duplicate event_ids (should have 1 row per event)
SELECT event_id, COUNT(*) as cnt
FROM raw_detalle_eventos
GROUP BY event_id
HAVING COUNT(*) > 1;

-- Check NULL pricing (indicates parsing issue)
SELECT event_id, titulo, precio_entradas, precio_medio_entradas
FROM raw_detalle_eventos
WHERE precio_entradas IS NULL OR precio_medio_entradas IS NULL;
```

---

## 🎨 Customization Guidelines

### Scenario 1: Different Site Structure (New Storefront)

**Problem**: CSS selectors don't match new site

**Solution**:
1. Inspect target page in browser (F12 → Elements)
2. Identify new CSS classes for: title, venue, date, price, image
3. Update NormalizarEventos code:
   ```javascript
   // OLD
   const titulo = $('h3.select-event-name').first().text().trim();
   // NEW
   const titulo = $('h1.event-header__title').first().text().trim();
   ```
4. Test with single event before running batch

### Scenario 2: Missing Required Fields

**Problem**: New site doesn't have free event flag or price structure differs

**Solution**:
1. Keep field names (from `raw_detalle_eventos` schema) · set to NULL or default
2. Add fallback logic:
   ```javascript
   const es_gratuito = /FREE|GRATIS|ENTRADA GRATUITA/i.test(descHtml) || false;
   const precio_entradas = prices.length > 0 ? Math.min(...prices) : 0; // Default to 0
   ```
3. Document which fields are NOT available for this scraper (add comment)

### Scenario 3: Different Date Format

**Problem**: New site shows dates as "2026-04-08" instead of "Wed 8 Apr 2026"

**Solution**:
1. Adjust parsing logic in NormalizarEventos:
   ```javascript
   // OLD: Split by space for "Wed  8 Apr 2026 20:00"
   // NEW: Simple regex for "2026-04-08"
   const dateMatch = dateTimeRaw.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
   if (dateMatch) {
     dia = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
     hora = `${dateMatch[4]}:${dateMatch[5]}`;
   }
   ```

### Scenario 4: API Rate Limiting

**Problem**: Firecrawl rate limit exceeded mid-batch

**Solution**:
1. Reduce Limit node batch size: instead of ∞, set to 3–5 events per run
2. Add Wait node after Scrape: delay 1–2 seconds between requests
3. Implement scheduled runs (e.g., hourly, every 4 hours)

### Scenario 5: Adding New Normalized Field

**Problem**: Need to extract additional data (e.g., event organizer)

**Solution**:
1. Add schema field to `raw_detalle_eventos`:
   ```sql
   ALTER TABLE raw_detalle_eventos ADD COLUMN organizador TEXT;
   ```
2. Extract in NormalizarEventos:
   ```javascript
   const organizador = $('.organizer-name').first().text().trim() || '';
   ```
3. Include in INSERT query:
   ```sql
   INSERT INTO raw_detalle_eventos (..., organizador, ...) VALUES (...);
   ```

---

## 🔧 Troubleshooting

### Problem: "Firecrawl rate limit exceeded"
**Cause**: Too many concurrent scrapes  
**Fix**:
- Reduce Limit node to 1–2 items
- Add Wait node: 2–5 seconds between items
- Increase scheduled interval (e.g., every hour instead of every 15 min)

### Problem: "Could not find property option" (n8n validation)
**Cause**: TypeScript formatter escaping regex backslashes  
**Fix**:
- Replace regex with `.split()` or `.includes()`
- Avoid `new RegExp('\\w+')` — use simple string methods instead

### Problem: "NULL values in precio_entradas"
**Cause**: Price list not found or parsed incorrectly  
**Fix**:
1. Check CSS selector: `.ticket-price span[id]`
2. Verify HTML actually contains prices
3. Add debug logging:
   ```javascript
   console.log('Prices found:', $('.ticket-price span[id]').length);
   ```
4. Adjust selector if needed

### Problem: "Cartel image missing (cartel_url empty)"
**Cause**: Selector `#select-event-img` not found  
**Fix**:
- Use manual `.each()` loop instead of direct selector
- Check if image element exists:
  ```javascript
  let cartelUrl = '';
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (src.includes('event') || src.includes('cartel')) {
      cartelUrl = src;
    }
  });
  ```

### Problem: "Execution timeout after 30 seconds"
**Cause**: Large HTML payload or slow parsing  
**Fix**:
- Check if HTML is > 1 MB (reduce screenshot resolution)
- Profile Cheerio parsing time
- Batch smaller numbers of events

### Problem: "PostgreSQL unique constraint violation"
**Cause**: Duplicate event_id inserted  
**Fix**:
1. Check `raw_detalle_eventos` for existing record:
   ```sql
   SELECT * FROM raw_detalle_eventos WHERE event_id = 'X';
   ```
2. Delete or update if stale:
   ```sql
   DELETE FROM raw_detalle_eventos WHERE event_id = 'X';
   ```
3. Re-run workflow

### Problem: "n8nac push says 'File not found'"
**Cause**: Wrong file path or missing extension  
**Fix**:
```bash
# WRONG
npx --yes n8nac push "My workflow"

# CORRECT
npx --yes n8nac push "My workflow.workflow.ts"
```

---

## 📝 Operational Checklist

### Before First Production Run
- [ ] All CSS selectors verified against target site
- [ ] PostgreSQL credentials tested (`psql` login success)
- [ ] Firecrawl API key has remaining quota
- [ ] Test event URL is accessible
- [ ] Limit node set to 1 for first test
- [ ] Full workflow execution success

### Before Batch Processing
- [ ] Rate limit strategy in place (wait time, batch size)
- [ ] Error handling checked (missing fields, parsing errors)
- [ ] Database space available (row count check)
- [ ] Backup of `raw_detalle_eventos` taken (if production critical)
- [ ] Monitoring/alerting setup (n8n execution notifications)

### Regular Maintenance
- [ ] Weekly: Check for unprocessed events (detalle_leido = FALSE)
- [ ] Monthly: Verify parsing accuracy (random sample QA)
- [ ] Quarterly: Update CSS selectors if site structure changes
- [ ] Quarterly: Archive old data if database grows > threshold

---

## 📞 Support & Notes

### Key Contacts
- **n8n Instance Admin**: Rafael
- **PostgreSQL Admin**: Local backup at `/srv/dev/sgae/n8n/db-backups/`
- **Firecrawl API**: Account linked to n8n credentials

### Known Limitations
- Firecrawl may occasionally return incomplete HTML (< 100 chars) — skip with `continue`
- Screenshot upload to Dropbox not yet implemented — cartel_url stored but not url_dropbox
- Regex patterns affected by n8n TypeScript formatter — use `.split()` instead
- CSS selectors brittle if Flowte UI updates — monitor for changes

### Future Enhancements
- [ ] Dropbox integration (automatic upload & URL storage)
- [ ] Error tagging in raw_detalle_eventos (detalle_valido flag usage)
- [ ] Scheduling module (time-based execution, backoff strategy)
- [ ] Status dashboard (events processed, errors, rate limits)
- [ ] Export API (business layer read endpoint)

---

**Document End**  
*For questions or updates to this template: Check AGENTS.md or contact Rafael*
