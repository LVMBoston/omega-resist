import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Plus, Star, Trash2, UserCog, LogIn, LogOut, FileDown, X, RefreshCw, Calendar, Clock, Building2, GripVertical } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  display_order: number;
  slide_count: number;
  interactive_count: number;
  mobilize_org_count: number;
  campaigns: Array<{ code: string; title: string; id: string; description?: string }>;
  first_slide_url?: string;
}

interface CampaignDetails {
  id: string;
  title: string;
  code: string;
  description?: string;
  created_at: string;
  events: Array<{
    id: string;
    title: string;
    type: string;
    start_date?: string;
    end_date?: string;
  }>;
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
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetails | null>(null);
  const navigate = useNavigate();
  const {
    user,
    userRole,
    signOut
  } = useAuth();
  useEffect(() => {
    fetchDecks();
  }, []);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setDecks((items) => {
        const oldIndex = items.findIndex((item) => item.slug === active.id);
        const newIndex = items.findIndex((item) => item.slug === over.id);
        
        const reorderedItems = arrayMove(items, oldIndex, newIndex);
        
        // Save the new order to database
        reorderedItems.forEach(async (deck, index) => {
          await supabase
            .from('decks')
            .update({ display_order: index })
            .eq('slug', deck.slug);
        });
        
        return reorderedItems;
      });
    }
  };

  const fetchDecks = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      }

      // Fetch all decks
      const {
        data: decksData,
        error: decksError
      } = await supabase.from("decks").select("slug, created_at, updated_at, display_order").order("display_order", {
        ascending: true
      }).order("created_at", {
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
        
        // Get first slide for preview (prefer thumbnail_url for interactive slides)
        const { data: firstSlide } = await supabase
          .from("slide_items")
          .select("content_url, type, viral_slide_configs!slide_items_template_id_fkey(thumbnail_url)")
          .eq("deck_slug", deck.slug)
          .order("position")
          .limit(1)
          .single();
        
        const firstSlideUrl = firstSlide
          ? ((firstSlide as any).viral_slide_configs?.thumbnail_url || firstSlide.content_url)
          : undefined;
        
        return {
          slug: deck.slug,
          created_at: deck.created_at,
          updated_at: deck.updated_at,
          display_order: deck.display_order,
          slide_count: count || 0,
          interactive_count: interactiveCount || 0,
          mobilize_org_count: uniqueMobilizeCodes.size,
          campaigns: uniqueCampaigns,
          first_slide_url: firstSlideUrl,
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

  const fetchCampaignDetails = async (campaignId: string) => {
    try {
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();

      if (campaignError) throw campaignError;

      const { data: events, error: eventsError } = await supabase
        .from("events_actions")
        .select("id, title, type, start_date, end_date")
        .eq("campaign_id", campaignId);

      if (eventsError) throw eventsError;

      setSelectedCampaign({
        ...campaign,
        events: events || [],
      });
      setCampaignDialogOpen(true);
    } catch (error) {
      console.error("Error fetching campaign details:", error);
      toast.error("Failed to load campaign details");
    }
  };

  
  const handleDelete = async (slug: string) => {
    if (!confirm(`Delete deck "${slug}"? This will also delete all associated slides.`)) {
      return;
    }
    try {
      // Delete viral slide configs that belong to this deck (per-deck configs only, not shared repository templates)
      const {
        error: viralConfigsError
      } = await supabase.from("viral_slide_configs").delete().eq("deck_slug", slug).not("slide_id", "is", null);
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
            <p className="text-sm text-muted-foreground mt-1">Add interactive slides, rearrange slides, add & remove slides. To edit an interactive slide use "Interactive Slide Editor"</p>
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
          </div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={decks.map(d => d.slug)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {decks.map(deck => (
                  <SortableDeckCard 
                    key={deck.slug} 
                    deck={deck} 
                    onExportPDF={handleExportPDF} 
                    onDelete={handleDelete} 
                    onShowInteractiveImage={handleShowInteractiveImage} 
                    onShowImageSlides={handleShowImageSlides} 
                    onShowCampaignDetails={fetchCampaignDetails}
                    formatDate={formatDate} 
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>}
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

      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent className="max-w-2xl">
          {selectedCampaign && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-1">{selectedCampaign.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">utm_campaign: {selectedCampaign.code}</p>
                  </div>
                </div>
                {selectedCampaign.description && (
                  <CardDescription className="mt-2">{selectedCampaign.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Events: Total / Active</p>
                    <p className="text-2xl font-bold">{selectedCampaign.events.length} / {selectedCampaign.events.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Actions: Total / Active</p>
                    <p className="text-2xl font-bold">0 / 0</p>
                  </div>
                </div>
                
                {selectedCampaign.events.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Events & Actions</h3>
                    {selectedCampaign.events.map(event => (
                      <div key={event.id} className="p-3 border rounded-md">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{event.title}</p>
                            <p className="text-sm text-muted-foreground">{event.type}</p>
                            {event.start_date && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(event.start_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/campaign/${selectedCampaign.id}`)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>
    </div>;
};

interface SortableDeckCardProps {
  deck: DeckWithSlides;
  onExportPDF: (slug: string) => void;
  onRemoveInteractive: (slug: string) => void;
  onDelete: (slug: string) => void;
  onShowInteractiveImage: (slug: string) => void;
  onShowImageSlides: (slug: string) => void;
  onShowCampaignDetails: (campaignId: string) => void;
  formatDate: (date: string) => string;
}

const SortableDeckCard = ({ deck, onExportPDF, onRemoveInteractive, onDelete, onShowInteractiveImage, onShowImageSlides, onShowCampaignDetails, formatDate }: SortableDeckCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deck.slug });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <Link to={`/deck-editor/${deck.slug}`} className="hover:underline flex-1">
            {deck.slug}
          </Link>
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardTitle>
        <CardDescription className="text-xs mt-1">
          Deck Slug: {deck.slug}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-4">
          <div className="flex-1 space-y-3">
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
                            <Badge 
                              key={campaign.id} 
                              variant="secondary" 
                              className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                              onClick={() => onShowCampaignDetails(campaign.id)}
                            >
                              {campaign.title}
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
                          onClick={() => onShowImageSlides(deck.slug)} 
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
                          onClick={() => onShowInteractiveImage(deck.slug)} 
                          className="hover:underline text-primary font-medium cursor-pointer"
                        >
                          {deck.interactive_count}
                        </button>
                      ) : (
                        <p className="font-medium">{deck.interactive_count}</p>
                      )}
                    </div>
                  </div>
                </div>
          {deck.first_slide_url && (
            <div className="w-36 h-48 flex-shrink-0 rounded-md overflow-hidden border bg-muted">
              {deck.first_slide_url.startsWith('solid:') ? (
                <div className="w-full h-full" style={{ backgroundColor: deck.first_slide_url.replace('solid:', '') }} />
              ) : (
                <img 
                  src={deck.first_slide_url} 
                  alt="First slide preview" 
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onExportPDF(deck.slug)}
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
                        onClick={() => onRemoveInteractive(deck.slug)}
                        title="Remove interactive pages"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => onDelete(deck.slug)}
                      title="Delete deck"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
        </CardFooter>
      </Card>
  );
};

export default Index;