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
  shareMediums: { medium: string; count: number }[];
}

export async function fetchNarrativeData(campaignCode: string, campaignId: string): Promise<NarrativeData> {
  // Run queries in parallel
  const [campaignRes, tokensRes, sproutsRes, geoRes, statesRes, intlRes, viewsRes, speedRes, mediumRes] = await Promise.all([
    supabase.from("campaigns").select("title, created_at").eq("id", campaignId).single(),
    supabase.rpc("get_campaign_stats", { campaign_codes: [campaignCode] }),
    supabase.from("tokens")
      .select("token, parent_token")
      .eq("utm_campaign", campaignCode)
      .eq("is_simulated", false)
      .is("deleted_at", null)
      .gt("level", 0)
      .not("parent_token", "is", null),
    supabase.from("url_events")
      .select("zip_code, region, country, tokens!inner(utm_campaign)")
      .eq("tokens.utm_campaign", campaignCode)
      .eq("is_simulated", false)
      .is("deleted_at", null),
    supabase.from("url_events")
      .select("region, tokens!inner(utm_campaign)")
      .eq("tokens.utm_campaign", campaignCode)
      .eq("is_simulated", false)
      .eq("country", "United States")
      .is("deleted_at", null)
      .not("region", "is", null),
    supabase.from("url_events")
      .select("country, tokens!inner(utm_campaign)")
      .eq("tokens.utm_campaign", campaignCode)
      .eq("is_simulated", false)
      .is("deleted_at", null)
      .neq("country", "United States")
      .not("country", "is", null),
    supabase.from("url_events")
      .select("id, tokens!inner(utm_campaign)", { count: "exact", head: true })
      .eq("tokens.utm_campaign", campaignCode)
      .eq("event_type", "view")
      .eq("is_simulated", false)
      .is("deleted_at", null),
    supabase.from("tokens")
      .select("level, minted_at, events_actions!inner(campaign_id)")
      .eq("events_actions.campaign_id", campaignId)
      .eq("is_simulated", false)
      .is("deleted_at", null)
      .order("minted_at", { ascending: true }),
    supabase.from("url_events")
      .select("tokens!inner(utm_medium, utm_campaign)")
      .eq("tokens.utm_campaign", campaignCode)
      .eq("is_simulated", false)
      .is("deleted_at", null)
      .eq("event_type", "view"),
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

  const usStates = [...new Set((statesRes.data || []).map((r: any) => r.region).filter(Boolean))];
  const internationalCountries = [...new Set((intlRes.data || []).map((r: any) => r.country).filter(Boolean))];
  const zipCodes = new Set((geoRes.data || []).map((r: any) => r.zip_code).filter(Boolean));

  const speedMap = new Map<number, string>();
  for (const t of (speedRes.data || []) as any[]) {
    if (!speedMap.has(t.level)) {
      speedMap.set(t.level, t.minted_at);
    }
  }
  const propagationSpeed = Array.from(speedMap.entries())
    .map(([level, first_mint]) => ({ level, first_mint }))
    .sort((a, b) => a.level - b.level);

  const parentTokens = new Set(
    ((sproutsRes.data || []) as any[])
      .map(t => t.parent_token)
      .filter(Boolean)
  );

  // Aggregate share mediums
  const mediumCounts = new Map<string, number>();
  for (const t of (mediumRes.data || []) as any[]) {
    const m = t.utm_medium || "unknown";
    mediumCounts.set(m, (mediumCounts.get(m) || 0) + 1);
  }
  const shareMediums = Array.from(mediumCounts.entries())
    .map(([medium, count]) => ({ medium, count }))
    .sort((a, b) => b.count - a.count);

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
    shareMediums,
  };
}

// ─── Headline tier (compact, fits one iPhone screen at 30pt) ─────────

export function generateHeadlineOnly(data: NarrativeData): string {
  const {
    campaignTitle,
    campaignCreatedAt,
    levelCounts,
    sproutCount,
    viewCount,
    zipCount,
    usStates,
    propagationSpeed,
    maxLevel,
  } = data;

  const seedCount = levelCounts.find(l => l.level === 0)?.count || 0;
  const msActive = Date.now() - new Date(campaignCreatedAt).getTime();
  const daysActive = Math.max(0, Math.floor(msActive / (1000 * 60 * 60 * 24)));
  const hoursRemainder = Math.floor((msActive % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  const lines: string[] = [];

  lines.push(campaignTitle);
  lines.push(`${daysActive} days ${hoursRemainder} hours active`);
  lines.push("");

  lines.push(`${seedCount} cards dropped`);
  if (seedCount > 0 && sproutCount > 0) {
    const sproutRate = Math.round((sproutCount / seedCount) * 100);
    lines.push(`${sproutCount} sprouted (${sproutRate}%)`);
  }
  lines.push("");

  if (maxLevel > 0) {
    lines.push(`Longest chain: ${maxLevel} levels`);

    // Speed line
    if (propagationSpeed.length >= 2) {
      const l0Time = new Date(propagationSpeed[0].first_mint);
      const lastLevel = propagationSpeed[propagationSpeed.length - 1];
      const lastTime = new Date(lastLevel.first_mint);
      const diffHours = Math.round((lastTime.getTime() - l0Time.getTime()) / (1000 * 60 * 60));
      if (diffHours < 1) {
        lines.push(`Reached L${lastLevel.level} in < 1 hour`);
      } else if (diffHours < 24) {
        lines.push(`Reached L${lastLevel.level} in ${diffHours} hours`);
      } else {
        const days = Math.round(diffHours / 24);
        lines.push(`Reached L${lastLevel.level} in ${days} day${days > 1 ? "s" : ""}`);
      }
    }
    lines.push("");
  }

  lines.push(`${viewCount} views, ${zipCount} zip codes`);
  const stateCount = usStates.length;
  if (stateCount > 0) {
    lines.push(`across ${stateCount} state${stateCount > 1 ? "s" : ""}`);
  }
  lines.push("");

  lines.push("No ad budget.");
  lines.push("Every view earned.");

  return lines.join("\n");
}

// ─── Full story tier (verbose narrative with emojis) ─────────────────

function generateFullStory(data: NarrativeData): string {
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
    shareMediums,
  } = data;

  const seedCount = levelCounts.find(l => l.level === 0)?.count || 0;
  const msActive = Date.now() - new Date(campaignCreatedAt).getTime();
  const daysActive = Math.max(0, Math.floor(msActive / (1000 * 60 * 60 * 24)));
  const hoursRemainder = Math.floor((msActive % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  // Share medium percentages
  const totalShares = shareMediums.reduce((s, m) => s + m.count, 0);
  const mediumLabels: Record<string, string> = { sms: "text", em: "email", wa: "WhatsApp", tw: "Twitter", fb: "Facebook" };
  const mediumLine = totalShares > 0
    ? shareMediums
        .map(m => `${Math.round((m.count / totalShares) * 100)}% ${mediumLabels[m.medium] || m.medium}`)
        .join(", ")
    : "";

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
      speedNarrative = `The message reached Level ${lastLevel.level} in just ${diffHours} hours.`;
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

  // Varied closing — deterministic pick based on seedCount to stay stable per campaign
  const closings = [
    "No ad budget. No algorithm. Every view came because one person decided another person needed to see it.",
    "No ads. No tricks. Just people passing something along because it mattered to them.",
    "No promotion. No platform boost. This spread the old-fashioned way — person to person, because it resonated.",
    "Zero dollars spent. Every single view was a conscious act of solidarity — someone choosing to share.",
  ];
  const closingIndex = (seedCount + sproutCount) % closings.length;

  const lines: string[] = [];

  lines.push(`__TITLE__Campaign: ${campaignTitle}__TITLE__`);
  lines.push(`Campaign active for ${daysActive} days ${hoursRemainder} hours`);
  lines.push("");

  // Seeds & sprouts
  lines.push(`🌱 ${seedCount} seeds planted. ${sproutCount} sprouted into viral chains. (A seed is a QR scan not shared.)`);
  if (seedCount > 0 && sproutCount > 0) {
    const sproutRate = Math.round((sproutCount / seedCount) * 100);
    let sproutLine = `That's a ${sproutRate}% sprout rate — ${sproutCount} people didn't just look, they shared`;
    if (mediumLine) {
      sproutLine += `: ${mediumLine}`;
    }
    sproutLine += ".";
    lines.push(sproutLine);
  }
  lines.push("");

  // Depth
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

  // Views
  lines.push(`👀 The content was viewed ${viewCount} times — sometimes more than once by the same person.`);

  // Geography — only include if we have geo data
  if (geoNarrative) {
    lines.push(`📍 ${geoNarrative}`);
    lines.push("");
  }

  // Closing
  lines.push(closings[closingIndex]);
  lines.push("");

  // Date of report
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false, timeZoneName: "short" });
  lines.push(`Date of this report: ${dateStr} ${timeStr}`);

  return lines.join("\n");
}

// ─── Two-tier narrative generator ────────────────────────────────────

export interface CampaignNarrativeResult {
  headline: string;
  fullStory: string;
}

export function generateCampaignNarrative(data: NarrativeData): CampaignNarrativeResult {
  return {
    headline: generateHeadlineOnly(data),
    fullStory: generateFullStory(data),
  };
}
