import { MessageSquare, Mail, Share2, ExternalLink, X, Link2, MailPlus, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mintShare } from "@/lib/virality/mint";
import { useSearchParams } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaWhatsapp } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { BsShare, BsShareFill } from "react-icons/bs";
import mailIcon from "@/assets/mail-icon.png";
import externalLinkIcon from "@/assets/external-link-icon.png";
import textIcon from "@/assets/text-icon.svg";
import shareIcon from "@/assets/share-icon.png";
import emailLinksIcon from "@/assets/email-links-icon.png";
import playButton from "@/assets/play-button.png";
import { Hotspot } from "@/types/viralTemplates";
import Player from "@vimeo/player";

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

/** Renders a custom PNG icon with an onError fallback to a Lucide SVG icon.
 *  On iOS, skips the PNG entirely and renders the Lucide fallback immediately. */
const FallbackImg = ({ src, alt, style, fallback }: { 
  src: string; alt: string; style: React.CSSProperties; fallback: React.ReactNode;
}) => {
  const [failed, setFailed] = useState(isIOS);
  if (failed) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      style={style}
      onError={() => setFailed(true)}
    />
  );
};

interface InteractiveSlideOverlayProps {
  hotspots: Hotspot[];
  deckSlug: string;
  imageRef: React.RefObject<HTMLImageElement>;
  viralToken: string | null;
  mockMetricValue?: string; // For demo/testing - overrides metric lookup
  isActive?: boolean; // When false, close any playing video
}

const InteractiveSlideOverlay = ({
  hotspots,
  deckSlug,
  imageRef,
  viralToken,
  mockMetricValue,
  isActive = true,
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

  // EoA context for scoped template resolution
  const [eoaContext, setEoaContext] = useState<{ campaign_id: string; mobilize_code: string | null; city: string | null; state: string | null; site_name: string | null } | null>(null);

  // Fetch EoA context from viralToken, then resolve templates
  useEffect(() => {
    const fetchTemplates = async () => {
      let campaignId: string | null = null;
      let mobilizeCode: string | null = null;
      let city: string | null = null;
      let state: string | null = null;
      let siteName: string | null = null;

      // Try to derive campaign_id and mobilize_code from the token
      if (viralToken) {
        const { data: tokenData } = await supabase
          .from("tokens")
          .select("eoa_id")
          .eq("token", viralToken)
          .maybeSingle();

        if (tokenData?.eoa_id) {
          const { data: eoaData } = await supabase
            .from("events_actions")
            .select("campaign_id, mobilize_code, city, state, site_name")
            .eq("id", tokenData.eoa_id)
            .maybeSingle();

          if (eoaData) {
            campaignId = eoaData.campaign_id;
            mobilizeCode = eoaData.mobilize_code;
            city = eoaData.city;
            state = eoaData.state;
            siteName = eoaData.site_name;
            setEoaContext({ campaign_id: campaignId, mobilize_code: mobilizeCode, city, state, site_name: siteName });
          }
        }
      }

      // Use resolve_message_template RPC if we have campaign context
      if (campaignId) {
        const [emailRes, smsRes] = await Promise.all([
          supabase.rpc("resolve_message_template", { p_campaign_id: campaignId, p_mobilize_code: mobilizeCode, p_category: "email", p_key: "l01_template" }),
          supabase.rpc("resolve_message_template", { p_campaign_id: campaignId, p_mobilize_code: mobilizeCode, p_category: "sms", p_key: "l01_template" }),
        ]);
        if (emailRes.data) setEmailTemplate(emailRes.data as any);
        if (smsRes.data) setSmsTemplate(smsRes.data as any);
      } else {
        // Fallback to global settings (no token context)
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
      }
    };
    fetchTemplates();
  }, [viralToken]);

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
    window.addEventListener('orientationchange', () => {
      // iOS Safari delays layout recalculation after rotation
      setTimeout(updateImageDimensions, 200);
    });
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
      window.removeEventListener('orientationchange', updateImageDimensions);
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

      // Use template with placeholder substitution
      const substituteGeoPlaceholders = (text: string) => {
        return text
          .replace(/\{\{city\}\}/g, eoaContext?.city || "")
          .replace(/\{\{state\}\}/g, eoaContext?.state || "")
          .replace(/\{\{site_name\}\}/g, eoaContext?.site_name || "");
      };

      const message = smsTemplate?.body 
        ? substituteGeoPlaceholders(smsTemplate.body.replace("{{link}}", full_url))
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

      // Use template with placeholder substitution
      const substituteGeoPlaceholders = (text: string) => {
        return text
          .replace(/\{\{city\}\}/g, eoaContext?.city || "")
          .replace(/\{\{state\}\}/g, eoaContext?.state || "")
          .replace(/\{\{site_name\}\}/g, eoaContext?.site_name || "");
      };

      const subject = emailTemplate?.subject ? substituteGeoPlaceholders(emailTemplate.subject) : "Check out this presentation";
      const body = emailTemplate?.body 
        ? substituteGeoPlaceholders(emailTemplate.body.replace("{{link}}", full_url))
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
    
    const dropShadow = 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))';
    const imgWithShadow = { ...imgStyle, filter: dropShadow };

    switch (iconId) {
      case "sms-ios":
        return iconWrapper(<FallbackImg src={textIcon} alt="Text Message" style={imgWithShadow} fallback={<MessageSquare style={{ ...svgStyle, color: '#22c55e' }} />} />);
      case "email-ios":
        return iconWrapper(<FallbackImg src={mailIcon} alt="Email" style={imgWithShadow} fallback={<Mail style={{ ...svgStyle, color: '#22c55e' }} />} />);
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
        return iconWrapper(<FallbackImg src={shareIcon} alt="Share" style={imgWithShadow} fallback={<Share2 style={{ ...svgStyle, color: '#22c55e' }} />} />);
      case "social-share-filled":
        return iconWrapper(<BsShareFill style={{ ...svgStyle, color: '#000000', filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.8))' }} />);
      case "link-icon":
        return iconWrapper(<FallbackImg src={externalLinkIcon} alt="External Link" style={imgWithShadow} fallback={<Link2 style={{ ...svgStyle, color: '#eab308' }} />} />);
      case "play-button":
        return iconWrapper(<FallbackImg src={playButton} alt="Play Video" style={imgWithShadow} fallback={<Play style={{ ...svgStyle, color: '#22c55e' }} />} />);
      case "email-links":
        return iconWrapper(<FallbackImg src={emailLinksIcon} alt="Email Links" style={imgWithShadow} fallback={<MailPlus style={{ ...svgStyle, color: '#22c55e' }} />} />);
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
      // Clear any existing content first
      videoContainerRef.current.innerHTML = '';
      
      const iframe = document.createElement('iframe');
      iframe.src = getVimeoEmbedUrl(videoUrl);
      iframe.allow = 'autoplay; fullscreen; picture-in-picture';
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
        muted: false,
        autoplay: true,
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

  // Pause/resume video when slide becomes inactive/active (prop-based)
  useEffect(() => {
    if (!isVideoOpen || !vimeoPlayerRef.current) return;
    if (!isActive) {
      vimeoPlayerRef.current.pause().catch(() => {});
    } else {
      vimeoPlayerRef.current.play().catch(() => {});
    }
  }, [isActive]);

  // Also pause/resume when overlay scrolls out of view (carousel swipe) via IntersectionObserver
  useEffect(() => {
    if (!isVideoOpen || !imageRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!vimeoPlayerRef.current) return;
        if (!entry.isIntersecting) {
          vimeoPlayerRef.current.pause().catch(() => {});
        } else {
          vimeoPlayerRef.current.play().catch(() => {});
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(imageRef.current);
    return () => observer.disconnect();
  }, [isVideoOpen]);

  const handleEmailLinks = (hotspot: Hotspot) => {
    // Collect all external_link siblings with non-empty URLs
    const externalLinks = hotspots.filter(h => h.type === 'external_link' && h.url && h.url.trim().length > 0);

    if (externalLinks.length === 0) {
      toast({
        variant: "destructive",
        title: "No links found",
        description: "There are no external link hotspots on this slide to bundle.",
      });
      return;
    }

    // Build numbered list body
    const lines = externalLinks.map((link, i) => {
      const num = i + 1;
      return link.label && link.label.trim().length > 0
        ? `${num}. ${link.label}: ${link.url}`
        : `${num}. ${link.url}`;
    });
    const body = lines.join('\n');
    const subject = hotspot.emailLinksSubject || 'Here are the links you requested…';

    const mailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailUrl;

    // Post-action nudge toast (6s)
    setTimeout(() => {
      toast({
        title: "Don't forget to share this with people you trust!",
        duration: 6000,
      });
    }, 500);
  };

  const getHotspotAction = (type: string, hotspot?: Hotspot) => {
    switch (type) {
      case "sms":
        return handleSMS;
      case "email":
        return handleEmail;
      case "external_link":
        return () => {
          if (hotspot?.url) {
            handleExternalLink(hotspot.url);
          }
        };
      case "vimeo":
        return () => {
          if (hotspot?.url) {
            // Always use inline Vimeo player for vimeo hotspot type
            setVideoUrl(hotspot.url);
            setIsVideoOpen(true);
          }
        };
      case "email_links":
        return () => {
          if (hotspot) {
            handleEmailLinks(hotspot);
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
      {/* Video Overlay - Full Screen */}
      {isVideoOpen && videoUrl && (
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
            className="relative bg-black mx-auto"
            style={{ 
              position: 'relative',
              width: 'min(90vw, 1280px)',
              height: 'min(calc(90vw * 9/16), calc(90vh), calc(1280px * 9/16))',
              maxWidth: '1280px',
              maxHeight: '90vh'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
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

        // Handle live_number hotspot type
        if (hotspot.type === 'live_number') {
          // Use mockMetricValue if provided (for demo), otherwise use hardcoded metrics
          const defaultMetrics: Record<string, number | string> = {
            seeds: 142,
            shares: 387,
            opens: 1249,
            opens_us: 1102,
            opens_intl: 147,
            neighborhoods: 89,
            depth: 3,
            l01_count: 234,
            l02_count: 98,
            l03_count: 55,
            viral_coefficient: '2.7',
          };
          
          const metricValue = mockMetricValue !== undefined 
            ? mockMetricValue 
            : (hotspot.metricKey ? defaultMetrics[hotspot.metricKey] : '—');
          const style = hotspot.liveNumberStyle || {};
          
          return (
            <div
              key={hotspot.id}
              className="absolute flex items-center justify-center"
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
                fontSize: style.fontSize || '48px',
                fontWeight: style.fontWeight || '700',
                color: style.color || '#1a1a1a',
                backgroundColor: style.backgroundColor || 'transparent',
                textAlign: style.textAlign || 'center',
                fontFamily: style.fontFamily || 'system-ui, -apple-system, sans-serif',
                padding: style.padding || '0',
                borderRadius: style.borderRadius || '0',
                pointerEvents: 'none',
              }}
            >
              {metricValue}
            </div>
          );
        }
        
        // Handle vimeo hotspot type — always use inline player
        if (hotspot.type === 'vimeo' && hotspot.url) {
          return (
            <button
              key={hotspot.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`📱 Vimeo hotspot tapped for inline playback: ${hotspot.url}`);
                setVideoUrl(hotspot.url!);
                setIsVideoOpen(true);
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
              {getHotspotIcon(hotspot.iconId, buttonWidth, buttonHeight)}
            </button>
          );
        }

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
        // Guard against double-fire from touchStart + click on mobile
        let touchFired = false;
        const handleTouchStart = (e: React.TouchEvent) => {
          e.preventDefault();
          e.stopPropagation();
          touchFired = true;
          console.log(`📱 Hotspot ${hotspot.type} touched`);
          getHotspotAction(hotspot.type, hotspot)();
        };
        const handleClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (touchFired) {
            touchFired = false;
            return; // Already handled by touchStart
          }
          console.log(`📱 Hotspot ${hotspot.type} clicked`);
          getHotspotAction(hotspot.type, hotspot)();
        };
        
        return (
          <button
            key={hotspot.id}
            onClick={handleClick}
            onTouchStart={handleTouchStart}
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
            {hotspot.type === 'email_links' && hotspot.emailLinksShowLabels && hotspot.label && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '-20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#fff',
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {hotspot.label}
              </span>
            )}
          </button>
        );
      })}
      </div>
    </>
  );
};

export { InteractiveSlideOverlay };
export default InteractiveSlideOverlay;
