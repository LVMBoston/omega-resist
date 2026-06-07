// Runs the project's pure-helper regression checks in-process and returns
// structured results. Intended to be called from the admin "Regression
// Tests" page so an operator can verify the snapshot-renderer guards
// without running Deno locally.
//
// NOTE: This re-runs the SAME assertions as the .test.ts files. Keep them
// in sync. The .test.ts files remain the source of truth for CI/local runs.

import {
  zoomForBounds,
  lngToWorldX,
  latToWorldY,
} from "../render-stats-snapshot/geo.ts";
import {
  deriveCanvasFromImage,
  defaultSolidCanvas,
  MAX_CANVAS_SIDE,
} from "../render-stats-snapshot/canvas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CheckResult {
  id: string;
  suite: string;
  name: string;
  guards: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

function check(
  id: string,
  suite: string,
  name: string,
  guards: string,
  fn: () => void,
): CheckResult {
  const start = performance.now();
  try {
    fn();
    return {
      id,
      suite,
      name,
      guards,
      passed: true,
      durationMs: +(performance.now() - start).toFixed(2),
    };
  } catch (e) {
    return {
      id,
      suite,
      name,
      guards,
      passed: false,
      error: e instanceof Error ? e.message : String(e),
      durationMs: +(performance.now() - start).toFixed(2),
    };
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEq<T>(actual: T, expected: T, msg?: string) {
  if (actual !== expected) {
    throw new Error(msg ?? `expected ${expected}, got ${actual}`);
  }
}
function assertNear(actual: number, expected: number, eps: number, msg?: string) {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(msg ?? `expected ~${expected}, got ${actual}`);
  }
}

function runAll(): CheckResult[] {
  return [
    // ---- canvas (snapshot orientation) ----
    check(
      "1a",
      "snapshot:canvas",
      "Landscape background -> landscape canvas",
      "Snapshots must match template orientation (2026-06-07 bug)",
      () => {
        const c = deriveCanvasFromImage(1404, 783);
        assert(c.width > c.height, `got ${c.width}x${c.height}`);
        assertNear(c.width / c.height, 1404 / 783, 0.01);
      },
    ),
    check(
      "1a.2",
      "snapshot:canvas",
      "Portrait background -> portrait canvas",
      "Portrait templates must render portrait",
      () => {
        const c = deriveCanvasFromImage(1080, 1920);
        assert(c.height > c.width, `got ${c.width}x${c.height}`);
      },
    ),
    check(
      "1a.3",
      "snapshot:canvas",
      "Longest side capped at MAX_CANVAS_SIDE",
      "Keeps SVG snapshot size reasonable",
      () => {
        const c = deriveCanvasFromImage(4000, 2000);
        assertEq(Math.max(c.width, c.height), MAX_CANVAS_SIDE);
      },
    ),
    check(
      "1a.4",
      "snapshot:canvas",
      "Small images are not upscaled",
      "Never invent pixels",
      () => {
        const c = deriveCanvasFromImage(800, 600);
        assertEq(c.width, 800);
        assertEq(c.height, 600);
      },
    ),
    check(
      "1a.5",
      "snapshot:canvas",
      "Invalid dimensions fall back to defaults",
      "Defensive against bad image metadata",
      () => {
        const def = defaultSolidCanvas();
        assertEq(deriveCanvasFromImage(0, 0).width, def.width);
        assertEq(deriveCanvasFromImage(-100, 200).width, def.width);
        assertEq(deriveCanvasFromImage(NaN, 100).width, def.width);
      },
    ),
    check(
      "1e",
      "snapshot:canvas",
      "Solid background defaults to landscape 16:9",
      "Solid templates must not silently become portrait",
      () => {
        const c = defaultSolidCanvas();
        assert(c.width > c.height, "must be landscape");
        assertNear(c.width / c.height, 16 / 9, 0.01);
      },
    ),

    // ---- geo (zoom math) ----
    check(
      "1c",
      "snapshot:geo",
      "zoomForBounds returns a fractional zoom",
      "Math.floor caused hemisphere-wide maps (2026-06-07 bug)",
      () => {
        const z = zoomForBounds(49.5, 24.5, -66.9, -125.0, 1404, 783);
        assert(z > 0 && z < 18, `zoom out of range: ${z}`);
        assert(z % 1 !== 0, `zoom must be fractional, got ${z}`);
      },
    ),
    check(
      "1c.2",
      "snapshot:geo",
      "zoomForBounds returns min(latZoom, lngZoom)",
      "Must pick the limiting dimension",
      () => {
        const WORLD = 256;
        const n = 60, s = -60, e = 0.5, w = -0.5, pw = 1000, ph = 1000;
        const latRad = (lat: number) =>
          Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
        const latFr = (latRad(n) - latRad(s)) / (2 * Math.PI);
        const lngFr = (e - w) / 360;
        const expected = Math.min(
          Math.log2(ph / WORLD / latFr),
          Math.log2(pw / WORLD / lngFr),
        );
        assertNear(zoomForBounds(n, s, e, w, pw, ph), expected, 1e-9);
      },
    ),
    check(
      "1d",
      "snapshot:geo",
      "Same bounds at wider canvas -> higher zoom",
      "savedZoom is canvas-size-dependent; bounds are not",
      () => {
        const narrow = zoomForBounds(49.5, 24.5, -66.9, -125.0, 700, 783);
        const wide = zoomForBounds(49.5, 24.5, -66.9, -125.0, 1404, 783);
        assert(wide > narrow, `narrow=${narrow} wide=${wide}`);
      },
    ),
    check(
      "1d.2",
      "snapshot:geo",
      "Portrait canvas needs smaller zoom than landscape for same bounds",
      "Regression guard for canvas-orientation interaction",
      () => {
        const port = zoomForBounds(49.5, 24.5, -66.9, -125.0, 1080, 1920);
        const land = zoomForBounds(49.5, 24.5, -66.9, -125.0, 1920, 1080);
        assert(port < land, `portrait=${port} landscape=${land}`);
      },
    ),
    check(
      "1c.3",
      "snapshot:geo",
      "zoomForBounds clamped to [0, 18]",
      "Prevents tile-fetch failures at extreme zooms",
      () => {
        const a = zoomForBounds(85, -85, 180, -180, 256, 256);
        const b = zoomForBounds(40.001, 40, -100.001, -100, 4096, 4096);
        assert(a >= 0 && a <= 18, `a=${a}`);
        assert(b >= 0 && b <= 18, `b=${b}`);
      },
    ),
    check(
      "1c.4",
      "snapshot:geo",
      "Mercator helpers behave correctly at z=0",
      "Round-trip sanity for known point (NYC)",
      () => {
        const x = lngToWorldX(-74.006, 0);
        const y = latToWorldY(40.7128, 0);
        assertNear(x, ((-74.006 + 180) / 360) * 256, 1e-9);
        assert(y > 0 && y < 256, `y=${y}`);
      },
    ),
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const started = performance.now();
  const results = runAll();
  const summary = {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    durationMs: +(performance.now() - started).toFixed(2),
    runAt: new Date().toISOString(),
  };
  return new Response(JSON.stringify({ summary, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
