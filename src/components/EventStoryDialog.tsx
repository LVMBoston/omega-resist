import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Calendar, Eye, QrCode, Share2, Navigation } from "lucide-react";
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
  mobilize_code: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

interface ParentShareEvent {
  occurred_at: string;
  city: string | null;
  region: string | null;
  utm_medium: string | null;
}

export function EventStoryDialog({ eventId, open, onOpenChange }: EventStoryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [tokenDetails, setTokenDetails] = useState<TokenDetails | null>(null);
  const [eoaDetails, setEoaDetails] = useState<EoaDetails | null>(null);
  const [parentShareEvent, setParentShareEvent] = useState<ParentShareEvent | null>(null);
  const [timeDelta, setTimeDelta] = useState<number | null>(null);

  useEffect(() => {
    if (!eventId || !open) {
      setEventDetails(null);
      setTokenDetails(null);
      setEoaDetails(null);
      setParentShareEvent(null);
      setTimeDelta(null);
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

        // If L01+, fetch parent's share event for time delta calculation
        if (token.level > 0 && token.parent_token) {
          const { data: parentShare, error: parentError } = await supabase
            .from("url_events")
            .select("occurred_at, city, region")
            .eq("token", token.parent_token)
            .eq("event_type", "share")
            .order("occurred_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!parentError && parentShare) {
            // Fetch parent token's medium
            const { data: parentToken } = await supabase
              .from("tokens")
              .select("utm_medium")
              .eq("token", token.parent_token)
              .maybeSingle();

            setParentShareEvent({
              ...parentShare,
              utm_medium: parentToken?.utm_medium || null,
            });

            // Calculate time delta
            const parentTime = new Date(parentShare.occurred_at).getTime();
            const eventTime = new Date(event.occurred_at).getTime();
            setTimeDelta(eventTime - parentTime);
          }
        }
      } catch (error) {
        console.error("Error fetching event story:", error);
      } finally {
        setLoading(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5" />
            Event Story
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : eventDetails && tokenDetails ? (
          <div className="space-y-4">
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
                {tokenDetails.utm_medium && (
                  <span className="text-xs text-muted-foreground">
                    via {getMediumLabel(tokenDetails.utm_medium)}
                  </span>
                )}
              </div>
            </div>

            {/* Viral Journey (L01+ only) */}
            {tokenDetails.level > 0 && parentShareEvent && timeDelta !== null && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Viral Journey</div>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2 text-sm">
                      <Share2 className="w-4 h-4 mt-0.5 text-purple-500" />
                      <span>
                        Shared via {getMediumLabel(parentShareEvent.utm_medium)} from{" "}
                        {parentShareEvent.city && parentShareEvent.region
                          ? `${parentShareEvent.city}, ${parentShareEvent.region}`
                          : "unknown location"}
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <span className="w-4 h-4 flex items-center justify-center">⏱️</span>
                      <span>
                        Opened in {eventDetails.city || "unknown"}, {eventDetails.region || ""}{" "}
                        <strong>{formatTimeDelta(timeDelta)}</strong> later
                      </span>
                    </div>
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
                    {(eoaDetails.city || eoaDetails.state) && (
                      <div className="flex items-center gap-2">
                        <span>📍</span>
                        <span>
                          {[eoaDetails.city, eoaDetails.state].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}
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
      </DialogContent>
    </Dialog>
  );
}