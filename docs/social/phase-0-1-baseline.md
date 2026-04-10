# Social Pipeline Phase 0-1 Baseline

## Phase 0 Decisions

- Database server: reuse the current PostgreSQL server at `192.168.0.50:5432`.
- Database name: `cancerbero_social`.
- Connection user: `postgres`.
- Credentials strategy: keep existing event DB variables untouched and add dedicated `SOCIAL_DB_*` variables in `.env`.
- Binary media storage: local filesystem under `/srv/dev/sgae/n8n/data/social-media`.
- Media path layout: `source_code/account_slug/yyyy/mm/idempot_key/media_index-original_name`.
- Raw payload policy: store the full provider payload in `JSONB` inside PostgreSQL for V1; add `raw_payload_path` only for future overflow cases.
- Media retention policy: keep successfully downloaded media in V1 with no automatic deletion yet; defer cleanup automation until reprocesado is in place.
- OCR engine for V1: local PaddleOCR service at `http://127.0.0.1:5000`.
- Backup strategy: nightly PostgreSQL dump to `/srv/dev/sgae/n8n/db-backups/social` plus filesystem backup of `/srv/dev/sgae/n8n/data/social-media` handled outside the workflow layer.
- Multi-source rule: Facebook is the only active source in V1, but schema and workflows remain source-agnostic.
- Universal key: `idempot_key = source_code + ':' + external_post_id`, with fallback to `sha256(normalized_post_url)` when the provider identifier is missing or unstable.
- Event deduplication key: `event_fingerprint = sha256(event_name_candidate + '|' + event_date_candidate + '|' + municipio_candidate + '|' + source_code)`.

## Phase 1 Scope

The initial schema includes the core entities needed for ingest, media handling, OCR, consolidated analysis, candidate events and traceability:

- `sources`
- `publisher_accounts`
- `ingest_runs`
- `social_posts`
- `post_media`
- `media_ocr`
- `post_analysis`
- `candidate_events`
- `processing_logs`

## Implementation Notes

- `post_analysis` stores technical detection only: signals, scores, flags and combined evidence.
- `candidate_events` stores the operational decision and export lifecycle.
- `processing_priority` is defined on `social_posts` for queue control.
- `is_processed_final` and `source_detection` are defined on `candidate_events` for downstream operations.
- The initial schema seeds `FACEBOOK` and `INSTAGRAM` in `sources`, but only Facebook should be processed in V1.