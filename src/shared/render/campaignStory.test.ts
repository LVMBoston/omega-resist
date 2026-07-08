import { describe, it, expect } from "vitest";
import { formatCampaignStory, type CampaignStoryInput } from "./campaignStory";

const FIXED_NOW = new Date("2026-06-26T15:00:00Z").getTime();
const FIXED_ANCHOR = new Date("2026-06-20T15:00:00Z").getTime();

function baseInput(): CampaignStoryInput {
  return {
    campaignTitle: "Test Campaign",
    activeAnchorMs: FIXED_ANCHOR,
    nowMs: FIXED_NOW,
    seedCount: 10,
    viewCount: 100,
    zipCount: 20,
    stateCount: 5,
    internationalCountries: [],
    maxDepth: 2,
    propagationSpeed: [],
    shareMediums: [],
    lastShareAt: null,
    speedOriginCity: null,
    speedDestCity: null,
    broadcastOpens: 12,
    chainViewers: 8,
    orphanCount: 0,
    anyHopCompletionRate: 0.5,
    anyHopCompletionNumerator: 4,
    anyHopCompletionDenominator: 8,
  };
}

describe("formatCampaignStory (v2 — three-facts structure)", () => {
  it("opens with the title in __TITLE__ markers and a blank line", () => {
    const out = formatCampaignStory(baseInput());
    const lines = out.split("\n");
    expect(lines[0]).toBe("__TITLE__Campaign: Test Campaign__TITLE__");
    expect(lines[1]).toBe("");
  });

  it("carries the BREADTH fact (Lane A opens) in its own paragraph", () => {
    const out = formatCampaignStory(baseInput());
    expect(out).toContain("📢 The seed was opened 12 times");
    expect(out).toContain("Lane A");
  });

  it("carries the DEPTH fact (chain shares + hops) distinct from breadth", () => {
    const out = formatCampaignStory(baseInput());
    expect(out).toContain("🔗 That broadcast produced 8 downstream shares");
    expect(out).toContain("walking 2 hops from a seed at its furthest");
  });

  it("carries the LANDING fact (any-hop conversion) distinct from depth", () => {
    const out = formatCampaignStory(baseInput());
    expect(out).toContain("✅ Of those 8 chain shares, 4 (50%)");
    expect(out).toContain("passed it along again");
  });

  it("does NOT mention sprouts anywhere (sprout concept retired)", () => {
    const out = formatCampaignStory(baseInput());
    expect(out.toLowerCase()).not.toContain("sprout");
  });

  it("omits DEPTH paragraph entirely when there is no chain (chainViewers=0)", () => {
    const out = formatCampaignStory({ ...baseInput(), chainViewers: 0, maxDepth: 0, anyHopCompletionRate: null, anyHopCompletionDenominator: 0 });
    expect(out).not.toContain("🔗");
    expect(out).not.toContain("✅");
  });

  it("surfaces orphan anomalies only when present", () => {
    const clean = formatCampaignStory(baseInput());
    expect(clean).not.toContain("⚠️");
    const dirty = formatCampaignStory({ ...baseInput(), orphanCount: 3 });
    expect(dirty).toContain("⚠️ Data anomalies: 3 orphan tokens");
  });

  it("formats the active duration from the anchor", () => {
    const out = formatCampaignStory(baseInput());
    expect(out).toContain("Campaign active for 6 days 0 hours");
  });

  it("formats speed narrative with origin/destination cities", () => {
    const input: CampaignStoryInput = {
      ...baseInput(),
      propagationSpeed: [
        { level: 0, firstMintAt: "2026-06-20T15:00:00Z" },
        { level: 2, firstMintAt: "2026-06-21T15:00:00Z" },
      ],
      speedOriginCity: "Boston, MA",
      speedDestCity: "Austin, TX",
    };
    const out = formatCampaignStory(input);
    expect(out).toContain(
      "Fastest share: From the first open shared to the first depth-2 share took 1 day; Boston, MA to Austin, TX.",
    );
  });

  it("suppresses the __TITLE__ block when includeTitle: false", () => {
    const out = formatCampaignStory({ ...baseInput(), includeTitle: false });
    expect(out).not.toContain("__TITLE__");
    const firstNonEmpty = out.split("\n").find((l) => l.trim().length > 0);
    expect(firstNonEmpty).toMatch(/^Date of this report:/);
  });

  it("three-facts test: deleting any one of breadth/depth/landing loses a unique number", () => {
    const out = formatCampaignStory(baseInput());
    // breadth carries 12, depth carries 8 chain + 2 levels, landing carries 4/8 = 50%.
    // Confirm each number appears exactly in its owning paragraph, not duplicated.
    const paragraphs = out.split("\n\n");
    const breadth = paragraphs.find((p) => p.includes("📢")) || "";
    const depth = paragraphs.find((p) => p.includes("🔗")) || "";
    const landing = paragraphs.find((p) => p.includes("✅")) || "";
    expect(breadth).toContain("12");
    expect(depth).toContain("8");
    expect(landing).toContain("50%");
    // Landing's numerator (4) should not appear in breadth or depth.
    expect(breadth).not.toMatch(/\b4\b/);
    expect(depth).not.toMatch(/\b4\b/);
  });
});
