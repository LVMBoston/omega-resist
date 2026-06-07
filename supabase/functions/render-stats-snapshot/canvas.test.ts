import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  deriveCanvasFromImage,
  defaultSolidCanvas,
  MAX_CANVAS_SIDE,
} from "./canvas.ts";

// ---------------------------------------------------------------------------
// Regression: 2026-06-07 snapshot orientation/viewport/text bug
// Symptoms: a landscape (1404x783) template background was being rendered into
// a hard-coded portrait 1080x1920 canvas, distorting text and the map extent.
// ---------------------------------------------------------------------------

Deno.test("deriveCanvasFromImage preserves landscape aspect ratio", () => {
  const c = deriveCanvasFromImage(1404, 783);
  const aspect = c.width / c.height;
  const expected = 1404 / 783;
  assert(Math.abs(aspect - expected) < 0.01, `aspect mismatch: ${aspect} vs ${expected}`);
  assert(c.width >= c.height, `landscape template must render landscape; got ${c.width}x${c.height}`);
});

Deno.test("deriveCanvasFromImage preserves portrait aspect ratio", () => {
  const c = deriveCanvasFromImage(1080, 1920);
  assert(c.height > c.width, `portrait template must render portrait; got ${c.width}x${c.height}`);
});

Deno.test("deriveCanvasFromImage caps longest side at MAX_CANVAS_SIDE", () => {
  const c = deriveCanvasFromImage(4000, 2000);
  assertEquals(Math.max(c.width, c.height), MAX_CANVAS_SIDE);
});

Deno.test("deriveCanvasFromImage does NOT upscale small images", () => {
  const c = deriveCanvasFromImage(800, 600);
  assertEquals(c.width, 800);
  assertEquals(c.height, 600);
});

Deno.test("deriveCanvasFromImage falls back to defaults for invalid input", () => {
  const def = defaultSolidCanvas();
  assertEquals(deriveCanvasFromImage(0, 0), def);
  assertEquals(deriveCanvasFromImage(-100, 200), def);
  assertEquals(deriveCanvasFromImage(NaN, 100), def);
});

Deno.test("defaultSolidCanvas is landscape 16:9", () => {
  const c = defaultSolidCanvas();
  assert(c.width > c.height, "solid-background default must be landscape");
  const aspect = c.width / c.height;
  assert(Math.abs(aspect - 16 / 9) < 0.01, `expected 16:9, got ${aspect}`);
});
