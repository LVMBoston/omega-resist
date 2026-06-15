import { supabase } from "@/integrations/supabase/client";

export interface NarrativeData {
  campaignTitle: string;
  campaignCreatedAt: string;
  dataSource: NarrativeDataSource;
  levelCounts: { level: number; count: number }[];
  sproutCount: number;
  viewCount: number;
  zipCount: number;
  usStates: string[];
  internationalCountries: string[];
  propagationSpeed: { level: number; first_mint: string }[];
  maxLevel: number;
  shareMediums: { medium: string; count: number }[];
  lastShareAt: string | null;
  speedOriginCity: string | null;
  speedDestCity: string | null;
}

export type NarrativeDataSource = "real" | "simulated";

export interface NarrativeAvailability {
  realCount: number;
  simulatedCount: number;
  hasReal: boolean;
  hasSimulated: boolean;
}

export async function fetchNarrativeAvailability(campaignCode: string): Promise<NarrativeAvailability> {
  const [realRes, simulatedRes] = await Promise.all([
    supabase.from("tokens")
      .select("id", { count: "exact", head: true })
      .eq("utm_campaign", campaignCode)
      .eq("is_simulated", false)
      .is("deleted_at", null),
    supabase.from("tokens")
      .select("id", { count: "exact", head: true })
      .eq("utm_campaign", campaignCode)
      .eq("is_simulated", true)
      .is("deleted_at", null),
  ]);

  return {
    realCount: realRes.count || 0,
    simulatedCount: simulatedRes.count || 0,
    hasReal: (realRes.count || 0) > 0,
    hasSimulated: (simulatedRes.count || 0) > 0,
  };
}

export async function fetchNarrativeData(campaignCode: string, campaignId: string, dataSource: NarrativeDataSource = "real"): Promise<NarrativeData> {
  const isSimulated = dataSource === "simulated";

  // Run queries in parallel
  const [campaignRes, levelRes, sproutsRes, geoRes, statesRes, intlRes, viewsRes, speedRes, mediumRes, lastShareRes] = await Promise.all([
    supabase.from("campaigns").select("title, created_at").eq("id", campaignId).single(),
    supabase.from("tokens")
      .select("level")
      .eq("utm_campaign", campaignCode)
      .eq("is_simulated", isSimulated)
      .is("deleted_at", null),
    supabase.from("tokens")
      .select("token, parent_token")
      .eq("utm_campaign", campaignCode)
      .eq("is_simulated", isSimulated)
      .is("deleted_at", null)
      .gt("level", 0)
      .not("parent_token", "is", null),
    supabase.from("url_events")
      .select("zip_code, region, country, tokens!inner(utm_campaign)")
      .eq("tokens.utm_campaign", campaignCode)
      .eq("is_simulated", isSimulated)
      .is("deleted_at", null),
    supabase.from("url_events")
      .select("region, tokens!inner(utm_campaign)")
      .eq("tokens.utm_campaign", campaignCode)
      .eq("is_simulated", isSimulated)
      .eq("country", "United States")
      .is("deleted_at", null)
      .not("region", "is", null),
    supabase.from("url_events")
      .select("country, tokens!inner(utm_campaign)")
      .eq("tokens.utm_campaign", campaignCode)
      .eq("is_simulated", isSimulated)
      .is("deleted_at", null)
      .neq("country", "United States")
      .not("country", "is", null),
    supabase.from("url_events")
      .select("id, tokens!inner(utm_campaign)", { count: "exact", head: true })
      .eq("tokens.utm_campaign", campaignCode)
      .eq("event_type", "view")
      .eq("is_simulated", isSimulated)
      .is("deleted_at", null),
    supabase.from("tokens")
      .select("level, minted_at, events_actions!inner(campaign_id)")
      .eq("events_actions.campaign_id", campaignId)
      .eq("is_simulated", isSimulated)
      .is("deleted_at", null)
      .order("minted_at", { ascending: true }),
    supabase.from("url_events")
      .select("tokens!inner(utm_medium, utm_campaign)")
      .eq("tokens.utm_campaign", campaignCode)
      .eq("is_simulated", isSimulated)
      .is("deleted_at", null)
      .eq("event_type", "view"),
    supabase.from("tokens")
      .select("minted_at")
      .eq("utm_campaign", campaignCode)
      .gt("level", 0)
      .eq("is_simulated", isSimulated)
      .is("deleted_at", null)
      .order("minted_at", { ascending: false })
      .limit(1),
  ]);

  const levelTotals = new Map<number, number>();
  for (const token of (levelRes.data || []) as any[]) {
    const level = Number(token.level || 0);
    const bucket = level >= 3 ? 3 : level;
    levelTotals.set(bucket, (levelTotals.get(bucket) || 0) + 1);
  }
  const l0 = levelTotals.get(0) || 0;
  const l1 = levelTotals.get(1) || 0;
  const l2 = levelTotals.get(2) || 0;
  const l3 = levelTotals.get(3) || 0;

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
  // Aggregate open events by share medium (from the token's utm_medium)
  const mediumCounts = new Map<string, number>();
  for (const evt of (mediumRes.data || []) as any[]) {
    const m = evt.tokens?.utm_medium || "unknown";
    mediumCounts.set(m, (mediumCounts.get(m) || 0) + 1);
  }
  const shareMediums = Array.from(mediumCounts.entries())
    .map(([medium, count]) => ({ medium, count }))
    .sort((a, b) => b.count - a.count);

  const lastShareAt = (lastShareRes.data as any)?.[0]?.minted_at || null;

  // Resolve geographic origin/destination for fastest share line
  let speedOriginCity: string | null = null;
  let speedDestCity: string | null = null;

  if (maxLevel >= 1) {
    // 1. First L1 token
    const firstL1Res = await supabase.from("tokens")
      .select("token, l00_instance")
      .eq("utm_campaign", campaignCode)
      .eq("level", 1)
      .eq("is_simulated", isSimulated)
      .is("deleted_at", null)
      .order("minted_at", { ascending: true })
      .limit(1);

    const firstL1 = (firstL1Res.data as any)?.[0];
    if (firstL1?.token) {
      // 2. City of first L1 event
      const originEvtRes = await supabase.from("url_events")
        .select("city, region")
        .eq("token", firstL1.token)
        .eq("is_simulated", isSimulated)
        .is("deleted_at", null)
        .not("city", "is", null)
        .order("occurred_at", { ascending: true })
        .limit(1);

      const originEvt = (originEvtRes.data as any)?.[0];
      if (originEvt?.city) {
        speedOriginCity = originEvt.region
          ? `${originEvt.city}, ${originEvt.region}`
          : originEvt.city;
      }

      // 3. First max-level token on same l00_instance
      if (firstL1.l00_instance && maxLevel > 1) {
        const destTokenRes = await supabase.from("tokens")
          .select("token")
          .eq("utm_campaign", campaignCode)
          .eq("level", maxLevel)
          .eq("l00_instance", firstL1.l00_instance)
          .eq("is_simulated", isSimulated)
          .is("deleted_at", null)
          .order("minted_at", { ascending: true })
          .limit(1);

        const destToken = (destTokenRes.data as any)?.[0];
        if (destToken?.token) {
          // 4. City of destination event
          const destEvtRes = await supabase.from("url_events")
            .select("city, region")
            .eq("token", destToken.token)
            .eq("is_simulated", isSimulated)
            .is("deleted_at", null)
            .not("city", "is", null)
            .order("occurred_at", { ascending: true })
            .limit(1);

          const destEvt = (destEvtRes.data as any)?.[0];
          if (destEvt?.city) {
            speedDestCity = destEvt.region
              ? `${destEvt.city}, ${destEvt.region}`
              : destEvt.city;
          }
        }
      }
    }
  }

  return {
    campaignTitle: campaignRes.data?.title || campaignCode,
    campaignCreatedAt: campaignRes.data?.created_at || new Date().toISOString(),
    dataSource,
    levelCounts,
    sproutCount: parentTokens.size || 0,
    viewCount: viewsRes.count || 0,
    zipCount: zipCodes.size,
    usStates: usStates as string[],
    internationalCountries: internationalCountries as string[],
    propagationSpeed,
    maxLevel,
    shareMediums,
    lastShareAt,
    speedOriginCity,
    speedDestCity,
  };
}

// ─── Headline tier (compact, fits one iPhone screen at 30pt) ─────────

export function generateHeadlineOnly(data: NarrativeData): string {
  const {
    campaignTitle,
    campaignCreatedAt,
    dataSource,
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
  lines.push(dataSource === "simulated" ? "Simulation report" : "Real data report");
  lines.push(`${daysActive} days ${hoursRemainder} hours active`);
  lines.push("");

  lines.push(`${seedCount} first opens`);
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
      let timePart: string;
      if (diffHours < 1) {
        timePart = "< 1 hour";
      } else if (diffHours < 24) {
        timePart = `${diffHours} hours`;
      } else {
        const days = Math.round(diffHours / 24);
        timePart = `${days} day${days > 1 ? "s" : ""}`;
      }
      let speedLine = `Fastest share: ${timePart}`;
      if (data.speedOriginCity && data.speedDestCity) {
        speedLine += `; ${data.speedOriginCity} to ${data.speedDestCity}`;
      }
      lines.push(speedLine);
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
    dataSource,
    levelCounts,
    sproutCount,
    viewCount,
    zipCount,
    usStates,
    internationalCountries,
    propagationSpeed,
    maxLevel,
    shareMediums,
    lastShareAt,
  } = data;

  const seedCount = levelCounts.find(l => l.level === 0)?.count || 0;
  const msActive = Date.now() - new Date(campaignCreatedAt).getTime();
  const daysActive = Math.max(0, Math.floor(msActive / (1000 * 60 * 60 * 24)));
  const hoursRemainder = Math.floor((msActive % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  // Open medium percentages (based on view events, not tokens)
  const totalOpens = shareMediums.reduce((s, m) => s + m.count, 0);
  const mediumLabels: Record<string, string> = { sms: "text", em: "email", wa: "WhatsApp", tw: "Twitter", fb: "Facebook" };
  const mediumLine = totalOpens > 0
    ? shareMediums
        .map(m => `${Math.round((m.count / totalOpens) * 100)}% ${mediumLabels[m.medium] || m.medium}`)
        .join(", ")
    : "";

  // Propagation speed narrative
  let speedNarrative = "";
  if (propagationSpeed.length >= 2) {
    const l0Time = new Date(propagationSpeed[0].first_mint);
    const lastLevel = propagationSpeed[propagationSpeed.length - 1];
    const lastTime = new Date(lastLevel.first_mint);
    const diffHours = Math.round((lastTime.getTime() - l0Time.getTime()) / (1000 * 60 * 60));

    let timePart: string;
    if (diffHours < 1) {
      timePart = "under an hour";
    } else if (diffHours < 24) {
      timePart = `just ${diffHours} hours`;
    } else {
      const days = Math.round(diffHours / 24);
      timePart = `${days} day${days > 1 ? "s" : ""}`;
    }
    speedNarrative = `Fastest share: From the first open shared to the first Level ${lastLevel.level} share took ${timePart}.`;
    if (data.speedOriginCity && data.speedDestCity) {
      // Replace trailing period with geo suffix
      speedNarrative = speedNarrative.slice(0, -1) + `; ${data.speedOriginCity} to ${data.speedDestCity}.`;
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

  if (dataSource === "simulated") {
    lines.push("Simulation report — not real field activity.");
  }
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false, timeZoneName: "short" });
  lines.push(`Date of this report: ${dateStr} ${timeStr}`);
  const startDate = new Date(campaignCreatedAt);
  const startFormatted = startDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  lines.push(`Started ${startFormatted}`);
  lines.push(`Campaign active for ${daysActive} days ${hoursRemainder} hours`);
  if (lastShareAt) {
    const lastShare = new Date(lastShareAt);
    const lastShareDateStr = lastShare.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const lastShareTimeStr = lastShare.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" });
    lines.push(`Last share: ${lastShareDateStr} ${lastShareTimeStr}`);
  }
  lines.push("");

  // Seeds & sprouts
  let seedLine = `🌱 ${seedCount} seeds planted. ${sproutCount} sprouted into viral chains. (A seed is a first open that didn't share.)`;
  if (seedCount > 0 && sproutCount > 0) {
    const sproutRate = Math.round((sproutCount / seedCount) * 100);
    seedLine += ` That's a ${sproutRate}% sprout rate — ${sproutCount} people didn't just look, they shared.`;
    if (mediumLine) {
      seedLine += ` Opens by medium: ${mediumLine}.`;
    }
  }
  lines.push(seedLine);
  lines.push("");

  // Depth
  if (maxLevel > 0) {
    let chainLine = `🔗 Longest chain: ${maxLevel} levels deep.`;
    if (maxLevel >= 3) {
      chainLine += ` Someone opened it → shared it → that person shared it → and it kept going.`;
    } else if (maxLevel === 2) {
      chainLine += ` A scan became a share, which became another share.`;
    } else {
      chainLine += ` Seeds turned into shares.`;
    }
    lines.push(chainLine);
    lines.push("");
  }

  // Speed
  if (speedNarrative) {
    lines.push(`⚡ ${speedNarrative}`);
    lines.push("");
  }

  // Views
  lines.push(`👀 The content was viewed ${viewCount} times — including return visits from people who held onto the message.`);

  // Geography — only include if we have geo data
  if (geoNarrative) {
    lines.push(`📍 ${geoNarrative}`);
    lines.push("");
  }

  // Closing
  lines.push(closings[closingIndex]);
  lines.push("");


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
