import { describe, it, expect } from "vitest";
import { classifyHotspots } from "./hotspotClassification";

// Regression source: mem://features/deck-editor/unified-slide-model
// Rule: slides auto-promote based on the kinds of hotspots present.

describe("classifyHotspots", () => {
  it("no hotspots -> display_only", () => {
    expect(classifyHotspots([])).toEqual({ slideType: "image", templateType: "display_only" });
  });

  it("only action hotspots -> interactive_share", () => {
    expect(classifyHotspots([{ type: "sms" }, { type: "external_link" }])).toEqual({
      slideType: "spread-word",
      templateType: "interactive_share",
    });
  });

  it("only data hotspots -> stats_page", () => {
    expect(classifyHotspots([{ type: "map" }, { type: "live_number" }])).toEqual({
      slideType: "spread-word",
      templateType: "stats_page",
    });
  });

  it("mixed action + data -> hybrid", () => {
    expect(classifyHotspots([{ type: "sms" }, { type: "chart" }])).toEqual({
      slideType: "spread-word",
      templateType: "hybrid",
    });
  });

  it("image hotspot counts as data -> stats_page", () => {
    expect(classifyHotspots([{ type: "image" }])).toEqual({
      slideType: "spread-word",
      templateType: "stats_page",
    });
  });

  it("ignores unknown hotspot types when classifying", () => {
    // Unknown types are neither action nor data, so it falls through to
    // the action-only branch (interactive_share).
    expect(classifyHotspots([{ type: "mystery" }])).toEqual({
      slideType: "spread-word",
      templateType: "interactive_share",
    });
  });
});
