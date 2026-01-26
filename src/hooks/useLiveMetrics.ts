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

interface EOA {
  id: string;
  title: string;
  timezone: string | null;
  start_date: string | null;
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
  start_date: "Start Date",
  current_date: "Current Date",
  start_time: "Start Time",
  current_time: "Current Time",
  first_open: "First Open",
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

      // Fetch EOA for timezone and start date
      // If mobilizeId is provided, look up by mobilize_id; otherwise use first EOA
      let eoa: EOA | null = null;
      
      if (mobilizeId?.trim()) {
        const { data: eoaData, error: eoaErr } = await supabase
          .from("events_actions")
          .select("id, title, timezone, start_date")
          .eq("campaign_id", campaign.id)
          .eq("mobilize_id", mobilizeId.trim())
          .maybeSingle();
        
        if (eoaErr) throw eoaErr;
        eoa = eoaData;
      } else {
        // Fall back to first EOA for this campaign
        const { data: eoaData, error: eoaErr } = await supabase
          .from("events_actions")
          .select("id, title, timezone, start_date")
          .eq("campaign_id", campaign.id)
          .order("start_date", { ascending: true })
          .limit(1)
          .maybeSingle();
        
        if (eoaErr) throw eoaErr;
        eoa = eoaData;
      }

      const timezone = eoa?.timezone || "America/New_York";

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

      // Date/time metrics
      const now = new Date();
      metricResults.push({ key: "current_date", label: METRIC_LABELS.current_date, value: formatInTimeZone(now, timezone, "MMM d, yyyy"), source: "current" });
      metricResults.push({ key: "current_time", label: METRIC_LABELS.current_time, value: formatInTimeZone(now, timezone, "h:mm a"), source: "current" });

      // Start date/time from EOA
      if (eoa?.start_date) {
        const match = eoa.start_date.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        if (match) {
          const [, year, month, day, hour, minute] = match;
          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const monthIdx = parseInt(month, 10) - 1;
          const hourNum = parseInt(hour, 10);
          const ampm = hourNum >= 12 ? "PM" : "AM";
          const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
          
          metricResults.push({ key: "start_date", label: METRIC_LABELS.start_date, value: `${monthNames[monthIdx]} ${parseInt(day, 10)}, ${year}`, source: "events_actions" });
          metricResults.push({ key: "start_time", label: METRIC_LABELS.start_time, value: `${hour12}:${minute} ${ampm}`, source: "events_actions" });
        }
      } else {
        metricResults.push({ key: "start_date", label: METRIC_LABELS.start_date, value: "(no EOA)", source: "events_actions" });
        metricResults.push({ key: "start_time", label: METRIC_LABELS.start_time, value: "(no EOA)", source: "events_actions" });
      }

      // First open - earliest view event timestamp
      if (firstOpenTimestamp) {
        const firstOpenDate = new Date(firstOpenTimestamp);
        const formattedFirstOpen = formatInTimeZone(firstOpenDate, timezone, "MMM d, yyyy h:mm a");
        metricResults.push({ key: "first_open", label: METRIC_LABELS.first_open, value: formattedFirstOpen, source: "url_events" });
      } else {
        metricResults.push({ key: "first_open", label: METRIC_LABELS.first_open, value: "(no activity)", source: "url_events" });
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
