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
  name: "list_recent_events",
  title: "List recent tracking events",
  description:
    "Return the most recent url_events (scans/views/shares) with geo info. Optionally filter by event_type.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional().describe("Max events (default 50)."),
    event_type: z
      .enum(["scan", "view", "share"])
      .optional()
      .describe("Optional filter by event type."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, event_type }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let query = supabaseForUser(ctx)
      .from("url_events")
      .select("id, token, event_type, occurred_at, city, region, country_code, zip_code, location_source")
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .limit(limit ?? 50);
    if (event_type) query = query.eq("event_type", event_type);
    const { data, error } = await query;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { events: data ?? [] },
    };
  },
});
