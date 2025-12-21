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
import { Loader2, MapPin, Calendar, Eye, QrCode, Share2, Navigation, Link, ArrowDown } from "lucide-react";
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
  const [loading, setLoading] = useState(false);
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null);
  const [eoaDetails, setEoaDetails] = useState<EoaDetails | null>(null);
  const [campaignDetails, setCampaignDetails] = useState<CampaignDetails | null>(null);
  const [viralChain, setViralChain] = useState<ChainStep[]>([]);
  const [childTokens, setChildTokens] = useState<ChildToken[]>([]);
  const [timeDelta, setTimeDelta] = useState<number | null>(null);
  const [originTimeDelta, setOriginTimeDelta] = useState<number | null>(null);

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
      return;
    }

    const fetchEventData = async () => {
      setLoading(true);
      try {
        // Fetch event details
        const { data: event, error: eventError } = await supabase
          .from("url_events")
          .select("id, occurred_at, event_type, city, region, country, zip_code, location_source, token")
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

        // If L00, fetch children (viral spread)
        if (token.level === 0) {
          await fetchChildTokens(token.token, event.occurred_at);
        }

        // If L01+, walk the parent chain back to L00 (viral journey)
        if (token.level > 0) {
          await fetchViralChain(token.parent_token, token.level, event.occurred_at, eoa);
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

        // Fetch parent's share event for location
        const { data: shareEvent } = await supabase
          .from("url_events")
          .select("city, region, occurred_at")
          .eq("token", parentToken.token)
          .eq("event_type", "share")
          .order("occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        chain.unshift({
          token: parentToken.token,
          level: parentToken.level,
          city: shareEvent?.city || null,
          region: shareEvent?.region || null,
          utm_medium: parentToken.utm_medium,
          occurredAt: shareEvent?.occurred_at || null,
        });

        // Track the immediate parent's share time for time delta
        if (parentToken.level === currentLevel - 1) {
          lastShareTime = shareEvent?.occurred_at || null;
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

  const formatShortLocation = (city: string | null, region: string | null) => {
    if (city && region) return `${city}, ${region}`;
    if (city) return city;
    if (region) return region;
    return "unknown location";
  };

  // Generate narrative summary
  const generateNarrative = (): string | null => {
    if (!tokenDetails || !eventDetails) return null;

    const location = formatShortLocation(eventDetails.city, eventDetails.region);
    const locationNote = eventDetails.location_source === "gps"
      ? " and shared their precise GPS location"
      : " (location approximated from IP address)";
    const medium = getMediumLabel(tokenDetails.utm_medium);
    const eoaTitle = eoaDetails?.title || "an event";
    const mobilizeCode = eoaDetails?.mobilize_code || "unknown";

    // Check if this is a base L00 token (no instance code)
    const isBaseL00 = tokenDetails.level === 0 && !isInstanceToken(tokenDetails.token);
    // Check if this is an instance L00 token (has instance code)
    const isInstanceL00 = tokenDetails.level === 0 && isInstanceToken(tokenDetails.token);

    if (isBaseL00) {
      // Base L00 - show scan count
      const instanceTokens = childTokens.filter(c => c.isInstance);
      const directShares = childTokens.filter(c => !c.isInstance && c.level > 0);
      const scanCount = instanceTokens.length;
      
      // Count total shares across all instances
      // Note: For now, we only have direct children info. Shares from instances would need additional queries.
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
      // Instance L00 - this is a specific scan
      const instanceCode = getInstanceCode(tokenDetails.token);
      return `This is a QR scan event (instance ${instanceCode}) for the "${tokenDetails.deck_slug}" deck at ${eoaTitle}. The user accessed the content from ${location}${locationNote}.`;
    }

    // L01+ viral event
    if (viralChain.length === 0) return null;

    const originStep = viralChain[0];
    const originLocation = formatShortLocation(originStep.city, originStep.region);
    const originMedium = getMediumLabel(originStep.utm_medium);
    const deltaStr = timeDelta ? formatTimeDelta(timeDelta) : "some time";
    const originDeltaStr = originTimeDelta ? ` (${formatTimeDelta(originTimeDelta)} from origin)` : "";

    // Check if the origin is an instance token
    const originIsInstance = isInstanceToken(originStep.token);
    const originInstanceNote = originIsInstance 
      ? ` (scan instance ${getInstanceCode(originStep.token)})`
      : "";

    if (tokenDetails.level === 1) {
      return `This is a Level 1 viral event. The content originated via ${originMedium} in ${originLocation}${originInstanceNote} and was accessed in ${location} ${deltaStr} later${originDeltaStr}${locationNote}.`;
    }

    // L02+ with full chain
    const intermediateHops = viralChain.slice(1).map(step => {
      const loc = formatShortLocation(step.city, step.region);
      return `was shared via ${getMediumLabel(step.utm_medium)} to ${loc}`;
    });

    const chainNarrative = intermediateHops.length > 0
      ? `, ${intermediateHops.join(", then ")},`
      : "";

    return `This is a Level ${tokenDetails.level} viral event. The content originated via ${originMedium} in ${originLocation}${originInstanceNote}${chainNarrative} and was accessed in ${location} ${deltaStr} later${originDeltaStr}${locationNote}.`;
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

  const narrative = generateNarrative();
  const openedChildren = childTokens.filter(c => c.firstEventAt);
  const pendingChildren = childTokens.filter(c => !c.firstEventAt);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[450px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5" />
            Event Story
          </SheetTitle>
          <SheetDescription className="sr-only">Details about the selected event</SheetDescription>
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
            </div>

            {/* What */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {getEventIcon(eventDetails.event_type)}
                <span>What</span>
              </div>
              <div className="flex items-center gap-2 pl-6">
                <Badge className={getEventColor(eventDetails.event_type)}>
                  {eventDetails.event_type.toUpperCase()}
                </Badge>
                <span className="text-sm">Deck "{tokenDetails.deck_slug}"</span>
              </div>
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
                      <span>📋</span>
                      <span>EoA: {eoaDetails.title} — {eoaDetails.type === 'event' ? 'Event' : 'Action'}</span>
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
