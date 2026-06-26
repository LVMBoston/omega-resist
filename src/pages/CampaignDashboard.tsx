import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, MapPin, Smartphone, TrendingUp, ArrowUpDown, Trash2, Copy, RefreshCw, Download, Columns } from "lucide-react";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
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
import SamizdatMap from "@/components/SamizdatMap";
import SamizdatEoaSelector from "@/components/SamizdatEoaSelector";
import { getViralCoefficient, getConversionFunnel, getAmplificationByLevel, getEngagementByLevel, getViralCycleTime, getTopPerformingContent, getGeographicSpread } from "@/lib/virality/analytics";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { EventStoryDialog } from "@/components/EventStoryDialog";
import { CampaignSnapshotSettings } from "@/components/CampaignSnapshotSettings";
import { CampaignNarrativeButton } from "@/components/CampaignNarrativeDialog";
import { useOfficialStart, applyOfficialStartFilter, splitEvents, formatOfficialStart } from "@/lib/officialStart";
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
  location_source: string | null;
  zip_code: string | null;
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

type DashboardDataSource = "real" | "simulated";

const normalizeDataSource = (value: string | null | undefined): DashboardDataSource => (
  value === "simulated" ? "simulated" : "real"
);

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
  const [isClearingSimulationData, setIsClearingSimulationData] = useState(false);
  const [pendingSimulationClearScope, setPendingSimulationClearScope] = useState<"current" | "all" | null>(null);
  const [selectedEoaIds, setSelectedEoaIds] = useState<string[]>([]);
  const [highlightedRowIds, setHighlightedRowIds] = useState<Set<string>>(new Set());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventsColumnVisibility, setEventsColumnVisibility] = useState({
    timestamp: true,
    mobilize_code: true,
    city_region: true,
    zip_code: true,
    location_method: true,
    event_level: true,
    utm_medium: true,
    utm_content: true,
    instance: true,
    event_id: false,
    full_url: false,
  });
  
  // Chain filter state (shared between Samizdat and EventsV2 tabs via URL params)
  const chainRootTokenParam = searchParams.get("chainRoot");
  const chainTokenParam = searchParams.get("chainToken");
  // View mode is "chain" if either chainRoot or chainToken is set
  const chainViewMode = (chainRootTokenParam || chainTokenParam) ? "chain" : "all";
  const selectedChainRootToken = chainRootTokenParam;
  const selectedChainToken = chainTokenParam;
  
  // Selected L00 instance for filtering eventsV2 (computed from chainToken)
  const [selectedL00Instance, setSelectedL00Instance] = useState<string | null>(null);
  const [mapRefreshKey, setMapRefreshKey] = useState(0);
  
  // Debug logging for chain filter
  console.log("[CampaignDashboard] Chain filter state:", {
    chainRootTokenParam,
    chainTokenParam,
    chainViewMode,
    selectedChainRootToken,
    selectedChainToken,
    selectedL00Instance,
    fullUrl: window.location.href,
    searchParamsString: searchParams.toString()
  });
  
  const setSelectedChainRootToken = (token: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (token) {
      newParams.set("chainRoot", token);
    } else {
      newParams.delete("chainRoot");
      newParams.delete("chainToken");
    }
    setSearchParams(newParams);
  };
  
  const setSelectedChainToken = (token: string | null) => {
    // When setting chainToken, preserve the existing chainRoot
    const newParams = new URLSearchParams(searchParams);
    if (token) {
      newParams.set("chainToken", token);
      // Also ensure chainRoot is set if we have a token (use rootToken from the map's callback)
    } else {
      newParams.delete("chainToken");
    }
    setSearchParams(newParams);
  };
  
  // Combined setter to update both chainRoot and chainToken atomically
  const setChainFilter = useCallback((rootToken: string | null, chainToken: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (rootToken) {
      newParams.set("chainRoot", rootToken);
    } else {
      newParams.delete("chainRoot");
    }
    if (chainToken) {
      newParams.set("chainToken", chainToken);
    } else {
      newParams.delete("chainToken");
    }
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);
  
  const setChainViewMode = (mode: "all" | "chain") => {
    if (mode === "all") {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("chainRoot");
      newParams.delete("chainToken");
      setSearchParams(newParams);
      setSelectedL00Instance(null);
    }
  };
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();

  // Get filter values from URL params or use prop
  const selectedCampaignId = propCampaignId || searchParams.get("campaignId") || "";
  const selectedCampaign = searchParams.get("campaign") || "";
  const eventTypeFilter = searchParams.get("eventType") || "all";
  const dataSourceFilter = normalizeDataSource(searchParams.get("dataSource"));
  const levelFilter = searchParams.get("levels") || "0,1,2,3";
  const hideLegacy = searchParams.get("hideLegacy") === "true";
  const showNoSpawns = searchParams.get("showNoSpawns") !== "false";
  const chapterFilter = searchParams.get("chapter") || "all";
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const [startDate, setStartDate] = useState<Date | undefined>(
    startDateParam ? new Date(startDateParam) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    endDateParam ? new Date(endDateParam) : undefined
  );

  useEffect(() => {
    if (searchParams.get("dataSource") === "both") {
      const params = new URLSearchParams(searchParams);
      params.set("dataSource", "real");
      setSearchParams(params, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Sync filters across tabs using localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "campaign-dashboard-filters" && e.newValue) {
        const filters = JSON.parse(e.newValue);
        const params = new URLSearchParams(searchParams);
        params.set("campaign", filters.campaign);
        params.set("campaignId", filters.campaignId);
        params.set("eventType", filters.eventType);
        params.set("dataSource", normalizeDataSource(filters.dataSource));
        params.set("levels", filters.levels);
        if (filters.startDate) {
          params.set("startDate", filters.startDate);
          setStartDate(new Date(filters.startDate));
        } else {
          params.delete("startDate");
          setStartDate(undefined);
        }
        if (filters.endDate) {
          params.set("endDate", filters.endDate);
          setEndDate(new Date(filters.endDate));
        } else {
          params.delete("endDate");
          setEndDate(undefined);
        }
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
        levels: levelFilter,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString()
      };
      localStorage.setItem("campaign-dashboard-filters", JSON.stringify(filters));
    }
  }, [selectedCampaign, selectedCampaignId, eventTypeFilter, dataSourceFilter, levelFilter, startDate, endDate]);

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

  // Set initial campaign from URL, localStorage, or default to first campaign
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
      
      // Try to restore from localStorage first
      const savedFilters = localStorage.getItem("campaign-dashboard-filters");
      if (savedFilters) {
        try {
          const filters = JSON.parse(savedFilters);
          // Verify the saved campaign still exists
          const savedCampaign = campaigns.find(c => c.id === filters.campaignId);
          if (savedCampaign) {
            params.set("campaign", savedCampaign.code);
            params.set("campaignId", savedCampaign.id);
            if (!params.has("eventType")) params.set("eventType", filters.eventType || "all");
            if (!params.has("dataSource")) params.set("dataSource", normalizeDataSource(filters.dataSource));
            setSearchParams(params, {
              replace: true
            });
            return;
          }
        } catch (e) {
          console.error("Error parsing saved filters:", e);
        }
      }
      
      // Fall back to first campaign if no valid saved selection
      params.set("campaign", campaigns[0].code);
      params.set("campaignId", campaigns[0].id);
      if (!params.has("eventType")) params.set("eventType", "all");
      if (!params.has("dataSource")) params.set("dataSource", "real");
      setSearchParams(params, {
        replace: true
      });
    }
  }, [campaigns, selectedCampaign, searchParams, setSearchParams, propCampaignId]);

  // Clear chain filter when campaign changes to prevent stale filters from other campaigns
  useEffect(() => {
    const currentChainToken = searchParams.get("chainToken");
    const currentChainRoot = searchParams.get("chainRoot");
    
    if (selectedCampaignId && (currentChainToken || currentChainRoot)) {
      // Clear chain filter params when campaign changes
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("chainToken");
      newParams.delete("chainRoot");
      setSearchParams(newParams, { replace: true });
      setSelectedL00Instance(null);
      console.log("[CampaignDashboard] Cleared chain filter on campaign change:", selectedCampaignId);
    }
  }, [selectedCampaignId]); // Only depend on campaignId to detect campaign switches

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
      // Bump map refresh key so SamizdatMap re-fetches
      setMapRefreshKey(prev => prev + 1);
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
  }, [selectedCampaign, eventTypeFilter, dataSourceFilter, startDate, endDate]);
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
    if (startDate) {
      query = query.gte("occurred_at", startDate.toISOString());
    }
    if (endDate) {
      // Set end date to end of day
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte("occurred_at", endOfDay.toISOString());
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
    queryKey: ["viralCoefficient", selectedCampaign, dataSourceFilter, startDate, endDate],
    queryFn: () => getViralCoefficient(selectedCampaign, undefined, dataSourceFilter),
    enabled: !!selectedCampaign
  });
  const {
    data: funnelData
  } = useQuery({
    queryKey: ["conversionFunnel", selectedCampaign, dataSourceFilter, startDate, endDate],
    queryFn: () => getConversionFunnel(selectedCampaign, undefined, dataSourceFilter),
    enabled: !!selectedCampaign
  });
  const {
    data: amplificationData
  } = useQuery({
    queryKey: ["amplification", selectedCampaign, dataSourceFilter, startDate, endDate],
    queryFn: () => getAmplificationByLevel(selectedCampaign, dataSourceFilter),
    enabled: !!selectedCampaign
  });
  const {
    data: engagementData
  } = useQuery({
    queryKey: ["engagement", selectedCampaign, dataSourceFilter, startDate, endDate],
    queryFn: () => getEngagementByLevel(selectedCampaign, undefined, dataSourceFilter),
    enabled: !!selectedCampaign
  });
  const {
    data: cycleTimeData
  } = useQuery({
    queryKey: ["cycleTime", selectedCampaign, dataSourceFilter, startDate, endDate],
    queryFn: () => getViralCycleTime(selectedCampaign, dataSourceFilter),
    enabled: !!selectedCampaign
  });
  const {
    data: contentData
  } = useQuery({
    queryKey: ["contentPerformance", selectedCampaign, dataSourceFilter, startDate, endDate],
    queryFn: () => getTopPerformingContent(selectedCampaign, "shares", dataSourceFilter),
    enabled: !!selectedCampaign
  });
  const {
    data: geoData
  } = useQuery({
    queryKey: ["geographic", selectedCampaign, dataSourceFilter, startDate, endDate],
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
      const result = await queryClient.refetchQueries({
        queryKey: ["eventsV2", selectedCampaign, eventTypeFilter, dataSourceFilter]
      });
      
      // Get the refreshed data from cache
      const refreshedData = queryClient.getQueryData(["eventsV2", selectedCampaign, eventTypeFilter, dataSourceFilter]);

      // Compare and highlight new events
      if (refreshedData && Array.isArray(refreshedData)) {
        const newEventIds = new Set<string>();
        refreshedData.forEach((event: any) => {
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

  // Export EventsV2 table to CSV
  const handleExportCSV = () => {
    if (!sortedEventsV2 || sortedEventsV2.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "No data available to export."
      });
      return;
    }

    const headers = [
      "Row #",
      "Timestamp",
      "Mobilize Code",
      "City/Region",
      "Message Opened (Zipcode)",
      "Location Method",
      "Event Level",
      "utm_medium",
      "Instance",
      "utm_content",
      "Event ID",
      "Full URL"
    ];

    const csvRows = sortedEventsV2.map((event: any, index: number) => {
      const cityRegion = event.city && event.region ? `${event.city}, ${event.region}` : "";
      const utmContent = event.tokens?.events_actions?.mobilize_code && event.tokens?.events_actions?.utm_id
        ? `${event.tokens.events_actions.mobilize_code}-${event.tokens.events_actions.utm_id}`
        : "";
      
      return [
        index + 1,
        formatTimestamp(event.occurred_at),
        event.tokens?.events_actions?.mobilize_code || "",
        cityRegion,
        event.zip_code || "",
        event.location_source === 'gps' ? 'GPS' : 'Cell Tower',
        formatLevel(event.tokens?.level || 0),
        event.tokens?.utm_medium || "",
        event.tokens?.l00_instance || "",
        utmContent,
        event.id || "",
        event.tokens?.full_url || ""
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `campaign-events-${selectedCampaign}-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Exported ${sortedEventsV2.length} rows to CSV.`
    });
  };

  const handleClearSimulationData = async (scope: "current" | "all") => {
    if (scope === "current" && !selectedCampaign) {
      toast({
        variant: "destructive",
        title: "No campaign selected",
        description: "Select a campaign before clearing its simulation data."
      });
      return;
    }

    setIsClearingSimulationData(true);
    try {
      const rpcArgs = scope === "current" ? { _campaign_code: selectedCampaign } : {};
      const { data, error } = await supabase.rpc("clear_simulation_data", rpcArgs);
      if (error) throw error;

      await supabase.rpc("refresh_daily_aggregates");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["eventsV2"] }),
        queryClient.invalidateQueries({ queryKey: ["eventCounts"] }),
        queryClient.invalidateQueries({ queryKey: ["viralCoefficient"] }),
        queryClient.invalidateQueries({ queryKey: ["conversionFunnel"] }),
        queryClient.invalidateQueries({ queryKey: ["amplification"] }),
        queryClient.invalidateQueries({ queryKey: ["engagement"] }),
        queryClient.invalidateQueries({ queryKey: ["cycleTime"] }),
        queryClient.invalidateQueries({ queryKey: ["contentPerformance"] }),
        queryClient.invalidateQueries({ queryKey: ["geographic"] }),
      ]);
      fetchEvents();
      setMapRefreshKey((key) => key + 1);

      const result = data?.[0];
      toast({
        title: "Simulation data cleared",
        description: `${result?.deleted_events ?? 0} simulated events and ${result?.deleted_tokens ?? 0} simulated tokens removed${scope === "current" ? ` for ${campaignTitle}` : " across all campaigns"}.`
      });
    } catch (error) {
      console.error("Simulation cleanup failed:", error);
      toast({
        variant: "destructive",
        title: "Cleanup failed",
        description: error instanceof Error ? error.message : "Failed to clear simulation data."
      });
    } finally {
      setIsClearingSimulationData(false);
      setPendingSimulationClearScope(null);
    }
  };

  // Fetch eventsV2 (the main events table with rich filtering)
  const selectedLevels = levelFilter.split(",").map(Number);
  const {
    data: eventsV2Data,
    isLoading: eventsV2Loading
  } = useQuery({
    queryKey: ["eventsV2", selectedCampaign, eventTypeFilter, dataSourceFilter, levelFilter, startDate, endDate, hideLegacy, chapterFilter, chainRootTokenParam, chainTokenParam],
    queryFn: async () => {
      let query = supabase.from("url_events").select(`
        *,
        tokens!inner(
          level,
          deck_slug,
          utm_campaign,
          utm_medium,
          utm_content,
          eoa_id,
          l00_instance,
          full_url,
          root_token,
          events_actions(
            title,
            city,
            state,
            mobilize_code,
            utm_id
          )
        )
      `).eq("tokens.utm_campaign", selectedCampaign).order("occurred_at", { ascending: false });

      if (eventTypeFilter !== "all") query = query.eq("event_type", eventTypeFilter);
      if (dataSourceFilter === "real") query = query.eq("is_simulated", false);
      else if (dataSourceFilter === "simulated") query = query.eq("is_simulated", true);
      if (startDate) query = query.gte("occurred_at", startDate.toISOString());
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("occurred_at", endOfDay.toISOString());
      }

      const { data, error } = await query.limit(1000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCampaign
  });

  // Fetch event counts (token counts by level for selected campaign)
  const {
    data: eventCounts
  } = useQuery({
    queryKey: ["eventCounts", selectedCampaign, dataSourceFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("level, id")
        .eq("utm_campaign", selectedCampaign)
        .is("deleted_at", null);
      if (error) throw error;
      const counts: Record<number, number> = {};
      (data || []).forEach((t: any) => {
        counts[t.level] = (counts[t.level] || 0) + 1;
      });
      return counts;
    },
    enabled: !!selectedCampaign
  });

  // Compute eventsV2 filtered by chain view mode
  const filteredEventsV2 = eventsV2Data ? eventsV2Data.filter((event: any) => {
    if (chainViewMode === "chain" && selectedChainToken) {
      return event.tokens?.l00_instance === selectedChainToken || event.tokens?.root_token === selectedChainRootToken;
    }
    if (!selectedLevels.includes(event.tokens?.level ?? -1)) return false;
    return true;
  }) : [];

  // Sort eventsV2
  const sortedEventsV2 = [...filteredEventsV2].sort((a: any, b: any) => {
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    if (sortConfig.column === 'timestamp') return dir * (new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
    if (sortConfig.column === 'mobilize_code') return dir * ((a.tokens?.events_actions?.mobilize_code || "").localeCompare(b.tokens?.events_actions?.mobilize_code || ""));
    if (sortConfig.column === 'location') return dir * ((a.city || "").localeCompare(b.city || ""));
    if (sortConfig.column === 'zip') return dir * ((a.zip_code || "").localeCompare(b.zip_code || ""));
    if (sortConfig.column === 'level') return dir * ((a.tokens?.level ?? 0) - (b.tokens?.level ?? 0));
    return 0;
  });

  // Compute eventsV2 metrics summary
  const eventsV2Metrics = eventsV2Data ? (() => {
    const allDates = eventsV2Data.map((e: any) => new Date(e.occurred_at));
    const earliest = allDates.length > 0 ? new Date(Math.min(...allDates.map((d: Date) => d.getTime()))) : null;
    const latest = allDates.length > 0 ? new Date(Math.max(...allDates.map((d: Date) => d.getTime()))) : null;
    const mobilizeCodes = new Set(eventsV2Data.map((e: any) => e.tokens?.events_actions?.mobilize_code).filter(Boolean));
    const qrViewsCount = eventsV2Data.filter((e: any) => e.tokens?.utm_medium === 'qr').length;
    const smsViewsCount = eventsV2Data.filter((e: any) => e.tokens?.utm_medium === 'sms').length;
    const emailViewsCount = eventsV2Data.filter((e: any) => ['email', 'mail', 'em'].includes(e.tokens?.utm_medium)).length;
    const unknownViewsCount = eventsV2Data.filter((e: any) => !['qr','sms','email','mail','em'].includes(e.tokens?.utm_medium || '')).length;
    const gpsLocationCount = eventsV2Data.filter((e: any) => e.location_source === 'gps').length;
    const cellTowerLocationCount = eventsV2Data.filter((e: any) => e.location_source !== 'gps').length;
    return {
      earliestTimestamp: earliest ? format(earliest, "MMM d, h:mm a") : "—",
      latestTimestamp: latest ? format(latest, "MMM d, h:mm a") : "—",
      uniqueMobilizeCodes: mobilizeCodes.size,
      totalRows: filteredEventsV2.length,
      totalUnfilteredRows: eventsV2Data.length,
      qrViewsCount, smsViewsCount, emailViewsCount, unknownViewsCount,
      gpsLocationCount, cellTowerLocationCount,
    };
  })() : null;

  const handleSort = (column: string) => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const formatTimestamp = (ts: string) => {
    try { return format(new Date(ts), "MM/dd/yy HH:mm:ss"); } catch { return ts; }
  };

  const formatLevel = (level: number) => `L${String(level).padStart(2, '0')}`;

  const campaignTitle = campaigns?.find(c => c.code === selectedCampaign)?.title || selectedCampaign;

  // Tokens with spawn info for chapter/no-spawn filtering
  const {
    data: tokenSpawnData
  } = useQuery({
    queryKey: ["tokenSpawns", selectedCampaign, dataSourceFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("token, parent_token, level, eoa_id, is_simulated, deleted_at, utm_campaign")
        .eq("utm_campaign", selectedCampaign)
        .is("deleted_at", null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCampaign
  });

  // Compute chapters (unique L0 tokens with spawns)
  const chapters = tokenSpawnData ? (() => {
    const l0Tokens = tokenSpawnData.filter((t: any) => t.level === 0);
    const parentSet = new Set(tokenSpawnData.filter((t: any) => t.level > 0).map((t: any) => t.parent_token));
    return l0Tokens.filter((t: any) => parentSet.has(t.token)).map((t: any) => ({
      token: t.token,
      eoaId: t.eoa_id,
    }));
  })() : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaign Visibility</h1>
          <p className="text-muted-foreground">Real-time viral tracking and analytics</p>
        </div>
        <div className="flex items-center gap-2">
          {campaignsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
            <Select value={selectedCampaign} onValueChange={(val) => {
              const campaign = campaigns?.find(c => c.code === val);
              if (campaign) {
                const params = new URLSearchParams(searchParams);
                params.set("campaign", campaign.code);
                params.set("campaignId", campaign.id);
                setSearchParams(params);
              }
            }}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns?.map(c => (
                  <SelectItem key={c.id} value={c.code}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Tabs defaultValue="settings">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="settings">Scheduler</TabsTrigger>
          <TabsTrigger value="samizdat">Real-time Map</TabsTrigger>
          <TabsTrigger value="eventsv2">Events Listing</TabsTrigger>
          <TabsTrigger value="simulator">Simulator</TabsTrigger>
        </TabsList>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3 py-4 border-b">
          <Select value={dataSourceFilter} onValueChange={(val) => {
            const params = new URLSearchParams(searchParams);
            params.set("dataSource", val);
            setSearchParams(params);
          }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="real">Real Only</SelectItem>
              <SelectItem value="simulated">Simulated Only</SelectItem>
            </SelectContent>
          </Select>

          <AlertDialog open={pendingSimulationClearScope !== null} onOpenChange={(open) => !open && setPendingSimulationClearScope(null)}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isClearingSimulationData}>
                  {isClearingSimulationData ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Clear Simulation Data
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Simulation cleanup scope</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={!selectedCampaign} onSelect={() => setPendingSimulationClearScope("current")}>
                  Current campaign only
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPendingSimulationClearScope("all")}>
                  All campaigns
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{pendingSimulationClearScope === "all" ? "Clear simulation data for all campaigns?" : "Clear simulation data for this campaign?"}</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove simulated-only events and tokens {pendingSimulationClearScope === "all" ? "across every campaign" : `for ${campaignTitle || "the selected campaign"}`}. Real campaign data will not be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isClearingSimulationData}>Cancel</AlertDialogCancel>
                <AlertDialogAction disabled={isClearingSimulationData || pendingSimulationClearScope === null} onClick={() => pendingSimulationClearScope && handleClearSimulationData(pendingSimulationClearScope)}>
                  Clear simulation data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Select value={eventTypeFilter} onValueChange={(val) => {
            const params = new URLSearchParams(searchParams);
            params.set("eventType", val);
            setSearchParams(params);
          }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="view">Views</SelectItem>
              <SelectItem value="scan">Scans</SelectItem>
              <SelectItem value="share">Shares</SelectItem>
            </SelectContent>
          </Select>

          {/* Level toggles */}
          <div className="flex items-center gap-2">
            {[0,1,2,3].map(level => (
              <label key={level} className="flex items-center gap-1 cursor-pointer">
                <Checkbox
                  checked={selectedLevels.includes(level)}
                  onCheckedChange={(checked) => {
                    const params = new URLSearchParams(searchParams);
                    const newLevels = checked
                      ? [...selectedLevels, level]
                      : selectedLevels.filter(l => l !== level);
                    params.set("levels", newLevels.sort().join(","));
                    setSearchParams(params);
                  }}
                />
                <span className="text-sm">L{level}</span>
              </label>
            ))}
          </div>


          <label className="flex items-center gap-1 cursor-pointer text-sm">
            <Checkbox checked={showNoSpawns} onCheckedChange={(checked) => {
              const params = new URLSearchParams(searchParams);
              if (!checked) params.set("showNoSpawns", "false"); else params.delete("showNoSpawns");
              setSearchParams(params);
            }} />
            Show events having no spawns
          </label>
        </div>



          {/* EventsV2 Tab */}
          <TabsContent value="eventsv2" className="mt-6 animate-fade-in">
            <Card>
              <CardContent className="pt-6">
                {/* Chain filter indicator */}
                {chainViewMode === "chain" && selectedChainToken && (
                  <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        Lineage Filter Active
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Showing {sortedEventsV2.length} events in chain instance
                      </span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setChainViewMode("all");
                        setSelectedChainRootToken(null);
                        setSelectedChainToken(null);
                      }}
                    >
                      Clear Filter
                    </Button>
                  </div>
                )}
                
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
                        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!sortedEventsV2 || sortedEventsV2.length === 0}>
                          <Download className="h-4 w-4 mr-2" />
                          Export CSV
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Columns className="h-4 w-4 mr-2" />
                              Columns
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {(Object.keys(eventsColumnVisibility) as Array<keyof typeof eventsColumnVisibility>).map((col) => (
                              <DropdownMenuCheckboxItem
                                key={col}
                                checked={eventsColumnVisibility[col]}
                                onCheckedChange={(checked) =>
                                  setEventsColumnVisibility(prev => ({ ...prev, [col]: checked }))
                                }
                              >
                                {col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {selectedCampaign && selectedCampaignId && (
                          <CampaignNarrativeButton
                            campaignCode={selectedCampaign}
                            campaignId={selectedCampaignId}
                            campaignTitle={campaignTitle}
                            dataSource={dataSourceFilter}
                          />
                        )}
                      </div>
                    </div>

                    {/* Second Block - Metrics Summary */}
                    <div className="flex items-center gap-6 py-2 text-sm flex-wrap">
                      <span># Mobilize Sites: <strong>{eventsV2Metrics?.uniqueMobilizeCodes}</strong></span>
                      <span># Rows: <strong>{eventsV2Metrics?.totalRows}</strong>{chainViewMode === "chain" && eventsV2Metrics?.totalUnfilteredRows !== eventsV2Metrics?.totalRows && <span className="text-muted-foreground"> of {eventsV2Metrics?.totalUnfilteredRows}</span>}</span>
                      <span># QR Views: <strong>{eventsV2Metrics?.qrViewsCount}</strong></span>
                      <span># SMS Views: <strong>{eventsV2Metrics?.smsViewsCount}</strong></span>
                      <span># Email Views: <strong>{eventsV2Metrics?.emailViewsCount}</strong></span>
                      <span># Unknown: <strong>{eventsV2Metrics?.unknownViewsCount}</strong></span>
                    </div>
                    <div className="flex items-center gap-6 py-2 border-b mb-4 text-sm flex-wrap">
                      <span># Locations from GPS: <strong>{eventsV2Metrics?.gpsLocationCount}</strong></span>
                      <span># From Cell Tower: <strong>{eventsV2Metrics?.cellTowerLocationCount}</strong></span>
                    </div>

                    {/* Table */}
                    <div className="relative">
                      {/* Overlay when Event Story is open */}
                      {selectedEventId && (
                        <div 
                          className="absolute inset-0 z-10 cursor-pointer"
                          onClick={() => setSelectedEventId(null)}
                        />
                      )}
                      <ScrollArea className="h-[calc(100vh-300px)] min-h-[600px]">
                        <Table>
                          <TableHeader className="sticky top-0 z-10 bg-background">
                            <TableRow>
                              <TableHead className="w-[80px]">Row #</TableHead>
                              {eventsColumnVisibility.timestamp && <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('timestamp')}><div className="flex items-center gap-1">TimeStamp{sortConfig.column === 'timestamp' && <ArrowUpDown className="w-3 h-3" />}</div></TableHead>}
                              {eventsColumnVisibility.mobilize_code && <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('mobilize_code')}><div className="flex items-center gap-1">Mobilize Code{sortConfig.column === 'mobilize_code' && <ArrowUpDown className="w-3 h-3" />}</div></TableHead>}
                              {eventsColumnVisibility.city_region && <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('location')}><div className="flex items-center gap-1">City/Region{sortConfig.column === 'location' && <ArrowUpDown className="w-3 h-3" />}</div></TableHead>}
                              {eventsColumnVisibility.zip_code && <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('zip')}><div className="flex items-center gap-1">Message Opened (Zipcode){sortConfig.column === 'zip' && <ArrowUpDown className="w-3 h-3" />}</div></TableHead>}
                              {eventsColumnVisibility.location_method && <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('location_source')}><div className="flex items-center gap-1">Location Method{sortConfig.column === 'location_source' && <ArrowUpDown className="w-3 h-3" />}</div></TableHead>}
                              {eventsColumnVisibility.event_level && <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('level')}><div className="flex items-center gap-1">Event Level{sortConfig.column === 'level' && <ArrowUpDown className="w-3 h-3" />}</div></TableHead>}
                              {eventsColumnVisibility.utm_medium && <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('utm_medium')}><div className="flex items-center gap-1">utm_medium{sortConfig.column === 'utm_medium' && <ArrowUpDown className="w-3 h-3" />}</div></TableHead>}
                              {eventsColumnVisibility.utm_content && <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('utm_content')}><div className="flex items-center gap-1">utm_content{sortConfig.column === 'utm_content' && <ArrowUpDown className="w-3 h-3" />}</div></TableHead>}
                              {eventsColumnVisibility.instance && <TableHead>Instance</TableHead>}
                              {eventsColumnVisibility.event_id && <TableHead>Event ID</TableHead>}
                              {eventsColumnVisibility.full_url && <TableHead>Full URL</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedEventsV2.map((event: any, index: number) => <TableRow 
                              key={event.id} 
                              className={cn(
                                "cursor-pointer hover:bg-muted/50 transition-colors",
                                highlightedRowIds.has(event.id) ? 'bg-primary/10 animate-fade-in' : '',
                                selectedEventId === event.id ? 'bg-yellow-200/30 relative z-20' : ''
                              )}
                              onClick={() => setSelectedEventId(event.id)}
                            >
                              <TableCell>{index + 1}</TableCell>
                              {eventsColumnVisibility.timestamp && <TableCell className="font-mono text-xs">{formatTimestamp(event.occurred_at)}</TableCell>}
                              {eventsColumnVisibility.mobilize_code && <TableCell>{event.tokens?.events_actions?.mobilize_code || 'N/A'}</TableCell>}
                              {eventsColumnVisibility.city_region && <TableCell>{event.city && event.region ? `${event.city}, ${event.region}` : 'N/A'}</TableCell>}
                              {eventsColumnVisibility.zip_code && <TableCell>{event.zip_code || 'N/A'}</TableCell>}
                              {eventsColumnVisibility.location_method && <TableCell>{event.location_source === 'gps' ? 'GPS' : 'Cell Tower'}</TableCell>}
                              {eventsColumnVisibility.event_level && <TableCell><Badge variant="outline">{formatLevel(event.tokens?.level || 0)}</Badge></TableCell>}
                              {eventsColumnVisibility.utm_medium && <TableCell className="font-mono text-xs">{event.tokens?.utm_medium || 'N/A'}</TableCell>}
                              {eventsColumnVisibility.utm_content && <TableCell className="font-mono text-xs">{event.tokens?.events_actions?.mobilize_code && event.tokens?.events_actions?.utm_id ? `${event.tokens.events_actions.mobilize_code}-${event.tokens.events_actions.utm_id}` : 'N/A'}</TableCell>}
                              {eventsColumnVisibility.instance && <TableCell className="font-mono text-xs">{event.tokens?.l00_instance ? event.tokens.l00_instance.split(':')[1] || event.tokens.l00_instance : 'N/A'}</TableCell>}
                              {eventsColumnVisibility.event_id && <TableCell><span className="font-mono text-xs">{event.id}</span></TableCell>}
                              {eventsColumnVisibility.full_url && <TableCell>{event.tokens?.full_url ? <div className="flex items-center gap-2"><span className="font-mono text-xs truncate max-w-[300px]" title={event.tokens.full_url}>{event.tokens.full_url}</span><Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(event.tokens.full_url); toast({ title: "Full URL copied!" }); }}><Copy className="h-3 w-3" /></Button></div> : <span className="text-muted-foreground text-xs">No URL</span>}</TableCell>}
                            </TableRow>)}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
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

          <TabsContent value="samizdat" className="mt-6 animate-fade-in">
            <div className="space-y-4">
              {/* Header */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Samizdat</h2>
                <p className="text-muted-foreground">{campaignTitle ? `Campaign: ${campaignTitle}` : "Select a campaign"}</p>
              </div>

              {/* EoA selector - auto-selects all EoAs and passes them to the map */}
              {selectedCampaignId && (
                <SamizdatEoaSelector
                  campaignId={selectedCampaignId}
                  onEoaChange={setSelectedEoaIds}
                />
              )}

              {/* Map - filters by selected EoAs */}
              <SamizdatMap 
                eoaIds={selectedEoaIds}
                selectedRootToken={selectedChainRootToken}
                onRootTokenChange={setSelectedChainRootToken}
                selectedChainToken={selectedChainToken}
                onChainTokenChange={setSelectedChainToken}
                viewMode={chainViewMode}
                onViewModeChange={setChainViewMode}
                showNoSpawns={showNoSpawns}
                refreshKey={mapRefreshKey}
                dataSource={dataSourceFilter}
              />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-6 animate-fade-in">
            {selectedCampaignId && selectedCampaign ? (
              <CampaignSnapshotSettings
                campaignId={selectedCampaignId}
                campaignCode={selectedCampaign}
                campaignTitle={campaignTitle}
              />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Select a campaign to manage snapshot settings.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

      {/* Event Story Dialog */}
      <EventStoryDialog
        eventId={selectedEventId}
        open={!!selectedEventId}
        onOpenChange={(open) => !open && setSelectedEventId(null)}
      />
    </div>
  );
}

