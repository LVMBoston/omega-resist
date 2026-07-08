-- Fix true_depth semantics: per-scan L00 instance edges contribute 0
-- (they are identity re-instantiations, not viral shares); every other
-- edge contributes 1. Provenance is encoded by child token shape, which
-- is written by the mint functions and never mutated.
--
-- Coupling: correctness depends on the naming invariant across
-- generate_token (bare 8-hex), mint_share (does not alter that shape),
-- and instantiate_l00_token / maybe_reinstantiate_l00 (emit <base>:<6-hex>).
-- See docs/decisions/campaign-story/2026-07-08_campaign-story-v2_feature-doc_lovable.md.

DROP VIEW IF EXISTS public.token_lineage;

CREATE VIEW public.token_lineage
WITH (security_invoker = true)
AS
WITH RECURSIVE walk AS (
  -- Roots: tokens with no parent (base L00 templates + legacy orphans).
  SELECT
    t.token,
    0 AS true_depth
  FROM public.tokens t
  WHERE t.parent_token IS NULL
    AND t.deleted_at IS NULL

  UNION ALL

  -- Descend one edge. Instance edges (child is 'l00-…:…') contribute 0.
  -- Every other edge is a mint_share edge and contributes 1.
  SELECT
    c.token,
    w.true_depth + CASE
      WHEN c.token ~ '^l00-.+:.+$' THEN 0
      ELSE 1
    END
  FROM public.tokens c
  JOIN walk w ON c.parent_token = w.token
  WHERE c.deleted_at IS NULL
)
SELECT
  t.token,
  t.level                                  AS stored_level,
  w.true_depth,
  t.parent_token,
  t.root_token,
  t.parent_token IS NULL                   AS is_seed,
  t.is_simulated,
  CASE
    WHEN t.parent_token IS NULL AND t.token LIKE 'l00-%' THEN 'mint_l00 (base L00 template)'
    WHEN t.parent_token IS NULL                          THEN 'mint_l00 (seed)'
    WHEN t.token ~ '^l00-.+:.+$' AND t.level = 0
      THEN 'instantiate_l00_token / maybe_reinstantiate_l00 (per-scan L00 instance)'
    ELSE 'mint_share'
  END                                      AS minted_via,
  t.minted_at                              AS created_at,
  t.eoa_id,
  t.utm_medium,
  t.utm_campaign,
  t.deck_slug,
  t.l00_instance,
  t.level IS DISTINCT FROM w.true_depth    AS level_depth_mismatch
FROM public.tokens t
LEFT JOIN walk w ON w.token = t.token
WHERE t.deleted_at IS NULL;

GRANT SELECT ON public.token_lineage TO authenticated;
GRANT ALL    ON public.token_lineage TO service_role;

COMMENT ON VIEW public.token_lineage IS
  'Depth-corrected lineage view. true_depth counts only mint_share edges; per-scan L00 instance edges (child matches ^l00-.+:.+$) contribute 0. Depends on the token-naming invariant across generate_token, mint_share, instantiate_l00_token, and maybe_reinstantiate_l00 — see 2026-07-08 decision doc.';