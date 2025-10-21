import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Plus, Star, Trash2, UserCog, LogIn, LogOut, FileDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
interface DeckWithSlides {
  slug: string;
  created_at: string;
  slide_count: number;
  interactive_count: number;
}
const Index = () => {
  const [decks, setDecks] = useState<DeckWithSlides[]>([]);
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [googleSlidesUrl, setGoogleSlidesUrl] = useState("");
  const [deckSlug, setDeckSlug] = useState("");
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();
  const {
    user,
    userRole,
    signOut
  } = useAuth();
  useEffect(() => {
    fetchDecks();
  }, []);
  const fetchDecks = async () => {
    try {
      // Fetch all decks
      const {
        data: decksData,
        error: decksError
      } = await supabase.from("decks").select("slug, created_at").order("created_at", {
        ascending: false
      });
      if (decksError) throw decksError;

      // Fetch slide counts for each deck
      const decksWithCounts = await Promise.all((decksData || []).map(async deck => {
        const {
          count
        } = await supabase.from("slide_items").select("*", {
          count: "exact",
          head: true
        }).eq("deck_slug", deck.slug);
        const {
          count: interactiveCount
        } = await supabase.from("slide_items").select("*", {
          count: "exact",
          head: true
        }).eq("deck_slug", deck.slug).eq("type", "spread-word");
        return {
          slug: deck.slug,
          created_at: deck.created_at,
          slide_count: count || 0,
          interactive_count: interactiveCount || 0
        };
      }));
      setDecks(decksWithCounts);
    } catch (error) {
      console.error("Error fetching decks:", error);
      toast.error("Failed to load decks");
    } finally {
      setLoading(false);
    }
  };
  const handleRemoveInteractive = async (slug: string) => {
    if (!confirm(`Remove all interactive pages from deck "${slug}"?`)) {
      return;
    }
    try {
      // Get all interactive slides for this deck
      const { data: interactiveSlides, error: fetchError } = await supabase
        .from("slide_items")
        .select("id")
        .eq("deck_slug", slug)
        .eq("type", "spread-word");

      if (fetchError) throw fetchError;

      // Delete viral slide configs for these slides
      if (interactiveSlides && interactiveSlides.length > 0) {
        const slideIds = interactiveSlides.map(s => s.id);
        const { error: viralConfigsError } = await supabase
          .from("viral_slide_configs")
          .delete()
          .in("slide_id", slideIds);
        
        if (viralConfigsError) throw viralConfigsError;

        // Delete the interactive slides
        const { error: slidesError } = await supabase
          .from("slide_items")
          .delete()
          .eq("deck_slug", slug)
          .eq("type", "spread-word");
        
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
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }) + " " + date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }) + " EDT";
  };
  return <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="w-full px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Omega</h1>
            <p className="text-sm text-muted-foreground mt-1">Viral Deck Management</p>
          </div>
          <div className="flex items-center gap-2">
            {user ? <>
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-sm text-muted-foreground">{user.email}</span>
                  {userRole && <Badge variant="outline">{userRole}</Badge>}
                </div>
                {userRole === "admin" && <Button onClick={() => navigate("/admin")} variant="outline">
                    <UserCog className="h-4 w-4 mr-2" />
                    Admin
                  </Button>}
                <Button onClick={() => navigate("/manage")} variant="outline">
                  Manage Decks
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
                <Button onClick={() => navigate("/build")}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Deck
                </Button>
                <Button onClick={signOut} variant="ghost" size="icon">
                  <LogOut className="h-4 w-4" />
                </Button>
              </> : <Button onClick={() => navigate("/auth")}>
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Button>}
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-8">
        {loading ? <div className="text-center py-12">
            <p className="text-muted-foreground">Loading decks...</p>
          </div> : decks.length === 0 ? <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No decks found. Create your first deck to get started.</p>
            <Button onClick={() => navigate("/build")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Deck
            </Button>
          </div> : <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deck Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-center"># Image Slides</TableHead>
                <TableHead className="text-center"># Interactive Pages</TableHead>
                <TableHead className="text-center">Export</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decks.map(deck => <TableRow key={deck.slug}>
                  <TableCell>
                    <Link to={`/deck/${deck.slug}`} target="_blank" rel="noopener noreferrer" className="hover:underline font-medium">
                      {deck.slug}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(deck.created_at)}
                  </TableCell>
                  <TableCell className="text-center">{deck.slide_count}</TableCell>
                  <TableCell className="text-center">{deck.interactive_count}</TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" onClick={() => handleExportPDF(deck.slug)} title="Export to PDF">
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {deck.interactive_count > 0 && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleRemoveInteractive(deck.slug)} 
                          title="Remove interactive pages"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(deck.slug)} title="Delete deck">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>)}
            </TableBody>
          </Table>}
      </main>
    </div>;
};
export default Index;