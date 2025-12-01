import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, MapPin, Smartphone, TrendingUp, ArrowUpDown, Trash2, Copy, RefreshCw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import ActivityMap from "@/components/ActivityMap";
import { MetricCard } from "@/components/virality/MetricCard";
import { ViralCoefficientChart } from "@/components/virality/ViralCoefficientChart";
import { ConversionFunnelChart } from "@/components/virality/ConversionFunnelChart";
import { AmplificationChart } from "@/components/virality/AmplificationChart";
import { EngagementByLevelChart } from "@/components/virality/EngagementByLevelChart";
import { ContentPerformanceTable } from "@/components/virality/ContentPerformanceTable";
import SharedDashboardMap from "@/components/SharedDashboardMap";
import { SimulatorControls } from "@/components/SimulatorControls";
import { getViralCoefficient, getConversionFunnel, getAmplificationByLevel, getEngagementByLevel, getViralCycleTime, getTopPerformingContent, getGeographicSpread } from "@/lib/virality/analytics";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
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
  is_simulated: boolean;
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
interface CampaignDashboardProps {
  campaignId?: string;
}
export default function CampaignDashboard({
  campaignId: propCampaignId
}: CampaignDashboardProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<UrlEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    column: string;
    direction: 'asc' | 'desc';
  }>({
    column: 'timestamp',
    direction: 'desc'
  });
  const [showFirstWarning, setShowFirstWarning] = useState(false);
  const [showSecondWarning, setShowSecondWarning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [highlightedRowIds, setHighlightedRowIds] = useState<Set<string>>(new Set());
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();

  // Get filter values from URL params or use prop
  const selectedCampaignId = propCampaignId || searchParams.get("campaignId") || "";
  const selectedCampaign = searchParams.get("campaign") || "";
  const eventTypeFilter = searchParams.get("eventType") || "all";
  const dataSourceFilter = (searchParams.get("dataSource") || "real") as "real" | "simulated" | "both";
  const levelFilter = searchParams.get("levels") || "0,1,2,3";

  // Sync filters across tabs using localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "campaign-dashboard-filters" && e.newValue) {
        const filters = JSON.parse(e.newValue);
        const params = new URLSearchParams(searchParams);
        params.set("campaign", filters.campaign);
        params.set("campaignId", filters.campaignId);
        params.set("eventType", filters.eventType);
        params.set("dataSource", filters.dataSource);
        params.set("levels", filters.levels);
        setSearchParams(params, {
          replace: true
        });
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [searchParams, setSearchParams]);

  // Update localStorage when filters change
  useEffect(() => {
    if (selectedCampaign && selectedCampaignId) {
      const filters = {
        campaign: selectedCampaign,
        campaignId: selectedCampaignId,
        eventType: eventTypeFilter,
        dataSource: dataSourceFilter,
        levels: levelFilter
      };
      localStorage.setItem("campaign-dashboard-filters", JSON.stringify(filters));
    }
  }, [selectedCampaign, selectedCampaignId, eventTypeFilter, dataSourceFilter, levelFilter]);

  // Fetch campaigns
  const {
    data: campaigns,
    isLoading: campaignsLoading
  } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("campaigns").select("id, code, title").order("created_at", {
        ascending: false
      });
      if (error) throw error;
      return data;
    }
  });

  // Set initial campaign from URL or default to first campaign, or use prop
  useEffect(() => {
    if (propCampaignId && campaigns && campaigns.length > 0) {
      // If campaignId prop is provided, find and set the campaign code
      const campaign = campaigns.find(c => c.id === propCampaignId);
      if (campaign) {
        const params = new URLSearchParams(searchParams);
        params.set("campaign", campaign.code);
        params.set("campaignId", campaign.id);
        if (!params.has("eventType")) params.set("eventType", "all");
        if (!params.has("dataSource")) params.set("dataSource", "real");
        setSearchParams(params, {
          replace: true
        });
      }
    } else if (!selectedCampaign && campaigns && campaigns.length > 0 && !propCampaignId) {
      const params = new URLSearchParams(searchParams);
      params.set("campaign", campaigns[0].code);
      params.set("campaignId", campaigns[0].id);
      if (!params.has("eventType")) params.set("eventType", "all");
      if (!params.has("dataSource")) params.set("dataSource", "real");
      setSearchParams(params, {
        replace: true
      });
    }
  }, [campaigns, selectedCampaign, searchParams, setSearchParams, propCampaignId]);

  // Real-time subscription for EventsV2
  useEffect(() => {
    if (!selectedCampaign) return;
    const channel = supabase.channel('url_events_realtime').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'url_events'
    }, () => {
      // Auto-refresh eventsV2 and counts when new events arrive
      queryClient.invalidateQueries({
        queryKey: ["eventsV2"]
      });
      queryClient.invalidateQueries({
        queryKey: ["eventCounts"]
      });
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCampaign, queryClient]);

  // Fetch events when filters change
  useEffect(() => {
    if (selectedCampaign) {
      fetchEvents();
    }
  }, [selectedCampaign, eventTypeFilter, dataSourceFilter]);
  const fetchEvents = async () => {
    setEventsLoading(true);
    let query = supabase.from("url_events").select(`
        *,
        tokens!inner(
          level,
          deck_slug,
          utm_campaign,
          eoa_id,
          events_actions(
            title,
            city,
            state
          )
        )
      `).eq("tokens.utm_campaign", selectedCampaign).order("occurred_at", {
      ascending: false
    });
    if (eventTypeFilter !== "all") {
      query = query.eq("event_type", eventTypeFilter);
    }
    if (dataSourceFilter === "real") {
      query = query.eq("is_simulated", false);
    } else if (dataSourceFilter === "simulated") {
      query = query.eq("is_simulated", true);
    }
    const {
      data,
      error
    } = await query;
    if (error) {
      console.error("Error fetching events:", error);
    } else {
      setEvents((data || []) as UrlEvent[]);
    }
    setEventsLoading(false);
  };

  // Fetch analytics data
  const {
    data: viralCoefficient
  } = useQuery({
    queryKey: ["viralCoefficient", selectedCampaign, dataSourceFilter],
    queryFn: () => getViralCoefficient(selectedCampaign, undefined, dataSourceFilter),
    enabled: !!selectedCampaign
  });
  const {
    data: funnelData
  } = useQuery({
    queryKey: ["conversionFunnel", selectedCampaign, dataSourceFilter],
    queryFn: () => getConversionFunnel(selectedCampaign, undefined, dataSourceFilter),
    enabled: !!selectedCampaign
  });
  const {
    data: amplificationData
  } = useQuery({
    queryKey: ["amplification", selectedCampaign, dataSourceFilter],
    queryFn: () => getAmplificationByLevel(selectedCampaign, dataSourceFilter),
    enabled: !!selectedCampaign
  });
  const {
    data: engagementData
  } = useQuery({
    queryKey: ["engagement", selectedCampaign, dataSourceFilter],
    queryFn: () => getEngagementByLevel(selectedCampaign, undefined, dataSourceFilter),
    enabled: !!selectedCampaign
  });
  const {
    data: cycleTimeData
  } = useQuery({
    queryKey: ["cycleTime", selectedCampaign, dataSourceFilter],
    queryFn: () => getViralCycleTime(selectedCampaign, dataSourceFilter),
    enabled: !!selectedCampaign
  });
  const {
    data: contentData
  } = useQuery({
    queryKey: ["contentPerformance", selectedCampaign, dataSourceFilter],
    queryFn: () => getTopPerformingContent(selectedCampaign, "shares", dataSourceFilter),
    enabled: !!selectedCampaign
  });
  const {
    data: geoData
  } = useQuery({
    queryKey: ["geographic", selectedCampaign, dataSourceFilter],
    queryFn: () => getGeographicSpread(selectedCampaign, undefined, dataSourceFilter),
    enabled: !!selectedCampaign
  });
  const getEventBadgeColor = (eventType: string) => {
    switch (eventType) {
      case "scan":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "view":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "share":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      default:
        return "bg-muted";
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
    return "🖥️ Device";
  };
  const avgCycleTime = cycleTimeData && cycleTimeData.length > 0 ? cycleTimeData.reduce((sum, ct) => sum + ct.avg_hours, 0) / cycleTimeData.length : 0;
  const handleRefreshEventsV2 = async () => {
    setIsRefreshing(true);
    try {
      // Capture current event IDs before refresh
      const currentEventIds = new Set(eventsV2Data?.map((e: any) => e.id) || []);

      // Invalidate and refetch
      await queryClient.invalidateQueries({
        queryKey: ["eventsV2"]
      });
      await queryClient.invalidateQueries({
        queryKey: ["eventCounts"]
      });

      // Wait for refetch to complete
      const result = await queryClient.fetchQuery({
        queryKey: ["eventsV2", selectedCampaign, eventTypeFilter, dataSourceFilter]
      });

      // Compare and highlight new events
      if (result && Array.isArray(result)) {
        const newEventIds = new Set<string>();
        result.forEach((event: any) => {
          if (!currentEventIds.has(event.id)) {
            newEventIds.add(event.id);
          }
        });
        if (newEventIds.size > 0) {
          setHighlightedRowIds(newEventIds);
          // Clear highlights after 3 seconds
          setTimeout(() => {
            setHighlightedRowIds(new Set());
          }, 3000);
        }
      }
      toast({
        title: "Data Refreshed",
        description: "EventsV2 data has been updated successfully."
      });
    } catch (error) {
      console.error("Refresh error:", error);
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: "Failed to refresh data. Please try again."
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch total event counts (not limited to last 50)
  const {
    data: eventCounts
  } = useQuery({
    queryKey: ["eventCounts", selectedCampaign, dataSourceFilter],
    queryFn: async () => {
      let baseQuery = supabase.from("url_events").select("event_type, tokens!inner(utm_campaign)", {
        count: "exact",
        head: false
      }).eq("tokens.utm_campaign", selectedCampaign);
      if (dataSourceFilter === "real") {
        baseQuery = baseQuery.eq("is_simulated", false);
      } else if (dataSourceFilter === "simulated") {
        baseQuery = baseQuery.eq("is_simulated", true);
      }
      const {
        data,
        error
      } = await baseQuery;
      if (error) throw error;
      const scans = data?.filter(e => e.event_type === "scan").length || 0;
      const views = data?.filter(e => e.event_type === "view").length || 0;
      const shares = data?.filter(e => e.event_type === "share").length || 0;
      return {
        scans,
        views,
        shares
      };
    },
    enabled: !!selectedCampaign
  });
  const scansCount = eventCounts?.scans || 0;
  const viewsCount = eventCounts?.views || 0;
  const sharesCount = eventCounts?.shares || 0;

  // Fetch EventsV2 data
  const {
    data: eventsV2Data,
    isLoading: eventsV2Loading
  } = useQuery({
    queryKey: ["eventsV2", selectedCampaign, eventTypeFilter, dataSourceFilter],
    queryFn: async () => {
      let query = supabase.from("url_events").select(`
          id,
          occurred_at,
          event_type,
          city,
          region,
          zip_code,
          token,
          tokens!inner(
            level,
            utm_content,
            utm_campaign,
            eoa_id,
            full_url,
            events_actions(
              mobilize_code,
              utm_id,
              city,
              state,
              zip_code,
              id
            )
          )
        `).eq("tokens.utm_campaign", selectedCampaign).order("occurred_at", {
        ascending: false
      });
      if (eventTypeFilter !== "all") {
        query = query.eq("event_type", eventTypeFilter);
      }
      if (dataSourceFilter === "real") {
        query = query.eq("is_simulated", false);
      } else if (dataSourceFilter === "simulated") {
        query = query.eq("is_simulated", true);
      }
      const {
        data,
        error
      } = await query;
      if (error) throw error;

      // Transform data to clean, serializable objects and fetch shortened URLs
      if (data && data.length > 0) {
        const uniqueFullUrls = [...new Set(data.map((e: any) => e.tokens?.full_url).filter(Boolean))];
        const {
          data: shortUrls
        } = await supabase.from("shortened_urls").select("full_url, short_code").in("full_url", uniqueFullUrls);

        // Map full URLs to short URLs
        const shortUrlMap = new Map<string, string>();
        shortUrls?.forEach((su: any) => {
          shortUrlMap.set(su.full_url, `https://omega-resist.lovable.app/s/${su.short_code}`);
        });

        // Transform to clean objects with null-safety
        return data.map((event: any) => JSON.parse(JSON.stringify({
          id: event.id,
          occurred_at: event.occurred_at,
          event_type: event.event_type,
          city: event.city,
          region: event.region,
          zip_code: event.zip_code,
          token: event.token,
          tokens: {
            level: event.tokens?.level,
            utm_content: event.tokens?.utm_content,
            utm_campaign: event.tokens?.utm_campaign,
            eoa_id: event.tokens?.eoa_id,
            full_url: event.tokens?.full_url,
            events_actions: event.tokens?.events_actions ? {
              mobilize_code: event.tokens.events_actions.mobilize_code,
              utm_id: event.tokens.events_actions.utm_id,
              city: event.tokens.events_actions.city,
              state: event.tokens.events_actions.state,
              zip_code: event.tokens.events_actions.zip_code,
              id: event.tokens.events_actions.id
            } : null
          },
          short_url: event.tokens?.full_url ? shortUrlMap.get(event.tokens.full_url) : null
        })));
      }
      return [];
    },
    enabled: !!selectedCampaign
  });

  // Helper functions for EventsV2
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  };
  const formatLevel = (level: number) => {
    return `L${level.toString().padStart(2, '0')}`;
  };
  const formatZipCode = (zip: string | null) => {
    if (!zip) return "";
    return zip.padStart(5, '0');
  };

  // Calculate metrics for EventsV2
  const eventsV2Metrics = eventsV2Data ? {
    uniqueMobilizeCodes: new Set(eventsV2Data.map((e: any) => e.tokens?.events_actions?.mobilize_code).filter(Boolean)).size,
    scansCount: eventsV2Data.filter((e: any) => e.event_type === 'scan').length,
    viewsCount: eventsV2Data.filter((e: any) => e.event_type === 'view').length,
    sharesCount: eventsV2Data.filter((e: any) => e.event_type === 'share').length,
    totalRows: eventsV2Data.length,
    earliestTimestamp: eventsV2Data.length > 0 ? formatTimestamp(eventsV2Data[eventsV2Data.length - 1].occurred_at) : 'N/A',
    latestTimestamp: eventsV2Data.length > 0 ? formatTimestamp(eventsV2Data[0].occurred_at) : 'N/A'
  } : null;

  // Sorting logic for EventsV2
  const handleSort = (column: string) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  const sortedEventsV2 = eventsV2Data ? [...eventsV2Data].sort((a: any, b: any) => {
    const {
      column,
      direction
    } = sortConfig;
    let aVal: any, bVal: any;
    switch (column) {
      case 'timestamp':
        aVal = new Date(a.occurred_at).getTime();
        bVal = new Date(b.occurred_at).getTime();
        break;
      case 'mobilize_code':
        aVal = a.tokens?.events_actions?.mobilize_code || '';
        bVal = b.tokens?.events_actions?.mobilize_code || '';
        break;
      case 'location':
        aVal = `${a.tokens?.events_actions?.city || ''}, ${a.tokens?.events_actions?.state || ''}`;
        bVal = `${b.tokens?.events_actions?.city || ''}, ${b.tokens?.events_actions?.state || ''}`;
        break;
      case 'zip':
        aVal = a.zip_code || '';
        bVal = b.zip_code || '';
        break;
      case 'event_zip':
        aVal = a.tokens?.events_actions?.zip_code || '';
        bVal = b.tokens?.events_actions?.zip_code || '';
        break;
      case 'level':
        aVal = a.tokens?.level || 0;
        bVal = b.tokens?.level || 0;
        break;
      case 'utm_content':
        aVal = a.tokens?.events_actions?.mobilize_code && a.tokens?.events_actions?.utm_id ? `${a.tokens.events_actions.mobilize_code}-${a.tokens.events_actions.utm_id}` : '';
        bVal = b.tokens?.events_actions?.mobilize_code && b.tokens?.events_actions?.utm_id ? `${b.tokens.events_actions.mobilize_code}-${b.tokens.events_actions.utm_id}` : '';
        break;
      case 'event_type':
        aVal = a.event_type;
        bVal = b.event_type;
        break;
      default:
        return 0;
    }
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  }) : [];

  // Get campaign title for EventsV2
  const campaignTitle = campaigns?.find(c => c.code === selectedCampaign)?.title || "N/A";
  const clearRealData = async () => {
    try {
      console.log("Starting REAL data cleanup...");

      // Count before deletion
      const {
        count: eventsBefore,
        error: eventsCountError
      } = await supabase.from("url_events").select("*", {
        count: "exact",
        head: true
      }).eq("is_simulated", false);
      if (eventsCountError) {
        console.error("Error counting events:", eventsCountError);
        throw eventsCountError;
      }
      const {
        count: tokensBefore,
        error: tokensCountError
      } = await supabase.from("tokens").select("*", {
        count: "exact",
        head: true
      }).eq("is_simulated", false);
      if (tokensCountError) {
        console.error("Error counting tokens:", tokensCountError);
        throw tokensCountError;
      }
      console.log(`Found ${eventsBefore} real events and ${tokensBefore} real tokens to delete`);

      // Delete real URL events FIRST (before tokens, to avoid FK constraint issues)
      console.log("Attempting to delete real events...");
      const {
        error: eventsError,
        count: eventsDeleted
      } = await supabase.from("url_events").delete({
        count: "exact"
      }).eq("is_simulated", false);
      if (eventsError) {
        console.error("Failed to delete events:", eventsError);
        toast({
          title: "Error deleting events",
          description: `${eventsError.message}`,
          variant: "destructive"
        });
        throw eventsError;
      }
      console.log(`Successfully deleted ${eventsDeleted} real events`);

      // Delete real tokens SECOND (after events are gone)
      console.log("Attempting to delete real tokens...");
      const {
        error: tokensError,
        count: tokensDeleted
      } = await supabase.from("tokens").delete({
        count: "exact"
      }).eq("is_simulated", false);
      if (tokensError) {
        console.error("Failed to delete tokens:", tokensError);
        toast({
          title: "Error deleting tokens",
          description: `${tokensError.message}`,
          variant: "destructive"
        });
        throw tokensError;
      }
      console.log(`Successfully deleted ${tokensDeleted} real tokens`);

      // Verify deletion
      const {
        count: eventsAfter
      } = await supabase.from("url_events").select("*", {
        count: "exact",
        head: true
      }).eq("is_simulated", false);
      const {
        count: tokensAfter
      } = await supabase.from("tokens").select("*", {
        count: "exact",
        head: true
      }).eq("is_simulated", false);
      console.log(`After deletion: ${eventsAfter} events and ${tokensAfter} tokens remaining`);

      // Force refresh all relevant queries
      await queryClient.invalidateQueries({
        queryKey: ["url_events"]
      });
      await queryClient.invalidateQueries({
        queryKey: ["tokens"]
      });
      await queryClient.invalidateQueries({
        queryKey: ["eventCounts"]
      });
      await queryClient.invalidateQueries({
        queryKey: ["viralityMetrics"]
      });
      await queryClient.refetchQueries();
      toast({
        title: "Real data cleared successfully",
        description: `Deleted ${eventsDeleted} events and ${tokensDeleted} tokens from production data.`,
        variant: "destructive"
      });

      // Close dialogs
      setShowFirstWarning(false);
      setShowSecondWarning(false);

      // Refresh events
      fetchEvents();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear real data.",
        variant: "destructive",
        duration: Infinity
      });
    }
  };
  if (campaignsLoading) {
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>;
  }
  return <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="w-8 h-8" />
              Campaign Configuration
            </h1>
          </div>
          
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="filters" className="w-full">
          <TabsList className="grid w-full max-w-4xl grid-cols-5">
            <TabsTrigger value="filters">Filters</TabsTrigger>
            <TabsTrigger value="eventsv2">EventsV2</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="simulator">Simulator</TabsTrigger>
          </TabsList>

          {/* Filters Tab - Single Source of Truth */}
          <TabsContent value="filters" className="space-y-6 mt-6">
            {/* Campaign Selection Card */}
            <Card>
              <CardHeader>
                <CardTitle>Campaign Selection</CardTitle>
                <CardDescription>
                  Select the active campaign to view data across all tabs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Campaign</label>
                  <Select 
                    value={selectedCampaignId || ""} 
                    onValueChange={(campaignId) => {
                      const campaign = campaigns?.find(c => c.id === campaignId);
                      if (campaign) {
                        const params = new URLSearchParams(searchParams);
                        params.set("campaign", campaign.code);
                        params.set("campaignId", campaign.id);
                        setSearchParams(params);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a campaign..." />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns?.map(campaign => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.code} - {campaign.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedCampaign && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <span className="text-sm font-medium">Active Campaign:</span>
                    <span className="text-sm">{selectedCampaign} - {campaignTitle}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Configure Filters Card */}
            <Card>
              <CardHeader>
                <CardTitle>Configure Filters</CardTitle>
                <CardDescription>
                  These filters will apply across all tabs (Events, Map, Analytics)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Event Type</label>
                  <Select value={eventTypeFilter} onValueChange={value => {
                  const params = new URLSearchParams(searchParams);
                  params.set("eventType", value);
                  setSearchParams(params);
                }}>
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
                  <label className="text-sm font-medium mb-2 block">Data Source</label>
                  <Select value={dataSourceFilter} onValueChange={value => {
                  const params = new URLSearchParams(searchParams);
                  params.set("dataSource", value);
                  setSearchParams(params);
                }}>
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

                <div>
                  <label className="text-sm font-medium mb-2 block">Viral Levels (for Map)</label>
                  <div className="flex gap-4 flex-wrap">
                    {[0, 1, 2, 3].map(level => {
                    const currentLevels = levelFilter.split(',').map(Number);
                    const isChecked = currentLevels.includes(level);
                    return <div key={level} className="flex items-center space-x-2">
                          <Checkbox id={`level-${level}`} checked={isChecked} onCheckedChange={checked => {
                        const params = new URLSearchParams(searchParams);
                        let newLevels = currentLevels.filter(l => l !== level);
                        if (checked) {
                          newLevels.push(level);
                          newLevels.sort();
                        }
                        params.set("levels", newLevels.join(','));
                        setSearchParams(params);
                      }} />
                          <Label htmlFor={`level-${level}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                            L{level.toString().padStart(2, '0')}
                          </Label>
                        </div>;
                  })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone - Erase All Real Data */}
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone: Delete Real Data</CardTitle>
                <CardDescription>Permanently delete all real (non-simulated) campaign data</CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog open={showFirstWarning} onOpenChange={setShowFirstWarning}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Erase All Real Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete All Real Data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete all real (non-simulated) tokens and events from your database. 
                        This action cannot be undone. Are you sure you want to continue?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => {
                      setShowFirstWarning(false);
                      setShowSecondWarning(true);
                    }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={showSecondWarning} onOpenChange={setShowSecondWarning}>
                  <AlertDialogContent className="border-destructive">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-destructive text-xl font-bold">
                        ⚠️ FINAL WARNING ⚠️
                      </AlertDialogTitle>
                      <AlertDialogDescription className="space-y-3">
                        <p className="font-bold text-foreground">
                          You are about to PERMANENTLY DELETE all real production data!
                        </p>
                        <p className="text-destructive font-semibold">
                          This will erase ALL real tokens, events, and analytics from your campaigns.
                        </p>
                        <p className="font-medium">
                          This action is IRREVERSIBLE and CANNOT BE UNDONE.
                        </p>
                        <p className="text-sm">
                          Only simulated data will remain. Are you absolutely certain you want to proceed?
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel - Keep My Data</AlertDialogCancel>
                      <AlertDialogAction onClick={clearRealData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold">
                        YES, DELETE EVERYTHING
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            {/* Filter Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Current Selection</CardTitle>
              </CardHeader>
              
            </Card>
          </TabsContent>


          {/* EventsV2 Tab */}
          <TabsContent value="eventsv2" className="mt-6 animate-fade-in">
            <Card>
              <CardContent className="pt-6">
                {eventsV2Loading ? <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div> : !eventsV2Data || eventsV2Data.length === 0 ? <div className="py-12 text-center text-muted-foreground">
                    No events found for the selected filters.
                  </div> : <>
                    {/* First Block - Campaign Summary */}
                    <div className="flex items-center justify-between border-b pb-4 mb-4">
                      <span className="text-sm font-medium">Campaign: {campaignTitle}</span>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-6 text-sm">
                          <span className="text-muted-foreground">Earliest: {eventsV2Metrics?.earliestTimestamp}</span>
                          <span className="text-muted-foreground">Latest: {eventsV2Metrics?.latestTimestamp}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleRefreshEventsV2} disabled={isRefreshing}>
                          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      </div>
                    </div>

                    {/* Second Block - Metrics Summary */}
                    <div className="flex items-center gap-6 py-4 border-b mb-4 text-sm flex-wrap">
                      <span># Mobilize Sites: <strong>{eventsV2Metrics?.uniqueMobilizeCodes}</strong></span>
                      <span># Scans: <strong>{eventsV2Metrics?.scansCount}</strong></span>
                      <span># Views: <strong>{eventsV2Metrics?.viewsCount}</strong></span>
                      <span># Shares: <strong>{eventsV2Metrics?.sharesCount}</strong></span>
                      <span># Rows: <strong>{eventsV2Metrics?.totalRows}</strong></span>
                    </div>

                    {/* Table */}
                    <ScrollArea className="h-[calc(100vh-300px)] min-h-[600px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">Row #</TableHead>
                            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('timestamp')}>
                              <div className="flex items-center gap-1">
                                TimeStamp
                                {sortConfig.column === 'timestamp' && <ArrowUpDown className="w-3 h-3" />}
                              </div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('mobilize_code')}>
                              <div className="flex items-center gap-1">
                                Mobilize Code
                                {sortConfig.column === 'mobilize_code' && <ArrowUpDown className="w-3 h-3" />}
                              </div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('location')}>
                              <div className="flex items-center gap-1">
                                City/Region
                                {sortConfig.column === 'location' && <ArrowUpDown className="w-3 h-3" />}
                              </div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('zip')}>
                              <div className="flex items-center gap-1">
                                Cell Tower Zip
                                {sortConfig.column === 'zip' && <ArrowUpDown className="w-3 h-3" />}
                              </div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('event_zip')}>
                              <div className="flex items-center gap-1">
                                Event Zip
                                {sortConfig.column === 'event_zip' && <ArrowUpDown className="w-3 h-3" />}
                              </div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('level')}>
                              <div className="flex items-center gap-1">
                                Event Level
                                {sortConfig.column === 'level' && <ArrowUpDown className="w-3 h-3" />}
                              </div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('utm_content')}>
                              <div className="flex items-center gap-1">
                                utm_content
                                {sortConfig.column === 'utm_content' && <ArrowUpDown className="w-3 h-3" />}
                              </div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('event_type')}>
                              <div className="flex items-center gap-1">
                                Event Type
                                {sortConfig.column === 'event_type' && <ArrowUpDown className="w-3 h-3" />}
                              </div>
                            </TableHead>
                            <TableHead>Short URL</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedEventsV2.map((event: any, index: number) => <TableRow key={event.id} className={highlightedRowIds.has(event.id) ? 'bg-primary/10 animate-fade-in' : ''}>
              <TableCell>{index + 1}</TableCell>
              <TableCell className="font-mono text-xs">{formatTimestamp(event.occurred_at)}</TableCell>
              <TableCell>{event.tokens?.events_actions?.mobilize_code || 'N/A'}</TableCell>
              <TableCell>
                {event.city && event.region ? `${event.city}, ${event.region}` : 'N/A'}
              </TableCell>
              <TableCell>{formatZipCode(event.zip_code)}</TableCell>
              <TableCell>{formatZipCode(event.tokens?.events_actions?.zip_code)}</TableCell>
              <TableCell>
                <Badge variant="outline">{formatLevel(event.tokens?.level || 0)}</Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {event.tokens?.events_actions?.mobilize_code && event.tokens?.events_actions?.utm_id ? `${event.tokens.events_actions.mobilize_code}-${event.tokens.events_actions.utm_id}` : 'N/A'}
              </TableCell>
                              <TableCell>
                                <Badge className={getEventBadgeColor(event.event_type)}>
                                  {event.event_type.toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {event.short_url ? <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs truncate max-w-[200px]">{event.short_url}</span>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                              navigator.clipboard.writeText(event.short_url);
                              toast({
                                title: "Short URL copied!"
                              });
                            }}>
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div> : <span className="text-muted-foreground text-xs">No short URL</span>}
                              </TableCell>
                            </TableRow>)}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="map" className="mt-6 animate-fade-in space-y-4">
            <Card className="mb-4">
              <CardContent className="pt-6">
                <span className="text-sm font-medium">Campaign: {campaignTitle}</span>
              </CardContent>
            </Card>
            <SharedDashboardMap geoData={geoData || []} levelFilter={levelFilter} />
            
            {/* Level Filter Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Filter by Viral Level</CardTitle>
                <CardDescription>
                  Toggle levels to see viral spread progression
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6 flex-wrap">
                  {[0, 1, 2, 3].map(level => {
                  const currentLevels = levelFilter.split(',').map(Number);
                  const isChecked = currentLevels.includes(level);
                  return <div key={level} className="flex items-center space-x-2">
                        <Checkbox id={`map-level-${level}`} checked={isChecked} onCheckedChange={checked => {
                      const params = new URLSearchParams(searchParams);
                      let newLevels = currentLevels.filter(l => l !== level);
                      if (checked) {
                        newLevels.push(level);
                        newLevels.sort();
                      }
                      params.set("levels", newLevels.join(','));
                      setSearchParams(params);
                    }} />
                        <Label htmlFor={`map-level-${level}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                          L{level.toString().padStart(2, '0')}
                        </Label>
                      </div>;
                })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6 mt-6">
            <Card className="mb-4">
              <CardContent className="pt-6">
                <span className="text-sm font-medium">Campaign: {campaignTitle}</span>
              </CardContent>
            </Card>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
              <MetricCard title="Viral Coefficient" value={viralCoefficient?.k_factor.toFixed(2) || "0"} status={(viralCoefficient?.k_factor || 0) >= 1 ? "good" : "warning"} />
              <MetricCard title="Share Rate" value={(funnelData?.view_to_share_rate || 0).toFixed(1)} format="percentage" status={(funnelData?.view_to_share_rate || 0) >= 10 ? "good" : "neutral"} />
              <MetricCard title="Avg Cycle Time" value={avgCycleTime} format="time" status="neutral" />
              <MetricCard title="Total Reach" value={viralCoefficient?.unique_tokens || 0} status="good" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
              {viralCoefficient && <ViralCoefficientChart kFactor={viralCoefficient.k_factor} />}
              {amplificationData && <AmplificationChart data={amplificationData} />}
            </div>
            
            <div className="animate-fade-in">
              {engagementData && <EngagementByLevelChart data={engagementData} />}
            </div>
            
            <div className="animate-fade-in">
              {funnelData && <ConversionFunnelChart data={funnelData} />}
            </div>
            
            <div className="animate-fade-in">
              {contentData && <ContentPerformanceTable data={contentData} />}
            </div>
          </TabsContent>

          <TabsContent value="simulator" className="mt-6">
            <Card className="mb-4">
              <CardContent className="pt-6">
                <span className="text-sm font-medium">Campaign: {campaignTitle}</span>
              </CardContent>
            </Card>
            <SimulatorControls campaignId={selectedCampaignId} onSimulationComplete={() => {
            // Refetch events to update all views
            fetchEvents();

            // Switch to "both" mode when simulation completes with new data
            if (dataSourceFilter === "real") {
              const params = new URLSearchParams(searchParams);
              params.set("dataSource", "both");
              setSearchParams(params);
            }
          }} />
          </TabsContent>
        </Tabs>
      </div>
    </div>;
}