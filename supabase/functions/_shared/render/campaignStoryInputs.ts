/**
 * Shared metric-input computation for the Campaign Story hotspot.
 *
 * Single source of truth used by BOTH:
 *   - Editor path: `src/lib/campaignNarrative.ts` (via re-export in
 *     `src/shared/render/campaignStoryInputs.ts`).
 *   - SSR path:   `supabase/functions/render-stats-snapshot/index.ts`.
 *
 * Any drift between editor and SSR metric numbers (sprouts, seeds, views,
 * zips, states, ...) is a bug in this file — fix it here, not in either
 * caller. See docs/decisions/snapshots/2026-07-01_full-editor-ssr-parity.md.
 *
 * IMPORTANT — sprout definition:
 *   A "sprout" is a distinct L00 parent token that has produced at least
 *   one L01+ child. NOT the total number of L01+ tokens (that's "shares").
 *   The editor uses distinct parents; before 2026-07-01 the SSR used total
 *   shares, producing the classic "16 vs 31" mismatch.
 *
 * The `supabase` parameter is intentionally typed `any` so this module can
 * be imported by both the browser client and the Deno edge runtime without
 * pulling in either's type surface.
 */

export type NarrativeDataSource = "real" | "simulated";

export interface CampaignStoryInputResult {
  campaignTitle: string;
  /** ISO — official_start_at if set, else campaign created_at. */
  campaignActiveAnchor: string;
  /** Optional cutoff applied to every event/token query. */
  since: string | null;

  levelCounts: { level: number; count: number }[];
  seedCount: number;
  sproutCount: number;
  /**
   * Seeds with "share intent" — L00 parents that have generated at least
   * one child share link but no child has been viewed yet. Matches the
   * orange (amber) border state on the campaign map markers.
   */
  intentCount: number;
  viewCount: number;
  zipCount: number;
  stateCount: number;
  usStates: string[];
  internationalCountries: string[];
  maxDepth: number;

  /** ── Two-lane honest metrics (2026-07-08). ─────────────────────────
   * Lane A — Broadcast opens: tokens at true_depth = 0 (base L00
   *   templates + per-scan L00 instances). Inflated by design; label as
   *   "opens", never "viewers".
   * Lane B — Chain activity: tokens at true_depth >= 1 (mint_share
   *   descendants), orphans excluded. Approximate unique viewers.
   * Orphans: parent_token IS NULL and NOT an L00-shaped token (legacy
   *   detached L1s). Excluded from both lanes; surfaced separately.
   */
  broadcastOpens: number;
  chainViewers: number;
  orphanCount: number;
  /** Depth histogram keyed by true_depth (post-fix view). */
  depthHistogram: { depth: number; count: number }[];
  /** Per-hop conversion table: d → d+1, starting at 1→2 (skip 0→1). */
  perHopConversion: { from: number; to: number; fromCount: number; toCount: number; rate: number }[];
  /** Blended any-hop completion rate = chain tokens that produced any child / chain tokens. */
  anyHopCompletionRate: number | null;
  anyHopCompletionNumerator: number;
  anyHopCompletionDenominator: number;

  /**
   * Propagation speed keyed by true_depth (from token_lineage), NOT the
   * clamped tokens.level column. `level` field name kept for backwards
   * compatibility with consumers; value is true_depth.
   */
  propagationSpeed: { level: number; firstMintAt: string }[];
  /**
   * True when the deepest chain is a single-carrier linear walk
   * (branching factor 1 at every depth 1..max). Prevents the story
   * from framing a persistence chain as viral multi-person spread.
   */
  longestChainIsLinear: boolean;
  /** True when the deepest token in a linear chain has no view event. */
  longestChainTerminalUnopened: boolean;
  shareMediums: { medium: string; count: number }[];
  lastShareAt: string | null;
  speedOriginCity: string | null;
  speedDestCity: string | null;
}


export interface CampaignStoryInputArgs {
  campaignCode: string;
  campaignId: string;
  dataSource?: NarrativeDataSource;
}

export async function computeCampaignStoryInputs(
  supabase: any,
  { campaignCode, campaignId, dataSource = "real" }: CampaignStoryInputArgs,
): Promise<CampaignStoryInputResult> {
  const isSimulated = dataSource === "simulated";

  const { data: campaignBase } = await supabase
    .from("campaigns")
    .select("title, created_at, official_start_at")
    .eq("id", campaignId)
    .single();

  const since: string | null =
    (campaignBase as any)?.official_start_at ?? null;

  const sinceEvt = <T extends { gte: (col: string, v: any) => T }>(q: T): T =>
    since ? q.gte("occurred_at", since) : q;
  const sinceTok = <T extends { gte: (col: string, v: any) => T }>(q: T): T =>
    since ? q.gte("minted_at", since) : q;

  const [
    levelRes,
    sproutsRes,
    geoRes,
    statesRes,
    intlRes,
    viewsRes,
    speedRes,
    mediumRes,
    lastShareRes,
  ] = await Promise.all([
    sinceTok(
      supabase.from("tokens")
        .select("level")
        .eq("utm_campaign", campaignCode)
        .eq("is_simulated", isSimulated)
        .is("deleted_at", null),
    ),
    sinceTok(
      supabase.from("tokens")
        .select("token, parent_token")
        .eq("utm_campaign", campaignCode)
        .eq("is_simulated", isSimulated)
        .is("deleted_at", null)
        .gt("level", 0)
        .not("parent_token", "is", null),
    ),
    sinceEvt(
      supabase.from("url_events")
        .select("zip_code, tokens!inner(utm_campaign)")
        .eq("tokens.utm_campaign", campaignCode)
        .eq("is_simulated", isSimulated)
        .is("deleted_at", null),
    ),
    sinceEvt(
      supabase.from("url_events")
        .select("region, tokens!inner(utm_campaign)")
        .eq("tokens.utm_campaign", campaignCode)
        .eq("is_simulated", isSimulated)
        .eq("country", "United States")
        .is("deleted_at", null)
        .not("region", "is", null),
    ),
    sinceEvt(
      supabase.from("url_events")
        .select("country, tokens!inner(utm_campaign)")
        .eq("tokens.utm_campaign", campaignCode)
        .eq("is_simulated", isSimulated)
        .is("deleted_at", null)
        .neq("country", "United States")
        .not("country", "is", null),
    ),
    sinceEvt(
      supabase.from("url_events")
        .select("id, tokens!inner(utm_campaign)", { count: "exact", head: true })
        .eq("tokens.utm_campaign", campaignCode)
        .eq("event_type", "view")
        .eq("is_simulated", isSimulated)
        .is("deleted_at", null),
    ),
    sinceTok(
      supabase.from("tokens")
        .select("token, level, minted_at, l00_instance, events_actions!inner(campaign_id)")
        .eq("events_actions.campaign_id", campaignId)
        .eq("is_simulated", isSimulated)
        .is("deleted_at", null)
        .order("minted_at", { ascending: true }),
    ),
    sinceEvt(
      supabase.from("url_events")
        .select("tokens!inner(utm_medium, utm_campaign)")
        .eq("tokens.utm_campaign", campaignCode)
        .eq("is_simulated", isSimulated)
        .is("deleted_at", null)
        .eq("event_type", "view"),
    ),
    sinceTok(
      supabase.from("tokens")
        .select("minted_at")
        .eq("utm_campaign", campaignCode)
        .gt("level", 0)
        .eq("is_simulated", isSimulated)
        .is("deleted_at", null)
        .order("minted_at", { ascending: false })
        .limit(1),
    ),
  ]);

  // Level buckets (L3+ collapse into L3).
  const levelTotals = new Map<number, number>();
  for (const t of (levelRes.data || []) as any[]) {
    const lvl = Number(t.level || 0);
    const bucket = lvl >= 3 ? 3 : lvl;
    levelTotals.set(bucket, (levelTotals.get(bucket) || 0) + 1);
  }
  const levelCounts = [0, 1, 2, 3]
    .map((lvl) => ({ level: lvl, count: levelTotals.get(lvl) || 0 }))
    .filter((l) => l.count > 0);
  const maxDepth = levelCounts.length > 0
    ? Math.max(...levelCounts.map((l) => l.level))
    : 0;
  const seedCount = levelTotals.get(0) || 0;

  // Sprouts = DISTINCT L00 parents with children (matches editor definition).
  const sproutChildren = (sproutsRes.data || []) as any[];
  const parentTokens = new Set(
    sproutChildren
      .map((t) => t.parent_token)
      .filter(Boolean),
  );
  const sproutCount = parentTokens.size;

  // Intent count = sprouted parents where NO child has been viewed yet
  // (matches the orange/amber map-marker border state in SamizdatMap).
  let intentCount = 0;
  if (sproutChildren.length > 0) {
    const childTokens = sproutChildren.map((t) => t.token).filter(Boolean);
    const viewsRes = childTokens.length > 0
      ? await supabase.from("url_events")
          .select("token")
          .in("token", childTokens)
          .eq("event_type", "view")
          .eq("is_simulated", isSimulated)
          .is("deleted_at", null)
      : { data: [] as any[] };
    const viewedChildren = new Set(
      ((viewsRes.data || []) as any[]).map((r) => r.token),
    );
    const parentsWithViewedChild = new Set<string>();
    for (const c of sproutChildren) {
      if (c.parent_token && viewedChildren.has(c.token)) {
        parentsWithViewedChild.add(c.parent_token);
      }
    }
    intentCount = parentTokens.size - parentsWithViewedChild.size;
  }


  // Geography.
  const usStates = [
    ...new Set(
      (statesRes.data || [])
        .map((r: any) => r.region)
        .filter(Boolean),
    ),
  ] as string[];
  const internationalCountries = [
    ...new Set(
      (intlRes.data || [])
        .map((r: any) => r.country)
        .filter(Boolean),
    ),
  ] as string[];
  const zipCodes = new Set(
    (geoRes.data || [])
      .map((r: any) => r.zip_code)
      .filter(Boolean),
  );

  // Propagation speed (first mint per level).
  const speedMap = new Map<number, any>();
  for (const t of (speedRes.data || []) as any[]) {
    if (!speedMap.has(t.level)) speedMap.set(t.level, t);
  }
  const speedEntries = Array.from(speedMap.entries()).sort((a, b) =>
    a[0] - b[0]
  );
  const propagationSpeed = speedEntries.map(([level, t]) => ({
    level,
    firstMintAt: (t as any).minted_at,
  }));

  // Share mediums (view events, grouped by parent token's utm_medium).
  const mediumCounts = new Map<string, number>();
  for (const evt of (mediumRes.data || []) as any[]) {
    const m = evt.tokens?.utm_medium || "unknown";
    mediumCounts.set(m, (mediumCounts.get(m) || 0) + 1);
  }
  const shareMediums = Array.from(mediumCounts.entries())
    .map(([medium, count]) => ({ medium, count }))
    .sort((a, b) => b.count - a.count);

  const lastShareAt =
    (lastShareRes.data as any)?.[0]?.minted_at || null;

  // Speed origin/destination cities (best-effort; independent of the rest).
  let speedOriginCity: string | null = null;
  let speedDestCity: string | null = null;

  if (maxDepth >= 1 && speedEntries.length >= 2) {
    try {
      const firstL1 = speedEntries.find(([lvl]) => lvl === 1);
      const lastEntry = speedEntries[speedEntries.length - 1];
      if (firstL1) {
        const l1Token = firstL1[1] as any;
        const originRes = await supabase.from("url_events")
          .select("city, region")
          .eq("token", l1Token.token)
          .eq("is_simulated", isSimulated)
          .is("deleted_at", null)
          .not("city", "is", null)
          .order("occurred_at", { ascending: true })
          .limit(1);
        const oe = (originRes.data as any)?.[0];
        if (oe?.city) {
          speedOriginCity = oe.region ? `${oe.city}, ${oe.region}` : oe.city;
        }
        if (l1Token.l00_instance && lastEntry[0] > 1) {
          const destTokRes = await supabase.from("tokens")
            .select("token")
            .eq("utm_campaign", campaignCode)
            .eq("level", lastEntry[0])
            .eq("l00_instance", l1Token.l00_instance)
            .eq("is_simulated", isSimulated)
            .is("deleted_at", null)
            .order("minted_at", { ascending: true })
            .limit(1);
          const destTok = (destTokRes.data as any)?.[0];
          if (destTok?.token) {
            const destEvtRes = await supabase.from("url_events")
              .select("city, region")
              .eq("token", destTok.token)
              .eq("is_simulated", isSimulated)
              .is("deleted_at", null)
              .not("city", "is", null)
              .order("occurred_at", { ascending: true })
              .limit(1);
            const de = (destEvtRes.data as any)?.[0];
            if (de?.city) {
              speedDestCity = de.region ? `${de.city}, ${de.region}` : de.city;
            }
          }
        }
      }
    } catch (e) {
      // Non-fatal; speed narrative just omits the city clause.
      // eslint-disable-next-line no-console
      console.warn("[campaignStoryInputs] speed geo lookup failed:", e);
    }
  }

  // ── Two-lane metrics from token_lineage view (depth-corrected). ────
  // Pull the whole campaign lineage in pages of 1000 to bypass the
  // Supabase default row cap; every downstream derivation depends on it.
  const lineageRows: any[] = [];
  {
    const pageSize = 1000;
    let from = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const q = supabase
        .from("token_lineage")
        .select("token, parent_token, true_depth, is_seed")
        .eq("utm_campaign", campaignCode)
        .eq("is_simulated", isSimulated)
        .range(from, from + pageSize - 1);
      const { data, error } = await (since ? q.gte("created_at", since) : q);
      if (error) break;
      const chunk = (data || []) as any[];
      lineageRows.push(...chunk);
      if (chunk.length < pageSize) break;
      from += pageSize;
    }
  }

  // Orphan = parent_token IS NULL AND token is not an L00-shaped id.
  // (Base L00 templates are also parentless but always start with 'l00-'.)
  const isOrphan = (r: any) =>
    r.parent_token == null && !(typeof r.token === "string" && r.token.startsWith("l00-"));
  const orphanCount = lineageRows.filter(isOrphan).length;
  const nonOrphan = lineageRows.filter((r) => !isOrphan(r));

  const depthMap = new Map<number, number>();
  let broadcastOpens = 0;
  let chainViewers = 0;
  for (const r of nonOrphan) {
    const d = Number(r.true_depth ?? 0);
    depthMap.set(d, (depthMap.get(d) || 0) + 1);
    if (d === 0) broadcastOpens += 1;
    else if (d >= 1) chainViewers += 1;
  }
  const depthHistogram = Array.from(depthMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([depth, count]) => ({ depth, count }));

  // Per-hop conversion, starting at 1→2 (skip 0→1 by design — the plan
  // treats the L00-to-L01 transition as broadcast conversion, reported
  // elsewhere, not as a chain hop).
  const perHopConversion: {
    from: number; to: number; fromCount: number; toCount: number; rate: number;
  }[] = [];
  const maxObservedDepth = depthHistogram.length > 0
    ? depthHistogram[depthHistogram.length - 1].depth : 0;
  for (let d = 1; d < maxObservedDepth; d++) {
    const fromCount = depthMap.get(d) || 0;
    const toCount = depthMap.get(d + 1) || 0;
    if (fromCount === 0) continue;
    perHopConversion.push({
      from: d, to: d + 1, fromCount, toCount,
      rate: toCount / fromCount,
    });
  }

  // Any-hop completion: fraction of chain tokens (depth >= 1, non-orphan)
  // that produced at least one child. Denominator excludes the deepest
  // observed depth per chain (they have no chance to produce a child yet
  // in-window); simplest honest form: parents-set ∩ chain set.
  const chainTokens = new Set(nonOrphan.filter((r) => Number(r.true_depth ?? 0) >= 1).map((r) => r.token));
  const parentsSet = new Set(
    nonOrphan.map((r) => r.parent_token).filter(Boolean),
  );
  let anyHopNum = 0;
  chainTokens.forEach((t) => { if (parentsSet.has(t)) anyHopNum += 1; });
  const anyHopDen = chainTokens.size;
  const anyHopCompletionRate = anyHopDen > 0 ? anyHopNum / anyHopDen : null;

  // Prefer true_depth for maxDepth when lineage is available.
  const effectiveMaxDepth = depthHistogram.length > 0
    ? Math.max(maxDepth, maxObservedDepth)
    : maxDepth;

  return {
    campaignTitle: (campaignBase as any)?.title || campaignCode,
    campaignActiveAnchor:
      (campaignBase as any)?.official_start_at ||
      (campaignBase as any)?.created_at ||
      new Date().toISOString(),
    since,
    levelCounts,
    seedCount,
    sproutCount,
    intentCount,

    viewCount: (viewsRes as any).count || 0,
    zipCount: zipCodes.size,
    stateCount: usStates.length,
    usStates,
    internationalCountries,
    maxDepth: effectiveMaxDepth,

    broadcastOpens,
    chainViewers,
    orphanCount,
    depthHistogram,
    perHopConversion,
    anyHopCompletionRate,
    anyHopCompletionNumerator: anyHopNum,
    anyHopCompletionDenominator: anyHopDen,

    propagationSpeed,
    shareMediums,
    lastShareAt,
    speedOriginCity,
    speedDestCity,
  };
}

