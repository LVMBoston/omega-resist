-- ============================================================================
-- Viral Tokens E2E Testing Playbook
-- ============================================================================

-- ============================================================================
-- 1) MINT FLOW TEST (L00 → L01 → L02)
-- ============================================================================

-- Get the IDs we need for testing
SELECT 
  ea.id as eoa_id,
  p.id as placement_id,
  ea.utm_id,
  c.code as campaign_code
FROM events_actions ea
JOIN campaigns c ON ea.campaign_id = c.id
CROSS JOIN placements p
WHERE c.code = 'no-kings' 
  AND ea.utm_id = 'nkd25_02'
  AND p.code = 'rally-site-001';

-- Mint L00 token (replace UUIDs with values from above)
-- Note: You must be authenticated as admin or manager to run this
SELECT * FROM mint_l00(
  '00000000-0000-0000-0000-000000000000'::uuid,  -- eoa_id (replace)
  '00000000-0000-0000-0000-000000000000'::uuid,  -- placement_id (replace)
  'falmouth-preview',                             -- deck_slug
  'qr'                                            -- utm_medium
);

-- ⚠️ SAVE THE TOKEN FROM ABOVE AS 't0' ⚠️

-- Mint L01 (share from L00 via SMS)
-- Replace 'abc12345' with actual t0 token from above
SELECT * FROM mint_share('abc12345', 'sms');

-- ⚠️ SAVE THE TOKEN AS 't1' ⚠️

-- Mint L02 (share from L01 via email)
-- Replace 'def67890' with actual t1 token from above
SELECT * FROM mint_share('def67890', 'em');

-- ⚠️ SAVE THE TOKEN AS 't2' ⚠️

-- ============================================================================
-- 2) EVENT LOGGING TEST
-- ============================================================================

-- Log scan event (L00 token, QR code scan)
SELECT log_event(
  'abc12345',                        -- token (replace with t0)
  'scan',                            -- event_type
  jsonb_build_object(
    'utm_source', 'L00',
    'utm_medium', 'qr',
    'utm_campaign', 'no-kings',
    'utm_content', 'rally-site-001',
    'h', 'qr'
  ),
  '203.0.113.9'::inet,               -- ip_address
  'Mozilla/5.0 TestAgent'            -- user_agent
);

-- Log view event (user opened the deck)
SELECT log_event(
  'abc12345',                        -- token (replace with t0)
  'view',
  jsonb_build_object(
    'utm_source', 'L00',
    'utm_medium', 'qr'
  ),
  '203.0.113.9'::inet,
  'Mozilla/5.0 TestAgent'
);

-- Log view event for L01 token (shared via SMS)
SELECT log_event(
  'def67890',                        -- token (replace with t1)
  'view',
  jsonb_build_object(
    'utm_source', 'L01',
    'utm_medium', 'sms'
  ),
  '203.0.113.10'::inet,
  'Mozilla/5.0 TestAgent'
);

-- ============================================================================
-- 3) STRUCTURAL INTEGRITY CHECKS
-- ============================================================================

-- Check level progression (replace tokens)
SELECT token, level, parent_token, root_token
FROM tokens
WHERE token IN ('abc12345', 'def67890', 'ghi11111')
ORDER BY level;

-- Verify parent/child share the same root
SELECT 
  child.token as child_token,
  child.root_token as child_root,
  parent.token as parent_token,
  parent.root_token as parent_root,
  CASE 
    WHEN child.root_token = parent.root_token THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as root_consistency
FROM tokens child
JOIN tokens parent ON child.parent_token = parent.token
WHERE child.token IN ('def67890', 'ghi11111');  -- L01, L02 tokens

-- Check no level > 3 exists
SELECT token, level, 
  CASE WHEN level > 3 THEN '✗ FAIL' ELSE '✓ PASS' END as level_check
FROM tokens
ORDER BY level DESC
LIMIT 10;

-- ============================================================================
-- 4) UTM & CONSISTENCY CHECKS
-- ============================================================================

-- View stamped UTM parameters
SELECT token, level, utm_source, utm_medium, utm_campaign, utm_content
FROM tokens
WHERE token IN ('abc12345', 'def67890', 'ghi11111')
ORDER BY level;

-- View logged event UTM snapshots
SELECT token, event_type, utm_snapshot, occurred_at
FROM url_events
WHERE token IN ('abc12345', 'def67890', 'ghi11111')
ORDER BY occurred_at;

-- ============================================================================
-- 5) AGGREGATES SANITY CHECK
-- ============================================================================

-- Refresh aggregates (call this periodically or via cron)
SELECT refresh_daily_aggregates();

-- View aggregates by date and level (replace root token)
SELECT date, level, scans, views, shares, unique_tokens
FROM daily_aggregates
WHERE campaign_id = (SELECT campaign_id FROM events_actions WHERE utm_id = 'nkd25_02')
ORDER BY date DESC, level;

-- Compare aggregates to raw events (should match)
SELECT
  date_trunc('day', e.occurred_at)::date as date,
  t.level,
  COUNT(*) FILTER (WHERE e.event_type = 'scan') as scans,
  COUNT(*) FILTER (WHERE e.event_type = 'view') as views,
  COUNT(*) FILTER (WHERE e.event_type = 'share') as shares,
  COUNT(DISTINCT t.token) as unique_tokens
FROM url_events e
JOIN tokens t ON e.token = t.token
WHERE t.root_token = 'abc12345'  -- replace with actual root token
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- ============================================================================
-- 6) RLS TRIPWIRE CHECKS
-- ============================================================================

-- ⚠️ These should FAIL with permission denied ⚠️

-- Attempt direct insert into url_events (should fail)
-- This should only work via log_event() function
INSERT INTO url_events (token, event_type, utm_snapshot) 
VALUES ('abc12345', 'scan', '{}');
-- Expected: Permission denied

-- ============================================================================
-- 7) DASHBOARD QUERIES
-- ============================================================================

-- Breadth vs Depth for a root token
WITH per_level AS (
  SELECT level, COUNT(*) as tokens
  FROM tokens
  WHERE root_token = 'abc12345'  -- replace with actual root token
  GROUP BY level
)
SELECT
  COALESCE(MAX(CASE WHEN level=0 THEN tokens END), 0) as l0,
  COALESCE(MAX(CASE WHEN level=1 THEN tokens END), 0) as l1,
  COALESCE(MAX(CASE WHEN level=2 THEN tokens END), 0) as l2,
  COALESCE(MAX(CASE WHEN level=3 THEN tokens END), 0) as l3,
  (SELECT MAX(level) FROM tokens WHERE root_token = 'abc12345') as max_depth
FROM per_level;

-- Engagement by placement
SELECT 
  p.code as placement_code,
  p.name as placement_name,
  COUNT(*) FILTER (WHERE e.event_type='scan') as scans,
  COUNT(*) FILTER (WHERE e.event_type='view') as views,
  COUNT(*) FILTER (WHERE e.event_type='share') as shares
FROM url_events e
JOIN tokens t ON t.token = e.token
LEFT JOIN placements p ON p.id = t.placement_id
WHERE t.root_token = 'abc12345'  -- replace with actual root token
GROUP BY 1, 2
ORDER BY scans DESC;

-- Campaign summary
SELECT 
  c.code,
  c.title,
  COUNT(DISTINCT ea.id) as num_events_actions,
  COUNT(DISTINCT t.deck_slug) as num_unique_decks,
  MIN(ea.start_date) as campaign_start,
  MAX(ea.end_date) as campaign_end
FROM campaigns c
JOIN events_actions ea ON ea.campaign_id = c.id
LEFT JOIN tokens t ON t.eoa_id = ea.id
WHERE c.code = 'no-kings'
GROUP BY 1, 2;

-- ============================================================================
-- 8) EDGE CASES TO TEST
-- ============================================================================

-- Attempt to mint L04 (should fail - level cap at 3)
-- First, manually create L03 or use existing L02
-- Then try: SELECT * FROM mint_share('l03_token_here', 'em');
-- Expected: "Maximum share level (L03) reached"

-- Attempt to mint with invalid token (should fail)
SELECT * FROM mint_share('invalid_token_xyz', 'sms');
-- Expected: "Parent token not found"

-- Attempt to log event with unknown token (should fail)
SELECT log_event('unknown_token', 'scan', '{}'::jsonb);
-- Expected: "Token not found"
