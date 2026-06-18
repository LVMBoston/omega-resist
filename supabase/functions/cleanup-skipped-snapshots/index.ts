import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Find all (template_id, campaign_code) pairs whose ONLY associations are via skipped slides
  const { data: skipped, error: skipErr } = await supabase
    .from("slide_items")
    .select("template_id, deck_slug, skip_deploy")
    .not("template_id", "is", null);

  if (skipErr) {
    return new Response(JSON.stringify({ error: skipErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // template_id -> { skippedDecks: Set, activeDecks: Set }
  const byTemplate = new Map<string, { skipped: Set<string>; active: Set<string> }>();
  for (const row of skipped ?? []) {
    const tid = row.template_id as string;
    if (!byTemplate.has(tid)) byTemplate.set(tid, { skipped: new Set(), active: new Set() });
    const entry = byTemplate.get(tid)!;
    if (row.skip_deploy) entry.skipped.add(row.deck_slug);
    else entry.active.add(row.deck_slug);
  }

  const deleted: string[] = [];
  const keptBecauseActive: string[] = [];

  for (const [templateId, { skipped: skippedDecks, active: activeDecks }] of byTemplate) {
    // Decks that are ONLY skipped (no active counterpart) for this template
    const onlySkippedDecks = [...skippedDecks].filter((d) => !activeDecks.has(d));
    if (onlySkippedDecks.length === 0) continue;

    // Find campaigns assigned to those decks
    const { data: eoas } = await supabase
      .from("events_actions")
      .select("campaign_id, assigned_deck_slug")
      .in("assigned_deck_slug", onlySkippedDecks);

    const campaignIds = [...new Set((eoas ?? []).map((e: any) => e.campaign_id))];
    if (campaignIds.length === 0) continue;

    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("code")
      .in("id", campaignIds);

    for (const c of campaigns ?? []) {
      const path = `${templateId}/snapshot-${c.code}.svg`;
      // Confirm this template isn't also used non-skipped for the same campaign
      // (already filtered by onlySkippedDecks above)
      const { error: rmErr } = await supabase.storage.from("slide-snapshots").remove([path]);
      if (rmErr) {
        keptBecauseActive.push(`${path} (error: ${rmErr.message})`);
      } else {
        deleted.push(path);
      }
    }
  }

  return new Response(JSON.stringify({ deleted, keptBecauseActive }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
