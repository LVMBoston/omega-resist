import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatInTimeZone } from "date-fns-tz";
import { LiveMetricKey } from "@/types/viralTemplates";
import { fetchNarrativeData, generateCampaignNarrative } from "@/lib/campaignNarrative";

// ─── Types ───────────────────────────────────────────────────────────

export interface MetricResult {
  key: LiveMetricKey;
  label: string;
  value: string | number;
  source: string;
}

interface Campaign {
  id: string;
  title: string;
  code: string;
}

export interface UseLiveMetricsResult {
  metrics: MetricResult[];
  metricsMap: Record<string, string | number>;
  loading: boolean;
  error: string | null;
  resolveMetrics: (campaignIdOrCode: string, mobilizeId?: string) => Promise<void>;
}

// ─── Metric labels ───────────────────────────────────────────────────

const METRIC_LABELS: Record<LiveMetricKey, string> = {
  manual_entry: "Manual Entry",
  seeds: "Seeds (L00 count)",
  seeds_with_spawns: "Seeds with Spawns",
  shares: "Shares (L01+ count)",
  opens: "Opens (total views)",
  opens_us: "Opens US",
  opens_intl: "Opens Intl",
  opens_qr: "Opens QR",
  opens_text: "Opens Text",
  opens_mail: "Opens Mail",
  neighborhoods: "Neighborhoods (zip codes)",
  depth: "Max Depth",
  l01_count: "L01 Count",
  l02_count: "L02 Count",
  l03_count: "L03 Count",
  viral_coefficient: "Viral Coefficient",
  campaign_name: "Campaign Name",
  current_date: "Current Date",
  current_time: "Current Time",
  earliest_active: "Earliest Active",
  latest_active: "Latest Active",
  last_updated: "Last Updated",
  campaign_story: "Campaign Story",
};

// ─── Sanitization helpers ────────────────────────────────────────────

/** Strip control characters and trim whitespace */
function sanitizeText(value: string | null | undefined): string {
  if (!value) return "--";
  return value.replace(/[\x00-\x1F\x7F]/g, "").trim() || "--";
}

/** Validate timezone via Intl; fall back to UTC */
function getSafeTimezone(tz?: string | null): string {
  if (!tz) {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  }
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    console.warn(`[getSafeTimezone] Invalid timezone "${tz}", falling back to UTC`);
    return "UTC";
  }
}

/** Format a timestamp safely; returns "--" for null/invalid dates */
function formatTimestamp(
  value: string | null | undefined,
  timezone: string,
  includeDate = true
): string {
  if (!value) return "--";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "--";
    if (includeDate) {
      const datePart = formatInTimeZone(d, timezone, "MMM d, yyyy");
      const timePart = formatInTimeZone(d, timezone, "h:mm a zzz");
      return `${datePart}\n${timePart}`;
    }
    return formatInTimeZone(d, timezone, "h:mm a zzz");
  } catch {
    return "--";
  }
}

export const liveMetricSanitizers = { sanitizeText, getSafeTimezone, formatTimestamp };

// ─── Retry helper ────────────────────────────────────────────────────

async function withRetry<T>(
  queryName: string,
  operation: () => Promise<{ data: T | null; error: any }>,
  maxRetries = 3,
  initialDelay = 300
): Promise<T | null> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { data, error } = await operation();
    if (!error) return data;

    lastError = error;
    if (attempt < maxRetries) {
      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(
        `[withRetry] ${queryName} attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms:`,
        error
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  console.error(`[withRetry] ${queryName} exhausted ${maxRetries} retries`);
  throw lastError;
}

// ─── EMPTY_METRICS fallback ──────────────────────────────────────────

const NUMERIC_KEYS: LiveMetricKey[] = [
  "manual_entry", "seeds", "seeds_with_spawns", "shares", "opens",
  "opens_us", "opens_intl", "opens_qr", "opens_text", "opens_mail",
  "neighborhoods", "depth", "l01_count", "l02_count", "l03_count",
];

const TEXT_KEYS: LiveMetricKey[] = [
  "viral_coefficient", "campaign_name", "current_date", "current_time",
  "earliest_active", "latest_active", "last_updated", "campaign_story",
];

const EMPTY_METRICS: MetricResult[] = [
  ...NUMERIC_KEYS.map((key) => ({
    key,
    label: METRIC_LABELS[key],
    value: 0,
    source: "fallback",
  })),
  ...TEXT_KEYS.map((key) => ({
    key,
    label: METRIC_LABELS[key],
    value: "--",
    source: "fallback",
  })),
];

// ─── Hook ────────────────────────────────────────────────────────────

export function useLiveMetrics(): UseLiveMetricsResult {
  const [metrics, setMetrics] = useState<MetricResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveMetrics = useCallback(async (campaignIdOrCode: string, mobilizeId?: string) => {
    if (!campaignIdOrCode.trim()) {
      setMetrics([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ── Resolve campaign (with retry) ──
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignIdOrCode);

      const campaign = await withRetry<Campaign>(
        isUuid ? "campaign-by-id" : "campaign-by-code",
        async () =>
          await supabase
            .from("campaigns")
            .select("id, title, code")
            .eq(isUuid ? "id" : "code", campaignIdOrCode)
            .maybeSingle()
      );

      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignIdOrCode}`);
      }

      // Sanitize campaign title
      campaign.title = sanitizeText(campaign.title);

      // Validated viewer timezone
      const viewerTz = getSafeTimezone();

      // ── Query tokens (with retry) ──
      console.log("[useLiveMetrics] Querying tokens for campaign code:", campaign.code);
      const tokens = await withRetry<any[]>(
        "tokens",
        async () =>
          await supabase
            .from("tokens")
            .select("token, level, utm_medium")
            .eq("utm_campaign", campaign.code)
            .is("deleted_at", null)
      );
      console.log("[useLiveMetrics] Tokens found:", tokens?.length || 0);

      // ── Query events (with retry) ──
      const tokenStrings = tokens?.map((t) => t.token) || [];
      let events: any[] = [];
      let firstOpenTimestamp: string | null = null;

      if (tokenStrings.length > 0) {
        const eventsData = await withRetry<any[]>(
          "url_events",
          async () =>
            await supabase
              .from("url_events")
              .select("event_type, country_code, zip_code, utm_snapshot, occurred_at")
              .in("token", tokenStrings)
              .is("deleted_at", null)
        );
        events = eventsData || [];

        // Find earliest view event timestamp
        const viewEvents = events.filter((e) => e.event_type === "view" && e.occurred_at);
        if (viewEvents.length > 0) {
          viewEvents.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
          firstOpenTimestamp = viewEvents[0].occurred_at;
        }
      }

      // ── Compute metrics ──
      console.log("[useLiveMetrics] Calculating metrics from", tokens?.length || 0, "tokens and", events.length, "events");
      const metricResults: MetricResult[] = [];

      // L00 count (seeds)
      const l00Tokens = tokens?.filter((t) => t.level === 0) || [];
      const l00Count = l00Tokens.length;
      metricResults.push({ key: "seeds", label: METRIC_LABELS.seeds, value: l00Count, source: "tokens" });

      // Seeds with spawns (with retry)
      const l00TokenStrings = new Set(l00Tokens.map((t) => t.token));
      let seedsWithSpawnsCount = 0;
      if (l00TokenStrings.size > 0 && tokenStrings.length > 0) {
        const childTokens = await withRetry<any[]>(
          "child-tokens",
          async () =>
            await supabase
              .from("tokens")
              .select("parent_token")
              .eq("utm_campaign", campaign.code)
              .is("deleted_at", null)
              .gt("level", 0)
        );
        if (childTokens) {
          const parentsWithChildren = new Set(childTokens.map((t) => t.parent_token).filter(Boolean));
          seedsWithSpawnsCount = l00Tokens.filter((t) => parentsWithChildren.has(t.token)).length;
        }
      }
      metricResults.push({ key: "seeds_with_spawns", label: METRIC_LABELS.seeds_with_spawns, value: seedsWithSpawnsCount, source: "tokens" });

      // L01-L03 counts
      const l01Count = tokens?.filter((t) => t.level === 1).length || 0;
      const l02Count = tokens?.filter((t) => t.level === 2).length || 0;
      const l03Count = tokens?.filter((t) => t.level === 3).length || 0;
      metricResults.push({ key: "l01_count", label: METRIC_LABELS.l01_count, value: l01Count, source: "tokens" });
      metricResults.push({ key: "l02_count", label: METRIC_LABELS.l02_count, value: l02Count, source: "tokens" });
      metricResults.push({ key: "l03_count", label: METRIC_LABELS.l03_count, value: l03Count, source: "tokens" });

      // Shares (L01+ tokens)
      const sharesCount = tokens?.filter((t) => t.level > 0).length || 0;
      metricResults.push({ key: "shares", label: METRIC_LABELS.shares, value: sharesCount, source: "tokens" });

      // Opens (view events)
      const opensCount = events.filter((e) => e.event_type === "view").length;
      metricResults.push({ key: "opens", label: METRIC_LABELS.opens, value: opensCount, source: "url_events" });

      // Opens by location
      const opensUS = events.filter((e) => e.event_type === "view" && e.country_code === "US").length;
      const opensIntl = events.filter((e) => e.event_type === "view" && e.country_code && e.country_code !== "US").length;
      metricResults.push({ key: "opens_us", label: METRIC_LABELS.opens_us, value: opensUS, source: "url_events" });
      metricResults.push({ key: "opens_intl", label: METRIC_LABELS.opens_intl, value: opensIntl, source: "url_events" });

      // Opens by medium
      const viewEvents = events.filter((e) => e.event_type === "view");
      const opensQR = viewEvents.filter((e) => (e.utm_snapshot as any)?.utm_medium === "qr").length;
      const opensText = viewEvents.filter((e) => ["sms", "text"].includes((e.utm_snapshot as any)?.utm_medium)).length;
      const opensMail = viewEvents.filter((e) => ["email", "mail"].includes((e.utm_snapshot as any)?.utm_medium)).length;
      metricResults.push({ key: "opens_qr", label: METRIC_LABELS.opens_qr, value: opensQR, source: "url_events" });
      metricResults.push({ key: "opens_text", label: METRIC_LABELS.opens_text, value: opensText, source: "url_events" });
      metricResults.push({ key: "opens_mail", label: METRIC_LABELS.opens_mail, value: opensMail, source: "url_events" });

      // Neighborhoods (distinct zip codes)
      const distinctZips = new Set(events.filter((e) => e.zip_code).map((e) => e.zip_code));
      metricResults.push({ key: "neighborhoods", label: METRIC_LABELS.neighborhoods, value: distinctZips.size, source: "url_events" });

      // Max depth
      const maxDepth = tokens && tokens.length > 0 ? Math.max(...tokens.map((t) => t.level)) : 0;
      metricResults.push({ key: "depth", label: METRIC_LABELS.depth, value: maxDepth, source: "tokens" });

      // Viral coefficient
      const viralCoef = l00Count > 0 ? (sharesCount / l00Count).toFixed(2) : "0.00";
      metricResults.push({ key: "viral_coefficient", label: METRIC_LABELS.viral_coefficient, value: viralCoef, source: "calculated" });

      // Campaign name (sanitized above)
      metricResults.push({ key: "campaign_name", label: METRIC_LABELS.campaign_name, value: campaign.title, source: "campaigns" });

      // Date/time metrics — use validated viewer timezone
      const now = new Date();
      metricResults.push({ key: "current_date", label: METRIC_LABELS.current_date, value: formatInTimeZone(now, viewerTz, "MMM d, yyyy zzz"), source: "current" });
      metricResults.push({ key: "current_time", label: METRIC_LABELS.current_time, value: formatInTimeZone(now, viewerTz, "h:mm a zzz"), source: "current" });

      // last_updated (combined date + time for "Data as of:" hotspots)
      metricResults.push({
        key: "last_updated",
        label: METRIC_LABELS.last_updated,
        value: formatInTimeZone(now, viewerTz, "h:mm a zzz"),
        source: "current",
      });

      // Earliest active
      metricResults.push({
        key: "earliest_active",
        label: METRIC_LABELS.earliest_active,
        value: formatTimestamp(firstOpenTimestamp, viewerTz),
        source: "url_events",
      });

      // Latest active
      const viewEventsWithTime = events.filter((e) => e.event_type === "view" && e.occurred_at);
      let latestTimestamp: string | null = null;
      if (viewEventsWithTime.length > 0) {
        viewEventsWithTime.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
        latestTimestamp = viewEventsWithTime[0].occurred_at;
      }
      metricResults.push({
        key: "latest_active",
        label: METRIC_LABELS.latest_active,
        value: formatTimestamp(latestTimestamp, viewerTz),
        source: "url_events",
      });

      // Campaign story (headline narrative)
      try {
        const narrativeData = await fetchNarrativeData(campaign.code, campaign.id);
        const { fullStory } = generateCampaignNarrative(narrativeData);
        metricResults.push({ key: "campaign_story", label: METRIC_LABELS.campaign_story, value: fullStory, source: "narrative" });
      } catch (narrativeErr) {
        console.warn("[useLiveMetrics] campaign_story generation failed:", narrativeErr);
        metricResults.push({ key: "campaign_story", label: METRIC_LABELS.campaign_story, value: "--", source: "fallback" });
      }

      console.log("[useLiveMetrics] Final metrics count:", metricResults.length, metricResults.map((m) => m.key));
      setMetrics(metricResults);
    } catch (err) {
      console.error("[useLiveMetrics] error:", err);
      setError(err instanceof Error ? err.message : String(err));
      setMetrics(EMPTY_METRICS);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a lookup map
  const metricsMap = metrics.reduce((acc, m) => {
    const val = typeof m.value === "number" ? m.value.toLocaleString() : m.value;
    acc[m.key] = val;
    return acc;
  }, {} as Record<string, string | number>);

  return { metrics, metricsMap, loading, error, resolveMetrics };
}
