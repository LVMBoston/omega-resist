import { MessageSquare, Mail, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState } from "react";

interface Hotspot {
  id: string;
  type: "sms" | "email" | "social";
  label: string;
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  height: number; // percentage
}

interface InteractiveSlideOverlayProps {
  hotspots: Hotspot[];
  deckSlug: string;
  imageUrl: string;
}

export const InteractiveSlideOverlay = ({
  hotspots,
  deckSlug,
  imageUrl,
}: InteractiveSlideOverlayProps) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageScale, setImageScale] = useState({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 });

  useEffect(() => {
    const updateImageScale = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      // Create a temporary image to get natural dimensions
      const img = new Image();
      img.onload = () => {
        const containerAspect = containerRect.width / containerRect.height;
        const imageAspect = img.naturalWidth / img.naturalHeight;
        
        let renderedWidth, renderedHeight, offsetX = 0, offsetY = 0;
        
        if (containerAspect > imageAspect) {
          // Container is wider - image will have horizontal letterboxing
          renderedHeight = containerRect.height;
          renderedWidth = renderedHeight * imageAspect;
          offsetX = (containerRect.width - renderedWidth) / 2;
        } else {
          // Container is taller - image will have vertical letterboxing
          renderedWidth = containerRect.width;
          renderedHeight = renderedWidth / imageAspect;
          offsetY = (containerRect.height - renderedHeight) / 2;
        }
        
        setImageScale({
          offsetX,
          offsetY,
          scaleX: renderedWidth / containerRect.width,
          scaleY: renderedHeight / containerRect.height,
        });
      };
      img.src = imageUrl;
    };

    updateImageScale();
    window.addEventListener('resize', updateImageScale);
    return () => window.removeEventListener('resize', updateImageScale);
  }, [imageUrl]);

  const handleSMS = () => {
    const message = `Check out this deck: ${window.location.origin}/deck/${deckSlug}`;
    const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
    window.location.href = smsUrl;
    toast({
      title: "Opening SMS",
      description: "Share this deck via text message",
    });
  };

  const handleEmail = () => {
    const subject = "Check out this presentation";
    const body = `I thought you might be interested in this: ${window.location.origin}/deck/${deckSlug}`;
    const mailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailUrl;
    toast({
      title: "Opening Email",
      description: "Share this deck via email",
    });
  };

  const handleSocial = async () => {
    const shareUrl = `${window.location.origin}/deck/${deckSlug}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Check out this deck",
          text: "I thought you might be interested in this presentation",
          url: shareUrl,
        });
        toast({
          title: "Shared successfully",
          description: "Thanks for spreading the word!",
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link copied",
        description: "Share link copied to clipboard",
      });
    }
  };

  const getHotspotIcon = (type: string) => {
    switch (type) {
      case "sms":
        return <MessageSquare className="w-6 h-6" />;
      case "email":
        return <Mail className="w-6 h-6" />;
      case "social":
        return <Share2 className="w-6 h-6" />;
      default:
        return <Share2 className="w-6 h-6" />;
    }
  };

  const getHotspotAction = (type: string) => {
    switch (type) {
      case "sms":
        return handleSMS;
      case "email":
        return handleEmail;
      case "social":
        return handleSocial;
      default:
        return handleSocial;
    }
  };

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      {hotspots.map((hotspot) => {
        // Adjust hotspot position based on actual rendered image dimensions
        const adjustedLeft = imageScale.offsetX + (hotspot.x * imageScale.scaleX);
        const adjustedTop = imageScale.offsetY + (hotspot.y * imageScale.scaleY);
        const adjustedWidth = hotspot.width * imageScale.scaleX;
        const adjustedHeight = hotspot.height * imageScale.scaleY;
        
        return (
          <button
            key={hotspot.id}
            onClick={getHotspotAction(hotspot.type)}
            className="absolute pointer-events-auto bg-transparent border-2 border-yellow-400 hover:bg-yellow-400/10 transition-colors rounded-md flex items-center justify-center text-yellow-400 font-medium"
            style={{
              left: `${adjustedLeft}px`,
              top: `${adjustedTop}px`,
              width: `${adjustedWidth}px`,
              height: `${adjustedHeight}px`,
            }}
          >
            {getHotspotIcon(hotspot.type)}
            <span className="ml-2">{hotspot.label}</span>
          </button>
        );
      })}
    </div>
  );
};
