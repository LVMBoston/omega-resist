import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Hotspot } from "@/types/viralTemplates";
import { useLiveMetrics } from "@/hooks/useLiveMetrics";
import { ChartHotspotRenderer } from "@/components/ChartHotspotRenderer";
import { MapHotspotRenderer } from "@/components/MapHotspotRenderer";
import { Loader2 } from "lucide-react";


interface StatsPageSlideProps {
  imageUrl: string;
  hotspots: Hotspot[];
  deckSlug: string;
  viralToken: string | null;
  // Template ID for constructing campaign-specific snapshot URLs
  templateId?: string;
  // Snapshot props for server-side rendered version
  cachedSnapshotPath?: string | null;
  snapshotRenderedAt?: string | null;
  snapshotEnabled?: boolean;
  snapshotIntervalMinutes?: number;
}

// Check if a snapshot is fresh enough to use
function isSnapshotFresh(
  renderedAt: string | null | undefined,
  intervalMinutes: number = 2
): boolean {
  if (!renderedAt) return false;
  
  const renderedDate = new Date(renderedAt);
  const now = new Date();
  const ageMinutes = (now.getTime() - renderedDate.getTime()) / (1000 * 60);
  
  // Use snapshot if it's within 2.5x the interval (buffer for refresh timing)
  return ageMinutes < intervalMinutes * 2.5;
}


// Detect if user is on a mobile/tablet device
// iPadOS 13+ reports a Mac desktop user agent, so we also check touch points
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  // Standard mobile UA detection
  if (/iphone|ipad|ipod|android|mobile|phone/i.test(ua)) return true;
  // iPadOS 13+ disguises as Mac — detect via touch capability
  if (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

export const StatsPageSlide = ({ 
  imageUrl, 
  hotspots, 
  deckSlug, 
  viralToken,
  templateId,
  cachedSnapshotPath,
  snapshotRenderedAt,
  snapshotEnabled,
  snapshotIntervalMinutes = 2,
}: StatsPageSlideProps) => {
  const isMobile = isMobileDevice();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ 
    width: 0, 
    height: 0, 
    offsetX: 0, 
    offsetY: 0 
  });

  // Detect if imageUrl is a solid color (format: "solid:#hexcolor")
  const isSolidColor = imageUrl?.startsWith("solid:");
  const solidColor = isSolidColor ? imageUrl.replace("solid:", "") : null;

  // Campaign resolution state
  const [campaignCode, setCampaignCode] = useState<string>("");
  const [campaignResolved, setCampaignResolved] = useState(false);
  const [snapshotLoadFailed, setSnapshotLoadFailed] = useState(false);
  const [validatedSnapshotUrl, setValidatedSnapshotUrl] = useState<string | null>(null);


  // Get live metrics via the hook (only if not using cached snapshot)
  const { metricsMap, loading: metricsLoading, resolveMetrics } = useLiveMetrics();

  // Build campaign-specific snapshot URL dynamically
  const getCampaignSnapshotUrl = (code: string): string | null => {
    if (!templateId || !code) return null;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    // Snapshots are now saved as .svg (avoids CPU-heavy PNG rasterization in edge function)
    return `${supabaseUrl}/storage/v1/object/public/slide-snapshots/${templateId}/snapshot-${code}.svg`;
  };

  // Unified campaign resolution: resolves campaign code, sets state, fetches metrics
  // Single effect eliminates race condition between duplicate hooks
  useEffect(() => {
    const resolveCampaign = async () => {
      try {
        let resolvedCode: string | null = null;

        // First try to get campaign from token
        if (viralToken) {
          const { data: tokenData } = await supabase
            .from("tokens")
            .select("utm_campaign")
            .eq("token", viralToken)
            .maybeSingle();
          
          if (tokenData?.utm_campaign) {
            resolvedCode = tokenData.utm_campaign;
          }
        }

        // Fallback: get campaign from deck's assigned EOA
        // Deterministic ordering ensures all devices resolve to the same campaign
        if (!resolvedCode && deckSlug) {
          const { data: eoaRows } = await supabase
            .from("events_actions")
            .select("campaign_id, campaigns(code)")
            .eq("assigned_deck_slug", deckSlug)
            .order("created_at", { ascending: false })
            .limit(1);
          
          const eoaData = eoaRows?.[0];
          
          if (eoaData?.campaigns?.code) {
            resolvedCode = eoaData.campaigns.code;
          }
        }

        if (resolvedCode) {
          console.log("📊 StatsPageSlide: Resolved campaign:", resolvedCode);
          setCampaignCode(resolvedCode);
          setSnapshotLoadFailed(false);
          await resolveMetrics(resolvedCode);
        } else {
          console.warn("📊 StatsPageSlide: Could not resolve campaign from token or deck");
        }
      } catch (error) {
        console.error("📊 StatsPageSlide: Error resolving campaign:", error);
      } finally {
        setCampaignResolved(true);
      }
    };

    resolveCampaign();
  }, [viralToken, deckSlug, resolveMetrics]);

  // Calculate image dimensions when loaded (or for solid color)
  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // iOS Safari often reports 0 dimensions initially - poll until valid
      if (containerWidth === 0 || containerHeight === 0) {
        console.log("📊 StatsPageSlide: Container dimensions not ready, retrying...");
        return false;
      }
      
      // For solid color, use container dimensions with 9:16 aspect ratio
      if (isSolidColor) {
        let renderedWidth = containerWidth;
        let renderedHeight = containerWidth * (16 / 9);
        
        if (renderedHeight > containerHeight) {
          renderedHeight = containerHeight;
          renderedWidth = containerHeight * (9 / 16);
        }
        
        const offsetX = (containerWidth - renderedWidth) / 2;
        const offsetY = (containerHeight - renderedHeight) / 2;
        
        setImageDimensions({
          width: renderedWidth,
          height: renderedHeight,
          offsetX: Math.max(0, offsetX),
          offsetY: Math.max(0, offsetY)
        });
        setImageLoaded(true);
        return true;
      }
      
      // For image, use image ref dimensions
      if (!imageRef.current) return false;
      
      const img = imageRef.current;
      const renderedWidth = img.clientWidth;
      const renderedHeight = img.clientHeight;
      
      if (renderedWidth === 0 || renderedHeight === 0) {
        return false;
      }
      
      const offsetX = (containerWidth - renderedWidth) / 2;
      const offsetY = (containerHeight - renderedHeight) / 2;
      
      setImageDimensions({
        width: renderedWidth,
        height: renderedHeight,
        offsetX: Math.max(0, offsetX),
        offsetY: Math.max(0, offsetY)
      });
      return true;
    };

    // Polling for iOS Safari which often reports zero dimensions initially
    const pollDimensions = (attempts = 0, maxAttempts = 20) => {
      const success = updateDimensions();
      if (!success && attempts < maxAttempts) {
        setTimeout(() => pollDimensions(attempts + 1, maxAttempts), 100);
      }
    };

    if (isSolidColor) {
      pollDimensions();
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    } else if (imageLoaded) {
      pollDimensions();
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, [imageLoaded, isSolidColor]);

  // Build campaign-specific snapshot URL (stable per campaign resolution, cache-bust once)
  const campaignSnapshotUrl = useMemo(() => {
    if (!campaignCode || !templateId) return null;
    const base = getCampaignSnapshotUrl(campaignCode);
    if (!base) return null;
    return `${base}?v=${Date.now()}`;
  }, [campaignCode, templateId]);

  // Determine if we should use the cached snapshot
  const shouldUseCachedSnapshot = campaignSnapshotUrl && 
    !snapshotLoadFailed &&
    (isMobile || (snapshotEnabled && isSnapshotFresh(snapshotRenderedAt, snapshotIntervalMinutes)));

  // Fetch-based snapshot pre-check: validates URL before rendering img
  // On mobile, skip HEAD pre-check entirely (iOS ITP blocks cross-origin fetch)
  // Rely on <img> onError handler instead
  useEffect(() => {
    if (!shouldUseCachedSnapshot || !campaignSnapshotUrl) {
      setValidatedSnapshotUrl(null);
      return;
    }

    // Mobile: skip HEAD fetch, render <img> directly (ITP-safe)
    if (isMobile) {
      console.log("📊 StatsPageSlide: Mobile detected, skipping HEAD pre-check, using snapshot directly");
      setValidatedSnapshotUrl(campaignSnapshotUrl);
      return;
    }

    // Desktop: existing HEAD validation logic
    let cancelled = false;
    const validateSnapshot = async () => {
      try {
        const res = await fetch(campaignSnapshotUrl, { mode: 'cors', method: 'HEAD' });
        if (cancelled) return;
        if (res.ok) {
          console.log("📊 StatsPageSlide: Snapshot validated OK:", campaignSnapshotUrl);
          setValidatedSnapshotUrl(campaignSnapshotUrl);
        } else {
          console.warn("📊 StatsPageSlide: Snapshot returned", res.status, "- falling back to dynamic");
          setSnapshotLoadFailed(true);
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("📊 StatsPageSlide: Snapshot fetch failed, falling back to dynamic:", err);
        setSnapshotLoadFailed(true);
      }
    };

    validateSnapshot();
    return () => { cancelled = true; };
  }, [shouldUseCachedSnapshot, campaignSnapshotUrl, isMobile]);

  // Hotspot filters (must be before any early returns that use them)
  const liveNumberHotspots = hotspots.filter(h => h.type === 'live_number');
  const chartHotspots = hotspots.filter(h => h.type === 'chart');
  const mapHotspots = hotspots.filter(h => h.type === 'map');

  // === EARLY RETURNS (all hooks above this line) ===

  // Mobile loading gate: wait for campaign resolution before rendering
  if (isMobile && !campaignResolved) {
    return (
      <div 
        ref={containerRef}
        className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
      >
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  // If using validated snapshot, render simple static image
  if (validatedSnapshotUrl) {
    return (
      <div 
        ref={containerRef}
        className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
      >
        <img
          src={validatedSnapshotUrl}
          alt="Stats page (cached)"
          className="max-w-full max-h-full object-contain"
          onError={() => {
            console.warn("📊 StatsPageSlide: Validated snapshot failed on render, falling back");
            setValidatedSnapshotUrl(null);
            setSnapshotLoadFailed(true);
          }}
        />
      </div>
    );
  }

  // Dynamic rendering with live metrics
  if (imageError) {
    return (
      <div 
        ref={containerRef}
        className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
      >
        <div className="text-center text-white p-8">
          <p className="text-lg font-semibold mb-2">Template Image Missing</p>
          <p className="text-sm text-gray-400 mb-4">The background image for this Data Template could not be loaded.</p>
          <p className="text-xs text-gray-500 break-all max-w-md">{imageUrl}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-black flex items-center justify-center overflow-visible"
    >
      {/* Background: solid color or image */}
      {isSolidColor ? (
        imageDimensions.width > 0 && imageDimensions.height > 0 ? (
          <div
            className="absolute rounded-lg"
            style={{
              backgroundColor: solidColor || '#1a1a2e',
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
          alt="Stats page"
          className="max-w-full max-h-full object-contain"
          onLoad={() => {
            setImageLoaded(true);
            setImageError(false);
          }}
          onError={() => setImageError(true)}
        />
      )}
      
      {/* Loading indicator for metrics */}
      {metricsLoading && (
        <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading metrics...
        </div>
      )}
      
      {/* Render live_number hotspots - gate on !metricsLoading to prevent partial renders on iOS */}
      {imageLoaded && imageDimensions.width > 0 && !metricsLoading && liveNumberHotspots.map((hotspot) => {
        const left = imageDimensions.offsetX + (hotspot.x / 100) * imageDimensions.width;
        const top = imageDimensions.offsetY + (hotspot.y / 100) * imageDimensions.height;
        const width = (hotspot.width / 100) * imageDimensions.width;
        const height = (hotspot.height / 100) * imageDimensions.height;
        
        const style = hotspot.liveNumberStyle || {};
        
        // Get value from metrics or use manual label
        let value: string = '—';
        if (hotspot.metricKey === 'manual_entry') {
          value = hotspot.manualLabel || '—';
        } else if (hotspot.metricKey && metricsMap[hotspot.metricKey] !== undefined) {
          value = String(metricsMap[hotspot.metricKey]);
        }
        
        return (
          <div
            key={hotspot.id}
            className="absolute flex items-center justify-center overflow-hidden"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`,
              fontSize: style.fontSize || '24px',
              fontWeight: style.fontWeight || '700',
              color: style.color || '#1a1a1a',
              backgroundColor: style.backgroundColor || 'transparent',
              textAlign: style.textAlign || 'center',
              fontFamily: style.fontFamily || 'system-ui, -apple-system, sans-serif',
              padding: style.padding || '0',
              borderRadius: style.borderRadius || '0',
              pointerEvents: 'none',
              // Allow line breaks in manual labels
              whiteSpace: 'pre-line',
              overflow: 'hidden',
            }}
          >
            {value}
          </div>
        );
      })}

      {/* Render chart hotspots - gate on !metricsLoading for consistency */}
      {imageLoaded && imageDimensions.width > 0 && !metricsLoading && campaignCode && chartHotspots.map((hotspot) => {
        const left = imageDimensions.offsetX + (hotspot.x / 100) * imageDimensions.width;
        const top = imageDimensions.offsetY + (hotspot.y / 100) * imageDimensions.height;
        const width = (hotspot.width / 100) * imageDimensions.width;
        const height = (hotspot.height / 100) * imageDimensions.height;
        
        const chartConfig = hotspot.chartConfig || {
          chartType: 'stacked_bar',
          dataSource: 'cumulative_opens_by_level',
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
              backgroundColor: 'transparent',
              pointerEvents: 'none',
            }}
          >
            <ChartHotspotRenderer
              campaignCode={campaignCode}
              config={chartConfig}
              width={width}
              height={height}
            />
          </div>
        );
      })}

      {/* Render map hotspots - gate on !metricsLoading for consistency */}
      {imageLoaded && imageDimensions.width > 0 && !metricsLoading && campaignCode && mapHotspots.map((hotspot) => {
        const left = imageDimensions.offsetX + (hotspot.x / 100) * imageDimensions.width;
        const top = imageDimensions.offsetY + (hotspot.y / 100) * imageDimensions.height;
        const width = (hotspot.width / 100) * imageDimensions.width;
        const height = (hotspot.height / 100) * imageDimensions.height;
        
        const mapConfig = hotspot.mapConfig || {
          mapStyle: 'channel_colors' as const,
          showClustering: true,
        };
        
        return (
          <div
            key={hotspot.id}
            className="absolute overflow-hidden rounded-lg"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`,
            }}
          >
            <MapHotspotRenderer
              campaignCode={campaignCode}
              config={mapConfig}
              width={width}
              height={height}
              isEditorMode={false}
            />
          </div>
        );
      })}
    </div>
  );
};
