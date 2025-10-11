import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, MapPin, Smartphone, Map, Eye, Share2, Scan, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import ActivityMap from "@/components/ActivityMap";
import { MetricCard } from "@/components/virality/MetricCard";
import { ViralCoefficientChart } from "@/components/virality/ViralCoefficientChart";
import { ConversionFunnelChart } from "@/components/virality/ConversionFunnelChart";
import { AmplificationChart } from "@/components/virality/AmplificationChart";
import { EngagementByLevelChart } from "@/components/virality/EngagementByLevelChart";
import { ContentPerformanceTable } from "@/components/virality/ContentPerformanceTable";
import { useQuery } from "@tanstack/react-query";
import {
  getViralCoefficient,
  getConversionFunnel,
  getAmplificationByLevel,
  getEngagementByLevel,
  getViralCycleTime,
  getTopPerformingContent,
} from "@/lib/virality/analytics";

interface UrlEvent {
  id: string;
  token: string;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  utm_snapshot: any;
  occurred_at: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  zip_code: string | null;
  is_simulated: boolean;
  deleted_at: string | null;
  tokens?: {
    level: number;
    deck_slug: string;
    utm_campaign: string;
    eoa_id: string;
    events_actions?: {
      title: string;
      city: string;
      state: string;
    };
  };
}

interface Campaign {
  id: string;
  code: string;
  title: string;
}

export default function CampaignAnalytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [events, setEvents] = useState<UrlEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [l00Filter, setL00Filter] = useState<string>("all");
  const [dataSourceFilter, setDataSourceFilter] = useState<"real" | "simulated" | "both">("real");
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [l00Options, setL00Options] = useState<Array<{ eoa_id: string; mobilize_code: string; city: string; state: string }>>([]);
  const [lastFilterChange, setLastFilterChange] = useState<Date>(new Date());
  const [defaultTab, setDefaultTab] = useState<string>("filters");

  // Fetch campaigns
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, code, title")
        .order("title");
      if (error) throw error;
      return data as Campaign[];
    },
  });

  // Smart default tab logic
  useEffect(() => {
    const hoursSinceLastChange = (new Date().getTime() - lastFilterChange.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastChange > 24) {
      setDefaultTab("filters");
    }
  }, [lastFilterChange]);

  // Handle URL parameter pre-filling
  useEffect(() => {
    const campaignParam = searchParams.get("campaign");
    if (campaignParam && campaigns) {
      const campaign = campaigns.find(c => c.code === campaignParam);
      if (campaign && !selectedCampaign) {
        toast({
          title: "Campaign pre-selected from URL",
          description: `"${campaign.title}" is ready to be loaded. Please confirm your selection.`,
        });
        setSelectedCampaign(campaign.id);
      }
    }
  }, [campaigns, searchParams]);

  // Set initial campaign
  useEffect(() => {
    if (campaigns && campaigns.length > 0 && !selectedCampaign) {
      setSelectedCampaign(campaigns[0].id);
    }
  }, [campaigns]);

  // Fetch analytics data
  const { data: viralCoeffData } = useQuery({
    queryKey: ["viralCoeff", selectedCampaign],
    queryFn: () => getViralCoefficient(selectedCampaign!),
    enabled: !!selectedCampaign,
  });

  const { data: funnelData } = useQuery({
    queryKey: ["conversionFunnel", selectedCampaign],
    queryFn: () => getConversionFunnel(selectedCampaign!),
    enabled: !!selectedCampaign,
  });

  const { data: amplificationData } = useQuery({
    queryKey: ["amplification", selectedCampaign],
    queryFn: () => getAmplificationByLevel(selectedCampaign!),
    enabled: !!selectedCampaign,
  });

  const { data: engagementData } = useQuery({
    queryKey: ["engagement", selectedCampaign],
    queryFn: () => getEngagementByLevel(selectedCampaign!),
    enabled: !!selectedCampaign,
  });

  const { data: cycleTimeData } = useQuery({
    queryKey: ["cycleTime", selectedCampaign],
    queryFn: () => getViralCycleTime(selectedCampaign!),
    enabled: !!selectedCampaign,
  });

  const { data: topContentData } = useQuery({
    queryKey: ["topContent", selectedCampaign],
    queryFn: () => getTopPerformingContent(selectedCampaign!),
    enabled: !!selectedCampaign,
  });

  useEffect(() => {
    if (selectedCampaign) {
      fetchL00Options();
      fetchEvents();
    }

    // Subscribe to real-time updates
    const channel = supabase
      .channel('url_events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'url_events'
        },
        () => {
          if (selectedCampaign) {
            fetchEvents();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventTypeFilter, l00Filter, dataSourceFilter, selectedCampaign]);

  const fetchL00Options = async () => {
    if (!selectedCampaign) return;

    const { data, error } = await supabase
      .from("tokens")
      .select(`
        eoa_id,
        events_actions!inner(
          utm_id,
          city,
          state,
          campaign_id
        )
      `)
      .eq("level", 0)
      .eq("events_actions.campaign_id", selectedCampaign)
      .is("deleted_at", null);

    if (error) {
      console.error("Error fetching L00 options:", error);
      return;
    }

    if (!data) return;

    const optionsObj: Record<string, { eoa_id: string; mobilize_code: string; city: string; state: string }> = {};
    
    data.forEach((item: any) => {
      if (item.eoa_id && !optionsObj[item.eoa_id]) {
        optionsObj[item.eoa_id] = {
          eoa_id: item.eoa_id,
          mobilize_code: item.events_actions?.utm_id || "Unknown",
          city: item.events_actions?.city || "",
          state: item.events_actions?.state || "",
        };
      }
    });

    setL00Options(Object.values(optionsObj));
  };

  const fetchEvents = async () => {
    if (!selectedCampaign) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    let query = supabase
      .from("url_events")
      .select(`
        *,
        tokens!inner(
          level,
          deck_slug,
          utm_campaign,
          eoa_id,
          events_actions!inner(
            title,
            city,
            state,
            campaign_id
          )
        )
      `)
      .eq("tokens.events_actions.campaign_id", selectedCampaign)
      .is("deleted_at", null)
      .is("tokens.deleted_at", null)
      .order("occurred_at", { ascending: false })
      .limit(100);

    if (eventTypeFilter !== "all") {
      query = query.eq("event_type", eventTypeFilter);
    }

    if (l00Filter !== "all") {
      query = query.eq("tokens.eoa_id", l00Filter);
    }

    if (dataSourceFilter === "real") {
      query = query.eq("is_simulated", false);
    } else if (dataSourceFilter === "simulated") {
      query = query.eq("is_simulated", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching events:", error);
      toast({
        variant: "destructive",
        title: "Error loading events",
        description: error.message,
      });
    } else {
      setEvents((data || []) as UrlEvent[]);
    }
    
    setLoading(false);
  };

  const handleFilterChange = (callback: () => void) => {
    callback();
    setLastFilterChange(new Date());
  };

  const getEventBadgeColor = (eventType: string) => {
    switch (eventType) {
      case "scan": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "view": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "share": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      default: return "bg-muted";
    }
  };

  const getLevelBadge = (level: number) => {
    return `L${level.toString().padStart(2, '0')}`;
  };

  const parseUserAgent = (ua: string | null) => {
    if (!ua) return "Unknown Device";
    
    if (ua.includes("iPhone")) return "📱 iPhone";
    if (ua.includes("iPad")) return "📱 iPad";
    if (ua.includes("Android")) return "📱 Android";
    if (ua.includes("Mac")) return "💻 Mac";
    if (ua.includes("Windows")) return "💻 Windows";
    return "🖥️ " + ua.slice(0, 30) + "...";
  };

  const scansCount = events.filter(e => e.event_type === "scan").length;
  const viewsCount = events.filter(e => e.event_type === "view").length;
  const sharesCount = events.filter(e => e.event_type === "share").length;
  const avgCycleTime = cycleTimeData?.avg_hours ? `${cycleTimeData.avg_hours.toFixed(1)}h` : "N/A";

  if (!selectedCampaign) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Activity className="w-8 h-8" />
              Campaign Analytics
            </h1>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Please select a campaign to view analytics</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading && events.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Left Sidebar - 320px */}
        <div className="w-80 border-r bg-muted/30 p-6 space-y-6">
          {/* Campaign Selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">Campaign</label>
            <Select value={selectedCampaign || undefined} onValueChange={setSelectedCampaign}>
              <SelectTrigger>
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns?.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Metric Cards */}
          <div className="space-y-3">
            <MetricCard title="Scans" value={scansCount} format="number" status="good" />
            <MetricCard title="Views" value={viewsCount} format="number" status="neutral" />
            <MetricCard title="Shares" value={sharesCount} format="number" status="warning" />
            <MetricCard title="Avg Cycle Time" value={avgCycleTime} format="text" status="neutral" />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full max-w-2xl grid-cols-4 mb-6">
              <TabsTrigger value="filters" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </TabsTrigger>
              <TabsTrigger value="events" className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Events
              </TabsTrigger>
              <TabsTrigger value="map" className="flex items-center gap-2">
                <Map className="w-4 h-4" />
                Map
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Analytics
              </TabsTrigger>
            </TabsList>

            {/* Dynamic Header */}
            <div className="mb-6 space-y-1">
              <h1 className="text-3xl font-bold">
                {defaultTab === "filters" && "Filter Configuration"}
                {defaultTab === "events" && "Real-time Event Stream"}
                {defaultTab === "map" && "Geographic Distribution"}
                {defaultTab === "analytics" && "Virality Metrics"}
              </h1>
              <p className="text-muted-foreground">
                {defaultTab === "filters" && "Configure data filters for all views"}
                {defaultTab === "events" && "Monitor individual user interactions as they happen"}
                {defaultTab === "map" && "Visualize event locations across regions"}
                {defaultTab === "analytics" && "Deep dive into campaign performance metrics"}
              </p>
            </div>

            <TabsContent value="filters">
              <Card>
                <CardHeader>
                  <CardTitle>Active Filters</CardTitle>
                  <CardDescription>These filters apply to Events and Map views</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Event Type</label>
                    <Select value={eventTypeFilter} onValueChange={(v) => handleFilterChange(() => setEventTypeFilter(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Events</SelectItem>
                        <SelectItem value="scan">Scans Only</SelectItem>
                        <SelectItem value="view">Views Only</SelectItem>
                        <SelectItem value="share">Shares Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Origin Code (L00)</label>
                    <Select value={l00Filter} onValueChange={(v) => handleFilterChange(() => setL00Filter(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Origin Codes</SelectItem>
                        {l00Options.map((option) => (
                          <SelectItem key={option.eoa_id} value={option.eoa_id}>
                            {option.mobilize_code} - {option.city}, {option.state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Data Source</label>
                    <Select value={dataSourceFilter} onValueChange={(v) => handleFilterChange(() => setDataSourceFilter(v as "real" | "simulated" | "both"))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="real">Real Data Only</SelectItem>
                        <SelectItem value="simulated">Simulated Data Only</SelectItem>
                        <SelectItem value="both">Both Combined</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="events" className="space-y-4">
              {events.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No events found for this campaign. Adjust filters or check back later.
                  </CardContent>
                </Card>
              ) : (
                events.map((event) => (
                  <Card key={event.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge className={getEventBadgeColor(event.event_type)}>
                              {event.event_type.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">
                              {getLevelBadge(event.tokens?.level || 0)}
                            </Badge>
                            {event.is_simulated && (
                              <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                                SIMULATED
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(event.occurred_at), "PPp")}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium text-sm">
                                {event.tokens?.events_actions?.title || "Unknown Event"}
                              </span>
                              {event.tokens?.events_actions?.city && (
                                <span className="text-xs text-muted-foreground">
                                  • {event.tokens.events_actions.city}, {event.tokens.events_actions.state}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Smartphone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-xs">
                                {parseUserAgent(event.user_agent)}
                              </span>
                            </div>

                            {(event.city || event.region || event.country) && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <MapPin className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                                <span>
                                  {[event.city, event.region, event.country].filter(Boolean).join(', ')}
                                  {event.zip_code && ` (${event.zip_code})`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="map">
              <Card>
                <CardContent className="p-0">
                  <ActivityMap eventTypeFilter={eventTypeFilter} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Filters Disabled in Analytics View</CardTitle>
                  <CardDescription>
                    Analytics show campaign-wide metrics. Event Type and Origin Code filters don't apply here.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="funnel">Funnel</TabsTrigger>
                  <TabsTrigger value="levels">Levels</TabsTrigger>
                  <TabsTrigger value="content">Content</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  {viralCoeffData && <ViralCoefficientChart data={viralCoeffData} />}
                </TabsContent>

                <TabsContent value="funnel">
                  {funnelData && <ConversionFunnelChart data={funnelData} />}
                </TabsContent>

                <TabsContent value="levels" className="space-y-6">
                  {amplificationData && <AmplificationChart data={amplificationData} />}
                  {engagementData && <EngagementByLevelChart data={engagementData} />}
                </TabsContent>

                <TabsContent value="content">
                  {topContentData && <ContentPerformanceTable data={topContentData} />}
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}