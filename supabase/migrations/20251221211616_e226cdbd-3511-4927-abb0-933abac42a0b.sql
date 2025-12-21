-- Migration: Create :legacy instance tokens for orphaned base L00 tokens
-- This establishes clean parent references for historical L01 tokens and url_events

DO $$
DECLARE
  base_token RECORD;
  legacy_token TEXT;
BEGIN
  -- Find all base L00 tokens that need legacy instances
  -- (format l00-* without : that have L01 children OR url_events)
  FOR base_token IN 
    SELECT DISTINCT t.* 
    FROM tokens t
    WHERE t.token LIKE 'l00-%' 
      AND t.token NOT LIKE '%:%'
      AND (
        EXISTS (SELECT 1 FROM tokens c WHERE c.parent_token = t.token AND c.level = 1)
        OR EXISTS (SELECT 1 FROM url_events e WHERE e.token = t.token)
      )
  LOOP
    legacy_token := base_token.token || ':legacy';
    
    -- Create the legacy instance token
    INSERT INTO tokens (
      token, parent_token, root_token, level, eoa_id, deck_slug,
      utm_campaign, utm_id, utm_content, utm_medium, utm_source,
      full_url, created_by, minted_at, deck_version_at_mint, is_simulated
    ) VALUES (
      legacy_token,
      base_token.token,
      base_token.token,
      0,
      base_token.eoa_id,
      base_token.deck_slug,
      base_token.utm_campaign,
      base_token.utm_id,
      base_token.utm_content,
      base_token.utm_medium,
      base_token.utm_source,
      REPLACE(base_token.full_url, 't=' || base_token.token, 't=' || legacy_token),
      base_token.created_by,
      base_token.minted_at,
      base_token.deck_version_at_mint,
      base_token.is_simulated
    )
    ON CONFLICT (token) DO NOTHING;
    
    -- Update L01 children to point to legacy instance
    UPDATE tokens 
    SET parent_token = legacy_token
    WHERE parent_token = base_token.token 
      AND level = 1;
    
    -- Update url_events to use legacy instance
    UPDATE url_events 
    SET token = legacy_token
    WHERE token = base_token.token;
    
    RAISE NOTICE 'Migrated: % -> %', base_token.token, legacy_token;
  END LOOP;
END $$;