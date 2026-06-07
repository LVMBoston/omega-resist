import { assertEquals, assertAlmostEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { zoomForBounds, lngToWorldX, latToWorldY } from "./geo.ts";

// ---------------------------------------------------------------------------
// Regression: 2026-06-07 snapshot orientation/viewport/text bug
// See docs/decisions/snapshots/2026-06-07_snapshot-orientation-viewport-text-fix_post-mortem_lovable.md
// ---------------------------------------------------------------------------

Deno.test("zoomForBounds returns a fractional zoom (no Math.floor)", () => {
  // CONUS bounding box into a typical landscape map hotspot.
  const z = zoomForBounds(49.5, 24.5, -66.9, -125.0, 1404, 783);
  assert(z > 0 && z < 18, `zoom out of range: ${z}`);
  assert(z % 1 !== 0, `zoom must be fractional, got integer ${z}`);
});

Deno.test("zoomForBounds picks the limiting dimension (min of lat/lng)", () => {
  // A very wide, short box should be limited by longitude.
  const wide = zoomForBounds(40, 39, 0, -180, 1000, 1000);
  // A very tall, narrow box should be limited by latitude.
  const tall = zoomForBounds(80, -80, 0.5, -0.5, 1000, 1000);
  assert(wide < tall, `expected wide box to need a smaller zoom: wide=${wide} tall=${tall}`);
});

Deno.test("zoomForBounds at different canvas widths produces different zooms", () => {
  // This is exactly the failure mode that motivated the fix: reusing the
  // same savedZoom at a different canvas width changes the visible extent.
  // The new code re-derives zoom from bounds at the target canvas size,
  // so a wider canvas should fit the same bounds at a HIGHER zoom.
  const narrow = zoomForBounds(49.5, 24.5, -66.9, -125.0, 700, 783);
  const wide = zoomForBounds(49.5, 24.5, -66.9, -125.0, 1404, 783);
  assert(wide > narrow, `wider canvas should yield higher zoom; narrow=${narrow} wide=${wide}`);
});

Deno.test("zoomForBounds is clamped to [0, 18]", () => {
  const whole = zoomForBounds(85, -85, 180, -180, 256, 256);
  assert(whole >= 0 && whole <= 18, `out of range: ${whole}`);
  const tiny = zoomForBounds(40.001, 40.000, -100.001, -100.000, 4096, 4096);
  assert(tiny >= 0 && tiny <= 18, `out of range: ${tiny}`);
});

Deno.test("Web Mercator helpers round-trip a known point", () => {
  // NYC ~ (40.7128, -74.0060). At z=0 the world is one 256-pixel tile.
  const x = lngToWorldX(-74.006, 0);
  const y = latToWorldY(40.7128, 0);
  assertAlmostEquals(x, ((-74.006 + 180) / 360) * 256, 1e-9);
  assert(y > 0 && y < 256, `y out of world bounds: ${y}`);
});

Deno.test("zoomForBounds for a portrait-sized canvas does not produce landscape extent", () => {
  // Regression guard: the bug rendered a portrait 1080x1920 canvas with the
  // same numeric savedZoom that was captured at a landscape preview,
  // yielding way too much longitude. Here we just confirm that the
  // bounds-derived zoom for a tall, narrow canvas is dominated by the
  // narrower (width-limited) dimension.
  const z = zoomForBounds(49.5, 24.5, -66.9, -125.0, 1080, 1920);
  // The same bounds in a landscape canvas:
  const zLandscape = zoomForBounds(49.5, 24.5, -66.9, -125.0, 1920, 1080);
  assert(z < zLandscape, `portrait canvas should fit the same bounds at a smaller zoom; portrait=${z} landscape=${zLandscape}`);
});
