import { supabase } from "@/integrations/supabase/client";

/**
 * Get breadth (unique tokens per level) and depth (max level) for a root token
 */
export async function getTokenMetrics(rootToken: string) {
  const { data, error } = await supabase
    .from("tokens")
    .select("level")
    .eq("root_token", rootToken);

  if (error) throw error;

  const levelCounts = {
    l0: 0,
    l1: 0,
    l2: 0,
    l3: 0,
    depth: 0
  };

  data.forEach(row => {
    const level = row.level;
    if (level === 0) levelCounts.l0++;
    if (level === 1) levelCounts.l1++;
    if (level === 2) levelCounts.l2++;
    if (level === 3) levelCounts.l3++;
    if (level > levelCounts.depth) levelCounts.depth = level;
  });

  return levelCounts;
}

/**
 * Get engagement metrics by placement for a root token
 */
export async function getEngagementByPlacement(rootToken: string) {
  // Query url_events joined with tokens and placements
  const { data: events, error } = await supabase
    .from("url_events")
    .select(`
      event_type,
      token,
      tokens!inner(
        root_token,
        placement_id,
        placements(code, name, context)
      )
    `)
    .eq("tokens.root_token", rootToken);

  if (error) throw error;

  // Aggregate by placement
  const metrics = new Map();
  events?.forEach(event => {
    const placement = event.tokens?.placements;
    const key = placement?.code || "no-placement";
    
    if (!metrics.has(key)) {
      metrics.set(key, {
        placement_code: placement?.code,
        placement_name: placement?.name,
        scans: 0,
        views: 0,
        shares: 0
      });
    }
    
    const m = metrics.get(key);
    if (event.event_type === "scan") m.scans++;
    if (event.event_type === "view") m.views++;
    if (event.event_type === "share") m.shares++;
  });

  return Array.from(metrics.values());
}

/**
 * Get daily aggregates for a campaign
 */
export async function getCampaignAggregates(campaignId: string, startDate?: string, endDate?: string) {
  let query = supabase
    .from("daily_aggregates")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("date", { ascending: false });

  if (startDate) {
    query = query.gte("date", startDate);
  }
  if (endDate) {
    query = query.lte("date", endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Get token chain (parent/child relationships)
 */
export async function getTokenChain(token: string) {
  const { data, error } = await supabase
    .from("tokens")
    .select("token, level, parent_token, root_token, utm_source, utm_medium, minted_at")
    .or(`token.eq.${token},parent_token.eq.${token},root_token.eq.${token}`)
    .order("level", { ascending: true });

  if (error) throw error;
  return data;
}
