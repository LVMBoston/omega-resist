import { useState, useEffect, useRef } from "react";
import { Hotspot } from "@/types/viralTemplates";
import { InteractiveSlideOverlay } from "./InteractiveSlideOverlay";

interface InteractiveShareSlideProps {
  imageUrl: string;
  hotspots: Hotspot[];
  deckSlug: string;
  viralToken: string | null;
}

export const InteractiveShareSlide = ({ 
  imageUrl, 
  hotspots, 
  deckSlug, 
  viralToken 
}: InteractiveShareSlideProps) => {
  console.log("🎨 InteractiveShareSlide - Received hotspots:", JSON.stringify(hotspots, null, 2));
  const [imageLoaded, setImageLoaded] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // Delay overlay mount to allow layout to complete on iPhone
  useEffect(() => {
    if (imageLoaded) {
      const timer = setTimeout(() => {
        setOverlayReady(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [imageLoaded]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Interactive viral slide"
        className="max-w-full max-h-full object-contain"
        onLoad={() => {
          console.log("🖼️ InteractiveShareSlide image loaded");
          setImageLoaded(true);
        }}
      />
      {overlayReady && hotspots.length > 0 && (
        <InteractiveSlideOverlay
          hotspots={hotspots}
          deckSlug={deckSlug}
          imageRef={imageRef}
          viralToken={viralToken}
        />
      )}
    </div>
  );
};
