-- Add dedicated Bright Data fields to social_posts and keep them synced from raw_payload_json.

ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_user_url TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_user_username_raw TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_num_comments INTEGER;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_num_shares INTEGER;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_likes INTEGER;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_num_likes_type JSONB;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_count_reactions_type JSONB;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_page_name TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_profile_id TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_page_intro TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_page_category TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_page_logo TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_page_external_website TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_page_followers INTEGER;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_page_is_verified BOOLEAN;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_attachments JSONB;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_post_external_link TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_post_external_title TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_post_external_image TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_page_url TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_header_image TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_avatar_image_url TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_profile_handle TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_is_sponsored BOOLEAN;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_shortcode TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_post_image TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_following INTEGER;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_link_description_text TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_is_page BOOLEAN;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_page_phone TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_page_email TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_page_creation_time TIMESTAMPTZ;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_page_reviews_score TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_page_reviewers_amount INTEGER;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_page_price_range TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_about JSONB;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_active_ads_urls JSONB;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_delegate_page_id TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_privacy_and_legal_info TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_play_count INTEGER;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_video_view_count INTEGER;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_hashtags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_source_code TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_timestamp TIMESTAMPTZ;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS bd_input JSONB;

CREATE OR REPLACE FUNCTION social_posts_sync_brightdata_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.bd_user_url := NULLIF(NEW.raw_payload_json->>'user_url', '');
  NEW.bd_user_username_raw := NULLIF(NEW.raw_payload_json->>'user_username_raw', '');

  NEW.bd_num_comments := CASE
    WHEN COALESCE(NEW.raw_payload_json->>'num_comments', '') ~ '^-?[0-9]+$'
      THEN (NEW.raw_payload_json->>'num_comments')::INTEGER
    ELSE NULL
  END;

  NEW.bd_num_shares := CASE
    WHEN COALESCE(NEW.raw_payload_json->>'num_shares', '') ~ '^-?[0-9]+$'
      THEN (NEW.raw_payload_json->>'num_shares')::INTEGER
    ELSE NULL
  END;

  NEW.bd_likes := CASE
    WHEN COALESCE(NEW.raw_payload_json->>'likes', '') ~ '^-?[0-9]+$'
      THEN (NEW.raw_payload_json->>'likes')::INTEGER
    ELSE NULL
  END;

  NEW.bd_num_likes_type := COALESCE(NEW.raw_payload_json->'num_likes_type', '{}'::jsonb);
  NEW.bd_count_reactions_type := COALESCE(NEW.raw_payload_json->'count_reactions_type', '[]'::jsonb);

  NEW.bd_page_name := NULLIF(NEW.raw_payload_json->>'page_name', '');
  NEW.bd_profile_id := NULLIF(NEW.raw_payload_json->>'profile_id', '');
  NEW.bd_page_intro := NULLIF(NEW.raw_payload_json->>'page_intro', '');
  NEW.bd_page_category := NULLIF(NEW.raw_payload_json->>'page_category', '');
  NEW.bd_page_logo := NULLIF(NEW.raw_payload_json->>'page_logo', '');
  NEW.bd_page_external_website := NULLIF(NEW.raw_payload_json->>'page_external_website', '');

  NEW.bd_page_followers := CASE
    WHEN COALESCE(NEW.raw_payload_json->>'page_followers', '') ~ '^-?[0-9]+$'
      THEN (NEW.raw_payload_json->>'page_followers')::INTEGER
    ELSE NULL
  END;

  NEW.bd_page_is_verified := CASE
    WHEN LOWER(COALESCE(NEW.raw_payload_json->>'page_is_verified', '')) IN ('true', 'false')
      THEN (NEW.raw_payload_json->>'page_is_verified')::BOOLEAN
    ELSE NULL
  END;

  NEW.bd_attachments := COALESCE(NEW.raw_payload_json->'attachments', '[]'::jsonb);

  NEW.bd_post_external_link := NULLIF(NEW.raw_payload_json->>'post_external_link', '');
  NEW.bd_post_external_title := NULLIF(NEW.raw_payload_json->>'post_external_title', '');
  NEW.bd_post_external_image := NULLIF(NEW.raw_payload_json->>'post_external_image', '');

  NEW.bd_page_url := NULLIF(NEW.raw_payload_json->>'page_url', '');
  NEW.bd_header_image := NULLIF(NEW.raw_payload_json->>'header_image', '');
  NEW.bd_avatar_image_url := NULLIF(NEW.raw_payload_json->>'avatar_image_url', '');
  NEW.bd_profile_handle := NULLIF(NEW.raw_payload_json->>'profile_handle', '');

  NEW.bd_is_sponsored := CASE
    WHEN LOWER(COALESCE(NEW.raw_payload_json->>'is_sponsored', '')) IN ('true', 'false')
      THEN (NEW.raw_payload_json->>'is_sponsored')::BOOLEAN
    ELSE NULL
  END;

  NEW.bd_shortcode := NULLIF(NEW.raw_payload_json->>'shortcode', '');
  NEW.bd_post_image := NULLIF(NEW.raw_payload_json->>'post_image', '');

  NEW.bd_following := CASE
    WHEN COALESCE(NEW.raw_payload_json->>'following', '') ~ '^-?[0-9]+$'
      THEN (NEW.raw_payload_json->>'following')::INTEGER
    ELSE NULL
  END;

  NEW.bd_link_description_text := NULLIF(NEW.raw_payload_json->>'link_description_text', '');

  NEW.bd_is_page := CASE
    WHEN LOWER(COALESCE(NEW.raw_payload_json->>'is_page', '')) IN ('true', 'false')
      THEN (NEW.raw_payload_json->>'is_page')::BOOLEAN
    ELSE NULL
  END;

  NEW.bd_page_phone := NULLIF(NEW.raw_payload_json->>'page_phone', '');
  NEW.bd_page_email := NULLIF(NEW.raw_payload_json->>'page_email', '');

  NEW.bd_page_creation_time := CASE
    WHEN NULLIF(NEW.raw_payload_json->>'page_creation_time', '') IS NOT NULL
      THEN (NEW.raw_payload_json->>'page_creation_time')::timestamptz
    ELSE NULL
  END;

  NEW.bd_page_reviews_score := NULLIF(NEW.raw_payload_json->>'page_reviews_score', '');

  NEW.bd_page_reviewers_amount := CASE
    WHEN COALESCE(NEW.raw_payload_json->>'page_reviewers_amount', '') ~ '^-?[0-9]+$'
      THEN (NEW.raw_payload_json->>'page_reviewers_amount')::INTEGER
    ELSE NULL
  END;

  NEW.bd_page_price_range := NULLIF(NEW.raw_payload_json->>'page_price_range', '');
  NEW.bd_about := COALESCE(NEW.raw_payload_json->'about', '[]'::jsonb);
  NEW.bd_active_ads_urls := COALESCE(NEW.raw_payload_json->'active_ads_urls', '[]'::jsonb);
  NEW.bd_delegate_page_id := NULLIF(NEW.raw_payload_json->>'delegate_page_id', '');
  NEW.bd_privacy_and_legal_info := NULLIF(NEW.raw_payload_json->>'privacy_and_legal_info', '');

  NEW.bd_play_count := CASE
    WHEN COALESCE(NEW.raw_payload_json->>'play_count', '') ~ '^-?[0-9]+$'
      THEN (NEW.raw_payload_json->>'play_count')::INTEGER
    ELSE NULL
  END;

  NEW.bd_video_view_count := CASE
    WHEN COALESCE(NEW.raw_payload_json->>'video_view_count', '') ~ '^-?[0-9]+$'
      THEN (NEW.raw_payload_json->>'video_view_count')::INTEGER
    ELSE NULL
  END;

  NEW.bd_hashtags := COALESCE(NEW.raw_payload_json->'hashtags', '[]'::jsonb);
  NEW.bd_source_code := NULLIF(NEW.raw_payload_json->>'source_code', '');

  NEW.bd_timestamp := CASE
    WHEN NULLIF(NEW.raw_payload_json->>'timestamp', '') IS NOT NULL
      THEN (NEW.raw_payload_json->>'timestamp')::timestamptz
    ELSE NULL
  END;

  NEW.bd_input := COALESCE(NEW.raw_payload_json->'input', '{}'::jsonb);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_social_posts_sync_brightdata_fields ON social_posts;
CREATE TRIGGER trg_social_posts_sync_brightdata_fields
BEFORE INSERT OR UPDATE OF raw_payload_json ON social_posts
FOR EACH ROW
EXECUTE FUNCTION social_posts_sync_brightdata_fields();

-- Backfill existing rows from raw payload.
UPDATE social_posts
SET raw_payload_json = COALESCE(raw_payload_json, '{}'::jsonb)
WHERE raw_payload_json IS NOT NULL;
