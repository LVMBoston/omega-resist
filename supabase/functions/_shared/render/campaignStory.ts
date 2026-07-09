/**
 * Campaign story formatter — single source of truth for both the
 * in-app Deck Editor and the SSR snapshot renderer.
 *
 * 2026-07-08 (v2): the "sprout" concept is retired. The story now carries
 * three distinct facts in three paragraphs, per the three-facts test:
 *   1. BREADTH   — how far the seed reached (Lane A broadcast opens, total
 *                  view events including repeats, and channel mix).
 *   2. DEPTH     — how many hops the chain actually walked (Lane B chain
 *                  tokens and longest observed depth).
 *   3. LANDING   — whether a share reached a recipient who then opened it
 *                  (any-hop completion rate).
 * Deleting any of the three would drop a fact the others do not carry.
 * Anything that would only paraphrase Lane B a second time was removed
 * rather than reworded.
 *
 * Pure logic only — no Supabase, no DOM, no Deno APIs.
 */

export interface CampaignStoryInput {
  campaignTitle: string;
  /** ms epoch — official_start_at if set, else campaign created_at. */
  activeAnchorMs: number;
  /** ms epoch — usually Date.now(); injected for testability. */
  nowMs: number;
  dataSource?: "real" | "simulated";

  seedCount: number;
  /** Sprouted seeds where no child has been viewed yet (orange map border). */
  intentCount?: number;

  viewCount: number;
  zipCount: number;
  /** Number of distinct US states reached. */
  stateCount: number;
  internationalCountries: string[];
  /** Maximum chain depth (0 = no shares yet). */
  maxDepth: number;

  /**
   * Sorted by minted_at ascending. `level` is true_depth (from
   * token_lineage), NOT the clamped tokens.level column.
   */
  propagationSpeed: { level: number; firstMintAt: string }[];
  shareMediums: { medium: string; count: number }[];
  lastShareAt: string | null;
  speedOriginCity: string | null;
  speedDestCity: string | null;

  /** True if the deepest chain has a >= 3-hop single-carrier tail. */
  longestChainIsLinear?: boolean;
  /** Length of that single-carrier tail. Used instead of maxDepth when framing the depth paragraph as persistence. */
  singleCarrierTailHops?: number;
  /** True if the deepest token in a linear chain has no view event. */
  longestChainTerminalUnopened?: boolean;

  /** ── Two-lane depth-corrected metrics (from token_lineage). ──── */
  broadcastOpens: number;
  chainViewers: number;
  orphanCount: number;
  anyHopCompletionRate: number | null;
  anyHopCompletionNumerator: number;
  anyHopCompletionDenominator: number;

  /**
   * Emit the leading `__TITLE__Campaign: <title>__TITLE__` block.
   * Default true. Pass false when the slide already renders a separate
   * header hotspot to avoid duplication.
   */
  includeTitle?: boolean;
}

const MEDIUM_LABELS: Record<string, string> = {
  sms: "text",
  social: "text",
  em: "email",
  wa: "WhatsApp",
  tw: "Twitter",
  fb: "Facebook",
};

export function formatCampaignStory(input: CampaignStoryInput): string {
  const {
    campaignTitle,
    activeAnchorMs,
    nowMs,
    dataSource,
    seedCount,
    intentCount,
    viewCount,
    zipCount,
    stateCount,
    internationalCountries,
    maxDepth,
    propagationSpeed,
    shareMediums,
    lastShareAt,
    speedOriginCity,
    speedDestCity,
    broadcastOpens,
    chainViewers,
    orphanCount,
    anyHopCompletionRate,
    anyHopCompletionNumerator,
    anyHopCompletionDenominator,
    longestChainIsLinear = false,
    singleCarrierTailHops = 0,
    longestChainTerminalUnopened = false,
    includeTitle = true,
  } = input;

  const msActive = Math.max(0, nowMs - activeAnchorMs);
  const daysActive = Math.floor(msActive / (1000 * 60 * 60 * 24));
  const hoursRemainder = Math.floor(
    (msActive % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );

  // Medium mix (aggregate aliases so sms + social merge under "text").
  const totalOpens = shareMediums.reduce((s, m) => s + m.count, 0);
  const labelTotals = new Map<string, number>();
  for (const m of shareMediums) {
    const label = MEDIUM_LABELS[m.medium] || m.medium;
    labelTotals.set(label, (labelTotals.get(label) || 0) + m.count);
  }
  const mediumLine = totalOpens > 0
    ? Array.from(labelTotals.entries())
        .map(([label, count]) => `${Math.round((count / totalOpens) * 100)}% ${label}`)
        .join(", ")
    : "";

  // Speed narrative removed 2026-07-08: the deepest chain is typically
  // single-carrier persistence, so timing its endpoints framed one
  // person's solo thread as viral spread. Input fields
  // (propagationSpeed, speedOriginCity, speedDestCity) left in the
  // type for a follow-up cleanup.
  void propagationSpeed; void speedOriginCity; void speedDestCity;

  // Geographic narrative (kept — unique fact: places).
  let geoNarrative = "";
  if (zipCount > 0) {
    geoNarrative = `The content reached ${zipCount} different zip codes`;
    if (stateCount > 0) {
      geoNarrative += ` across ${stateCount} state${stateCount > 1 ? "s" : ""}`;
    }
    geoNarrative += ".";
    if (internationalCountries.length > 0) {
      geoNarrative +=
        ` It even crossed borders, reaching ${internationalCountries.join(", ")}.`;
    }
  }

  const lines: string[] = [];

  if (includeTitle) {
    lines.push(`__TITLE__Campaign: ${campaignTitle}__TITLE__`);
    lines.push("");
  }

  if (dataSource === "simulated") {
    lines.push("Simulation report — not real field activity.");
  }

  const now = new Date(nowMs);
  const dateStr = now.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: false, timeZoneName: "short",
  });
  lines.push(`Date of this report: ${dateStr} ${timeStr}`);
  const startDate = new Date(activeAnchorMs);
  const startFormatted = startDate.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
  lines.push(`Started ${startFormatted}`);
  lines.push(`Campaign active for ${daysActive} days ${hoursRemainder} hours`);
  if (lastShareAt) {
    const ls = new Date(lastShareAt);
    const lsDate = ls.toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
    const lsTime = ls.toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
    });
    lines.push(`Last share: ${lsDate} ${lsTime}`);
  }
  lines.push("");

  // ── 1. BREADTH ────────────────────────────────────────────────────
  // Unique facts: (a) broadcast opens (Lane A), (b) total view events
  // including repeats, (c) channel mix. Nothing here restates Lane B.
  let breadthLine = `📢 The seed was opened ${broadcastOpens} time${broadcastOpens === 1 ? "" : "s"} at the source (Lane A: base QR/link scans and per-scan instances, including repeats)`;
  if (viewCount > 0 && viewCount !== broadcastOpens) {
    breadthLine += `. All told, the content generated ${viewCount} view event${viewCount === 1 ? "" : "s"} across every level`;
  }
  breadthLine += ".";
  lines.push(breadthLine);
  if (mediumLine) {
    lines.push(`📱 Channel mix: ${mediumLine}.`);
  }
  if (typeof intentCount === "number" && intentCount > 0) {
    lines.push(
      `🟠 ${intentCount} seed${intentCount === 1 ? " has" : "s have"} generated a share link that no recipient has opened yet — intent recorded, delivery unconfirmed.`,
    );
  }
  lines.push("");

  // ── 2. DEPTH ──────────────────────────────────────────────────────
  // Unique fact: how far the chain walked from a seed. If chainViewers
  // is zero we skip the paragraph rather than pad it with "0 shares".
  // When the deepest chain is single-carrier linear (branching factor 1
  // at every hop), the paragraph reframes it as persistence — one
  // person carrying the message — and explicitly does NOT imply viral
  // multi-person spread.
  if (chainViewers > 0) {
    if (longestChainIsLinear && singleCarrierTailHops >= 3) {
      const tail = singleCarrierTailHops;
      let carrierLine = `🔗 The deepest chain's tail is single-carrier persistence: one sharer carried the message across ${tail} consecutive hops with branching factor 1 at each`;
      if (longestChainTerminalUnopened) {
        carrierLine += `; the terminal share was never opened`;
      }
      carrierLine += `. Not multi-person spread. (Lane B totals: ${chainViewers} downstream share${chainViewers === 1 ? "" : "s"}, orphans excluded.)`;
      lines.push(carrierLine);
      lines.push(
        `Depth here is persistence, not reach — breadth and landing paragraphs carry the reach fact.`,
      );
    } else {
      let depthLine = `🔗 That broadcast produced ${chainViewers} downstream share${chainViewers === 1 ? "" : "s"} (Lane B: mint_share descendants, orphans excluded)`;
      if (maxDepth >= 1) {
        depthLine += `, walking ${maxDepth} hop${maxDepth === 1 ? "" : "s"} from a seed at its furthest`;
      }
      depthLine += ".";
      lines.push(depthLine);
    }
    lines.push("");
  }

  // ── 3. LANDING ────────────────────────────────────────────────────
  // Unique fact: did the shares actually land — did a recipient open
  // the shared link and produce a further child. Skip when there is
  // no chain to measure against.
  if (
    anyHopCompletionRate !== null &&
    anyHopCompletionDenominator > 0
  ) {
    const pct = Math.round(anyHopCompletionRate * 100);
    lines.push(
      `✅ Of those ${anyHopCompletionDenominator} chain share${anyHopCompletionDenominator === 1 ? "" : "s"}, ${anyHopCompletionNumerator} (${pct}%) reached a recipient who opened it and passed it along again.`,
    );
    lines.push("");
  }

  // Data anomalies — surfaced only when present. Terse; not padded.
  if (orphanCount > 0) {
    lines.push(
      `⚠️ Data anomalies: ${orphanCount} orphan token${orphanCount === 1 ? "" : "s"} (parentless, non-L00-shaped) excluded from both lanes. Flagged, not resolved.`,
    );
    lines.push("");
  }


  if (geoNarrative) {
    lines.push(`📍 ${geoNarrative}`);
    lines.push("");
  }

  return lines.join("\n");
}
