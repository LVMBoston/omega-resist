/**
 * Dumps the rendered Campaign Story for a fixed set of campaign codes,
 * using the service role key to bypass RLS (so the numbers match what
 * an admin sees in-app on /parity-harness or the editor).
 *
 * Writes each rendered story to /mnt/documents/campaign-stories/<code>.md
 * and prints the same text to stdout.
 *
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bunx tsx scripts/dump-campaign-stories.ts
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { computeCampaignStoryInputs } from "@/shared/render/campaignStoryInputs";
import { formatCampaignStory } from "@/shared/render/campaignStory";

const CODES = ["nk3-invitation", "rs-good-1"];
const OUT_DIR = "/mnt/documents/campaign-stories";

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const accessToken = process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN;
  const key = serviceKey || anonKey;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PUBLISHABLE_KEY) required");
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken && !serviceKey
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });

  await mkdir(OUT_DIR, { recursive: true });

  for (const code of CODES) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, title")
      .eq("code", code)
      .maybeSingle();
    if (!campaign?.id) {
      console.log(`\n=== ${code} ===\n(campaign not found)\n`);
      continue;
    }

    const inputs = await computeCampaignStoryInputs(supabase as any, {
      campaignCode: code,
      campaignId: campaign.id,
      dataSource: "real",
    });

    const text = formatCampaignStory({
      ...inputs,
      activeAnchorMs: new Date(inputs.campaignActiveAnchor).getTime(),
      nowMs: Date.now(),
    });

    const path = `${OUT_DIR}/${code}.md`;
    await writeFile(path, text, "utf-8");
    console.log(`\n=== ${code} (${campaign.title}) ===\n`);
    console.log(text);
    console.log(`\n(wrote ${path})\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
