import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cache-control, pragma, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Retry helper for database queries
async function fetchWithRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
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

// Render a static map image for a map hotspot using Mapbox Static Images API
async function renderStaticMap(
  supabase: any,
  campaignCode: string,
  mapConfig: any,
  pixelWidth: number,
  pixelHeight: number,
): Promise<string | null> {
  const mapboxToken = Deno.env.get("MAPBOX_PUBLIC_TOKEN");
  if (!mapboxToken) {
    console.warn("[render-stats-snapshot] MAPBOX_PUBLIC_TOKEN not set, skipping map hotspot");
    return null;
  }

  try {
    // Fetch event points for this campaign (mirrors MapHotspotRenderer logic)
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

    const tokenIds = tokens.map((t: any) => t.token);
    const { data: events } = await supabase
      .from("url_events").select("id, token, latitude, longitude, event_type")
      .in("token", tokenIds).eq("event_type", "view").eq("is_simulated", false)
      .not("latitude", "is", null).not("longitude", "is", null);
    if (!events || events.length === 0) return null;

    // Build pin overlay for Mapbox Static API
    // Increase cap to 200 (each pin ~30 chars, well within URL limits)
    const points = events.slice(0, 200);

    // Clamp image dimensions (Mapbox max 1280x1280) while preserving aspect ratio
    let imgW = Math.round(pixelWidth);
    let imgH = Math.round(pixelHeight);
    if (imgW > 1280 || imgH > 1280) {
      const scale = Math.min(1280 / imgW, 1280 / imgH);
      imgW = Math.round(imgW * scale);
      imgH = Math.round(imgH * scale);
    }

    // Use pin-s (small pins) overlay - compact URL format
    const pinOverlay = points
      .map((p: any) => `pin-s+3b82f6(${p.longitude.toFixed(4)},${p.latitude.toFixed(4)})`)
      .join(",");

    // Use savedBounds for viewport if available, otherwise 'auto'
    let viewport = "auto";
    const savedBounds = mapConfig?.savedBounds;
    if (savedBounds && savedBounds.north && savedBounds.south && savedBounds.east && savedBounds.west) {
      // Use Mapbox bounding box viewport for exact match with Leaflet's savedBounds
      viewport = `[${savedBounds.west},${savedBounds.south},${savedBounds.east},${savedBounds.north}]`;
      console.log(`[render-stats-snapshot] Using savedBounds bbox viewport: ${viewport}`);
    }
    // Mapbox only allows padding with 'auto' viewport, not explicit coordinates
    const paddingParam = viewport === "auto" ? "&padding=40" : "";
    const url = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${pinOverlay}/${viewport}/${imgW}x${imgH}@2x?access_token=${mapboxToken}${paddingParam}`;

    console.log(`[render-stats-snapshot] Fetching static map: ${imgW}x${imgH}, ${points.length} markers`);
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`[render-stats-snapshot] Static map fetch failed: ${resp.status} ${await resp.text()}`);
      return null;
    }

    const buf = new Uint8Array(await resp.arrayBuffer());
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < buf.length; i += chunkSize) {
      const chunk = buf.subarray(i, Math.min(i + chunkSize, buf.length));
      binary += String.fromCharCode(...chunk);
    }
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
  metrics.opens_mail = viewEvents.filter((e: any) => ["email", "mail"].includes((e.utm_snapshot as any)?.utm_medium)).length.toLocaleString();
  metrics.neighborhoods = new Set(eventArray.filter((e: any) => e.zip_code).map((e: any) => e.zip_code)).size.toLocaleString();
  metrics.depth = tokenArray.length > 0 ? Math.max(...tokenArray.map((t: any) => t.level)).toString() : "0";
  metrics.viral_coefficient = l00Count > 0 ? (sharesCount / l00Count).toFixed(2) : "0.00";

  const campaignData = await fetchWithRetry(
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
    const earlyTime = earliest.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' UTC';
    metrics.earliest_active = `${earlyDate}\n${earlyTime}`;
    const lateDate = latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const lateTime = latest.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' UTC';
    metrics.latest_active = `${lateDate}\n${lateTime}`;
  } else {
    metrics.earliest_active = "--";
    metrics.latest_active = "--";
  }

  const now = new Date();
  metrics.current_date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  metrics.current_time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' UTC';
  metrics.last_updated = `${metrics.current_date} ${metrics.current_time}`;

  // Campaign story headline (inline generation from already-fetched data)
  const campaignInfo = await fetchWithRetry(
    () => supabase.from("campaigns").select("title, created_at").eq("code", campaignCode).maybeSingle(),
    "campaign info for story"
  );
  if (campaignInfo) {
    const daysActive = Math.max(1, Math.floor((Date.now() - new Date(campaignInfo.created_at).getTime()) / (1000 * 60 * 60 * 24)));
    const seedCount = parseInt(String(metrics.seeds).replace(/,/g, ""), 10) || 0;
    const viewCountNum = parseInt(String(metrics.opens).replace(/,/g, ""), 10) || 0;
    const zipCountNum = parseInt(String(metrics.neighborhoods).replace(/,/g, ""), 10) || 0;
    const maxDepth = parseInt(String(metrics.depth), 10) || 0;
    const spawnsNum = parseInt(String(metrics.seeds_with_spawns).replace(/,/g, ""), 10) || 0;

    // Query US states for geographic context
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

    // Propagation speed from tokens
    const speedTokens = await fetchWithRetry(
      () => supabase.from("tokens")
        .select("level, minted_at")
        .eq("utm_campaign", campaignCode)
        .eq("is_simulated", false)
        .is("deleted_at", null)
        .order("minted_at", { ascending: true }),
      "speed tokens for story"
    ) || [];
    const speedMap = new Map<number, string>();
    for (const t of speedTokens as any[]) {
      if (!speedMap.has(t.level)) speedMap.set(t.level, t.minted_at);
    }
    const speedEntries = Array.from(speedMap.entries()).sort((a, b) => a[0] - b[0]);

    const storyLines: string[] = [];
    storyLines.push(campaignInfo.title || campaignCode);
    storyLines.push(`${daysActive} days active`);
    storyLines.push("");
    storyLines.push(`${seedCount} cards dropped`);
    if (seedCount > 0 && spawnsNum > 0) {
      const sproutRate = Math.round((spawnsNum / seedCount) * 100);
      storyLines.push(`${spawnsNum} sprouted (${sproutRate}%)`);
    }
    storyLines.push("");
    if (maxDepth > 0) {
      storyLines.push(`Longest chain: ${maxDepth} levels`);
      if (speedEntries.length >= 2) {
        const l0Time = new Date(speedEntries[0][1]);
        const last = speedEntries[speedEntries.length - 1];
        const diffHours = Math.round((new Date(last[1]).getTime() - l0Time.getTime()) / (1000 * 60 * 60));
        if (diffHours < 1) storyLines.push(`Reached L${last[0]} in < 1 hour`);
        else if (diffHours < 24) storyLines.push(`Reached L${last[0]} in ${diffHours} hours`);
        else { const d = Math.round(diffHours / 24); storyLines.push(`Reached L${last[0]} in ${d} day${d > 1 ? "s" : ""}`); }
      }
      storyLines.push("");
    }
    storyLines.push(`${viewCountNum} views, ${zipCountNum} zip codes`);
    if (stateCount > 0) storyLines.push(`across ${stateCount} state${stateCount > 1 ? "s" : ""}`);
    storyLines.push("");
    storyLines.push("No ad budget.");
    storyLines.push("Every view earned.");

    metrics.campaign_story = storyLines.join("\n");
  } else {
    metrics.campaign_story = "--";
  }

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

    const template = await fetchWithRetry(
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

    // Fetch background image as base64 data URL
    const imageUrl = template.image_url as string;
    const bgDataUrl = await fetchImageAsDataUrl(imageUrl);
    
    if (!bgDataUrl) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch background image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse hotspots from template
    const hotspots = Array.isArray(template.hotspots) ? template.hotspots : [];
    // Exclude action hotspots from SVG baking — they remain as client-side interactive overlays
    const ACTION_TYPES = new Set(["sms", "email", "social", "external_link"]);
    const textHotspots = hotspots.filter((h: any) => h.type !== "chart" && h.type !== "map" && !ACTION_TYPES.has(h.type));
    const mapHotspots = hotspots.filter((h: any) => h.type === "map");
    console.log(`[render-stats-snapshot] Processing ${textHotspots.length} text hotspots, ${mapHotspots.length} map hotspots`);

    // Target dimensions (portrait for mobile)
    const width = 1080;
    const height = 1920;

    // Render static map images for map hotspots
    const mapSvgElements: string[] = [];
    for (const mapHotspot of mapHotspots) {
      const mapX = (mapHotspot.x / 100) * width;
      const mapY = (mapHotspot.y / 100) * height;
      const mapW = ((mapHotspot.width || 30) / 100) * width;
      const mapH = ((mapHotspot.height || 20) / 100) * height;

      const mapConfig = mapHotspot.mapConfig || {};
      const mapDataUrl = await renderStaticMap(supabase, campaign_code, mapConfig, mapW, mapH);

      if (mapDataUrl) {
        mapSvgElements.push(
          `<image href="${mapDataUrl}" x="${mapX}" y="${mapY}" width="${mapW}" height="${mapH}" preserveAspectRatio="xMidYMid slice"/>`
        );
      } else {
        // Fallback: grey placeholder with label
        mapSvgElements.push(
          `<rect x="${mapX}" y="${mapY}" width="${mapW}" height="${mapH}" fill="#e2e8f0" rx="4"/>` +
          `<text x="${mapX + mapW / 2}" y="${mapY + mapH / 2}" font-family="Inter, sans-serif" font-size="18" fill="#64748b" text-anchor="middle" dominant-baseline="middle">Map</text>`
        );
      }
    }

    // Build SVG with embedded background image and text hotspots
    const hotspotSvgElements = textHotspots.map((hotspot: any) => {
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
      // Scale for 1080px canvas (designed for ~960px)
      const scaledFontSize = Math.round(fontSize * (width / 960));

      const fontWeight = style.fontWeight === "bold" || style.fontWeight === "700" ? "bold" : "normal";
      const color = style.color || "#000000";
      const bgColor = style.backgroundColor || "transparent";
      const textAlign = style.textAlign || "center";

      // Map textAlign to SVG text-anchor and x position
      let textAnchor = "middle";
      let textX = x + hsWidth / 2;
      if (textAlign === "left") {
        textAnchor = "start";
        textX = x + 4; // small padding
      } else if (textAlign === "right") {
        textAnchor = "end";
        textX = x + hsWidth - 4;
      }

      // Vertical center
      const textY = y + hsHeight / 2 + scaledFontSize * 0.35;

      let svgParts = "";
      // Background rect
      if (bgColor && bgColor !== "transparent") {
        svgParts += `<rect x="${x}" y="${y}" width="${hsWidth}" height="${hsHeight}" fill="${escapeXml(bgColor)}" rx="2"/>`;
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

      return svgParts;
    }).join("\n    ");

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image href="${bgDataUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
  ${mapSvgElements.join("\n  ")}
  ${hotspotSvgElements}
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
