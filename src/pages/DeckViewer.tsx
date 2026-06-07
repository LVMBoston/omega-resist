import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { ChevronLeft, Loader2, Trash2, X } from "lucide-react";
import { VimeoSlide } from "@/components/VimeoSlide";
import { toast } from "sonner";
import { ViralSlide } from "@/components/ViralSlideV2";
import { fetchDeckShape, persistDeckShape, ratioToOrientation, loadImageDims } from "@/lib/deckAspectRatio";
import { logEvent, instantiateL00Token, maybeReinstantiateL00, fetchGeolocation } from "@/lib/virality/mint";
import { useAuth } from "@/contexts/AuthContext";

const isCrawlerUserAgent = (userAgent: string): boolean => {
  return /bot|crawler|spider|facebookexternalhit|facebot|linkedinbot|twitterbot|xbot|slackbot|discordbot|whatsapp|telegrambot|bluesky|embedly|quora link preview|pinterest|vkshare|skypeuripreview/i.test(userAgent);
};

interface SlideItem {
  id: string;
  position: number;
  content_url: string;
  is_compressed: boolean;
  type: string;
  template_id?: string;
  media_url?: string;
}

export default function DeckViewer() {
  console.log("🎬 DeckViewer component mounted!");
  
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const viralToken = searchParams.get("t");
  const { user, userRole } = useAuth();
  
  console.log("🎯 Component initialization:", { slug, viralToken, allParams: Object.fromEntries(searchParams) });
  
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deckRedirectChecked, setDeckRedirectChecked] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Track active slide index via Embla API for Vimeo pause-on-swipe
  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setActiveIndex(carouselApi.selectedScrollSnap());
    onSelect();
    carouselApi.on("select", onSelect);
    return () => { carouselApi.off("select", onSelect); };
  }, [carouselApi]);

  // Check if EoA's assigned_deck_slug differs from the URL deck slug
  // This handles legacy direct-URL QR codes that bypass the short URL system
  useEffect(() => {
    const checkDeckRedirect = async () => {
      if (!slug || !viralToken) {
        setDeckRedirectChecked(true);
        return;
      }

      try {
        // Look up the token's EoA to get assigned_deck_slug
        const { data: tokenData } = await supabase
          .from("tokens")
          .select("eoa_id")
          .eq("token", viralToken)
          .maybeSingle();

        if (!tokenData?.eoa_id) {
          setDeckRedirectChecked(true);
          return;
        }

        const { data: eoa } = await supabase
          .from("events_actions")
          .select("assigned_deck_slug")
          .eq("id", tokenData.eoa_id)
          .single();

        if (eoa?.assigned_deck_slug && eoa.assigned_deck_slug !== slug) {
          console.log(`🔄 Deck redirect: ${slug} → ${eoa.assigned_deck_slug}`);
          const newPath = window.location.pathname.replace(`/deck/${slug}`, `/deck/${eoa.assigned_deck_slug}`);
          navigate(`${newPath}${window.location.search}`, { replace: true });
          return; // Don't set checked - navigation will remount
        }
      } catch (err) {
        console.warn("Deck redirect check failed:", err);
      }
      setDeckRedirectChecked(true);
    };

    checkDeckRedirect();
  }, [slug, viralToken, navigate]);
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

  // L00 seed token creation and location-based re-instantiation for organizer channels
  useEffect(() => {
    const processInstanceToken = async () => {
      // Skip if already processed or no token
      if (instanceTokenProcessed || !viralToken) return;

      if (isCrawlerUserAgent(navigator.userAgent)) {
        console.log('🤖 Preview crawler detected, skipping L00 instantiation:', navigator.userAgent);
        setActiveToken(null);
        setInstanceTokenProcessed(true);
        return;
      }
      
      // Case 1: Base L00 seed token (no colon) - create new human-viewer instance
      if (viralToken.startsWith('l00-') && !viralToken.includes(':')) {
        console.log('🔄 Base L00 seed detected, creating instance token for:', viralToken);

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
        return;
      }
      
      // Case 2: L00 instance token (has colon) - check for different recipient location
      if (viralToken.startsWith('l00-') && viralToken.includes(':')) {
        console.log('🔍 L00 instance detected, checking for location change:', viralToken);
        
        // Get current location to compare
        const geoData = await fetchGeolocation();
        
        if (geoData.zip_code) {
          const result = await maybeReinstantiateL00(viralToken, geoData.zip_code);
          
          if (result.wasReinstantiated) {
            console.log('🆕 Different location detected, new instance created:', result.token);
            
            // Update URL with new instance token
            const newParams = new URLSearchParams(searchParams);
            newParams.set('t', result.token);
            navigate(`/deck/${slug}?${newParams.toString()}`, { replace: true });
            
            setActiveToken(result.token);
          } else {
            console.log('✅ Same location, using existing instance:', viralToken);
            setActiveToken(viralToken);
          }
        } else {
          console.log('⚠️ No zip code available, keeping existing instance');
          setActiveToken(viralToken);
        }
        
        setInstanceTokenProcessed(true);
        return;
      }
      
      // Case 3: Non-L00 token (L01, L02, L03) - use as-is
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
    if (!slug || !deckRedirectChecked) return;

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
          .eq("skip_deploy", false)
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
  }, [slug, deckRedirectChecked]);

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

      if (isCrawlerUserAgent(navigator.userAgent)) {
        console.log("🤖 Preview crawler detected, skipping view event log");
        setEventLogged(true);
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

  // Resolve deck orientation from the persisted aspect ratio on the deck row.
  // Falls back to probing the first image only when the deck has no recorded shape yet,
  // then writes the result back so every subsequent load is deterministic.
  useEffect(() => {
    if (!slug || slides.length === 0) return;
    let cancelled = false;
    (async () => {
      const stored = await fetchDeckShape(slug);
      if (cancelled) return;
      if (stored) {
        setOrientation(stored.orientation === 'portrait' ? 'portrait' : 'landscape');
        return;
      }
      const firstImage = slides.find(s => s.type === 'image');
      if (!firstImage) {
        // No image to measure — default video/interactive decks to landscape (Vimeo is 16:9)
        setOrientation('landscape');
        return;
      }
      const dims = await loadImageDims(firstImage.content_url);
      if (cancelled || !dims) return;
      const ratio = dims.w / dims.h;
      const orientation = ratioToOrientation(ratio);
      setOrientation(orientation === 'portrait' ? 'portrait' : 'landscape');
      persistDeckShape(slug, { aspectRatio: ratio, orientation }).catch(() => {});
    })();
    return () => { cancelled = true; };
  }, [slug, slides]);

  // Auto-fullscreen on first user gesture (browsers require a user-initiated event).
  // Desktop/Android: use Fullscreen API. iOS Safari: fall back to CSS pseudo-fullscreen.
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    const enterFullscreen = () => {
      if (isIOS || !document.documentElement.requestFullscreen) {
        setIOSFullscreen(true);
      } else if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {
          // Permission denied or unsupported — fall back to CSS pseudo-fullscreen
          setIOSFullscreen(true);
        });
      }
      window.removeEventListener("pointerdown", enterFullscreen);
      window.removeEventListener("keydown", enterFullscreen);
    };

    window.addEventListener("pointerdown", enterFullscreen, { once: false });
    window.addEventListener("keydown", enterFullscreen, { once: false });

    return () => {
      window.removeEventListener("pointerdown", enterFullscreen);
      window.removeEventListener("keydown", enterFullscreen);
    };
  }, []);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);


  // Force relayout on orientation change (iOS Safari keeps stale dimensions after rotation)
  useEffect(() => {
    const handleOrientationChange = () => {
      // Gentle reflow: read offsetHeight to force layout recalculation
      setTimeout(() => {
        document.querySelectorAll('.deck-slide-container, .deck-slide-landscape').forEach((el) => {
          void (el as HTMLElement).offsetHeight;
        });
        // Embla retains stale viewport measurements after rotation — force remeasure
        carouselApi?.reInit();
      }, 100);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    return () => window.removeEventListener('orientationchange', handleOrientationChange);
  }, [carouselApi]);

  // Re-measure Embla when orientation is detected async (after first image loads)
  useEffect(() => {
    carouselApi?.reInit();
  }, [carouselApi, orientation]);


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
          .eq("skip_deploy", false)
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

  // Portrait slides (9:16) need different handling on landscape vs portrait screens
  // iPhone (portrait): fill width, height scales naturally
  // PC/iPad (landscape): fit to height with letterboxing (pillarboxing)
  
  const isPreviewer = !!user || userRole !== null || searchParams.get("preview") === "1";
  const handleExitPreview = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/campaigns");
    }
  };

  return (
    <div className="bg-background">
      <main className="relative flex items-center justify-center bg-black overflow-hidden" style={{ height: '100dvh' }}>
        {isPreviewer && (
          <Button
            variant="secondary"
            size="icon"
            onClick={handleExitPreview}
            className="absolute top-4 left-4 z-50 bg-background/80 backdrop-blur-sm hover:bg-background/90 shadow-md"
            title="Exit preview"
            aria-label="Exit preview"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        {slides.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No slides found in this deck</p>
            </CardContent>
          </Card>
        ) : (
          <Carousel className="w-full h-full" setApi={setCarouselApi}>
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
                  <Card className="h-full w-full border-0 rounded-none bg-black">
                    <CardContent className="p-0 h-full w-full flex items-center justify-center">
                      {/* Portrait slide (9:16): fill height on landscape viewports (letterbox), fill width on portrait viewports */}
                      <div className={`relative bg-black flex items-center justify-center ${orientation === 'landscape' ? 'deck-slide-landscape' : 'deck-slide-container'}`}>
                        {slide.type === "spread-word" ? (
                          <ViralSlide 
                            key={`viral-${slide.id}`}
                            slideId={slide.id} 
                            deckSlug={slug || ""} 
                            viralToken={activeToken}
                            templateId={slide.template_id}
                          />
                        ) : slide.type === "vimeo" && slide.media_url ? (
                          <VimeoSlide
                            contentUrl={slide.content_url}
                            mediaUrl={slide.media_url}
                            isActive={index === activeIndex}
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
              className="left-4 -translate-y-1/2 z-10 opacity-50"
            />
            <CarouselNext 
              data-carousel-next 
              className="right-4 -translate-y-1/2 z-10 opacity-50"
            />
          </Carousel>
        )}
      </main>
    </div>
  );
}
