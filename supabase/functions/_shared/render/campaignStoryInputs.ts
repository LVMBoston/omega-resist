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
  viewCount: number;
  zipCount: number;
  stateCount: number;
  usStates: string[];
  internationalCountries: string[];
  maxDepth: number;

  propagationSpeed: { level: number; firstMintAt: string }[];
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
  const parentTokens = new Set(
    ((sproutsRes.data || []) as any[])
      .map((t) => t.parent_token)
      .filter(Boolean),
  );
  const sproutCount = parentTokens.size;

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
    viewCount: (viewsRes as any).count || 0,
    zipCount: zipCodes.size,
    stateCount: usStates.length,
    usStates,
    internationalCountries,
    maxDepth,
    propagationSpeed,
    shareMediums,
    lastShareAt,
    speedOriginCity,
    speedDestCity,
  };
}
