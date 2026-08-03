import { MessageSquare, Mail, Share2, ExternalLink, X, Link2, MailPlus, Play, Pause, Volume2, VolumeX, Refrigerator } from "lucide-react";
import { detectVideoProvider } from "@/lib/oEmbedValidation";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mintShare } from "@/lib/virality/mint";
import { useSearchParams } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaWhatsapp } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { BsShare, BsShareFill } from "react-icons/bs";
import { createPortal } from "react-dom";
import mailIcon from "@/assets/mail-icon.png";
import externalLinkIcon from "@/assets/external-link-icon.svg";
import textIcon from "@/assets/text-icon.svg";
import shareIcon from "@/assets/share-icon.png";
import emailLinksIcon from "@/assets/email-links-icon.svg";
import playButton from "@/assets/play-button.png";
import { MapLegend } from "@/components/MapLegend";
import { Hotspot } from "@/types/viralTemplates";
import { composeRefrigSheetPng, triggerPngDownload } from "@/lib/refrigSheet";
import { buildSmsComposerUrl, openComposer, prepareComposerLaunch } from "@/lib/openComposer";
import { ToastAction } from "@/components/ui/toast";

/** Renders a custom icon with an onError fallback to a Lucide SVG icon.
 *  Tries the real asset on all platforms; only swaps to the Lucide fallback
 *  if the image actually fails to load. */
const FallbackImg = ({ src, alt, style, fallback }: {
  src: string; alt: string; style: React.CSSProperties; fallback: React.ReactNode;
}) => {
  const [failed, setFailed] = useState(false);
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
  const [templatesReady, setTemplatesReady] = useState(false);
  /** Pre-minted composer URLs so a tap can hand off synchronously (iOS/Safari safe). */
  const [composerHrefs, setComposerHrefs] = useState<{ sms?: string; email?: string }>({});
  const premintedRef = useRef<{ sms?: boolean; email?: boolean }>({});
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoProvider, setVideoProvider] = useState<"vimeo" | "youtube" | null>(null);
  const [vimeoPlayerState, setVimeoPlayerState] = useState<"idle" | "playing-muted" | "playing-unmuted" | "paused">("idle");
  const [vimeoFeedbackIcon, setVimeoFeedbackIcon] = useState<React.ReactNode | null>(null);
  const vimeoWasUnmutedRef = useRef(false);
  const vimeoPlayerStateRef = useRef(vimeoPlayerState);
  const vimeoFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const vimeoPlayerRef = useRef<HTMLIFrameElement | null>(null);
  const ytPlayerRef = useRef<any>(null);

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
      let tokenLevel: number | null = null;

      // Try to derive campaign_id, mobilize_code, and viewer level from the token
      if (viralToken) {
        const { data: tokenData } = await supabase
          .from("tokens")
          .select("eoa_id, level")
          .eq("token", viralToken)
          .maybeSingle();

        if (tokenData) {
          tokenLevel = tokenData.level ?? null;
        }

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

      // Viewer is on the organizer's own seed (L00) → use L00 template (organizer-voiced).
      // Viewer is on any forwarded link (L01+) → use L01 template (friend-voiced).
      const templateKey = tokenLevel === 0 ? "l00_template" : "l01_template";
      console.log("📨 Resolving share templates", { viralToken, tokenLevel, templateKey });

      // Use resolve_message_template RPC if we have campaign context
      if (campaignId) {
        const [emailRes, smsRes] = await Promise.all([
          supabase.rpc("resolve_message_template", { p_campaign_id: campaignId, p_mobilize_code: mobilizeCode, p_category: "email", p_key: templateKey }),
          supabase.rpc("resolve_message_template", { p_campaign_id: campaignId, p_mobilize_code: mobilizeCode, p_category: "sms", p_key: templateKey }),
        ]);
        if (emailRes.data) setEmailTemplate(emailRes.data as any);
        if (smsRes.data) setSmsTemplate(smsRes.data as any);
      } else {
        // Fallback to global settings (no token context)
        const { data: emailData } = await supabase
          .from("settings")
          .select("value")
          .eq("category", "email")
          .eq("key", templateKey)
          .maybeSingle();
        const { data: smsData } = await supabase
          .from("settings")
          .select("value")
          .eq("category", "sms")
          .eq("key", templateKey)
          .maybeSingle();
        if (emailData) setEmailTemplate(emailData.value as any);
        if (smsData) setSmsTemplate(smsData.value as any);
      }
      setTemplatesReady(true);
    };
    fetchTemplates();
  }, [viralToken]);

  /**
   * Mint the share child token for a medium on the *first intent gesture*
   * (pointer-down / hover on the share hotspot), never on mount. Minting on
   * mount inflated chain-share metrics with tokens nobody ever sent.
   * Once minted, the hotspot renders as a real <a href>, which is the only
   * handoff iOS Safari reliably honors. If the tap lands before the mint
   * resolves, the existing on-tap async path handles it.
   */
  const premintComposer = useCallback(async (medium: 'sms' | 'email') => {
    if (!viralToken || !templatesReady) return;
    if (premintedRef.current[medium]) return;
    premintedRef.current[medium] = true;

    const subGeo = (text: string) => text
      .replace(/\{\{city\}\}/g, eoaContext?.city || "")
      .replace(/\{\{state\}\}/g, eoaContext?.state || "")
      .replace(/\{\{site_name\}\}/g, eoaContext?.site_name || "");

    try {
      if (medium === 'sms') {
        const r = await mintShare({ parentToken: viralToken, utmMedium: "sms" });
        const message = smsTemplate?.body
          ? subGeo(smsTemplate.body.replace("{{link}}", r.full_url))
          : `Check out this deck: ${r.full_url}`;
        setComposerHrefs(prev => ({ ...prev, sms: buildSmsComposerUrl(message) }));
      } else {
        const r = await mintShare({ parentToken: viralToken, utmMedium: "em" });
        const subject = emailTemplate?.subject ? subGeo(emailTemplate.subject) : "Check out this presentation";
        const body = emailTemplate?.body
          ? subGeo(emailTemplate.body.replace("{{link}}", r.full_url))
          : `I thought you might be interested in this: ${r.full_url}`;
        setComposerHrefs(prev => ({
          ...prev,
          email: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
        }));
      }
    } catch (e) {
      premintedRef.current[medium] = false;
      console.error(`Pre-mint (${medium}) failed, falling back to on-tap mint:`, e);
    }
  }, [viralToken, templatesReady, smsTemplate, emailTemplate, eoaContext]);




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
    const composerLaunch = prepareComposerLaunch();
    try {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📱 SMS SHARE INITIATED");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("1️⃣ Parent Token from URL:", viralToken);
      console.log("2️⃣ SMS Template:", JSON.stringify(smsTemplate, null, 2));
      
      if (!viralToken) {
        composerLaunch.cancel();
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
        encodedSmsUrl: buildSmsComposerUrl(message)
      };
      
      console.log("5️⃣ Final SMS Payload:", JSON.stringify(finalPayload, null, 2));
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");


      const smsUrl = buildSmsComposerUrl(message);
      const opened = composerLaunch.open(smsUrl);

      toast({
        title: opened ? "Opening SMS" : "Couldn't open your messages app",
        description: opened
          ? "Share this deck via text message"
          : "Tap the link below to open it manually.",
        duration: opened ? 4000 : Infinity,
        action: (
          <ToastAction altText="Open messages" asChild>
            <a href={smsUrl}>Open</a>
          </ToastAction>
        ),
      });

    } catch (error) {
      composerLaunch.cancel();
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
    const composerLaunch = prepareComposerLaunch();
    try {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📧 EMAIL SHARE INITIATED");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("1️⃣ Parent Token from URL:", viralToken);
      console.log("2️⃣ Email Template:", JSON.stringify(emailTemplate, null, 2));
      
      if (!viralToken) {
        composerLaunch.cancel();
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
      const opened = composerLaunch.open(mailUrl);

      toast({
        title: opened ? "Opening Email" : "Couldn't open your email app",
        description: opened
          ? "Share this deck via email"
          : "Tap the link below to open it manually.",
        duration: opened ? 4000 : Infinity,
        action: (
          <ToastAction altText="Open email" asChild>
            <a href={mailUrl}>Open</a>
          </ToastAction>
        ),
      });

    } catch (error) {
      composerLaunch.cancel();
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

  const handleRefrig = async () => {
    try {
      console.log("🧊 REFRIG SHARE INITIATED. Parent token:", viralToken);
      if (!viralToken) {
        toast({
          variant: "destructive",
          title: "Share Link Required",
          description: "Open this deck via a viral share link first.",
        });
        return;
      }

      // Mint three child tokens — one per QR on the sheet. Each is tracked
      // as its own lineage row so scans/shares from the fridge sheet can
      // be attributed to their medium.
      const [storyMint, smsMint, emailMint, printMint] = await Promise.all([
        mintShare({ parentToken: viralToken, utmMedium: "refrig" }),
        mintShare({ parentToken: viralToken, utmMedium: "sms" }),
        mintShare({ parentToken: viralToken, utmMedium: "em" }),
        mintShare({ parentToken: viralToken, utmMedium: "print" }),
      ]);

      const origin = window.location.origin;
      const storyUrl = `${origin}/fs/${storyMint.token}`;
      const textUrl  = `${origin}/fx/${smsMint.token}?a=sms`;
      const emailUrl = `${origin}/fx/${emailMint.token}?a=em`;
      const printUrl = `${origin}/fp/${printMint.token}`;

      // Resolve campaign title (best-effort; falls back to deck slug).
      let campaignTitle = deckSlug;
      try {
        const { data: tokenRow } = await supabase
          .from("tokens")
          .select("utm_campaign")
          .eq("token", storyMint.token)
          .maybeSingle();
        if (tokenRow?.utm_campaign) {
          const { data: campaign } = await supabase
            .from("campaigns")
            .select("title")
            .eq("code", tokenRow.utm_campaign)
            .maybeSingle();
          if (campaign?.title) campaignTitle = campaign.title;
        }
      } catch (e) {
        console.warn("[REFRIG] campaign lookup failed, using deck slug:", e);
      }

      toast({ title: "Preparing your printable sheet…" });

      const blob = await composeRefrigSheetPng({
        campaignTitle,
        qrs: [
          { url: storyUrl, label: "Display Status" },
          { url: textUrl,  label: "Text Deck" },
          { url: emailUrl, label: "Email Deck" },
        ],
        printQr: { url: printUrl, label: "Print Sheet" },
      });
      triggerPngDownload(blob, "fridge-sheet.png");

      // Log the generation event (best-effort, non-blocking)
      void supabase.rpc("log_event", {
        _token: storyMint.token,
        _event_type: "refrig_generated",
      });

      toast({
        title: "Downloaded fridge-sheet.png",
        description: "Print it and tape it to your refrigerator.",
      });
    } catch (error) {
      console.error("❌ REFRIG error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not generate the printable sheet.",
      });
    }
  };

  const getHotspotIcon = (iconId: string, buttonWidth: number, buttonHeight: number) => {
    // Fill the entire hotspot area, matching the editor's w-full h-full object-contain
    const imgStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
    };

    const svgStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
    };

    switch (iconId) {
      case "sms-ios":
        return <FallbackImg src={textIcon} alt="Text Message" style={imgStyle} fallback={<MessageSquare style={{ ...svgStyle, color: '#22c55e' }} />} />;
      case "email-ios":
        return <FallbackImg src={mailIcon} alt="Email" style={imgStyle} fallback={<Mail style={{ ...svgStyle, color: '#22c55e' }} />} />;
      case "social-facebook":
        return <FaFacebookF style={{ ...svgStyle, color: '#000000', filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.8))' }} />;
      case "social-instagram":
        return <FaInstagram style={{ ...svgStyle, color: '#000000', filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.8))' }} />;
      case "social-twitter":
        return <FaXTwitter style={{ ...svgStyle, color: '#000000', filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.8))' }} />;
      case "social-linkedin":
        return <FaLinkedinIn style={{ ...svgStyle, color: '#000000', filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.8))' }} />;
      case "social-whatsapp":
        return <FaWhatsapp style={{ ...svgStyle, color: '#000000', filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.8))' }} />;
      case "social-share":
        return <FallbackImg src={shareIcon} alt="Share" style={imgStyle} fallback={<Share2 style={{ ...svgStyle, color: '#22c55e' }} />} />;
      case "social-share-filled":
        return <BsShareFill style={{ ...svgStyle, color: '#000000', filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.8))' }} />;
      case "link-icon":
        return <FallbackImg src={externalLinkIcon} alt="External Link" style={imgStyle} fallback={<Link2 style={{ ...svgStyle, color: '#eab308' }} />} />;
      case "video":
      case "play-button":
      case "vimeo-video":
      case "youtube-video":
        return <FallbackImg src={playButton} alt="Play Video" style={imgStyle} fallback={<Play style={{ ...svgStyle, color: '#22c55e' }} />} />;
      case "email-links":
        return <FallbackImg src={emailLinksIcon} alt="Email Links" style={imgStyle} fallback={<MailPlus style={{ ...svgStyle, color: '#22c55e' }} />} />;
      case "email-support":
        return <FallbackImg src={mailIcon} alt="Support Email" style={imgStyle} fallback={<Mail style={{ ...svgStyle, color: '#22c55e' }} />} />;
      case "refrig-fridge":
        return <Refrigerator style={{ ...svgStyle, color: '#000000' }} />;
      // Fallback for legacy or unknown icons
      default:
        if (iconId.includes('sms')) return <MessageSquare style={{ ...svgStyle, color: '#000000' }} />;
        if (iconId.includes('email')) return <Mail style={{ ...svgStyle, color: '#000000' }} />;
        return <Share2 style={{ ...svgStyle, color: '#000000' }} />;
    }
  };

  const isVimeoUrl = (url: string) => url.includes('vimeo.com');
  const isYouTubeUrl = (url: string) => url.includes('youtube.com') || url.includes('youtu.be');

  const getVimeoEmbedUrl = (url: string) => {
    const patterns = [
      /vimeo\.com\/(?:channels\/[\w-]+\/)?(\d+)(?:\/[\w-]+)?/,
      /player\.vimeo\.com\/video\/(\d+)/,
    ];
    // Preserve privacy hash (h=...) required for unlisted videos
    const hashMatch = url.match(/[?&]h=([\w-]+)/);
    const hashParam = hashMatch ? `h=${hashMatch[1]}&` : "";
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return `https://player.vimeo.com/video/${match[1]}?${hashParam}autoplay=1&muted=1&controls=1&playsinline=1&title=0&byline=0&portrait=0&badge=0&autopause=0&api=1`;
      }
    }
    return url;
  };

  const getYouTubeVideoId = (url: string): string | null => {
    const patterns = [
      /youtube\.com\/embed\/([^?&/]+)/,
      /youtube\.com\/watch\?v=([^&]+)/,
      /youtu\.be\/([^?&/]+)/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m?.[1]) return m[1];
    }
    return null;
  };

  // Vimeo postMessage helper
  const vimeoPost = (method: string, value?: any) => {
    const iframe = vimeoPlayerRef.current;
    if (!iframe?.contentWindow) return;
    const msg: any = { method };
    if (value !== undefined) msg.value = value;
    iframe.contentWindow.postMessage(JSON.stringify(msg), '*');
  };

  const handleExternalLink = (url: string) => {
    if (isVimeoUrl(url)) {
      setVideoUrl(url);
      setVideoProvider("vimeo");
      setIsVideoOpen(true);
    } else if (isYouTubeUrl(url)) {
      setVideoUrl(url);
      setVideoProvider("youtube");
      setIsVideoOpen(true);
    } else {
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

  const showVimeoFeedback = useCallback((icon: React.ReactNode) => {
    if (vimeoFeedbackTimerRef.current) clearTimeout(vimeoFeedbackTimerRef.current);
    setVimeoFeedbackIcon(icon);
    vimeoFeedbackTimerRef.current = setTimeout(() => setVimeoFeedbackIcon(null), 1500);
  }, []);

  const closeVideo = () => {
    if (vimeoPlayerRef.current) vimeoPlayerRef.current = null;
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.destroy(); } catch {}
      ytPlayerRef.current = null;
    }
    if (videoContainerRef.current) videoContainerRef.current.innerHTML = '';
    vimeoWasUnmutedRef.current = false;
    setVimeoPlayerState("idle");
    setVideoProvider(null);
    setIsVideoOpen(false);
    setVideoUrl(null);
  };

  // Initialize video player when video opens (muted autoplay)
  useEffect(() => {
    if (!isVideoOpen || !videoUrl || !videoContainerRef.current || !videoProvider) return;
    videoContainerRef.current.innerHTML = '';

    if (videoProvider === "vimeo") {
      const iframe = document.createElement('iframe');
      iframe.src = getVimeoEmbedUrl(videoUrl);
      iframe.allow = 'autoplay; fullscreen; picture-in-picture';
      iframe.style.cssText = 'width:100%;height:100%;border:none;background:#000;display:block';
      iframe.setAttribute('allowfullscreen', '');
      videoContainerRef.current.appendChild(iframe);
      vimeoPlayerRef.current = iframe;

      const handleVimeoMessage = (e: MessageEvent) => {
        if (!e.origin.includes('vimeo.com')) return;
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (data.event === 'ready') {
            iframe.contentWindow?.postMessage(JSON.stringify({ method: 'addEventListener', value: 'finish' }), '*');
            iframe.contentWindow?.postMessage(JSON.stringify({ method: 'setMuted', value: true }), '*');
            iframe.contentWindow?.postMessage(JSON.stringify({ method: 'setVolume', value: 0 }), '*');
            iframe.contentWindow?.postMessage(JSON.stringify({ method: 'play' }), '*');
            setVimeoPlayerState("playing-muted");
          }
          if (data.event === 'finish') closeVideo();
        } catch {}
      };
      window.addEventListener('message', handleVimeoMessage);

      return () => {
        window.removeEventListener('message', handleVimeoMessage);
        vimeoPlayerRef.current = null;
        if (videoContainerRef.current) videoContainerRef.current.innerHTML = '';
      };
    }

    if (videoProvider === "youtube") {
      if (!document.getElementById('yt-iframe-api')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }

      const initYT = () => {
        const videoId = getYouTubeVideoId(videoUrl!);
        if (!videoId || !videoContainerRef.current) return;
        const div = document.createElement('div');
        div.id = 'yt-player-target';
        videoContainerRef.current!.innerHTML = '';
        videoContainerRef.current!.appendChild(div);

        ytPlayerRef.current = new (window as any).YT.Player('yt-player-target', {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 1, controls: 0, modestbranding: 1, playsinline: 1, rel: 0, mute: 1 },
          events: {
            onReady: (e: any) => {
              e.target.playVideo();
              setVimeoPlayerState("playing-muted");
              const ytIframe = videoContainerRef.current?.querySelector('iframe');
              if (ytIframe) (ytIframe as HTMLElement).style.pointerEvents = 'none';
            },
            onStateChange: (e: any) => {
              if (e.data === (window as any).YT.PlayerState.ENDED) closeVideo();
            },
          },
        });
      };

      if ((window as any).YT?.Player) initYT();
      else (window as any).onYouTubeIframeAPIReady = initYT;

      return () => {
        if (ytPlayerRef.current) {
          try { ytPlayerRef.current.destroy(); } catch {}
          ytPlayerRef.current = null;
        }
        if (videoContainerRef.current) videoContainerRef.current.innerHTML = '';
      };
    }
  }, [isVideoOpen, videoUrl, videoProvider]);

  // Handle Escape key to close video
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVideoOpen) closeVideo();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isVideoOpen]);

  // Pause/resume video on isActive change
  useEffect(() => {
    if (!isVideoOpen) return;
    if (!isActive) {
      if (vimeoPlayerState === "playing-muted" || vimeoPlayerState === "playing-unmuted") {
        vimeoWasUnmutedRef.current = vimeoPlayerState === "playing-unmuted";
        if (videoProvider === "vimeo") {
          vimeoPost('pause');
          vimeoPost('setMuted', true);
          vimeoPost('setVolume', 0);
        } else if (videoProvider === "youtube" && ytPlayerRef.current) {
          ytPlayerRef.current.pauseVideo();
          ytPlayerRef.current.mute();
        }
        setVimeoPlayerState("paused");
      }
    } else {
      if (vimeoPlayerState === "paused") {
        if (videoProvider === "vimeo") {
          vimeoPost('play');
          if (vimeoWasUnmutedRef.current) {
            vimeoPost('setMuted', false);
            vimeoPost('setVolume', 1);
            setVimeoPlayerState("playing-unmuted");
          } else {
            setVimeoPlayerState("playing-muted");
          }
        } else if (videoProvider === "youtube" && ytPlayerRef.current) {
          ytPlayerRef.current.playVideo();
          if (vimeoWasUnmutedRef.current) {
            ytPlayerRef.current.unMute();
            ytPlayerRef.current.setVolume(100);
            setVimeoPlayerState("playing-unmuted");
          } else {
            setVimeoPlayerState("playing-muted");
          }
        }
      }
    }
  }, [isActive]);

  // Keep ref in sync
  useEffect(() => {
    vimeoPlayerStateRef.current = vimeoPlayerState;
  }, [vimeoPlayerState]);

  // IntersectionObserver pause/resume
  useEffect(() => {
    if (!isVideoOpen || !imageRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const currentState = vimeoPlayerStateRef.current;
        if (!entry.isIntersecting) {
          vimeoWasUnmutedRef.current = currentState === "playing-unmuted";
          if (videoProvider === "vimeo") {
            vimeoPost('pause');
            vimeoPost('setMuted', true);
            vimeoPost('setVolume', 0);
          } else if (videoProvider === "youtube" && ytPlayerRef.current) {
            ytPlayerRef.current.pauseVideo();
            ytPlayerRef.current.mute();
          }
          setVimeoPlayerState("paused");
        } else if (currentState === "paused") {
          if (videoProvider === "vimeo") {
            vimeoPost('play');
            if (vimeoWasUnmutedRef.current) {
              vimeoPost('setMuted', false);
              vimeoPost('setVolume', 1);
              setVimeoPlayerState("playing-unmuted");
            } else {
              setVimeoPlayerState("playing-muted");
            }
          } else if (videoProvider === "youtube" && ytPlayerRef.current) {
            ytPlayerRef.current.playVideo();
            if (vimeoWasUnmutedRef.current) {
              ytPlayerRef.current.unMute();
              ytPlayerRef.current.setVolume(100);
              setVimeoPlayerState("playing-unmuted");
            } else {
              setVimeoPlayerState("playing-muted");
            }
          }
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(imageRef.current);
    return () => observer.disconnect();
  }, [isVideoOpen, videoProvider]);

  const handleVimeoCenterTap = useCallback(() => {
    console.log("[VideoCenterTap] provider:", videoProvider, "state:", vimeoPlayerState);

    if (videoProvider === "vimeo") {
      switch (vimeoPlayerState) {
        case "playing-muted":
          console.log("[VimeoCenterTap] unmuting");
          vimeoPost('setMuted', false);
          vimeoPost('setVolume', 1);
          setVimeoPlayerState("playing-unmuted");
          showVimeoFeedback(<Volume2 className="h-12 w-12 text-white" />);
          break;
        case "playing-unmuted":
          console.log("[VimeoCenterTap] pausing");
          vimeoPost('pause');
          setVimeoPlayerState("paused");
          showVimeoFeedback(<Pause className="h-12 w-12 text-white" />);
          break;
        case "paused":
          console.log("[VimeoCenterTap] resuming unmuted");
          vimeoPost('play');
          vimeoPost('setMuted', false);
          vimeoPost('setVolume', 1);
          setVimeoPlayerState("playing-unmuted");
          showVimeoFeedback(<Play className="h-12 w-12 text-white" />);
          break;
      }
    } else if (videoProvider === "youtube" && ytPlayerRef.current) {
      const player = ytPlayerRef.current;
      switch (vimeoPlayerState) {
        case "playing-muted":
          player.unMute();
          player.setVolume(100);
          setVimeoPlayerState("playing-unmuted");
          showVimeoFeedback(<Volume2 className="h-12 w-12 text-white" />);
          break;
        case "playing-unmuted":
          player.pauseVideo();
          setVimeoPlayerState("paused");
          showVimeoFeedback(<Pause className="h-12 w-12 text-white" />);
          break;
        case "paused":
          player.playVideo();
          player.unMute();
          player.setVolume(100);
          setVimeoPlayerState("playing-unmuted");
          showVimeoFeedback(<Play className="h-12 w-12 text-white" />);
          break;
      }
    }
  }, [vimeoPlayerState, videoProvider, showVimeoFeedback]);

  const handleEmailLinks = (hotspot: Hotspot) => {
    const externalLinks = hotspots.filter(h => h.type === 'external_link' && h.url && h.url.trim().length > 0);
    if (externalLinks.length === 0) {
      toast({ variant: "destructive", title: "No links found", description: "There are no external link hotspots on this slide to bundle." });
      return;
    }
    const lines = externalLinks.map((link, i) => {
      const num = i + 1;
      return link.label && link.label.trim().length > 0
        ? `${num}. ${link.label}: ${link.url}`
        : `${num}. ${link.url}`;
    });
    const body = lines.join('\n');
    const subject = hotspot.emailLinksSubject || 'Here are the links you requested…';
    const linksMailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const linksOpened = openComposer(linksMailUrl);
    if (!linksOpened) {
      toast({
        title: "Couldn't open your email app",
        description: "Tap the link below to open it manually.",
        duration: Infinity,
        action: (
          <ToastAction altText="Open email" asChild>
            <a href={linksMailUrl}>Open</a>
          </ToastAction>
        ),
      });
      return;
    }
    setTimeout(() => {
      toast({ title: "Don't forget to share this with people you trust!", duration: 6000 });
    }, 500);

  };

  const getHotspotAction = (type: string, hotspot?: Hotspot) => {
    switch (type) {
      case "sms":
        return handleSMS;
      case "email":
        return handleEmail;
      case "external_link":
        return () => { if (hotspot?.url) handleExternalLink(hotspot.url); };
      case "video":
      case "vimeo":   // legacy fallthrough
      case "youtube": // legacy fallthrough
        return () => {
          if (hotspot?.url) {
            const provider = detectVideoProvider(hotspot.url);
            if (provider) {
              setVideoUrl(hotspot.url);
              setVideoProvider(provider);
              setIsVideoOpen(true);
            }
          }
        };
      case "email_links":
        return () => { if (hotspot) handleEmailLinks(hotspot); };
      case "email_support":
        return () => {
          const addr = (hotspot?.supportEmail || "").trim();
          if (!addr) {
            toast({ variant: "destructive", title: "No support address set", description: "This support button has no email address configured." });
            return;
          }
          const subject = (hotspot?.supportSubject || hotspot?.label || "Support request").trim();
          const supportUrl = `mailto:${addr}?subject=${encodeURIComponent(subject)}`;
          if (!openComposer(supportUrl)) {
            toast({
              title: "Couldn't open your email app",
              description: "Tap the link below to open it manually.",
              duration: Infinity,
              action: (
                <ToastAction altText="Open email" asChild>
                  <a href={supportUrl}>Open</a>
                </ToastAction>
              ),
            });
          }
        };
      case "refrig":
        return handleRefrig;
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

  const videoOverlay =
    isVideoOpen && videoUrl && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black"
            style={{ width: "100vw", height: "100dvh" }}
          >
            <button
              onClick={closeVideo}
              className="absolute top-4 right-4 z-[10001] text-white bg-black/50 hover:bg-black/70 rounded-full p-3 transition-colors"
              aria-label="Close video"
            >
              <X size={24} />
            </button>

            {/* Full-frame tap/swipe zone (excludes bottom 15% so the native
                player's control bar and fullscreen button remain reachable).
                - Tap anywhere → pause/resume/unmute toggle.
                - Horizontal swipe → close the video overlay. */}
            <div
              className="absolute top-0 left-0 right-0 bottom-[15%] z-[10000] cursor-pointer"
              onClick={(e) => {
                if ((e.currentTarget as any)._swiped) {
                  (e.currentTarget as any)._swiped = false;
                  return;
                }
                handleVimeoCenterTap();
              }}
              onTouchStart={(e) => {
                const t = e.touches[0];
                (e.currentTarget as any)._tx = t.clientX;
                (e.currentTarget as any)._ty = t.clientY;
              }}
              onTouchEnd={(e) => {
                const el = e.currentTarget as any;
                const t = e.changedTouches[0];
                const dx = t.clientX - (el._tx ?? t.clientX);
                const dy = t.clientY - (el._ty ?? t.clientY);
                if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
                  el._swiped = true;
                  closeVideo();
                }
              }}
              role="button"
              aria-label="Tap to pause/resume, swipe to close video"
            />


            <div
              ref={videoContainerRef}
              className="absolute inset-0 w-full h-full bg-black"
              style={{ zIndex: 1 }}
            />

            {vimeoFeedbackIcon && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[10002] animate-fade-in">
                <div className="bg-black/50 rounded-full p-4">
                  {vimeoFeedbackIcon}
                </div>
              </div>
            )}

            {vimeoPlayerState === "playing-muted" && !vimeoFeedbackIcon && (
              <div className="absolute bottom-4 right-4 z-[10002] pointer-events-none">
                <div className="bg-black/50 rounded-full p-2">
                  <VolumeX className="h-5 w-5 text-white" />
                </div>
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {videoOverlay}

      <div className="absolute inset-0 pointer-events-none z-50" style={{ display: isVideoOpen ? 'none' : undefined }}>
      {!isVideoOpen && imageDimensions.width > 0 && imageDimensions.height > 0 && hotspots.map((hotspot) => {
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

          if (hotspot.metricKey === 'map_legend') {
            const baseFontSize = parseInt(String(style.fontSize || '24'), 10) || 24;
            return (
              <div
                key={hotspot.id}
                className="absolute overflow-hidden"
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  zIndex: hotspot.zIndex ?? 1,
                  backgroundColor: style.backgroundColor || 'transparent',
                  padding: style.padding || '8px',
                  borderRadius: style.borderRadius || '0',
                  pointerEvents: 'none',
                }}
              >
                <MapLegend
                  fontSize={baseFontSize}
                  color={style.color || '#1a1a1a'}
                  fontFamily={style.fontFamily}
                  fontWeight={style.fontWeight || '600'}
                />
              </div>
            );
          }

          return (
            <div
              key={hotspot.id}
              className="absolute flex items-center justify-center"
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
                zIndex: hotspot.zIndex ?? 1,
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
        
        // Transparent hotspot helper — renders invisible tap target
        const transparentStyle: React.CSSProperties = {
          left: `${left}px`,
          top: `${top}px`,
          width: `${buttonWidth}px`,
          height: `${buttonHeight}px`,
          zIndex: hotspot.zIndex ?? 1,
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
          background: 'transparent',
          border: 'none',
          padding: 0,
        };

        // Handle video/vimeo/youtube hotspot types — always use inline player
        if ((hotspot.type === 'video' || hotspot.type === 'vimeo' || hotspot.type === 'youtube') && hotspot.url) {
          const provider = detectVideoProvider(hotspot.url);
          return (
            <button
              key={hotspot.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (provider) {
                  console.log(`📱 Video hotspot tapped for inline playback (${provider}): ${hotspot.url}`);
                  setVideoUrl(hotspot.url!);
                  setVideoProvider(provider);
                  setIsVideoOpen(true);
                }
              }}
              className="absolute pointer-events-auto transition-opacity hover:opacity-80 active:opacity-60 flex items-center justify-center touch-manipulation cursor-pointer"
              style={transparentStyle}
            >
              {!hotspot.isTransparent && getHotspotIcon(hotspot.iconId, buttonWidth, buttonHeight)}
              {!hotspot.isTransparent && hotspot.label && hotspot.label.trim().length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    ...(hotspot.labelPosition === 'top'
                      ? { bottom: '100%', marginBottom: '4px' }
                      : { top: '100%', marginTop: '4px' }),
                    left: 0,
                    width: '100%',
                    fontSize: `${Math.max(11, Math.min(buttonWidth * 0.15, 18))}px`,
                    fontWeight: 700,
                    color: '#fff',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    whiteSpace: 'pre-line',
                    textAlign: 'center',
                    pointerEvents: 'none',
                    lineHeight: 1.3,
                  }}
                >
                  {hotspot.label}
                </span>
              )}
            </button>
          );
        }

        // Check if this is a Vimeo or YouTube link that should use the overlay
        console.log(`🔗 Checking external_link: type=${hotspot.type}, url=${hotspot.url}`);
        if (hotspot.type === 'external_link' && hotspot.url) {
          const isVimeo = isVimeoUrl(hotspot.url);
          const isYT = isYouTubeUrl(hotspot.url);
          console.log(`✅ External link detected: ${hotspot.url}, isVimeo: ${isVimeo}, isYouTube: ${isYT}`);
          
          // If it's a video URL, intercept and use handleExternalLink for inline playback
          if (isVimeo || isYT) {
            const videoIconId = 'play-button';
            return (
              <button
                key={hotspot.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log(`📱 Video link intercepted for inline playback: ${hotspot.url}`);
                  handleExternalLink(hotspot.url);
                }}
                className="absolute pointer-events-auto transition-opacity hover:opacity-80 active:opacity-60 flex items-center justify-center touch-manipulation cursor-pointer"
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${buttonWidth}px`,
                  height: `${buttonHeight}px`,
                  zIndex: hotspot.zIndex ?? 1,
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                }}
              >
              {!hotspot.isTransparent && getHotspotIcon(videoIconId, buttonWidth, buttonHeight)}
            </button>
          );
        }
          
          // For non-video external links, use anchor tag
          return (
            <a
              key={hotspot.id}
              href={hotspot.url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute pointer-events-auto transition-opacity hover:opacity-80 active:opacity-60 flex items-center justify-center touch-manipulation cursor-pointer"
              style={{
                ...transparentStyle,
                textDecoration: 'none',
              }}
              onClick={(e) => {
                e.stopPropagation();
                console.log(`📱 External link clicked: ${hotspot.url}`);
              }}
            >
              {!hotspot.isTransparent && getHotspotIcon(hotspot.iconId, buttonWidth, buttonHeight)}
            </a>
          );
        }

        // SMS / Email: when the composer URL was pre-minted, render a real link so
        // the tap itself performs the handoff (no async gap for the browser to reject).
        if (hotspot.type === 'sms' || hotspot.type === 'email') {
          const preHref = hotspot.type === 'sms' ? composerHrefs.sms : composerHrefs.email;
          if (preHref) {
            return (
              <a
                key={hotspot.id}
                href={preHref}
                className="absolute pointer-events-auto transition-opacity hover:opacity-80 active:opacity-60 flex items-center justify-center touch-manipulation cursor-pointer"
                style={{ ...transparentStyle, textDecoration: 'none' }}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log(`📱 Pre-minted ${hotspot.type} composer link tapped`);
                }}
              >
                {!hotspot.isTransparent && getHotspotIcon(hotspot.iconId, buttonWidth, buttonHeight)}
              </a>
            );
          }
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
        
        const isShareMedium = hotspot.type === 'sms' || hotspot.type === 'email';
        const intentProps = isShareMedium
          ? {
              onPointerEnter: () => premintComposer(hotspot.type as 'sms' | 'email'),
              onPointerDown: () => premintComposer(hotspot.type as 'sms' | 'email'),
            }
          : {};

        return (
          <button
            key={hotspot.id}
            onClick={handleClick}
            onTouchStart={handleTouchStart}
            {...intentProps}
            className="absolute pointer-events-auto transition-opacity hover:opacity-80 active:opacity-60 flex items-center justify-center touch-manipulation cursor-pointer"
            style={transparentStyle}
          >

            {!hotspot.isTransparent && getHotspotIcon(hotspot.iconId, buttonWidth, buttonHeight)}
            {!hotspot.isTransparent && hotspot.label && hotspot.label.trim().length > 0 && (
              (hotspot.type === 'email_support' ||
                (hotspot.type === 'email_links' && hotspot.emailLinksShowLabels)) && (
                <span
                  style={{
                    position: 'absolute',
                    ...(hotspot.labelPosition === 'top'
                      ? { bottom: '100%', marginBottom: '4px' }
                      : { top: '100%', marginTop: '4px' }),
                    left: 0,
                    width: '100%',
                    fontSize: `${Math.max(11, Math.min(buttonWidth * 0.15, 18))}px`,
                    fontWeight: 700,
                    color: '#fff',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    whiteSpace: 'pre-line',
                    textAlign: 'center',
                    pointerEvents: 'none',
                    lineHeight: 1.3,
                  }}
                >
                  {hotspot.label}
                </span>
              )
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
