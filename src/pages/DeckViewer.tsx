import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ChevronLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ViralSlide } from "@/components/ViralSlide";
import { logEvent } from "@/lib/virality/mint";
import { useAuth } from "@/contexts/AuthContext";

interface SlideItem {
  id: string;
  position: number;
  content_url: string;
  is_compressed: boolean;
  type: string;
}

export default function DeckViewer() {
  console.log("🎬 DeckViewer component mounted!");
  
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const viralToken = searchParams.get("t");
  const { userRole } = useAuth();
  
  console.log("🎯 Component initialization:", { slug, viralToken, allParams: Object.fromEntries(searchParams) });
  
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iOSFullscreen, setIOSFullscreen] = useState(false);
  const [deletingSlide, setDeletingSlide] = useState<string | null>(null);
  
  // Detect iOS immediately
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [eventLogged, setEventLogged] = useState(false);

  // Set page title
  useEffect(() => {
    console.log("📄 Setting page title useEffect running");
    document.title = "Democracy Forge";
  }, []);

  useEffect(() => {
    console.log("🔄 Fetch deck useEffect running, slug:", slug);
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

  // Log view event when deck loads with viral token
  useEffect(() => {
    const logViewEvent = async () => {
      console.log("🔍 LogViewEvent check:", { 
        eventLogged, 
        loading, 
        viralToken,
        hasToken: !!viralToken 
      });

      if (eventLogged) {
        console.log("⏭️ Event already logged, skipping");
        return;
      }
      
      if (loading) {
        console.log("⏳ Still loading, waiting...");
        return;
      }
      
      if (!viralToken) {
        console.log("❌ No viral token found in URL");
        return;
      }

      try {
        // Extract UTM parameters for snapshot
        const utmSnapshot = {
          utm_campaign: searchParams.get("utm_campaign") || undefined,
          utm_source: searchParams.get("utm_source") || undefined,
          utm_medium: searchParams.get("utm_medium") || undefined,
          utm_content: searchParams.get("utm_content") || undefined,
          utm_id: searchParams.get("utm_id") || undefined,
          v_lvl: searchParams.get("v_lvl") || undefined,
          parent_token: searchParams.get("p") || undefined,
        };

        console.log("✅ Logging view event for token:", viralToken);
        console.log("📊 UTM snapshot:", utmSnapshot);

        const result = await logEvent({
          token: viralToken,
          eventType: "view",
          utmSnapshot,
        });

        console.log("✅ View event logged successfully:", result);
        setEventLogged(true);
      } catch (err) {
        console.error("❌ Failed to log view event:", err);
        console.error("Error details:", {
          message: err instanceof Error ? err.message : String(err),
          viralToken,
        });
      }
    };

    logViewEvent();
  }, [viralToken, searchParams, loading, eventLogged]);

  // Auto-enter fullscreen on load
  useEffect(() => {
    if (!loading && slides.length > 0 && !hasAutoOpened) {
      setHasAutoOpened(true);
      if (isIOS) {
        // Use CSS-based fullscreen for iOS
        setIOSFullscreen(true);
      } else {
        // Request fullscreen for other devices
        document.documentElement.requestFullscreen().catch(err => {
          console.log("Fullscreen request failed:", err);
        });
      }
    }
  }, [loading, slides.length, hasAutoOpened, isIOS]);


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

  const handleDeleteInteractive = async (slideId: string) => {
    if (!confirm("Delete this interactive page? The slide will be converted back to a regular image slide.")) {
      return;
    }

    setDeletingSlide(slideId);
    try {
      // Delete viral_slide_configs for this slide
      const { error: deleteError } = await supabase
        .from("viral_slide_configs")
        .delete()
        .eq("slide_id", slideId);

      if (deleteError) throw deleteError;

      // Update slide type back to image
      const { error: updateError } = await supabase
        .from("slide_items")
        .update({ type: "image" })
        .eq("id", slideId);

      if (updateError) throw updateError;

      toast.success("Interactive page deleted successfully");
      
      // Refresh slides
      if (slug) {
        const { data: slideData } = await supabase
          .from("slide_items")
          .select("*")
          .eq("deck_slug", slug)
          .order("position", { ascending: true });

        setSlides(slideData || []);
      }
    } catch (error) {
      console.error("Error deleting interactive page:", error);
      toast.error("Failed to delete interactive page");
    } finally {
      setDeletingSlide(null);
    }
  };

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
            <CarouselContent className={effectiveFullscreen ? "h-full" : ""}>
              {slides.map((slide, index) => (
                <CarouselItem key={slide.id} className={effectiveFullscreen ? "h-full" : ""}>
                  <Card className={effectiveFullscreen ? "h-full border-0 rounded-none" : ""}>
                    <CardContent className={effectiveFullscreen ? "p-0 h-full" : "p-0"}>
                      <div className={`relative bg-muted ${effectiveFullscreen ? 'h-full w-full' : 'aspect-video'}`}>
                        {slide.type === "spread-word" ? (
                          <ViralSlide slideId={slide.id} deckSlug={slug || ""} viralToken={viralToken} />
                        ) : (
                          <img
                            src={slide.content_url}
                            alt={`Slide ${index + 1}`}
                            className={`w-full h-full ${effectiveFullscreen ? 'object-contain' : 'object-contain'}`}
                            loading="lazy"
                          />
                        )}
                        {(userRole === "admin" || userRole === "manager") && slide.type === "spread-word" && (
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-4 right-4"
                            onClick={() => handleDeleteInteractive(slide.id)}
                            disabled={deletingSlide === slide.id}
                            title="Delete interactive page"
                          >
                            {deletingSlide === slide.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
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
