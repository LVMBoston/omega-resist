import { describe, expect, it } from "vitest";
import {
  HOTSPOT_DEFAULTS,
  resolveLiveNumberStyle,
} from "./hotspotDefaults";

describe("resolveLiveNumberStyle", () => {
  it("returns canonical defaults when style is undefined (non-story)", () => {
    const r = resolveLiveNumberStyle(undefined, { isStory: false });
    expect(r.fontSize).toBe(24);
    expect(r.fontWeight).toBe("700");
    expect(r.color).toBe("#1a1a1a");
    expect(r.backgroundColor).toBe("transparent");
    expect(r.textAlign).toBe("center");
    expect(r.verticalAlign).toBe("middle");
    expect(r.fontFamily).toBe("system-ui, -apple-system, sans-serif");
    expect(r.paddingPx).toBe(0);
    expect(r.borderRadiusPx).toBe(0);
    expect(r.clipOverflow).toBe(true);
    expect(r.lineHeight).toBeUndefined();
  });

  it("applies story overrides when isStory=true", () => {
    const r = resolveLiveNumberStyle(undefined, { isStory: true });
    expect(r.textAlign).toBe("left");
    expect(r.verticalAlign).toBe("top");
    expect(r.paddingPx).toBe(12);
    expect(r.lineHeight).toBe(1.25);
  });

  it("honors caller-provided values over defaults", () => {
    const r = resolveLiveNumberStyle(
      {
        fontSize: "32px",
        fontWeight: 600,
        color: "#fff",
        backgroundColor: "#000",
        textAlign: "right",
        verticalAlign: "bottom",
        fontFamily: "Calibri",
        padding: "5px",
        borderRadius: "8",
        clipOverflow: false,
      },
      { isStory: true }
    );
    expect(r.fontSize).toBe(32);
    expect(r.fontWeight).toBe("600");
    expect(r.color).toBe("#fff");
    expect(r.backgroundColor).toBe("#000");
    expect(r.textAlign).toBe("right");
    expect(r.verticalAlign).toBe("bottom");
    expect(r.fontFamily).toBe("Calibri");
    expect(r.paddingPx).toBe(5);
    expect(r.borderRadiusPx).toBe(8);
    expect(r.clipOverflow).toBe(false);
  });

  it("parses bare numeric strings ('20') and 'Npx' identically", () => {
    expect(resolveLiveNumberStyle({ fontSize: "20" }, { isStory: false }).fontSize).toBe(20);
    expect(resolveLiveNumberStyle({ fontSize: "20px" }, { isStory: false }).fontSize).toBe(20);
    expect(resolveLiveNumberStyle({ fontSize: 20 }, { isStory: false }).fontSize).toBe(20);
  });

  it("falls back when numeric parse fails", () => {
    const r = resolveLiveNumberStyle({ fontSize: "abc", padding: "xx" }, { isStory: false });
    expect(r.fontSize).toBe(24);
    expect(r.paddingPx).toBe(0);
  });

  it("coerces 'middle' verticalAlign to 'middle'", () => {
    expect(
      resolveLiveNumberStyle({ verticalAlign: "middle" }, { isStory: true }).verticalAlign
    ).toBe("middle");
    expect(
      resolveLiveNumberStyle({ verticalAlign: "center" }, { isStory: true }).verticalAlign
    ).toBe("middle");
  });

  it("exposes raw default constants for non-style use sites", () => {
    expect(HOTSPOT_DEFAULTS.liveNumber.color).toBe("#1a1a1a");
    expect(HOTSPOT_DEFAULTS.story.paddingPx).toBe(12);
    expect(HOTSPOT_DEFAULTS.manualHtml.fontWeight).toBe("400");
    expect(HOTSPOT_DEFAULTS.mapLegend.fontWeight).toBe("600");
  });
});
