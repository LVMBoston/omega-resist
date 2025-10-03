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
  const [imageDimensions, setImageDimensions] = useState({ 
    offsetX: 0, 
    offsetY: 0, 
    width: 0, 
    height: 0 
  });

  useEffect(() => {
    const updateImageDimensions = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      const img = new Image();
      img.onload = () => {
        const containerAspect = containerRect.width / containerRect.height;
        const imageAspect = img.naturalWidth / img.naturalHeight;
        
        let renderedWidth, renderedHeight, offsetX = 0, offsetY = 0;
        
        if (containerAspect > imageAspect) {
          // Container is wider - image height fills container
          renderedHeight = containerRect.height;
          renderedWidth = renderedHeight * imageAspect;
          offsetX = (containerRect.width - renderedWidth) / 2;
        } else {
          // Container is taller - image width fills container
          renderedWidth = containerRect.width;
          renderedHeight = renderedWidth / imageAspect;
          offsetY = (containerRect.height - renderedHeight) / 2;
        }
        
        setImageDimensions({
          offsetX,
          offsetY,
          width: renderedWidth,
          height: renderedHeight,
        });
      };
      img.src = imageUrl;
    };

    updateImageDimensions();
    window.addEventListener('resize', updateImageDimensions);
    return () => window.removeEventListener('resize', updateImageDimensions);
  }, [imageUrl]);

  const handleSMS = () => {
    const message = `Check out this deck: ${window.location.href}`;
    const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
    const link = document.createElement('a');
    link.href = smsUrl;
    link.click();
    toast({
      title: "Opening SMS",
      description: "Share this deck via text message",
    });
  };

  const handleEmail = () => {
    const subject = "Check out this presentation";
    const body = `I thought you might be interested in this: ${window.location.href}`;
    const mailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const link = document.createElement('a');
    link.href = mailUrl;
    link.click();
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
        // Calculate hotspot position relative to rendered image
        const left = imageDimensions.offsetX + (hotspot.x / 100) * imageDimensions.width;
        const top = imageDimensions.offsetY + (hotspot.y / 100) * imageDimensions.height;
        const width = (hotspot.width / 100) * imageDimensions.width;
        const height = (hotspot.height / 100) * imageDimensions.height;
        
        return (
          <button
            key={hotspot.id}
            onClick={getHotspotAction(hotspot.type)}
            className="absolute pointer-events-auto bg-transparent border-2 border-yellow-400 hover:bg-yellow-400/10 transition-colors rounded-md flex items-center justify-center text-yellow-400 font-medium"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`,
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
