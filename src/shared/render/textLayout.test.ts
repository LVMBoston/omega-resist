import { describe, it, expect } from "vitest";
import {
  wordWrap,
  maxCharsForWidth,
  normalizeVAlign,
  freeSpaceOffset,
  tspanStartY,
  AVG_CHAR_WIDTH_RATIO,
  LINE_HEIGHT_RATIO,
} from "./textLayout";

describe("wordWrap", () => {
  it("returns the original string when it fits", () => {
    expect(wordWrap("hello world", 20)).toEqual(["hello world"]);
  });
  it("greedy-wraps on spaces", () => {
    expect(wordWrap("the quick brown fox jumps", 10)).toEqual([
      "the quick",
      "brown fox",
      "jumps",
    ]);
  });
  it("never breaks a single long word", () => {
    expect(wordWrap("supercalifragilistic word", 5)).toEqual([
      "supercalifragilistic",
      "word",
    ]);
  });
  it("handles empty input", () => {
    expect(wordWrap("", 10)).toEqual([""]);
  });
});

describe("maxCharsForWidth", () => {
  it("uses the AVG_CHAR_WIDTH_RATIO default", () => {
    // 200 / (20 * 0.52) = 19.23 -> floor 19
    expect(maxCharsForWidth(200, 20)).toBe(19);
  });
  it("returns at least 1 when width is tiny", () => {
    expect(maxCharsForWidth(1, 100)).toBe(1);
  });
});

describe("normalizeVAlign", () => {
  it("maps middle -> center", () => {
    expect(normalizeVAlign("middle")).toBe("center");
  });
  it("falls back when undefined", () => {
    expect(normalizeVAlign(undefined, "center")).toBe("center");
  });
  it("accepts top/bottom verbatim", () => {
    expect(normalizeVAlign("BOTTOM")).toBe("bottom");
    expect(normalizeVAlign("top")).toBe("top");
  });
});

describe("freeSpaceOffset", () => {
  it("returns 0 for top", () => {
    expect(freeSpaceOffset(40, 100, "top")).toBe(0);
  });
  it("centers in remaining space", () => {
    expect(freeSpaceOffset(40, 100, "center")).toBe(30);
  });
  it("pins to bottom", () => {
    expect(freeSpaceOffset(40, 100, "bottom")).toBe(60);
  });
  it("clamps negative free space to 0", () => {
    expect(freeSpaceOffset(150, 100, "center")).toBe(0);
  });
});

describe("tspanStartY", () => {
  it("centers a single line", () => {
    // box y=0 h=100 fontSize=20 totalH=24 padInset=0 -> (100-24)/2 + 17 = 55
    expect(tspanStartY(0, 100, 20, 24, 0, "center")).toBe(55);
  });
  it("respects top alignment with padding", () => {
    expect(tspanStartY(10, 100, 20, 24, 4, "top")).toBe(10 + 4 + 19);
  });
});

describe("constants", () => {
  it("matches SSR defaults", () => {
    expect(AVG_CHAR_WIDTH_RATIO).toBe(0.52);
    expect(LINE_HEIGHT_RATIO).toBe(1.2);
  });
});
