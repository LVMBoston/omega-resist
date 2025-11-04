import { MessageSquare, Mail, Share2, ExternalLink, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { mintShare } from "@/lib/virality/mint";
import { useSearchParams } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaWhatsapp } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { BsShare, BsShareFill } from "react-icons/bs";
import mailIcon from "@/assets/mail-icon.png";
import textIcon from "@/assets/text-icon.svg";
import playButton from "@/assets/play-button.png";
import { Hotspot } from "@/types/viralTemplates";
import Player from "@vimeo/player";

interface InteractiveSlideOverlayProps {
  hotspots: Hotspot[];
  deckSlug: string;
  imageRef: React.RefObject<HTMLImageElement>;
  viralToken: string | null;
}

const InteractiveSlideOverlay = ({
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
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const vimeoPlayerRef = useRef<Player | null>(null);

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
    try {
      console.log("🔗 SOCIAL SHARE INITIATED");
      console.log("Parent Token:", viralToken);
      
      if (!viralToken) {
        console.error("❌ ERROR: No viral token found in URL");
        toast({
          variant: "destructive",
          title: "Share Link Required",
          description: "This slide needs to be accessed via a viral share link to enable sharing.",
        });
        return;
      }

      // Mint new share token with social medium
      const result = await mintShare({ 
        parentToken: viralToken, 
        utmMedium: "social" as const
      });
      
      console.log("mintShare Response:", result);
      const { full_url } = result;
      
      if (navigator.share) {
        try {
          await navigator.share({
            title: "Check out this deck",
            text: "I thought you might be interested in this presentation",
            url: full_url,
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
        await navigator.clipboard.writeText(full_url);
        toast({
          title: "Link copied",
          description: "Share link copied to clipboard",
        });
      }
    } catch (error) {
      console.error("❌ Social share error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate share link",
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
      case "play-button":
        return iconWrapper(<img src={playButton} alt="Play Video" style={{ ...imgStyle, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />);
      // Fallback for legacy or unknown icons
      default:
        if (iconId.includes('sms')) return iconWrapper(<MessageSquare style={{ ...svgStyle, color: '#000000' }} />);
        if (iconId.includes('email')) return iconWrapper(<Mail style={{ ...svgStyle, color: '#000000' }} />);
        return iconWrapper(<Share2 style={{ ...svgStyle, color: '#000000' }} />);
    }
  };

  const isVimeoUrl = (url: string) => {
    return url.includes('vimeo.com');
  };

  const getVimeoEmbedUrl = (url: string) => {
    // Match multiple Vimeo URL formats:
    // - vimeo.com/{id}
    // - player.vimeo.com/video/{id}
    // - vimeo.com/channels/{channel}/{id}
    // - vimeo.com/{id}/{hash}
    const patterns = [
      /vimeo\.com\/(?:channels\/[\w-]+\/)?(\d+)(?:\/[\w-]+)?/,  // Main site with optional channel/hash
      /player\.vimeo\.com\/video\/(\d+)/,                        // Player embed URLs
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        const videoId = match[1];
        // Use Vimeo's embed player with enhanced parameters for proper display
        return `https://player.vimeo.com/video/${videoId}?autoplay=1&controls=1&playsinline=1&background=0&muted=0&loop=0&title=0&byline=0&portrait=0&badge=0&autopause=0&player_id=0`;
      }
    }
    return url; // Fallback to original URL if parsing fails
  };

  const handleExternalLink = (url: string) => {
    // Check if it's a Vimeo URL
    if (isVimeoUrl(url)) {
      setVideoUrl(url);
      setIsVideoOpen(true);
    } else {
      // For non-Vimeo URLs, open in new tab
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const closeVideo = () => {
    if (vimeoPlayerRef.current) {
      vimeoPlayerRef.current.destroy();
      vimeoPlayerRef.current = null;
    }
    // Clear the video container
    if (videoContainerRef.current) {
      videoContainerRef.current.innerHTML = '';
    }
    setIsVideoOpen(false);
    setVideoUrl(null);
  };

  // Initialize Vimeo player when video opens
  useEffect(() => {
    if (isVideoOpen && videoUrl && videoContainerRef.current) {
      // Calculate explicit dimensions first
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const maxWidth = 1280;
      const containerWidth = Math.min(viewportWidth * 0.9, maxWidth);
      const containerHeight = Math.min(containerWidth * (9/16), viewportHeight * 0.9);

      videoContainerRef.current.style.width = `${containerWidth}px`;
      videoContainerRef.current.style.height = `${containerHeight}px`;

      // Clear any existing content first
      videoContainerRef.current.innerHTML = '';
      
      const iframe = document.createElement('iframe');
      iframe.src = getVimeoEmbedUrl(videoUrl);
      iframe.allow = 'autoplay; fullscreen'; // Removed picture-in-picture
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.backgroundColor = '#000';
      iframe.style.display = 'block';
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('webkitallowfullscreen', '');
      iframe.setAttribute('mozallowfullscreen', '');
      
      videoContainerRef.current.appendChild(iframe);
      
      const player = new Player(iframe, {
        muted: true,
        autoplay: true,
        controls: true,
      });
      
      vimeoPlayerRef.current = player;
      
      // Close video when it ends
      player.on('ended', () => {
        closeVideo();
      });
      
      return () => {
        if (vimeoPlayerRef.current) {
          vimeoPlayerRef.current.destroy();
          vimeoPlayerRef.current = null;
        }
        // Clean up iframe
        if (videoContainerRef.current) {
          videoContainerRef.current.innerHTML = '';
        }
      };
    }
  }, [isVideoOpen, videoUrl]);

  // Handle Escape key to close video
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVideoOpen) {
        closeVideo();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isVideoOpen]);

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
    hotspots: hotspots.map(h => ({ 
      id: h.id, 
      type: h.type, 
      url: h.url,
      x: h.x, 
      y: h.y 
    }))
  });

  return (
    <>
      {/* Video Overlay - Full Screen - Rendered via Portal to document.body */}
      {isVideoOpen && videoUrl && createPortal(
        <div 
          className="fixed inset-0 bg-black z-[9999] flex items-center justify-center p-4"
          onClick={closeVideo}
        >
          {/* Close button */}
          <button
            onClick={closeVideo}
            className="absolute top-4 right-4 z-[10000] text-white bg-black/50 hover:bg-black/70 rounded-full p-3 transition-colors"
            aria-label="Close video"
          >
            <X size={24} />
          </button>

          {/* Video container with letterbox */}
          <div 
            ref={videoContainerRef}
            className="relative bg-black"
            style={{ 
              position: 'relative',
              width: '100vw',
              height: '100vh'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}

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
        
        // Check if this is a Vimeo link that should use the overlay
        console.log(`🔗 Checking external_link: type=${hotspot.type}, url=${hotspot.url}`);
        if (hotspot.type === 'external_link' && hotspot.url) {
          const isVimeo = isVimeoUrl(hotspot.url);
          console.log(`✅ External link detected: ${hotspot.url}, isVimeo: ${isVimeo}`);
          
          // If it's a Vimeo URL, intercept and use handleExternalLink for inline playback
          if (isVimeo) {
            // Use play-button icon for Vimeo videos instead of the iconId
            const videoIconId = 'play-button';
            return (
              <button
                key={hotspot.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log(`📱 Vimeo link intercepted for inline playback: ${hotspot.url}`);
                  handleExternalLink(hotspot.url);
                }}
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
                {getHotspotIcon(videoIconId, buttonWidth, buttonHeight)}
              </button>
            );
          }
          
          // For non-Vimeo external links, use anchor tag
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
    </>
  );
};

export { InteractiveSlideOverlay };
export default InteractiveSlideOverlay;
