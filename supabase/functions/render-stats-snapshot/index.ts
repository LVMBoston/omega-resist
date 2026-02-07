import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ImageResponse } from "https://deno.land/x/og_edge@0.0.6/mod.ts";
import React from "https://esm.sh/react@18.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cache-control, pragma, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Retry helper - we have all the time we need for server-side snapshots
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
  console.error(`[render-stats-snapshot] Failed to fetch ${description} after ${maxAttempts} attempts`);
  return null;
}

// Metric calculation helper functions with retry logic
async function calculateMetrics(supabase: any, campaignCode: string): Promise<Record<string, string | number>> {
  const metrics: Record<string, string | number> = {};
  
  // Query tokens for this campaign with retry
  const tokens = await fetchWithRetry(
    () => supabase
      .from("tokens")
      .select("token, level, utm_medium")
      .eq("utm_campaign", campaignCode)
      .is("deleted_at", null),
    "tokens query"
  ) || [];

  // Query url_events for these tokens with retry
  const tokenStrings = Array.isArray(tokens) ? tokens.map((t: any) => t.token) : [];
  let events: any[] = [];
  
  if (tokenStrings.length > 0) {
    events = await fetchWithRetry(
      () => supabase
        .from("url_events")
        .select("event_type, country_code, zip_code, utm_snapshot, occurred_at")
        .in("token", tokenStrings)
        .is("deleted_at", null),
      "url_events query"
    ) || [];
  }

  // Calculate metrics
  const tokenArray = Array.isArray(tokens) ? tokens : [];
  const l00Count = tokenArray.filter((t: any) => t.level === 0).length;
  const l01Count = tokenArray.filter((t: any) => t.level === 1).length;
  const l02Count = tokenArray.filter((t: any) => t.level === 2).length;
  const l03Count = tokenArray.filter((t: any) => t.level === 3).length;
  const sharesCount = tokenArray.filter((t: any) => t.level > 0).length;

  metrics.seeds = l00Count.toLocaleString();
  metrics.l01_count = l01Count.toLocaleString();
  metrics.l02_count = l02Count.toLocaleString();
  metrics.l03_count = l03Count.toLocaleString();
  metrics.shares = sharesCount.toLocaleString();

  // Opens (view events)
  const eventArray = Array.isArray(events) ? events : [];
  const viewEvents = eventArray.filter((e: any) => e.event_type === "view");
  metrics.opens = viewEvents.length.toLocaleString();

  // Opens by location
  const opensUS = eventArray.filter((e: any) => e.event_type === "view" && e.country_code === "US").length;
  const opensIntl = eventArray.filter((e: any) => e.event_type === "view" && e.country_code && e.country_code !== "US").length;
  metrics.opens_us = opensUS.toLocaleString();
  metrics.opens_intl = opensIntl.toLocaleString();

  // Opens by medium
  const opensQR = viewEvents.filter((e: any) => (e.utm_snapshot as any)?.utm_medium === "qr").length;
  const opensText = viewEvents.filter((e: any) => ["sms", "text"].includes((e.utm_snapshot as any)?.utm_medium)).length;
  const opensMail = viewEvents.filter((e: any) => ["email", "mail"].includes((e.utm_snapshot as any)?.utm_medium)).length;
  
  metrics.opens_qr = opensQR.toLocaleString();
  metrics.opens_text = opensText.toLocaleString();
  metrics.opens_mail = opensMail.toLocaleString();

  // Neighborhoods (distinct zip codes)
  const distinctZips = new Set(eventArray.filter((e: any) => e.zip_code).map((e: any) => e.zip_code));
  metrics.neighborhoods = distinctZips.size.toLocaleString();

  // Max depth
  const maxDepth = tokenArray.length > 0 ? Math.max(...tokenArray.map((t: any) => t.level)) : 0;
  metrics.depth = maxDepth.toString();

  // Viral coefficient
  const viralCoef = l00Count > 0 ? (sharesCount / l00Count).toFixed(2) : "0.00";
  metrics.viral_coefficient = viralCoef;

  // Seeds with spawns (L00 tokens that have at least one child)
  const l00Tokens = tokenArray.filter((t: any) => t.level === 0).map((t: any) => t.token);
  let seedsWithSpawns = 0;
  if (l00Tokens.length > 0) {
    const childTokens = await fetchWithRetry(
      () => supabase
        .from("tokens")
        .select("parent_token")
        .in("parent_token", l00Tokens)
        .is("deleted_at", null),
      "child tokens query"
    ) || [];
    const parentSet = new Set((Array.isArray(childTokens) ? childTokens : []).map((t: any) => t.parent_token));
    seedsWithSpawns = parentSet.size;
  }
  metrics.seeds_with_spawns = seedsWithSpawns.toLocaleString();

  // Get campaign title with retry
  const campaignData = await fetchWithRetry(
    () => supabase
      .from("campaigns")
      .select("title")
      .eq("code", campaignCode)
      .maybeSingle(),
    "campaign title query"
  );
  
  metrics.campaign_name = campaignData?.title || campaignCode;
  console.log(`[render-stats-snapshot] Campaign name resolved: "${metrics.campaign_name}"`);

  // Date/time metrics - use a standard format
  const now = new Date();
  const formatOptions: Intl.DateTimeFormatOptions = { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  
  metrics.current_date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  metrics.current_time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  metrics.last_updated = now.toLocaleString('en-US', formatOptions);

  // Earliest/Latest active
  const viewEventsWithTime = eventArray.filter((e: any) => e.event_type === "view" && e.occurred_at);
  if (viewEventsWithTime.length > 0) {
    viewEventsWithTime.sort((a: any, b: any) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
    const earliest = new Date(viewEventsWithTime[0].occurred_at);
    const latest = new Date(viewEventsWithTime[viewEventsWithTime.length - 1].occurred_at);
    
    metrics.earliest_active = earliest.toLocaleString('en-US', formatOptions);
    metrics.latest_active = latest.toLocaleString('en-US', formatOptions);
  } else {
    metrics.earliest_active = "(no activity)";
    metrics.latest_active = "(no activity)";
  }

  return metrics;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch template data with retry
    const template = await fetchWithRetry(
      () => supabase
        .from("viral_slide_configs")
        .select("*")
        .eq("id", template_id)
        .single(),
      "template fetch"
    );

    if (!template) {
      console.error("[render-stats-snapshot] Template not found after retries");
      return new Response(
        JSON.stringify({ error: "Template not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[render-stats-snapshot] Template loaded: ${template.name || template.slug}`);

    // Calculate live metrics with retry logic built in
    const metrics = await calculateMetrics(supabase, campaign_code);
    console.log("[render-stats-snapshot] Metrics calculated:", Object.keys(metrics).length, "metrics");
    console.log("[render-stats-snapshot] Metrics summary:", Object.entries(metrics).map(([k, v]) => `${k}=${v}`).join(", "));

    // Parse hotspots
    const hotspots = Array.isArray(template.hotspots) ? template.hotspots : [];
    const liveNumberHotspots = hotspots.filter((h: any) => h.type === "live_number");

    console.log(`[render-stats-snapshot] Found ${liveNumberHotspots.length} live_number hotspots`);

    // Fetch the base image and convert to base64 data URL
    const baseImageUrl = template.image_url;
    console.log(`[render-stats-snapshot] Fetching base image: ${baseImageUrl}`);
    
    const bgImageResponse = await fetch(baseImageUrl);
    if (!bgImageResponse.ok) {
      throw new Error(`Failed to fetch base image: ${bgImageResponse.status}`);
    }
    
    const bgImageArrayBuffer = await bgImageResponse.arrayBuffer();
    const mimeType = bgImageResponse.headers.get("content-type") || "image/jpeg";
    console.log(`[render-stats-snapshot] Base image fetched: ${bgImageArrayBuffer.byteLength} bytes, type: ${mimeType}`);
    
    // Convert ArrayBuffer to base64 using TextDecoder to avoid stack overflow
    const bytes = new Uint8Array(bgImageArrayBuffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const dataUrl = `data:${mimeType};base64,${base64}`;
    console.log(`[render-stats-snapshot] Base64 encoded, length: ${base64.length}`);
    
    // Use PORTRAIT 9:16 dimensions for mobile-first Data Templates
    const width = 1080;
    const height = 1920;
    
    console.log(`[render-stats-snapshot] Rendering at ${width}x${height} (portrait)`);

    // Build the overlay elements for each hotspot
    const overlayElements = liveNumberHotspots.map((hotspot: any) => {
      const style = hotspot.liveNumberStyle || {};
      
      // Get the metric value
      let value = "—";
      if (hotspot.metricKey === "manual_entry") {
        value = hotspot.manualLabel || "—";
      } else if (hotspot.metricKey && metrics[hotspot.metricKey] !== undefined) {
        value = String(metrics[hotspot.metricKey]);
      }

      // Calculate pixel positions from percentages
      const left = (hotspot.x / 100) * width;
      const top = (hotspot.y / 100) * height;
      const hotspotWidth = (hotspot.width / 100) * width;
      const hotspotHeight = (hotspot.height / 100) * height;

      // Scale font size: hotspots are configured for browser preview (~960px wide)
      // For 1080px portrait canvas, scale factor is ~1.125x
      const baseFontSize = parseInt(style.fontSize || "24") || 24;
      const scaledFontSize = Math.round(baseFontSize * (width / 960));

      console.log(`[render-stats-snapshot] Hotspot ${hotspot.id}: metric="${hotspot.metricKey}", value="${value}", fontSize=${scaledFontSize}px, pos=(${left.toFixed(0)}, ${top.toFixed(0)})`);
      
      return React.createElement(
        "div",
        {
          key: hotspot.id,
          style: {
            position: "absolute",
            left: `${left}px`,
            top: `${top}px`,
            width: `${hotspotWidth}px`,
            height: `${hotspotHeight}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: `${scaledFontSize}px`,
            fontWeight: style.fontWeight || "700",
            color: style.color || "#1a1a1a",
            backgroundColor: style.backgroundColor || "transparent",
            textAlign: style.textAlign || "center",
            fontFamily: style.fontFamily || "sans-serif",
            padding: style.padding || "0",
            borderRadius: style.borderRadius || "0",
          },
        },
        value
      );
    });

    // Create the composite image using backgroundImage CSS property
    // CRITICAL: Satori does NOT render <img> elements reliably - use backgroundImage instead
    // The data URL must be passed to backgroundImage for proper rendering
    const imageResponse = new ImageResponse(
      React.createElement(
        "div",
        {
          style: {
            width: `${width}px`,
            height: `${height}px`,
            display: "flex",
            position: "relative",
            backgroundImage: `url(${dataUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          },
        },
        // All hotspot overlays (each as absolutely positioned div)
        ...overlayElements
      ),
      {
        width,
        height,
      }
    );

    // Get the image as a buffer
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageUint8 = new Uint8Array(imageBuffer);

    // Upload to storage
    // Campaign-specific snapshot path to avoid overwrites when templates are shared
    const snapshotPath = `${template_id}/snapshot-${campaign_code}.png`;
    const { error: uploadError } = await supabase.storage
      .from("slide-snapshots")
      .upload(snapshotPath, imageUint8, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("[render-stats-snapshot] Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[render-stats-snapshot] Uploaded to: ${snapshotPath}`);

    // Update template with snapshot info
    const { error: updateError } = await supabase
      .from("viral_slide_configs")
      .update({
        cached_snapshot_path: `/${snapshotPath}`,
        snapshot_rendered_at: new Date().toISOString(),
      })
      .eq("id", template_id);

    if (updateError) {
      console.error("[render-stats-snapshot] Update error:", updateError);
      return new Response(
        JSON.stringify({ error: `Update failed: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from("slide-snapshots")
      .getPublicUrl(snapshotPath);

    console.log(`[render-stats-snapshot] Complete. Public URL: ${publicUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        snapshot_path: `/${snapshotPath}`,
        public_url: publicUrl,
        rendered_at: new Date().toISOString(),
        metrics_count: Object.keys(metrics).length,
        hotspots_rendered: liveNumberHotspots.length,
        dimensions: { width, height },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[render-stats-snapshot] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
