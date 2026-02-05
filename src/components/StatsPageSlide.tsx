import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Hotspot } from "@/types/viralTemplates";
import { useLiveMetrics } from "@/hooks/useLiveMetrics";
import { ChartHotspotRenderer } from "@/components/ChartHotspotRenderer";
import { MapHotspotRenderer } from "@/components/MapHotspotRenderer";
import { Loader2 } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";

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

// Get the full URL for a snapshot - handles both full URLs and relative paths
function getSnapshotUrl(path: string): string {
  // If already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // Otherwise, build URL from relative path
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/slide-snapshots${path}`;
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

  // Determine if we should use the cached snapshot
  // Note: We now build the campaign-specific URL dynamically using templateId + campaignCode
  // so we don't rely on the shared cachedSnapshotPath field which gets overwritten
  const [snapshotReady, setSnapshotReady] = useState(false);

  // Get live metrics via the hook (only if not using cached snapshot)
  const { metricsMap, loading: metricsLoading, resolveMetrics } = useLiveMetrics();

  // Resolve campaign from viralToken or deckSlug (only when not using cached snapshot)
  useEffect(() => {
    // Skip API calls if using cached snapshot
    if (shouldUseCachedSnapshot) {
      console.log("📊 StatsPageSlide: Using cached snapshot, skipping API calls");
      return;
    }

    const resolveCampaign = async () => {
      try {
        let campaignCode: string | null = null;

        // First try to get campaign from token
        if (viralToken) {
          const { data: tokenData } = await supabase
            .from("tokens")
            .select("utm_campaign")
            .eq("token", viralToken)
            .maybeSingle();
          
          if (tokenData?.utm_campaign) {
            campaignCode = tokenData.utm_campaign;
          }
        }

        // Fallback: try to get campaign from deck's assigned EOA (events_actions.assigned_deck_slug)
        // Note: Multiple EOAs may be assigned to the same deck (from different campaigns)
        // Using limit(1) to get any valid campaign association
        if (!campaignCode && deckSlug) {
          const { data: eoaRows } = await supabase
            .from("events_actions")
            .select("campaign_id, campaigns(code)")
            .eq("assigned_deck_slug", deckSlug)
            .limit(1);
          
          const eoaData = eoaRows?.[0];
          
          if (eoaData?.campaigns?.code) {
            campaignCode = eoaData.campaigns.code;
          }
        }

        if (campaignCode) {
          console.log("📊 StatsPageSlide: Resolving metrics for campaign:", campaignCode);
          await resolveMetrics(campaignCode);
        } else {
          console.warn("📊 StatsPageSlide: Could not resolve campaign from token or deck");
        }
      } catch (error) {
        console.error("📊 StatsPageSlide: Error resolving campaign:", error);
      }
    };

    resolveCampaign();
  }, [viralToken, deckSlug, resolveMetrics, shouldUseCachedSnapshot]);

  // Calculate image dimensions when loaded
  useEffect(() => {
    const updateDimensions = () => {
      if (!imageRef.current || !containerRef.current) return;
      
      const img = imageRef.current;
      const container = containerRef.current;
      
      const renderedWidth = img.clientWidth;
      const renderedHeight = img.clientHeight;
      
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const offsetX = (containerWidth - renderedWidth) / 2;
      const offsetY = (containerHeight - renderedHeight) / 2;
      
      setImageDimensions({
        width: renderedWidth,
        height: renderedHeight,
        offsetX: Math.max(0, offsetX),
        offsetY: Math.max(0, offsetY)
      });
    };

    if (imageLoaded) {
      // Small delay to ensure layout is complete
      setTimeout(updateDimensions, 100);
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, [imageLoaded]);

  const liveNumberHotspots = hotspots.filter(h => h.type === 'live_number');
  const chartHotspots = hotspots.filter(h => h.type === 'chart');
  const mapHotspots = hotspots.filter(h => h.type === 'map');

  // Extract campaign code for chart hotspots
  const [campaignCode, setCampaignCode] = useState<string>("");

  useEffect(() => {
    const extractCampaignCode = async () => {
      try {
        // First try to get campaign from token
        if (viralToken) {
          const { data: tokenData } = await supabase
            .from("tokens")
            .select("utm_campaign")
            .eq("token", viralToken)
            .maybeSingle();
          
          if (tokenData?.utm_campaign) {
            setCampaignCode(tokenData.utm_campaign);
            return;
          }
        }

        // Fallback: try to get campaign from deck's assigned EOA (events_actions.assigned_deck_slug)
        // Note: Multiple EOAs may be assigned to the same deck (from different campaigns)
        if (deckSlug) {
          const { data: eoaRows } = await supabase
            .from("events_actions")
            .select("campaign_id, campaigns(code)")
            .eq("assigned_deck_slug", deckSlug)
            .limit(1);
          
          const eoaData = eoaRows?.[0];
          
          if (eoaData?.campaigns?.code) {
            setCampaignCode(eoaData.campaigns.code);
          }
        }
      } catch (error) {
        console.error("📊 StatsPageSlide: Error extracting campaign code:", error);
      }
    };

    extractCampaignCode();
  }, [viralToken, deckSlug]);

  // If using cached snapshot, render simple static image (no API calls)
  if (shouldUseCachedSnapshot && cachedSnapshotPath) {
    const snapshotUrl = getSnapshotUrl(cachedSnapshotPath);
    console.log("📊 StatsPageSlide: Rendering cached snapshot:", snapshotUrl);
    
    return (
      <div 
        ref={containerRef}
        className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
      >
        <img
          src={snapshotUrl}
          alt="Stats page (cached)"
          className="max-w-full max-h-full object-contain"
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
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
    >
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
      
      {/* Loading indicator for metrics */}
      {metricsLoading && (
        <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading metrics...
        </div>
      )}
      
      {/* Render live_number hotspots */}
      {imageLoaded && imageDimensions.width > 0 && liveNumberHotspots.map((hotspot) => {
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
              // Clip long text to prevent overflow bleeding
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {value}
          </div>
        );
      })}

      {/* Render chart hotspots */}
      {imageLoaded && imageDimensions.width > 0 && campaignCode && chartHotspots.map((hotspot) => {
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

      {/* Render map hotspots */}
      {imageLoaded && imageDimensions.width > 0 && campaignCode && mapHotspots.map((hotspot) => {
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
