import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, Database, AlertCircle } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { LiveMetricKey } from "@/types/viralTemplates";

interface DataTemplate {
  id: string;
  name: string | null;
  slug: string;
  hotspots: any[] | null;
}

interface Campaign {
  id: string;
  title: string;
  code: string;
}

interface EOA {
  id: string;
  title: string;
  utm_id: string;
  mobilize_id: string | null;
  timezone: string | null;
  start_date: string | null;
  campaign_id: string;
}

interface MetricResult {
  key: LiveMetricKey;
  label: string;
  value: string | number;
  source: string;
  rawQuery?: string;
}

const METRIC_LABELS: Record<LiveMetricKey, string> = {
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
};

export default function DataTemplateTestHarness() {
  // Selection state
  const [templates, setTemplates] = useState<DataTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [eoas, setEoas] = useState<EOA[]>([]);
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [selectedEoaId, setSelectedEoaId] = useState<string>("");
  
  // Manual override inputs
  const [manualCampaignId, setManualCampaignId] = useState<string>("");
  const [manualMobilizeId, setManualMobilizeId] = useState<string>("");
  
  // Results
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [results, setResults] = useState<MetricResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoadingData(true);
      try {
        // Load data templates (stats_page type)
        const { data: templatesData, error: templatesError } = await supabase
          .from("viral_slide_configs")
          .select("id, name, slug, hotspots")
          .eq("template_type", "stats_page")
          .order("name");
        
        if (templatesError) throw templatesError;
        setTemplates((templatesData || []).map(t => ({
          ...t,
          hotspots: Array.isArray(t.hotspots) ? t.hotspots : []
        })));

        // Load campaigns
        const { data: campaignsData, error: campaignsError } = await supabase
          .from("campaigns")
          .select("id, title, code")
          .order("title");
        
        if (campaignsError) throw campaignsError;
        setCampaigns(campaignsData || []);

        // Load EOAs
        const { data: eoasData, error: eoasError } = await supabase
          .from("events_actions")
          .select("id, title, utm_id, mobilize_id, timezone, start_date, campaign_id")
          .order("title");
        
        if (eoasError) throw eoasError;
        setEoas(eoasData || []);
      } catch (err) {
        console.error("Failed to load data:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingData(false);
      }
    };
    
    loadData();
  }, []);

  // Filter EOAs when campaign changes
  const filteredEoas = selectedCampaignId 
    ? eoas.filter(e => e.campaign_id === selectedCampaignId)
    : eoas;

  // Get selected items
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const selectedCampaign = campaigns.find(c => c.id === (manualCampaignId || selectedCampaignId));
  const selectedEoa = eoas.find(e => 
    manualMobilizeId 
      ? e.mobilize_id === manualMobilizeId 
      : e.id === selectedEoaId
  );

  const runTest = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    setDebugInfo(null);

    console.log("🧪 DATA TEMPLATE TEST: Starting...");
    
    try {
      // Determine which campaign and EOA to use
      const campaignIdOrCode = manualCampaignId || selectedCampaignId;
      const eoaId = selectedEoaId;
      const mobilizeId = manualMobilizeId || selectedEoa?.mobilize_id;
      
      if (!campaignIdOrCode) {
        throw new Error("Please select or enter a Campaign ID or code");
      }

      console.log("🧪 TEST: Using parameters:", { campaignIdOrCode, eoaId, mobilizeId });

      // Fetch campaign details - try by ID first, then by code
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignIdOrCode);
      
      let campaign: any = null;
      let campaignError: any = null;
      
      if (isUuid) {
        const result = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", campaignIdOrCode)
          .maybeSingle();
        campaign = result.data;
        campaignError = result.error;
      } else {
        // Try by code
        const result = await supabase
          .from("campaigns")
          .select("*")
          .eq("code", campaignIdOrCode)
          .maybeSingle();
        campaign = result.data;
        campaignError = result.error;
      }
      
      if (campaignError) throw new Error(campaignError.message || JSON.stringify(campaignError));
      if (!campaign) throw new Error(`Campaign not found: ${campaignIdOrCode} (searched by ${isUuid ? 'UUID' : 'code'})`);
      
      console.log("🧪 TEST: Campaign loaded:", campaign);

      // Fetch EOA details (for timezone)
      let eoa: EOA | null = null;
      if (eoaId) {
        const { data: eoaData, error: eoaError } = await supabase
          .from("events_actions")
          .select("*")
          .eq("id", eoaId)
          .maybeSingle();
        
        if (eoaError) throw eoaError;
        eoa = eoaData;
        console.log("🧪 TEST: EOA loaded:", eoa);
      } else if (mobilizeId) {
        const { data: eoaData, error: eoaError } = await supabase
          .from("events_actions")
          .select("*")
          .eq("mobilize_id", mobilizeId)
          .maybeSingle();
        
        if (eoaError) throw eoaError;
        eoa = eoaData;
        console.log("🧪 TEST: EOA loaded via mobilize_id:", eoa);
      }

      const timezone = eoa?.timezone || "America/New_York";
      console.log("🧪 TEST: Using timezone:", timezone);

      // Query tokens for this campaign
      const { data: tokens, error: tokensError } = await supabase
        .from("tokens")
        .select("token, level, utm_medium")
        .eq("utm_campaign", campaign.code)
        .is("deleted_at", null);
      
      if (tokensError) throw tokensError;
      console.log("🧪 TEST: Tokens loaded:", tokens?.length || 0);

      // Query url_events for these tokens
      const tokenStrings = tokens?.map(t => t.token) || [];
      let events: any[] = [];
      
      if (tokenStrings.length > 0) {
        const { data: eventsData, error: eventsError } = await supabase
          .from("url_events")
          .select("event_type, country_code, zip_code, utm_snapshot")
          .in("token", tokenStrings)
          .is("deleted_at", null);
        
        if (eventsError) throw eventsError;
        events = eventsData || [];
        console.log("🧪 TEST: Events loaded:", events.length);
      }

      // Calculate metrics
      const metricResults: MetricResult[] = [];
      
      // L00 count (seeds)
      const l00Count = tokens?.filter(t => t.level === 0).length || 0;
      metricResults.push({
        key: "seeds",
        label: METRIC_LABELS.seeds,
        value: l00Count,
        source: `tokens WHERE utm_campaign='${campaign.code}' AND level=0`,
      });

      // L01-L03 counts
      const l01Count = tokens?.filter(t => t.level === 1).length || 0;
      const l02Count = tokens?.filter(t => t.level === 2).length || 0;
      const l03Count = tokens?.filter(t => t.level === 3).length || 0;
      
      metricResults.push({
        key: "l01_count",
        label: METRIC_LABELS.l01_count,
        value: l01Count,
        source: `tokens WHERE level=1`,
      });
      metricResults.push({
        key: "l02_count",
        label: METRIC_LABELS.l02_count,
        value: l02Count,
        source: `tokens WHERE level=2`,
      });
      metricResults.push({
        key: "l03_count",
        label: METRIC_LABELS.l03_count,
        value: l03Count,
        source: `tokens WHERE level=3`,
      });

      // Shares (L01+ tokens)
      const sharesCount = tokens?.filter(t => t.level > 0).length || 0;
      metricResults.push({
        key: "shares",
        label: METRIC_LABELS.shares,
        value: sharesCount,
        source: `tokens WHERE level > 0`,
      });

      // Opens (view events)
      const opensCount = events.filter(e => e.event_type === "view").length;
      metricResults.push({
        key: "opens",
        label: METRIC_LABELS.opens,
        value: opensCount,
        source: `url_events WHERE event_type='view'`,
      });

      // Opens by location
      const opensUS = events.filter(e => e.event_type === "view" && e.country_code === "US").length;
      const opensIntl = events.filter(e => e.event_type === "view" && e.country_code && e.country_code !== "US").length;
      metricResults.push({
        key: "opens_us",
        label: METRIC_LABELS.opens_us,
        value: opensUS,
        source: `url_events WHERE event_type='view' AND country_code='US'`,
      });
      metricResults.push({
        key: "opens_intl",
        label: METRIC_LABELS.opens_intl,
        value: opensIntl,
        source: `url_events WHERE event_type='view' AND country_code!='US'`,
      });

      // Opens by medium (from utm_snapshot or token's utm_medium)
      const viewEvents = events.filter(e => e.event_type === "view");
      const opensQR = viewEvents.filter(e => {
        const snapshot = e.utm_snapshot as any;
        return snapshot?.utm_medium === "qr";
      }).length;
      const opensText = viewEvents.filter(e => {
        const snapshot = e.utm_snapshot as any;
        return snapshot?.utm_medium === "sms" || snapshot?.utm_medium === "text";
      }).length;
      const opensMail = viewEvents.filter(e => {
        const snapshot = e.utm_snapshot as any;
        return snapshot?.utm_medium === "email" || snapshot?.utm_medium === "mail";
      }).length;
      
      metricResults.push({
        key: "opens_qr",
        label: METRIC_LABELS.opens_qr,
        value: opensQR,
        source: `url_events WHERE utm_snapshot.utm_medium='qr'`,
      });
      metricResults.push({
        key: "opens_text",
        label: METRIC_LABELS.opens_text,
        value: opensText,
        source: `url_events WHERE utm_snapshot.utm_medium='sms'/'text'`,
      });
      metricResults.push({
        key: "opens_mail",
        label: METRIC_LABELS.opens_mail,
        value: opensMail,
        source: `url_events WHERE utm_snapshot.utm_medium='email'/'mail'`,
      });

      // Neighborhoods (distinct zip codes)
      const distinctZips = new Set(events.filter(e => e.zip_code).map(e => e.zip_code));
      metricResults.push({
        key: "neighborhoods",
        label: METRIC_LABELS.neighborhoods,
        value: distinctZips.size,
        source: `DISTINCT zip_code from url_events`,
      });

      // Max depth
      const maxDepth = tokens && tokens.length > 0 
        ? Math.max(...tokens.map(t => t.level))
        : 0;
      metricResults.push({
        key: "depth",
        label: METRIC_LABELS.depth,
        value: maxDepth,
        source: `MAX(level) from tokens`,
      });

      // Viral coefficient (simplified: shares / seeds, or 0 if no seeds)
      const viralCoef = l00Count > 0 ? (sharesCount / l00Count).toFixed(2) : "0.00";
      metricResults.push({
        key: "viral_coefficient",
        label: METRIC_LABELS.viral_coefficient,
        value: viralCoef,
        source: `shares / seeds = ${sharesCount} / ${l00Count}`,
      });

      // Campaign name
      metricResults.push({
        key: "campaign_name",
        label: METRIC_LABELS.campaign_name,
        value: campaign.title,
        source: `campaigns.title`,
      });

      // Date/time metrics using timezone
      const now = new Date();
      
      metricResults.push({
        key: "current_date",
        label: METRIC_LABELS.current_date,
        value: formatInTimeZone(now, timezone, "MMM d, yyyy"),
        source: `Current date in ${timezone}`,
      });
      
      metricResults.push({
        key: "current_time",
        label: METRIC_LABELS.current_time,
        value: formatInTimeZone(now, timezone, "h:mm a"),
        source: `Current time in ${timezone}`,
      });

      // Start date/time from EOA
      if (eoa?.start_date) {
        // Parse floating local time (wall clock)
        const match = eoa.start_date.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        if (match) {
          const [, year, month, day, hour, minute] = match;
          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const monthIdx = parseInt(month, 10) - 1;
          const hourNum = parseInt(hour, 10);
          const ampm = hourNum >= 12 ? "PM" : "AM";
          const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
          
          metricResults.push({
            key: "start_date",
            label: METRIC_LABELS.start_date,
            value: `${monthNames[monthIdx]} ${parseInt(day, 10)}, ${year}`,
            source: `events_actions.start_date (floating local time)`,
          });
          
          metricResults.push({
            key: "start_time",
            label: METRIC_LABELS.start_time,
            value: `${hour12}:${minute} ${ampm}`,
            source: `events_actions.start_date (floating local time)`,
          });
        }
      } else {
        metricResults.push({
          key: "start_date",
          label: METRIC_LABELS.start_date,
          value: "(no EOA selected)",
          source: "events_actions.start_date",
        });
        metricResults.push({
          key: "start_time",
          label: METRIC_LABELS.start_time,
          value: "(no EOA selected)",
          source: "events_actions.start_date",
        });
      }

      setResults(metricResults);
      setDebugInfo({
        campaign,
        eoa,
        timezone,
        tokenCount: tokens?.length || 0,
        eventCount: events.length,
        utm_campaign: campaign.code,
      });

      console.log("🧪 TEST: Complete!", metricResults);
      
    } catch (err) {
      console.error("🧪 TEST ERROR:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="container mx-auto p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Data Template Test Harness
          </CardTitle>
          <CardDescription>
            Test that Data Templates pull the correct metrics from the database with proper filtering.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Selection Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Data Template Selection */}
            <div className="space-y-2">
              <Label>Data Template (optional)</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name || t.slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground">No stats_page templates found</p>
              )}
            </div>

            {/* Campaign Selection */}
            <div className="space-y-2">
              <Label>Campaign</Label>
              <Select value={selectedCampaignId} onValueChange={(v) => {
                setSelectedCampaignId(v);
                setSelectedEoaId(""); // Reset EOA when campaign changes
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a campaign..." />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* EOA Selection */}
            <div className="space-y-2">
              <Label>EOA (for timezone)</Label>
              <Select value={selectedEoaId} onValueChange={setSelectedEoaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an EOA..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredEoas.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.title} {e.mobilize_id ? `(${e.mobilize_id})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCampaignId && filteredEoas.length === 0 && (
                <p className="text-xs text-muted-foreground">No EOAs for this campaign</p>
              )}
            </div>
          </div>

          {/* Manual Override Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
            <div className="space-y-2">
              <Label>Manual Campaign ID (overrides dropdown)</Label>
              <Input 
                placeholder="e.g., 123e4567-e89b-12d3-a456-..."
                value={manualCampaignId}
                onChange={(e) => setManualCampaignId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Manual Mobilize ID (overrides EOA dropdown)</Label>
              <Input 
                placeholder="e.g., 123456"
                value={manualMobilizeId}
                onChange={(e) => setManualMobilizeId(e.target.value)}
              />
            </div>
          </div>

          {/* Run Test Button */}
          <Button 
            onClick={runTest} 
            disabled={loading || (!selectedCampaignId && !manualCampaignId)}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running Test...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Run Metric Resolution Test
              </>
            )}
          </Button>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                <pre className="text-xs overflow-auto whitespace-pre-wrap">{error}</pre>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results Display */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resolved Metrics</CardTitle>
            <CardDescription>
              Campaign: <strong>{debugInfo?.campaign?.title}</strong> | 
              Code: <strong>{debugInfo?.utm_campaign}</strong> | 
              Timezone: <strong>{debugInfo?.timezone}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium">Metric Key</th>
                    <th className="text-left py-2 px-3 font-medium">Label</th>
                    <th className="text-left py-2 px-3 font-medium">Value</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.key} className="border-b border-border/50">
                      <td className="py-2 px-3 font-mono text-xs">{r.key}</td>
                      <td className="py-2 px-3">{r.label}</td>
                      <td className="py-2 px-3 font-semibold">{r.value}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground font-mono">{r.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Info */}
      {debugInfo && (
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">Debug Info</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-sm">How to Use</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><strong>1.</strong> Select a Campaign (required) - this determines which tokens/events are queried via <code>utm_campaign</code></p>
          <p><strong>2.</strong> Optionally select an EOA - this provides the timezone for date/time formatting and start_date/start_time values</p>
          <p><strong>3.</strong> Optionally select a Data Template - shows which metrics are configured in that template</p>
          <p><strong>4.</strong> Use manual ID inputs to test with specific Campaign IDs or Mobilize IDs</p>
          <p><strong>5.</strong> Click "Run Metric Resolution Test" to query the database and display all resolved values</p>
          <p className="pt-2 text-muted-foreground">Open browser console for detailed 🧪 TEST logs</p>
        </CardContent>
      </Card>
    </div>
  );
}
