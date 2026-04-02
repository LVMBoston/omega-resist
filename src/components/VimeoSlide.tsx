import { useEffect, useRef, useState, useCallback } from "react";
import { Volume2, VolumeX, Pause, Play } from "lucide-react";
import Player from "@vimeo/player";

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
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return `https://player.vimeo.com/video/${match[1]}?autoplay=1&controls=0&playsinline=1&background=0&muted=1&loop=0&title=0&byline=0&portrait=0&badge=0&autopause=0`;
    }
  }
  return url;
};

export const VimeoSlide = ({ contentUrl, mediaUrl, isActive }: VimeoSlideProps) => {
  const [playerState, setPlayerState] = useState<PlayerState>("idle");
  const [feedbackIcon, setFeedbackIcon] = useState<React.ReactNode | null>(null);
  const wasUnmutedRef = useRef(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = useCallback((icon: React.ReactNode) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedbackIcon(icon);
    feedbackTimerRef.current = setTimeout(() => setFeedbackIcon(null), 1500);
  }, []);

  const destroyPlayer = useCallback(() => {
    console.log("[VimeoSlide] destroyPlayer called");
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
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
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.backgroundColor = "#000";
    iframe.style.display = "block";
    iframe.style.pointerEvents = "none";
    iframe.setAttribute("allowfullscreen", "");

    videoContainerRef.current.appendChild(iframe);

    const player = new Player(iframe, { muted: true, autoplay: true });
    // Re-apply in case Vimeo SDK overrides pointer-events
    iframe.style.pointerEvents = 'none';
    playerRef.current = player;

    player.on("ended", () => {
      console.log("[VimeoSlide] video ended");
      destroyPlayer();
    });

    setPlayerState("playing-muted");
  }, [mediaUrl, destroyPlayer]);

  // Lifecycle: create player when active, pause/resume on swipe
  useEffect(() => {
    console.log("[VimeoSlide] isActive =", isActive, "playerState =", playerState);

    if (isActive) {
      if (playerState === "idle") {
        // First time or after destroy — create player (muted autoplay)
        requestAnimationFrame(() => createPlayer());
      } else if (playerState === "paused" && playerRef.current) {
        // Returning to slide — resume
        console.log("[VimeoSlide] resuming playback");
        playerRef.current.play().catch(() => {});
        if (wasUnmutedRef.current) {
          playerRef.current.setVolume(1).catch(() => {});
          setPlayerState("playing-unmuted");
        } else {
          setPlayerState("playing-muted");
        }
      }
    } else {
      // Swiped away — pause and mute
      if (playerRef.current && (playerState === "playing-muted" || playerState === "playing-unmuted")) {
        console.log("[VimeoSlide] pausing (swipe away)");
        wasUnmutedRef.current = playerState === "playing-unmuted";
        playerRef.current.pause().catch(() => {});
        playerRef.current.setVolume(0).catch(() => {});
        setPlayerState("paused");
      }
    }
  }, [isActive]); // intentionally not including playerState to avoid loops

  // Tap-to-toggle handler for center zone
  const handleCenterTap = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    switch (playerState) {
      case "playing-muted":
        console.log("[VimeoSlide] tap: unmuting");
        player.setVolume(1).catch(() => {});
        setPlayerState("playing-unmuted");
        showFeedback(<Volume2 className="h-12 w-12 text-white" />);
        break;
      case "playing-unmuted":
        console.log("[VimeoSlide] tap: pausing");
        player.pause().catch(() => {});
        setPlayerState("paused");
        showFeedback(<Pause className="h-12 w-12 text-white" />);
        break;
      case "paused":
        console.log("[VimeoSlide] tap: resuming");
        player.play().catch(() => {});
        player.setVolume(1).catch(() => {});
        setPlayerState("playing-unmuted");
        showFeedback(<Play className="h-12 w-12 text-white" />);
        break;
    }
  }, [playerState, showFeedback]);

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
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, []);

  const isShowingVideo = playerState !== "idle";

  return (
    <div className="relative w-full h-full">
      {/* Poster image — visible when idle */}
      {!isShowingVideo && (
        <img
          src={contentUrl}
          alt="Video poster"
          className="w-full h-full object-contain"
        />
      )}

      {/* Inline video container */}
      {isShowingVideo && (
        <div className="relative w-full h-full">
          {/* Left swipe-passthrough zone */}
          <div className="absolute inset-y-0 left-0 w-[15%] z-30 pointer-events-none" />

          {/* Center tap zone — use onTouchEnd for iOS Safari compatibility */}
          <button
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleCenterTap(); }}
            onClick={(e) => { e.stopPropagation(); handleCenterTap(); }}
            className="absolute inset-y-0 left-[15%] w-[70%] z-30 bg-transparent border-none cursor-pointer pointer-events-auto"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            aria-label="Toggle sound or pause"
          />

          {/* Right swipe-passthrough zone */}
          <div className="absolute inset-y-0 right-0 w-[15%] z-30 pointer-events-none" />

          {/* Vimeo iframe container */}
          <div
            ref={videoContainerRef}
            className="absolute inset-0 w-full h-full bg-black pointer-events-none"
            style={{ zIndex: 1 }}
          />

          {/* Feedback icon overlay */}
          {feedbackIcon && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 animate-fade-in">
              <div className="bg-black/50 rounded-full p-4">
                {feedbackIcon}
              </div>
            </div>
          )}

          {/* Muted indicator — persistent when muted */}
          {playerState === "playing-muted" && !feedbackIcon && (
            <div className="absolute bottom-4 right-4 z-20 pointer-events-none">
              <div className="bg-black/50 rounded-full p-2">
                <VolumeX className="h-5 w-5 text-white" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VimeoSlide;
