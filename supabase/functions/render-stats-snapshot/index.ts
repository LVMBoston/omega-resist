import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cache-control, pragma, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Retry helper for database queries
async function fetchWithRetry<T>(
  queryFn: () => PromiseLike<{ data: T | null; error: any }>,
  description: string,
  maxAttempts = 5,
  delayMs = 1000
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data, error } = await queryFn();
      if (!error) {
        console.log(`[render-stats-snapshot] ${description}: success on attempt ${attempt}`);
        return data;
      }
      console.warn(`[render-stats-snapshot] ${description}: attempt ${attempt} failed:`, error.message);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    } catch (e) {
      console.error(`[render-stats-snapshot] ${description}: attempt ${attempt} exception:`, e);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  return null;
}

interface CampaignSnapshotInfo {
  title?: string | null;
  created_at?: string | null;
}

interface ViralSlideTemplateSnapshot {
  image_url: string;
  hotspots?: any[] | null;
}

// Fetch image and convert to base64 data URL
async function fetchImageAsDataUrl(imageUrl: string): Promise<string | null> {
  try {
    console.log("[render-stats-snapshot] Fetching background image:", imageUrl);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`[render-stats-snapshot] Image fetch failed: ${response.status}`);
      return null;
    }
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = new Uint8Array(await response.arrayBuffer());
    // Chunked base64 encoding to avoid call stack overflow on large images
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);
    console.log(`[render-stats-snapshot] Image fetched: ${buffer.byteLength} bytes, type: ${contentType}`);
    return `data:${contentType};base64,${base64}`;
  } catch (e) {
    console.error("[render-stats-snapshot] Image fetch exception:", e);
    return null;
  }
}

// Escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------- Web Mercator helpers ----------
// Pure geometry/canvas helpers live in sibling modules so they can be
// unit-tested without the Supabase client. See geo.test.ts / canvas.test.ts.
import { TILE_SIZE, lngToWorldX, latToWorldY, zoomForBounds } from "./geo.ts";
import { deriveCanvasFromImage, defaultSolidCanvas } from "./canvas.ts";
import { renderManualHtml } from "./manualHtml.ts";

async function fetchCartoTile(
  z: number, x: number, y: number, subdomain: string, slug: string,
): Promise<Uint8Array | null> {
  const url = `https://${subdomain}.basemaps.cartocdn.com/${slug}/${z}/${x}/${y}.png`;
  try {
    const r = await fetch(url);
    if (!r.ok) {
      console.warn(`[render-stats-snapshot] Tile ${z}/${x}/${y} failed: ${r.status}`);
      return null;
    }
    return new Uint8Array(await r.arrayBuffer());
  } catch (e) {
    console.warn(`[render-stats-snapshot] Tile fetch error:`, e);
    return null;
  }
}

const MEDIUM_COLORS_HEX: Record<string, [number, number, number]> = {
  qr: [0x00, 0x00, 0x99],
  em: [0x00, 0x66, 0xff],
  sms: [0x99, 0xcc, 0xff],
  tx: [0x99, 0xcc, 0xff],
};
const DEFAULT_COLOR_HEX: [number, number, number] = [0x64, 0x74, 0x8b];
const SPAWN_STROKE: [number, number, number] = [0x22, 0xc5, 0x5e];
const DEFAULT_STROKE: [number, number, number] = [0xff, 0xff, 0xff];

// Render a static map image by stitching CartoDB Positron tiles server-side.
// Matches the live editor (MapHotspotRenderer.tsx) — no Mapbox dependency,
// honoring the project rule that Mapbox is forbidden anywhere in the stack.
async function renderStaticMap(
  supabase: any,
  campaignCode: string,
  mapConfig: any,
  pixelWidth: number,
  pixelHeight: number,
): Promise<string | null> {
  try {
    const { Image } = await import("https://deno.land/x/imagescript@1.2.17/mod.ts");

    // ---- Fetch event points (mirrors MapHotspotRenderer logic) ----
    const { data: campaign } = await supabase
      .from("campaigns").select("id").eq("code", campaignCode).maybeSingle();
    if (!campaign) return null;

    const { data: eoas } = await supabase
      .from("events_actions").select("id").eq("campaign_id", campaign.id);
    if (!eoas || eoas.length === 0) return null;

    const eoaIds = eoas.map((e: any) => e.id);
    const { data: tokens } = await supabase
      .from("tokens").select("token, level, utm_medium, root_token")
      .in("eoa_id", eoaIds).eq("is_simulated", false);
    if (!tokens || tokens.length === 0) return null;

    const tokenMap = new Map<string, any>(tokens.map((t: any) => [t.token, t]));
    const rootTokensWithChildren = new Set<string>();
    for (const t of tokens) {
      if (t.root_token && t.root_token !== t.token) {
        rootTokensWithChildren.add(t.root_token);
      }
    }

    const tokenIds = tokens.map((t: any) => t.token);
    const { data: events } = await supabase
      .from("url_events").select("token, latitude, longitude")
      .in("token", tokenIds).eq("event_type", "view").eq("is_simulated", false)
      .not("latitude", "is", null).not("longitude", "is", null);
    if (!events || events.length === 0) return null;

    // ---- Resolve viewport ----
    // savedBounds is the source of truth because it is pixel-size-independent.
    // savedZoom is captured at the editor's preview pixel width, so reusing it
    // verbatim at a different canvas size (the snapshot's) produces a wider or
    // narrower view than the editor showed. We re-derive zoom from bounds so
    // the same geographic region fills the hotspot regardless of canvas size.
    const imgW = Math.max(64, Math.round(pixelWidth));
    const imgH = Math.max(64, Math.round(pixelHeight));

    const savedCenter = mapConfig?.savedCenter;
    const savedZoom = mapConfig?.savedZoom;
    const savedBounds = mapConfig?.savedBounds;

    let centerLat: number;
    let centerLng: number;
    let zoom: number; // fractional allowed

    if (
      savedBounds && typeof savedBounds.north === "number" &&
      typeof savedBounds.south === "number" &&
      typeof savedBounds.east === "number" && typeof savedBounds.west === "number"
    ) {
      centerLat = (savedBounds.north + savedBounds.south) / 2;
      centerLng = (savedBounds.east + savedBounds.west) / 2;
      zoom = zoomForBounds(
        savedBounds.north, savedBounds.south, savedBounds.east, savedBounds.west,
        imgW, imgH,
      );
      console.log(`[render-stats-snapshot] Using savedBounds, computed z=${zoom} for ${imgW}x${imgH}`);
    } else if (
      savedCenter && typeof savedCenter.lat === "number" &&
      typeof savedCenter.lng === "number" && typeof savedZoom === "number"
    ) {
      centerLat = savedCenter.lat;
      centerLng = savedCenter.lng;
      zoom = Math.max(0, Math.min(18, savedZoom));
      console.log(`[render-stats-snapshot] Using savedCenter/savedZoom (${centerLat}, ${centerLng}) z=${zoom}`);
    } else {
      centerLat = 39.5; centerLng = -98.35; zoom = 4;
      console.log(`[render-stats-snapshot] No saved viewport, defaulting to US`);
    }

    // ---- Determine tile slug (label density) ----
    const labelDensity = mapConfig?.labelDensity ?? "auto";
    const hideLabels =
      labelDensity === "no_labels" || (labelDensity === "auto" && imgW < 500);
    const slug = hideLabels ? "light_nolabels" : "light_all";

    // ---- Tile math at fractional zoom ----
    const tileZ = Math.max(0, Math.min(18, Math.round(zoom)));
    const scale = Math.pow(2, zoom - tileZ); // <1 = shrink, >1 = stretch
    const scaledTileSize = TILE_SIZE * scale;

    // World pixel coords at FRACTIONAL zoom (where the canvas lives)
    const centerWorldX = lngToWorldX(centerLng, zoom);
    const centerWorldY = latToWorldY(centerLat, zoom);
    const originWorldX = centerWorldX - imgW / 2;
    const originWorldY = centerWorldY - imgH / 2;

    // Tile grid is indexed at tileZ; each tile spans `scaledTileSize` in
    // fractional-zoom world pixels.
    const tileMinX = Math.floor(originWorldX / scaledTileSize);
    const tileMinY = Math.floor(originWorldY / scaledTileSize);
    const tileMaxX = Math.floor((originWorldX + imgW - 1) / scaledTileSize);
    const tileMaxY = Math.floor((originWorldY + imgH - 1) / scaledTileSize);

    const worldTiles = Math.pow(2, tileZ);
    const canvas = new Image(imgW, imgH);
    canvas.fill(0xe8e8e8ff);

    const tileJobs: Promise<void>[] = [];
    const subdomains = ["a", "b", "c"];
    const renderTilePx = Math.max(1, Math.round(scaledTileSize));
    for (let ty = tileMinY; ty <= tileMaxY; ty++) {
      if (ty < 0 || ty >= worldTiles) continue;
      for (let tx = tileMinX; tx <= tileMaxX; tx++) {
        const wrappedX = ((tx % worldTiles) + worldTiles) % worldTiles;
        const sub = subdomains[(((tx % 3) + (ty % 3)) % 3 + 3) % 3];
        tileJobs.push((async () => {
          const bytes = await fetchCartoTile(tileZ, wrappedX, ty, sub, slug);
          if (!bytes) return;
          try {
            let tileImg = await Image.decode(bytes);
            if (renderTilePx !== TILE_SIZE) {
              tileImg = tileImg.resize(renderTilePx, renderTilePx);
            }
            const dx = Math.round(tx * scaledTileSize - originWorldX);
            const dy = Math.round(ty * scaledTileSize - originWorldY);
            canvas.composite(tileImg, dx, dy);
          } catch (e) {
            console.warn(`[render-stats-snapshot] Tile decode failed`, e);
          }
        })());
      }
    }
    await Promise.all(tileJobs);

    // ---- Aggregate events by location so the marker size reflects activity ----
    // Static snapshots can't be zoomed, so a single dot would hide volume.
    // We group events that share a coordinate (~1km grid; ZIP centroids
    // collide naturally) and scale radius by sqrt(count) — standard
    // proportional-symbol mapping. A count label appears once a cluster
    // has 2+ views and the circle is big enough to read inside.
    const aggMap = new Map<string, { lat: number; lng: number; count: number; fillCounts: Map<string, number>; anySpawn: boolean }>();
    for (const ev of events as any[]) {
      const keyLat = Math.round(ev.latitude * 100) / 100;
      const keyLng = Math.round(ev.longitude * 100) / 100;
      const key = `${keyLat},${keyLng}`;
      const token = tokenMap.get(ev.token);
      const medium = (token?.utm_medium || "").toLowerCase();
      const hasSpawns = token ? rootTokensWithChildren.has(token.token) : false;
      let a = aggMap.get(key);
      if (!a) {
        a = { lat: keyLat, lng: keyLng, count: 0, fillCounts: new Map(), anySpawn: false };
        aggMap.set(key, a);
      }
      a.count += 1;
      a.fillCounts.set(medium, (a.fillCounts.get(medium) || 0) + 1);
      if (hasSpawns) a.anySpawn = true;
    }

    const aggregates = Array.from(aggMap.values()).sort((a, b) => a.count - b.count);
    const BASE_R = 5;
    const K = 3.2;
    const MAX_R = 22;

    const drawLabel = (text: string, cx: number, cy: number) => {
      const charW = 6, charH = 8, padX = 3, padY = 2;
      const w = text.length * charW + padX * 2;
      const h = charH + padY * 2;
      const x0 = Math.round(cx - w / 2);
      const y0 = Math.round(cy - h / 2);
      for (let yy = 0; yy < h; yy++) {
        for (let xx = 0; xx < w; xx++) {
          const x = x0 + xx, y = y0 + yy;
          if (x < 0 || y < 0 || x >= imgW || y >= imgH) continue;
          const onEdge = xx === 0 || yy === 0 || xx === w - 1 || yy === h - 1;
          const c = onEdge ? 0x222222ff : 0xffffffee;
          canvas.setPixelAt(x + 1, y + 1, c >>> 0);
        }
      }
      const anyCanvas = canvas as any;
      if (typeof anyCanvas.drawText === "function") {
        try {
          anyCanvas.drawText(text, x0 + padX, y0 + padY, 0x111111ff);
        } catch (_err) {
          // best-effort label text
        }
      }
    };

    for (const a of aggregates) {
      let topMedium = "";
      let topN = -1;
      for (const [m, n] of a.fillCounts) {
        if (n > topN) { topN = n; topMedium = m; }
      }
      const fill = MEDIUM_COLORS_HEX[topMedium] || DEFAULT_COLOR_HEX;
      const stroke = a.anySpawn ? SPAWN_STROKE : DEFAULT_STROKE;
      const radius = Math.min(MAX_R, Math.round(BASE_R + K * Math.sqrt(Math.max(0, a.count - 1))));

      const wx = lngToWorldX(a.lng, zoom);
      const wy = latToWorldY(a.lat, zoom);
      const px = Math.round(wx - originWorldX);
      const py = Math.round(wy - originWorldY);
      if (px < -radius || py < -radius || px >= imgW + radius || py >= imgH + radius) continue;

      const strokeW = a.count > 1 ? 2 : 1;
      const rOuter = radius + strokeW;
      for (let dy = -rOuter; dy <= rOuter; dy++) {
        for (let dx = -rOuter; dx <= rOuter; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > rOuter * rOuter) continue;
          const x = px + dx, y = py + dy;
          if (x < 0 || y < 0 || x >= imgW || y >= imgH) continue;
          if (d2 > radius * radius) {
            const c = (stroke[0] << 24) | (stroke[1] << 16) | (stroke[2] << 8) | 0xff;
            canvas.setPixelAt(x + 1, y + 1, c >>> 0);
          } else {
            const alpha = a.count > 1 ? 0xee : 0xff;
            const c = (fill[0] << 24) | (fill[1] << 16) | (fill[2] << 8) | alpha;
            canvas.setPixelAt(x + 1, y + 1, c >>> 0);
          }
        }
      }

      if (a.count >= 2 && radius >= 8) {
        drawLabel(String(a.count), px, py);
      }
    }

    const png = await canvas.encode();
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < png.length; i += chunkSize) {
      const chunk = png.subarray(i, Math.min(i + chunkSize, png.length));
      binary += String.fromCharCode(...chunk);
    }
    console.log(`[render-stats-snapshot] CartoDB map rendered: ${imgW}x${imgH}, ${aggregates.length} clusters / ${events.length} events, z=${zoom}`);
    return `data:image/png;base64,${btoa(binary)}`;
  } catch (e) {
    console.error("[render-stats-snapshot] Static map error:", e);
    return null;
  }
}

// Calculate campaign metrics
async function calculateMetrics(supabase: any, campaignCode: string): Promise<Record<string, string | number>> {
  const metrics: Record<string, string | number> = {};
  
  const tokens = await fetchWithRetry(
    () => supabase.from("tokens").select("token, level, utm_medium").eq("utm_campaign", campaignCode).is("deleted_at", null),
    "tokens query"
  ) || [];

  const tokenStrings = Array.isArray(tokens) ? tokens.map((t: any) => t.token) : [];
  let events: any[] = [];
  
  if (tokenStrings.length > 0) {
    events = await fetchWithRetry(
      () => supabase.from("url_events").select("event_type, country_code, zip_code, utm_snapshot, occurred_at").in("token", tokenStrings).is("deleted_at", null),
      "url_events query"
    ) || [];
  }

  const tokenArray = Array.isArray(tokens) ? tokens : [];
  const eventArray = Array.isArray(events) ? events : [];
  
  const l00Count = tokenArray.filter((t: any) => t.level === 0).length;
  const sharesCount = tokenArray.filter((t: any) => t.level > 0).length;
  const viewEvents = eventArray.filter((e: any) => e.event_type === "view");

  // Count L00 seeds that actually have child tokens (matching useLiveMetrics logic)
  let seedsWithSpawns = 0;
  if (l00Count > 0 && sharesCount > 0) {
    const l00TokenStrings = new Set(tokenArray.filter((t: any) => t.level === 0).map((t: any) => t.token));
    const childTokens = await fetchWithRetry(
      () => supabase.from("tokens").select("parent_token").eq("utm_campaign", campaignCode).is("deleted_at", null).gt("level", 0),
      "child tokens for seeds_with_spawns"
    ) || [];
    const childArray = Array.isArray(childTokens) ? childTokens : [];
    const parentsWithChildren = new Set(childArray.map((t: any) => t.parent_token).filter(Boolean));
    seedsWithSpawns = tokenArray.filter((t: any) => t.level === 0 && parentsWithChildren.has(t.token)).length;
  }

  metrics.seeds = l00Count.toLocaleString();
  metrics.seeds_with_spawns = seedsWithSpawns.toLocaleString();
  metrics.l01_count = tokenArray.filter((t: any) => t.level === 1).length.toLocaleString();
  metrics.l02_count = tokenArray.filter((t: any) => t.level === 2).length.toLocaleString();
  metrics.l03_count = tokenArray.filter((t: any) => t.level === 3).length.toLocaleString();
  metrics.shares = sharesCount.toLocaleString();
  metrics.opens = viewEvents.length.toLocaleString();
  metrics.opens_us = eventArray.filter((e: any) => e.event_type === "view" && e.country_code === "US").length.toLocaleString();
  metrics.opens_intl = eventArray.filter((e: any) => e.event_type === "view" && e.country_code && e.country_code !== "US").length.toLocaleString();
  metrics.opens_qr = viewEvents.filter((e: any) => (e.utm_snapshot as any)?.utm_medium === "qr").length.toLocaleString();
  metrics.opens_text = viewEvents.filter((e: any) => ["sms", "text"].includes((e.utm_snapshot as any)?.utm_medium)).length.toLocaleString();
  metrics.opens_mail = viewEvents.filter((e: any) => ["email", "mail", "em"].includes((e.utm_snapshot as any)?.utm_medium)).length.toLocaleString();
  metrics.neighborhoods = new Set(eventArray.filter((e: any) => e.zip_code).map((e: any) => e.zip_code)).size.toLocaleString();
  metrics.depth = tokenArray.length > 0 ? Math.max(...tokenArray.map((t: any) => t.level)).toString() : "0";
  metrics.viral_coefficient = l00Count > 0 ? (sharesCount / l00Count).toFixed(2) : "0.00";

  const campaignData = await fetchWithRetry<CampaignSnapshotInfo>(
    () => supabase.from("campaigns").select("title").eq("code", campaignCode).maybeSingle(),
    "campaign title query"
  );
  metrics.campaign_name = campaignData?.title || campaignCode;

  // Activity timestamps
  const viewTimestamps = viewEvents.map((e: any) => new Date(e.occurred_at).getTime()).filter((t: number) => !isNaN(t));
  if (viewTimestamps.length > 0) {
    const earliest = new Date(Math.min(...viewTimestamps));
    const latest = new Date(Math.max(...viewTimestamps));
    const earlyDate = earliest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const earlyTime = earliest.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' });
    metrics.earliest_active = `${earlyDate}\n${earlyTime}`;
    const lateDate = latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const lateTime = latest.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' });
    metrics.latest_active = `${lateDate}\n${lateTime}`;
  } else {
    metrics.earliest_active = "--";
    metrics.latest_active = "--";
  }

  const now = new Date();
  metrics.current_date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  metrics.current_time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' });
  metrics.last_updated = `${metrics.current_date} ${metrics.current_time}`;

  // Campaign story — full narrative (inline generation matching client-side generateFullStory)
  const campaignInfo = await fetchWithRetry<CampaignSnapshotInfo>(
    () => supabase.from("campaigns").select("title, created_at").eq("code", campaignCode).maybeSingle(),
    "campaign info for story"
  );
  if (campaignInfo) {
    const msActive = Date.now() - new Date(campaignInfo.created_at || Date.now()).getTime();
    const daysActive = Math.max(0, Math.floor(msActive / (1000 * 60 * 60 * 24)));
    const hoursRemainder = Math.floor((msActive % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const seedCount = parseInt(String(metrics.seeds).replace(/,/g, ""), 10) || 0;
    const viewCountNum = parseInt(String(metrics.opens).replace(/,/g, ""), 10) || 0;
    const zipCountNum = parseInt(String(metrics.neighborhoods).replace(/,/g, ""), 10) || 0;
    const spawnsNum = parseInt(String(metrics.shares).replace(/,/g, ""), 10) || 0;
    const maxDepth = Math.max(
      parseInt(String(metrics.l01_count).replace(/,/g, ""), 10) > 0 ? 1 : 0,
      parseInt(String(metrics.l02_count).replace(/,/g, ""), 10) > 0 ? 2 : 0,
      parseInt(String(metrics.l03_count).replace(/,/g, ""), 10) > 0 ? 3 : 0,
    );

    // States for geographic narrative
    const statesData = await fetchWithRetry(
      () => supabase.from("url_events")
        .select("region, tokens!inner(utm_campaign)")
        .eq("tokens.utm_campaign", campaignCode)
        .eq("is_simulated", false)
        .eq("country", "United States")
        .is("deleted_at", null)
        .not("region", "is", null),
      "states for story"
    ) || [];
    const stateCount = new Set((statesData as any[]).map((r: any) => r.region).filter(Boolean)).size;

    // International countries
    const intlData = await fetchWithRetry(
      () => supabase.from("url_events")
        .select("country, tokens!inner(utm_campaign)")
        .eq("tokens.utm_campaign", campaignCode)
        .eq("is_simulated", false)
        .is("deleted_at", null)
        .not("country", "is", null)
        .neq("country", "United States"),
      "intl countries for story"
    ) || [];
    const intlCountries = [...new Set((intlData as any[]).map((r: any) => r.country).filter(Boolean))];

    // Propagation speed from tokens
    const speedTokens = await fetchWithRetry(
      () => supabase.from("tokens")
        .select("token, level, minted_at, l00_instance")
        .eq("utm_campaign", campaignCode)
        .eq("is_simulated", false)
        .is("deleted_at", null)
        .order("minted_at", { ascending: true }),
      "speed tokens for story"
    ) || [];
    const speedMap = new Map<number, any>();
    for (const t of speedTokens as any[]) {
      if (!speedMap.has(t.level)) speedMap.set(t.level, t);
    }
    const speedEntries = Array.from(speedMap.entries()).sort((a, b) => a[0] - b[0]);

    // Last share — most recent L1+ token
    let lastShareAt: string | null = null;
    const lastShareData = await fetchWithRetry(
      () => supabase.from("tokens")
        .select("minted_at")
        .eq("utm_campaign", campaignCode)
        .eq("is_simulated", false)
        .is("deleted_at", null)
        .gt("level", 0)
        .order("minted_at", { ascending: false })
        .limit(1),
      "last share for story"
    );
    if (lastShareData && Array.isArray(lastShareData) && lastShareData.length > 0) {
      lastShareAt = lastShareData[0].minted_at;
    }

    // Open events by share medium (count view events, not tokens)
    const mediumData = await fetchWithRetry(
      () => supabase.from("url_events")
        .select("tokens!inner(utm_medium, utm_campaign)")
        .eq("tokens.utm_campaign", campaignCode)
        .eq("is_simulated", false)
        .is("deleted_at", null)
        .eq("event_type", "view"),
      "open mediums for story"
    ) || [];
    const mediumCounts = new Map<string, number>();
    for (const evt of mediumData as any[]) {
      const m = (evt as any).tokens?.utm_medium;
      if (m) mediumCounts.set(m, (mediumCounts.get(m) || 0) + 1);
    }
    const totalMediums = Array.from(mediumCounts.values()).reduce((s, c) => s + c, 0);
    const mediumLabels: Record<string, string> = { sms: "text", em: "email", wa: "WhatsApp", tw: "Twitter", fb: "Facebook" };
    const mediumLine = totalMediums > 0
      ? Array.from(mediumCounts.entries())
          .map(([m, c]) => `${Math.round((c / totalMediums) * 100)}% ${mediumLabels[m] || m}`)
          .join(", ")
      : "";

    // Speed narrative with "Fastest share:" prefix and geographic origin/destination
    let speedNarrative = "";
    if (speedEntries.length >= 2) {
      const l0Time = new Date(speedEntries[0][1].minted_at);
      const last = speedEntries[speedEntries.length - 1];
      const diffHours = Math.round((new Date(last[1].minted_at).getTime() - l0Time.getTime()) / (1000 * 60 * 60));
      let timePart: string;
      if (diffHours < 1) timePart = "under an hour";
      else if (diffHours < 24) timePart = `just ${diffHours} hours`;
      else { const d = Math.round(diffHours / 24); timePart = `${d} day${d > 1 ? "s" : ""}`; }
      speedNarrative = `Fastest share: From the first card drop shared to the first Level ${last[0]} share took ${timePart}.`;

      // Geographic origin/destination
      let originCity: string | null = null;
      let destCity: string | null = null;
      try {
        // Origin: first L1 token → first view event with city
        const firstL1 = speedEntries.find(([lvl]) => lvl === 1);
        if (firstL1) {
          const l1Token = firstL1[1];
          const originEvents = await fetchWithRetry(
            () => supabase.from("url_events")
              .select("city, region")
              .eq("token", l1Token.token)
              .not("city", "is", null)
              .order("occurred_at", { ascending: true })
              .limit(1),
            "speed origin city"
          );
          if (originEvents && Array.isArray(originEvents) && originEvents.length > 0) {
            const oe = originEvents[0];
            originCity = oe.region ? `${oe.city}, ${oe.region}` : oe.city;
          }
          // Destination: first max-level token on same l00_instance
          if (l1Token.l00_instance && last[0] > 1) {
            const destTokens = await fetchWithRetry(
              () => supabase.from("tokens")
                .select("token")
                .eq("utm_campaign", campaignCode)
                .eq("level", last[0])
                .eq("l00_instance", l1Token.l00_instance)
                .eq("is_simulated", false)
                .is("deleted_at", null)
                .order("minted_at", { ascending: true })
                .limit(1),
              "speed dest token"
            );
            if (destTokens && Array.isArray(destTokens) && destTokens.length > 0) {
              const destEvents = await fetchWithRetry(
                () => supabase.from("url_events")
                  .select("city, region")
                  .eq("token", destTokens[0].token)
                  .not("city", "is", null)
                  .order("occurred_at", { ascending: true })
                  .limit(1),
                "speed dest city"
              );
              if (destEvents && Array.isArray(destEvents) && destEvents.length > 0) {
                const de = destEvents[0];
                destCity = de.region ? `${de.city}, ${de.region}` : de.city;
              }
            }
          }
        }
        if (originCity && destCity) {
          speedNarrative = speedNarrative.slice(0, -1) + `; ${originCity} to ${destCity}.`;
        }
      } catch (e) {
        console.warn("[render-stats-snapshot] Speed geo lookup failed:", e);
      }
    }

    // Geographic narrative
    let geoNarrative = "";
    if (zipCountNum > 0) {
      geoNarrative = `The content reached ${zipCountNum} different zip codes`;
      if (stateCount > 0) geoNarrative += ` across ${stateCount} state${stateCount > 1 ? "s" : ""}`;
      geoNarrative += ".";
      if (intlCountries.length > 0) geoNarrative += ` It even crossed borders, reaching ${intlCountries.join(", ")}.`;
    }

    // Closing — deterministic
    const closings = [
      "No ad budget. No algorithm. Every view came because one person decided another person needed to see it.",
      "No ads. No tricks. Just people passing something along because it mattered to them.",
      "No promotion. No platform boost. This spread the old-fashioned way — person to person, because it resonated.",
      "Zero dollars spent. Every single view was a conscious act of solidarity — someone choosing to share.",
    ];
    const closingIndex = (seedCount + spawnsNum) % closings.length;

    const storyLines: string[] = [];
    storyLines.push(`__TITLE__Campaign: ${campaignInfo.title || campaignCode}__TITLE__`);
    const storyNow = new Date();
    const dateStr = storyNow.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const timeStr = storyNow.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false, timeZoneName: "short" });
    storyLines.push(`Date of this report: ${dateStr} ${timeStr}`);
    const startDate = new Date(campaignInfo.created_at || Date.now());
    const startFormatted = startDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    storyLines.push(`Started ${startFormatted}`);
    storyLines.push(`Campaign active for ${daysActive} days ${hoursRemainder} hours`);
    if (lastShareAt) {
      const lastShare = new Date(lastShareAt);
      const lastShareDateStr = lastShare.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const lastShareTimeStr = lastShare.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" });
      storyLines.push(`Last share: ${lastShareDateStr} ${lastShareTimeStr}`);
    }
    storyLines.push("");
    let seedLine = `🌱 ${seedCount} seeds planted. ${spawnsNum} sprouted into viral chains. (A seed is a QR scan not shared.)`;
    if (seedCount > 0 && spawnsNum > 0) {
      seedLine += ` That's a ${Math.round((spawnsNum / seedCount) * 100)}% sprout rate — ${spawnsNum} people didn't just look, they shared.`;
      if (mediumLine) seedLine += ` Opens by medium: ${mediumLine}.`;
    }
    storyLines.push(seedLine);
    storyLines.push("");
    if (maxDepth > 0) {
      let chainLine = `🔗 Longest chain: ${maxDepth} levels deep.`;
      if (maxDepth >= 3) chainLine += " Someone scanned a card → shared it → that person shared it → and it kept going.";
      else if (maxDepth === 2) chainLine += " A scan became a share, which became another share.";
      else chainLine += " Seeds turned into shares.";
      storyLines.push(chainLine);
      storyLines.push("");
    }
    if (speedNarrative) {
      storyLines.push(`⚡ ${speedNarrative}`);
      storyLines.push("");
    }
    storyLines.push(`👀 The content was viewed ${viewCountNum} times — sometimes more than once by the same person.`);
    if (geoNarrative) {
      storyLines.push(`📍 ${geoNarrative}`);
      storyLines.push("");
    }
    storyLines.push("");
    storyLines.push(closings[closingIndex]);
    storyLines.push("");

    metrics.campaign_story = storyLines.join("\n");
  } else {
    metrics.campaign_story = "--";
  }

  // TZ offset note (DST-aware)
  const tzParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).formatToParts(new Date());
  const tzAbbr = tzParts.find((p: Intl.DateTimeFormatPart) => p.type === 'timeZoneName')?.value || 'EST';
  const tzOffset = tzAbbr === 'EDT' ? 4 : 5;
  metrics.tz_offset_note = `Note: ${tzAbbr} = UTC - ${tzOffset} hours`;

  return metrics;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { template_id, campaign_code } = await req.json();

    if (!template_id || !campaign_code) {
      return new Response(
        JSON.stringify({ error: "template_id and campaign_code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[render-stats-snapshot] Starting render for template: ${template_id}, campaign: ${campaign_code}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const template = await fetchWithRetry<ViralSlideTemplateSnapshot>(
      () => supabase.from("viral_slide_configs").select("*").eq("id", template_id).single(),
      "template fetch"
    );

    if (!template) {
      return new Response(
        JSON.stringify({ error: "Template not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metrics = await calculateMetrics(supabase, campaign_code);
    console.log("[render-stats-snapshot] Metrics calculated:", JSON.stringify(metrics));

    // Fetch background image as base64 data URL, or handle solid color
    const imageUrl = template.image_url as string;
    let bgDataUrl: string | null = null;
    let bgSolidColor: string | null = null;
    // Default canvas if we can't derive aspect ratio from a background image.
    // Landscape 16:9 matches the default deck orientation.
    let { width, height } = defaultSolidCanvas();

    if (imageUrl.startsWith("solid:")) {
      bgSolidColor = imageUrl.replace("solid:", "");
      console.log(`[render-stats-snapshot] Using solid background color: ${bgSolidColor}`);
    } else {
      bgDataUrl = await fetchImageAsDataUrl(imageUrl);
      if (!bgDataUrl) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch background image" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Derive canvas dimensions from the background image's natural aspect
      // ratio. The editor renders hotspots over the image with object-contain,
      // so the snapshot canvas must match the image shape — otherwise a
      // landscape template renders into a portrait canvas (or vice versa) and
      // hotspot percentages land in the wrong places and at the wrong sizes.
      try {
        const { Image } = await import("https://deno.land/x/imagescript@1.2.17/mod.ts");
        // Strip data URL prefix to get raw bytes
        const b64 = bgDataUrl.split(",")[1] || "";
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const img = await Image.decode(bytes);
        const derived = deriveCanvasFromImage(img.width, img.height);
        width = derived.width;
        height = derived.height;
        console.log(`[render-stats-snapshot] Canvas derived from image: ${img.width}x${img.height} -> ${width}x${height}`);
      } catch (e) {
        console.warn(`[render-stats-snapshot] Could not derive canvas from image, falling back to ${width}x${height}:`, e);
      }
    }

    // Parse hotspots from template
    const hotspots = Array.isArray(template.hotspots) ? template.hotspots : [];
    // Exclude action hotspots from SVG baking — they remain as client-side interactive overlays
    const ACTION_TYPES = new Set(["sms", "email", "social", "external_link"]);
    const textHotspots = hotspots.filter((h: any) => h.type !== "chart" && h.type !== "map" && h.type !== "image" && !ACTION_TYPES.has(h.type));
    const mapHotspots = hotspots.filter((h: any) => h.type === "map");
    const imageHotspots = hotspots.filter((h: any) => h.type === "image");
    console.log(`[render-stats-snapshot] Processing ${textHotspots.length} text hotspots, ${mapHotspots.length} map hotspots, ${imageHotspots.length} image hotspots at ${width}x${height}`);

    // Render static map images for map hotspots. Each entry is tagged with its
    // zIndex so we can sort all hotspot SVG fragments together before joining.
    const mapSvgElements: { z: number; svg: string }[] = [];
    for (const mapHotspot of mapHotspots) {
      const mapX = (mapHotspot.x / 100) * width;
      const mapY = (mapHotspot.y / 100) * height;
      const mapW = ((mapHotspot.width || 30) / 100) * width;
      const mapH = ((mapHotspot.height || 20) / 100) * height;
      const z = typeof mapHotspot.zIndex === "number" ? mapHotspot.zIndex : 1;

      const mapConfig = mapHotspot.mapConfig || {};
      const mapDataUrl = await renderStaticMap(supabase, campaign_code, mapConfig, mapW, mapH);

      if (mapDataUrl) {
        mapSvgElements.push({
          z,
          svg: `<image href="${mapDataUrl}" x="${mapX}" y="${mapY}" width="${mapW}" height="${mapH}" preserveAspectRatio="xMidYMid slice"/>`,
        });
      } else {
        // Fallback: grey placeholder with label
        mapSvgElements.push({
          z,
          svg:
            `<rect x="${mapX}" y="${mapY}" width="${mapW}" height="${mapH}" fill="#e2e8f0" rx="4"/>` +
            `<text x="${mapX + mapW / 2}" y="${mapY + mapH / 2}" font-family="Inter, sans-serif" font-size="18" fill="#64748b" text-anchor="middle" dominant-baseline="middle">Map</text>`,
        });
      }
    }


    // Image hotspots — bake pasted images into the SVG as base64 data URLs.
    // Remote href="..." references don't resolve when the SVG is rendered as
    // a static asset (or rasterized by a downstream tool), so we inline them.
    const imageSvgElements: { z: number; svg: string }[] = [];
    for (const imgHotspot of imageHotspots) {
      if (!imgHotspot.imageSrc) continue;
      const ix = (imgHotspot.x / 100) * width;
      const iy = (imgHotspot.y / 100) * height;
      const iw = ((imgHotspot.width || 30) / 100) * width;
      const ih = ((imgHotspot.height || 30) / 100) * height;
      const dataUrl = await fetchImageAsDataUrl(imgHotspot.imageSrc);
      if (!dataUrl) {
        console.warn(`[render-stats-snapshot] Skipping image hotspot ${imgHotspot.id}: fetch failed for ${imgHotspot.imageSrc}`);
        continue;
      }
      imageSvgElements.push({
        z: typeof imgHotspot.zIndex === "number" ? imgHotspot.zIndex : 1,
        svg: `<image href="${dataUrl}" x="${ix}" y="${iy}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid meet"/>`,
      });
    }


    // Helper: word-wrap a line to fit within maxChars
    function wordWrap(text: string, maxChars: number): string[] {
      if (text.length <= maxChars) return [text];
      const words = text.split(" ");
      const result: string[] = [];
      let current = "";
      for (const word of words) {
        if (current.length === 0) {
          current = word;
        } else if (current.length + 1 + word.length <= maxChars) {
          current += " " + word;
        } else {
          result.push(current);
          current = word;
        }
      }
      if (current) result.push(current);
      return result;
    }

    // Emoji regex for detecting emoji-prefixed lines
    const emojiPrefixRe = /^([\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}]\uFE0F?\s?)/u;

    // === Manual-entry rich text rendering ===
    // Implementation now lives in a sibling module so the editor-side parity
    // harness and the SSR snapshot share the exact same parser, wrap logic,
    // and Inter-based text measurement.
    // (Previously this block reimplemented the algorithm inline and used a
    // uniform `fontSize × 0.55` width estimate that broke wrap parity.)


    // Build SVG with embedded background image and text hotspots
    const hotspotSvgEntries: { z: number; svg: string }[] = textHotspots.map((hotspot: any) => {
      // Resolve metric value
      let metricValue = "—";
      if (hotspot.metricKey === "manual_entry") {
        metricValue = hotspot.manualLabel || "—";
      } else if (hotspot.metricKey && metrics[hotspot.metricKey] !== undefined) {
        metricValue = String(metrics[hotspot.metricKey]);
      }

      const x = (hotspot.x / 100) * width;
      const y = (hotspot.y / 100) * height;
      const hsWidth = ((hotspot.width || 10) / 100) * width;
      const hsHeight = ((hotspot.height || 5) / 100) * height;

      // Read styling from liveNumberStyle
      const style = hotspot.liveNumberStyle || {};
      
      let fontSize = 24;
      if (style.fontSize) {
        const parsed = parseInt(String(style.fontSize), 10);
        if (!isNaN(parsed)) fontSize = parsed;
      }
      // Honor the editor's fontSize literally — no silent rescaling.
      const scaledFontSize = fontSize;

      const fontWeight = style.fontWeight === "bold" || style.fontWeight === "700" ? "bold" : "normal";
      const color = style.color || "#000000";
      const bgColor = style.backgroundColor || "transparent";
      const textAlign = style.textAlign || "center";

      let svgParts = "";
      // Background rect
      if (bgColor && bgColor !== "transparent") {
        svgParts += `<rect x="${x}" y="${y}" width="${hsWidth}" height="${hsHeight}" fill="${escapeXml(bgColor)}" rx="2"/>`;
      }

      // Editor parity: when style.clipOverflow === false, do NOT wrap
      // text in a clipPath so it can spill outside the hotspot box, just
      // like the in-app renderers.
      const clipOverflow = style.clipOverflow !== false;

      // === Manual entry with rich-text HTML (preferred over manualLabel) ===
      if (
        hotspot.metricKey === "manual_entry" &&
        typeof hotspot.manualHtml === "string" &&
        hotspot.manualHtml.replace(/<[^>]+>/g, "").trim().length > 0
      ) {
        const vAlignRaw = (style.verticalAlign || "top").toLowerCase();
        const verticalAlign: "top" | "middle" | "bottom" =
          vAlignRaw === "center" || vAlignRaw === "middle"
            ? "middle"
            : vAlignRaw === "bottom"
              ? "bottom"
              : "top";
        return (
          svgParts +
          renderManualHtml(
            hotspot.manualHtml,
            { x, y, w: hsWidth, h: hsHeight },
            {
              baseFontSize: scaledFontSize,
              color,
              align: (textAlign as "left" | "center" | "right") || "left",
              bg: bgColor,
              verticalAlign,
              clipOverflow,
            }
          )
        );
      }

      // === Map Legend — static visual key for marker symbols ===
      // Must mirror src/components/MapLegend.tsx exactly.
      if (hotspot.metricKey === "map_legend") {
        const legendItems = [
          { label: "QR code", color: "#000099", ring: false },
          { label: "Email", color: "#0066ff", ring: false },
          { label: "Text / SMS  Share Status", color: "#99ccff", ring: false },
          { label: "Message opened, not yet shared", color: "#64748b", whiteBorder: true, ring: false },
          { label: "Message shared with others", color: "#64748b", ring: true },
        ];
        const padding = 8;
        const fs = scaledFontSize;
        const swatch = Math.round(fs * 0.9);
        const gap = Math.max(4, Math.round(fs * 0.45));
        const rowGap = Math.max(2, Math.round(fs * 0.25));
        const rowH = Math.max(swatch, fs) + rowGap;
        const titleRowH = Math.round(fs * 1.3);
        const fontFamily = style.fontFamily || "Inter, system-ui, sans-serif";
        const weight = style.fontWeight || "600";
        let parts = svgParts;
        let cy = y + padding;
        // Title rows
        parts += `<text x="${x + padding}" y="${cy + fs * 0.82}" font-family="${escapeXml(fontFamily)}" font-size="${fs}" font-weight="700" fill="${escapeXml(color)}">${escapeXml("Map Legend")}</text>`;
        cy += titleRowH;
        parts += `<text x="${x + padding}" y="${cy + fs * 0.82}" font-family="${escapeXml(fontFamily)}" font-size="${fs}" font-weight="700" fill="${escapeXml(color)}">${escapeXml("Messages received via:")}</text>`;
        cy += titleRowH + rowGap;
        for (const item of legendItems) {
          const cxSwatch = x + padding + swatch / 2;
          const swatchTop = cy + Math.max(0, (fs - swatch) / 2);
          const stroke = item.ring
            ? ` stroke="#22c55e" stroke-width="${Math.max(2, Math.round(swatch * 0.18))}"`
            : item.whiteBorder
              ? ` stroke="#ffffff" stroke-width="${Math.max(2, Math.round(swatch * 0.18))}"`
              : "";
          parts += `<circle cx="${cxSwatch}" cy="${swatchTop + swatch / 2}" r="${swatch / 2}" fill="${item.color}"${stroke}/>`;
          const tx = x + padding + swatch + gap;
          const ty = cy + fs * 0.82;
          parts += `<text x="${tx}" y="${ty}" font-family="${escapeXml(fontFamily)}" font-size="${fs}" font-weight="${weight}" fill="${escapeXml(color)}">${escapeXml(item.label)}</text>`;
          cy += rowH;
        }
        // Clip to hotspot bounds
        const clipId = `legend-clip-${hotspot.id}`;
        return `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${hsWidth}" height="${hsHeight}"/></clipPath></defs><g clip-path="url(#${clipId})">${parts}</g>`;
      }


      if (hotspot.metricKey === "campaign_story") {
        // Story text is rendered smaller than other live numbers so the whole
        // multi-paragraph narrative fits inside the hotspot on mobile.
        const storyFontSize = Math.round(scaledFontSize * 0.5);
        const titleFontSize = Math.round(storyFontSize * 1.2);
        const lineHeight = storyFontSize * 1.25;
        const paragraphGap = lineHeight * 0.4;
        const emojiIndent = storyFontSize * 1.6;
        const padding = 12;
        const maxCharsPerLine = Math.floor((hsWidth - padding * 2) / (storyFontSize * 0.52));
        const maxCharsIndented = Math.floor((hsWidth - padding * 2 - emojiIndent) / (storyFontSize * 0.52));

        const rawLines = metricValue.split("\n");

        // PASS 1 — build a flat list of draw ops with relative Y, so we can
        // measure total height before placing them. This lets us honor the
        // editor's V-Align (top/center/bottom) for the two-page trick.
        type DrawOp =
          | { kind: "text"; x: number; yRel: number; size: number; weight: string; text: string }
          | { kind: "advance"; delta: number };
        const ops: DrawOp[] = [];
        let yRel = storyFontSize; // baseline of first line, relative to top padding

        for (const rawLine of rawLines) {
          if (rawLine.trim() === "") {
            yRel += paragraphGap;
            continue;
          }
          if (rawLine.startsWith("__TITLE__") && rawLine.endsWith("__TITLE__")) {
            const titleText = rawLine.replace(/__TITLE__/g, "");
            const titleWrapped = wordWrap(titleText, Math.floor(maxCharsPerLine * (storyFontSize / titleFontSize)));
            for (const tl of titleWrapped) {
              ops.push({ kind: "text", x: x + padding, yRel, size: titleFontSize, weight: "bold", text: tl });
              yRel += titleFontSize * 1.35;
            }
            yRel += paragraphGap * 0.3;
            continue;
          }
          const emojiMatch = rawLine.match(emojiPrefixRe);
          if (emojiMatch) {
            const emoji = emojiMatch[1];
            const rest = rawLine.slice(emoji.length);
            ops.push({ kind: "text", x: x + padding, yRel, size: storyFontSize, weight: "normal", text: emoji.trim() });
            const wrappedRest = wordWrap(rest, maxCharsIndented);
            for (const wl of wrappedRest) {
              ops.push({ kind: "text", x: x + padding + emojiIndent, yRel, size: storyFontSize, weight: "normal", text: wl });
              yRel += lineHeight;
            }
            continue;
          }
          const wrapped = wordWrap(rawLine, maxCharsPerLine);
          for (const wl of wrapped) {
            ops.push({ kind: "text", x: x + padding, yRel, size: storyFontSize, weight: "normal", text: wl });
            yRel += lineHeight;
          }
        }

        // Total content height (last baseline + descent approximation).
        const totalH = yRel + padding;
        const vAlignRaw = (style.verticalAlign || "top").toLowerCase();
        const freeSpace = Math.max(0, hsHeight - totalH);
        const yOffset =
          vAlignRaw === "bottom" ? freeSpace
          : vAlignRaw === "center" || vAlignRaw === "middle" ? freeSpace / 2
          : 0;

        // Optional clip to hotspot bounds (editor parity with clipOverflow).
        let clipId: string | null = null;
        if (clipOverflow) {
          clipId = `clip-story-${Math.random().toString(36).slice(2, 8)}`;
          svgParts += `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${hsWidth}" height="${hsHeight}"/></clipPath></defs>`;
          svgParts += `<g clip-path="url(#${clipId})">`;
        }

        for (const op of ops) {
          if (op.kind !== "text") continue;
          const absY = y + padding + op.yRel + yOffset;
          svgParts += `<text x="${op.x}" y="${absY}" font-family="Inter, sans-serif" font-size="${op.size}" font-weight="${op.weight}" fill="${escapeXml(color)}" text-anchor="start">${escapeXml(op.text)}</text>`;
        }

        if (clipOverflow) svgParts += `</g>`;
        return svgParts;
      }

      // === Standard hotspot rendering ===
      // Map textAlign to SVG text-anchor and x position
      let textAnchor = "middle";
      let textX = x + hsWidth / 2;
      if (textAlign === "left") {
        textAnchor = "start";
        textX = x + 4;
      } else if (textAlign === "right") {
        textAnchor = "end";
        textX = x + hsWidth - 4;
      }

      // Vertical center
      const textY = y + hsHeight / 2 + scaledFontSize * 0.35;

      // Clip text to hotspot bounding box (matches client-side overflow:hidden).
      // When style.clipOverflow === false, skip the clipPath wrapper so text
      // can spill outside, matching the editor's overflow-visible mode.
      let clipId: string | null = null;
      if (clipOverflow) {
        clipId = `clip-hs-${Math.random().toString(36).slice(2, 8)}`;
        svgParts += `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${hsWidth}" height="${hsHeight}"/></clipPath></defs>`;
        svgParts += `<g clip-path="url(#${clipId})">`;
      }

      // Text - support line breaks (\n) with multiple tspan elements
      const lines = metricValue.split("\n");
      if (lines.length <= 1) {
        svgParts += `<text x="${textX}" y="${textY}" font-family="Inter, sans-serif" font-size="${scaledFontSize}" font-weight="${fontWeight}" fill="${escapeXml(color)}" text-anchor="${textAnchor}">${escapeXml(metricValue)}</text>`;
      } else {
        const lineHeight = scaledFontSize * 1.2;
        const totalTextHeight = lineHeight * lines.length;
        const startY = y + (hsHeight - totalTextHeight) / 2 + scaledFontSize * 0.85;
        svgParts += `<text font-family="Inter, sans-serif" font-size="${scaledFontSize}" font-weight="${fontWeight}" fill="${escapeXml(color)}" text-anchor="${textAnchor}">`;
        lines.forEach((line, i) => {
          svgParts += `<tspan x="${textX}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`;
        });
        svgParts += `</text>`;
      }

      if (clipOverflow) svgParts += `</g>`;

      return {
        z: typeof hotspot.zIndex === "number" ? hotspot.zIndex : 1,
        svg: svgParts,
      };
    });

    // Merge all hotspot SVG fragments (maps, images, text) and sort by zIndex
    // ascending so higher Z paints last/on top. JS sort is stable, so hotspots
    // sharing the same Z keep their original order (map → image → text).
    const allHotspotSvg = [...mapSvgElements, ...imageSvgElements, ...hotspotSvgEntries]
      .sort((a, b) => a.z - b.z)
      .map((e) => e.svg)
      .join("\n  ");

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  ${bgSolidColor ? `<rect x="0" y="0" width="${width}" height="${height}" fill="${bgSolidColor}"/>` : `<image href="${bgDataUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`}
  ${allHotspotSvg}
</svg>`;

    const svgBytes = new TextEncoder().encode(svgContent);
    console.log(`[render-stats-snapshot] SVG constructed: ${svgContent.length} chars, ${textHotspots.length} hotspots, ${svgBytes.length} bytes`);

    // Upload SVG directly (avoids CPU-heavy resvg-wasm PNG rasterization)
    const storagePath = `${template_id}/snapshot-${campaign_code}.svg`;
    const { error: uploadError } = await supabase.storage
      .from("slide-snapshots")
      .upload(storagePath, svgBytes, {
        cacheControl: "300",
        upsert: true,
        contentType: "image/svg+xml",
      });

    if (uploadError) {
      console.error("[render-stats-snapshot] Upload error:", uploadError);
      throw new Error(`Failed to upload snapshot: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from("slide-snapshots")
      .getPublicUrl(storagePath);

    console.log("[render-stats-snapshot] Uploaded to:", publicUrl);

    const now = new Date().toISOString();
    await supabase
      .from("viral_slide_configs")
      .update({ 
        cached_snapshot_path: publicUrl,
        snapshot_rendered_at: now,
      })
      .eq("id", template_id);

    console.log(`[render-stats-snapshot] Complete for campaign: ${campaign_code}`);

    return new Response(
      JSON.stringify({
        success: true,
        rendered_at: now,
        snapshot_url: publicUrl,
        metrics_count: Object.keys(metrics).length,
        size_bytes: svgBytes.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[render-stats-snapshot] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
