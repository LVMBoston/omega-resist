import { MessageSquare, Mail, Share2 } from "lucide-react";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";

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
    <div className="absolute inset-0 pointer-events-none">
      {hotspots.map((hotspot) => (
        <Button
          key={hotspot.id}
          onClick={getHotspotAction(hotspot.type)}
          className="absolute pointer-events-auto"
          style={{
            left: `${hotspot.x}%`,
            top: `${hotspot.y}%`,
            width: `${hotspot.width}%`,
            height: `${hotspot.height}%`,
          }}
          variant="secondary"
        >
          {getHotspotIcon(hotspot.type)}
          <span className="ml-2">{hotspot.label}</span>
        </Button>
      ))}
    </div>
  );
};
