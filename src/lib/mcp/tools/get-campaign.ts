import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_campaign",
  title: "Get campaign",
  description:
    "Fetch a single campaign by its short code (e.g. 'ice-takedown') along with its events/actions.",
  inputSchema: {
    code: z.string().trim().min(1).describe("Campaign short code / slug."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ code }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    if (!campaign)
      return { content: [{ type: "text", text: `No campaign with code '${code}'` }], isError: true };
    const { data: eoas } = await supabase
      .from("events_actions")
      .select("id, utm_id, type, mobilize_code, title, city, state, zip_code, assigned_deck_slug")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: true });
    const payload = { campaign, events_actions: eoas ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
