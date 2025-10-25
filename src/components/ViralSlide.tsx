import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InteractiveSlideOverlay } from "./InteractiveSlideOverlay";
import { Loader2 } from "lucide-react";

interface ViralSlideProps {
  slideId: string;
  deckSlug: string;
  viralToken: string | null;
}

interface Hotspot {
  id: string;
  iconId: string;
  type: "sms" | "email" | "social";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ViralConfig {
  image_url: string;
  hotspots: Hotspot[];
}

export const ViralSlide = ({ slideId, deckSlug, viralToken }: ViralSlideProps) => {
  const COMPONENT_VERSION = "v2.0.0-20251025"; // Cache buster
  console.log(`🎯 ViralSlide ${COMPONENT_VERSION} - Mounting with slideId:`, slideId);
  
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
        console.log(`⚠️ ${COMPONENT_VERSION} - No template_id, checking legacy config`);
        // Fallback: Check if there's a direct viral_slide_config for this slide (legacy)
        const { data: legacyData, error: legacyError } = await supabase
          .from("viral_slide_configs")
          .select("*")
          .eq("slide_id", slideId)
          .maybeSingle();

        if (legacyError) {
          console.error("❌ Error fetching legacy viral config:", legacyError);
        } else if (legacyData) {
        console.log("✅ Legacy viral config loaded:", {
          slideId,
          image_url: legacyData.image_url,
          hotspotsLength: Array.isArray(legacyData.hotspots) ? legacyData.hotspots.length : 0
        });
        
        // Map iconId to type for backward compatibility and ensure all fields are present
        const mappedHotspots = Array.isArray(legacyData.hotspots) 
          ? legacyData.hotspots.map((h: any) => ({
              ...h,
              iconId: h.iconId || `${h.type}-default`,
              type: h.type || (h.iconId?.includes('sms') ? 'sms' : h.iconId?.includes('email') ? 'email' : 'social')
            }))
          : [];
        
        setConfig({
          image_url: legacyData.image_url,
          hotspots: mappedHotspots,
        });
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
          ? templateData.hotspots.map((h: any) => ({
              ...h,
              iconId: h.iconId || `${h.type}-default`,
              type: h.type || (h.iconId?.includes('sms') ? 'sms' : h.iconId?.includes('email') ? 'email' : 'social')
            }))
          : [];
        
        setConfig({
          image_url: templateData.image_url,
          hotspots: mappedHotspots,
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
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No viral slide configuration found</p>
      </div>
    );
  }

  console.log(`🎨 ${COMPONENT_VERSION} - Rendering with ${config.hotspots.length} hotspots`);
  console.log("📱 Device info:", {
    userAgent: navigator.userAgent,
    isIPhone: navigator.userAgent.includes('iPhone'),
    isIPad: navigator.userAgent.includes('iPad'),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  });

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      <img
        src={config.image_url}
        alt="Viral slide"
        className="max-w-full max-h-full object-contain"
        onLoad={() => {
          console.log("🖼️ ViralSlide image loaded");
          setImageLoaded(true);
        }}
      />
      {overlayReady && config.hotspots.length > 0 && (
        <InteractiveSlideOverlay
          hotspots={config.hotspots}
          deckSlug={deckSlug}
          imageUrl={config.image_url}
          viralToken={viralToken}
        />
      )}
    </div>
  );
};
