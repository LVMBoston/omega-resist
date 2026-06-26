import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Hotspot } from "@/types/viralTemplates";
import { useLiveMetrics } from "@/hooks/useLiveMetrics";
import { ChartHotspotRenderer } from "@/components/ChartHotspotRenderer";
import { MapHotspotRenderer } from "@/components/MapHotspotRenderer";
import { InteractiveSlideOverlay } from "./InteractiveSlideOverlay";
import { Loader2 } from "lucide-react";
import { ManualEntryRenderer } from "@/components/ManualEntryRenderer";
import { MapLegend } from "@/components/MapLegend";
import { hasManualHtmlContent } from "@/lib/manualEntryHtml";
import { applyStorySegment } from "@/lib/campaignStorySplit";

const ACTION_TYPES = new Set(["sms", "email", "social", "external_link", "email_links", "email_support"]);

interface HybridSlideProps {
  imageUrl: string;
  hotspots: Hotspot[];
  deckSlug: string;
  viralToken: string | null;
  templateId?: string | null;
  cachedSnapshotPath?: string | null;
  snapshotRenderedAt?: string | null;
  snapshotEnabled?: boolean;
  snapshotIntervalMinutes?: number;
}

function isSnapshotFresh(
  renderedAt: string | null | undefined,
  intervalMinutes: number = 2
): boolean {
  if (!renderedAt) return false;
  const renderedDate = new Date(renderedAt);
  const now = new Date();
  const ageMinutes = (now.getTime() - renderedDate.getTime()) / (1000 * 60);
  return ageMinutes < intervalMinutes * 2.5;
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod|android|mobile|phone/i.test(ua)) return true;
  if (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

export const HybridSlide = ({
  imageUrl,
  hotspots,
  deckSlug,
  viralToken,
  templateId,
  cachedSnapshotPath,
  snapshotRenderedAt,
  snapshotEnabled,
  snapshotIntervalMinutes = 2,
}: HybridSlideProps) => {
  const isMobile = isMobileDevice();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const snapshotRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
    offsetX: 0,
    offsetY: 0,
  });

  const isSolidColor = imageUrl?.startsWith("solid:");
  const solidColor = isSolidColor ? imageUrl.replace("solid:", "") : null;

  // Split hotspots
  const actionHotspots = hotspots.filter((h) => ACTION_TYPES.has(h.type));
  const dataHotspots = hotspots.filter((h) => !ACTION_TYPES.has(h.type));
  const liveNumberHotspots = dataHotspots.filter((h) => h.type === "live_number");
  const chartHotspots = dataHotspots.filter((h) => h.type === "chart");
  const mapHotspots = dataHotspots.filter((h) => h.type === "map");
  const imageHotspots = dataHotspots.filter((h) => h.type === "image");

  // Campaign resolution
  const [campaignCode, setCampaignCode] = useState("");
  const [campaignResolved, setCampaignResolved] = useState(false);
  const [snapshotLoadFailed, setSnapshotLoadFailed] = useState(false);
  const [validatedSnapshotUrl, setValidatedSnapshotUrl] = useState<string | null>(null);

  const { metricsMap, loading: metricsLoading, resolveMetrics } = useLiveMetrics();

  const getCampaignSnapshotUrl = (code: string): string | null => {
    if (!templateId || !code) return null;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/storage/v1/object/public/slide-snapshots/${templateId}/snapshot-${code}.svg`;
  };

  // Resolve campaign
  useEffect(() => {
    const resolveCampaign = async () => {
      try {
        let resolvedCode: string | null = null;

        if (viralToken) {
          const { data: tokenData } = await supabase
            .from("tokens")
            .select("utm_campaign")
            .eq("token", viralToken)
            .maybeSingle();
          if (tokenData?.utm_campaign) resolvedCode = tokenData.utm_campaign;
        }

        if (!resolvedCode && deckSlug) {
          const { data: eoaRows } = await supabase
            .from("events_actions")
            .select("campaign_id, campaigns(code)")
            .eq("assigned_deck_slug", deckSlug)
            .order("created_at", { ascending: false })
            .limit(1);
          const eoaData = eoaRows?.[0];
          if (eoaData?.campaigns?.code) resolvedCode = eoaData.campaigns.code;
        }

        if (resolvedCode) {
          setCampaignCode(resolvedCode);
          setSnapshotLoadFailed(false);
          await resolveMetrics(resolvedCode);
        }
      } catch (error) {
        console.error("📊 HybridSlide: Error resolving campaign:", error);
      } finally {
        setCampaignResolved(true);
      }
    };
    resolveCampaign();
  }, [viralToken, deckSlug, resolveMetrics]);

  // Delay overlay mount for iPhone layout
  useEffect(() => {
    if (imageLoaded || validatedSnapshotUrl) {
      const timer = setTimeout(() => setOverlayReady(true), 300);
      return () => clearTimeout(timer);
    }
  }, [imageLoaded, validatedSnapshotUrl]);

  // Calculate image dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return false;
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      if (containerWidth === 0 || containerHeight === 0) return false;

      if (isSolidColor) {
        let renderedWidth = containerWidth;
        let renderedHeight = containerWidth * (16 / 9);
        if (renderedHeight > containerHeight) {
          renderedHeight = containerHeight;
          renderedWidth = containerHeight * (9 / 16);
        }
        setImageDimensions({
          width: renderedWidth,
          height: renderedHeight,
          offsetX: Math.max(0, (containerWidth - renderedWidth) / 2),
          offsetY: Math.max(0, (containerHeight - renderedHeight) / 2),
        });
        setImageLoaded(true);
        return true;
      }

      const img = validatedSnapshotUrl ? snapshotRef.current : imageRef.current;
      if (!img) return false;
      const renderedWidth = img.clientWidth;
      const renderedHeight = img.clientHeight;
      if (renderedWidth === 0 || renderedHeight === 0) return false;

      setImageDimensions({
        width: renderedWidth,
        height: renderedHeight,
        offsetX: Math.max(0, (containerWidth - renderedWidth) / 2),
        offsetY: Math.max(0, (containerHeight - renderedHeight) / 2),
      });
      return true;
    };

    const pollDimensions = (attempts = 0, maxAttempts = 20) => {
      const success = updateDimensions();
      if (!success && attempts < maxAttempts) {
        setTimeout(() => pollDimensions(attempts + 1, maxAttempts), 100);
      }
    };

    if (isSolidColor || imageLoaded || validatedSnapshotUrl) {
      pollDimensions();
      window.addEventListener("resize", updateDimensions);
      return () => window.removeEventListener("resize", updateDimensions);
    }
  }, [imageLoaded, isSolidColor, validatedSnapshotUrl]);

  // Snapshot URL
  const campaignSnapshotUrl = useMemo(() => {
    if (!campaignCode || !templateId) return null;
    const base = getCampaignSnapshotUrl(campaignCode);
    if (!base) return null;
    return `${base}?v=${Date.now()}`;
  }, [campaignCode, templateId]);

  const shouldUseCachedSnapshot =
    campaignSnapshotUrl &&
    !snapshotLoadFailed &&
    (isMobile || (snapshotEnabled && isSnapshotFresh(snapshotRenderedAt, snapshotIntervalMinutes)));

  // Validate snapshot
  useEffect(() => {
    if (!shouldUseCachedSnapshot || !campaignSnapshotUrl) {
      setValidatedSnapshotUrl(null);
      return;
    }

    if (isMobile) {
      setValidatedSnapshotUrl(campaignSnapshotUrl);
      return;
    }

    let cancelled = false;
    const validateSnapshot = async () => {
      try {
        const res = await fetch(campaignSnapshotUrl, { mode: "cors", method: "HEAD" });
        if (cancelled) return;
        if (res.ok) {
          setValidatedSnapshotUrl(campaignSnapshotUrl);
        } else {
          setSnapshotLoadFailed(true);
        }
      } catch {
        if (!cancelled) setSnapshotLoadFailed(true);
      }
    };
    validateSnapshot();
    return () => { cancelled = true; };
  }, [shouldUseCachedSnapshot, campaignSnapshotUrl, isMobile]);

  // The effective imageRef to pass to InteractiveSlideOverlay
  const effectiveImageRef = validatedSnapshotUrl ? snapshotRef : imageRef;

  // Mobile loading gate
  if (isMobile && !campaignResolved) {
    return (
      <div ref={containerRef} className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  // Snapshot path: show snapshot SVG as background + action overlay
  if (validatedSnapshotUrl) {
    return (
      <div ref={containerRef} className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
        <img
          ref={snapshotRef}
          src={validatedSnapshotUrl}
          alt="Hybrid slide (cached)"
          className="max-w-full max-h-full object-contain"
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setValidatedSnapshotUrl(null);
            setSnapshotLoadFailed(true);
          }}
        />
        {overlayReady && actionHotspots.length > 0 && (
          <InteractiveSlideOverlay
            hotspots={actionHotspots}
            deckSlug={deckSlug}
            imageRef={snapshotRef}
            viralToken={viralToken}
          />
        )}
      </div>
    );
  }

  // Dynamic rendering path
  if (imageError) {
    return (
      <div ref={containerRef} className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
        <div className="text-center text-white p-8">
          <p className="text-lg font-semibold mb-2">Template Image Missing</p>
          <p className="text-sm text-gray-400 mb-4">The background image for this Hybrid Template could not be loaded.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black flex items-center justify-center overflow-visible">
      {/* Background */}
      {isSolidColor ? (
        imageDimensions.width > 0 && imageDimensions.height > 0 ? (
          <div
            ref={imageRef as any}
            className="absolute rounded-lg"
            style={{
              backgroundColor: solidColor || "#1a1a2e",
              width: `${imageDimensions.width}px`,
              height: `${imageDimensions.height}px`,
              left: `${imageDimensions.offsetX}px`,
              top: `${imageDimensions.offsetY}px`,
            }}
          />
        ) : (
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        )
      ) : (
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Hybrid slide"
          className="max-w-full max-h-full object-contain"
          onLoad={() => {
            setImageLoaded(true);
            setImageError(false);
          }}
          onError={() => setImageError(true)}
        />
      )}

      {/* Metrics loading indicator */}
      {metricsLoading && (
        <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading metrics...
        </div>
      )}

      {/* Live number hotspots */}
      {imageLoaded && imageDimensions.width > 0 && !metricsLoading &&
        liveNumberHotspots.map((hotspot) => {
          const left = imageDimensions.offsetX + (hotspot.x / 100) * imageDimensions.width;
          const top = imageDimensions.offsetY + (hotspot.y / 100) * imageDimensions.height;
          const width = (hotspot.width / 100) * imageDimensions.width;
          const height = (hotspot.height / 100) * imageDimensions.height;
          const style = hotspot.liveNumberStyle || {};

          let value = "—";
          if (hotspot.metricKey === "manual_entry") {
            value = hotspot.manualLabel || "—";
          } else if (hotspot.metricKey && metricsMap[hotspot.metricKey] !== undefined) {
            value = String(metricsMap[hotspot.metricKey]);
          }

          if (hotspot.metricKey === "campaign_story") {
            if (hotspot.storySegment && hotspot.storySegment !== "full") {
              value = applyStorySegment(value, hotspot.storySegment);
            }
            // Strip __TITLE__ sentinels after segmenting so the splitter can
            // still pin the title block to the first column.
            value = value.replace(/__TITLE__(.*?)__TITLE__/g, "$1");
          }

          const isStory =
            hotspot.metricKey === "campaign_story" || /\n/.test(value);
          const baseFontSize = parseInt(String(style.fontSize || "24"), 10) || 24;
          // Honor the editor's chosen fontSize literally for parity with SSR
          // (render-stats-snapshot removed its 0.5 multiplier on 2026-06-26).
          const storyFontSize = baseFontSize;


          // Map legend — static visual key matching MapHotspotRenderer symbols
          if (hotspot.metricKey === "map_legend") {
            return (
              <div
                key={hotspot.id}
                className="absolute overflow-hidden"
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  backgroundColor: style.backgroundColor || "transparent",
                  padding: style.padding || "8px",
                  borderRadius: style.borderRadius || "0",
                  pointerEvents: "none",
                }}
              >
                <MapLegend
                  fontSize={baseFontSize}
                  color={style.color || "#1a1a1a"}
                  fontFamily={style.fontFamily}
                  fontWeight={style.fontWeight || "600"}
                />
              </div>
            );
          }


          // Rich-text manual entry takes a dedicated renderer with auto-fit.
          if (
            hotspot.metricKey === "manual_entry" &&
            hasManualHtmlContent(hotspot.manualHtml)
          ) {
            return (
              <div
                key={hotspot.id}
                className="absolute"
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  textAlign: style.textAlign || "left",
                  borderRadius: style.borderRadius || "0",
                }}
              >
                <ManualEntryRenderer
                  html={hotspot.manualHtml || ""}
                  width={width}
                  height={height}
                  baseFontSize={baseFontSize}
                  color={style.color || "#1a1a1a"}
                  backgroundColor={style.backgroundColor}
                  fontFamily={style.fontFamily}
                  fontWeight={style.fontWeight || "400"}
                />
              </div>
            );
          }

          const clipOverflow = style.clipOverflow !== false;
          const vAlign = style.verticalAlign || (isStory ? "top" : "center");
          const hAlign = isStory ? (style.textAlign || "left") : (style.textAlign || "center");
          const alignItemsCls =
            vAlign === "top" ? "items-start" : vAlign === "bottom" ? "items-end" : "items-center";
          const justifyCls =
            hAlign === "left" ? "justify-start" : hAlign === "right" ? "justify-end" : "justify-center";

          return (
            <div
              key={hotspot.id}
              className={`absolute ${clipOverflow ? "overflow-hidden" : "overflow-visible"} flex ${alignItemsCls} ${justifyCls}`}
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
                fontSize: isStory ? `${storyFontSize}px` : style.fontSize || "24px",
                lineHeight: isStory ? 1.25 : undefined,
                fontWeight: style.fontWeight || "700",
                color: style.color || "#1a1a1a",
                backgroundColor: style.backgroundColor || "transparent",
                textAlign: hAlign,
                fontFamily: style.fontFamily || "system-ui, -apple-system, sans-serif",
                padding: isStory ? "12px" : style.padding || "0",
                borderRadius: style.borderRadius || "0",
                pointerEvents: "none",
                whiteSpace: "pre-line",
                wordBreak: "break-word",
              }}
            >
              {value}
            </div>
          );
        })}

      {/* Chart hotspots */}
      {imageLoaded && imageDimensions.width > 0 && !metricsLoading && campaignCode &&
        chartHotspots.map((hotspot) => {
          const left = imageDimensions.offsetX + (hotspot.x / 100) * imageDimensions.width;
          const top = imageDimensions.offsetY + (hotspot.y / 100) * imageDimensions.height;
          const width = (hotspot.width / 100) * imageDimensions.width;
          const height = (hotspot.height / 100) * imageDimensions.height;
          const chartConfig = hotspot.chartConfig || {
            chartType: "stacked_bar" as const,
            dataSource: "cumulative_opens_by_level" as const,
            showXAxis: true,
            showYAxis: false,
          };
          return (
            <div
              key={hotspot.id}
              className="absolute"
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
                backgroundColor: "transparent",
                pointerEvents: "none",
              }}
            >
              <ChartHotspotRenderer campaignCode={campaignCode} config={chartConfig} width={width} height={height} />
            </div>
          );
        })}

      {/* Map hotspots */}
      {imageLoaded && imageDimensions.width > 0 && !metricsLoading && campaignCode &&
        mapHotspots.map((hotspot) => {
          const left = imageDimensions.offsetX + (hotspot.x / 100) * imageDimensions.width;
          const top = imageDimensions.offsetY + (hotspot.y / 100) * imageDimensions.height;
          const width = (hotspot.width / 100) * imageDimensions.width;
          const height = (hotspot.height / 100) * imageDimensions.height;
          const mapConfig = hotspot.mapConfig || {
            mapStyle: "channel_colors" as const,
            showClustering: false,
          };
          return (
            <div
              key={hotspot.id}
              className="absolute overflow-hidden rounded"
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
                pointerEvents: "none",
              }}
            >
              <MapHotspotRenderer campaignCode={campaignCode} config={mapConfig} width={width} height={height} />
            </div>
          );
        })}

      {/* Image hotspots — static pasted images */}
      {imageLoaded && imageDimensions.width > 0 &&
        imageHotspots.map((hotspot) => {
          if (!hotspot.imageSrc) return null;
          const left = imageDimensions.offsetX + (hotspot.x / 100) * imageDimensions.width;
          const top = imageDimensions.offsetY + (hotspot.y / 100) * imageDimensions.height;
          const width = (hotspot.width / 100) * imageDimensions.width;
          const height = (hotspot.height / 100) * imageDimensions.height;
          return (
            <img
              key={hotspot.id}
              src={hotspot.imageSrc}
              alt={hotspot.label || ""}
              className="absolute pointer-events-none"
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
                objectFit: "contain",
              }}
              draggable={false}
            />
          );
        })}

      {overlayReady && actionHotspots.length > 0 && !imageError && (
        <InteractiveSlideOverlay
          hotspots={actionHotspots}
          deckSlug={deckSlug}
          imageRef={effectiveImageRef}
          viralToken={viralToken}
        />
      )}
    </div>
  );
};
