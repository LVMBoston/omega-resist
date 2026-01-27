import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ImageResponse } from "https://deno.land/x/og_edge@0.0.6/mod.ts";
import React from "https://esm.sh/react@18.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Metric calculation helper functions
async function calculateMetrics(supabase: any, campaignCode: string): Promise<Record<string, string | number>> {
  const metrics: Record<string, string | number> = {};
  
  // Query tokens for this campaign
  const { data: tokens, error: tokensError } = await supabase
    .from("tokens")
    .select("token, level, utm_medium")
    .eq("utm_campaign", campaignCode)
    .is("deleted_at", null);
  
  if (tokensError) {
    console.error("Error fetching tokens:", tokensError);
    throw new Error(`Failed to fetch tokens: ${tokensError.message}`);
  }

  // Query url_events for these tokens
  const tokenStrings = tokens?.map((t: any) => t.token) || [];
  let events: any[] = [];
  
  if (tokenStrings.length > 0) {
    const { data: eventsData, error: eventsError } = await supabase
      .from("url_events")
      .select("event_type, country_code, zip_code, utm_snapshot, occurred_at")
      .in("token", tokenStrings)
      .is("deleted_at", null);
    
    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      throw new Error(`Failed to fetch events: ${eventsError.message}`);
    }
    events = eventsData || [];
  }

  // Calculate metrics
  const l00Count = tokens?.filter((t: any) => t.level === 0).length || 0;
  const l01Count = tokens?.filter((t: any) => t.level === 1).length || 0;
  const l02Count = tokens?.filter((t: any) => t.level === 2).length || 0;
  const l03Count = tokens?.filter((t: any) => t.level === 3).length || 0;
  const sharesCount = tokens?.filter((t: any) => t.level > 0).length || 0;

  metrics.seeds = l00Count.toLocaleString();
  metrics.l01_count = l01Count.toLocaleString();
  metrics.l02_count = l02Count.toLocaleString();
  metrics.l03_count = l03Count.toLocaleString();
  metrics.shares = sharesCount.toLocaleString();

  // Opens (view events)
  const viewEvents = events.filter((e: any) => e.event_type === "view");
  metrics.opens = viewEvents.length.toLocaleString();

  // Opens by location
  const opensUS = events.filter((e: any) => e.event_type === "view" && e.country_code === "US").length;
  const opensIntl = events.filter((e: any) => e.event_type === "view" && e.country_code && e.country_code !== "US").length;
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
  const distinctZips = new Set(events.filter((e: any) => e.zip_code).map((e: any) => e.zip_code));
  metrics.neighborhoods = distinctZips.size.toLocaleString();

  // Max depth
  const maxDepth = tokens && tokens.length > 0 ? Math.max(...tokens.map((t: any) => t.level)) : 0;
  metrics.depth = maxDepth.toString();

  // Viral coefficient
  const viralCoef = l00Count > 0 ? (sharesCount / l00Count).toFixed(2) : "0.00";
  metrics.viral_coefficient = viralCoef;

  // Get campaign title
  const { data: campaignData } = await supabase
    .from("campaigns")
    .select("title")
    .eq("code", campaignCode)
    .maybeSingle();
  
  metrics.campaign_name = campaignData?.title || campaignCode;

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
  const viewEventsWithTime = events.filter((e: any) => e.event_type === "view" && e.occurred_at);
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

    // Fetch template data
    const { data: template, error: templateError } = await supabase
      .from("viral_slide_configs")
      .select("*")
      .eq("id", template_id)
      .single();

    if (templateError || !template) {
      console.error("[render-stats-snapshot] Template not found:", templateError);
      return new Response(
        JSON.stringify({ error: "Template not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[render-stats-snapshot] Template loaded: ${template.name || template.slug}`);

    // Calculate live metrics
    const metrics = await calculateMetrics(supabase, campaign_code);
    console.log("[render-stats-snapshot] Metrics calculated:", Object.keys(metrics).length, "metrics");

    // Parse hotspots
    const hotspots = Array.isArray(template.hotspots) ? template.hotspots : [];
    const liveNumberHotspots = hotspots.filter((h: any) => h.type === "live_number");

    console.log(`[render-stats-snapshot] Found ${liveNumberHotspots.length} live_number hotspots`);

    // Fetch the base image dimensions
    const baseImageUrl = template.image_url;
    
    // Create the image response using og_edge
    // We'll use a fixed 1920x1080 canvas for high quality
    const width = 1920;
    const height = 1080;

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

      // Scale font size proportionally (assuming original was for ~1920 width)
      const baseFontSize = parseInt(style.fontSize || "56") || 56;
      
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
            fontSize: `${baseFontSize}px`,
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

    // Create the composite image
    const imageResponse = new ImageResponse(
      React.createElement(
        "div",
        {
          style: {
            width: `${width}px`,
            height: `${height}px`,
            display: "flex",
            position: "relative",
            backgroundImage: `url(${baseImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          },
        },
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
    const snapshotPath = `${template_id}/latest.png`;
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
