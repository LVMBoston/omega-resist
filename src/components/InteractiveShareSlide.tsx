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
  console.log("🎨 InteractiveShareSlide - Props:", {
    imageUrl,
    hotspots: JSON.stringify(hotspots, null, 2),
    deckSlug,
    viralToken
  });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
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
      {imageError ? (
        <div className="text-white text-center p-4">
          <p className="text-lg font-semibold mb-2">Image failed to load</p>
          <p className="text-sm text-gray-400 break-all">{imageUrl}</p>
        </div>
      ) : !imageUrl ? (
        <div className="text-white text-center p-4">
          <p className="text-lg font-semibold mb-2">No image URL provided</p>
          <p className="text-sm text-gray-400">Missing imageUrl prop</p>
        </div>
      ) : (
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Interactive viral slide"
          className="max-w-full max-h-full object-contain"
          onLoad={() => {
            console.log("✅ InteractiveShareSlide image loaded successfully:", imageUrl);
            setImageLoaded(true);
            setImageError(false);
          }}
          onError={(e) => {
            console.error("❌ InteractiveShareSlide image failed to load:", {
              imageUrl,
              error: e
            });
            setImageError(true);
          }}
        />
      )}
      {overlayReady && hotspots.length > 0 && !imageError && (
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
