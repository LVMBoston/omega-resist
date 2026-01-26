import { useState, useEffect, useRef } from "react";
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
}

export const StatsPageSlide = ({ imageUrl, hotspots, deckSlug, viralToken }: StatsPageSlideProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ 
    width: 0, 
    height: 0, 
    offsetX: 0, 
    offsetY: 0 
  });

  // Get live metrics via the hook
  const { metricsMap, loading: metricsLoading, resolveMetrics } = useLiveMetrics();

  // Resolve campaign from viralToken or deckSlug
  useEffect(() => {
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

        // Fallback: try to get campaign from deck's EOA assignments
        if (!campaignCode && deckSlug) {
          const { data: assignmentData } = await supabase
            .from("deck_eoa_assignments")
            .select("eoa_id")
            .eq("deck_slug", deckSlug)
            .limit(1)
            .maybeSingle();
          
          if (assignmentData?.eoa_id) {
            const { data: eoaData } = await supabase
              .from("events_actions")
              .select("campaign_id")
              .eq("id", assignmentData.eoa_id)
              .maybeSingle();
            
            if (eoaData?.campaign_id) {
              const { data: campaignData } = await supabase
                .from("campaigns")
                .select("code")
                .eq("id", eoaData.campaign_id)
                .maybeSingle();
              
              if (campaignData?.code) {
                campaignCode = campaignData.code;
              }
            }
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
  }, [viralToken, deckSlug, resolveMetrics]);

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

        // Fallback: try to get campaign from deck's EOA assignments
        if (deckSlug) {
          const { data: assignmentData } = await supabase
            .from("deck_eoa_assignments")
            .select("eoa_id")
            .eq("deck_slug", deckSlug)
            .limit(1)
            .maybeSingle();
          
          if (assignmentData?.eoa_id) {
            const { data: eoaData } = await supabase
              .from("events_actions")
              .select("campaign_id")
              .eq("id", assignmentData.eoa_id)
              .maybeSingle();
            
            if (eoaData?.campaign_id) {
              const { data: campaignData } = await supabase
                .from("campaigns")
                .select("code")
                .eq("id", eoaData.campaign_id)
                .maybeSingle();
              
              if (campaignData?.code) {
                setCampaignCode(campaignData.code);
              }
            }
          }
        }
      } catch (error) {
        console.error("📊 StatsPageSlide: Error extracting campaign code:", error);
      }
    };

    extractCampaignCode();
  }, [viralToken, deckSlug]);

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
        onLoad={() => setImageLoaded(true)}
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
            className="absolute flex items-center justify-center"
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
