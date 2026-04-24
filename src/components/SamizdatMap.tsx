import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Maximize2, X, Play, Pause, RotateCcw, Search } from "lucide-react";
import { MapMagnifier } from "@/components/MapMagnifier";
import { Slider } from "@/components/ui/slider";
import { formatElapsedTime } from "@/lib/dateUtils";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { EventStoryPanel } from "@/components/EventStoryPanel";

// Fix Leaflet default icon paths
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface SamizdatMapProps {
  eoaIds: string[];
  // Chain filter state (lifted to parent for cross-tab sync)
  selectedRootToken?: string | null;
  onRootTokenChange?: (token: string | null) => void;
  selectedChainToken?: string | null;
  onChainTokenChange?: (token: string | null) => void;
  viewMode?: "all" | "chain";
  onViewModeChange?: (mode: "all" | "chain") => void;
  /** When false (default), hide L00 markers that have no engaged spawns */
  showNoSpawns?: boolean;
  /** Increment to force a data re-fetch (e.g. from realtime events) */
  refreshKey?: number;
  /** Filter by real, simulated, or both data sources */
  dataSource?: "real" | "simulated" | "both";
}

// 3-state engagement model (PRD_Share_Flow_Visualization.md)
type EngagementState = "none" | "intent" | "completed";

const ENGAGEMENT_BORDER_COLORS: Record<EngagementState, string> = {
  none: "#ffffff",      // white — opened, no share
  intent: "#f59e0b",    // amber — share button tapped
  completed: "#06b6d4", // cyan — recipient opened
};

const ENGAGEMENT_LABELS: Record<EngagementState, string> = {
  none: "Opened",
  intent: "Share Intent",
  completed: "Share Completed",
};

interface EventPoint {
  eventId: string;
  eoaId: string;
  zipCode: string | null;  // Can be null for international events
  latitude: number;
  longitude: number;
  occurredAt: string;
  utmMedium: string;
  utmId: string;
  // Chain visualization fields
  token: string;
  rootToken: string;
  parentToken: string | null;
  level: number;
  l00Instance: string | null;
  // International event fields
  isInternational?: boolean;
  country?: string | null;
  countryCode?: string | null;
  city?: string | null;
  // Spawn data for L00 markers
  spawnCount?: number;
  // Engagement state for border color
  engagementState: EngagementState;
  // Scan-location timezone (IANA, from zip_codes table)
  timezone?: string | null;
}

interface ZipAggregate {
  zipCode: string;
  latitude: number;
  longitude: number;
  total: number;
  byMedium: Record<string, number>;
  isInternational?: boolean;
  country?: string | null;
  city?: string | null;
}

interface ViewportStats {
  medium: string; // Actually stores EoaShape now for filtering
  label: string;
  total: number;
  visible: number;
  offscreen: number;
  color: string;
  shape?: EoaShape; // The actual shape for rendering
}

// Marker shapes based on utm_medium
type EoaShape = "circle" | "square" | "triangle" | "diamond";

// View mode for the map
type ViewMode = "all" | "chain";

// Colors by share medium (utm_medium)
const MEDIUM_COLORS: Record<string, string> = {
  qr: "#000099",   // QR code - dark blue
  em: "#0066ff",   // email - medium blue
  sms: "#00cc66",  // text/SMS - green
  tx: "#00cc66",   // text alternate code - green
  fb: "#1877f2",   // Facebook - FB blue
  bs: "#0085ff",   // BlueSky - sky blue
  li: "#0a66c2",   // LinkedIn - blue
  x: "#111111",    // X/Twitter - black
  social: "#64748b", // generic social
  p2p: "#64748b",  // peer-to-peer
};

const MEDIUM_LABELS: Record<string, string> = {
  qr: "QR Code",
  em: "Email",
  sms: "Text (SMS)",
  tx: "Text (SMS)",
  fb: "Facebook",
  bs: "BlueSky",
  li: "LinkedIn",
  x: "X",
  social: "Social",
  p2p: "Peer-to-peer",
};

// Colors by level (contrast-verified against border colors white/amber/cyan)
const LEVEL_COLORS: Record<number, string> = {
  0: "#1e293b", // L00 - dark (organization origin, max border contrast)
  1: "#22c55e", // L01 - green (first viral hop)
  2: "#a855f7", // L02 - purple (second viral hop)
  3: "#ef4444", // L03+ - red (level cap)
};

// Get level color (L03 and above use same color)
const getLevelColor = (level: number): string => {
  if (level >= 3) return LEVEL_COLORS[3];
  return LEVEL_COLORS[level] || LEVEL_COLORS[0];
};

const SOCIAL_MEDIUMS = new Set(["fb", "bs", "li", "x", "social", "p2p"]);

// Share medium shape mapping based on utm_medium
const getShareMediumShape = (utmMedium: string): EoaShape => {
  if (!utmMedium) return "diamond";
  const medium = utmMedium.toLowerCase();
  
  if (medium === "qr") return "circle";           // QR seed/open
  if (medium === "em") return "square";           // Email seed/share
  if (medium === "sms" || medium === "tx") return "triangle"; // SMS/Text seed/share
  if (SOCIAL_MEDIUMS.has(medium)) return "diamond"; // Social seed/share
  
  return "diamond"; // explicit non-QR fallback
};

// Share medium shape labels for legend
const SHARE_MEDIUM_LABELS: Record<EoaShape, string> = {
  circle: "QR Scan",
  square: "Email",
  triangle: "SMS/Text",
  diamond: "Social/P2P",
};

// Generate SVG for marker shape
// engagementState controls border color: white (none), amber (intent), cyan (completed)
const getShapeSVG = (shape: EoaShape, fillColor: string, size: number = 14, engagementState: EngagementState = "none"): string => {
  const strokeWidth = 2;
  const halfStroke = strokeWidth / 2;
  const strokeColor = ENGAGEMENT_BORDER_COLORS[engagementState];
  
  switch (shape) {
    case "square":
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${halfStroke}" y="${halfStroke}" width="${size - strokeWidth}" height="${size - strokeWidth}" 
          fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" rx="2"/>
      </svg>`;
    case "triangle":
      // Use same padding as circle for visual size consistency
      const cx = size / 2;
      const topY = halfStroke;
      const bottomY = size - halfStroke;
      const leftX = halfStroke;
      const rightX = size - halfStroke;
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <polygon points="${cx},${topY} ${rightX},${bottomY} ${leftX},${bottomY}" 
          fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
      </svg>`;
    case "diamond":
      const mid = size / 2;
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <polygon points="${mid},${halfStroke} ${size - halfStroke},${mid} ${mid},${size - halfStroke} ${halfStroke},${mid}" 
          fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
      </svg>`;
    case "circle":
    default:
      const r = (size / 2) - halfStroke;
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" 
          fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
      </svg>`;
  }
};

const DEFAULT_COLOR = "#64748b"; // slate-500

// Create chronological sequence numbers for all events
const createSequenceNumbers = (eventPoints: EventPoint[]): Map<string, number> => {
  const sorted = [...eventPoints].sort((a, b) => 
    new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );
  const seqMap = new Map<string, number>();
  sorted.forEach((event, index) => {
    seqMap.set(event.eventId, index + 1); // 1-based numbering
  });
  return seqMap;
};

const SamizdatMap = ({ 
  eoaIds, 
  selectedRootToken: externalRootToken,
  onRootTokenChange,
  selectedChainToken: externalChainToken,
  onChainTokenChange,
  viewMode: externalViewMode,
  onViewModeChange,
  showNoSpawns = false,
  refreshKey,
  dataSource = "real",
}: SamizdatMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const polylineLayerRef = useRef<L.LayerGroup | null>(null);
  const highlightMarkerRef = useRef<L.Marker | null>(null);
  const zipMarkersRef = useRef<L.Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventPoints, setEventPoints] = useState<EventPoint[]>([]);
  const [eoaNames, setEoaNames] = useState<Record<string, string>>({});
  const [eoaStartDates, setEoaStartDates] = useState<Record<string, string>>({});
  const [showZipCounts, setShowZipCounts] = useState(false);
  const [enableClustering, setEnableClustering] = useState(false);
  const [viewportStats, setViewportStats] = useState<ViewportStats[]>([]);
  // Timeline playback state
  const [timelinePosition, setTimelinePosition] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [highlightedEventIndex, setHighlightedEventIndex] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [enabledChannels, setEnabledChannels] = useState<Set<EoaShape>>(new Set(["circle", "square", "triangle"]));
  const [loupeActive, setLoupeActive] = useState(false);
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  // Invert parent semantics: parent checked="show all" → map unchecked="don't hide"
  const [showNoSpawnsLocal, setShowNoSpawnsLocal] = useState(!showNoSpawns);

  useEffect(() => {
    setShowNoSpawnsLocal(!showNoSpawns);
  }, [showNoSpawns]);

  // Tick every 2s so the staleness filter re-evaluates smoothly during animation
  const [stalenessTick, setStalenessTick] = useState(0);
  useEffect(() => {
    if (!showNoSpawnsLocal) return; // filter is active only when toggle is ON
    const id = setInterval(() => setStalenessTick(t => t + 1), 2_000);
    return () => clearInterval(id);
  }, [showNoSpawnsLocal]);
  
  // View mode: use external state if provided, otherwise use internal state
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>("all");
  const [internalRootToken, setInternalRootToken] = useState<string | null>(null);
  const [internalChainToken, setInternalChainToken] = useState<string | null>(null);
  
  // Selected L00 instance for chain filtering (simple approach)
  const [selectedL00Instance, setSelectedL00Instance] = useState<string | null>(null);
  
  // Determine which state to use (external or internal)
  const viewMode = externalViewMode ?? internalViewMode;
  const selectedRootToken = externalRootToken ?? internalRootToken;
  const selectedChainToken = externalChainToken ?? internalChainToken;
  
  const setViewMode = (mode: ViewMode) => {
    if (onViewModeChange) {
      onViewModeChange(mode);
    } else {
      setInternalViewMode(mode);
    }
  };
  
  const setSelectedRootToken = (token: string | null) => {
    if (onRootTokenChange) {
      onRootTokenChange(token);
    } else {
      setInternalRootToken(token);
    }
  };
  
  const setSelectedChainToken = (token: string | null) => {
    if (onChainTokenChange) {
      onChainTokenChange(token);
    } else {
      setInternalChainToken(token);
    }
  };

  // Token lookup map for tracing parent chain
  const tokenLookupRef = useRef<Record<string, { rootToken: string; parentToken: string | null; level: number }>>({});

  // Toggle an EoA type shape on/off
  const toggleChannel = (shape: EoaShape) => {
    setEnabledChannels(prev => {
      const next = new Set(prev);
      if (next.has(shape)) {
        next.delete(shape);
      } else {
        next.add(shape);
      }
      return next;
    });
  };

  // Store eoaNames in ref for cluster popup access
  const eoaNamesRef = useRef(eoaNames);
  eoaNamesRef.current = eoaNames;

  // Filter events based on selected time window and enabled share mediums
  // In chain mode, skip the medium filter (show all shapes for the chain)
  const filteredEventPoints = useMemo(() => {
    let filtered = eventPoints;

    // Filter by enabled share mediums (skip in chain mode - show all)
    if (viewMode !== "chain") {
      filtered = filtered.filter(event => enabledChannels.has(getShareMediumShape(event.utmMedium)));
    }

    // Compute timeline cutoff — scoped to chain events when in chain mode
    let timelineCutoff: number | null = null;
    if (timelinePosition < 1.0) {
      let goLive: number;
      let latest: number;

      if (viewMode === "chain" && selectedL00Instance) {
        // Use chain's own time range
        const chainEvents = filtered.filter(e => e.l00Instance === selectedL00Instance);
        const chainTimes = chainEvents.map(e => new Date(e.occurredAt).getTime());
        goLive = chainTimes.length > 0 ? Math.min(...chainTimes) : 0;
        latest = chainTimes.length > 0 ? Math.max(...chainTimes) : 0;
      } else {
        const startDates = Object.values(eoaStartDates).map(d => new Date(d).getTime()).filter(t => t > 0);
        goLive = startDates.length > 0 ? Math.min(...startDates) : 0;
        latest = eventPoints.reduce((max, e) => Math.max(max, new Date(e.occurredAt).getTime()), 0);
      }

      const totalDuration = latest - goLive;
      if (totalDuration > 0 && goLive > 0) {
        timelineCutoff = goLive + totalDuration * timelinePosition;
        filtered = filtered.filter(e => new Date(e.occurredAt).getTime() <= timelineCutoff!);
      }
    }

    // Apply spawn filter: hide events with engagement "none" older than 2 days
    // When toggle is ON ("Hide stale opens"), remove stale "opened-only" markers
    // If they later gain intent/completed engagement, they reappear automatically
    // Uses timeline cursor time during playback, wall-clock time otherwise
    if (showNoSpawnsLocal) {
      const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
      const referenceTime = timelineCutoff ?? Date.now();
      filtered = filtered.filter(e => {
        if (e.engagementState !== "none") return true;
        const eventTime = new Date(e.occurredAt).getTime();
        return (referenceTime - eventTime) < TWO_DAYS_MS;
      });
    }

    return filtered;
  }, [eventPoints, showNoSpawnsLocal, timelinePosition, eoaStartDates, enabledChannels, viewMode, selectedL00Instance, stalenessTick]);

  // Escape key handler for fullscreen mode
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    
    if (isFullscreen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isFullscreen]);

  // Update selected L00 instance when chain token is selected
  useEffect(() => {
    if (!selectedChainToken || viewMode !== "chain") {
      console.log("[SamizdatMap] Clearing L00 instance filter");
      setSelectedL00Instance(null);
      return;
    }
    
    // Find the l00_instance for the selected token from eventPoints
    const selectedEvent = eventPoints.find(ep => ep.token === selectedChainToken);
    if (selectedEvent?.l00Instance) {
      console.log("[SamizdatMap] Setting L00 instance filter to:", selectedEvent.l00Instance);
      setSelectedL00Instance(selectedEvent.l00Instance);
    } else {
      // Fallback: fetch l00_instance from database
      console.log("[SamizdatMap] Fetching L00 instance from DB for token:", selectedChainToken);
      supabase
        .from("tokens")
        .select("l00_instance")
        .eq("token", selectedChainToken)
        .single()
        .then(({ data }) => {
          if (data?.l00_instance) {
            console.log("[SamizdatMap] Found L00 instance from DB:", data.l00_instance);
            setSelectedL00Instance(data.l00_instance);
          }
        });
    }
  }, [selectedChainToken, viewMode, eventPoints]);

  // Events to display based on view mode - now using simple l00_instance filter
  const displayEvents = useMemo((): EventPoint[] => {
    if (viewMode === "all") {
      return filteredEventPoints;
    }
    // Chain mode: filter to events with matching l00_instance
    if (!selectedL00Instance) {
      console.log("[SamizdatMap] No L00 instance selected, showing nothing in chain mode");
      return [];
    }
    console.log("[SamizdatMap] Filtering by L00 instance:", selectedL00Instance);
    const filtered = filteredEventPoints.filter(ep => ep.l00Instance === selectedL00Instance);
    console.log("[SamizdatMap] Filtered to", filtered.length, "events");
    return filtered;
  }, [filteredEventPoints, viewMode, selectedL00Instance]);

  // Chain events sorted chronologically for arrow-key stepping
  const chainEventsOrdered = useMemo((): EventPoint[] => {
    if (viewMode !== "chain" || displayEvents.length === 0) return [];
    return [...displayEvents].sort((a, b) =>
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );
  }, [viewMode, displayEvents]);

  // Timeline-derived computed values — scoped to chain events when in chain mode
  const { goLiveTime, latestEventTime, totalDurationMs } = useMemo(() => {
    if (viewMode === "chain" && displayEvents.length > 0) {
      // Use the chain's own first/last event times
      const times = displayEvents.map(e => new Date(e.occurredAt).getTime());
      const goLive = Math.min(...times);
      const latest = Math.max(...times);
      return { goLiveTime: goLive, latestEventTime: latest, totalDurationMs: latest - goLive };
    }
    const startDates = Object.values(eoaStartDates).map(d => new Date(d).getTime()).filter(t => t > 0);
    const goLive = startDates.length > 0 ? Math.min(...startDates) : 0;
    const latest = eventPoints.reduce((max, e) => Math.max(max, new Date(e.occurredAt).getTime()), 0);
    return { goLiveTime: goLive, latestEventTime: latest, totalDurationMs: latest - goLive };
  }, [eoaStartDates, eventPoints, viewMode, displayEvents]);

  // Playback animation loop
  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number;
    let lastTime: number | null = null;

    const step = (timestamp: number) => {
      if (lastTime !== null) {
        const deltaMs = timestamp - lastTime;
        setTimelinePosition(prev => {
          const easeMultiplier = 0.25 + 1.5 * prev;
          const scaledFraction = (deltaMs / 30000) * playbackSpeed * easeMultiplier;
          const next = prev + scaledFraction;
          if (next >= 1) {
            setIsPlaying(false);
            return 1;
          }
          return next;
        });
      }
      lastTime = timestamp;
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, playbackSpeed]);

  // Viewport stats use the same filtered set as the rendered markers (unified pipeline)
  const timeFilteredEvents = useMemo(() => {
    if (timelinePosition >= 1.0) return filteredEventPoints;
    if (totalDurationMs <= 0 || goLiveTime === 0) return filteredEventPoints;
    const cutoff = goLiveTime + totalDurationMs * timelinePosition;
    return filteredEventPoints.filter(e => new Date(e.occurredAt).getTime() <= cutoff);
  }, [filteredEventPoints, timelinePosition, goLiveTime, totalDurationMs]);

  // Calculate viewport stats using time-filtered events (by share medium)
  const updateViewportStats = useCallback(() => {
    if (!mapRef.current || timeFilteredEvents.length === 0) {
      setViewportStats([]);
      return;
    }

    const bounds = mapRef.current.getBounds();
    
    // Group events by share medium shape
    const statsMap: Record<EoaShape, { total: number; visible: number }> = {
      circle: { total: 0, visible: 0 },
      square: { total: 0, visible: 0 },
      triangle: { total: 0, visible: 0 },
      diamond: { total: 0, visible: 0 },
    };

    timeFilteredEvents.forEach((event) => {
      const shape = getShareMediumShape(event.utmMedium);
      statsMap[shape].total++;
      
      // Check if point is within current viewport bounds
      if (bounds.contains([event.latitude, event.longitude])) {
        statsMap[shape].visible++;
      }
    });

    // Convert to array with labels - use shape as the key
    const stats: ViewportStats[] = (Object.entries(statsMap) as [EoaShape, { total: number; visible: number }][])
      .filter(([_, counts]) => counts.total > 0)
      .map(([shape, counts]) => ({
        medium: shape, // Store shape as the medium key for filtering
        label: SHARE_MEDIUM_LABELS[shape],
        total: counts.total,
        visible: counts.visible,
        offscreen: counts.total - counts.visible,
        color: DEFAULT_COLOR, // Use default color since we show shapes instead
        shape: shape, // Add shape for rendering
      }))
      .sort((a, b) => b.total - a.total); // Sort by total count descending

    setViewportStats(stats);
  }, [timeFilteredEvents]);

  // Fetch event-level data with token chain info
  // Use stable string key to avoid re-fetching on every reference change
  const eoaIdsKey = eoaIds.slice().sort().join(",");
  
  useEffect(() => {
    const fetchEventData = async () => {
      if (!eoaIds.length) {
        setEventPoints([]);
        setLoading(false);
        return;
      }
      
      console.log("[SamizdatMap] Fetching event data for EoA IDs:", eoaIds);

      setLoading(true);

      // Step 1: Get EoA data including mobilize_code for grouping
      const { data: eoas, error: eoasError } = await supabase
        .from("events_actions")
        .select("id, title, utm_id, mobilize_code, type")
        .in("id", eoaIds);

      if (eoasError || !eoas?.length) {
        console.log("No EoAs found:", eoaIds);
        setEventPoints([]);
        setLoading(false);
        return;
      }

      const names: Record<string, string> = {};
      const utmIds: Record<string, string> = {};
      const eoaMobilizeCodes: Record<string, string | null> = {};
      const eoaTypes: Record<string, string> = {};
      eoas.forEach((eoa) => {
        names[eoa.id] = eoa.title || eoa.id.slice(0, 8);
        utmIds[eoa.id] = eoa.utm_id || "";
        eoaMobilizeCodes[eoa.id] = eoa.mobilize_code || null;
        eoaTypes[eoa.id] = eoa.type || "Event";
      });
      setEoaNames(names);

      // Step 2: Get tokens for selected EoAs (include chain fields + l00_instance)
      let tokensQuery = supabase
        .from("tokens")
        .select("token, eoa_id, utm_medium, utm_id, root_token, parent_token, level, l00_instance")
        .in("eoa_id", eoaIds);
      if (dataSource === "real") tokensQuery = tokensQuery.eq("is_simulated", false);
      else if (dataSource === "simulated") tokensQuery = tokensQuery.eq("is_simulated", true);
      const { data: tokens, error: tokensError } = await tokensQuery;

      if (tokensError || !tokens?.length) {
        console.log("No tokens found for EoAs:", eoaIds);
        setEventPoints([]);
        setLoading(false);
        return;
      }

      const tokenList = tokens.map((t) => t.token);
      const tokenData: Record<string, { 
        eoaId: string; 
        utmMedium: string;
        utmId: string;
        rootToken: string; 
        parentToken: string | null; 
        level: number;
        l00Instance: string | null;
      }> = {};
      
      // Build token lookup for parent chain tracing
      const tokenLookup: Record<string, { rootToken: string; parentToken: string | null; level: number }> = {};
      
      tokens.forEach((t) => {
        const eoaUtmId = utmIds[t.eoa_id] || t.utm_id || "";
        tokenData[t.token] = {
          eoaId: t.eoa_id,
          utmMedium: t.utm_medium || "unknown",
          utmId: eoaUtmId,
          rootToken: t.root_token || t.token,
          parentToken: t.parent_token,
          level: t.level,
          l00Instance: t.l00_instance,
        };
        tokenLookup[t.token] = {
          rootToken: t.root_token || t.token,
          parentToken: t.parent_token,
          level: t.level,
        };
      });
      
      tokenLookupRef.current = tokenLookup;

      // Step 3: Get ALL view events - both with zip codes AND international events with lat/lon
      let eventsWithZipQuery = supabase
        .from("url_events")
        .select("id, token, zip_code, occurred_at, latitude, longitude, country, country_code, city")
        .in("token", tokenList)
        .eq("event_type", "view")
        .not("zip_code", "is", null);
      if (dataSource === "real") eventsWithZipQuery = eventsWithZipQuery.eq("is_simulated", false);
      else if (dataSource === "simulated") eventsWithZipQuery = eventsWithZipQuery.eq("is_simulated", true);
      const { data: eventsWithZip, error: eventsError } = await eventsWithZipQuery;

      // Also fetch international events (have lat/lon but no zip_code)
      let intlQuery = supabase
        .from("url_events")
        .select("id, token, zip_code, occurred_at, latitude, longitude, country, country_code, city")
        .in("token", tokenList)
        .eq("event_type", "view")
        .is("zip_code", null)
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (dataSource === "real") intlQuery = intlQuery.eq("is_simulated", false);
      else if (dataSource === "simulated") intlQuery = intlQuery.eq("is_simulated", true);
      const { data: intlEvents, error: intlError } = await intlQuery;

      // Combine both event sets
      const events = [...(eventsWithZip || []), ...(intlEvents || [])];

      if ((eventsError && intlError) || !events.length) {
        console.log("No view events found");
        setEventPoints([]);
        setLoading(false);
        return;
      }

      // Step 3a: Batch-fetch IANA timezones from zip_codes for all unique zip codes
      const tzZips = [...new Set(events.map(e => e.zip_code).filter(Boolean))] as string[];
      const zipTimezoneMap: Record<string, string> = {};
      if (tzZips.length > 0) {
        const { data: zipTzData } = await supabase
          .from("zip_codes")
          .select("zip_code, timezone")
          .in("zip_code", tzZips);
        if (zipTzData) {
          zipTzData.forEach(z => {
            if (z.timezone) zipTimezoneMap[z.zip_code] = z.timezone;
          });
        }
      }

      // Step 3b: Fetch spawn counts AND engagement state for all tokens
      // For each token, determine: none (no children), intent (has child), completed (child has view)
      const allTokenStrings = tokens.map(t => t.token);
      const spawnCounts: Record<string, number> = {};
      const engagementStates: Record<string, EngagementState> = {};

      // Get all child tokens (tokens whose parent_token is in our set)
      const { data: childTokens } = await supabase
        .from("tokens")
        .select("token, parent_token, l00_instance")
        .in("parent_token", allTokenStrings)
        .is("deleted_at", null);
      
      if (childTokens && childTokens.length > 0) {
        // Mark all parents as "intent" (they have at least one child)
        const parentTokensWithChildren = new Set(childTokens.map(t => t.parent_token).filter(Boolean));
        parentTokensWithChildren.forEach(pt => {
          engagementStates[pt!] = "intent";
        });

        // Check which child tokens have view events (completion)
        const childTokenStrings = childTokens.map(t => t.token);
        const { data: childViewEvents } = await supabase
          .from("url_events")
          .select("token")
          .in("token", childTokenStrings)
          .eq("event_type", "view");
        
        const childrenWithViews = new Set(childViewEvents?.map(e => e.token) || []);
        
        // For each child with a view, mark its parent as "completed"
        childTokens.forEach(child => {
          if (childrenWithViews.has(child.token) && child.parent_token) {
            engagementStates[child.parent_token] = "completed";
          }
          // Also count engaged spawns for L00 instance filtering
          if (child.l00_instance && childrenWithViews.has(child.token)) {
            spawnCounts[child.l00_instance] = (spawnCounts[child.l00_instance] || 0) + 1;
          }
        });
      }

      // Step 4: Calculate first view per mobilize_code group
      // Group EoAs by mobilize_code
      const mobilizeCodeToEoaIds: Record<string, string[]> = {};
      const eoaIdToMobilizeCode: Record<string, string | null> = {};
      
      eoas.forEach((eoa) => {
        eoaIdToMobilizeCode[eoa.id] = eoa.mobilize_code || null;
        if (eoa.mobilize_code) {
          if (!mobilizeCodeToEoaIds[eoa.mobilize_code]) {
            mobilizeCodeToEoaIds[eoa.mobilize_code] = [];
          }
          mobilizeCodeToEoaIds[eoa.mobilize_code].push(eoa.id);
        }
      });

      // Find first view event for each mobilize_code group and individual EoAs without code
      const startDates: Record<string, string> = {};
      
      // Map token to EoA for event processing
      const tokenToEoaId: Record<string, string> = {};
      tokens.forEach((t) => {
        tokenToEoaId[t.token] = t.eoa_id;
      });

      // Sort events by occurred_at to find first views
      const sortedEvents = [...events].sort((a, b) => 
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
      );

      // Track first view per mobilize_code and per individual EoA (for those without code)
      const mobilizeCodeFirstView: Record<string, string> = {};
      const eoaFirstView: Record<string, string> = {};

      sortedEvents.forEach((event) => {
        const eoaId = tokenToEoaId[event.token];
        if (!eoaId) return;

        const mobilizeCode = eoaIdToMobilizeCode[eoaId];
        
        if (mobilizeCode) {
          // Track first view for mobilize_code group
          if (!mobilizeCodeFirstView[mobilizeCode]) {
            mobilizeCodeFirstView[mobilizeCode] = event.occurred_at;
          }
        } else {
          // Track first view for individual EoA
          if (!eoaFirstView[eoaId]) {
            eoaFirstView[eoaId] = event.occurred_at;
          }
        }
      });

      // Build startDates keyed by EoA ID (using mobilize_code group's first view or individual first view)
      eoas.forEach((eoa) => {
        const mobilizeCode = eoa.mobilize_code;
        if (mobilizeCode && mobilizeCodeFirstView[mobilizeCode]) {
          startDates[eoa.id] = mobilizeCodeFirstView[mobilizeCode];
        } else if (!mobilizeCode && eoaFirstView[eoa.id]) {
          startDates[eoa.id] = eoaFirstView[eoa.id];
        }
      });

      setEoaStartDates(startDates);

      // Step 4b: Deduplicate return visits for Action-type EoAs
      // For Action-type EoAs, keep only the first view event per token
      const firstViewByToken: Record<string, boolean> = {};
      const deduplicatedEvents = sortedEvents.filter((event) => {
        const td = tokenData[event.token];
        if (!td) return true;
        const eoaType = eoaTypes[td.eoaId];
        if (eoaType !== "Action") return true; // Event-type: keep all (each scan = unique person)
        if (!firstViewByToken[event.token]) {
          firstViewByToken[event.token] = true;
          return true; // Keep first view
        }
        return false; // Drop subsequent return visits
      });

      // Step 5: Get unique ZIP codes for coordinate lookup
      const uniqueZips = [...new Set(deduplicatedEvents.map((e) => e.zip_code).filter(Boolean))] as string[];

      let zipData: { zip_code: string; latitude: number; longitude: number }[] | null = null;
      if (uniqueZips.length > 0) {
        const { data, error: zipError } = await supabase
          .from("zip_codes")
          .select("zip_code, latitude, longitude")
          .in("zip_code", uniqueZips);
        if (zipError) {
          console.error("Error fetching zip coordinates:", zipError);
        } else {
          zipData = data;
        }
      }

      const zipCoords: Record<string, { lat: number; lng: number }> = {};
      (zipData || []).forEach((z) => {
        zipCoords[z.zip_code] = { lat: z.latitude, lng: z.longitude };
      });

      // Step 6: Build event points with chain info
      // Note: No filtering by start_date here since first view IS the start
      const points: EventPoint[] = [];
      deduplicatedEvents.forEach((event) => {
        const td = tokenData[event.token];
        if (!td) return;
        
        // Check if this is an international event (has lat/lon but no zip_code)
        const isInternational = !event.zip_code && event.latitude != null && event.longitude != null;
        
        let lat: number;
        let lng: number;
        
        if (isInternational) {
          // Use raw coordinates for international events
          lat = Number(event.latitude);
          lng = Number(event.longitude);
        } else {
          // Use ZIP code lookup for US events
          const coords = zipCoords[event.zip_code!];
          if (!coords) return; // Skip if no coordinates for this ZIP
          lat = coords.lat;
          lng = coords.lng;
        }

        // Get spawn count for this token's l00_instance (only meaningful for L00 events)
        const tokenSpawnCount = td.l00Instance ? (spawnCounts[td.l00Instance] || 0) : 0;
        
        // Determine engagement state: L03 tokens can't share, always "none"
        const tokenEngagement: EngagementState = event.token in engagementStates
          ? engagementStates[event.token]
          : "none";
        
        points.push({
          eventId: event.id,
          eoaId: td.eoaId,
          zipCode: event.zip_code || null,
          latitude: lat,
          longitude: lng,
          occurredAt: event.occurred_at,
          utmMedium: td.utmMedium,
          utmId: td.utmId,
          token: event.token,
          rootToken: td.rootToken,
          parentToken: td.parentToken,
          level: td.level,
          l00Instance: td.l00Instance,
          isInternational,
          country: event.country || null,
          countryCode: event.country_code || null,
          city: event.city || null,
          spawnCount: tokenSpawnCount,
          engagementState: tokenEngagement,
          timezone: event.zip_code ? (zipTimezoneMap[event.zip_code] || null) : null,
        });
      });

      setEventPoints(points);
      setLoading(false);
    };

    fetchEventData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eoaIdsKey, refreshKey, dataSource]); // Use stable string key; refreshKey triggers re-fetch on realtime events

  // Store updateViewportStats in a ref to avoid map recreation
  const updateViewportStatsRef = useRef(updateViewportStats);
  updateViewportStatsRef.current = updateViewportStats;

  // Initialize map - only once, no dependencies that would cause recreation
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [39.8283, -98.5795], // US center
      zoom: 4,
      zoomControl: true,
    });

    // CartoDB Positron tiles (light, minimal style)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Listen for map movement to update viewport stats (use ref to get latest callback)
    const handleMoveEnd = () => updateViewportStatsRef.current();
    mapRef.current.on("moveend", handleMoveEnd);
    mapRef.current.on("zoomend", handleMoveEnd);

    return () => {
      if (mapRef.current) {
        mapRef.current.off("moveend", handleMoveEnd);
        mapRef.current.off("zoomend", handleMoveEnd);
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Empty deps - map initializes once

  // Update viewport stats when time-filtered events change
  useEffect(() => {
    updateViewportStats();
  }, [timeFilteredEvents, updateViewportStats]);

  // Calculate sequence numbers for chain mode (chronological ordering)
  const chainSequenceNumbers = useMemo(() => {
    return createSequenceNumbers(displayEvents);
  }, [displayEvents]);

  // Handle show all events (reset from chain mode)
  const handleShowAllEvents = useCallback(() => {
    setViewMode("all");
    setSelectedRootToken(null);
    setSelectedChainToken(null);
    setSelectedEventId(null);
    setSelectedL00Instance(null);
    setHighlightedEventIndex(null);
    setIsPlaying(false);
    setTimelinePosition(1.0);
  }, []);

  // Handle marker click - traces lineage and filters to chain
  const handleMarkerClick = useCallback((event: EventPoint) => {
    console.log("[SamizdatMap] Marker clicked:", {
      eventId: event.eventId,
      token: event.token,
      rootToken: event.rootToken,
      level: event.level
    });
    
    // Set chain filter with the specific clicked token (not just root)
    setSelectedRootToken(event.rootToken);
    setSelectedChainToken(event.token);
    setViewMode("chain");
    setSelectedEventId(event.eventId);

    // Show all chain events immediately and highlight the first one
    setTimelinePosition(1.0);
    setHighlightedEventIndex(0);
  }, []);

  // Arrow-key handler for chain stepping
  useEffect(() => {
    if (viewMode !== "chain" || loupeActive || chainEventsOrdered.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      e.stopImmediatePropagation();

      // If playing, pause
      if (isPlaying) setIsPlaying(false);

      setHighlightedEventIndex(prev => {
        if (prev === null) return 0;
        if (e.key === 'ArrowRight') return Math.min(prev + 1, chainEventsOrdered.length - 1);
        return Math.max(prev - 1, 0);
      });
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [viewMode, loupeActive, chainEventsOrdered.length, isPlaying]);

  // Helper: compute jittered position for an event
  const getJitteredPosition = useCallback((event: EventPoint, allEvents: EventPoint[]) => {
    const locKey = `${event.latitude.toFixed(4)}_${event.longitude.toFixed(4)}`;
    const group = allEvents.filter(e =>
      e.latitude.toFixed(4) === event.latitude.toFixed(4) &&
      e.longitude.toFixed(4) === event.longitude.toFixed(4)
    );
    let lat = event.latitude;
    let lng = event.longitude;
    if (group.length > 1) {
      const idx = group.findIndex(e => e.eventId === event.eventId);
      const jitterRadius = 0.0003;
      const angle = (2 * Math.PI * idx) / group.length;
      lat += jitterRadius * Math.sin(angle);
      lng += jitterRadius * Math.cos(angle);
    }
    return { lat, lng };
  }, []);

  // Pan map + show pulse highlight + open story panel on step change
  useEffect(() => {
    if (highlightedEventIndex === null || !mapRef.current || chainEventsOrdered.length === 0) {
      if (highlightMarkerRef.current && mapRef.current) {
        mapRef.current.removeLayer(highlightMarkerRef.current);
        highlightMarkerRef.current = null;
      }
      return;
    }

    const event = chainEventsOrdered[highlightedEventIndex];
    if (!event) return;

    const { lat, lng } = getJitteredPosition(event, displayEvents);

    // Pan to the highlighted event
    mapRef.current.panTo([lat, lng], { animate: true });

    // Open the story panel
    setSelectedEventId(event.eventId);

    // Add/update highlight pulse marker
    if (highlightMarkerRef.current) {
      mapRef.current.removeLayer(highlightMarkerRef.current);
    }

    const pulseIcon = L.divIcon({
      html: `<div class="chain-pulse-ring"></div>`,
      className: "chain-pulse-icon",
      iconSize: L.point(40, 40),
      iconAnchor: L.point(20, 20),
    });

    highlightMarkerRef.current = L.marker([lat, lng], {
      icon: pulseIcon,
      zIndexOffset: 10000,
      interactive: false,
    }).addTo(mapRef.current);
  }, [highlightedEventIndex, chainEventsOrdered, displayEvents, getJitteredPosition]);

  // Draw polylines connecting parent→child events in chain mode
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing polylines
    if (polylineLayerRef.current) {
      mapRef.current.removeLayer(polylineLayerRef.current);
      polylineLayerRef.current = null;
    }

    if (viewMode !== "chain" || displayEvents.length < 2) return;

    const layerGroup = L.layerGroup();

    // Build token→jittered position lookup
    const tokenToPos: Record<string, { lat: number; lng: number }> = {};
    displayEvents.forEach(event => {
      const pos = getJitteredPosition(event, displayEvents);
      tokenToPos[event.token] = pos;
    });

    // Draw lines from parent→child
    displayEvents.forEach(event => {
      if (!event.parentToken) return;
      const parentPos = tokenToPos[event.parentToken];
      if (!parentPos) return;
      const childPos = tokenToPos[event.token];
      if (!childPos) return;

      const color = getLevelColor(event.level);

      L.polyline(
        [[parentPos.lat, parentPos.lng], [childPos.lat, childPos.lng]],
        { color, weight: 2, opacity: 0.5, dashArray: '6, 4' }
      ).addTo(layerGroup);

      // Small circle at child end to indicate direction
      L.circleMarker([childPos.lat, childPos.lng], {
        radius: 3,
        fillColor: color,
        fillOpacity: 0.7,
        color,
        weight: 1,
        opacity: 0.7,
      }).addTo(layerGroup);
    });

    polylineLayerRef.current = layerGroup;
    mapRef.current.addLayer(layerGroup);
  }, [viewMode, displayEvents, getJitteredPosition]);

  // Update markers based on view mode
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing layers
    if (clusterGroupRef.current) {
      mapRef.current.removeLayer(clusterGroupRef.current);
      clusterGroupRef.current = null;
    }
    if (markersLayerRef.current) {
      mapRef.current.removeLayer(markersLayerRef.current);
      markersLayerRef.current = null;
    }

    if (displayEvents.length === 0) return;

    // Create markers for all display events with level colors and share medium shapes
    const createMarkerIcon = (event: EventPoint, seqNum?: number) => {
      const fillColor = getLevelColor(event.level);
      const shape = getShareMediumShape(event.utmMedium);
      const size = 16;
      // Border color reflects engagement state (white→amber→cyan)
      const shapeSVG = getShapeSVG(shape, fillColor, size, event.engagementState);
      const levelLabel = `L${String(event.level).padStart(2, '0')}`;
      
      // In chain mode, show sequence numbers
      const showSeqNum = viewMode === "chain" && seqNum;
      
      return L.divIcon({
        html: `
          <div style="position:relative;">
            <div style="
              width: ${size}px;
              height: ${size}px;
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
            ">${shapeSVG}</div>
            ${showSeqNum ? `
            <div style="
              position: absolute;
              top: -10px;
              left: 12px;
              background: #1e293b;
              color: white;
              font-size: 9px;
              font-weight: 600;
              min-width: 16px;
              height: 16px;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0 3px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              font-family: system-ui;
            ">${seqNum}</div>
            ` : ''}
            <div style="
              position: absolute;
              top: ${size}px;
              left: -3px;
              font-size: 8px;
              color: ${fillColor};
              font-weight: 700;
              font-family: system-ui;
              text-shadow: 0 0 2px white, 0 0 2px white;
            ">${levelLabel}</div>
          </div>
        `,
        className: "samizdat-event-icon",
        iconSize: L.point(showSeqNum ? 32 : 16, 28),
        iconAnchor: L.point(8, 8),
      });
    };

    // Create tooltip content for a marker
    const createTooltipContent = (event: EventPoint): string => {
      const levelLabel = `L${String(event.level).padStart(2, '0')}`;
      const mediumLabel = MEDIUM_LABELS[event.utmMedium] || event.utmMedium;
      const locationLabel = event.isInternational 
        ? `🌍 ${event.city || ''} ${event.country || 'International'}`.trim()
        : event.zipCode ? `ZIP ${event.zipCode}` : 'Unknown';
      
      let timestamp: string;
      let timeLabel: string;
      if (event.timezone) {
        try {
          const dt = new Date(event.occurredAt);
          timestamp = dt.toLocaleString('en-US', {
            timeZone: event.timezone,
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          const tzAbbr = dt.toLocaleString('en-US', { timeZone: event.timezone, timeZoneName: 'short' }).split(' ').pop() || '';
          timeLabel = `${tzAbbr} local time`;
        } catch {
          timestamp = new Date(event.occurredAt).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
          });
          timeLabel = Intl.DateTimeFormat().resolvedOptions().timeZone;
        }
      } else {
        timestamp = new Date(event.occurredAt).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
        });
        timeLabel = Intl.DateTimeFormat().resolvedOptions().timeZone;
      }
      
      // Show engagement state info
      const engagementColor = ENGAGEMENT_BORDER_COLORS[event.engagementState];
      const engagementLabel = ENGAGEMENT_LABELS[event.engagementState];
      const engagementInfo = `<div style="margin-top:4px;padding-top:4px;border-top:1px solid #e2e8f0;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${engagementColor};border:1px solid #cbd5e1;margin-right:4px;vertical-align:middle;"></span>
          <span style="color:${event.engagementState === 'none' ? '#94a3b8' : engagementColor};">${engagementLabel}</span>
          ${event.engagementState !== 'none' && event.spawnCount && event.spawnCount > 0 ? ` <span style="color:#64748b;">(${event.spawnCount} spawn${event.spawnCount !== 1 ? 's' : ''})</span>` : ''}
         </div>`;
      
      const instanceLabel = event.l00Instance
        ? `<div style="color:#64748b;font-family:monospace;font-size:10px;word-break:break-all;">${event.l00Instance}</div>`
        : '';

      return `
        <div style="font-family:system-ui;font-size:12px;line-height:1.4;min-width:140px;">
          <div style="font-weight:600;margin-bottom:4px;">${levelLabel} • ${mediumLabel}</div>
          <div style="color:#64748b;">${locationLabel}</div>
          <div style="color:#64748b;">${timestamp} <span style="font-size:10px;opacity:0.7;">${timeLabel}</span></div>
          ${instanceLabel}
          ${engagementInfo}
        </div>
      `;
    };

    if (viewMode === "all" && enableClustering) {
      // Use clustering for "all" mode
      const clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          const markers = cluster.getAllChildMarkers();
          
          // Count by level
          const levelCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
          markers.forEach((m) => {
            const level = (m as any).eventLevel ?? 0;
            const key = level >= 3 ? 3 : level;
            levelCounts[key]++;
          });
          
          const popupContent = `
            <div style="font-family:system-ui;font-size:13px;line-height:1.4;">
              <div style="font-weight:600;margin-bottom:4px;">${count} events</div>
              <div style="display:flex;flex-direction:column;gap:2px;">
                ${levelCounts[0] > 0 ? `<div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:${LEVEL_COLORS[0]};"></span>L00: ${levelCounts[0]}</div>` : ''}
                ${levelCounts[1] > 0 ? `<div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:${LEVEL_COLORS[1]};"></span>L01: ${levelCounts[1]}</div>` : ''}
                ${levelCounts[2] > 0 ? `<div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:${LEVEL_COLORS[2]};"></span>L02: ${levelCounts[2]}</div>` : ''}
                ${levelCounts[3] > 0 ? `<div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:${LEVEL_COLORS[3]};"></span>L03+: ${levelCounts[3]}</div>` : ''}
              </div>
            </div>
          `;
          (cluster as any).popupContent = popupContent;

          return L.divIcon({
            html: `<div class="samizdat-cluster">${count}</div>`,
            className: "samizdat-cluster-icon",
            iconSize: L.point(40, 40),
          });
        },
      });

      clusterGroup.on("clusterclick", (e: any) => {
        const cluster = e.layer;
        if (cluster.popupContent) {
          L.popup()
            .setLatLng(cluster.getLatLng())
            .setContent(cluster.popupContent)
            .openOn(mapRef.current!);
        }
      });

      displayEvents.forEach((event) => {
        const markerIcon = createMarkerIcon(event);
        const marker = L.marker([event.latitude, event.longitude], { icon: markerIcon });
        (marker as any).eventLevel = event.level;
        (marker as any).rootToken = event.rootToken;
        
        // Add hover tooltip
        marker.bindTooltip(createTooltipContent(event), {
          permanent: false,
          direction: "top",
          offset: [0, -10],
          className: "samizdat-event-tooltip",
        });
        
        marker.on('click', () => {
          handleMarkerClick(event);
        });
        
        clusterGroup.addLayer(marker);
      });

      clusterGroupRef.current = clusterGroup;
      mapRef.current.addLayer(clusterGroup);
    } else {
      // No clustering - show individual markers with jitter for overlapping locations
      const layerGroup = L.layerGroup();

      // Group events by location to detect overlaps and apply jitter
      const locationGroups: Record<string, EventPoint[]> = {};
      displayEvents.forEach((event) => {
        const key = `${event.latitude.toFixed(4)}_${event.longitude.toFixed(4)}`;
        if (!locationGroups[key]) {
          locationGroups[key] = [];
        }
        locationGroups[key].push(event);
      });

      // Sort events so higher-level markers are added last (appear on top)
      // L00 renders first, higher levels render last
      const sortedEvents = [...displayEvents].sort((a, b) => a.level - b.level);

      sortedEvents.forEach((event) => {
        const seqNum = chainSequenceNumbers.get(event.eventId);
        const markerIcon = createMarkerIcon(event, seqNum);
        
        // Calculate jitter offset for overlapping markers
        const locKey = `${event.latitude.toFixed(4)}_${event.longitude.toFixed(4)}`;
        const group = locationGroups[locKey] || [];
        let lat = event.latitude;
        let lng = event.longitude;
        
        if (group.length > 1) {
          // Find index of this event in the group
          const idx = group.findIndex(e => e.eventId === event.eventId);
          const count = group.length;
          
          // Arrange in a circle pattern around the original point
          // Jitter radius in degrees (~0.0003 degrees ≈ 30-40 meters)
          const jitterRadius = 0.0003;
          const angle = (2 * Math.PI * idx) / count;
          lat += jitterRadius * Math.sin(angle);
          lng += jitterRadius * Math.cos(angle);
        }
        
        // Higher-level markers get higher z-index to appear on top
        const zIndexOffset = event.level * 100;
        
        const marker = L.marker([lat, lng], { 
          icon: markerIcon,
          zIndexOffset: zIndexOffset
        });
        
        // Add hover tooltip
        marker.bindTooltip(createTooltipContent(event), {
          permanent: false,
          direction: "top",
          offset: [0, -10],
          className: "samizdat-event-tooltip",
        });
        
        marker.on('click', () => {
          handleMarkerClick(event);
        });
        
        layerGroup.addLayer(marker);
      });

      markersLayerRef.current = layerGroup;
      mapRef.current.addLayer(layerGroup);
    }
  }, [viewMode, displayEvents, chainSequenceNumbers, enableClustering, handleMarkerClick]);

  // ZIP count overlay markers (uses displayed events)
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing ZIP count markers
    zipMarkersRef.current.forEach((marker) => marker.remove());
    zipMarkersRef.current = [];

    if (!showZipCounts || displayEvents.length === 0) return;

    // Aggregate events by ZIP code (or by lat/lon key for international)
    const zipAggregates: Record<string, ZipAggregate> = {};
    displayEvents.forEach((event) => {
      // Use zipCode if available, otherwise create a unique key for international events
      const key = event.zipCode || `intl-${event.latitude.toFixed(1)}-${event.longitude.toFixed(1)}`;
      
      if (!zipAggregates[key]) {
        zipAggregates[key] = {
          zipCode: event.zipCode || `${event.city || event.country || 'International'}`,
          latitude: event.latitude,
          longitude: event.longitude,
          total: 0,
          byMedium: {},
          isInternational: event.isInternational,
          country: event.country,
          city: event.city,
        };
      }
      zipAggregates[key].total++;
      zipAggregates[key].byMedium[event.utmMedium] = 
        (zipAggregates[key].byMedium[event.utmMedium] || 0) + 1;
    });

    // Create ZIP count markers with tooltips
    Object.values(zipAggregates).forEach((agg) => {
      // Build medium breakdown HTML
      const breakdownLines = Object.entries(agg.byMedium)
        .map(([medium, count]) => {
          const label = MEDIUM_LABELS[medium] || medium;
          const color = MEDIUM_COLORS[medium] || DEFAULT_COLOR;
          return `<div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;"></span>${label}: ${count}</div>`;
        })
        .join("");

      // Different tooltip for international vs US events
      const locationLabel = agg.isInternational 
        ? `🌍 ${agg.city || ''} ${agg.country || 'International'}`.trim()
        : `ZIP ${agg.zipCode}`;

      const tooltipContent = `
        <div style="font-family:system-ui;font-size:13px;line-height:1.4;">
          <div style="font-weight:600;margin-bottom:4px;">${locationLabel}</div>
          <div style="margin-bottom:6px;">Events: ${agg.total}</div>
          <div style="border-top:1px solid #e2e8f0;padding-top:6px;">
            ${breakdownLines}
          </div>
        </div>
      `;

      // Different styling for international markers (use globe emoji + purple bg)
      const bgColor = agg.isInternational ? '#7c3aed' : '#1e293b';
      const prefix = agg.isInternational ? '🌍 ' : '';
      
      // Create a DivIcon with the count number
      const countIcon = L.divIcon({
        className: "zip-count-marker",
        html: `<div style="
          background:${bgColor};
          color:white;
          border-radius:9999px;
          min-width:24px;
          height:24px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:11px;
          font-weight:600;
          padding:0 6px;
          box-shadow:0 2px 4px rgba(0,0,0,0.2);
          cursor:pointer;
        ">${prefix}${agg.total}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([agg.latitude, agg.longitude], {
        icon: countIcon,
        zIndexOffset: 1000, // Above event markers
      }).addTo(mapRef.current!);

      marker.bindTooltip(tooltipContent, {
        permanent: false,
        direction: "top",
        offset: [0, -12],
        className: "zip-count-tooltip",
      });

      zipMarkersRef.current.push(marker);
    });
  }, [showZipCounts, displayEvents]);

  return (
    <div className="space-y-4">
      {/* Collapsible Controls */}
      <Accordion type="multiple" defaultValue={[]} className="space-y-2">
        {/* Viewport Activity Report - by share medium with filter checkboxes (hidden in chain view) */}
        {viewportStats.length > 0 && viewMode !== "chain" && (
          <AccordionItem value="viewport-report" className="rounded-lg border border-border bg-card">
            <AccordionTrigger className="text-sm font-medium px-4 py-3 hover:no-underline">
              Activity by Share Medium
            </AccordionTrigger>
            <AccordionContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">Show</TableHead>
                    <TableHead className="w-[120px]">Share Medium</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Visible</TableHead>
                    <TableHead className="text-right">Offscreen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewportStats.map((stat) => {
                    const shape = stat.shape || (stat.medium as EoaShape);
                    return (
                      <TableRow key={stat.medium}>
                        <TableCell>
                          <Checkbox
                            checked={enabledChannels.has(shape)}
                            onCheckedChange={() => toggleChannel(shape)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 flex-shrink-0"
                              dangerouslySetInnerHTML={{ __html: getShapeSVG(shape, getLevelColor(0), 12) }}
                            />
                            <span className="truncate">{stat.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{stat.total}</TableCell>
                        <TableCell className="text-right tabular-nums">{stat.visible}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {stat.offscreen}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Map + Panel container */}
      <div 
        className={`flex rounded-lg overflow-hidden border border-border ${
          isFullscreen ? 'fixed inset-0 z-[9999] rounded-none border-none' : ''
        }`}
        style={isFullscreen ? { height: '100vh' } : { height: 'calc(100vh - 280px)', minHeight: '500px', maxHeight: '900px' }}
      >
        {/* Map container - shrinks when panel is open */}
        <div ref={mapWrapperRef} className="relative flex-1 min-w-0">
          {/* Chain mode indicator and back button */}
          {viewMode === "chain" && (
            <div className="absolute top-3 left-3 z-[1000] bg-background/95 backdrop-blur-sm rounded-md px-3 py-2 shadow-md border border-border">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShowAllEvents}
                  className="h-7 px-2"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Show All Events
                </Button>
                <div className="text-xs text-muted-foreground">
                  {highlightedEventIndex !== null && chainEventsOrdered.length > 0
                    ? `Event ${highlightedEventIndex + 1} of ${chainEventsOrdered.length}`
                    : `Viewing chain: ${displayEvents.length} events`}
                </div>
                {chainEventsOrdered.length > 0 && (
                  <div className="text-[10px] text-muted-foreground/70">
                    ← → to step
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Legend - Level colors and EoA shapes */}
          {displayEvents.length > 0 && (
            <div className="absolute bottom-3 left-3 z-[1000] flex items-end gap-2">
              <div className="backdrop-blur-sm rounded-md px-2.5 py-1.5 shadow-md border border-border" style={{ backgroundColor: "hsla(48, 96%, 83%, 0.95)" }}>
                <div className="flex items-center gap-3 divide-x divide-border">
                  {/* Level colors */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Level</span>
                    {[
                      { label: "L00", color: LEVEL_COLORS[0] },
                      { label: "L01", color: LEVEL_COLORS[1] },
                      { label: "L02", color: LEVEL_COLORS[2] },
                      { label: "L03+", color: LEVEL_COLORS[3] },
                    ].map(({ label, color }) => (
                      <div key={label} className="flex items-center gap-1 text-xs">
                        <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: color }} />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Share medium shapes */}
                  <div className="flex items-center gap-2 pl-3">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Medium</span>
                    {(["circle", "square", "triangle"] as EoaShape[]).map((shape) => (
                      <div key={shape} className="flex items-center gap-1 text-xs">
                        <div className="w-[18px] h-[18px]" dangerouslySetInnerHTML={{ __html: getShapeSVG(shape, "#64748b", 18) }} />
                        <span>{SHARE_MEDIUM_LABELS[shape]}</span>
                      </div>
                    ))}
                  </div>

                  {/* Engagement border colors */}
                  <div className="flex items-center gap-2 pl-3">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Engage</span>
                    {(["none", "intent", "completed"] as EngagementState[]).map((state) => (
                      <div key={state} className="flex items-center gap-1 text-xs">
                        <span className="w-3.5 h-3.5 rounded-full border-2" style={{ backgroundColor: "#64748b", borderColor: ENGAGEMENT_BORDER_COLORS[state] }} />
                        <span>{ENGAGEMENT_LABELS[state]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Timeline date/time box - shown during playback or when position < 1 */}
              {totalDurationMs > 0 && goLiveTime > 0 && (() => {
                const currentMs = goLiveTime + totalDurationMs * timelinePosition;
                const currentDate = new Date(currentMs);
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const month = monthNames[currentDate.getMonth()];
                const day = currentDate.getDate();
                const year = currentDate.getFullYear();
                const h = currentDate.getHours();
                const ampm = h >= 12 ? "PM" : "AM";
                const h12 = h % 12 || 12;
                const min = String(currentDate.getMinutes()).padStart(2, "0");
                return (
                  <div className="bg-background/95 backdrop-blur-sm rounded-md px-3 py-2 shadow-md border border-border">
                    
                    <div className="text-sm font-semibold tabular-nums">{month} {day}, {year}</div>
                    <div className="text-sm font-bold tabular-nums text-muted-foreground">{h12}:{min} {ampm}</div>
                    <div className="text-[9px] text-muted-foreground">{Intl.DateTimeFormat().resolvedOptions().timeZone}</div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Map controls */}
          <div className="absolute top-3 right-3 z-[1000] bg-background/90 backdrop-blur-sm rounded-md px-3 py-2 flex flex-col gap-2 shadow-sm border border-border">
            {/* Fullscreen toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-7 px-2 justify-start"
            >
              {isFullscreen ? (
                <>
                  <X className="w-4 h-4 mr-1" />
                  Exit Fullscreen
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 mr-1" />
                  Fullscreen
                </>
              )}
            </Button>
            {/* Magnifier loupe toggle */}
            <Button
              variant={loupeActive ? "default" : "ghost"}
              size="sm"
              onClick={() => setLoupeActive(!loupeActive)}
              className="h-7 px-2 justify-start"
              title="Magnifier (press 2/3/4 for zoom level, Esc to exit)"
            >
              <Search className="w-4 h-4 mr-1" />
              {loupeActive ? "Loupe ON" : "Loupe"}
            </Button>
            
          </div>

          {/* No-spawns toggle - to the left of playback controls */}
          <div className="absolute bottom-3 z-[1000] flex items-end gap-2" style={{ right: '12px' }}>
            <div className="bg-background/95 backdrop-blur-sm rounded-md px-2.5 py-2 shadow-md border border-border flex items-center gap-2">
              <Switch
                id="no-spawns-toggle"
                checked={showNoSpawnsLocal}
                onCheckedChange={setShowNoSpawnsLocal}
                className="scale-75"
              />
              <Label htmlFor="no-spawns-toggle" className="text-[10px] font-medium cursor-pointer whitespace-nowrap">
                Hide stale opens
              </Label>
            </div>

          {/* Timeline playback controls - bottom right of map */}
          <div className="bg-background/95 backdrop-blur-sm rounded-md px-3 py-2 shadow-md border border-border" style={{ maxWidth: '320px', minWidth: '260px' }}>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => { setIsPlaying(false); setTimelinePosition(0); }}
                  title="Reset"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
                <Button
                  variant={isPlaying ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => {
                    if (timelinePosition >= 1) setTimelinePosition(0);
                    setIsPlaying(prev => !prev);
                  }}
                >
                  {isPlaying ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                  <span className="text-xs">{isPlaying ? "Pause" : "Play"}</span>
                </Button>
                <div className="flex items-center gap-0.5 ml-auto">
                  {[1, 2, 5, 10].map(s => (
                    <Button
                      key={s}
                      variant={playbackSpeed === s ? "default" : "ghost"}
                      size="sm"
                      className="h-6 px-1.5 text-[10px]"
                      onClick={() => setPlaybackSpeed(s)}
                    >
                      {s}x
                    </Button>
                  ))}
                </div>
              </div>
              <Slider
                value={[timelinePosition]}
                onValueChange={([v]) => { setIsPlaying(false); setTimelinePosition(v); }}
                min={0}
                max={1}
                step={0.001}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{totalDurationMs > 0 ? formatElapsedTime(totalDurationMs * timelinePosition) : "—"}</span>
                <span>Events: {filteredEventPoints.length} / {eventPoints.length}</span>
              </div>
            </div>
          </div>
          </div>

          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <div ref={mapContainerRef} className="w-full h-full" />
          {loupeActive && mapRef.current && mapWrapperRef.current && (
            <MapMagnifier
              parentMap={mapRef.current}
              containerRef={mapWrapperRef}
              onDeactivate={() => setLoupeActive(false)}
              displayEvents={displayEvents}
            />
          )}
          {!loading && filteredEventPoints.length === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
              <p className="text-muted-foreground">
                {eventPoints.length === 0 
                  ? "No activation events found for selected EoAs" 
                  : "No events in selected time window"}
              </p>
            </div>
          )}

          {/* Custom styles */}
          <style>{`
            .zip-count-tooltip {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 8px 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .zip-count-tooltip::before {
              border-top-color: #e2e8f0 !important;
            }
            .samizdat-event-tooltip {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 8px 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .samizdat-event-tooltip::before {
              border-top-color: #e2e8f0 !important;
            }
            /* Neutral cluster styling */
            .samizdat-cluster-icon {
              background: transparent !important;
            }
            .samizdat-cluster {
              width: 40px;
              height: 40px;
              background: #475569;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 13px;
              font-weight: 600;
              box-shadow: 0 2px 8px rgba(0,0,0,0.25);
              border: 2px solid rgba(255,255,255,0.3);
            }
            .samizdat-event-icon {
              background: transparent !important;
              border: none !important;
              cursor: pointer;
              transition: transform 0.15s ease;
            }
            .samizdat-event-icon:hover {
              transform: scale(1.2);
            }
            .samizdat-event-icon > div {
              cursor: pointer;
            }
            /* Override default markercluster styles */
            .marker-cluster-small,
            .marker-cluster-medium,
            .marker-cluster-large {
              background-color: rgba(71, 85, 105, 0.6) !important;
            }
            .marker-cluster-small div,
            .marker-cluster-medium div,
            .marker-cluster-large div {
              background-color: #475569 !important;
              color: white !important;
            }
            /* Chain step pulse highlight */
            .chain-pulse-icon {
              background: transparent !important;
              border: none !important;
            }
            .chain-pulse-ring {
              width: 40px;
              height: 40px;
              border-radius: 50%;
              border: 3px solid #f59e0b;
              animation: chain-pulse 1.5s ease-in-out infinite;
            }
            @keyframes chain-pulse {
              0%, 100% { transform: scale(0.8); opacity: 1; }
              50% { transform: scale(1.3); opacity: 0.3; }
            }
          `}</style>
        </div>

        {/* Event Story Panel - inline, shrinks the map */}
        {selectedEventId && (
          <EventStoryPanel
            eventId={selectedEventId}
            onClose={() => setSelectedEventId(null)}
          />
        )}
      </div>
    </div>
  );
};

export default SamizdatMap;
