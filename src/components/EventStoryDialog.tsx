import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Calendar, Eye, QrCode, Share2, Navigation, Link, ArrowDown, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatTimeDelta } from "@/lib/dateUtils";
import { Separator } from "@/components/ui/separator";

interface EventStoryDialogProps {
  eventId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EventDetails {
  id: string;
  occurred_at: string;
  event_type: string;
  city: string | null;
  region: string | null;
  country: string | null;
  zip_code: string | null;
  location_source: string | null;
  token: string;
  latitude: number | null;
  longitude: number | null;
}

interface TokenDetails {
  token: string;
  level: number;
  parent_token: string | null;
  deck_slug: string;
  utm_campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  eoa_id: string;
}

interface EoaDetails {
  id: string;
  title: string;
  type: string;
  mobilize_code: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  campaign_id: string;
}

interface CampaignDetails {
  id: string;
  title: string;
}

interface ChainStep {
  token: string;
  level: number;
  city: string | null;
  region: string | null;
  utm_medium: string | null;
  occurredAt: string | null;
}

// Helper functions for instance token detection
const isInstanceToken = (token: string) => token.includes(':');
const getBaseToken = (token: string) => token.split(':')[0];
const getInstanceCode = (token: string) => token.split(':')[1] || null;

interface ChildToken {
  token: string;
  level: number;
  utm_medium: string | null;
  city: string | null;
  region: string | null;
  firstEventAt: string | null;
  isInstance?: boolean; // true if this is an instance L00 token (a scan)
}

export function EventStoryDialog({ eventId, open, onOpenChange }: EventStoryDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null);
  const [eoaDetails, setEoaDetails] = useState<EoaDetails | null>(null);
  const [campaignDetails, setCampaignDetails] = useState<CampaignDetails | null>(null);
  const [viralChain, setViralChain] = useState<ChainStep[]>([]);
  const [childTokens, setChildTokens] = useState<ChildToken[]>([]);
  const [timeDelta, setTimeDelta] = useState<number | null>(null);
  const [originTimeDelta, setOriginTimeDelta] = useState<number | null>(null);
  const [isFirstEventForToken, setIsFirstEventForToken] = useState<boolean>(true);

  useEffect(() => {
    if (!eventId || !open) {
      setEventDetails(null);
      setTokenDetails(null);
      setEoaDetails(null);
      setCampaignDetails(null);
      setViralChain([]);
      setChildTokens([]);
      setTimeDelta(null);
      setOriginTimeDelta(null);
      setIsFirstEventForToken(true);
      return;
    }

    const fetchEventData = async () => {
      setLoading(true);
      try {
        // Fetch event details
        const { data: event, error: eventError } = await supabase
          .from("url_events")
          .select("id, occurred_at, event_type, city, region, country, zip_code, location_source, token, latitude, longitude")
          .eq("id", eventId)
          .maybeSingle();

        if (eventError || !event) {
          console.error("Error fetching event:", eventError);
          setLoading(false);
          return;
        }
        setEventDetails(event);

        // Fetch token details
        const { data: token, error: tokenError } = await supabase
          .from("tokens")
          .select("token, level, parent_token, deck_slug, utm_campaign, utm_source, utm_medium, utm_content, eoa_id")
          .eq("token", event.token)
          .maybeSingle();

        if (tokenError || !token) {
          console.error("Error fetching token:", tokenError);
          setLoading(false);
          return;
        }
        setTokenDetails(token);

        // Fetch EoA details including type for Event/Action designation
        const { data: eoa, error: eoaError } = await supabase
          .from("events_actions")
          .select("id, title, type, mobilize_code, city, state, zip_code, campaign_id")
          .eq("id", token.eoa_id)
          .maybeSingle();

        if (!eoaError && eoa) {
          setEoaDetails(eoa);
          
          // Fetch campaign details
          const { data: campaign } = await supabase
            .from("campaigns")
            .select("id, title")
            .eq("id", eoa.campaign_id)
            .maybeSingle();
          
          if (campaign) {
            setCampaignDetails(campaign);
          }
        }

        // If L00, fetch children (viral spread) and check if first event
        if (token.level === 0) {
          await fetchChildTokens(token.token, event.occurred_at);
          
          // Check if this is the first event for this instance token
          const { data: firstEventForToken } = await supabase
            .from("url_events")
            .select("id")
            .eq("token", token.token)
            .eq("is_simulated", false)
            .order("occurred_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          
          setIsFirstEventForToken(firstEventForToken?.id === eventId);
        }

        // If L01+, walk the parent chain back to L00 (viral journey) and fetch children
        if (token.level > 0) {
          await fetchViralChain(token.parent_token, token.level, event.occurred_at, eoa);
          await fetchChildTokens(token.token, event.occurred_at);
        }
      } catch (error) {
        console.error("Error fetching event story:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchChildTokens = async (parentToken: string, currentEventTime: string) => {
      const { data: children, error } = await supabase
        .from("tokens")
        .select("token, level, utm_medium")
        .eq("parent_token", parentToken)
        .eq("is_simulated", false);

      if (error || !children) return;

      // For each child, fetch their first event (if opened)
      const childrenWithStatus = await Promise.all(
        children.map(async (child) => {
          const { data: firstEvent } = await supabase
            .from("url_events")
            .select("city, region, occurred_at")
            .eq("token", child.token)
            .order("occurred_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          // Determine if this is an instance token (L00 scan) vs a share (L01+)
          const isInstance = child.level === 0 && isInstanceToken(child.token);

          return {
            token: child.token,
            level: child.level,
            utm_medium: child.utm_medium,
            city: firstEvent?.city || null,
            region: firstEvent?.region || null,
            firstEventAt: firstEvent?.occurred_at || null,
            isInstance,
          };
        })
      );

      setChildTokens(childrenWithStatus);
    };

    const fetchViralChain = async (
      startToken: string | null,
      currentLevel: number,
      currentEventTime: string,
      eoaData: EoaDetails | null
    ) => {
      const chain: ChainStep[] = [];
      let currentToken = startToken;
      let lastShareTime: string | null = null;

      while (currentToken) {
        // Fetch parent token info
        const { data: parentToken } = await supabase
          .from("tokens")
          .select("token, level, parent_token, utm_medium")
          .eq("token", currentToken)
          .maybeSingle();

        if (!parentToken) break;

        // Fetch parent's event for location
        // For all tokens, look for view events - that's when the person actually saw the content
        // (share events are when they forward, view events are when they receive)
        const { data: parentEvent } = await supabase
          .from("url_events")
          .select("city, region, occurred_at")
          .eq("token", parentToken.token)
          .eq("event_type", "view")
          .order("occurred_at", { ascending: true })  // First view (when they received it)
          .limit(1)
          .maybeSingle();

        chain.unshift({
          token: parentToken.token,
          level: parentToken.level,
          city: parentEvent?.city || null,
          region: parentEvent?.region || null,
          utm_medium: parentToken.utm_medium,
          occurredAt: parentEvent?.occurred_at || null,
        });

        // Track the immediate parent's share time for time delta
        if (parentToken.level === currentLevel - 1) {
          lastShareTime = parentEvent?.occurred_at || null;
        }

        currentToken = parentToken.parent_token;
      }

      // Add L00 origin from EoA if we have it and chain starts at L00
      if (chain.length > 0 && chain[0].level === 0 && eoaData) {
        chain[0].city = chain[0].city || eoaData.city;
        chain[0].region = chain[0].region || eoaData.state;
      }

      setViralChain(chain);

      // Calculate time delta from immediate parent
      if (lastShareTime) {
        const parentTime = new Date(lastShareTime).getTime();
        const eventTime = new Date(currentEventTime).getTime();
        setTimeDelta(eventTime - parentTime);
      }

      // Calculate origin time delta (from L00)
      if (chain.length > 0 && chain[0].occurredAt) {
        const originTime = new Date(chain[0].occurredAt).getTime();
        const eventTime = new Date(currentEventTime).getTime();
        setOriginTimeDelta(eventTime - originTime);
      }
    };

    fetchEventData();
  }, [eventId, open]);

  const formatEventDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Format date/time for prose (e.g., "on Dec. 15, 2025 at 2:15 PM")
  const formatProseDateTime = (timestamp: string | null) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `on ${dateStr} at ${timeStr}`;
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "scan":
        return <QrCode className="w-4 h-4" />;
      case "view":
        return <Eye className="w-4 h-4" />;
      case "share":
        return <Share2 className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
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

  const getMediumLabel = (medium: string | null) => {
    if (!medium) return "unknown";
    switch (medium.toLowerCase()) {
      case "em":
        return "email";
      case "tx":
        return "text";
      case "qr":
        return "QR code";
      case "fb":
        return "Facebook";
      case "bs":
        return "BlueSky";
      default:
        return medium;
    }
  };

  const formatLocation = (city: string | null, region: string | null, country: string | null, zip: string | null) => {
    const parts: string[] = [];
    if (city) parts.push(city);
    if (region) parts.push(region);
    if (country && country !== "United States") parts.push(country);
    
    let location = parts.join(", ");
    if (zip) {
      location += ` (${zip.padStart(5, "0")})`;
    }
    return location || "Unknown location";
  };

  // US state abbreviations
  const stateAbbreviations: Record<string, string> = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
    "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
    "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO",
    "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
    "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
    "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
    "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
    "District of Columbia": "DC"
  };

  const abbreviateState = (region: string | null): string | null => {
    if (!region) return null;
    return stateAbbreviations[region] || region;
  };

  const formatShortLocation = (city: string | null, region: string | null) => {
    const abbrevRegion = abbreviateState(region);
    if (city && abbrevRegion) return `${city}, ${abbrevRegion}`;
    if (city) return city;
    if (abbrevRegion) return abbrevRegion;
    return "unknown location";
  };

  // Generate narrative summary (synced with EventStoryPanel)
  const generateNarrative = (): string | null => {
    if (!tokenDetails || !eventDetails) return null;

    const location = formatShortLocation(eventDetails.city, eventDetails.region);
    const locationNote = eventDetails.location_source === "gps"
      ? " and shared their precise GPS location"
      : " (location approximated from IP address)";
    const medium = getMediumLabel(tokenDetails.utm_medium);
    const eoaTitle = eoaDetails?.title || "an event";
    const mobilizeCode = eoaDetails?.mobilize_code || "unknown";

    const isBaseL00 = tokenDetails.level === 0 && !isInstanceToken(tokenDetails.token);
    const isInstanceL00 = tokenDetails.level === 0 && isInstanceToken(tokenDetails.token);

    if (isBaseL00) {
      const instanceTokens = childTokens.filter(c => c.isInstance);
      const directShares = childTokens.filter(c => !c.isInstance && c.level > 0);
      const scanCount = instanceTokens.length;
      const directShareCount = directShares.length;

      if (scanCount === 0 && directShareCount === 0) {
        return `This samizdat card (Mobilize code ${mobilizeCode}) has not been scanned yet. It was distributed via ${medium} at ${eoaTitle}.`;
      }

      let narrative = `This samizdat card (Mobilize code ${mobilizeCode}) has been scanned ${scanCount} time${scanCount !== 1 ? 's' : ''}.`;
      
      if (directShareCount > 0) {
        narrative += ` There are also ${directShareCount} legacy direct share${directShareCount !== 1 ? 's' : ''} (pre-instance era).`;
      }

      return narrative;
    }

    if (isInstanceL00) {
      const instanceCode = getInstanceCode(tokenDetails.token);
      // Count spawns (L01+ shares from this instance)
      const spawns = childTokens.filter(c => c.level > 0 && c.firstEventAt);
      const spawnCount = spawns.length;
      
      let spawnNote = "";
      if (spawnCount === 0) {
        spawnNote = " No shares have been spawned from this instance yet.";
      } else if (spawnCount === 1) {
        const spawn = spawns[0];
        const spawnMedium = getMediumLabel(spawn.utm_medium);
        const spawnLoc = formatShortLocation(spawn.city, spawn.region);
        spawnNote = ` This instance spawned 1 share via ${spawnMedium} to ${spawnLoc}.`;
      } else {
        // Group by medium
        const byMedium: Record<string, number> = {};
        spawns.forEach(s => {
          const m = getMediumLabel(s.utm_medium);
          byMedium[m] = (byMedium[m] || 0) + 1;
        });
        const breakdown = Object.entries(byMedium)
          .map(([m, count]) => `${count} via ${m}`)
          .join(", ");
        spawnNote = ` This instance spawned ${spawnCount} shares (${breakdown}).`;
      }
      const eventDateTime = formatProseDateTime(eventDetails.occurred_at);
      
      if (isFirstEventForToken) {
        return `This is a QR scan event (instance ${instanceCode}) for the "${tokenDetails.deck_slug}" deck at ${eoaTitle}. The user accessed the content from ${location} ${eventDateTime}${locationNote}.${spawnNote}`;
      } else {
        return `This is a return visit to instance ${instanceCode} for the "${tokenDetails.deck_slug}" deck at ${eoaTitle}. The user accessed the content from ${location} ${eventDateTime}${locationNote}.${spawnNote}`;
      }
    }

    if (viralChain.length === 0) return null;

    const originStep = viralChain[0];
    const originLocation = formatShortLocation(originStep.city, originStep.region);
    const originMedium = getMediumLabel(originStep.utm_medium);
    const originDateTime = formatProseDateTime(originStep.occurredAt);
    const eventDateTime = formatProseDateTime(eventDetails.occurred_at);
    
    // Format time deltas with precision
    const deltaStr = timeDelta !== null ? formatTimeDelta(timeDelta) : null;
    const originDeltaStr = originTimeDelta !== null ? formatTimeDelta(originTimeDelta) : null;

    const originIsInstance = isInstanceToken(originStep.token);
    const originInstanceNote = originIsInstance 
      ? ` (scan instance ${getInstanceCode(originStep.token)})`
      : "";

    // Build spawn note for L01+ events
    const buildSpawnNote = (): string => {
      const spawns = childTokens.filter(c => c.level > tokenDetails.level && c.firstEventAt);
      if (spawns.length === 0) return "";
      if (spawns.length === 1) {
        const spawn = spawns[0];
        const spawnMedium = getMediumLabel(spawn.utm_medium);
        const spawnLoc = formatShortLocation(spawn.city, spawn.region);
        return ` This event spawned 1 share via ${spawnMedium} to ${spawnLoc}.`;
      }
      const byMedium: Record<string, number> = {};
      spawns.forEach(s => {
        const m = getMediumLabel(s.utm_medium);
        byMedium[m] = (byMedium[m] || 0) + 1;
      });
      const breakdown = Object.entries(byMedium)
        .map(([m, count]) => `${count} via ${m}`)
        .join(", ");
      return ` This event spawned ${spawns.length} shares (${breakdown}).`;
    };

    if (tokenDetails.level === 1) {
      let timePhrase = deltaStr 
        ? ` (${deltaStr} later)`
        : "";
      let originPhrase = originDeltaStr 
        ? ` Total time from origin: ${originDeltaStr}.`
        : "";
      
      return `This is a Level 1 viral event. The content originated via ${originMedium} in ${originLocation}${originInstanceNote} ${originDateTime}. It was accessed in ${location} ${eventDateTime}${timePhrase}${locationNote}.${originPhrase}${buildSpawnNote()}`;
    }

    // Build chain with time details
    const chainSteps: string[] = [];
    for (let i = 1; i < viralChain.length; i++) {
      const step = viralChain[i];
      const prevStep = viralChain[i - 1];
      const loc = formatShortLocation(step.city, step.region);
      const stepMedium = getMediumLabel(step.utm_medium);
      const stepDateTime = formatProseDateTime(step.occurredAt);
      
      // Calculate time between this step and previous
      let timeNote = "";
      if (step.occurredAt && prevStep.occurredAt) {
        const stepTime = new Date(step.occurredAt).getTime();
        const prevTime = new Date(prevStep.occurredAt).getTime();
        const stepDelta = stepTime - prevTime;
        if (stepDelta > 0) {
          timeNote = ` (${formatTimeDelta(stepDelta)} later)`;
        }
      }
      
      chainSteps.push(`shared via ${stepMedium} to ${loc} ${stepDateTime}${timeNote}`);
    }

    const chainNarrative = chainSteps.length > 0
      ? ` It was then ${chainSteps.join(", then ")}.`
      : "";

    let finalTimePhrase = deltaStr 
      ? ` (${deltaStr} after the last share)`
      : "";
    let totalTimePhrase = originDeltaStr 
      ? ` Total journey time from origin: ${originDeltaStr}.`
      : "";

    return `This is a Level ${tokenDetails.level} viral event. The content originated via ${originMedium} in ${originLocation}${originInstanceNote} ${originDateTime}.${chainNarrative} Finally, it was accessed in ${location} ${eventDateTime}${finalTimePhrase}${locationNote}.${totalTimePhrase}${buildSpawnNote()}`;
  };

  // Get medium counts for L00 spread (only for shares, not instances)
  const getMediumCounts = () => {
    const counts: Record<string, number> = {};
    childTokens.filter(c => !c.isInstance).forEach(c => {
      const m = getMediumLabel(c.utm_medium);
      counts[m] = (counts[m] || 0) + 1;
    });
    return counts;
  };

  // Separate instances (scans) from shares
  const instanceTokens = childTokens.filter(c => c.isInstance);
  const shareTokens = childTokens.filter(c => !c.isInstance);
  const isBaseL00 = tokenDetails?.level === 0 && tokenDetails && !isInstanceToken(tokenDetails.token);
  const isInstanceL00 = tokenDetails?.level === 0 && tokenDetails && isInstanceToken(tokenDetails.token);
  const engagedSpawns = childTokens.filter(c => c.level > 0 && c.firstEventAt);

  const narrative = generateNarrative();
  const openedChildren = childTokens.filter(c => c.firstEventAt);
  const pendingChildren = childTokens.filter(c => !c.firstEventAt);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[450px] overflow-y-auto">
        <SheetHeader className="flex flex-row items-center justify-between pr-8">
          <div>
            <SheetTitle className="flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              Event Story
            </SheetTitle>
            <SheetDescription className="sr-only">Details about the selected event</SheetDescription>
          </div>
          {eventDetails && tokenDetails && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const debugInfo = [
                  `=== Event Debug Info ===`,
                  `Event ID: ${eventDetails.id}`,
                  `Token: ${tokenDetails.token}`,
                  `Level: L${tokenDetails.level.toString().padStart(2, "0")}`,
                  `Event Type: ${eventDetails.event_type}`,
                  `Occurred: ${eventDetails.occurred_at}`,
                  ``,
                  `--- Location ---`,
                  `City: ${eventDetails.city || "N/A"}`,
                  `Region: ${eventDetails.region || "N/A"}`,
                  `Country: ${eventDetails.country || "N/A"}`,
                  `Zip: ${eventDetails.zip_code || "N/A"}`,
                  `Source: ${eventDetails.location_source || "unknown"}`,
                  ...(eventDetails.location_source === "gps" && eventDetails.latitude && eventDetails.longitude
                    ? [`GPS Coords: ${eventDetails.latitude}, ${eventDetails.longitude}`]
                    : []),
                  ``,
                  `--- Token Details ---`,
                  `Deck: ${tokenDetails.deck_slug}`,
                  `EoA ID: ${tokenDetails.eoa_id}`,
                  `Parent Token: ${tokenDetails.parent_token || "none"}`,
                  `UTM Campaign: ${tokenDetails.utm_campaign || "N/A"}`,
                  `UTM Source: ${tokenDetails.utm_source || "N/A"}`,
                  `UTM Medium: ${tokenDetails.utm_medium || "N/A"}`,
                  `UTM Content: ${tokenDetails.utm_content || "N/A"}`,
                  ``,
                  `--- Viral Chain (${viralChain.length} steps) ---`,
                  ...viralChain.map((step, i) => `  ${i + 1}. L${step.level.toString().padStart(2, "0")} ${step.token} @ ${step.city || "?"}, ${step.region || "?"}`),
                  ``,
                  `--- Campaign/EoA ---`,
                  `Campaign: ${campaignDetails?.title || "N/A"} (${campaignDetails?.id || "N/A"})`,
                  `EoA: ${eoaDetails?.title || "N/A"} (${eoaDetails?.type || "N/A"})`,
                ].join("\n");
                
                navigator.clipboard.writeText(debugInfo);
                toast({ title: "Debug info copied!" });
              }}
            >
              <Copy className="h-3 w-3 mr-1" />
              Debug
            </Button>
          )}
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : eventDetails && tokenDetails ? (
          <div className="space-y-4">
            {/* Narrative Summary */}
            {narrative && (
              <div className="bg-primary/5 border-l-4 border-primary rounded-r-lg p-4 italic text-sm leading-relaxed">
                {narrative}
              </div>
            )}

            {/* When */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>When</span>
              </div>
              <p className="font-medium pl-6">{formatEventDate(eventDetails.occurred_at)}</p>
            </div>

            {/* Where */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>Where</span>
                {eventDetails.location_source && (
                  <Badge variant="outline" className="text-xs ml-auto">
                    {eventDetails.location_source === "gps" ? "📍 GPS" : "🌐 IP"}
                  </Badge>
                )}
              </div>
              <p className="font-medium pl-6">
                {formatLocation(
                  eventDetails.city,
                  eventDetails.region,
                  eventDetails.country,
                  eventDetails.zip_code
                )}
              </p>
              {eventDetails.location_source === "gps" && eventDetails.latitude && eventDetails.longitude && (
                <p className="text-xs text-muted-foreground pl-6 font-mono">
                  {eventDetails.latitude}, {eventDetails.longitude}
                </p>
              )}
            </div>

            {/* Token */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-4 h-4 flex items-center justify-center">🔗</span>
                <span>Token</span>
              </div>
              <div className="flex items-center gap-2 pl-6 flex-wrap">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                  {tokenDetails.token}
                </code>
                <Badge variant="secondary">L{tokenDetails.level.toString().padStart(2, "0")}</Badge>
                {isInstanceToken(tokenDetails.token) && (
                  <Badge variant="outline" className="text-xs">
                    Scan: {getInstanceCode(tokenDetails.token)}
                  </Badge>
                )}
                {tokenDetails.utm_medium && (
                  <span className="text-xs text-muted-foreground">
                    via {getMediumLabel(tokenDetails.utm_medium)}
                  </span>
                )}
              </div>
            </div>

            {/* Viral Spread (Base L00 only) */}
            {isBaseL00 && childTokens.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Share2 className="w-4 h-4" />
                    <span>Viral Spread</span>
                  </div>

                  {/* Scans (Instance tokens) */}
                  {instanceTokens.length > 0 && (
                    <div className="space-y-1 text-sm pl-2">
                      <div>📱 {instanceTokens.length} scan{instanceTokens.length !== 1 ? 's' : ''} of this card:</div>
                      <div className="pl-4 space-y-1">
                        {instanceTokens.slice(0, 5).map(child => {
                          const instanceCode = getInstanceCode(child.token);
                          return (
                            <div key={child.token} className="text-xs text-muted-foreground">
                              • Instance {instanceCode}: {formatShortLocation(child.city, child.region)}
                              {child.firstEventAt ? " ✓" : " (pending)"}
                            </div>
                          );
                        })}
                        {instanceTokens.length > 5 && (
                          <div className="text-xs text-muted-foreground">
                            ... and {instanceTokens.length - 5} more scans
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Legacy direct shares (pre-instance era) */}
                  {shareTokens.length > 0 && (
                    <div className="space-y-1 text-sm pl-2">
                      <div>📤 {shareTokens.length} legacy share{shareTokens.length !== 1 ? 's' : ''} (pre-instance):</div>
                      <div className="pl-4 space-y-1">
                        {shareTokens.filter(c => c.firstEventAt).slice(0, 3).map(child => (
                          <div key={child.token} className="text-xs text-muted-foreground">
                            • {formatShortLocation(child.city, child.region)} (L{child.level.toString().padStart(2, "0")})
                          </div>
                        ))}
                        {shareTokens.filter(c => c.firstEventAt).length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            ... and {shareTokens.filter(c => c.firstEventAt).length - 3} more opened
                          </div>
                        )}
                        {shareTokens.filter(c => !c.firstEventAt).length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            📭 {shareTokens.filter(c => !c.firstEventAt).length} pending
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Viral Spread (Instance L00) */}
            {isInstanceL00 && engagedSpawns.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Share2 className="w-4 h-4" />
                    <span>Viral Spread</span>
                  </div>

                  <div className="space-y-1 text-sm pl-2">
                    <div>📤 {engagedSpawns.length} share{engagedSpawns.length !== 1 ? 's' : ''} spawned:</div>
                    <div className="pl-4 space-y-1">
                      {engagedSpawns.slice(0, 5).map(child => (
                        <div key={child.token} className="text-xs text-muted-foreground">
                          • {formatShortLocation(child.city, child.region)} (L{child.level.toString().padStart(2, "0")}) via {getMediumLabel(child.utm_medium)}
                        </div>
                      ))}
                      {engagedSpawns.length > 5 && (
                        <div className="text-xs text-muted-foreground">
                          ... and {engagedSpawns.length - 5} more
                        </div>
                      )}
                      {childTokens.filter(c => c.level > 0 && !c.firstEventAt).length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          📭 {childTokens.filter(c => c.level > 0 && !c.firstEventAt).length} pending (not yet opened)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Viral Journey (L01+ with full chain) */}
            {tokenDetails.level > 0 && viralChain.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Link className="w-4 h-4" />
                    <span>Viral Journey</span>
                  </div>

                  {/* Visual chain */}
                  <div className="space-y-1 text-sm pl-2">
                    {viralChain.map((step, idx) => {
                      const stepIsInstance = isInstanceToken(step.token);
                      const stepInstanceCode = stepIsInstance ? getInstanceCode(step.token) : null;
                      return (
                        <div key={step.token}>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            <span>
                              {formatShortLocation(step.city, step.region)}
                              {step.level === 0 
                                ? stepIsInstance 
                                  ? ` (origin, scan ${stepInstanceCode})` 
                                  : " (origin)"
                                : ` (L${step.level.toString().padStart(2, "0")})`
                              }
                              {step.level === 0 && `, ${getMediumLabel(step.utm_medium)}`}
                            </span>
                          </div>
                          {idx < viralChain.length && (
                            <div className="ml-1.5 pl-0.5 text-muted-foreground flex items-center gap-1">
                              <ArrowDown className="w-3 h-3" />
                              <span className="text-xs">shared via {getMediumLabel(viralChain[idx + 1]?.utm_medium || tokenDetails.utm_medium)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Current event marker */}
                    <div className="flex items-center gap-2 font-medium">
                      <MapPin className="w-3 h-3 text-primary" />
                      <span>
                        {formatShortLocation(eventDetails.city, eventDetails.region)} (L{tokenDetails.level.toString().padStart(2, "0")}) ← current
                      </span>
                    </div>
                  </div>

                  {/* Time deltas */}
                  <div className="text-sm space-y-1 pl-2">
                    {timeDelta !== null && (
                      <div>⏱️ {formatTimeDelta(timeDelta)} since last share</div>
                    )}
                    {originTimeDelta !== null && viralChain.length > 0 && (
                      <div>⏱️ {formatTimeDelta(originTimeDelta)} from origin</div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* EoA Context */}
            {eoaDetails && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Event or Action Context</div>
                  <div className="space-y-1 pl-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span>📦</span>
                      <span>Deck: {tokenDetails.deck_slug}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📋</span>
                      <span>EoA: {eoaDetails.title} ({eoaDetails.type === 'event' ? 'Event' : 'Action'})</span>
                    </div>
                    {eoaDetails.mobilize_code && (
                      <div className="flex items-center gap-2">
                        <span>🏷️</span>
                        <span>
                          Mobilize: {eoaDetails.mobilize_code}
                          {(eoaDetails.city || eoaDetails.state) && (
                            <span> ({[eoaDetails.city, eoaDetails.state].filter(Boolean).join(", ")})</span>
                          )}
                        </span>
                      </div>
                    )}
                    {campaignDetails && (
                      <div className="flex items-center gap-2">
                        <span>🎯</span>
                        <span>Campaign: {campaignDetails.title}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* UTM Details */}
            {(tokenDetails.utm_campaign || tokenDetails.utm_source || tokenDetails.utm_medium || tokenDetails.utm_content) && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">UTM Details</div>
                  <div className="grid grid-cols-2 gap-2 text-xs pl-2">
                    {tokenDetails.utm_campaign && (
                      <div>
                        <span className="text-muted-foreground">Campaign: </span>
                        <span>{tokenDetails.utm_campaign}</span>
                      </div>
                    )}
                    {tokenDetails.utm_source && (
                      <div>
                        <span className="text-muted-foreground">Source: </span>
                        <span>{tokenDetails.utm_source}</span>
                      </div>
                    )}
                    {tokenDetails.utm_medium && (
                      <div>
                        <span className="text-muted-foreground">Medium: </span>
                        <span>{tokenDetails.utm_medium}</span>
                      </div>
                    )}
                    {tokenDetails.utm_content && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Content: </span>
                        <span>{tokenDetails.utm_content}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            No event details available.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
