import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import React from "https://esm.sh/react@18.2.0";
import { ImageResponse } from "https://deno.land/x/og_edge@0.0.6/mod.ts";

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
    console.log(`[render-stats-snapshot] Processing ${hotspots.length} text hotspots`);

    // Build the image URL for background
    const imageUrl = template.image_url as string;
    console.log("[render-stats-snapshot] Background image URL:", imageUrl);

    // Target dimensions (portrait for mobile)
    const width = 1080;
    const height = 1920;

    // Build hotspot elements for JSX rendering
    const hotspotElements = hotspots
      .filter((h: any) => h.type !== "chart" && h.type !== "map") // Only text/number hotspots
      .map((hotspot: any, idx: number) => {
        const metricValue = metrics[hotspot.metric] ?? "—";
        const x = (hotspot.x / 100) * width;
        const y = (hotspot.y / 100) * height;
        const hsWidth = ((hotspot.width || 10) / 100) * width;
        const hsHeight = ((hotspot.height || 5) / 100) * height;

        // Alignment styles
        const justifyContent = hotspot.textAlign === "left" ? "flex-start" :
                              hotspot.textAlign === "right" ? "flex-end" : "center";
        const alignItems = hotspot.verticalAlign === "top" ? "flex-start" :
                          hotspot.verticalAlign === "bottom" ? "flex-end" : "center";

        return React.createElement("div", {
          key: idx,
          style: {
            position: "absolute",
            left: x,
            top: y,
            width: hsWidth,
            height: hsHeight,
            display: "flex",
            justifyContent,
            alignItems,
            fontFamily: "Inter, sans-serif",
            fontSize: hotspot.fontSize || 24,
            fontWeight: hotspot.fontWeight === "bold" ? 700 : 400,
            color: hotspot.color || "#000000",
          }
        }, String(metricValue));
      });

    // Create JSX element with background image and hotspot overlays
    const element = React.createElement("div", {
      style: {
        width,
        height,
        display: "flex",
        position: "relative",
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    }, ...hotspotElements);

    // Generate PNG using og_edge (Satori + resvg under the hood)
    const imageResponse = new ImageResponse(element, {
      width,
      height,
    });

    // Get the PNG buffer from the response
    const pngBuffer = new Uint8Array(await imageResponse.arrayBuffer());
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
