import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCampaigns from "./tools/list-campaigns";
import getCampaign from "./tools/get-campaign";
import getCampaignStats from "./tools/get-campaign-stats";
import listDecks from "./tools/list-decks";
import recentEvents from "./tools/recent-events";

// Build the direct Supabase issuer from the project ref (Vite inlines this at
// build time). Never derive from SUPABASE_URL — on Lovable Cloud that's the
// .lovable.cloud proxy and mcp-js will reject the mismatched issuer.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "democracy-forge-mcp",
  title: "Democracy Forge",
  version: "0.1.0",
  instructions:
    "Read-only access to Democracy Forge campaigns, decks, and viral tracking events. " +
    "Use list_campaigns to discover campaigns, get_campaign for details on one campaign, " +
    "get_campaign_stats for aggregated viral metrics, list_decks for slide decks, " +
    "and list_recent_events for the newest scan/view/share activity.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCampaigns, getCampaign, getCampaignStats, listDecks, recentEvents],
});
