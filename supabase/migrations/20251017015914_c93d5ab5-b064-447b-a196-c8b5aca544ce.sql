-- Update utm_id from 'ma-nkd25-02' to 'nk-pst' across all tables

-- Update events_actions table
UPDATE events_actions 
SET utm_id = 'nk-pst'
WHERE utm_id = 'ma-nkd25-02';

-- Update tokens table utm_id
UPDATE tokens 
SET utm_id = 'nk-pst'
WHERE utm_id = 'ma-nkd25-02';

-- Regenerate full_url for affected tokens
UPDATE tokens
SET full_url = format(
  'https://omega-resist.lovable.app/deck/%s?utm_campaign=%s&utm_id=%s&utm_source=%s&utm_medium=%s%s&t=%s%s&v_lvl=%s',
  deck_slug,
  utm_campaign,
  'nk-pst',
  utm_source,
  utm_medium,
  CASE WHEN utm_content IS NOT NULL THEN '&utm_content=' || utm_content ELSE '' END,
  token,
  CASE WHEN parent_token IS NOT NULL THEN '&p=' || parent_token ELSE '' END,
  lpad(level::TEXT, 2, '0')
)
WHERE utm_id = 'nk-pst';