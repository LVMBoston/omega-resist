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

interface Template {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  hotspots: any[];
  is_default: boolean;
}

export default function DeckManager() {
  const [decks, setDecks] = useState<DeckOption[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string>("");
  const [deckName, setDeckName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [addSpreadWord, setAddSpreadWord] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showHotspotEditor, setShowHotspotEditor] = useState(false);
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  useEffect(() => {
    fetchDecks();
    fetchTemplates();
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

  const fetchTemplates = async () => {
    const {
      data,
      error
    } = await supabase.from("viral_slide_configs").select("*").is("slide_id", null).order("is_default", { ascending: false });
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load templates",
        variant: "destructive"
      });
    } else {
      const templates = (data || []) as Template[];
      setTemplates(templates);
      // Auto-select default template
      const defaultTemplate = templates.find(t => t.is_default);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate.id);
      }
    }
  };

  useEffect(() => {
    if (selectedDeck) {
      setDeckName(selectedDeck);
    }
  }, [selectedDeck]);
  const handleApplyAdditions = async () => {
    if (!selectedDeck || !addSpreadWord) {
      toast({
        title: "Nothing to add",
        description: "Please select a deck and enable Spread the Word",
        variant: "destructive"
      });
      return;
    }
    if (!selectedTemplate) {
      toast({
        title: "Template required",
        description: "Please select a template",
        variant: "destructive"
      });
      return;
    }

    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) return;

    // Create the slide and link it to the template
    const {
      data: slides,
      error: slidesError
    } = await supabase.from("slide_items").select("position").eq("deck_slug", selectedDeck).order("position", {
      ascending: false
    }).limit(1);
    const nextPosition = slides && slides.length > 0 ? slides[0].position + 1 : 1;
    
    const {
      data: newSlide,
      error: slideError
    } = await supabase.from("slide_items").insert({
      deck_slug: selectedDeck,
      type: "spread-word",
      content_url: template.image_url,
      position: nextPosition,
      is_compressed: false,
      template_id: selectedTemplate
    }).select().single();

    if (slideError || !newSlide) {
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
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Configure templates in</span>
                      <Link to="/settings?tab=interactive-pages" className="text-primary hover:underline">
                        Settings → Interactive Pages
                      </Link>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="template-select">Select Template</Label>
                      <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                        <SelectTrigger id="template-select">
                          <SelectValue placeholder="Choose a template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map(template => <SelectItem key={template.id} value={template.id}>
                              {template.name} {template.is_default && "(Default)"}
                            </SelectItem>)}
                        </SelectContent>
                      </Select>
                      {selectedTemplate && <div className="mt-2">
                          <img src={templates.find(t => t.id === selectedTemplate)?.image_url} alt="Template preview" className="max-w-xs rounded border" />
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