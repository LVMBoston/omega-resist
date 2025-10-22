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
  const [config, setConfig] = useState<ViralConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      // First get the slide_items to find the template_id
      const { data: slideData, error: slideError } = await supabase
        .from("slide_items")
        .select("template_id")
        .eq("id", slideId)
        .maybeSingle();

      if (slideError) {
        console.error("❌ Error fetching slide:", slideError);
        setLoading(false);
        return;
      }

      if (!slideData?.template_id) {
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
          setConfig({
            image_url: legacyData.image_url,
            hotspots: Array.isArray(legacyData.hotspots) ? (legacyData.hotspots as unknown as Hotspot[]) : [],
          });
        }
        setLoading(false);
        return;
      }

      // Fetch the template configuration
      const { data: templateData, error: templateError } = await supabase
        .from("viral_slide_configs")
        .select("*")
        .eq("id", slideData.template_id)
        .single();

      if (templateError) {
        console.error("❌ Error fetching template:", templateError);
      } else if (templateData) {
        console.log("✅ Template config loaded:", {
          templateId: templateData.id,
          templateName: templateData.name,
          image_url: templateData.image_url,
          hotspotsLength: Array.isArray(templateData.hotspots) ? templateData.hotspots.length : 0
        });
        setConfig({
          image_url: templateData.image_url,
          hotspots: Array.isArray(templateData.hotspots) ? (templateData.hotspots as unknown as Hotspot[]) : [],
        });
      } else {
        console.log("⚠️ No template found for template_id:", slideData.template_id);
      }
      setLoading(false);
    };

    fetchConfig();
  }, [slideId]);

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
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No viral slide configuration found</p>
      </div>
    );
  }

  console.log("🎨 ViralSlide rendering with hotspots:", config.hotspots.length);
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
