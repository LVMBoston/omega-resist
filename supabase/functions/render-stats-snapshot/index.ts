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

  metrics.seeds = l00Count.toLocaleString();
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
    console.log("[render-stats-snapshot] Metrics calculated:", Object.keys(metrics).length);

    // Parse hotspots from template
    const hotspots = Array.isArray(template.hotspots) ? template.hotspots : [];
    console.log(`[render-stats-snapshot] Processing ${hotspots.length} hotspots`);

    // Fetch background image using Supabase storage client
    // Extract bucket and path from URL
    const imageUrl = template.image_url as string;
    console.log("[render-stats-snapshot] Fetching background image:", imageUrl);
    
    // Parse the storage URL to get bucket and path
    const storageMatch = imageUrl.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/);
    let imageBytes: Uint8Array;
    
    if (storageMatch) {
      const [, bucket, path] = storageMatch;
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error || !data) {
        console.error("[render-stats-snapshot] Storage download failed:", error);
        throw new Error(`Failed to download image: ${error?.message}`);
      }
      imageBytes = new Uint8Array(await data.arrayBuffer());
    } else {
      // Fallback to direct fetch for external URLs
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      imageBytes = new Uint8Array(await imageResponse.arrayBuffer());
    }
    
    // Use chunked base64 encoding to handle large images
    let base64Image = "";
    const chunkSize = 32768;
    for (let i = 0; i < imageBytes.length; i += chunkSize) {
      const chunk = imageBytes.slice(i, i + chunkSize);
      base64Image += btoa(String.fromCharCode.apply(null, [...chunk]));
    }
    
    const contentType = "image/jpeg"; // Assume JPEG for slides
    const imageDataUri = `data:${contentType};base64,${base64Image}`;
    console.log(`[render-stats-snapshot] Image fetched: ${imageBytes.length} bytes`);

    // Portrait dimensions for mobile (1080x1920)
    const width = 1080;
    const height = 1920;
    
    // Build SVG with embedded background image and text overlays
    const hotspotSvgElements = hotspots.map((hotspot: any) => {
      const metricValue = metrics[hotspot.metric] ?? "—";
      const x = (hotspot.x / 100) * width;
      const y = (hotspot.y / 100) * height;
      const hsWidth = ((hotspot.width || 10) / 100) * width;
      const hsHeight = ((hotspot.height || 5) / 100) * height;
      
      // Calculate text anchor and alignment
      const textAnchor = hotspot.textAlign === "left" ? "start" : 
                        hotspot.textAlign === "right" ? "end" : "middle";
      const textX = hotspot.textAlign === "left" ? x : 
                   hotspot.textAlign === "right" ? x + hsWidth : x + hsWidth / 2;
      
      // Vertical alignment
      const dominantBaseline = hotspot.verticalAlign === "top" ? "hanging" :
                              hotspot.verticalAlign === "bottom" ? "auto" : "central";
      const textY = hotspot.verticalAlign === "top" ? y :
                   hotspot.verticalAlign === "bottom" ? y + hsHeight : y + hsHeight / 2;
      
      // Escape special characters in metric value for XML
      const escapedValue = String(metricValue)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      
      return `<text 
        x="${textX}" 
        y="${textY}" 
        font-family="Inter, system-ui, sans-serif" 
        font-size="${hotspot.fontSize || 24}" 
        font-weight="${hotspot.fontWeight === "bold" ? "700" : "400"}"
        fill="${hotspot.color || "#000000"}"
        text-anchor="${textAnchor}"
        dominant-baseline="${dominantBaseline}"
      >${escapedValue}</text>`;
    }).join("\n");

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image href="${imageDataUri}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
  ${hotspotSvgElements}
</svg>`;

    console.log("[render-stats-snapshot] SVG generated");

    // Convert SVG to PNG using deno.land/x/resvg_wasm
    const { render } = await import("https://deno.land/x/resvg_wasm@0.2.0/mod.ts");
    const pngBuffer = await render(svg);
    console.log(`[render-stats-snapshot] PNG generated: ${pngBuffer.length} bytes`);

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
