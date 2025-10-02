import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InteractiveSlideOverlay } from "./InteractiveSlideOverlay";
import { Loader2 } from "lucide-react";

interface ViralSlideProps {
  slideId: string;
  deckSlug: string;
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

export const ViralSlide = ({ slideId, deckSlug }: ViralSlideProps) => {
  const [config, setConfig] = useState<ViralConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data, error } = await supabase
        .from("viral_slide_configs")
        .select("*")
        .eq("slug", slideId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching viral config:", error);
      } else if (data) {
        setConfig({
          image_url: data.image_url,
          hotspots: Array.isArray(data.hotspots) ? (data.hotspots as unknown as Hotspot[]) : [],
        });
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

  return (
    <div className="relative w-full h-full">
      <img
        src={config.image_url}
        alt="Viral slide"
        className="w-full h-full object-contain"
      />
      <InteractiveSlideOverlay
        hotspots={config.hotspots}
        deckSlug={deckSlug}
        imageUrl={config.image_url}
      />
    </div>
  );
};
