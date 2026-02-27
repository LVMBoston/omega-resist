import { supabase } from "@/integrations/supabase/client";

export interface NarrativeData {
  campaignTitle: string;
  campaignCreatedAt: string;
  levelCounts: { level: number; count: number }[];
  sproutCount: number;
  viewCount: number;
  zipCount: number;
  usStates: string[];
  internationalCountries: string[];
  propagationSpeed: { level: number; first_mint: string }[];
  maxLevel: number;
}

export async function fetchNarrativeData(campaignCode: string, campaignId: string): Promise<NarrativeData> {
  // Run queries in parallel
  const [campaignRes, tokensRes, sproutsRes, geoRes, statesRes, intlRes, viewsRes, speedRes] = await Promise.all([
    supabase.from("campaigns").select("title, created_at").eq("id", campaignId).single(),
    supabase.rpc("get_campaign_stats", { campaign_codes: [campaignCode] }),
    // Sprout count: distinct parent_tokens among L1+ children for this campaign
    supabase.from("tokens")
      .select("token, parent_token")
      .eq("utm_campaign", campaignCode)
      .eq("is_simulated", false)
      .is("deleted_at", null)
      .gt("level", 0)
      .not("parent_token", "is", null),
    // Geo
    supabase.from("url_events")
      .select("zip_code, region, country, tokens!inner(utm_campaign)")
      .eq("tokens.utm_campaign", campaignCode)
      .eq("is_simulated", false)
      .is("deleted_at", null),
    // US states
    supabase.from("url_events")
      .select("region, tokens!inner(utm_campaign)")
      .eq("tokens.utm_campaign", campaignCode)
      .eq("is_simulated", false)
      .eq("country", "United States")
      .is("deleted_at", null)
      .not("region", "is", null),
    // International countries
    supabase.from("url_events")
      .select("country, tokens!inner(utm_campaign)")
      .eq("tokens.utm_campaign", campaignCode)
      .eq("is_simulated", false)
      .is("deleted_at", null)
      .neq("country", "United States")
      .not("country", "is", null),
    // Views scoped to campaign via token join
    supabase.from("url_events")
      .select("id, tokens!inner(utm_campaign)", { count: "exact", head: true })
      .eq("tokens.utm_campaign", campaignCode)
      .eq("event_type", "view")
      .eq("is_simulated", false)
      .is("deleted_at", null),
    // Propagation speed - get min minted_at per level
    supabase.from("tokens")
      .select("level, minted_at, events_actions!inner(campaign_id)")
      .eq("events_actions.campaign_id", campaignId)
      .eq("is_simulated", false)
      .is("deleted_at", null)
      .order("minted_at", { ascending: true }),
  ]);

  const stats = (tokensRes.data as any)?.[0];
  const l0 = stats?.l0_count || 0;
  const l1 = stats?.l1_count || 0;
  const l2 = stats?.l2_count || 0;
  const l3 = stats?.l3_plus_count || 0;

  const levelCounts = [
    { level: 0, count: l0 },
    { level: 1, count: l1 },
    { level: 2, count: l2 },
    { level: 3, count: l3 },
  ].filter(l => l.count > 0);

  const maxLevel = levelCounts.length > 0 ? Math.max(...levelCounts.map(l => l.level)) : 0;

  // Deduplicate states and countries
  const usStates = [...new Set((statesRes.data || []).map((r: any) => r.region).filter(Boolean))];
  const internationalCountries = [...new Set((intlRes.data || []).map((r: any) => r.country).filter(Boolean))];
  const zipCodes = new Set((geoRes.data || []).map((r: any) => r.zip_code).filter(Boolean));

  // Compute propagation speed from tokens
  const speedMap = new Map<number, string>();
  for (const t of (speedRes.data || []) as any[]) {
    if (!speedMap.has(t.level)) {
      speedMap.set(t.level, t.minted_at);
    }
  }
  const propagationSpeed = Array.from(speedMap.entries())
    .map(([level, first_mint]) => ({ level, first_mint }))
    .sort((a, b) => a.level - b.level);

  // Count sprouts: distinct parent_tokens from the sprouts query (L1+ tokens for this campaign)
  const parentTokens = new Set(
    ((sproutsRes.data || []) as any[])
      .map(t => t.parent_token)
      .filter(Boolean)
  );

  return {
    campaignTitle: campaignRes.data?.title || campaignCode,
    campaignCreatedAt: campaignRes.data?.created_at || new Date().toISOString(),
    levelCounts,
    sproutCount: parentTokens.size || 0,
    viewCount: viewsRes.count || 0,
    zipCount: zipCodes.size,
    usStates: usStates as string[],
    internationalCountries: internationalCountries as string[],
    propagationSpeed,
    maxLevel,
  };
}

export function generateCampaignNarrative(data: NarrativeData): string {
  const {
    campaignTitle,
    campaignCreatedAt,
    levelCounts,
    sproutCount,
    viewCount,
    zipCount,
    usStates,
    internationalCountries,
    propagationSpeed,
    maxLevel,
  } = data;

  const seedCount = levelCounts.find(l => l.level === 0)?.count || 0;
  const totalTokens = levelCounts.reduce((sum, l) => sum + l.count, 0);
  const daysActive = Math.max(1, Math.floor((Date.now() - new Date(campaignCreatedAt).getTime()) / (1000 * 60 * 60 * 24)));

  // Propagation speed narrative
  let speedNarrative = "";
  if (propagationSpeed.length >= 2) {
    const l0Time = new Date(propagationSpeed[0].first_mint);
    const lastLevel = propagationSpeed[propagationSpeed.length - 1];
    const lastTime = new Date(lastLevel.first_mint);
    const diffHours = Math.round((lastTime.getTime() - l0Time.getTime()) / (1000 * 60 * 60));

    if (diffHours < 1) {
      speedNarrative = `The message reached Level ${lastLevel.level} in under an hour.`;
    } else if (diffHours < 24) {
      speedNarrative = `The message reached Level ${lastLevel.level} — ${lastLevel.level} degrees of separation from the original — in just ${diffHours} hours.`;
    } else {
      const days = Math.round(diffHours / 24);
      speedNarrative = `The message reached Level ${lastLevel.level} within ${days} day${days > 1 ? "s" : ""}.`;
    }
  }

  // Geographic narrative
  let geoNarrative = "";
  if (zipCount > 0) {
    const stateCount = usStates.length;
    geoNarrative = `The content reached ${zipCount} different zip codes`;
    if (stateCount > 0) {
      geoNarrative += ` across ${stateCount} state${stateCount > 1 ? "s" : ""}`;
    }
    geoNarrative += ".";

    if (internationalCountries.length > 0) {
      geoNarrative += ` It even crossed borders, reaching ${internationalCountries.join(", ")}.`;
    }
  }

  // Build the narrative — compact for iPhone
  const lines: string[] = [];

  // Opening
  lines.push(`__TITLE__${campaignTitle}__TITLE__`);
  lines.push(`Campaign active for ${daysActive} days`);
  lines.push("");

  // Seeds & sprouts
  lines.push(`🌱 ${seedCount} seeds planted. ${sproutCount} sprouted into viral chains.`);
  if (seedCount > 0 && sproutCount > 0) {
    const sproutRate = Math.round((sproutCount / seedCount) * 100);
    lines.push(`That's a ${sproutRate}% sprout rate — ${sproutCount} people didn't just look, they shared.`);
  }
  lines.push("");

  // Chain depth
  if (maxLevel > 0) {
    lines.push(`🔗 Longest chain: ${maxLevel} levels deep.`);
    if (maxLevel >= 3) {
      lines.push(`Someone scanned a card → shared it → that person shared it → and it kept going.`);
    } else if (maxLevel === 2) {
      lines.push(`A scan became a share, which became another share.`);
    } else {
      lines.push(`Seeds turned into shares.`);
    }
    lines.push("");
  }

  // Speed
  if (speedNarrative) {
    lines.push(`⚡ ${speedNarrative}`);
    lines.push("");
  }

  // Total reach
  lines.push(`👀 ${viewCount} people opened the content.`);
  lines.push(`📍 ${geoNarrative}`);
  lines.push("");

  // Closing
  lines.push(`No ad budget. No algorithm. Every view came because one person decided another person needed to see it.`);

  return lines.join("\n");
}
