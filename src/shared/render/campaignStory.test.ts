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
    sproutCount: 4,
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
  };
}

describe("formatCampaignStory", () => {
  it("opens with the title in __TITLE__ markers and a blank line", () => {
    const out = formatCampaignStory(baseInput());
    const lines = out.split("\n");
    expect(lines[0]).toBe("__TITLE__Campaign: Test Campaign__TITLE__");
    expect(lines[1]).toBe("");
  });

  it("uses editor wording for the seed sentence (not '🌱 X seeds planted')", () => {
    const out = formatCampaignStory(baseInput());
    expect(out).toContain("While 10 seeds were planted, 4 became sprouts");
    expect(out).not.toContain("🌱");
  });

  it("uses editor wording for the views sentence", () => {
    const out = formatCampaignStory(baseInput());
    expect(out).toContain(
      "👀 The content was viewed 100 times — including return visits from people who held onto the message.",
    );
    expect(out).not.toContain("sometimes more than once by the same person");
  });

  it("omits the medium line when no opens", () => {
    const out = formatCampaignStory(baseInput());
    expect(out).not.toContain("📱 Opens by medium");
  });

  it("formats the active duration from the anchor", () => {
    const out = formatCampaignStory(baseInput());
    expect(out).toContain("Campaign active for 6 days 0 hours");
  });

  it("omits speed narrative when fewer than 2 levels recorded", () => {
    const out = formatCampaignStory(baseInput());
    expect(out).not.toContain("Fastest share");
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
      "Fastest share: From the first open shared to the first Level 2 share took 1 day; Boston, MA to Austin, TX.",
    );
  });
});
