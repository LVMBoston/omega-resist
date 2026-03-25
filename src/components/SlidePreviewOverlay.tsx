import { Mail, MessageSquare, Share2, ExternalLink, BarChart3, Map, Video, Hash, Type, Clock, Calendar, TrendingUp, Users, Eye, MapPin, Bookmark, EyeOff } from "lucide-react";
import type { Hotspot } from "@/types/viralTemplates";

interface SlidePreviewOverlayProps {
  hotspots: Hotspot[];
  containerWidth?: number;
  containerHeight?: number;
}

const METRIC_LABELS: Record<string, string> = {
  manual_entry: "Text",
  seeds: "Seeds",
  seeds_with_spawns: "Active Seeds",
  shares: "Shares",
  opens: "Opens",
  opens_us: "US Opens",
  opens_intl: "Intl Opens",
  opens_qr: "QR Opens",
  opens_text: "Text Opens",
  opens_mail: "Email Opens",
  neighborhoods: "Zip Codes",
  depth: "Depth",
  l01_count: "L01",
  l02_count: "L02",
  l03_count: "L03",
  viral_coefficient: "K-Factor",
  campaign_name: "Campaign Name",
  current_date: "Date",
  current_time: "Time",
  earliest_active: "First Active",
  latest_active: "Last Active",
  last_updated: "Updated",
  campaign_story: "Story",
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  sms: MessageSquare,
  email: Mail,
  social: Share2,
  external_link: ExternalLink,
  email_links: Mail,
  vimeo: Video,
  app_download: ExternalLink,
};

const METRIC_ICONS: Record<string, React.ElementType> = {
  seeds: Users,
  seeds_with_spawns: Users,
  shares: Share2,
  opens: Eye,
  opens_us: Eye,
  opens_intl: Eye,
  opens_qr: Eye,
  opens_text: Eye,
  opens_mail: Eye,
  neighborhoods: MapPin,
  depth: TrendingUp,
  l01_count: Hash,
  l02_count: Hash,
  l03_count: Hash,
  viral_coefficient: TrendingUp,
  campaign_name: Bookmark,
  current_date: Calendar,
  current_time: Clock,
  earliest_active: Clock,
  latest_active: Clock,
  last_updated: Clock,
  campaign_story: Type,
  manual_entry: Type,
};

export function SlidePreviewOverlay({ hotspots }: SlidePreviewOverlayProps) {
  if (!hotspots || hotspots.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {hotspots.map((hotspot) => {
        const style: React.CSSProperties = {
          position: "absolute",
          left: `${hotspot.x}%`,
          top: `${hotspot.y}%`,
          width: `${hotspot.width}%`,
          height: `${hotspot.height}%`,
        };

        if (hotspot.type === "chart") {
          return (
            <div key={hotspot.id} style={style} className="flex items-center justify-center rounded border border-dashed border-blue-400/60 bg-blue-500/10">
              <BarChart3 className="h-6 w-6 text-blue-400/80" />
            </div>
          );
        }

        if (hotspot.type === "map") {
          return (
            <div key={hotspot.id} style={style} className="flex items-center justify-center rounded border border-dashed border-green-400/60 bg-green-500/10">
              <Map className="h-6 w-6 text-green-400/80" />
            </div>
          );
        }

        if (hotspot.type === "live_number") {
          const metricKey = hotspot.metricKey || "manual_entry";
          const displayText = metricKey === "manual_entry"
            ? (hotspot.manualLabel || "Text")
            : (METRIC_LABELS[metricKey] || metricKey);
          const Icon = METRIC_ICONS[metricKey] || Hash;

          // Apply live number styling if present
          const liveStyle: React.CSSProperties = {};
          if (hotspot.liveNumberStyle) {
            const s = hotspot.liveNumberStyle;
            if (s.fontSize) liveStyle.fontSize = s.fontSize;
            if (s.fontWeight) liveStyle.fontWeight = s.fontWeight;
            if (s.color) liveStyle.color = s.color;
            if (s.backgroundColor) liveStyle.backgroundColor = s.backgroundColor;
            if (s.textAlign) liveStyle.textAlign = s.textAlign;
            if (s.fontFamily) liveStyle.fontFamily = s.fontFamily;
            if (s.padding) liveStyle.padding = s.padding;
            if (s.borderRadius) liveStyle.borderRadius = s.borderRadius;
          }

          // For manual_entry with custom styling, show as the user would see it
          if (metricKey === "manual_entry" && hotspot.liveNumberStyle) {
            // Scale fontSize proportionally — preview is ~1/3 of actual slide
            const scaledStyle = { ...liveStyle };
            if (scaledStyle.fontSize) {
              const rawPx = parseInt(String(scaledStyle.fontSize)) || 56;
              scaledStyle.fontSize = `${Math.max(8, Math.round(rawPx * 0.33))}px`;
            }
            return (
              <div
                key={hotspot.id}
                style={{ ...style, ...scaledStyle, display: "flex", alignItems: hotspot.liveNumberStyle?.verticalAlign === "bottom" ? "flex-end" : hotspot.liveNumberStyle?.verticalAlign === "center" ? "center" : "flex-start" }}
                className="overflow-hidden"
              >
                <span className="w-full truncate">{hotspot.manualLabel || "Text"}</span>
              </div>
            );
          }

          return (
            <div
              key={hotspot.id}
              style={{ ...style, ...liveStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
              className="rounded border border-dashed border-amber-400/60 bg-amber-500/10 overflow-hidden"
            >
              <Icon className="h-3 w-3 flex-shrink-0" style={{ color: "hsl(30, 60%, 30%)" }} />
              <span className="text-[10px] font-semibold truncate" style={{ color: "hsl(30, 60%, 25%)" }}>{displayText}</span>
            </div>
          );
        }

        // Action hotspots (sms, email, social, external_link, etc.)
        const ActionIcon = ACTION_ICONS[hotspot.type] || ExternalLink;
        return (
          <div
            key={hotspot.id}
            style={style}
            className="flex items-center justify-center rounded border border-dashed border-purple-400/60 bg-purple-500/10"
          >
            <ActionIcon className="h-4 w-4 text-purple-400/80" />
          </div>
        );
      })}
    </div>
  );
}
