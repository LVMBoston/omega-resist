import { describe, it, expect } from "vitest";
import { checkOverlap, detectOverlaps, isOutOfBounds } from "./hotspotValidation";

// Regression source: docs/decisions/hotspots/2026-04-07_skip-data-hotspot-overlap_feature-doc_lovable.md
// Rule: overlap detection applies to ACTION hotspots only; data hotspots
// (chart, map, live_number) must be excluded from collision warnings.

const action = (id: string, x: number, y: number, w = 10, h = 10) => ({
  id, x, y, width: w, height: h, type: "sms",
});

const data = (id: string, x: number, y: number, w = 10, h = 10) => ({
  id, x, y, width: w, height: h, type: "map",
});

describe("hotspotValidation.checkOverlap", () => {
  it("detects overlap between two action hotspots", () => {
    expect(checkOverlap(action("a", 10, 10), action("b", 15, 15))).toBe(true);
  });

  it("returns false for clearly separated hotspots", () => {
    expect(checkOverlap(action("a", 10, 10), action("b", 50, 50))).toBe(false);
  });

  it("treats edge-touching as non-overlapping", () => {
    expect(checkOverlap(action("a", 10, 10), action("b", 20, 10))).toBe(false);
  });
});

describe("hotspotValidation.detectOverlaps", () => {
  it("ignores overlaps when one of the pair is a data hotspot", () => {
    const overlaps = detectOverlaps([action("a", 10, 10, 20, 20), data("m", 15, 15, 20, 20)]);
    expect(overlaps.size).toBe(0);
  });

  it("flags overlaps between two action hotspots", () => {
    const overlaps = detectOverlaps([action("a", 10, 10, 20, 20), action("b", 15, 15, 20, 20)]);
    expect(overlaps.get("a")).toContain("b");
    expect(overlaps.get("b")).toContain("a");
  });

  it("ignores data-data overlaps", () => {
    const overlaps = detectOverlaps([data("m1", 10, 10, 20, 20), data("m2", 15, 15, 20, 20)]);
    expect(overlaps.size).toBe(0);
  });
});

describe("hotspotValidation.isOutOfBounds", () => {
  it("flags hotspots extending past the right edge", () => {
    expect(isOutOfBounds(action("a", 95, 10, 10, 10))).toBe(true);
  });
  it("accepts a well-placed hotspot", () => {
    expect(isOutOfBounds(action("a", 10, 10, 20, 20))).toBe(false);
  });
});
