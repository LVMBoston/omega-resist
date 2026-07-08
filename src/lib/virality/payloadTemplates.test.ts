import { describe, it, expect } from "vitest";
import { ALL_LEVELS, L00_BASE, L01 } from "./payloadTemplates";

const render = (level: (typeof ALL_LEVELS)[number]) =>
  level.segments.map((s) => `${s.key}${s.value}`).join("|");

describe("payloadTemplates snapshots", () => {
  it("L00 base carries utm_content and no p=", () => {
    expect(render(L00_BASE)).toMatchInlineSnapshot(
      `"https://omega-resist.lovable.app/deck/|{deck_slug}|?|utm_campaign={campaign_code}|utm_id={utm_id}|utm_source=L00|utm_medium={derived_from_utm_id}|utm_content={mobilize_code}-{utm_id}|t=l00-{mobilize_code}-{utm_id_first_10}|v_lvl=00"`,
    );
    expect(L00_BASE.segments.some((s) => s.key === "p=")).toBe(false);
    expect(L00_BASE.segments.some((s) => s.key === "utm_content=")).toBe(true);
  });

  it("L01 drops utm_content and adds p= pointing at L00 instance", () => {
    expect(L01.segments.some((s) => s.key === "utm_content=")).toBe(false);
    const p = L01.segments.find((s) => s.key === "p=");
    expect(p?.value).toContain(":{suffix}");
  });

  it("levels use uppercase Lxx in utm_source", () => {
    for (const lvl of ALL_LEVELS) {
      const src = lvl.segments.find((s) => s.key === "utm_source=");
      expect(src?.value).toMatch(/^L\d{2}$/);
    }
  });

  it("has no legacy m= parameter", () => {
    for (const lvl of ALL_LEVELS) {
      expect(lvl.segments.some((s) => s.key === "m=")).toBe(false);
    }
  });
});
