import { MessageSquare, Mail, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mintShare } from "@/lib/virality/mint";
import { useSearchParams } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaWhatsapp } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { BsShare, BsShareFill } from "react-icons/bs";
import mailIcon from "@/assets/mail-icon.png";
import textIcon from "@/assets/text-icon.svg";

interface Hotspot {
  id: string;
  iconId: string;
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
    let retryCount = 0;
    const maxRetries = 50;
    let retryTimer: number | undefined;
    let resizeObserver: ResizeObserver | undefined;
    
    // Reset dimensions on mount
    setImageDimensions({ offsetX: 0, offsetY: 0, width: 0, height: 0 });
    
    const updateImageDimensions = () => {
      retryCount++;
      
      if (!containerRef.current) {
        console.log(`⚠️ No container ref available (attempt ${retryCount}/${maxRetries})`);
        if (retryCount < maxRetries) {
          retryTimer = window.setTimeout(updateImageDimensions, 100);
        } else {
          console.error("❌ Failed to get container ref after max retries");
        }
        return;
      }

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      console.log(`📐 Container dimensions (attempt ${retryCount}):`, {
        width: containerRect.width,
        height: containerRect.height,
        device: navigator.userAgent.includes('iPhone') ? 'iPhone' : 
                navigator.userAgent.includes('iPad') ? 'iPad' : 'Other'
      });

      if (containerRect.width === 0 || containerRect.height === 0) {
        console.log(`⚠️ Container has zero dimensions (attempt ${retryCount}/${maxRetries}), retrying...`);
        if (retryCount < maxRetries) {
          retryTimer = window.setTimeout(updateImageDimensions, 100);
        } else {
          console.error("❌ Container dimensions never became available");
        }
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
          renderedHeight = containerRect.height;
          renderedWidth = renderedHeight * imageAspect;
          offsetX = (containerRect.width - renderedWidth) / 2;
        } else {
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

    // Set up ResizeObserver to detect when container gets dimensions
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            console.log("📏 ResizeObserver detected dimensions:", {
              width: entry.contentRect.width,
              height: entry.contentRect.height
            });
            updateImageDimensions();
          }
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    const timer = window.setTimeout(updateImageDimensions, 100);
    
    window.addEventListener('resize', updateImageDimensions);
    document.addEventListener('fullscreenchange', updateImageDimensions);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log("🔄 Page became visible, recalculating dimensions");
        updateImageDimensions();
      }
    });
    
    return () => {
      window.clearTimeout(timer);
      if (retryTimer) window.clearTimeout(retryTimer);
      if (resizeObserver) resizeObserver.disconnect();
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

  // Map iconId to actual icon/image
  const getHotspotIcon = (iconId: string) => {
    switch (iconId) {
      case "sms-ios":
        return <img src={textIcon} alt="Text Message" className="w-full h-full object-contain" />;
      case "email-ios":
        return <img src={mailIcon} alt="Email" className="w-full h-full object-contain" />;
      case "social-facebook":
        return <FaFacebookF className="w-full h-full" />;
      case "social-instagram":
        return <FaInstagram className="w-full h-full" />;
      case "social-twitter":
        return <FaXTwitter className="w-full h-full" />;
      case "social-linkedin":
        return <FaLinkedinIn className="w-full h-full" />;
      case "social-whatsapp":
        return <FaWhatsapp className="w-full h-full" />;
      case "social-share":
        return <BsShare className="w-full h-full" />;
      case "social-share-filled":
        return <BsShareFill className="w-full h-full" />;
      // Fallback for legacy or unknown icons
      default:
        if (iconId.includes('sms')) return <MessageSquare className="w-full h-full" />;
        if (iconId.includes('email')) return <Mail className="w-full h-full" />;
        return <Share2 className="w-full h-full" />;
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
        
        const minTouchSize = 44; // Apple's minimum touch target size in pixels
        const buttonWidth = Math.max(width, minTouchSize);
        const buttonHeight = Math.max(height, minTouchSize);
        
        console.log(`🎯 Hotspot ${hotspot.id} position:`, { 
          left, 
          top, 
          width: buttonWidth, 
          height: buttonHeight,
          imageDimensions
        });
        
        const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
          e.preventDefault();
          e.stopPropagation();
          console.log(`📱 Hotspot ${hotspot.type} clicked/touched`);
          getHotspotAction(hotspot.type)();
        };
        
        return (
          <button
            key={hotspot.id}
            onClick={handleInteraction}
            onTouchStart={handleInteraction}
            className="absolute pointer-events-auto bg-yellow-400/10 border-2 border-yellow-400 hover:bg-yellow-400/20 active:bg-yellow-400/30 transition-colors rounded-md flex items-center justify-center font-medium touch-manipulation cursor-pointer"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${buttonWidth}px`,
              height: `${buttonHeight}px`,
              WebkitTapHighlightColor: 'rgba(250, 204, 21, 0.2)',
              touchAction: 'manipulation',
            }}
          >
            <span className="text-yellow-400 flex items-center gap-2 w-full h-full">
              <span className="w-8 h-8 flex-shrink-0">
                {getHotspotIcon(hotspot.iconId)}
              </span>
              <span className="text-sm font-medium">{hotspot.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
