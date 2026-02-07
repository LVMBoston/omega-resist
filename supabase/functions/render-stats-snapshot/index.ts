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

    // Store metrics snapshot as JSON (server-side image rendering deferred to Phase 2)
    // Mobile devices will use dynamic rendering with cached metrics
    const snapshotData = {
      template_id,
      campaign_code,
      metrics,
      rendered_at: new Date().toISOString(),
      hotspots: template.hotspots,
      image_url: template.image_url,
    };

    // Update template with snapshot timestamp (signals fresh data available)
    await supabase
      .from("viral_slide_configs")
      .update({ snapshot_rendered_at: new Date().toISOString() })
      .eq("id", template_id);

    console.log(`[render-stats-snapshot] Complete for campaign: ${campaign_code}`);

    return new Response(
      JSON.stringify({
        success: true,
        rendered_at: snapshotData.rendered_at,
        metrics_count: Object.keys(metrics).length,
        note: "Server-side image rendering pending - mobile uses dynamic rendering with retry logic",
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
