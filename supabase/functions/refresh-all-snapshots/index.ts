import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RenderResult {
  template_id: string;
  campaign_code: string;
  status: "rendered" | "skipped" | "error";
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[refresh-all-snapshots] Starting orchestrator run");

    // Step 1: Get all campaigns with snapshot_enabled = true
    const { data: campaigns, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, code, title, snapshot_enabled, snapshot_interval_minutes")
      .eq("snapshot_enabled", true);

    if (campaignError) {
      throw new Error(`Failed to fetch campaigns: ${campaignError.message}`);
    }

    if (!campaigns || campaigns.length === 0) {
      console.log("[refresh-all-snapshots] No snapshot-enabled campaigns found");
      return new Response(
        JSON.stringify({ rendered: [], skipped: [], errors: [], message: "No enabled campaigns" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[refresh-all-snapshots] Found ${campaigns.length} enabled campaign(s)`);

    const rendered: RenderResult[] = [];
    const skipped: RenderResult[] = [];
    const errors: RenderResult[] = [];

    for (const campaign of campaigns) {
      const intervalMinutes = campaign.snapshot_interval_minutes ?? 2;

      // Step 2: Find deck slugs for this campaign via events_actions
      const { data: eoas, error: eoaError } = await supabase
        .from("events_actions")
        .select("assigned_deck_slug")
        .eq("campaign_id", campaign.id)
        .not("assigned_deck_slug", "is", null);

      if (eoaError || !eoas || eoas.length === 0) {
        console.log(`[refresh-all-snapshots] No deck assignments for campaign ${campaign.code}`);
        continue;
      }

      const deckSlugs = [...new Set(eoas.map((e: any) => e.assigned_deck_slug))];

      // Step 3: Find template IDs from slide_items for these decks
      const { data: slideItems, error: slideError } = await supabase
        .from("slide_items")
        .select("template_id")
        .in("deck_slug", deckSlugs)
        .not("template_id", "is", null);

      if (slideError || !slideItems || slideItems.length === 0) {
        console.log(`[refresh-all-snapshots] No templates for campaign ${campaign.code}`);
        continue;
      }

      const templateIds = [...new Set(slideItems.map((s: any) => s.template_id))];

      // Step 4: Check staleness per (template, campaign) by checking actual storage file age
      for (const templateId of templateIds) {
        const snapshotPath = `${templateId}/snapshot-${campaign.code}.svg`;

        // Check if the snapshot file exists and its age via storage API
        const { data: files, error: listError } = await supabase.storage
          .from("slide-snapshots")
          .list(templateId, { search: `snapshot-${campaign.code}.svg` });

        let ageMinutes = Infinity;
        if (!listError && files && files.length > 0) {
          const file = files.find((f: any) => f.name === `snapshot-${campaign.code}.svg`);
          if (file?.updated_at) {
            ageMinutes = (Date.now() - new Date(file.updated_at).getTime()) / 60000;
          }
        }

        if (ageMinutes < intervalMinutes) {
          skipped.push({
            template_id: templateId,
            campaign_code: campaign.code,
            status: "skipped",
            reason: `Fresh (${Math.round(ageMinutes)}m < ${intervalMinutes}m)`,
          });
          continue;
        }

        // Step 5: Call render-stats-snapshot
        console.log(`[refresh-all-snapshots] Rendering template ${templateId} for campaign ${campaign.code} (age: ${Math.round(ageMinutes)}m)`);

        try {
          const renderResponse = await fetch(
            `${supabaseUrl}/functions/v1/render-stats-snapshot`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                template_id: templateId,
                campaign_code: campaign.code,
              }),
            }
          );

          if (!renderResponse.ok) {
            const errorText = await renderResponse.text();
            throw new Error(`${renderResponse.status}: ${errorText}`);
          }

          rendered.push({
            template_id: templateId,
            campaign_code: campaign.code,
            status: "rendered",
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          console.error(`[refresh-all-snapshots] Render failed for ${templateId}/${campaign.code}: ${msg}`);
          errors.push({
            template_id: templateId,
            campaign_code: campaign.code,
            status: "error",
            reason: msg,
          });
        }
      }
    }

    const summary = {
      rendered,
      skipped,
      errors,
      rendered_count: rendered.length,
      skipped_count: skipped.length,
      error_count: errors.length,
    };

    console.log(`[refresh-all-snapshots] Complete. Rendered: ${rendered.length}, Skipped: ${skipped.length}, Errors: ${errors.length}`);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    console.error("[refresh-all-snapshots] Fatal error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
