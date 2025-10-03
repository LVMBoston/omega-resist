import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FullResolutionHotspotEditor } from "@/components/FullResolutionHotspotEditor";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronLeft, Upload } from "lucide-react";
import { Link } from "react-router-dom";
interface DeckOption {
  slug: string;
  created_at: string;
}
export default function DeckManager() {
  const [decks, setDecks] = useState<DeckOption[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string>("");
  const [deckName, setDeckName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [addSpreadWord, setAddSpreadWord] = useState(false);
  const [viralImageUrl, setViralImageUrl] = useState<string>("");
  const [viralImageFile, setViralImageFile] = useState<File | null>(null);
  const [showHotspotEditor, setShowHotspotEditor] = useState(false);
  const [hotspots, setHotspots] = useState<any[]>([]);
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  useEffect(() => {
    fetchDecks();
  }, []);
  const fetchDecks = async () => {
    const {
      data,
      error
    } = await supabase.from("decks").select("slug, created_at").order("created_at", {
      ascending: false
    });
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load decks",
        variant: "destructive"
      });
    } else {
      setDecks(data || []);
    }
    setLoading(false);
  };
  useEffect(() => {
    if (selectedDeck) {
      setDeckName(selectedDeck);
    }
  }, [selectedDeck]);
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setViralImageFile(file);
    const reader = new FileReader();
    reader.onload = e => {
      setViralImageUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };
  const uploadViralImage = async (): Promise<string | null> => {
    if (!viralImageFile) return null;
    const fileName = `${Date.now()}-${viralImageFile.name}`;
    const {
      data,
      error
    } = await supabase.storage.from("slides").upload(fileName, viralImageFile);
    if (error) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
      return null;
    }
    const {
      data: urlData
    } = supabase.storage.from("slides").getPublicUrl(data.path);
    return urlData.publicUrl;
  };
  const handleApplyAdditions = async () => {
    if (!selectedDeck || !addSpreadWord) {
      toast({
        title: "Nothing to add",
        description: "Please select a deck and enable Spread the Word",
        variant: "destructive"
      });
      return;
    }
    if (!viralImageUrl) {
      toast({
        title: "Image required",
        description: "Please upload a viral slide image",
        variant: "destructive"
      });
      return;
    }
    setShowHotspotEditor(true);
  };
  const handleSaveViralSlide = async (finalHotspots: any[]) => {
    if (!selectedDeck) return;
    const publicImageUrl = await uploadViralImage();
    if (!publicImageUrl) return;
    const viralSlug = `viral-${selectedDeck}-${Date.now()}`;
    const {
      error: configError
    } = await supabase.from("viral_slide_configs").insert({
      slug: viralSlug,
      deck_slug: selectedDeck,
      image_url: publicImageUrl,
      hotspots: finalHotspots
    });
    if (configError) {
      toast({
        title: "Error",
        description: "Failed to save viral slide config",
        variant: "destructive"
      });
      return;
    }
    const {
      data: slides,
      error: slidesError
    } = await supabase.from("slide_items").select("position").eq("deck_slug", selectedDeck).order("position", {
      ascending: false
    }).limit(1);
    const nextPosition = slides && slides.length > 0 ? slides[0].position + 1 : 1;
    const {
      error: slideError
    } = await supabase.from("slide_items").insert({
      deck_slug: selectedDeck,
      type: "spread-word",
      content_url: publicImageUrl,
      position: nextPosition,
      is_compressed: false
    });
    if (slideError) {
      toast({
        title: "Error",
        description: "Failed to add slide to deck",
        variant: "destructive"
      });
      return;
    }
    toast({
      title: "Success",
      description: "Spread the Word slide added to deck"
    });
    navigate(`/deck/${selectedDeck}`);
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>;
  }
  if (showHotspotEditor && viralImageUrl) {
    return <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setShowHotspotEditor(false)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="text-2xl font-bold">Edit Hotspots</h1>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-6 py-8">
          <FullResolutionHotspotEditor imageUrl={viralImageUrl} initialHotspots={hotspots} onSave={handleSaveViralSlide} />
        </main>
      </div>;
  }
  return <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Manage Decks</h1>
              <p className="text-sm text-muted-foreground">
                Select and manage existing deck configurations
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-6 space-y-6">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">
                {selectedDeck ? <>
                    <span className="text-primary">{selectedDeck}</span> with 7 PNGs and 0
                    Interactive pages
                  </> : "Select a deck to manage"}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Select Deck</Label>
                <Select value={selectedDeck} onValueChange={setSelectedDeck}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a deck" />
                  </SelectTrigger>
                  <SelectContent>
                    {decks.map(deck => <SelectItem key={deck.slug} value={deck.slug}>
                        {deck.slug}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Deck Name</Label>
                <Input value={deckName} onChange={e => setDeckName(e.target.value)} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Append Interactive pages to {selectedDeck || "deck"}</h3>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox id="spread-word" checked={addSpreadWord} onCheckedChange={checked => setAddSpreadWord(checked as boolean)} />
                  <Label htmlFor="spread-word">Spread the Word</Label>
                </div>

                {addSpreadWord && <div className="ml-6 space-y-3">
                    <p className="text-sm text-muted-foreground">Open ViralSlide</p>
                    <div className="space-y-2">
                      <Label htmlFor="viral-upload">Upload a "Spread the Word" Image</Label>
                      <Input id="viral-upload" type="file" accept="image/*" onChange={handleFileUpload} />
                      {viralImageUrl && <div className="mt-2">
                          <img src={viralImageUrl} alt="Viral slide preview" className="max-w-xs rounded border" />
                        </div>}
                    </div>
                  </div>}

                <div className="flex items-center space-x-2">
                  <Checkbox id="survey" />
                  <Label htmlFor="survey">Survey</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox id="analytics" />
                  <Label htmlFor="analytics">Interactive Analytics</Label>
                </div>
              </div>
            </div>

            <Button onClick={handleApplyAdditions} className="w-full">
              Apply Additions
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>;
}