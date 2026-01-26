import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatInTimeZone } from "date-fns-tz";
import { LiveMetricKey } from "@/types/viralTemplates";

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

const METRIC_LABELS: Record<LiveMetricKey, string> = {
  manual_entry: "Manual Entry",
  seeds: "Seeds (L00 count)",
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
};

// Get viewer's browser timezone
const getViewerTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "America/New_York";
  }
};

// Format timestamp in viewer's local timezone with indicator
const formatLocalTimestamp = (isoString: string, includeDate = true): string => {
  const tz = getViewerTimezone();
  const format = includeDate ? "MMM d, yyyy h:mm a zzz" : "h:mm a zzz";
  // Parse the UTC timestamp and format to local timezone
  return formatInTimeZone(new Date(isoString), tz, format);
};

export interface UseLiveMetricsResult {
  metrics: MetricResult[];
  metricsMap: Record<string, string | number>;
  loading: boolean;
  error: string | null;
  resolveMetrics: (campaignIdOrCode: string, mobilizeId?: string) => Promise<void>;
}

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
      // Fetch campaign - try by ID first, then by code
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignIdOrCode);
      
      let campaign: Campaign | null = null;
      
      if (isUuid) {
        const { data, error: err } = await supabase
          .from("campaigns")
          .select("id, title, code")
          .eq("id", campaignIdOrCode)
          .maybeSingle();
        if (err) throw err;
        campaign = data;
      } else {
        const { data, error: err } = await supabase
          .from("campaigns")
          .select("id, title, code")
          .eq("code", campaignIdOrCode)
          .maybeSingle();
        if (err) throw err;
        campaign = data;
      }

      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignIdOrCode}`);
      }

      // Use viewer's browser timezone for all time formatting
      const viewerTimezone = getViewerTimezone();

      // Query tokens for this campaign
      const { data: tokens, error: tokensError } = await supabase
        .from("tokens")
        .select("token, level, utm_medium")
        .eq("utm_campaign", campaign.code)
        .is("deleted_at", null);
      
      if (tokensError) throw tokensError;

      // Query url_events for these tokens
      const tokenStrings = tokens?.map(t => t.token) || [];
      let events: any[] = [];
      let firstOpenTimestamp: string | null = null;
      
      if (tokenStrings.length > 0) {
        const { data: eventsData, error: eventsError } = await supabase
          .from("url_events")
          .select("event_type, country_code, zip_code, utm_snapshot, occurred_at")
          .in("token", tokenStrings)
          .is("deleted_at", null);
        
        if (eventsError) throw eventsError;
        events = eventsData || [];
        
        // Find earliest view event timestamp
        const viewEvents = events.filter(e => e.event_type === "view" && e.occurred_at);
        if (viewEvents.length > 0) {
          viewEvents.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
          firstOpenTimestamp = viewEvents[0].occurred_at;
        }
      }

      // Calculate metrics
      const metricResults: MetricResult[] = [];
      
      // L00 count (seeds)
      const l00Count = tokens?.filter(t => t.level === 0).length || 0;
      metricResults.push({ key: "seeds", label: METRIC_LABELS.seeds, value: l00Count, source: "tokens" });

      // L01-L03 counts
      const l01Count = tokens?.filter(t => t.level === 1).length || 0;
      const l02Count = tokens?.filter(t => t.level === 2).length || 0;
      const l03Count = tokens?.filter(t => t.level === 3).length || 0;
      
      metricResults.push({ key: "l01_count", label: METRIC_LABELS.l01_count, value: l01Count, source: "tokens" });
      metricResults.push({ key: "l02_count", label: METRIC_LABELS.l02_count, value: l02Count, source: "tokens" });
      metricResults.push({ key: "l03_count", label: METRIC_LABELS.l03_count, value: l03Count, source: "tokens" });

      // Shares (L01+ tokens)
      const sharesCount = tokens?.filter(t => t.level > 0).length || 0;
      metricResults.push({ key: "shares", label: METRIC_LABELS.shares, value: sharesCount, source: "tokens" });

      // Opens (view events)
      const opensCount = events.filter(e => e.event_type === "view").length;
      metricResults.push({ key: "opens", label: METRIC_LABELS.opens, value: opensCount, source: "url_events" });

      // Opens by location
      const opensUS = events.filter(e => e.event_type === "view" && e.country_code === "US").length;
      const opensIntl = events.filter(e => e.event_type === "view" && e.country_code && e.country_code !== "US").length;
      metricResults.push({ key: "opens_us", label: METRIC_LABELS.opens_us, value: opensUS, source: "url_events" });
      metricResults.push({ key: "opens_intl", label: METRIC_LABELS.opens_intl, value: opensIntl, source: "url_events" });

      // Opens by medium
      const viewEvents = events.filter(e => e.event_type === "view");
      const opensQR = viewEvents.filter(e => (e.utm_snapshot as any)?.utm_medium === "qr").length;
      const opensText = viewEvents.filter(e => ["sms", "text"].includes((e.utm_snapshot as any)?.utm_medium)).length;
      const opensMail = viewEvents.filter(e => ["email", "mail"].includes((e.utm_snapshot as any)?.utm_medium)).length;
      
      metricResults.push({ key: "opens_qr", label: METRIC_LABELS.opens_qr, value: opensQR, source: "url_events" });
      metricResults.push({ key: "opens_text", label: METRIC_LABELS.opens_text, value: opensText, source: "url_events" });
      metricResults.push({ key: "opens_mail", label: METRIC_LABELS.opens_mail, value: opensMail, source: "url_events" });

      // Neighborhoods (distinct zip codes)
      const distinctZips = new Set(events.filter(e => e.zip_code).map(e => e.zip_code));
      metricResults.push({ key: "neighborhoods", label: METRIC_LABELS.neighborhoods, value: distinctZips.size, source: "url_events" });

      // Max depth
      const maxDepth = tokens && tokens.length > 0 ? Math.max(...tokens.map(t => t.level)) : 0;
      metricResults.push({ key: "depth", label: METRIC_LABELS.depth, value: maxDepth, source: "tokens" });

      // Viral coefficient
      const viralCoef = l00Count > 0 ? (sharesCount / l00Count).toFixed(2) : "0.00";
      metricResults.push({ key: "viral_coefficient", label: METRIC_LABELS.viral_coefficient, value: viralCoef, source: "calculated" });

      // Campaign name
      metricResults.push({ key: "campaign_name", label: METRIC_LABELS.campaign_name, value: campaign.title, source: "campaigns" });

      // Date/time metrics - use viewer's local timezone with indicator
      const now = new Date();
      const viewerTz = getViewerTimezone();
      metricResults.push({ key: "current_date", label: METRIC_LABELS.current_date, value: formatInTimeZone(now, viewerTz, "MMM d, yyyy zzz"), source: "current" });
      metricResults.push({ key: "current_time", label: METRIC_LABELS.current_time, value: formatInTimeZone(now, viewerTz, "h:mm a zzz"), source: "current" });

      // Earliest active - first event timestamp in viewer's local timezone
      if (firstOpenTimestamp) {
        metricResults.push({ key: "earliest_active", label: METRIC_LABELS.earliest_active, value: formatLocalTimestamp(firstOpenTimestamp), source: "url_events" });
      } else {
        metricResults.push({ key: "earliest_active", label: METRIC_LABELS.earliest_active, value: "(no activity)", source: "url_events" });
      }

      // Latest active - most recent event timestamp in viewer's local timezone
      const viewEventsWithTime = events.filter(e => e.event_type === "view" && e.occurred_at);
      if (viewEventsWithTime.length > 0) {
        viewEventsWithTime.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
        metricResults.push({ key: "latest_active", label: METRIC_LABELS.latest_active, value: formatLocalTimestamp(viewEventsWithTime[0].occurred_at), source: "url_events" });
      } else {
        metricResults.push({ key: "latest_active", label: METRIC_LABELS.latest_active, value: "(no activity)", source: "url_events" });
      }

      setMetrics(metricResults);
    } catch (err) {
      console.error("useLiveMetrics error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a lookup map
  const metricsMap = metrics.reduce((acc, m) => {
    // Format numeric values with locale separators
    const val = typeof m.value === "number" ? m.value.toLocaleString() : m.value;
    acc[m.key] = val;
    return acc;
  }, {} as Record<string, string | number>);

  return { metrics, metricsMap, loading, error, resolveMetrics };
}
