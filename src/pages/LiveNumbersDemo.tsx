import { useRef, useState } from "react";
import testSlideImage from "@/assets/test-live-numbers-slide.png";
import { InteractiveSlideOverlay } from "@/components/InteractiveSlideOverlay";
import { Hotspot } from "@/types/viralTemplates";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Demo page for Live Numbers Overlay (Phase 1 Mockup)
 * Shows a test slide with hardcoded live_number hotspots
 */
export default function LiveNumbersDemo() {
  const navigate = useNavigate();
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Mockup hotspots positioned over the test slide
  // Adjusted to precisely cover the "39" text in the PNG
  const mockHotspots: Hotspot[] = [
    {
      id: "seeds-value",
      iconId: "live-number",
      type: "live_number",
      label: "Seeds Count",
      x: 26,           // Left edge of "39" box
      y: 17.5,         // Top of the beige box
      width: 14,       // Width of "39" number area
      height: 9,       // Height to cover the number
      metricKey: "seeds",
      liveNumberStyle: {
        fontSize: "56px",
        fontWeight: "700",
        color: "#1a1a1a",              // Dark text to match original
        backgroundColor: "#e8dcc8",    // Beige background matching the box
        textAlign: "center",
        fontFamily: "'Georgia', serif",
        padding: "4px",
      }
    }
  ];

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="bg-background/90 backdrop-blur-sm p-4 flex items-center gap-4 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="font-semibold">Live Numbers Demo</h1>
          <p className="text-sm text-muted-foreground">
            Phase 1 Mockup - Hardcoded live_number overlay
          </p>
        </div>
      </div>

      {/* Slide Preview */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative max-w-4xl w-full">
          <img
            ref={imageRef}
            src={testSlideImage}
            alt="Test slide with live numbers"
            className="w-full h-auto rounded-lg shadow-2xl"
            onLoad={() => setImageLoaded(true)}
          />
          
          {imageLoaded && (
            <InteractiveSlideOverlay
              hotspots={mockHotspots}
              deckSlug="demo"
              imageRef={imageRef}
              viralToken={null}
            />
          )}
        </div>
      </div>

      {/* Debug Info */}
      <div className="bg-background/90 backdrop-blur-sm p-4 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-semibold mb-2">Hotspot Configuration</h2>
          <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
            {JSON.stringify(mockHotspots, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
