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

  useEffect(() => {
    const fetchConfig = async () => {
      const { data, error } = await supabase
        .from("viral_slide_configs")
        .select("*")
        .eq("slide_id", slideId)
        .maybeSingle();

      if (error) {
        console.error("❌ Error fetching viral config:", error);
      } else if (data) {
        console.log("✅ Viral config loaded:", {
          slideId,
          image_url: data.image_url,
          hotspotsRaw: data.hotspots,
          hotspotsIsArray: Array.isArray(data.hotspots),
          hotspotsLength: Array.isArray(data.hotspots) ? data.hotspots.length : 0
        });
        setConfig({
          image_url: data.image_url,
          hotspots: Array.isArray(data.hotspots) ? (data.hotspots as unknown as Hotspot[]) : [],
        });
      } else {
        console.log("⚠️ No viral config found for slideId:", slideId);
      }
      setLoading(false);
    };

    fetchConfig();
  }, [slideId]);

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

  return (
    <div className="relative w-full h-full bg-black">
      <img
        src={config.image_url}
        alt="Viral slide"
        className="w-full h-full object-contain"
        onLoad={() => console.log("🖼️ ViralSlide image loaded")}
      />
      {config.hotspots.length > 0 && (
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
