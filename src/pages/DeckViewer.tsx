import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ViralSlide } from "@/components/ViralSlide";

interface SlideItem {
  id: string;
  position: number;
  content_url: string;
  is_compressed: boolean;
  type: string;
}

export default function DeckViewer() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const viralToken = searchParams.get("t");
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [iOSFullscreen, setIOSFullscreen] = useState(false);
  
  // Detect iOS immediately
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Set page title
  useEffect(() => {
    document.title = "Democracy Forge";
  }, []);

  useEffect(() => {
    if (!slug) return;

    const fetchDeck = async () => {
      setLoading(true);
      setError(null);

      try {
        // Check if deck exists
        const { data: deck, error: deckError } = await supabase
          .from("decks")
          .select("slug")
          .eq("slug", slug)
          .single();

        if (deckError || !deck) {
          setError("Deck not found");
          setLoading(false);
          return;
        }

        // Fetch slides
        const { data: slideData, error: slideError } = await supabase
          .from("slide_items")
          .select("*")
          .eq("deck_slug", slug)
          .order("position", { ascending: true });

        if (slideError) {
          toast.error("Failed to load slides");
          setError("Failed to load slides");
          return;
        }

        setSlides(slideData || []);
      } catch (err) {
        console.error("Error fetching deck:", err);
        setError("An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchDeck();
  }, [slug]);

  // Show fullscreen prompt on load (or auto-enter on iOS)
  useEffect(() => {
    if (!loading && slides.length > 0) {
      if (isIOS) {
        // Automatically enter CSS fullscreen on iOS
        setIOSFullscreen(true);
      } else {
        setShowFullscreenPrompt(true);
      }
    }
  }, [loading, slides, isIOS]);

  const enterFullscreen = async () => {
    if (isIOS) {
      // Use CSS-based fullscreen for iOS
      setIOSFullscreen(true);
      setShowFullscreenPrompt(false);
      return;
    }
    try {
      await document.documentElement.requestFullscreen();
      setShowFullscreenPrompt(false);
    } catch (err) {
      console.log("Fullscreen request failed:", err);
      toast.error("Unable to enter fullscreen mode");
    }
  };

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        document.querySelector<HTMLButtonElement>('[data-carousel-prev]')?.click();
      } else if (e.key === "ArrowRight") {
        document.querySelector<HTMLButtonElement>('[data-carousel-next]')?.click();
      } else if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading deck...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-destructive font-medium">{error}</p>
            <Link to="/">
              <Button variant="outline">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const effectiveFullscreen = isFullscreen || iOSFullscreen;

  return (
    <div className={`min-h-screen bg-background ${iOSFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {showFullscreenPrompt && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="pt-6 text-center space-y-4">
              <h2 className="text-2xl font-bold">Ready to Present?</h2>
              <p className="text-muted-foreground">
                Click below to view this deck in fullscreen mode
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={enterFullscreen} size="lg">
                  Enter Fullscreen
                </Button>
                <Button 
                  onClick={() => setShowFullscreenPrompt(false)} 
                  variant="outline"
                  size="lg"
                >
                  View Normal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {!effectiveFullscreen && (
        <header className="border-b bg-card">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">{slug}</h1>
                <p className="text-sm text-muted-foreground">{slides.length} slides</p>
              </div>
            </div>
          </div>
        </header>
      )}

      <main className={effectiveFullscreen ? "h-screen flex items-center justify-center" : "container mx-auto px-6 py-12"}>
        {slides.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No slides found in this deck</p>
            </CardContent>
          </Card>
        ) : (
          <Carousel className={effectiveFullscreen ? "w-full h-full" : "max-w-5xl mx-auto"}>
            <CarouselContent>
              {slides.map((slide, index) => (
                <CarouselItem key={slide.id}>
                  <Card>
                    <CardContent className="p-0">
                      <div className="relative aspect-video bg-muted">
                        {slide.type === "spread-word" ? (
                          <ViralSlide slideId={slide.id} deckSlug={slug || ""} viralToken={viralToken} />
                        ) : (
                          <img
                            src={slide.content_url}
                            alt={`Slide ${index + 1}`}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        )}
                        <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm">
                          {index + 1} / {slides.length}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious 
              data-carousel-prev 
              className={effectiveFullscreen ? "left-4 -translate-y-1/2" : undefined}
            />
            <CarouselNext 
              data-carousel-next 
              className={effectiveFullscreen ? "right-4 -translate-y-1/2" : undefined}
            />
          </Carousel>
        )}
      </main>
    </div>
  );
}
