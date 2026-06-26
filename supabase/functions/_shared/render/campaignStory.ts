/**
 * Campaign story formatter — single source of truth for both the
 * in-app Deck Editor and the SSR snapshot renderer.
 *
 * See `./README.md`. Pure logic only — no Supabase, no DOM, no Deno APIs.
 *
 * Wording chosen on 2026-06-26 to match the editor's prior text. The
 * SSR's earlier wording variants ("🌱 X seeds planted", "first card drop
 * shared", "sometimes more than once by the same person") are retired.
 */

export interface CampaignStoryInput {
  campaignTitle: string;
  /** ms epoch — official_start_at if set, else campaign created_at. */
  activeAnchorMs: number;
  /** ms epoch — usually Date.now(); injected for testability. */
  nowMs: number;
  dataSource?: "real" | "simulated";

  seedCount: number;
  sproutCount: number;
  viewCount: number;
  zipCount: number;
  /** Number of distinct US states reached. */
  stateCount: number;
  internationalCountries: string[];
  /** Maximum chain depth (0 = no shares yet). */
  maxDepth: number;

  /** Sorted by minted_at ascending. One entry per level. */
  propagationSpeed: { level: number; firstMintAt: string }[];
  shareMediums: { medium: string; count: number }[];
  lastShareAt: string | null;
  speedOriginCity: string | null;
  speedDestCity: string | null;
}

const MEDIUM_LABELS: Record<string, string> = {
  sms: "text",
  em: "email",
  wa: "WhatsApp",
  tw: "Twitter",
  fb: "Facebook",
};

const CLOSINGS = [
  "No ad budget. No algorithm. Every view came because one person decided another person needed to see it.",
  "No ads. No tricks. Just people passing something along because it mattered to them.",
  "No promotion. No platform boost. This spread the old-fashioned way — person to person, because it resonated.",
  "Zero dollars spent. Every single view was a conscious act of solidarity — someone choosing to share.",
];

export function formatCampaignStory(input: CampaignStoryInput): string {
  const {
    campaignTitle,
    activeAnchorMs,
    nowMs,
    dataSource,
    seedCount,
    sproutCount,
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
  } = input;

  const msActive = Math.max(0, nowMs - activeAnchorMs);
  const daysActive = Math.floor(msActive / (1000 * 60 * 60 * 24));
  const hoursRemainder = Math.floor(
    (msActive % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );

  // Medium percentage line
  const totalOpens = shareMediums.reduce((s, m) => s + m.count, 0);
  const mediumLine = totalOpens > 0
    ? shareMediums
        .map((m) =>
          `${Math.round((m.count / totalOpens) * 100)}% ${MEDIUM_LABELS[m.medium] || m.medium}`,
        )
        .join(", ")
    : "";

  // Speed narrative
  let speedNarrative = "";
  if (propagationSpeed.length >= 2) {
    const l0Time = new Date(propagationSpeed[0].firstMintAt).getTime();
    const last = propagationSpeed[propagationSpeed.length - 1];
    const lastTime = new Date(last.firstMintAt).getTime();
    const diffHours = Math.round((lastTime - l0Time) / (1000 * 60 * 60));
    let timePart: string;
    if (diffHours < 1) timePart = "under an hour";
    else if (diffHours < 24) timePart = `just ${diffHours} hours`;
    else {
      const d = Math.round(diffHours / 24);
      timePart = `${d} day${d > 1 ? "s" : ""}`;
    }
    speedNarrative = `Fastest share: From the first open shared to the first Level ${last.level} share took ${timePart}.`;
    if (speedOriginCity && speedDestCity) {
      speedNarrative = speedNarrative.slice(0, -1) +
        `; ${speedOriginCity} to ${speedDestCity}.`;
    }
  }

  // Geographic narrative
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

  const closingIndex = (seedCount + sproutCount) % CLOSINGS.length;

  const lines: string[] = [];

  // Title — wrapped in __TITLE__ markers so the split-into-two-columns
  // logic can pin it to the left column.
  lines.push(`__TITLE__Campaign: ${campaignTitle}__TITLE__`);
  lines.push(""); // blank line: title is its own paragraph block

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

  let seedLine =
    `While ${seedCount} seeds were planted, ${sproutCount} became sprouts, beginning a viral chain.`;
  if (seedCount > 0 && sproutCount > 0) {
    const sproutRate = Math.round((sproutCount / seedCount) * 100);
    seedLine +=
      ` That's a ${sproutRate}% sprout rate — ${sproutCount} people didn't just look; they shared.`;
  }
  lines.push(seedLine);
  if (mediumLine) {
    lines.push(`📱 Opens by medium: ${mediumLine}.`);
  }
  lines.push("");

  if (maxDepth > 0) {
    let chainLine = `🔗 Longest chain: ${maxDepth} levels deep.`;
    if (maxDepth >= 3) {
      chainLine +=
        ` Someone opened it → shared it → that person shared it → and it kept going.`;
    } else if (maxDepth === 2) {
      chainLine += ` An open became a share, which became another share.`;
    } else {
      chainLine += ` Seeds turned into shares.`;
    }
    lines.push(chainLine);
    lines.push("");
  }

  if (speedNarrative) {
    lines.push(`⚡ ${speedNarrative}`);
    lines.push("");
  }

  lines.push(
    `👀 The content was viewed ${viewCount} times — including return visits from people who held onto the message.`,
  );

  if (geoNarrative) {
    lines.push(`📍 ${geoNarrative}`);
    lines.push("");
  }

  lines.push(CLOSINGS[closingIndex]);
  lines.push("");

  return lines.join("\n");
}
