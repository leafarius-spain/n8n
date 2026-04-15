CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS sources (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS publisher_accounts (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES sources(id),
  ayto_id TEXT,
  account_name TEXT NOT NULL,
  account_handle TEXT,
  account_url TEXT,
  external_account_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  requiere_login BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  localidad TEXT,
  email TEXT,
  web_url TEXT,
  drive_folder_id TEXT,
  fecha_inicio_historico DATE,
  fecha_fin_historico DATE,
  ultimo_post_capturado_fecha TIMESTAMPTZ,
  ultimo_post_capturado_id TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_publisher_accounts_source_external
  ON publisher_accounts (source_id, external_account_id)
  WHERE external_account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_publisher_accounts_source_handle
  ON publisher_accounts (source_id, account_handle)
  WHERE account_handle IS NOT NULL;

CREATE TABLE IF NOT EXISTS ingest_runs (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES sources(id),
  run_type TEXT NOT NULL,
  external_run_id TEXT,
  year_target INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  records_received INTEGER NOT NULL DEFAULT 0,
  records_inserted INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  raw_payload_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ingest_runs_source_external
  ON ingest_runs (source_id, external_run_id)
  WHERE external_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ingest_runs_status_started
  ON ingest_runs (status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingest_runs_enabled_processed
  ON ingest_runs (is_enabled, processed, started_at DESC);

CREATE TABLE IF NOT EXISTS social_posts (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES sources(id),
  publisher_account_id BIGINT NOT NULL REFERENCES publisher_accounts(id),
  ingest_run_id BIGINT REFERENCES ingest_runs(id),
  idempot_key TEXT NOT NULL,
  external_post_id TEXT,
  normalized_post_url TEXT,
  post_url TEXT,
  post_type TEXT,
  is_reel BOOLEAN NOT NULL DEFAULT FALSE,
  is_video_post BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ,
  text_post_raw TEXT,
  text_post_clean TEXT,
  text_base TEXT,
  has_text BOOLEAN NOT NULL DEFAULT FALSE,
  text_length INTEGER NOT NULL DEFAULT 0,
  media_count_total INTEGER NOT NULL DEFAULT 0,
  media_items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  media_has_photo BOOLEAN NOT NULL DEFAULT FALSE,
  media_has_video BOOLEAN NOT NULL DEFAULT FALSE,
  processing_priority TEXT NOT NULL DEFAULT 'MEDIUM',
  post_status TEXT NOT NULL DEFAULT 'RAW',
  media_status TEXT NOT NULL DEFAULT 'MEDIA_PENDING',
  analysis_status TEXT NOT NULL DEFAULT 'PEND_ANALISIS',
  ingest_status TEXT NOT NULL DEFAULT 'INGEST_OK',
  error_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_social_posts_idempot_key UNIQUE (idempot_key),
  CONSTRAINT chk_social_posts_priority CHECK (processing_priority IN ('HIGH', 'MEDIUM', 'LOW'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_social_posts_source_external
  ON social_posts (source_id, external_post_id)
  WHERE external_post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_social_posts_source_url
  ON social_posts (source_id, normalized_post_url)
  WHERE normalized_post_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_posts_status_priority
  ON social_posts (post_status, media_status, analysis_status, processing_priority, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_posts_account_published
  ON social_posts (publisher_account_id, published_at DESC);

ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS media_items_json JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS post_media (
  id BIGSERIAL PRIMARY KEY,
  social_post_id BIGINT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  media_index INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  source_url TEXT NOT NULL,
  normalized_source_url TEXT,
  download_status TEXT NOT NULL DEFAULT 'MEDIA_PENDING',
  downloaded_at TIMESTAMPTZ,
  storage_path TEXT,
  mime_type TEXT,
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  hash_sha256 TEXT,
  is_relevant_candidate BOOLEAN,
  relevance_status TEXT NOT NULL DEFAULT 'IMG_DUDOSA',
  relevance_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_post_media_post_index UNIQUE (social_post_id, media_index)
);

CREATE INDEX IF NOT EXISTS idx_post_media_download_status
  ON post_media (download_status, relevance_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_media_hash
  ON post_media (hash_sha256)
  WHERE hash_sha256 IS NOT NULL;

CREATE TABLE IF NOT EXISTS media_ocr (
  id BIGSERIAL PRIMARY KEY,
  post_media_id BIGINT NOT NULL REFERENCES post_media(id) ON DELETE CASCADE,
  analysis_version TEXT NOT NULL,
  ocr_status TEXT NOT NULL DEFAULT 'OCR_PENDING',
  ocr_engine TEXT,
  ocr_confidence NUMERIC(5,2),
  ocr_text_raw TEXT,
  ocr_text_clean TEXT,
  has_meaningful_text BOOLEAN,
  has_event_visual_signals BOOLEAN,
  detected_date_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  detected_time_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  detected_price_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  detected_location_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  detected_artist_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  detected_programme_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_media_ocr_version UNIQUE (post_media_id, analysis_version)
);

CREATE INDEX IF NOT EXISTS idx_media_ocr_status_version
  ON media_ocr (ocr_status, analysis_version, processed_at DESC);

CREATE TABLE IF NOT EXISTS post_analysis (
  id BIGSERIAL PRIMARY KEY,
  social_post_id BIGINT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  analysis_version TEXT NOT NULL,
  analysis_status TEXT NOT NULL DEFAULT 'PENDING',
  has_relevant_media BOOLEAN NOT NULL DEFAULT FALSE,
  has_relevant_text BOOLEAN NOT NULL DEFAULT FALSE,
  combined_text TEXT,
  combined_signals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  matched_labels_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  event_detection_status TEXT NOT NULL DEFAULT 'NO_DECISION',
  event_detection_score NUMERIC(6,3),
  event_detection_reason TEXT,
  ambiguity_status TEXT,
  needs_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
  source_detection TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_post_analysis_version UNIQUE (social_post_id, analysis_version)
);

CREATE INDEX IF NOT EXISTS idx_post_analysis_status_version
  ON post_analysis (analysis_status, analysis_version, processed_at DESC);

CREATE TABLE IF NOT EXISTS candidate_events (
  id BIGSERIAL PRIMARY KEY,
  social_post_id BIGINT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  post_analysis_id BIGINT REFERENCES post_analysis(id) ON DELETE SET NULL,
  analysis_version TEXT NOT NULL,
  candidate_index INTEGER NOT NULL DEFAULT 1,
  candidate_status TEXT NOT NULL,
  event_fingerprint TEXT,
  event_name_candidate TEXT,
  event_date_candidate DATE,
  event_time_candidate TEXT,
  event_type_candidate TEXT,
  location_candidate TEXT,
  municipio_candidate TEXT,
  organizer_candidate TEXT,
  source_detection TEXT,
  confidence_score NUMERIC(6,3),
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  review_status TEXT,
  review_notes TEXT,
  is_processed_final BOOLEAN NOT NULL DEFAULT FALSE,
  export_to_sheet BOOLEAN NOT NULL DEFAULT FALSE,
  sheet_export_key TEXT,
  sheet_exported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_candidate_events_version UNIQUE (social_post_id, analysis_version, candidate_index)
);

CREATE INDEX IF NOT EXISTS idx_candidate_events_status_review
  ON candidate_events (candidate_status, is_processed_final, needs_review, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_candidate_events_fingerprint
  ON candidate_events (event_fingerprint)
  WHERE event_fingerprint IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_candidate_events_sheet_export_key
  ON candidate_events (sheet_export_key)
  WHERE sheet_export_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS processing_logs (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  workflow_name TEXT,
  phase TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processing_logs_entity
  ON processing_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_processing_logs_phase_status
  ON processing_logs (phase, status, created_at DESC);

CREATE OR REPLACE FUNCTION social_register_ingest_run(payload jsonb)
RETURNS TABLE (ingest_run_id BIGINT, was_created BOOLEAN) AS $$
DECLARE
  v_source_id BIGINT;
  v_source_code TEXT := UPPER(COALESCE(payload->>'source_code', 'FACEBOOK'));
  v_run_type TEXT := COALESCE(NULLIF(payload->>'run_type', ''), 'INCREMENTAL');
  v_external_run_id TEXT := NULLIF(payload->>'external_run_id', '');
  v_year_target INTEGER := NULLIF(payload->>'year_target', '')::INTEGER;
  v_records_received INTEGER := COALESCE(NULLIF(payload->>'records_received', '')::INTEGER, 0);
  v_raw_payload_path TEXT := NULLIF(payload->>'raw_payload_path', '');
  v_notes TEXT := NULLIF(payload->>'notes', '');
BEGIN
  SELECT id INTO v_source_id
  FROM sources
  WHERE code = v_source_code;

  IF v_source_id IS NULL THEN
    RAISE EXCEPTION 'Unknown source code: %', v_source_code;
  END IF;

  IF v_external_run_id IS NOT NULL THEN
    INSERT INTO ingest_runs (
      source_id,
      run_type,
      external_run_id,
      year_target,
      status,
      processed,
      is_enabled,
      records_received,
      raw_payload_path,
      notes
    ) VALUES (
      v_source_id,
      v_run_type,
      v_external_run_id,
      v_year_target,
      'RUNNING',
      FALSE,
      TRUE,
      v_records_received,
      v_raw_payload_path,
      v_notes
    )
    ON CONFLICT (source_id, external_run_id) WHERE external_run_id IS NOT NULL
    DO UPDATE SET
      run_type = EXCLUDED.run_type,
      year_target = COALESCE(EXCLUDED.year_target, ingest_runs.year_target),
      status = CASE WHEN ingest_runs.is_enabled = FALSE THEN 'RUNNING' ELSE 'RUNNING' END,
      processed = FALSE,
      is_enabled = TRUE,
      records_received = GREATEST(ingest_runs.records_received, EXCLUDED.records_received),
      raw_payload_path = COALESCE(EXCLUDED.raw_payload_path, ingest_runs.raw_payload_path),
      notes = COALESCE(EXCLUDED.notes, ingest_runs.notes),
      updated_at = NOW()
    RETURNING id, (xmax = 0) INTO ingest_run_id, was_created;
  ELSE
    INSERT INTO ingest_runs (
      source_id,
      run_type,
      year_target,
      status,
      processed,
      is_enabled,
      records_received,
      raw_payload_path,
      notes
    ) VALUES (
      v_source_id,
      v_run_type,
      v_year_target,
      'RUNNING',
      FALSE,
      TRUE,
      v_records_received,
      v_raw_payload_path,
      v_notes
    )
    RETURNING id, TRUE INTO ingest_run_id, was_created;
  END IF;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION upsert_social_post_payload(payload jsonb)
RETURNS TABLE (
  post_id BIGINT,
  publisher_account_id BIGINT,
  source_id BIGINT,
  out_idempot_key TEXT,
  was_inserted BOOLEAN
) AS $$
DECLARE
  v_source_id BIGINT;
  v_source_code TEXT := UPPER(COALESCE(payload->>'source_code', 'FACEBOOK'));
  v_ingest_run_id BIGINT := NULLIF(payload->>'ingest_run_id', '')::BIGINT;
  v_ayto_id TEXT := NULLIF(payload->>'ayto_id', '');
  v_account_name TEXT := COALESCE(NULLIF(payload->>'account_name', ''), 'Unknown account');
  v_account_handle TEXT := NULLIF(payload->>'account_handle', '');
  v_account_url TEXT := NULLIF(payload->>'account_url', '');
  v_external_account_id TEXT := NULLIF(payload->>'external_account_id', '');
  v_external_post_id TEXT := NULLIF(payload->>'external_post_id', '');
  v_post_url TEXT := NULLIF(payload->>'post_url', '');
  v_normalized_post_url TEXT := NULLIF(payload->>'normalized_post_url', '');
  v_post_type TEXT := NULLIF(payload->>'post_type', '');
  v_is_reel BOOLEAN := COALESCE((payload->>'is_reel')::BOOLEAN, FALSE);
  v_is_video_post BOOLEAN := COALESCE((payload->>'is_video_post')::BOOLEAN, FALSE);
  v_published_at TIMESTAMPTZ := NULLIF(payload->>'published_at', '')::TIMESTAMPTZ;
  v_scraped_at TIMESTAMPTZ := NULLIF(payload->>'scraped_at', '')::TIMESTAMPTZ;
  v_text_post_raw TEXT := NULLIF(payload->>'text_post_raw', '');
  v_text_post_clean TEXT := NULLIF(payload->>'text_post_clean', '');
  v_text_base TEXT := NULLIF(payload->>'text_base', '');
  v_has_text BOOLEAN := COALESCE((payload->>'has_text')::BOOLEAN, FALSE);
  v_text_length INTEGER := COALESCE(NULLIF(payload->>'text_length', '')::INTEGER, 0);
  v_media_count_total INTEGER := COALESCE(NULLIF(payload->>'media_count_total', '')::INTEGER, 0);
  v_media_items_json JSONB := COALESCE(payload->'media_items_json', '[]'::jsonb);
  v_media_has_photo BOOLEAN := COALESCE((payload->>'media_has_photo')::BOOLEAN, FALSE);
  v_media_has_video BOOLEAN := COALESCE((payload->>'media_has_video')::BOOLEAN, FALSE);
  v_processing_priority TEXT := COALESCE(NULLIF(payload->>'processing_priority', ''), 'MEDIUM');
  v_raw_payload_json JSONB := COALESCE(payload->'raw_payload_json', payload);
  v_publisher_account_id BIGINT;
  v_post_id BIGINT;
  v_idempot_key TEXT := NULLIF(payload->>'idempot_key', '');
  v_was_inserted BOOLEAN;
BEGIN
  SELECT id INTO v_source_id
  FROM sources
  WHERE code = v_source_code;

  IF v_source_id IS NULL THEN
    RAISE EXCEPTION 'Unknown source code: %', v_source_code;
  END IF;

  SELECT pa.id INTO v_publisher_account_id
  FROM publisher_accounts pa
  WHERE pa.source_id = v_source_id
    AND (
      (v_external_account_id IS NOT NULL AND pa.external_account_id = v_external_account_id)
      OR (v_external_account_id IS NULL AND v_account_handle IS NOT NULL AND pa.account_handle = v_account_handle)
      OR (v_external_account_id IS NULL AND v_account_handle IS NULL AND v_account_url IS NOT NULL AND pa.account_url = v_account_url)
    )
  ORDER BY pa.id
  LIMIT 1;

  IF v_publisher_account_id IS NULL THEN
    INSERT INTO publisher_accounts (
      source_id,
      ayto_id,
      account_name,
      account_handle,
      account_url,
      external_account_id,
      is_active,
      notes
    ) VALUES (
      v_source_id,
      v_ayto_id,
      v_account_name,
      v_account_handle,
      v_account_url,
      v_external_account_id,
      TRUE,
      'Created from social ingest pipeline'
    )
    RETURNING id INTO v_publisher_account_id;
  ELSE
    UPDATE publisher_accounts
    SET
      ayto_id = COALESCE(v_ayto_id, ayto_id),
      account_name = COALESCE(v_account_name, account_name),
      account_handle = COALESCE(v_account_handle, account_handle),
      account_url = COALESCE(v_account_url, account_url),
      external_account_id = COALESCE(v_external_account_id, external_account_id),
      updated_at = NOW()
    WHERE id = v_publisher_account_id;
  END IF;

  IF v_idempot_key IS NULL THEN
    IF v_external_post_id IS NOT NULL THEN
      v_idempot_key := v_source_code || ':' || v_external_post_id;
    ELSIF v_normalized_post_url IS NOT NULL THEN
      v_idempot_key := ENCODE(DIGEST(v_source_code || ':' || v_normalized_post_url, 'sha256'), 'hex');
    ELSE
      RAISE EXCEPTION 'Unable to build idempot_key for payload: %', payload;
    END IF;
  END IF;

  INSERT INTO social_posts (
    source_id,
    publisher_account_id,
    ingest_run_id,
    idempot_key,
    external_post_id,
    normalized_post_url,
    post_url,
    post_type,
    is_reel,
    is_video_post,
    published_at,
    scraped_at,
    text_post_raw,
    text_post_clean,
    text_base,
    has_text,
    text_length,
    media_count_total,
    media_items_json,
    media_has_photo,
    media_has_video,
    processing_priority,
    post_status,
    media_status,
    analysis_status,
    ingest_status,
    raw_payload_json
  ) VALUES (
    v_source_id,
    v_publisher_account_id,
    v_ingest_run_id,
    v_idempot_key,
    v_external_post_id,
    v_normalized_post_url,
    v_post_url,
    v_post_type,
    v_is_reel,
    v_is_video_post,
    v_published_at,
    v_scraped_at,
    v_text_post_raw,
    v_text_post_clean,
    v_text_base,
    v_has_text,
    v_text_length,
    v_media_count_total,
    v_media_items_json,
    v_media_has_photo,
    v_media_has_video,
    v_processing_priority,
    'RAW',
    'MEDIA_PENDING',
    'PEND_ANALISIS',
    'INGEST_OK',
    v_raw_payload_json
  )
  ON CONFLICT (idempot_key)
  DO UPDATE SET
    publisher_account_id = EXCLUDED.publisher_account_id,
    ingest_run_id = COALESCE(EXCLUDED.ingest_run_id, social_posts.ingest_run_id),
    external_post_id = COALESCE(EXCLUDED.external_post_id, social_posts.external_post_id),
    normalized_post_url = COALESCE(EXCLUDED.normalized_post_url, social_posts.normalized_post_url),
    post_url = COALESCE(EXCLUDED.post_url, social_posts.post_url),
    post_type = COALESCE(EXCLUDED.post_type, social_posts.post_type),
    is_reel = EXCLUDED.is_reel,
    is_video_post = EXCLUDED.is_video_post,
    published_at = COALESCE(EXCLUDED.published_at, social_posts.published_at),
    scraped_at = COALESCE(EXCLUDED.scraped_at, social_posts.scraped_at),
    text_post_raw = COALESCE(EXCLUDED.text_post_raw, social_posts.text_post_raw),
    text_post_clean = COALESCE(EXCLUDED.text_post_clean, social_posts.text_post_clean),
    text_base = COALESCE(EXCLUDED.text_base, social_posts.text_base),
    has_text = EXCLUDED.has_text,
    text_length = EXCLUDED.text_length,
    media_count_total = EXCLUDED.media_count_total,
    media_items_json = EXCLUDED.media_items_json,
    media_has_photo = EXCLUDED.media_has_photo,
    media_has_video = EXCLUDED.media_has_video,
    processing_priority = EXCLUDED.processing_priority,
    raw_payload_json = EXCLUDED.raw_payload_json,
    updated_at = NOW()
  RETURNING id, (xmax = 0) INTO v_post_id, v_was_inserted;

  -- Expand media items from media_items_json into post_media rows (atomic, same transaction)
  INSERT INTO post_media (social_post_id, media_index, media_type, source_url, normalized_source_url)
  SELECT
    v_post_id,
    (item->>'media_index')::INTEGER,
    COALESCE(NULLIF(item->>'media_type', ''), 'IMAGE'),
    item->>'source_url',
    NULLIF(item->>'normalized_source_url', '')
  FROM jsonb_array_elements(v_media_items_json) AS item
  WHERE NULLIF(item->>'source_url', '') IS NOT NULL
  ON CONFLICT (social_post_id, media_index) DO UPDATE SET
    media_type = EXCLUDED.media_type,
    source_url = EXCLUDED.source_url,
    normalized_source_url = EXCLUDED.normalized_source_url,
    updated_at = NOW()
  WHERE post_media.download_status = 'MEDIA_PENDING';

  post_id := v_post_id;
  publisher_account_id := v_publisher_account_id;
  source_id := v_source_id;
  out_idempot_key := v_idempot_key;
  was_inserted := v_was_inserted;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sources_set_updated_at ON sources;
CREATE TRIGGER trg_sources_set_updated_at
BEFORE UPDATE ON sources
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_publisher_accounts_set_updated_at ON publisher_accounts;
CREATE TRIGGER trg_publisher_accounts_set_updated_at
BEFORE UPDATE ON publisher_accounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ingest_runs_set_updated_at ON ingest_runs;
CREATE TRIGGER trg_ingest_runs_set_updated_at
BEFORE UPDATE ON ingest_runs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_social_posts_set_updated_at ON social_posts;
CREATE TRIGGER trg_social_posts_set_updated_at
BEFORE UPDATE ON social_posts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_post_media_set_updated_at ON post_media;
CREATE TRIGGER trg_post_media_set_updated_at
BEFORE UPDATE ON post_media
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_media_ocr_set_updated_at ON media_ocr;
CREATE TRIGGER trg_media_ocr_set_updated_at
BEFORE UPDATE ON media_ocr
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_post_analysis_set_updated_at ON post_analysis;
CREATE TRIGGER trg_post_analysis_set_updated_at
BEFORE UPDATE ON post_analysis
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_candidate_events_set_updated_at ON candidate_events;
CREATE TRIGGER trg_candidate_events_set_updated_at
BEFORE UPDATE ON candidate_events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO sources (code, name, is_active)
VALUES
  ('FACEBOOK', 'Facebook', TRUE),
  ('INSTAGRAM', 'Instagram', FALSE)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Add extra columns to publisher_accounts (idempotent, safe to re-run)
ALTER TABLE publisher_accounts ADD COLUMN IF NOT EXISTS requiere_login BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE publisher_accounts ADD COLUMN IF NOT EXISTS localidad TEXT;
ALTER TABLE publisher_accounts ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE publisher_accounts ADD COLUMN IF NOT EXISTS web_url TEXT;
ALTER TABLE publisher_accounts ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
ALTER TABLE publisher_accounts ADD COLUMN IF NOT EXISTS fecha_inicio_historico DATE;
ALTER TABLE publisher_accounts ADD COLUMN IF NOT EXISTS fecha_fin_historico DATE;
ALTER TABLE publisher_accounts ADD COLUMN IF NOT EXISTS ultimo_post_capturado_fecha TIMESTAMPTZ;
ALTER TABLE publisher_accounts ADD COLUMN IF NOT EXISTS ultimo_post_capturado_id TEXT;
ALTER TABLE publisher_accounts ADD COLUMN IF NOT EXISTS observaciones TEXT;

-- Ingest run state flags (idempotent, safe to re-run)
ALTER TABLE ingest_runs ADD COLUMN IF NOT EXISTS processed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ingest_runs ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_ingest_runs_enabled_processed
  ON ingest_runs (is_enabled, processed, started_at DESC);