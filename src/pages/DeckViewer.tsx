import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ChevronLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ViralSlide } from "@/components/ViralSlideV2";
import { logEvent, instantiateL00Token } from "@/lib/virality/mint";
import { useAuth } from "@/contexts/AuthContext";

interface SlideItem {
  id: string;
  position: number;
  content_url: string;
  is_compressed: boolean;
  type: string;
  template_id?: string;
}

export default function DeckViewer() {
  console.log("🎬 DeckViewer component mounted!");
  
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const viralToken = searchParams.get("t");
  const { userRole } = useAuth();
  
  console.log("🎯 Component initialization:", { slug, viralToken, allParams: Object.fromEntries(searchParams) });
  
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iOSFullscreen, setIOSFullscreen] = useState(false);
  const [deletingSlide, setDeletingSlide] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  
  // Detect iOS immediately
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [eventLogged, setEventLogged] = useState(false);
  const [instanceTokenProcessed, setInstanceTokenProcessed] = useState(false);
  const [activeToken, setActiveToken] = useState<string | null>(viralToken);

  // Instance token creation for BUGTEST campaign L00 tokens
  useEffect(() => {
    const processInstanceToken = async () => {
      // Skip if already processed or no token
      if (instanceTokenProcessed || !viralToken) return;
      
      // Only process L00 tokens that haven't been instantiated
      if (!viralToken.startsWith('l00-') || viralToken.includes(':')) {
        setInstanceTokenProcessed(true);
        return;
      }

      console.log('🔄 L00 detected, creating instance token for:', viralToken);

      const result = await instantiateL00Token(viralToken);
      
      if (result) {
        console.log('✅ Instance token created, updating URL:', result.instanceToken);
        
        // Update URL with instance token (replace history entry)
        const newParams = new URLSearchParams(searchParams);
        newParams.set('t', result.instanceToken);
        navigate(`/deck/${slug}?${newParams.toString()}`, { replace: true });
        
        // Update active token for event logging
        setActiveToken(result.instanceToken);
      }
      
      setInstanceTokenProcessed(true);
    };

    processInstanceToken();
  }, [viralToken, searchParams, instanceTokenProcessed, slug, navigate]);

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

        // If we have a viral token, check if it's valid
        if (viralToken) {
          const { data: tokenValid, error: tokenError } = await supabase
            .rpc("is_token_valid", { p_token: viralToken });
          
          if (tokenError) {
            console.error("Error checking token validity:", tokenError);
          } else if (!tokenValid) {
            setError("This content has been updated. Please get the latest link from your organizer.");
            setLoading(false);
            return;
          }
        }

        // Fetch slides with cache busting [REBUILD 2025-10-25]
        const timestamp = Date.now();
        console.log(`🔄 [${timestamp}] Fetching slides for deck:`, slug);
        
        const { data: slideData, error: slideError } = await supabase
          .from("slide_items")
          .select("*")
          .eq("deck_slug", slug)
          .order("position", { ascending: true })
          .abortSignal(AbortSignal.timeout(10000)); // Force fresh data

        console.log(`📊 [${timestamp}] Raw Supabase response:`, {
          success: !slideError,
          error: slideError,
          dataLength: slideData?.length,
          rawData: slideData
        });

        if (slideError) {
          console.error(`❌ [${timestamp}] Slide fetch error:`, slideError);
          toast.error("Failed to load slides");
          setError("Failed to load slides");
          return;
        }

        // Validate spread-word slides
        const invalidSlides = slideData?.filter(s => 
          s.type === 'spread-word' && !s.template_id
        );
        
        if (invalidSlides && invalidSlides.length > 0) {
          console.error(`⚠️ [${timestamp}] Found spread-word slides without template_id:`, 
            invalidSlides.map(s => ({ id: s.id, position: s.position }))
          );
        }

        console.log(`✅ [${timestamp}] Slides loaded:`, slideData?.length);
        console.log(`📋 [${timestamp}] Slide details:`, slideData?.map(s => ({ 
          id: s.id, 
          type: s.type, 
          template_id: s.template_id, 
          position: s.position,
          deck_slug: s.deck_slug
        })));
        
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
        activeToken,
        instanceTokenProcessed,
        hasToken: !!activeToken 
      });

      if (eventLogged) {
        console.log("⏭️ Event already logged, skipping");
        return;
      }
      
      if (loading) {
        console.log("⏳ Still loading, waiting...");
        return;
      }

      // Wait for instance token processing to complete
      if (!instanceTokenProcessed) {
        console.log("⏳ Instance token not yet processed, waiting...");
        return;
      }
      
      if (!activeToken) {
        console.log("❌ No active token found");
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

        console.log("✅ Logging view event for token:", activeToken);
        console.log("📊 UTM snapshot:", utmSnapshot);

        const result = await logEvent({
          token: activeToken,
          eventType: "view",
          utmSnapshot,
        });

        console.log("✅ View event logged successfully:", result);
        setEventLogged(true);
      } catch (err) {
        console.error("❌ Failed to log view event:", err);
        console.error("Error details:", {
          message: err instanceof Error ? err.message : String(err),
          activeToken,
        });
      }
    };

    logViewEvent();
  }, [activeToken, searchParams, loading, eventLogged, instanceTokenProcessed]);

  // Removed auto-fullscreen on load - must be triggered by user gesture
  // Users can press 'f' key to toggle fullscreen manually


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

  const handleGenerateTestToken = async () => {
    if (!slug) return;
    
    setGeneratingToken(true);
    try {
      // Get the first EOA for this deck (you may want to make this selectable)
      const { data: eoaData } = await supabase
        .from("deck_eoa_assignments")
        .select("eoa_id")
        .eq("deck_slug", slug)
        .limit(1)
        .single();

      if (!eoaData) {
        toast.error("No EOA assigned to this deck. Please assign one first.");
        return;
      }

      // Generate a test token
      const testToken = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const { error: tokenError } = await supabase
        .from("tokens")
        .insert({
          token: testToken,
          eoa_id: eoaData.eoa_id,
          deck_slug: slug,
          level: 0,
          full_url: `${window.location.origin}/deck/${slug}?t=${testToken}`,
        });

      if (tokenError) {
        toast.error("Failed to generate test token");
        console.error(tokenError);
        return;
      }

      // Redirect to the deck with the new token
      window.location.href = `/deck/${slug}?t=${testToken}`;
      toast.success("Test token generated! You can now test sharing.");
    } catch (error) {
      console.error("Error generating test token:", error);
      toast.error("Failed to generate test token");
    } finally {
      setGeneratingToken(false);
    }
  };

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

  if (!slug) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Coming Soon</h1>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-background">
      <main className="h-screen flex items-center justify-center bg-black">
        {slides.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No slides found in this deck</p>
            </CardContent>
          </Card>
        ) : (
          <Carousel className="w-full h-full md:max-w-[90vw] md:max-h-[90vh] md:aspect-video">
            <CarouselContent className="h-full">
              {slides.map((slide, index) => {
                console.log(`🎨 Rendering slide ${index + 1}:`, { 
                  id: slide.id, 
                  type: slide.type, 
                  template_id: slide.template_id,
                  isSpreadWord: slide.type === "spread-word"
                });
                return (
                <CarouselItem key={slide.id} className="h-full flex items-center justify-center">
                  <Card className="h-full w-full border-0 rounded-none">
                    <CardContent className="p-0 h-full w-full flex items-center justify-center">
                      <div className="relative bg-black h-full w-full max-w-full max-h-full flex items-center justify-center">
                        {slide.type === "spread-word" ? (
                          <ViralSlide 
                            key={`viral-${slide.id}`}
                            slideId={slide.id} 
                            deckSlug={slug || ""} 
                            viralToken={activeToken} 
                          />
                        ) : (
                          <div className="relative w-full h-full flex items-center justify-center">
                            <img
                              src={slide.content_url}
                              alt={`Slide ${index + 1}`}
                              className="w-full h-full object-contain"
                              loading="lazy"
                            />
                            {slide.content_url.toLowerCase().endsWith('.gif') && (
                              <div className="absolute bottom-4 left-4 bg-purple-600/90 text-white text-sm font-bold px-3 py-1 rounded-full">
                                GIF
                              </div>
                            )}
                          </div>
                        )}
                        {(userRole === "admin" || userRole === "manager") && slide.type === "spread-word" && (
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-4 right-4 z-10"
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
                        <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm z-10">
                          {index + 1} / {slides.length}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious 
              data-carousel-prev 
              className="left-4 -translate-y-1/2 z-10"
            />
            <CarouselNext 
              data-carousel-next 
              className="right-4 -translate-y-1/2 z-10"
            />
          </Carousel>
        )}
      </main>
    </div>
  );
}
