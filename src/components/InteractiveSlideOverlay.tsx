import { MessageSquare, Mail, Share2, ExternalLink } from "lucide-react";
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
import { Hotspot } from "@/types/viralTemplates";

interface InteractiveSlideOverlayProps {
  hotspots: Hotspot[];
  deckSlug: string;
  imageRef: React.RefObject<HTMLImageElement>;
  viralToken: string | null;
}

export const InteractiveSlideOverlay = ({
  hotspots,
  deckSlug,
  imageRef,
  viralToken,
}: InteractiveSlideOverlayProps) => {
  const { toast } = useToast();
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
    console.log("🔧 InteractiveSlideOverlay effect running, imageRef:", !!imageRef.current);
    let retryCount = 0;
    const maxRetries = 50;
    let retryTimer: number | undefined;
    let resizeObserver: ResizeObserver | undefined;
    
    // Reset dimensions on mount
    setImageDimensions({ offsetX: 0, offsetY: 0, width: 0, height: 0 });
    
    const updateImageDimensions = () => {
      retryCount++;
      
      if (!imageRef.current) {
        console.log(`⚠️ No image ref available (attempt ${retryCount}/${maxRetries})`);
        if (retryCount < maxRetries) {
          retryTimer = window.setTimeout(updateImageDimensions, 100);
        } else {
          console.error("❌ Failed to get image ref after max retries");
        }
        return;
      }

      const img = imageRef.current;
      const imgRect = img.getBoundingClientRect();
      const parentRect = img.parentElement?.getBoundingClientRect();
      
      console.log(`📐 Image dimensions (attempt ${retryCount}):`, {
        imgWidth: imgRect.width,
        imgHeight: imgRect.height,
        imgLeft: imgRect.left,
        imgTop: imgRect.top,
        parentWidth: parentRect?.width,
        parentHeight: parentRect?.height,
        parentLeft: parentRect?.left,
        parentTop: parentRect?.top,
        device: navigator.userAgent.includes('iPhone') ? 'iPhone' : 
                navigator.userAgent.includes('iPad') ? 'iPad' : 'Other'
      });

      if (imgRect.width === 0 || imgRect.height === 0) {
        console.log(`⚠️ Image has zero dimensions (attempt ${retryCount}/${maxRetries}), retrying...`);
        if (retryCount < maxRetries) {
          retryTimer = window.setTimeout(updateImageDimensions, 100);
        } else {
          console.error("❌ Image dimensions never became available");
        }
        return;
      }
      
      // Calculate offset relative to parent container
      const offsetX = parentRect ? imgRect.left - parentRect.left : 0;
      const offsetY = parentRect ? imgRect.top - parentRect.top : 0;
      
      console.log("✅ Setting image dimensions from actual element:", {
        offsetX,
        offsetY,
        width: imgRect.width,
        height: imgRect.height
      });
      
      setImageDimensions({
        offsetX,
        offsetY,
        width: imgRect.width,
        height: imgRect.height,
      });
    };

    // Set up ResizeObserver to detect when image dimensions change
    if (imageRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        console.log("📏 ResizeObserver detected image change");
        updateImageDimensions();
      });
      resizeObserver.observe(imageRef.current);
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
  }, [imageRef]);

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
  const getHotspotIcon = (iconId: string, buttonWidth: number, buttonHeight: number) => {
    // Use fixed 40px size for reliable mobile rendering
    const iconSize = 40;
    
    // Wrapper div ensures consistent sizing across all icon types
    const iconWrapper = (icon: React.ReactNode) => (
      <div 
        style={{ 
          width: `${iconSize}px`, 
          height: `${iconSize}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
    );
    
    const imgStyle = {
      width: `${iconSize}px`,
      height: `${iconSize}px`,
      objectFit: 'contain' as const,
    };
    
    const svgStyle = {
      width: `${iconSize}px`,
      height: `${iconSize}px`,
    };
    
    switch (iconId) {
      case "sms-ios":
        return iconWrapper(<img src={textIcon} alt="Text Message" style={{ ...imgStyle, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />);
      case "email-ios":
        return iconWrapper(<img src={mailIcon} alt="Email" style={{ ...imgStyle, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />);
      case "social-facebook":
        return iconWrapper(<FaFacebookF style={{ ...svgStyle, color: '#000000', filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.8))' }} />);
      case "social-instagram":
        return iconWrapper(<FaInstagram style={{ ...svgStyle, color: '#000000', filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.8))' }} />);
      case "social-twitter":
        return iconWrapper(<FaXTwitter style={{ ...svgStyle, color: '#000000', filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.8))' }} />);
      case "social-linkedin":
        return iconWrapper(<FaLinkedinIn style={{ ...svgStyle, color: '#000000', filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.8))' }} />);
      case "social-whatsapp":
        return iconWrapper(<FaWhatsapp style={{ ...svgStyle, color: '#000000', filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.8))' }} />);
      case "social-share":
        return iconWrapper(<BsShare style={{ ...svgStyle, color: '#000000', filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.8))' }} />);
      case "social-share-filled":
        return iconWrapper(<BsShareFill style={{ ...svgStyle, color: '#000000', filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.8))' }} />);
      case "link-icon":
        return iconWrapper(<ExternalLink style={{ ...svgStyle, color: '#000000', filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.8))' }} />);
      // Fallback for legacy or unknown icons
      default:
        if (iconId.includes('sms')) return iconWrapper(<MessageSquare style={{ ...svgStyle, color: '#000000' }} />);
        if (iconId.includes('email')) return iconWrapper(<Mail style={{ ...svgStyle, color: '#000000' }} />);
        return iconWrapper(<Share2 style={{ ...svgStyle, color: '#000000' }} />);
    }
  };

  const handleExternalLink = (url: string) => {
    // Create a temporary anchor element to open the link
    // This works better on mobile than window.open
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getHotspotAction = (type: string, url?: string) => {
    switch (type) {
      case "sms":
        return handleSMS;
      case "email":
        return handleEmail;
      case "external_link":
        return () => {
          if (url) {
            handleExternalLink(url);
          }
        };
      case "social":
      case "form_trigger":
      case "custom":
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
    <div className="absolute inset-0 pointer-events-none z-50">
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
        
        // Use anchor tag for external links to avoid share sheet on mobile
        if (hotspot.type === 'external_link' && hotspot.url) {
          return (
            <a
              key={hotspot.id}
              href={hotspot.url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute pointer-events-auto transition-opacity hover:opacity-80 active:opacity-60 flex items-center justify-center touch-manipulation cursor-pointer"
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${buttonWidth}px`,
                height: `${buttonHeight}px`,
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                background: 'transparent',
                border: 'none',
                padding: 0,
                textDecoration: 'none',
              }}
              onClick={(e) => {
                e.stopPropagation();
                console.log(`📱 External link clicked: ${hotspot.url}`);
              }}
            >
              {getHotspotIcon(hotspot.iconId, buttonWidth, buttonHeight)}
            </a>
          );
        }
        
        // Use button for other hotspot types
        const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
          e.preventDefault();
          e.stopPropagation();
          console.log(`📱 Hotspot ${hotspot.type} clicked/touched`);
          getHotspotAction(hotspot.type, hotspot.url)();
        };
        
        return (
          <button
            key={hotspot.id}
            onClick={handleInteraction}
            onTouchStart={handleInteraction}
            className="absolute pointer-events-auto transition-opacity hover:opacity-80 active:opacity-60 flex items-center justify-center touch-manipulation cursor-pointer"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${buttonWidth}px`,
              height: `${buttonHeight}px`,
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              background: 'transparent',
              border: 'none',
              padding: 0,
            }}
          >
            {getHotspotIcon(hotspot.iconId, buttonWidth, buttonHeight)}
          </button>
        );
      })}
    </div>
  );
};
