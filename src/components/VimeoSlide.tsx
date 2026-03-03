import { useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import Player from "@vimeo/player";

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
      return `https://player.vimeo.com/video/${match[1]}?autoplay=1&controls=1&playsinline=1&background=0&muted=0&loop=0&title=0&byline=0&portrait=0&badge=0&autopause=0`;
    }
  }
  return url;
};

export const VimeoSlide = ({ contentUrl, mediaUrl, isActive }: VimeoSlideProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  // Destroy player when navigating away
  useEffect(() => {
    if (!isActive && isPlaying) {
      destroyPlayer();
    }
  }, [isActive]);

  // Escape key closes video
  useEffect(() => {
    if (!isPlaying) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") destroyPlayer();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isPlaying]);

  const destroyPlayer = () => {
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    if (videoContainerRef.current) {
      videoContainerRef.current.innerHTML = "";
    }
    setIsPlaying(false);
  };

  const startPlayback = () => {
    setIsPlaying(true);

    // Defer iframe creation to next tick so the container is mounted
    requestAnimationFrame(() => {
      if (!videoContainerRef.current) return;
      videoContainerRef.current.innerHTML = "";

      const iframe = document.createElement("iframe");
      iframe.src = getVimeoEmbedUrl(mediaUrl);
      iframe.allow = "autoplay; fullscreen; picture-in-picture";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      iframe.style.backgroundColor = "#000";
      iframe.style.display = "block";
      iframe.setAttribute("allowfullscreen", "");

      videoContainerRef.current.appendChild(iframe);

      const player = new Player(iframe, { muted: false, autoplay: true });
      playerRef.current = player;

      player.on("ended", () => destroyPlayer());
    });
  };

  return (
    <>
      {/* Poster image + play button */}
      <div className="relative w-full h-full flex items-center justify-center">
        <img
          src={contentUrl}
          alt="Video poster"
          className="w-full h-full object-contain"
        />
        {!isPlaying && (
          <button
            onClick={startPlayback}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
            aria-label="Play video"
          >
            <div className="bg-primary/90 rounded-full p-4 shadow-lg">
              <Play className="h-10 w-10 text-primary-foreground fill-primary-foreground" />
            </div>
          </button>
        )}
      </div>

      {/* Full-viewport video overlay */}
      {isPlaying && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <button
            onClick={destroyPlayer}
            className="absolute top-4 right-4 z-50 bg-background/80 hover:bg-background rounded-full p-2"
            aria-label="Close video"
          >
            <X className="h-6 w-6 text-foreground" />
          </button>
          <div
            ref={videoContainerRef}
            className="w-full h-full max-w-[90vw] max-h-[90vh] aspect-video"
          />
        </div>
      )}
    </>
  );
};

export default VimeoSlide;
