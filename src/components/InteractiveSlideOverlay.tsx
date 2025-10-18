import { MessageSquare, Mail, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mintShare } from "@/lib/virality/mint";
import { useSearchParams } from "react-router-dom";

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
  viralToken: string | null;
}

export const InteractiveSlideOverlay = ({
  hotspots,
  deckSlug,
  imageUrl,
  viralToken,
}: InteractiveSlideOverlayProps) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageDimensions, setImageDimensions] = useState({ 
    offsetX: 0, 
    offsetY: 0, 
    width: 0, 
    height: 0 
  });
  const [emailTemplate, setEmailTemplate] = useState<{subject: string; body: string} | null>(null);
  const [smsTemplate, setSmsTemplate] = useState<{body: string} | null>(null);

  // Fetch email and SMS templates
  useEffect(() => {
    const fetchTemplates = async () => {
      const { data: emailData } = await supabase
        .from("settings")
        .select("value")
        .eq("category", "email")
        .eq("key", "l01_template")
        .maybeSingle();
      
      const { data: smsData } = await supabase
        .from("settings")
        .select("value")
        .eq("category", "sms")
        .eq("key", "l01_template")
        .maybeSingle();
      
      if (emailData) setEmailTemplate(emailData.value as any);
      if (smsData) setSmsTemplate(smsData.value as any);
    };
    fetchTemplates();
  }, []);

  useEffect(() => {
    console.log("🔧 InteractiveSlideOverlay effect running, ref:", !!containerRef.current);
    
    const updateImageDimensions = () => {
      if (!containerRef.current) {
        console.log("⚠️ No container ref available, retrying...");
        setTimeout(updateImageDimensions, 50);
        return;
      }

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      console.log("📐 Container dimensions:", {
        width: containerRect.width,
        height: containerRect.height
      });

      if (containerRect.width === 0 || containerRect.height === 0) {
        console.log("⚠️ Container has zero dimensions, retrying in 100ms...");
        setTimeout(updateImageDimensions, 100);
        return;
      }
      
      const img = new Image();
      img.onload = () => {
        const containerAspect = containerRect.width / containerRect.height;
        const imageAspect = img.naturalWidth / img.naturalHeight;
        
        console.log("🖼️ Image loaded:", {
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          containerAspect,
          imageAspect
        });
        
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
        
        console.log("✅ Setting image dimensions:", {
          offsetX,
          offsetY,
          width: renderedWidth,
          height: renderedHeight
        });
        
        setImageDimensions({
          offsetX,
          offsetY,
          width: renderedWidth,
          height: renderedHeight,
        });
      };
      
      img.onerror = () => {
        console.error("❌ Failed to load image:", imageUrl);
      };
      
      img.src = imageUrl;
    };

    // Initial load with delay to ensure container is rendered
    const timer = setTimeout(updateImageDimensions, 100);
    
    window.addEventListener('resize', updateImageDimensions);
    document.addEventListener('fullscreenchange', updateImageDimensions);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateImageDimensions);
      document.removeEventListener('fullscreenchange', updateImageDimensions);
    };
  }, [imageUrl]);

  const handleSMS = async () => {
    try {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📱 SMS SHARE INITIATED");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("1️⃣ Parent Token from URL:", viralToken);
      console.log("2️⃣ SMS Template:", JSON.stringify(smsTemplate, null, 2));
      
      if (!viralToken) {
        console.error("❌ ERROR: No viral token found in URL");
        console.log("Current URL:", window.location.href);
        toast({
          variant: "destructive",
          title: "Share Link Required",
          description: "This slide needs to be accessed via a viral share link to enable sharing. Please use a link from a previous share.",
          duration: Infinity,
        });
        return;
      }

      const mintSharePayload = { 
        parentToken: viralToken, 
        utmMedium: "sms" as const
      };
      console.log("3️⃣ mintShare Request Payload:", JSON.stringify(mintSharePayload, null, 2));
      
      // Mint new share token
      const result = await mintShare(mintSharePayload);
      
      console.log("4️⃣ mintShare Response:", JSON.stringify(result, null, 2));
      const { token, full_url, level } = result;

      // Use template or fallback
      const message = smsTemplate?.body 
        ? smsTemplate.body.replace("{{link}}", full_url)
        : `Check out this deck: ${full_url}`;

      const finalPayload = {
        newToken: token,
        level: level,
        fullUrl: full_url,
        message: message,
        encodedSmsUrl: `sms:?body=${encodeURIComponent(message)}`
      };
      
      console.log("5️⃣ Final SMS Payload:", JSON.stringify(finalPayload, null, 2));
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");


      const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
      const link = document.createElement('a');
      link.href = smsUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Opening SMS",
        description: "Share this deck via text message",
      });
    } catch (error) {
      console.error("❌ SMS share error (full):", error);
      console.error("❌ Error details:", JSON.stringify(error, null, 2));
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate share link",
      });
    }
  };

  const handleEmail = async () => {
    try {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📧 EMAIL SHARE INITIATED");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("1️⃣ Parent Token from URL:", viralToken);
      console.log("2️⃣ Email Template:", JSON.stringify(emailTemplate, null, 2));
      
      if (!viralToken) {
        console.error("❌ ERROR: No viral token found in URL");
        console.log("Current URL:", window.location.href);
        toast({
          variant: "destructive",
          title: "Share Link Required",
          description: "This slide needs to be accessed via a viral share link to enable sharing. Please use a link from a previous share.",
          duration: Infinity,
        });
        return;
      }

      const mintSharePayload = { 
        parentToken: viralToken, 
        utmMedium: "em" as const
      };
      console.log("3️⃣ mintShare Request Payload:", JSON.stringify(mintSharePayload, null, 2));
      
      // Mint new share token
      const result = await mintShare(mintSharePayload);
      
      console.log("4️⃣ mintShare Response:", JSON.stringify(result, null, 2));
      const { token, full_url, level } = result;

      // Use template or fallback
      const subject = emailTemplate?.subject || "Check out this presentation";
      const body = emailTemplate?.body 
        ? emailTemplate.body.replace("{{link}}", full_url)
        : `I thought you might be interested in this: ${full_url}`;

      const finalPayload = {
        newToken: token,
        level: level,
        fullUrl: full_url,
        subject: subject,
        body: body,
        mailtoUrl: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      };
      
      console.log("5️⃣ Final Email Payload:", JSON.stringify(finalPayload, null, 2));
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");


      const mailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      const link = document.createElement('a');
      link.href = mailUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Opening Email",
        description: "Share this deck via email",
      });
    } catch (error) {
      console.error("❌ Email share error (full):", error);
      console.error("❌ Error details:", JSON.stringify(error, null, 2));
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate share link",
      });
    }
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

  console.log("🎯 InteractiveSlideOverlay render:", {
    hotspotsCount: hotspots.length,
    imageDimensions,
    hotspots: hotspots.map(h => ({ id: h.id, type: h.type, x: h.x, y: h.y }))
  });

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-50">
      {imageDimensions.width > 0 && imageDimensions.height > 0 && hotspots.map((hotspot) => {
        // Calculate hotspot position relative to rendered image
        const left = imageDimensions.offsetX + (hotspot.x / 100) * imageDimensions.width;
        const top = imageDimensions.offsetY + (hotspot.y / 100) * imageDimensions.height;
        const width = (hotspot.width / 100) * imageDimensions.width;
        const height = (hotspot.height / 100) * imageDimensions.height;
        
        console.log(`🎯 Hotspot ${hotspot.id} position:`, { left, top, width, height });
        
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
