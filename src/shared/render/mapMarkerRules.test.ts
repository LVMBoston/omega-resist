import { describe, it, expect } from "vitest";
import {
  MEDIUM_COLORS,
  MEDIUM_COLORS_RGB,
  DEFAULT_COLOR,
  DEFAULT_COLOR_RGB,
  SPAWN_STROKE,
  DEFAULT_STROKE,
  resolveMarkerFill,
  resolveMarkerFillRgb,
  resolveMarkerStroke,
  resolveMarkerStrokeRgb,
} from "./mapMarkerRules";

const hexToRgb = (hex: string): [number, number, number] => {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};

describe("mapMarkerRules", () => {
  it("hex and rgb palettes stay in sync for every medium", () => {
    for (const key of Object.keys(MEDIUM_COLORS)) {
      expect(MEDIUM_COLORS_RGB[key]).toEqual(hexToRgb(MEDIUM_COLORS[key]));
    }
  });

  it("default color and stroke hex/rgb are in sync", () => {
    expect(DEFAULT_COLOR_RGB).toEqual(hexToRgb(DEFAULT_COLOR));
    expect(hexToRgb(SPAWN_STROKE)).toEqual([0x22, 0xc5, 0x5e]);
    expect(hexToRgb(DEFAULT_STROKE)).toEqual([0xff, 0xff, 0xff]);
  });

  it("resolveMarkerFill returns the medium color when known", () => {
    expect(resolveMarkerFill("qr")).toBe("#000099");
    expect(resolveMarkerFill("em")).toBe("#0066ff");
    expect(resolveMarkerFill("sms")).toBe("#99ccff");
    expect(resolveMarkerFill("tx")).toBe("#99ccff");
  });

  it("resolveMarkerFill falls back to slate for unknown/missing medium", () => {
    expect(resolveMarkerFill(undefined)).toBe(DEFAULT_COLOR);
    expect(resolveMarkerFill(null)).toBe(DEFAULT_COLOR);
    expect(resolveMarkerFill("")).toBe(DEFAULT_COLOR);
    expect(resolveMarkerFill("mystery")).toBe(DEFAULT_COLOR);
  });

  it("resolveMarkerFillRgb mirrors resolveMarkerFill", () => {
    expect(resolveMarkerFillRgb("qr")).toEqual([0x00, 0x00, 0x99]);
    expect(resolveMarkerFillRgb("mystery")).toEqual(DEFAULT_COLOR_RGB);
  });

  it("resolveMarkerStroke flips green when the marker has spawns", () => {
    expect(resolveMarkerStroke(true)).toBe(SPAWN_STROKE);
    expect(resolveMarkerStroke(false)).toBe(DEFAULT_STROKE);
    expect(resolveMarkerStrokeRgb(true)).toEqual([0x22, 0xc5, 0x5e]);
    expect(resolveMarkerStrokeRgb(false)).toEqual([0xff, 0xff, 0xff]);
  });
});
