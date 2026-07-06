
WITH RECURSIVE walk AS (
  SELECT token AS start_token, token AS cur, 0 AS d
  FROM public.tokens
  UNION ALL
  SELECT w.start_token, t.parent_token, w.d + 1
  FROM walk w
  JOIN public.tokens t ON t.token = w.cur
  WHERE w.cur IS NOT NULL AND w.d < 50
),
true_root AS (
  SELECT w.start_token AS token, w.cur AS true_root
  FROM walk w
  JOIN public.tokens t ON t.token = w.cur
  WHERE t.parent_token IS NULL
)
UPDATE public.tokens t
SET root_token = tr.true_root
FROM true_root tr
WHERE tr.token = t.token
  AND (t.root_token IS DISTINCT FROM tr.true_root);
