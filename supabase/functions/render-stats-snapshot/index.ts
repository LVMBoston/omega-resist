import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { render } from "https://deno.land/x/resvg_wasm@0.2.0/mod.ts";

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

  const seedsWithSpawns = l00Count > 0 && sharesCount > 0 ? Math.min(l00Count, sharesCount) : 0;

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
    metrics.earliest_active = earliest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    metrics.latest_active = latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  } else {
    metrics.earliest_active = "--";
    metrics.latest_active = "--";
  }

  const now = new Date();
  metrics.current_date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  metrics.current_time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  metrics.last_updated = `${metrics.current_date} ${metrics.current_time}`;

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

    // Parse hotspots from template
    const hotspots = Array.isArray(template.hotspots) ? template.hotspots : [];
    const textHotspots = hotspots.filter((h: any) => h.type !== "chart" && h.type !== "map");
    console.log(`[render-stats-snapshot] Processing ${textHotspots.length} text hotspots`);

    // Fetch background image as base64 data URL
    const imageUrl = template.image_url as string;
    const bgDataUrl = await fetchImageAsDataUrl(imageUrl);
    
    if (!bgDataUrl) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch background image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Target dimensions (portrait for mobile)
    const width = 1080;
    const height = 1920;

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
      // Text
      svgParts += `<text x="${textX}" y="${textY}" font-family="Inter, sans-serif" font-size="${scaledFontSize}" font-weight="${fontWeight}" fill="${escapeXml(color)}" text-anchor="${textAnchor}">${escapeXml(metricValue)}</text>`;

      return svgParts;
    }).join("\n    ");

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image href="${bgDataUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
  ${hotspotSvgElements}
</svg>`;

    console.log(`[render-stats-snapshot] SVG constructed: ${svgContent.length} chars, ${textHotspots.length} hotspots`);

    // Render SVG to PNG using resvg-wasm
    const pngBuffer = await render(svgContent);
    console.log(`[render-stats-snapshot] PNG rendered: ${pngBuffer.length} bytes`);

    // Upload to storage
    const storagePath = `${template_id}/snapshot-${campaign_code}.png`;
    const { error: uploadError } = await supabase.storage
      .from("slide-snapshots")
      .upload(storagePath, pngBuffer, {
        cacheControl: "300",
        upsert: true,
        contentType: "image/png",
      });

    if (uploadError) {
      console.error("[render-stats-snapshot] Upload error:", uploadError);
      throw new Error(`Failed to upload snapshot: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("slide-snapshots")
      .getPublicUrl(storagePath);

    console.log("[render-stats-snapshot] Uploaded to:", publicUrl);

    // Update template with snapshot path and timestamp
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
        size_bytes: pngBuffer.length,
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
