
CREATE OR REPLACE VIEW public.token_lineage
WITH (security_invoker = true) AS
WITH RECURSIVE walk AS (
  SELECT token, 0 AS true_depth
  FROM public.tokens
  WHERE parent_token IS NULL
  UNION ALL
  SELECT t.token, w.true_depth + 1
  FROM public.tokens t
  JOIN walk w ON t.parent_token = w.token
)
SELECT
  t.token,
  t.level              AS stored_level,
  w.true_depth,
  t.parent_token,
  t.root_token,
  (t.parent_token IS NULL) AS is_seed,
  t.is_simulated,
  CASE
    WHEN t.parent_token IS NULL AND t.token LIKE 'l00-%' THEN 'mint_l00 (base L00 template)'
    WHEN t.parent_token IS NULL THEN 'mint_l00 (seed)'
    WHEN t.token LIKE 'l00-%:%' AND t.level = 0 THEN 'instantiate_l00_token / maybe_reinstantiate_l00 (per-scan L00 instance)'
    ELSE 'mint_share'
  END AS minted_via,
  t.minted_at          AS created_at,
  t.eoa_id,
  t.utm_medium,
  t.utm_campaign,
  t.deck_slug,
  t.l00_instance,
  (t.level IS DISTINCT FROM w.true_depth) AS level_depth_mismatch
FROM public.tokens t
LEFT JOIN walk w ON w.token = t.token
WHERE t.deleted_at IS NULL;

GRANT SELECT ON public.token_lineage TO authenticated, service_role;
