import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, MapPin, Smartphone, TrendingUp, ArrowUpDown, Trash2, Copy, RefreshCw, Download } from "lucide-react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { EventStoryDialog } from "@/components/EventStoryDialog";
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
  const [selectedEoaIds, setSelectedEoaIds] = useState<string[]>([]);
  const [highlightedRowIds, setHighlightedRowIds] = useState<Set<string>>(new Set());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  
  // Chain filter state (shared between Samizdat and EventsV2 tabs via URL params)
  const chainRootTokenParam = searchParams.get("chainRoot");
  const chainViewMode = chainRootTokenParam ? "chain" : "all";
  const selectedChainRootToken = chainRootTokenParam;
  
  const setSelectedChainRootToken = (token: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (token) {
      newParams.set("chainRoot", token);
    } else {
      newParams.delete("chainRoot");
    }
    setSearchParams(newParams);
  };
  
  const setChainViewMode = (mode: "all" | "chain") => {
    if (mode === "all") {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("chainRoot");
      setSearchParams(newParams);
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
  const dataSourceFilter = (searchParams.get("dataSource") || "real") as "real" | "simulated" | "both";
  const levelFilter = searchParams.get("levels") || "0,1,2,3";
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const [startDate, setStartDate] = useState<Date | undefined>(
    startDateParam ? new Date(startDateParam) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    endDateParam ? new Date(endDateParam) : undefined
  );

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
      "utm_content",
      "Event Type",
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
        utmContent,
        event.event_type?.toUpperCase() || "",
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

  // Fetch total event counts (not limited to last 50)
  const {
    data: eventCounts
  } = useQuery({
    queryKey: ["eventCounts", selectedCampaign, dataSourceFilter, startDate, endDate],
    queryFn: async () => {
      let baseQuery = supabase.from("url_events").select("event_type, occurred_at, tokens!inner(utm_campaign)", {
        count: "exact",
        head: false
      }).eq("tokens.utm_campaign", selectedCampaign);
      if (dataSourceFilter === "real") {
        baseQuery = baseQuery.eq("is_simulated", false);
      } else if (dataSourceFilter === "simulated") {
        baseQuery = baseQuery.eq("is_simulated", true);
      }
      if (startDate) {
        baseQuery = baseQuery.gte("occurred_at", startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        baseQuery = baseQuery.lte("occurred_at", endOfDay.toISOString());
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
    queryKey: ["eventsV2", selectedCampaign, eventTypeFilter, dataSourceFilter, startDate, endDate],
    queryFn: async () => {
      let query = supabase.from("url_events").select(`
          id,
          occurred_at,
          event_type,
          city,
          region,
          zip_code,
          location_source,
          token,
          tokens!inner(
            level,
            utm_content,
            utm_campaign,
            utm_medium,
            eoa_id,
            full_url,
            root_token,
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
      if (startDate) {
        query = query.gte("occurred_at", startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("occurred_at", endOfDay.toISOString());
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
          location_source: event.location_source,
          token: event.token,
          tokens: {
            level: event.tokens?.level,
            utm_content: event.tokens?.utm_content,
            utm_campaign: event.tokens?.utm_campaign,
            utm_medium: event.tokens?.utm_medium,
            eoa_id: event.tokens?.eoa_id,
            full_url: event.tokens?.full_url,
            root_token: event.tokens?.root_token,
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
    qrViewsCount: eventsV2Data.filter((e: any) => e.event_type === 'view' && e.tokens?.utm_medium === 'qr').length,
    smsViewsCount: eventsV2Data.filter((e: any) => e.event_type === 'view' && e.tokens?.utm_medium === 'sms').length,
    emailViewsCount: eventsV2Data.filter((e: any) => e.event_type === 'view' && e.tokens?.utm_medium === 'em').length,
    unknownViewsCount: eventsV2Data.filter((e: any) => e.event_type === 'view' && !['qr', 'sms', 'em'].includes(e.tokens?.utm_medium)).length,
    gpsLocationCount: eventsV2Data.filter((e: any) => e.location_source === 'gps').length,
    cellTowerLocationCount: eventsV2Data.filter((e: any) => e.location_source !== 'gps').length,
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
  // Filter and sort EventsV2 - apply chain filter if active
  const filteredEventsV2 = eventsV2Data ? (
    chainViewMode === "chain" && selectedChainRootToken
      ? eventsV2Data.filter((e: any) => e.tokens?.root_token === selectedChainRootToken)
      : eventsV2Data
  ) : [];
  
  const sortedEventsV2 = [...filteredEventsV2].sort((a: any, b: any) => {
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
  });

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
          <TabsList className="grid w-full max-w-4xl grid-cols-6">
            <TabsTrigger value="filters">Filters</TabsTrigger>
            <TabsTrigger value="eventsv2">EventsV2</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="simulator">Simulator</TabsTrigger>
            <TabsTrigger value="samizdat">Samizdat</TabsTrigger>
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Start Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "PPP") : <span>Pick start date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => {
                            setStartDate(date);
                            const params = new URLSearchParams(searchParams);
                            if (date) {
                              params.set("startDate", date.toISOString());
                            } else {
                              params.delete("startDate");
                            }
                            setSearchParams(params);
                          }}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">End Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "PPP") : <span>Pick end date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={(date) => {
                            setEndDate(date);
                            const params = new URLSearchParams(searchParams);
                            if (date) {
                              params.set("endDate", date.toISOString());
                            } else {
                              params.delete("endDate");
                            }
                            setSearchParams(params);
                          }}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {(startDate || endDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStartDate(undefined);
                      setEndDate(undefined);
                      const params = new URLSearchParams(searchParams);
                      params.delete("startDate");
                      params.delete("endDate");
                      setSearchParams(params);
                    }}
                  >
                    Clear Date Filters
                  </Button>
                )}
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
                {/* Chain filter indicator */}
                {chainViewMode === "chain" && selectedChainRootToken && (
                  <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        Chain Filter Active
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Showing {sortedEventsV2.length} events in chain (root: {selectedChainRootToken.slice(0, 20)}...)
                      </span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setChainViewMode("all");
                        setSelectedChainRootToken(null);
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
                      </div>
                    </div>

                    {/* Second Block - Metrics Summary */}
                    <div className="flex items-center gap-6 py-2 text-sm flex-wrap">
                      <span># Mobilize Sites: <strong>{eventsV2Metrics?.uniqueMobilizeCodes}</strong></span>
                      <span># Rows: <strong>{eventsV2Metrics?.totalRows}</strong></span>
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
                                  Message Opened (Zipcode)
                                  {sortConfig.column === 'zip' && <ArrowUpDown className="w-3 h-3" />}
                                </div>
                              </TableHead>
                              <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('location_source')}>
                                <div className="flex items-center gap-1">
                                  Location Method
                                  {sortConfig.column === 'location_source' && <ArrowUpDown className="w-3 h-3" />}
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
                              <TableHead>Full URL</TableHead>
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
                <TableCell className="font-mono text-xs">{formatTimestamp(event.occurred_at)}</TableCell>
                <TableCell>{event.tokens?.events_actions?.mobilize_code || 'N/A'}</TableCell>
                <TableCell>
                  {event.city && event.region ? `${event.city}, ${event.region}` : 'N/A'}
                </TableCell>
                <TableCell>{formatZipCode(event.zip_code)}</TableCell>
                <TableCell>{event.location_source === 'gps' ? 'GPS' : 'Cell Tower'}</TableCell>
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
                                {event.tokens?.full_url ? <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs truncate max-w-[300px]" title={event.tokens.full_url}>{event.tokens.full_url}</span>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(event.tokens.full_url);
                              toast({
                                title: "Full URL copied!"
                              });
                            }}>
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div> : <span className="text-muted-foreground text-xs">No URL</span>}
                              </TableCell>
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
                <p className="text-muted-foreground">Mode 1: Spark</p>
              </div>

              {/* EoA Selector in Accordion */}
              <Accordion type="single" collapsible defaultValue="eoa-selector">
                <AccordionItem value="eoa-selector" className="rounded-lg border border-border bg-card px-4">
                  <AccordionTrigger className="text-sm font-medium py-3 hover:no-underline">
                    Event or Action (EoA)
                  </AccordionTrigger>
                  <AccordionContent>
                    <SamizdatEoaSelector campaignId={selectedCampaignId} onEoaChange={setSelectedEoaIds} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Map - filters by selected EoAs */}
              <SamizdatMap 
                eoaIds={selectedEoaIds}
                selectedRootToken={selectedChainRootToken}
                onRootTokenChange={setSelectedChainRootToken}
                viewMode={chainViewMode}
                onViewModeChange={setChainViewMode}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Event Story Dialog */}
      <EventStoryDialog
        eventId={selectedEventId}
        open={!!selectedEventId}
        onOpenChange={(open) => !open && setSelectedEventId(null)}
      />
    </div>;
}