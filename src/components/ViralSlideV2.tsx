import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InteractiveShareSlide } from "./InteractiveShareSlide";
import { DisplayOnlySlide } from "./DisplayOnlySlide";
import { StatsPageSlide } from "./StatsPageSlide";
import { Loader2 } from "lucide-react";
import { TemplateType, DisplayOnlyConfig } from "@/types/viralTemplates";

// Module loaded timestamp - 2025-10-25T19:20:00Z
console.log("🚀🚀🚀 ViralSlideV2 MODULE LOADED - TIMESTAMP: 2025-10-25T19:20:00Z 🚀🚀🚀");

interface ViralSlideProps {
  slideId: string;
  deckSlug: string;
  viralToken: string | null;
  templateId?: string;
}

interface Hotspot {
  id: string;
  iconId: string;
  type: "sms" | "email" | "social" | "external_link";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  url?: string;
  labelPosition?: 'top' | 'bottom';
}

interface ViralConfig {
  image_url: string;
  hotspots: Hotspot[];
  template_type?: TemplateType;
  config?: any;
  // Snapshot properties
  cached_snapshot_path?: string | null;
  snapshot_rendered_at?: string | null;
  snapshot_enabled?: boolean;
  snapshot_interval_minutes?: number;
}

export const ViralSlide = ({ slideId, deckSlug, viralToken }: ViralSlideProps) => {
  const COMPONENT_VERSION = "v2.2.0-FORCE-REBUILD-NOW"; // Force rebuild
  console.log(`🎯🎯🎯 ViralSlide ${COMPONENT_VERSION} - Mounting with slideId:`, slideId);
  console.log(`🔥🔥🔥 NEW CODE IS RUNNING - slideId:`, slideId);
  
  const [config, setConfig] = useState<ViralConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      console.log(`🔥 ${COMPONENT_VERSION} - Fetching config for slideId:`, slideId);
      
      // First get the slide_items to find the template_id
      const { data: slideData, error: slideError } = await supabase
        .from("slide_items")
        .select("template_id, type, deck_slug")
        .eq("id", slideId)
        .maybeSingle();

      console.log("📊 Slide query result:", { 
        found: !!slideData, 
        hasTemplate: !!slideData?.template_id,
        templateId: slideData?.template_id 
      });

      if (slideError) {
        console.error(`❌ ${COMPONENT_VERSION} - Slide fetch error:`, slideError);
        setLoading(false);
        return;
      }

      if (!slideData) {
        console.error(`❌ ${COMPONENT_VERSION} - No slide found for id:`, slideId);
        setLoading(false);
        return;
      }

      if (!slideData?.template_id) {
        console.error(`❌ ${COMPONENT_VERSION} - CRITICAL: No template_id found for slide:`, {
          slideId,
          slideData,
          deck_slug: slideData?.deck_slug,
          type: slideData?.type
        });
        
        // Fallback: Check if there's a direct viral_slide_config for this slide (legacy)
        console.log(`🔍 ${COMPONENT_VERSION} - Attempting legacy config lookup...`);
        const { data: legacyData, error: legacyError } = await supabase
          .from("viral_slide_configs")
          .select("*")
          .eq("slide_id", slideId)
          .maybeSingle();

        if (legacyError) {
          console.error(`❌ ${COMPONENT_VERSION} - Legacy config fetch error:`, legacyError);
          setLoading(false);
          return;
        }
        
        if (legacyData) {
          console.log(`✅ ${COMPONENT_VERSION} - Legacy viral config loaded:`, {
            slideId,
            image_url: legacyData.image_url,
            hotspotsLength: Array.isArray(legacyData.hotspots) ? legacyData.hotspots.length : 0
          });
          
          // Map iconId to type for backward compatibility and ensure all fields are present
          const mappedHotspots = Array.isArray(legacyData.hotspots) 
            ? legacyData.hotspots.map((h: any) => {
                console.log("🔍 ViralSlideV2 - Raw hotspot from DB (legacy):", JSON.stringify(h, null, 2));
                const mapped = {
                  ...h,
                  iconId: h.iconId || `${h.type}-default`,
                  type: h.type || (h.iconId?.includes('sms') ? 'sms' : h.iconId?.includes('email') ? 'email' : 'social'),
                  url: h.url, // Explicitly preserve URL for external_link type
                  labelPosition: h.labelPosition || 'bottom'
                };
                console.log("✅ ViralSlideV2 - Mapped hotspot (legacy):", JSON.stringify(mapped, null, 2));
                return mapped;
              })
            : [];
          
          setConfig({
            image_url: legacyData.image_url,
            hotspots: mappedHotspots,
            template_type: (legacyData.template_type as TemplateType) || 'interactive_share',
            config: legacyData.config || {},
            cached_snapshot_path: legacyData.cached_snapshot_path,
            snapshot_rendered_at: legacyData.snapshot_rendered_at,
          });
        } else {
          console.error(`❌ ${COMPONENT_VERSION} - No legacy config found either. Slide cannot be rendered.`);
        }
        
        setLoading(false);
        return;
      }

      // Fetch the template configuration
      console.log(`🔍 ${COMPONENT_VERSION} - Querying template:`, slideData.template_id);
      const { data: templateData, error: templateError } = await supabase
        .from("viral_slide_configs")
        .select("*")
        .eq("id", slideData.template_id)
        .single();

      if (templateError) {
        console.error(`❌ ${COMPONENT_VERSION} - Template query error:`, templateError);
      } else if (templateData) {
        console.log(`✅ ${COMPONENT_VERSION} - Template loaded:`, {
          id: templateData.id,
          name: templateData.name,
          hotspots: Array.isArray(templateData.hotspots) ? templateData.hotspots.length : 0
        });
        
        // Map iconId to type for backward compatibility and ensure all fields are present
        const mappedHotspots = Array.isArray(templateData.hotspots) 
          ? templateData.hotspots.map((h: any) => {
              console.log("🔍 ViralSlideV2 - Raw hotspot from DB:", JSON.stringify(h, null, 2));
              const mapped = {
                ...h,
                iconId: h.iconId || `${h.type}-default`,
                type: h.type || (h.iconId?.includes('sms') ? 'sms' : h.iconId?.includes('email') ? 'email' : 'social'),
                url: h.url, // Explicitly preserve URL for external_link type
                labelPosition: h.labelPosition || 'bottom'
              };
              console.log("✅ ViralSlideV2 - Mapped hotspot:", JSON.stringify(mapped, null, 2));
              return mapped;
            })
          : [];
        
        const templateType = (templateData.template_type as TemplateType) || 'interactive_share';
        
        // For stats_page templates, fetch campaign snapshot settings
        let snapshotEnabled = false;
        let snapshotIntervalMinutes = 2;
        
        if (templateType === 'stats_page') {
          // Try to get campaign settings via deck assignment
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
                .select("snapshot_enabled, snapshot_interval_minutes")
                .eq("id", eoaData.campaign_id)
                .maybeSingle();
              
              if (campaignData) {
                snapshotEnabled = campaignData.snapshot_enabled ?? false;
                snapshotIntervalMinutes = campaignData.snapshot_interval_minutes ?? 2;
              }
            }
          }
        }
        
        setConfig({
          image_url: templateData.image_url,
          hotspots: mappedHotspots,
          template_type: templateType,
          config: templateData.config || {},
          cached_snapshot_path: templateData.cached_snapshot_path,
          snapshot_rendered_at: templateData.snapshot_rendered_at,
          snapshot_enabled: snapshotEnabled,
          snapshot_interval_minutes: snapshotIntervalMinutes,
        });
      } else {
        console.warn(`⚠️ ${COMPONENT_VERSION} - Template query returned null for:`, slideData.template_id);
      }
      setLoading(false);
    };

    fetchConfig();
  }, [slideId, COMPONENT_VERSION]);

  // Delay overlay mount to allow layout to complete on iPhone
  useEffect(() => {
    if (imageLoaded) {
      const timer = setTimeout(() => {
        setOverlayReady(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [imageLoaded]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!config) {
    console.error(`❌ ${COMPONENT_VERSION} - Render aborted: No config available for slideId:`, slideId);
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-destructive font-semibold mb-2">Interactive Slide Configuration Missing</p>
        <p className="text-muted-foreground text-sm mb-4">
          This slide is marked as interactive but has no template assigned.
        </p>
        <p className="text-xs text-muted-foreground">Slide ID: {slideId}</p>
      </div>
    );
  }

  const templateType = config.template_type || 'interactive_share';
  
  console.log(`🎨 ${COMPONENT_VERSION} - Rendering template type: ${templateType}`);
  console.log("📱 Device info:", {
    userAgent: navigator.userAgent,
    isIPhone: navigator.userAgent.includes('iPhone'),
    isIPad: navigator.userAgent.includes('iPad'),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  });

  // Branch rendering based on template_type
  if (templateType === 'display_only') {
    return <DisplayOnlySlide imageUrl={config.image_url} config={config.config as DisplayOnlyConfig || { type: 'display_only' }} />;
  }

  if (templateType === 'stats_page') {
    return (
      <StatsPageSlide 
        imageUrl={config.image_url} 
        hotspots={config.hotspots} 
        deckSlug={deckSlug}
        viralToken={viralToken}
        cachedSnapshotPath={config.cached_snapshot_path}
        snapshotRenderedAt={config.snapshot_rendered_at}
        snapshotEnabled={config.snapshot_enabled}
        snapshotIntervalMinutes={config.snapshot_interval_minutes}
      />
    );
  }
  
  if (templateType === 'interactive_share' || !templateType) {
    return (
      <InteractiveShareSlide 
        imageUrl={config.image_url} 
        hotspots={config.hotspots} 
        deckSlug={deckSlug}
        viralToken={viralToken}
      />
    );
  }

  // Fallback for unknown types
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <p className="text-destructive font-semibold mb-2">Unknown Template Type</p>
      <p className="text-muted-foreground text-sm mb-4">
        Template type "{templateType}" is not supported.
      </p>
      <p className="text-xs text-muted-foreground">Slide ID: {slideId}</p>
    </div>
  );
};
