import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cache-control, pragma, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DeployResult {
  campaign_code: string;
  campaign_title: string;
  status: "success" | "failed" | "skipped";
  public_url?: string;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { template_id, only_enabled = false } = await req.json();

    if (!template_id) {
      return new Response(
        JSON.stringify({ error: "template_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[deploy-template-snapshots] Starting deploy for template: ${template_id}, only_enabled: ${only_enabled}`);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Get all deck_slugs that use this template
    const { data: slideItems, error: slideError } = await supabase
      .from("slide_items")
      .select("deck_slug")
      .eq("template_id", template_id);

    if (slideError) throw new Error(`Failed to fetch slide_items: ${slideError.message}`);
    
    if (!slideItems || slideItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          campaigns_found: 0,
          campaigns_rendered: 0,
          campaigns_failed: 0,
          results: [],
          message: "No campaigns are using this template",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deckSlugs = [...new Set(slideItems.map((s) => s.deck_slug))];
    console.log(`[deploy-template-snapshots] Found ${deckSlugs.length} deck(s) using template`);

    // Step 2: Get all events_actions with these deck_slugs
    const { data: eoaItems, error: eoaError } = await supabase
      .from("events_actions")
      .select("campaign_id")
      .in("assigned_deck_slug", deckSlugs);

    if (eoaError) throw new Error(`Failed to fetch events_actions: ${eoaError.message}`);
    
    if (!eoaItems || eoaItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          campaigns_found: 0,
          campaigns_rendered: 0,
          campaigns_failed: 0,
          results: [],
          message: "No campaigns are assigned to decks using this template",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const campaignIds = [...new Set(eoaItems.map((e) => e.campaign_id))];

    // Step 3: Get campaign details
    let campaignsQuery = supabase
      .from("campaigns")
      .select("id, code, title, snapshot_enabled")
      .in("id", campaignIds);
    
    if (only_enabled) {
      campaignsQuery = campaignsQuery.eq("snapshot_enabled", true);
    }

    const { data: campaigns, error: campaignError } = await campaignsQuery;

    if (campaignError) throw new Error(`Failed to fetch campaigns: ${campaignError.message}`);
    
    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          campaigns_found: 0,
          campaigns_rendered: 0,
          campaigns_failed: 0,
          results: [],
          message: only_enabled 
            ? "No snapshot-enabled campaigns are using this template" 
            : "No campaigns found using this template",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[deploy-template-snapshots] Found ${campaigns.length} campaign(s) to render`);

    // Step 4: Render snapshot for each campaign sequentially
    const results: DeployResult[] = [];
    
    for (const campaign of campaigns) {
      console.log(`[deploy-template-snapshots] Rendering for campaign: ${campaign.code}`);
      
      try {
        // Call the render-stats-snapshot function directly via internal logic
        // We use fetch to call the edge function endpoint
        const renderResponse = await fetch(`${supabaseUrl}/functions/v1/render-stats-snapshot`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            template_id,
            campaign_code: campaign.code,
          }),
        });

        if (!renderResponse.ok) {
          const errorText = await renderResponse.text();
          throw new Error(`Render failed: ${renderResponse.status} - ${errorText}`);
        }

        const renderResult = await renderResponse.json();
        
        results.push({
          campaign_code: campaign.code,
          campaign_title: campaign.title,
          status: "success",
          public_url: renderResult.public_url,
        });
        
        console.log(`[deploy-template-snapshots] Success for ${campaign.code}`);
        
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error(`[deploy-template-snapshots] Failed for ${campaign.code}:`, errorMessage);
        
        results.push({
          campaign_code: campaign.code,
          campaign_title: campaign.title,
          status: "failed",
          error: errorMessage,
        });
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    console.log(`[deploy-template-snapshots] Complete. Success: ${successCount}, Failed: ${failedCount}`);

    return new Response(
      JSON.stringify({
        success: failedCount === 0,
        campaigns_found: campaigns.length,
        campaigns_rendered: successCount,
        campaigns_failed: failedCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[deploy-template-snapshots] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
