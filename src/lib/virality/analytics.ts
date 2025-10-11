import { supabase } from "@/integrations/supabase/client";

export interface ViralCoefficient {
  k_factor: number;
  total_shares: number;
  unique_tokens: number;
  new_tokens: number;
  date?: string;
}

export interface CycleTime {
  from_level: number;
  to_level: number;
  avg_hours: number;
  min_hours: number;
  max_hours: number;
  median_hours: number;
}

export interface ConversionFunnel {
  scans: number;
  views: number;
  shares: number;
  scan_to_view_rate: number;
  view_to_share_rate: number;
  overall_conversion_rate: number;
}

export interface AmplificationData {
  level: number;
  token_count: number;
  parent_count: number;
  branching_factor: number;
}

export interface EngagementByLevel {
  level: number;
  scans: number;
  views: number;
  shares: number;
  unique_tokens: number;
}

export interface GeographicPoint {
  latitude: number;
  longitude: number;
  city: string;
  region: string;
  country: string;
  level: number;
  event_count: number;
}

export interface ContentPerformance {
  utm_content: string;
  scans: number;
  views: number;
  shares: number;
  k_factor: number;
  share_rate: number;
}

/**
 * Calculate viral coefficient (K-factor) for a campaign
 * K = (shares per user) × (conversion rate from share to new user)
 */
export async function getViralCoefficient(
  campaignId: string,
  dateRange?: { start: string; end: string },
  dataSource: "real" | "simulated" | "both" = "both"
): Promise<ViralCoefficient> {
  // Get all tokens for this campaign
  let tokensQuery = supabase
    .from("tokens")
    .select("token, level, minted_at, is_simulated")
    .eq("utm_campaign", campaignId);

  if (dataSource === "real") {
    tokensQuery = tokensQuery.eq("is_simulated", false);
  } else if (dataSource === "simulated") {
    tokensQuery = tokensQuery.eq("is_simulated", true);
  }

  if (dateRange) {
    tokensQuery = tokensQuery
      .gte("minted_at", dateRange.start)
      .lte("minted_at", dateRange.end);
  }

  const { data: tokens, error: tokensError } = await tokensQuery;
  if (tokensError) throw tokensError;

  // Get share events
  const tokenList = tokens?.map((t) => t.token) || [];
  if (tokenList.length === 0) {
    return {
      k_factor: 0,
      total_shares: 0,
      unique_tokens: 0,
      new_tokens: 0,
    };
  }

  let shareQuery = supabase
    .from("url_events")
    .select("token, is_simulated")
    .in("token", tokenList)
    .eq("event_type", "share");

  if (dataSource === "real") {
    shareQuery = shareQuery.eq("is_simulated", false);
  } else if (dataSource === "simulated") {
    shareQuery = shareQuery.eq("is_simulated", true);
  }

  const { data: shareEvents, error: shareError } = await shareQuery;

  if (shareError) throw shareError;

  const total_shares = shareEvents?.length || 0;
  const unique_tokens = new Set(tokens?.map((t) => t.token)).size;
  const new_tokens = tokens?.filter((t) => t.level > 0).length || 0;

  const shares_per_user = unique_tokens > 0 ? total_shares / unique_tokens : 0;
  const conversion_rate = total_shares > 0 ? new_tokens / total_shares : 0;
  const k_factor = shares_per_user * conversion_rate;

  return {
    k_factor,
    total_shares,
    unique_tokens,
    new_tokens,
  };
}

/**
 * Calculate viral cycle time - average time between level transitions
 */
export async function getViralCycleTime(
  campaignId: string,
  dataSource: "real" | "simulated" | "both" = "both"
): Promise<CycleTime[]> {
  let tokensQuery = supabase
    .from("tokens")
    .select("token, parent_token, level, minted_at, is_simulated")
    .eq("utm_campaign", campaignId)
    .not("parent_token", "is", null)
    .order("minted_at");

  if (dataSource === "real") {
    tokensQuery = tokensQuery.eq("is_simulated", false);
  } else if (dataSource === "simulated") {
    tokensQuery = tokensQuery.eq("is_simulated", true);
  }

  const { data: tokens, error } = await tokensQuery;

  if (error) throw error;

  // Build parent lookup
  const tokenMap = new Map(
    tokens?.map((t) => [t.token, { level: t.level, minted_at: t.minted_at }])
  );

  // Calculate time differences
  const transitions: { [key: string]: number[] } = {};

  tokens?.forEach((child) => {
    if (!child.parent_token) return;
    const parent = tokenMap.get(child.parent_token);
    if (!parent) return;

    const key = `${parent.level}-${child.level}`;
    const hoursDiff =
      (new Date(child.minted_at).getTime() -
        new Date(parent.minted_at).getTime()) /
      (1000 * 60 * 60);

    if (!transitions[key]) transitions[key] = [];
    transitions[key].push(hoursDiff);
  });

  // Calculate statistics for each transition
  const results: CycleTime[] = [];
  Object.entries(transitions).forEach(([key, times]) => {
    const [from, to] = key.split("-").map(Number);
    times.sort((a, b) => a - b);

    results.push({
      from_level: from,
      to_level: to,
      avg_hours: times.reduce((a, b) => a + b, 0) / times.length,
      min_hours: times[0],
      max_hours: times[times.length - 1],
      median_hours: times[Math.floor(times.length / 2)],
    });
  });

  return results;
}

/**
 * Get conversion funnel data (scans -> views -> shares)
 */
export async function getConversionFunnel(
  campaignId: string,
  dateRange?: { start: string; end: string },
  dataSource: "real" | "simulated" | "both" = "both"
): Promise<ConversionFunnel> {
  // Get tokens for campaign
  let tokensQuery = supabase
    .from("tokens")
    .select("token, is_simulated")
    .eq("utm_campaign", campaignId);

  if (dataSource === "real") {
    tokensQuery = tokensQuery.eq("is_simulated", false);
  } else if (dataSource === "simulated") {
    tokensQuery = tokensQuery.eq("is_simulated", true);
  }

  const { data: tokens } = await tokensQuery;

  const tokenList = tokens?.map((t) => t.token) || [];
  if (tokenList.length === 0) {
    return {
      scans: 0,
      views: 0,
      shares: 0,
      scan_to_view_rate: 0,
      view_to_share_rate: 0,
      overall_conversion_rate: 0,
    };
  }

  // Get events
  let eventsQuery = supabase
    .from("url_events")
    .select("event_type, is_simulated")
    .in("token", tokenList);

  if (dataSource === "real") {
    eventsQuery = eventsQuery.eq("is_simulated", false);
  } else if (dataSource === "simulated") {
    eventsQuery = eventsQuery.eq("is_simulated", true);
  }

  if (dateRange) {
    eventsQuery = eventsQuery
      .gte("occurred_at", dateRange.start)
      .lte("occurred_at", dateRange.end);
  }

  const { data: events, error } = await eventsQuery;
  if (error) throw error;

  const scans = events?.filter((e) => e.event_type === "scan").length || 0;
  const views = events?.filter((e) => e.event_type === "view").length || 0;
  const shares = events?.filter((e) => e.event_type === "share").length || 0;

  const scan_to_view_rate = scans > 0 ? (views / scans) * 100 : 0;
  const view_to_share_rate = views > 0 ? (shares / views) * 100 : 0;
  const overall_conversion_rate = scans > 0 ? (shares / scans) * 100 : 0;

  return {
    scans,
    views,
    shares,
    scan_to_view_rate,
    view_to_share_rate,
    overall_conversion_rate,
  };
}

/**
 * Get amplification data by level (branching factor)
 */
export async function getAmplificationByLevel(
  campaignId: string,
  dataSource: "real" | "simulated" | "both" = "both"
): Promise<AmplificationData[]> {
  let tokensQuery = supabase
    .from("tokens")
    .select("token, parent_token, level, is_simulated")
    .eq("utm_campaign", campaignId);

  if (dataSource === "real") {
    tokensQuery = tokensQuery.eq("is_simulated", false);
  } else if (dataSource === "simulated") {
    tokensQuery = tokensQuery.eq("is_simulated", true);
  }

  const { data: tokens, error } = await tokensQuery;

  if (error) throw error;

  // Group by level
  const levelMap = new Map<number, { tokens: Set<string>; parents: Set<string> }>();

  tokens?.forEach((t) => {
    if (!levelMap.has(t.level)) {
      levelMap.set(t.level, { tokens: new Set(), parents: new Set() });
    }
    const data = levelMap.get(t.level)!;
    data.tokens.add(t.token);
    if (t.parent_token) data.parents.add(t.parent_token);
  });

  const results: AmplificationData[] = [];
  levelMap.forEach((data, level) => {
    const token_count = data.tokens.size;
    const parent_count = data.parents.size;
    const branching_factor = parent_count > 0 ? token_count / parent_count : 0;

    results.push({
      level,
      token_count,
      parent_count,
      branching_factor,
    });
  });

  return results.sort((a, b) => a.level - b.level);
}

/**
 * Get engagement metrics by level
 */
export async function getEngagementByLevel(
  campaignId: string,
  dateRange?: { start: string; end: string },
  dataSource: "real" | "simulated" | "both" = "both"
): Promise<EngagementByLevel[]> {
  let tokensQuery = supabase
    .from("tokens")
    .select("token, level, is_simulated")
    .eq("utm_campaign", campaignId);

  if (dataSource === "real") {
    tokensQuery = tokensQuery.eq("is_simulated", false);
  } else if (dataSource === "simulated") {
    tokensQuery = tokensQuery.eq("is_simulated", true);
  }

  const { data: tokens } = await tokensQuery;

  const tokensByLevel = new Map<number, string[]>();
  tokens?.forEach((t) => {
    if (!tokensByLevel.has(t.level)) tokensByLevel.set(t.level, []);
    tokensByLevel.get(t.level)!.push(t.token);
  });

  const results: EngagementByLevel[] = [];

  for (const [level, tokenList] of tokensByLevel.entries()) {
    let eventsQuery = supabase
      .from("url_events")
      .select("event_type, is_simulated")
      .in("token", tokenList);

    if (dataSource === "real") {
      eventsQuery = eventsQuery.eq("is_simulated", false);
    } else if (dataSource === "simulated") {
      eventsQuery = eventsQuery.eq("is_simulated", true);
    }

    if (dateRange) {
      eventsQuery = eventsQuery
        .gte("occurred_at", dateRange.start)
        .lte("occurred_at", dateRange.end);
    }

    const { data: events } = await eventsQuery;

    results.push({
      level,
      scans: events?.filter((e) => e.event_type === "scan").length || 0,
      views: events?.filter((e) => e.event_type === "view").length || 0,
      shares: events?.filter((e) => e.event_type === "share").length || 0,
      unique_tokens: tokenList.length,
    });
  }

  return results.sort((a, b) => a.level - b.level);
}

/**
 * Get geographic spread data
 */
export async function getGeographicSpread(
  campaignId: string,
  level?: number,
  dataSource: "real" | "simulated" | "both" = "both"
): Promise<GeographicPoint[]> {
  let tokensQuery = supabase
    .from("tokens")
    .select("token, level, is_simulated")
    .eq("utm_campaign", campaignId);

  if (dataSource === "real") {
    tokensQuery = tokensQuery.eq("is_simulated", false);
  } else if (dataSource === "simulated") {
    tokensQuery = tokensQuery.eq("is_simulated", true);
  }

  const { data: tokens } = await tokensQuery;

  let tokenList = tokens?.map((t) => t.token) || [];
  
  if (level !== undefined) {
    tokenList = tokens?.filter((t) => t.level === level).map((t) => t.token) || [];
  }

  if (tokenList.length === 0) return [];

  let eventsQuery = supabase
    .from("url_events")
    .select("latitude, longitude, city, region, country, token, is_simulated")
    .in("token", tokenList)
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (dataSource === "real") {
    eventsQuery = eventsQuery.eq("is_simulated", false);
  } else if (dataSource === "simulated") {
    eventsQuery = eventsQuery.eq("is_simulated", true);
  }

  const { data: events, error } = await eventsQuery;

  if (error) throw error;

  // Aggregate by location
  const locationMap = new Map<string, GeographicPoint>();

  events?.forEach((e) => {
    const token = tokens?.find((t) => t.token === e.token);
    const key = `${e.latitude},${e.longitude}`;
    
    if (!locationMap.has(key)) {
      locationMap.set(key, {
        latitude: Number(e.latitude),
        longitude: Number(e.longitude),
        city: e.city || "Unknown",
        region: e.region || "",
        country: e.country || "",
        level: token?.level || 0,
        event_count: 0,
      });
    }
    
    locationMap.get(key)!.event_count++;
  });

  return Array.from(locationMap.values());
}

/**
 * Get top performing content by utm_content
 */
export async function getTopPerformingContent(
  campaignId: string,
  metric: "shares" | "views" | "viral_coefficient" = "shares",
  dataSource: "real" | "simulated" | "both" = "both"
): Promise<ContentPerformance[]> {
  let tokensQuery = supabase
    .from("tokens")
    .select("token, utm_content, is_simulated")
    .eq("utm_campaign", campaignId);

  if (dataSource === "real") {
    tokensQuery = tokensQuery.eq("is_simulated", false);
  } else if (dataSource === "simulated") {
    tokensQuery = tokensQuery.eq("is_simulated", true);
  }

  const { data: tokens } = await tokensQuery;

  const contentMap = new Map<string, string[]>();
  tokens?.forEach((t) => {
    const content = t.utm_content || "no-content";
    if (!contentMap.has(content)) contentMap.set(content, []);
    contentMap.get(content)!.push(t.token);
  });

  const results: ContentPerformance[] = [];

  for (const [content, tokenList] of contentMap.entries()) {
    let eventsQuery = supabase
      .from("url_events")
      .select("event_type, is_simulated")
      .in("token", tokenList);

    if (dataSource === "real") {
      eventsQuery = eventsQuery.eq("is_simulated", false);
    } else if (dataSource === "simulated") {
      eventsQuery = eventsQuery.eq("is_simulated", true);
    }

    const { data: events } = await eventsQuery;

    const scans = events?.filter((e) => e.event_type === "scan").length || 0;
    const views = events?.filter((e) => e.event_type === "view").length || 0;
    const shares = events?.filter((e) => e.event_type === "share").length || 0;

    const share_rate = views > 0 ? (shares / views) * 100 : 0;
    const k_factor = tokenList.length > 0 ? shares / tokenList.length : 0;

    results.push({
      utm_content: content,
      scans,
      views,
      shares,
      k_factor,
      share_rate,
    });
  }

  // Sort by metric
  results.sort((a, b) => {
    if (metric === "viral_coefficient") return b.k_factor - a.k_factor;
    return b[metric] - a[metric];
  });

  return results;
}
