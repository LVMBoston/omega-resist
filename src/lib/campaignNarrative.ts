import { supabase } from "@/integrations/supabase/client";
import { formatCampaignStory } from "@/shared/render/campaignStory";
import { computeCampaignStoryInputs } from "@/shared/render/campaignStoryInputs";

export interface NarrativeData {
  campaignTitle: string;
  campaignCreatedAt: string;
  dataSource: NarrativeDataSource;
  levelCounts: { level: number; count: number }[];
  intentCount: number;

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

  // Two-lane depth-corrected metrics.
  broadcastOpens: number;
  chainViewers: number;
  orphanCount: number;
  anyHopCompletionRate: number | null;
  anyHopCompletionNumerator: number;
  anyHopCompletionDenominator: number;
  longestChainIsLinear: boolean;
  longestChainTerminalUnopened: boolean;
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
  const inputs = await computeCampaignStoryInputs(supabase, {
    campaignCode,
    campaignId,
    dataSource,
  });

  return {
    campaignTitle: inputs.campaignTitle,
    campaignCreatedAt: inputs.campaignActiveAnchor,
    dataSource,
    levelCounts: inputs.levelCounts,
    intentCount: inputs.intentCount,

    viewCount: inputs.viewCount,
    zipCount: inputs.zipCount,
    usStates: inputs.usStates,
    internationalCountries: inputs.internationalCountries,
    propagationSpeed: inputs.propagationSpeed.map((p) => ({
      level: p.level,
      first_mint: p.firstMintAt,
    })),
    maxLevel: inputs.maxDepth,
    shareMediums: inputs.shareMediums,
    lastShareAt: inputs.lastShareAt,
    speedOriginCity: inputs.speedOriginCity,
    speedDestCity: inputs.speedDestCity,

    broadcastOpens: inputs.broadcastOpens,
    chainViewers: inputs.chainViewers,
    orphanCount: inputs.orphanCount,
    anyHopCompletionRate: inputs.anyHopCompletionRate,
    anyHopCompletionNumerator: inputs.anyHopCompletionNumerator,
    anyHopCompletionDenominator: inputs.anyHopCompletionDenominator,
    longestChainIsLinear: inputs.longestChainIsLinear,
    longestChainTerminalUnopened: inputs.longestChainTerminalUnopened,
  };
}

// ─── Headline tier (compact, fits one iPhone screen at 30pt) ─────────

export function generateHeadlineOnly(data: NarrativeData): string {
  const {
    campaignTitle,
    campaignCreatedAt,
    dataSource,
    broadcastOpens,
    chainViewers,
    anyHopCompletionRate,
    viewCount,
    zipCount,
    usStates,
    propagationSpeed,
    maxLevel,
  } = data;

  const msActive = Date.now() - new Date(campaignCreatedAt).getTime();
  const daysActive = Math.max(0, Math.floor(msActive / (1000 * 60 * 60 * 24)));
  const hoursRemainder = Math.floor((msActive % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  const lines: string[] = [];
  lines.push(campaignTitle);
  lines.push(dataSource === "simulated" ? "Simulation report" : "Real data report");
  lines.push(`${daysActive} days ${hoursRemainder} hours active`);
  lines.push("");

  // Breadth
  lines.push(`${broadcastOpens} broadcast opens`);
  lines.push("");

  // Depth — reframed for single-carrier linear chains so a persistence
  // fact is never presented as viral spread. Never lead with "N levels
  // deep" as evidence of reach; that's what breadth and landing say.
  if (chainViewers > 0) {
    if (data.longestChainIsLinear && maxLevel >= 3) {
      let carrier = `Deepest chain: one persistent sharer, ${maxLevel} hops`;
      if (data.longestChainTerminalUnopened) carrier += ` (last share unopened)`;
      lines.push(carrier);
    } else {
      lines.push(`${chainViewers} chain shares, longest walk ${maxLevel} hop${maxLevel === 1 ? "" : "s"}`);
    }
    if (propagationSpeed.length >= 2) {
      const l0Time = new Date(propagationSpeed[0].first_mint);
      const lastLevel = propagationSpeed[propagationSpeed.length - 1];
      const lastTime = new Date(lastLevel.first_mint);
      const diffHours = Math.round((lastTime.getTime() - l0Time.getTime()) / (1000 * 60 * 60));
      let timePart: string;
      if (diffHours < 1) timePart = "< 1 hour";
      else if (diffHours < 24) timePart = `${diffHours} hours`;
      else {
        const days = Math.round(diffHours / 24);
        timePart = `${days} day${days > 1 ? "s" : ""}`;
      }
      let speedLine = `Fastest share to depth ${lastLevel.level}: ${timePart}`;
      if (data.speedOriginCity && data.speedDestCity) {
        speedLine += `; ${data.speedOriginCity} to ${data.speedDestCity}`;
      }
      lines.push(speedLine);
    }
    lines.push("");
  }

  // Landing
  if (anyHopCompletionRate !== null && data.anyHopCompletionDenominator > 0) {
    const pct = Math.round(anyHopCompletionRate * 100);
    lines.push(`${pct}% of shares reached another opener (${data.anyHopCompletionNumerator}/${data.anyHopCompletionDenominator})`);
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
  const seedCount = data.levelCounts.find((l) => l.level === 0)?.count || 0;
  return formatCampaignStory({
    campaignTitle: data.campaignTitle,
    activeAnchorMs: new Date(data.campaignCreatedAt).getTime(),
    nowMs: Date.now(),
    dataSource: data.dataSource,
    seedCount,
    intentCount: data.intentCount,

    viewCount: data.viewCount,
    zipCount: data.zipCount,
    stateCount: data.usStates.length,
    internationalCountries: data.internationalCountries,
    maxDepth: data.maxLevel,
    propagationSpeed: data.propagationSpeed.map((p) => ({
      level: p.level,
      firstMintAt: p.first_mint,
    })),
    shareMediums: data.shareMediums,
    lastShareAt: data.lastShareAt,
    speedOriginCity: data.speedOriginCity,
    speedDestCity: data.speedDestCity,

    broadcastOpens: data.broadcastOpens,
    chainViewers: data.chainViewers,
    orphanCount: data.orphanCount,
    anyHopCompletionRate: data.anyHopCompletionRate,
    anyHopCompletionNumerator: data.anyHopCompletionNumerator,
    anyHopCompletionDenominator: data.anyHopCompletionDenominator,
    longestChainIsLinear: data.longestChainIsLinear,
    longestChainTerminalUnopened: data.longestChainTerminalUnopened,
  });
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
