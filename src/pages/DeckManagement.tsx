import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Plus, Star, Trash2, UserCog, LogIn, LogOut, FileDown, X, RefreshCw, Calendar, Clock, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
interface DeckWithSlides {
  slug: string;
  created_at: string;
  updated_at: string;
  slide_count: number;
  interactive_count: number;
  mobilize_org_count: number;
  campaigns: Array<{ code: string; title: string; id: string }>;
}
const Index = () => {
  const [decks, setDecks] = useState<DeckWithSlides[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [googleSlidesUrl, setGoogleSlidesUrl] = useState("");
  const [deckSlug, setDeckSlug] = useState("");
  const [importing, setImporting] = useState(false);
  const [interactiveImageDialog, setInteractiveImageDialog] = useState(false);
  const [interactiveSlides, setInteractiveSlides] = useState<Array<{
    id: string;
    content_url: string;
    position: number;
  }>>([]);
  const [loadingImage, setLoadingImage] = useState(false);
  const [imageSlidesDialog, setImageSlidesDialog] = useState(false);
  const [imageSlides, setImageSlides] = useState<Array<{
    id: string;
    content_url: string;
    position: number;
  }>>([]);
  const [loadingImageSlides, setLoadingImageSlides] = useState(false);
  const navigate = useNavigate();
  const {
    user,
    userRole,
    signOut
  } = useAuth();
  useEffect(() => {
    fetchDecks();
  }, []);
  const fetchDecks = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      }

      // Fetch all decks
      const {
        data: decksData,
        error: decksError
      } = await supabase.from("decks").select("slug, created_at, updated_at").order("created_at", {
        ascending: false
      });
      if (decksError) throw decksError;

      // Fetch slide counts and mobilize org counts for each deck
      const decksWithCounts = await Promise.all((decksData || []).map(async deck => {
        const {
          count
        } = await supabase.from("slide_items").select("*", {
          count: "exact",
          head: true
        }).eq("deck_slug", deck.slug).eq("type", "image");
        const {
          count: interactiveCount
        } = await supabase.from("slide_items").select("*", {
          count: "exact",
          head: true
        }).eq("deck_slug", deck.slug).eq("type", "spread-word");
        
        // Count unique mobilize codes for this deck
        const { data: mobilizeData } = await supabase
          .from("events_actions")
          .select("mobilize_code")
          .eq("assigned_deck_slug", deck.slug)
          .not("mobilize_code", "is", null);
        
        const uniqueMobilizeCodes = new Set(mobilizeData?.map(ea => ea.mobilize_code) || []);
        
        // Get campaigns using this deck
        const { data: campaignsData } = await supabase
          .from("events_actions")
          .select("campaign_id, campaigns(id, code, title)")
          .eq("assigned_deck_slug", deck.slug);
        
        const uniqueCampaigns = Array.from(
          new Map(
            (campaignsData || [])
              .filter(ea => ea.campaigns)
              .map(ea => [
                ea.campaigns.id,
                { 
                  id: ea.campaigns.id, 
                  code: ea.campaigns.code, 
                  title: ea.campaigns.title 
                }
              ])
          ).values()
        );
        
        return {
          slug: deck.slug,
          created_at: deck.created_at,
          updated_at: deck.updated_at,
          slide_count: count || 0,
          interactive_count: interactiveCount || 0,
          mobilize_org_count: uniqueMobilizeCodes.size,
          campaigns: uniqueCampaigns
        };
      }));
      setDecks(decksWithCounts);
      if (isRefresh) {
        toast.success("Deck counts refreshed");
      }
    } catch (error) {
      console.error("Error fetching decks:", error);
      toast.error("Failed to load decks");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  const handleRemoveInteractive = async (slug: string) => {
    if (!confirm(`Remove all interactive pages from deck "${slug}"?`)) {
      return;
    }
    try {
      // Get all interactive slides for this deck
      const {
        data: interactiveSlides,
        error: fetchError
      } = await supabase.from("slide_items").select("id").eq("deck_slug", slug).eq("type", "spread-word");
      if (fetchError) throw fetchError;

      // Delete viral slide configs for these slides
      if (interactiveSlides && interactiveSlides.length > 0) {
        const slideIds = interactiveSlides.map(s => s.id);
        const {
          error: viralConfigsError
        } = await supabase.from("viral_slide_configs").delete().in("slide_id", slideIds);
        if (viralConfigsError) throw viralConfigsError;

        // Delete the interactive slides
        const {
          error: slidesError
        } = await supabase.from("slide_items").delete().eq("deck_slug", slug).eq("type", "spread-word");
        if (slidesError) throw slidesError;
        toast.success(`Removed ${interactiveSlides.length} interactive page(s)`);
      } else {
        toast.info("No interactive pages to remove");
      }
      fetchDecks();
    } catch (error) {
      console.error("Error removing interactive pages:", error);
      toast.error("Failed to remove interactive pages");
    }
  };
  const handleDelete = async (slug: string) => {
    if (!confirm(`Delete deck "${slug}"? This will also delete all associated slides.`)) {
      return;
    }
    try {
      // Delete viral slide configs first (they reference slide_items)
      const {
        error: viralConfigsError
      } = await supabase.from("viral_slide_configs").delete().eq("deck_slug", slug);
      if (viralConfigsError) throw viralConfigsError;

      // Delete slide items
      const {
        error: slidesError
      } = await supabase.from("slide_items").delete().eq("deck_slug", slug);
      if (slidesError) throw slidesError;

      // Delete deck
      const {
        error: deckError
      } = await supabase.from("decks").delete().eq("slug", slug);
      if (deckError) throw deckError;
      toast.success("Deck deleted successfully");
      fetchDecks();
    } catch (error) {
      console.error("Error deleting deck:", error);
      toast.error("Failed to delete deck");
    }
  };
  const handleExportPDF = async (slug: string) => {
    try {
      toast.info("Generating PDF...");

      // Fetch slides for this deck
      const {
        data: slides,
        error
      } = await supabase.from("slide_items").select("content_url, position").eq("deck_slug", slug).order("position");
      if (error) throw error;
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      for (let i = 0; i < (slides || []).length; i++) {
        if (i > 0) pdf.addPage();
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = slides[i].content_url;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          const imgWidth = img.width;
          const imgHeight = img.height;
          const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
          const width = imgWidth * ratio;
          const height = imgHeight * ratio;
          const x = (pageWidth - width) / 2;
          const y = (pageHeight - height) / 2;
          pdf.addImage(img, "JPEG", x, y, width, height);
        } catch (err) {
          console.error(`Failed to add slide ${i + 1}:`, err);
        }
      }
      pdf.save(`${slug}.pdf`);
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Failed to export PDF");
    }
  };
  const handleImportSlides = async () => {
    if (!googleSlidesUrl || !deckSlug) {
      toast.error("Please provide both Google Slides URL and deck name");
      return;
    }

    // Extract presentation ID from URL
    const urlMatch = googleSlidesUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const presentationId = urlMatch ? urlMatch[1] : googleSlidesUrl;
    if (!presentationId) {
      toast.error("Invalid Google Slides URL");
      return;
    }
    setImporting(true);
    try {
      // Check if deck exists, create only if it doesn't
      const {
        data: existingDeck
      } = await supabase.from("decks").select("slug").eq("slug", deckSlug).maybeSingle();
      if (!existingDeck) {
        const {
          error: deckError
        } = await supabase.from("decks").insert({
          slug: deckSlug
        });
        if (deckError) throw deckError;
      }

      // Call edge function to import slides
      const {
        data,
        error
      } = await supabase.functions.invoke("import-google-slides", {
        body: {
          presentationId,
          deckSlug
        }
      });
      if (error) throw error;
      toast.success(`Successfully imported ${data.slidesCount} slides`);
      setImportDialogOpen(false);
      setGoogleSlidesUrl("");
      setDeckSlug("");
      fetchDecks();
    } catch (error: any) {
      console.error("Error importing slides:", error);
      toast.error(error.message || "Failed to import slides");
    } finally {
      setImporting(false);
    }
  };
  const handleShowInteractiveImage = async (deckSlug: string) => {
    setLoadingImage(true);
    setInteractiveImageDialog(true);
    setInteractiveSlides([]);
    try {
      const {
        data: slides,
        error
      } = await supabase.from("slide_items").select("id, content_url, position").eq("deck_slug", deckSlug).eq("type", "spread-word").order("position");
      if (error) throw error;
      if (!slides || slides.length === 0) {
        toast.error("No interactive slides found");
        setInteractiveImageDialog(false);
        return;
      }
      setInteractiveSlides(slides);
    } catch (error) {
      console.error("Error fetching interactive slides:", error);
      toast.error("Failed to load interactive slides");
      setInteractiveImageDialog(false);
    } finally {
      setLoadingImage(false);
    }
  };
  const handleShowImageSlides = async (deckSlug: string) => {
    setLoadingImageSlides(true);
    setImageSlidesDialog(true);
    setImageSlides([]);
    try {
      const {
        data: slides,
        error
      } = await supabase.from("slide_items").select("id, content_url, position").eq("deck_slug", deckSlug).eq("type", "image").order("position");
      if (error) throw error;
      if (!slides || slides.length === 0) {
        toast.error("No image slides found");
        setImageSlidesDialog(false);
        return;
      }
      setImageSlides(slides);
    } catch (error) {
      console.error("Error fetching image slides:", error);
      toast.error("Failed to load image slides");
      setImageSlidesDialog(false);
    } finally {
      setLoadingImageSlides(false);
    }
  };
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }) + " " + date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };
  return <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="w-full px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Deck Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Viral Deck Management</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => fetchDecks(true)} variant="outline" disabled={refreshing} title="Refresh slide counts">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh Counts
            </Button>
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FileDown className="h-4 w-4 mr-2" />
                  Import from Google Slides
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Google Slides</DialogTitle>
                  <DialogDescription>
                    Enter a Google Slides URL or presentation ID and choose a name for your deck.
                    <br /><br />
                    <strong>Important:</strong> You must share the presentation with your service account email.
                    <br />
                    Find the service account email in your Google Cloud Console under "Service Accounts".
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="slides-url">Google Slides URL</Label>
                    <Input id="slides-url" placeholder="https://docs.google.com/presentation/d/1fDM9jDqB8G.../edit" value={googleSlidesUrl} onChange={e => setGoogleSlidesUrl(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deck-slug">Deck Name</Label>
                    <Input id="deck-slug" placeholder="my-deck" value={deckSlug} onChange={e => setDeckSlug(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleImportSlides} disabled={importing}>
                    {importing ? "Importing..." : "Import"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={() => navigate("/deck-builder")}>
              <Plus className="h-4 w-4 mr-2" />
              New Deck
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-8">
        {loading ? <div className="text-center py-12">
            <p className="text-muted-foreground">Loading decks...</p>
          </div> : decks.length === 0 ? <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No decks found. Create your first deck to get started.</p>
            <Button onClick={() => navigate("/deck-builder")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Deck
            </Button>
          </div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {decks.map(deck => (
              <Card key={deck.slug} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <Link to={`/deck-editor/${deck.slug}`} className="hover:underline">
                      {deck.slug}
                    </Link>
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Deck Slug: {deck.slug}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2 text-sm">
                    <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Created on:</p>
                      <p className="font-medium">{formatDate(deck.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Last Update:</p>
                      <p className="font-medium">{formatDate(deck.updated_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground"># Mobilize Orgs:</p>
                      <p className="font-medium">{deck.mobilize_org_count}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Campaigns using this deck:</p>
                      {deck.campaigns.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {deck.campaigns.map(campaign => (
                            <Badge key={campaign.id} variant="secondary" className="text-xs">
                              {campaign.code}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="font-medium text-muted-foreground">None</p>
                      )}
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Image Slides</p>
                      {deck.slide_count > 0 ? (
                        <button 
                          onClick={() => handleShowImageSlides(deck.slug)} 
                          className="hover:underline text-primary font-medium cursor-pointer"
                        >
                          {deck.slide_count}
                        </button>
                      ) : (
                        <p className="font-medium">{deck.slide_count}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Interactive Pages</p>
                      {deck.interactive_count > 0 ? (
                        <button 
                          onClick={() => handleShowInteractiveImage(deck.slug)} 
                          className="hover:underline text-primary font-medium cursor-pointer"
                        >
                          {deck.interactive_count}
                        </button>
                      ) : (
                        <p className="font-medium">{deck.interactive_count}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleExportPDF(deck.slug)}
                    title="Export to PDF"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <div className="flex gap-2">
                    {deck.interactive_count > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleRemoveInteractive(deck.slug)}
                        title="Remove interactive pages"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDelete(deck.slug)}
                      title="Delete deck"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>}
      </main>

      <Dialog open={interactiveImageDialog} onOpenChange={setInteractiveImageDialog}>
        <DialogContent className="max-w-6xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Interactive Slides</DialogTitle>
            <DialogDescription>
              Preview of all interactive slides in this deck
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto">
            {loadingImage ? <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div> : interactiveSlides.length > 0 ? <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {interactiveSlides.map(slide => <div key={slide.id} className="relative group border rounded-lg overflow-hidden hover:border-primary transition-colors">
                    <img src={slide.content_url} alt={`Slide ${slide.position + 1}`} className="w-full aspect-[9/16] object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white font-medium">Slide {slide.position + 1}</span>
                    </div>
                  </div>)}
              </div> : <p className="text-muted-foreground text-center py-8">No interactive slides available</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={imageSlidesDialog} onOpenChange={setImageSlidesDialog}>
        <DialogContent className="max-w-6xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Image Slides</DialogTitle>
            <DialogDescription>
              Thumbnail preview of all image slides in this deck
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto">
            {loadingImageSlides ? <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div> : imageSlides.length > 0 ? <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {imageSlides.map(slide => <div key={slide.id} className="relative group border rounded-lg overflow-hidden hover:border-primary transition-colors">
                    <img src={slide.content_url} alt={`Slide ${slide.position + 1}`} className="w-full aspect-[9/16] object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white font-medium">Slide {slide.position + 1}</span>
                    </div>
                  </div>)}
              </div> : <p className="text-muted-foreground text-center py-8">No image slides available</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>;
};
export default Index;