import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Calendar, Eye, QrCode, Share2, Navigation, Link, ArrowDown, X } from "lucide-react";
import { formatTimeDelta } from "@/lib/dateUtils";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EventStoryPanelProps {
  eventId: string | null;
  onClose: () => void;
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
  mobilize_code: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
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
  isInstance?: boolean;
}

export function EventStoryPanel({ eventId, onClose }: EventStoryPanelProps) {
  const [loading, setLoading] = useState(false);
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null);
  const [eoaDetails, setEoaDetails] = useState<EoaDetails | null>(null);
  const [viralChain, setViralChain] = useState<ChainStep[]>([]);
  const [childTokens, setChildTokens] = useState<ChildToken[]>([]);
  const [timeDelta, setTimeDelta] = useState<number | null>(null);
  const [originTimeDelta, setOriginTimeDelta] = useState<number | null>(null);

  useEffect(() => {
    if (!eventId) {
      setEventDetails(null);
      setTokenDetails(null);
      setEoaDetails(null);
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

        // Fetch EoA details
        const { data: eoa, error: eoaError } = await supabase
          .from("events_actions")
          .select("id, title, mobilize_code, city, state, zip_code")
          .eq("id", token.eoa_id)
          .maybeSingle();

        if (!eoaError && eoa) {
          setEoaDetails(eoa);
        }

        // If L00 (base or instance), fetch children (viral spread / spawns)
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

      const childrenWithStatus = await Promise.all(
        children.map(async (child) => {
          const { data: firstEvent } = await supabase
            .from("url_events")
            .select("city, region, occurred_at")
            .eq("token", child.token)
            .order("occurred_at", { ascending: true })
            .limit(1)
            .maybeSingle();

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
        const { data: parentToken } = await supabase
          .from("tokens")
          .select("token, level, parent_token, utm_medium")
          .eq("token", currentToken)
          .maybeSingle();

        if (!parentToken) break;

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

        if (parentToken.level === currentLevel - 1) {
          lastShareTime = shareEvent?.occurred_at || null;
        }

        currentToken = parentToken.parent_token;
      }

      if (chain.length > 0 && chain[0].level === 0 && eoaData) {
        chain[0].city = chain[0].city || eoaData.city;
        chain[0].region = chain[0].region || eoaData.state;
      }

      setViralChain(chain);

      if (lastShareTime) {
        const parentTime = new Date(lastShareTime).getTime();
        const eventTime = new Date(currentEventTime).getTime();
        setTimeDelta(eventTime - parentTime);
      }

      if (chain.length > 0 && chain[0].occurredAt) {
        const originTime = new Date(chain[0].occurredAt).getTime();
        const eventTime = new Date(currentEventTime).getTime();
        setOriginTimeDelta(eventTime - originTime);
      }
    };

    fetchEventData();
  }, [eventId]);

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
      const spawns = childTokens.filter(c => c.level > 0);
      const spawnCount = spawns.length;
      
      let spawnNote = "";
      if (spawnCount === 0) {
        spawnNote = " No shares have been spawned from this scan yet.";
      } else if (spawnCount === 1) {
        const spawn = spawns[0];
        const spawnMedium = getMediumLabel(spawn.utm_medium);
        const spawnLoc = formatShortLocation(spawn.city, spawn.region);
        spawnNote = ` This scan spawned 1 share via ${spawnMedium} to ${spawnLoc}.`;
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
        spawnNote = ` This scan spawned ${spawnCount} shares (${breakdown}).`;
      }
      const eventDateTime = formatProseDateTime(eventDetails.occurred_at);
      
      return `This is a QR scan event (instance ${instanceCode}) for the "${tokenDetails.deck_slug}" deck at ${eoaTitle}. The user accessed the content from ${location} ${eventDateTime}${locationNote}.${spawnNote}`;
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

    if (tokenDetails.level === 1) {
      let timePhrase = deltaStr 
        ? ` (${deltaStr} later)`
        : "";
      let originPhrase = originDeltaStr 
        ? ` Total time from origin: ${originDeltaStr}.`
        : "";
      
      return `This is a Level 1 viral event. The content originated via ${originMedium} in ${originLocation}${originInstanceNote} ${originDateTime}. It was accessed in ${location} ${eventDateTime}${timePhrase}${locationNote}.${originPhrase}`;
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

    return `This is a Level ${tokenDetails.level} viral event. The content originated via ${originMedium} in ${originLocation}${originInstanceNote} ${originDateTime}.${chainNarrative} Finally, it was accessed in ${location} ${eventDateTime}${finalTimePhrase}${locationNote}.${totalTimePhrase}`;
  };

  const instanceTokens = childTokens.filter(c => c.isInstance);
  const shareTokens = childTokens.filter(c => !c.isInstance);
  const isBaseL00 = tokenDetails?.level === 0 && tokenDetails && !isInstanceToken(tokenDetails.token);

  const narrative = generateNarrative();

  if (!eventId) return null;

  return (
    <div className="w-[360px] flex-shrink-0 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5" />
          <h2 className="font-semibold">Event Story</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
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

                      <div className="flex items-center gap-2 font-medium">
                        <MapPin className="w-3 h-3 text-primary" />
                        <span>
                          {formatShortLocation(eventDetails.city, eventDetails.region)} (L{tokenDetails.level.toString().padStart(2, "0")}) ← current
                        </span>
                      </div>
                    </div>

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
                    <div className="text-sm font-medium text-muted-foreground">EoA Context</div>
                    <div className="space-y-1 pl-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span>📋</span>
                        <span>{eoaDetails.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getEventIcon(eventDetails.event_type)}
                        <Badge className={getEventColor(eventDetails.event_type)}>
                          {eventDetails.event_type.toUpperCase()}
                        </Badge>
                        <span>Deck "{tokenDetails.deck_slug}"</span>
                      </div>
                      {eoaDetails.mobilize_code && (
                        <div className="flex items-center gap-2">
                          <span>🏷️</span>
                          <span>Mobilize: {eoaDetails.mobilize_code}</span>
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
        </div>
      </ScrollArea>
    </div>
  );
}
