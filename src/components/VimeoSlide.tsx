import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Volume2, VolumeX, Pause, Play } from "lucide-react";

type PlayerState = "idle" | "playing-muted" | "playing-unmuted" | "paused";

interface VimeoSlideProps {
  contentUrl: string;   // poster image
  mediaUrl: string;     // Vimeo URL
  isActive: boolean;
}

const getVimeoEmbedUrl = (url: string): string => {
  const patterns = [
    /vimeo\.com\/(?:channels\/[\w-]+\/)?(\d+)(?:\/[\w-]+)?/,
    /player\.vimeo\.com\/video\/(\d+)/,
  ];
  // Preserve privacy hash (h=...) required for unlisted videos
  const hashMatch = url.match(/[?&]h=([\w-]+)/);
  const hashParam = hashMatch ? `h=${hashMatch[1]}&` : "";
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return `https://player.vimeo.com/video/${match[1]}?${hashParam}autoplay=1&muted=1&controls=1&playsinline=1&title=0&byline=0&portrait=0&badge=0&autopause=0&api=1`;
    }
  }
  return url;
};

export const VimeoSlide = ({ contentUrl, mediaUrl, isActive }: VimeoSlideProps) => {
  const [playerState, setPlayerState] = useState<PlayerState>("idle");
  const [feedbackIcon, setFeedbackIcon] = useState<React.ReactNode | null>(null);
  const wasUnmutedRef = useRef(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = useCallback((icon: React.ReactNode) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedbackIcon(icon);
    feedbackTimerRef.current = setTimeout(() => setFeedbackIcon(null), 1500);
  }, []);

  // Vimeo postMessage helper
  const vimeoPost = useCallback((method: string, value?: any) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const msg: any = { method };
    if (value !== undefined) msg.value = value;
    iframe.contentWindow.postMessage(JSON.stringify(msg), '*');
  }, []);

  const destroyPlayer = useCallback(() => {
    console.log("[VimeoSlide] destroyPlayer called");
    iframeRef.current = null;
    if (videoContainerRef.current) {
      videoContainerRef.current.innerHTML = "";
    }
    wasUnmutedRef.current = false;
    setPlayerState("idle");
  }, []);

  const createPlayer = useCallback(() => {
    if (!videoContainerRef.current) return;
    console.log("[VimeoSlide] createPlayer called");
    videoContainerRef.current.innerHTML = "";

    const iframe = document.createElement("iframe");
    iframe.src = getVimeoEmbedUrl(mediaUrl);
    iframe.allow = "autoplay; fullscreen; picture-in-picture";
    iframe.style.cssText = "width:100%;height:100%;border:none;background:#000;display:block";
    iframe.setAttribute("allowfullscreen", "");

    videoContainerRef.current.appendChild(iframe);
    iframeRef.current = iframe;

    const handleMessage = (e: MessageEvent) => {
      if (!e.origin.includes('vimeo.com')) return;
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data.event === 'ready') {
          iframe.contentWindow?.postMessage(JSON.stringify({ method: 'addEventListener', value: 'finish' }), '*');
          iframe.contentWindow?.postMessage(JSON.stringify({ method: 'setMuted', value: true }), '*');
          iframe.contentWindow?.postMessage(JSON.stringify({ method: 'setVolume', value: 0 }), '*');
          iframe.contentWindow?.postMessage(JSON.stringify({ method: 'play' }), '*');
          setPlayerState("playing-muted");
        }
        if (data.event === 'finish') {
          console.log("[VimeoSlide] video ended");
          destroyPlayer();
        }
      } catch {}
    };
    window.addEventListener('message', handleMessage);

    // Store cleanup ref
    (iframe as any)._messageHandler = handleMessage;
  }, [mediaUrl, destroyPlayer]);

  // Lifecycle: create player when active, pause/resume on swipe
  useEffect(() => {
    console.log("[VimeoSlide] isActive =", isActive, "playerState =", playerState);

    if (isActive) {
      if (playerState === "idle") {
        requestAnimationFrame(() => createPlayer());
      } else if (playerState === "paused" && iframeRef.current) {
        console.log("[VimeoSlide] resuming playback");
        vimeoPost('play');
        if (wasUnmutedRef.current) {
          vimeoPost('setMuted', false);
          vimeoPost('setVolume', 1);
          setPlayerState("playing-unmuted");
        } else {
          setPlayerState("playing-muted");
        }
      }
    } else {
      if (iframeRef.current && (playerState === "playing-muted" || playerState === "playing-unmuted")) {
        console.log("[VimeoSlide] pausing (swipe away)");
        wasUnmutedRef.current = playerState === "playing-unmuted";
        vimeoPost('pause');
        vimeoPost('setMuted', true);
        vimeoPost('setVolume', 0);
        setPlayerState("paused");
      }
    }
  }, [isActive]); // intentionally not including playerState to avoid loops

  // Tap-to-toggle handler for center zone
  const handleCenterTap = useCallback(() => {
    if (!iframeRef.current) return;

    switch (playerState) {
      case "playing-muted":
        console.log("[VimeoSlide] tap: unmuting");
        vimeoPost('setMuted', false);
        vimeoPost('setVolume', 1);
        setPlayerState("playing-unmuted");
        showFeedback(<Volume2 className="h-12 w-12 text-white" />);
        break;
      case "playing-unmuted":
        console.log("[VimeoSlide] tap: pausing");
        vimeoPost('pause');
        setPlayerState("paused");
        showFeedback(<Pause className="h-12 w-12 text-white" />);
        break;
      case "paused":
        console.log("[VimeoSlide] tap: resuming");
        vimeoPost('play');
        vimeoPost('setMuted', false);
        vimeoPost('setVolume', 1);
        setPlayerState("playing-unmuted");
        showFeedback(<Play className="h-12 w-12 text-white" />);
        break;
    }
  }, [playerState, showFeedback, vimeoPost]);

  // Escape key closes video
  useEffect(() => {
    if (playerState === "idle") return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") destroyPlayer();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [playerState, destroyPlayer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (iframeRef.current) {
        const handler = (iframeRef.current as any)._messageHandler;
        if (handler) window.removeEventListener('message', handler);
        iframeRef.current = null;
      }
      if (videoContainerRef.current) {
        videoContainerRef.current.innerHTML = "";
      }
    };
  }, []);

  const isShowingVideo = playerState !== "idle";

  const videoOverlay =
    isShowingVideo && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black"
            style={{ width: "100vw", height: "100dvh" }}
          >
            <div className="absolute inset-y-0 left-0 w-[15%] z-30 pointer-events-none" />

            {/* Center zone left as pointer-events-none so Vimeo's native controls (incl. fullscreen) receive taps */}
            <div className="absolute inset-y-0 left-[15%] w-[70%] z-30 pointer-events-none" />

            <div className="absolute inset-y-0 right-0 w-[15%] z-30 pointer-events-none" />

            <div
              ref={videoContainerRef}
              className="absolute inset-0 w-full h-full bg-black pointer-events-none"
              style={{ zIndex: 1 }}
            />

            {feedbackIcon && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 animate-fade-in">
                <div className="bg-black/50 rounded-full p-4">
                  {feedbackIcon}
                </div>
              </div>
            )}

            {playerState === "playing-muted" && !feedbackIcon && (
              <div className="absolute bottom-4 right-4 z-20 pointer-events-none">
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
      <div className="relative w-full h-full">
        {!isShowingVideo && (
          <img
            src={contentUrl}
            alt="Video poster"
            className="w-full h-full object-contain"
          />
        )}
      </div>
      {videoOverlay}
    </>
  );
};

export default VimeoSlide;
