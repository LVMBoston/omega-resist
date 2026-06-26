import { describe, it, expect } from "vitest";
import { splitCampaignStoryAtMidpoint, applyStorySegment } from "./campaignStorySplit";

describe("splitCampaignStoryAtMidpoint", () => {
  it("returns empty halves for empty input", () => {
    expect(splitCampaignStoryAtMidpoint("")).toEqual({ first: "", second: "" });
  });

  it("returns single block in first half when only one paragraph", () => {
    const r = splitCampaignStoryAtMidpoint("Just one paragraph.");
    expect(r.first).toBe("Just one paragraph.");
    expect(r.second).toBe("");
  });

  it("pins __TITLE__ to first and 'Date of this report:' to second", () => {
    const story = [
      "__TITLE__Hello World__TITLE__",
      "Para one with some words.",
      "Para two with some words.",
      "Para three.",
      "Date of this report: 2026-06-26",
    ].join("\n\n");
    const r = splitCampaignStoryAtMidpoint(story);
    expect(r.first.startsWith("__TITLE__Hello World__TITLE__")).toBe(true);
    expect(r.second.includes("Date of this report:")).toBe(true);
    expect(r.first).not.toContain("Date of this report:");
    expect(r.second).not.toContain("__TITLE__");
  });

  it("splits at midpoint by character count", () => {
    const story = ["aaaa", "bbbb", "cccccccc", "dd"].join("\n\n");
    // total 18; best split keeps things ~balanced
    const r = splitCampaignStoryAtMidpoint(story);
    expect(r.first.length + r.second.length).toBeGreaterThan(0);
    expect(r.first).toContain("aaaa");
    expect(r.second).toContain("dd");
  });

  it("handles missing footer gracefully", () => {
    const story = ["__TITLE__T__TITLE__", "p1 p1 p1", "p2 p2 p2 p2 p2"].join("\n\n");
    const r = splitCampaignStoryAtMidpoint(story);
    expect(r.first).toContain("__TITLE__");
    expect(r.second.length).toBeGreaterThan(0);
  });

  it("applyStorySegment returns full when segment is full/undefined", () => {
    const s = "a\n\nb\n\nc";
    expect(applyStorySegment(s, "full")).toBe(s);
    expect(applyStorySegment(s, undefined)).toBe(s);
  });

  it("applyStorySegment returns first/second slices", () => {
    const s = "aaa\n\nbbb\n\nccc\n\nddd";
    const first = applyStorySegment(s, "first");
    const second = applyStorySegment(s, "second");
    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBeGreaterThan(0);
    expect(first + "\n\n" + second).toContain("aaa");
  });
});
