import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatFloatingLocalTime } from "@/lib/dateUtils";
import { Loader2, Plus, Trash2, Edit2, ArrowLeft, Package, Eye, X, ArrowUpDown, ArrowUp, ArrowDown, QrCode, Download, Copy, Check, CheckCircle2, AlertCircle, Lock, FileJson, Settings, Columns } from "lucide-react";
import EoaForm from "@/components/EoaForm";
import { QRCodeSVG } from "qrcode.react";
import { mintL00 } from "@/lib/virality/mint";
import { shortenUrlsBatch } from "@/lib/virality/shortener";
import { TokenDisplay } from "@/components/TokenDisplay";
import { QrDefaultsDialog } from "@/components/QrDefaultsDialog";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  RowSelectionState,
} from "@tanstack/react-table";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
interface Campaign {
  id: string;
  code: string;
  title: string;
}
interface EventAction {
  id: string;
  campaign_id: string;
  mobilize_id: string | null;
  mobilize_code: string | null;
  utm_id: string;
  title: string;
  site_name: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  type: string;
  start_date: string | null;
  end_date: string | null;
  timezone: string | null;
  assigned_deck_slug: string | null;
  description: string | null;
  utm_content: string | null;
}
export default function CampaignEoaManager() {
  const {
    campaignId
  } = useParams();
  const navigate = useNavigate();
  const {
    userRole
  } = useAuth();
  const {
    toast
  } = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [eoas, setEoas] = useState<EventAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEoa, setEditingEoa] = useState<EventAction | null>(null);
  const [payloadDialogOpen, setPayloadDialogOpen] = useState(false);
  const [visualizePayloadDialogOpen, setVisualizePayloadDialogOpen] = useState(false);
  const [qrDefaultsDialogOpen, setQrDefaultsDialogOpen] = useState(false);
  const [selectedEoa, setSelectedEoa] = useState<EventAction | null>(null);
  const [bulkDeckSlug, setBulkDeckSlug] = useState("");
  const [bulkUtmId, setBulkUtmId] = useState("");
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [generatingL00, setGeneratingL00] = useState<string | null>(null);
  const [l00Tokens, setL00Tokens] = useState<Record<string, { 
    token: string; 
    url: string; 
    shortUrl?: string; 
    shorteningInProgress?: boolean;
  }>>({});
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [selectedTokenForDisplay, setSelectedTokenForDisplay] = useState<{
    token: string;
    url: string;
    shortUrl?: string;
    eoaTitle: string;
  } | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const { columnVisibility, setColumnVisibility } = useColumnVisibility();
  const [bulkDeckDialogOpen, setBulkDeckDialogOpen] = useState(false);
  const [bulkDeckInput, setBulkDeckInput] = useState("");
  const [bulkStartDate, setBulkStartDate] = useState("");
  const [bulkEndDate, setBulkEndDate] = useState("");
  const [availableDecks, setAvailableDecks] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [availableTemplates, setAvailableTemplates] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [deckSlides, setDeckSlides] = useState<Record<string, Array<{ id: string; position: number; type: string; content_url: string }>>>({});
  // First view times per mobilize_code (or per individual EoA if no mobilize_code)
  const [firstViewTimes, setFirstViewTimes] = useState<Record<string, string>>({});
  
  useEffect(() => {
    if (campaignId) {
      fetchData();
    }
  }, [campaignId]);

  useEffect(() => {
    fetchAvailableDecks();
    fetchAvailableTemplates();
  }, []);
  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchCampaign(), fetchEoas(), fetchExistingTokens(), fetchDeckSlides(), fetchFirstViewTimes()]);
    setLoading(false);
  };

  const fetchDeckSlides = async () => {
    // Get all unique deck slugs from eoas
    const deckSlugs = [...new Set(eoas.map(eoa => eoa.assigned_deck_slug).filter(Boolean))];
    
    if (deckSlugs.length === 0) return;

    const { data, error } = await supabase
      .from("slide_items")
      .select("id, deck_slug, position, type, content_url")
      .in("deck_slug", deckSlugs)
      .order("position", { ascending: true });

    if (error) {
      console.error("Failed to fetch deck slides:", error);
    } else if (data) {
      // Group slides by deck_slug
      const slidesByDeck: Record<string, Array<{ id: string; position: number; type: string; content_url: string }>> = {};
      data.forEach(slide => {
        if (!slidesByDeck[slide.deck_slug]) {
          slidesByDeck[slide.deck_slug] = [];
        }
        slidesByDeck[slide.deck_slug].push(slide);
      });
      setDeckSlides(slidesByDeck);
    }
  };

  const fetchAvailableDecks = async () => {
    const { data, error } = await supabase
      .from("decks")
      .select("slug")
      .order("slug", { ascending: true });

    if (error) {
      console.error("Failed to fetch decks:", error);
    } else if (data) {
      setAvailableDecks(data.map(d => d.slug));
    }
  };

  const fetchAvailableTemplates = async () => {
    const { data, error } = await supabase
      .from("viral_slide_configs")
      .select("id, name, slug")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch templates:", error);
    } else if (data) {
      setAvailableTemplates(data);
    }
  };

  const fetchExistingTokens = async () => {
    const { data, error } = await supabase
      .from("tokens")
      .select("eoa_id, token, full_url")
      .eq("level", 0)
      .is("parent_token", null); // Only base L00 tokens, not :legacy instances

    if (error) {
      console.error("Failed to fetch tokens:", error);
    } else if (data) {
      // Fetch shortened URLs for all full URLs
      const { data: shortUrls, error: shortError } = await supabase
        .from("shortened_urls")
        .select("full_url, short_code")
        .in("full_url", data.map(t => t.full_url));

      if (shortError) {
        console.error("Failed to fetch shortened URLs:", shortError);
      }

      // Create map of full_url -> short_code
      const shortUrlMap = new Map<string, string>();
      shortUrls?.forEach(su => {
        shortUrlMap.set(su.full_url, `https://omega-resist.lovable.app/s/${su.short_code}`);
      });

      const tokenMap: Record<string, { token: string; url: string; shortUrl?: string }> = {};
      data.forEach(t => {
        tokenMap[t.eoa_id] = { 
          token: t.token, 
          url: t.full_url,
          shortUrl: shortUrlMap.get(t.full_url)
        };
      });
      setL00Tokens(tokenMap);
    }
  };
  const fetchCampaign = async () => {
    const {
      data,
      error
    } = await supabase.from("campaigns").select("id, code, title").eq("id", campaignId).single();
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch campaign: " + error.message
      });
      navigate("/campaigns");
    } else {
      setCampaign(data);
    }
  };
  const fetchEoas = async () => {
    const {
      data,
      error
    } = await supabase.from("events_actions").select("*").eq("campaign_id", campaignId).order("zip_code", {
      ascending: true
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch events/actions: " + error.message
      });
    } else {
      setEoas(data || []);
      // Fetch slides after eoas are updated
      if (data && data.length > 0) {
        const deckSlugs = [...new Set(data.map(eoa => eoa.assigned_deck_slug).filter(Boolean))];
        if (deckSlugs.length > 0) {
          const { data: slideData, error: slideError } = await supabase
            .from("slide_items")
            .select("id, deck_slug, position, type, content_url")
            .in("deck_slug", deckSlugs)
            .order("position", { ascending: true });

          if (slideError) {
            console.error("Failed to fetch deck slides:", slideError);
          } else if (slideData) {
            const slidesByDeck: Record<string, Array<{ id: string; position: number; type: string; content_url: string }>> = {};
            slideData.forEach(slide => {
              if (!slidesByDeck[slide.deck_slug]) {
                slidesByDeck[slide.deck_slug] = [];
              }
              slidesByDeck[slide.deck_slug].push(slide);
            });
            setDeckSlides(slidesByDeck);
          }
        }
      }
    }
  };

  // Fetch first view times per mobilize_code group (or per individual EoA without code)
  const fetchFirstViewTimes = async () => {
    if (!campaignId) return;

    // Get all EoAs for this campaign with their mobilize_codes
    const { data: campaignEoas, error: eoaError } = await supabase
      .from("events_actions")
      .select("id, mobilize_code")
      .eq("campaign_id", campaignId);

    if (eoaError || !campaignEoas?.length) return;

    const results: Record<string, string> = {};
    
    // Group EoAs by mobilize_code
    const mobilizeCodes = [...new Set(campaignEoas.map(e => e.mobilize_code).filter(Boolean))] as string[];
    const eoaIdsWithoutCode = campaignEoas.filter(e => !e.mobilize_code).map(e => e.id);

    // For EoAs with mobilize_code, find first view across EoAs sharing that code WITHIN THIS CAMPAIGN ONLY
    if (mobilizeCodes.length > 0) {
      // Group campaign EoAs by mobilize_code (only EoAs in this campaign)
      const eoaIdsByCode: Record<string, string[]> = {};
      campaignEoas.forEach(eoa => {
        if (eoa.mobilize_code) {
          if (!eoaIdsByCode[eoa.mobilize_code]) {
            eoaIdsByCode[eoa.mobilize_code] = [];
          }
          eoaIdsByCode[eoa.mobilize_code].push(eoa.id);
        }
      });

      // For each mobilize_code group, find the earliest view event
      for (const code of mobilizeCodes) {
        const eoaIdsForCode = eoaIdsByCode[code] || [];
        if (eoaIdsForCode.length === 0) continue;

        // Get tokens for these EoAs
        const { data: tokens } = await supabase
          .from("tokens")
          .select("token")
          .in("eoa_id", eoaIdsForCode)
          .eq("is_simulated", false);

        if (!tokens?.length) continue;

        const tokenList = tokens.map(t => t.token);

        // Find earliest view event
        const { data: events } = await supabase
          .from("url_events")
          .select("occurred_at")
          .in("token", tokenList)
          .eq("event_type", "view")
          .eq("is_simulated", false)
          .order("occurred_at", { ascending: true })
          .limit(1);

        if (events?.length) {
          results[code] = events[0].occurred_at;
        }
      }
    }

    // For EoAs without mobilize_code, find first view for each individually
    for (const eoaId of eoaIdsWithoutCode) {
      const { data: tokens } = await supabase
        .from("tokens")
        .select("token")
        .eq("eoa_id", eoaId)
        .eq("is_simulated", false);

      if (!tokens?.length) continue;

      const tokenList = tokens.map(t => t.token);

      const { data: events } = await supabase
        .from("url_events")
        .select("occurred_at")
        .in("token", tokenList)
        .eq("event_type", "view")
        .eq("is_simulated", false)
        .order("occurred_at", { ascending: true })
        .limit(1);

      if (events?.length) {
        results[`eoa_${eoaId}`] = events[0].occurred_at;
      }
    }

    setFirstViewTimes(results);
  };

  // Get first view time for an EoA (from mobilize_code group or individual)
  const getFirstViewTime = (eoa: EventAction): string | null => {
    if (eoa.mobilize_code) {
      return firstViewTimes[eoa.mobilize_code] || null;
    }
    return firstViewTimes[`eoa_${eoa.id}`] || null;
  };
  const deleteEoa = async (id: string) => {
    const {
      error
    } = await supabase.from("events_actions").delete().eq("id", id);
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete event/action: " + error.message
      });
    } else {
      toast({
        title: "Success",
        description: "Event/Action deleted"
      });
      fetchEoas();
    }
  };

  const duplicateEoa = async (eoa: EventAction) => {
    const { error } = await supabase.from("events_actions").insert({
      campaign_id: eoa.campaign_id,
      mobilize_id: eoa.mobilize_id,
      mobilize_code: eoa.mobilize_code,
      utm_id: "", // Blanked out as requested
      title: eoa.title + " (Copy)",
      site_name: eoa.site_name,
      city: eoa.city,
      state: eoa.state,
      zip_code: eoa.zip_code,
      type: eoa.type,
      start_date: eoa.start_date,
      end_date: eoa.end_date,
      timezone: eoa.timezone,
      assigned_deck_slug: eoa.assigned_deck_slug,
      description: eoa.description,
      utm_content: eoa.utm_content,
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to duplicate event/action: " + error.message
      });
    } else {
      toast({
        title: "Success",
        description: "Event/Action duplicated with blank utm_id"
      });
      fetchEoas();
    }
  };
  // Format floating local time using shared utility
  const formatDateTime = (date: string | null) => {
    if (!date) return "—";
    return formatFloatingLocalTime(date);
  };

  // Derive selectedRows from rowSelection (one-way sync to avoid circular dependency)
  const selectedRowsSet = new Set(
    Object.keys(rowSelection).filter(id => rowSelection[id])
  );

  const clearSelection = () => {
    setRowSelection({});
    setShowBulkActions(false);
    setBulkDeckSlug("");
    setBulkUtmId("");
    setBulkStartDate("");
    setBulkEndDate("");
  };

  const handleGenerateL00 = async (eoa: EventAction) => {
    if (!eoa.assigned_deck_slug) {
      toast({
        title: "Missing Deck Assignment",
        description: "Please assign a deck before generating L00 token",
        variant: "destructive",
      });
      return;
    }

    if (!eoa.mobilize_code) {
      toast({
        title: "Missing Mobilize Code",
        description: "Please add a Mobilize Code before generating L00 token",
        variant: "destructive",
      });
      return;
    }

    setGeneratingL00(eoa.id);
    
    // Mark as shortening in progress
    setL00Tokens(prev => ({
      ...prev,
      [eoa.id]: { 
        token: "", 
        url: "", 
        shorteningInProgress: true 
      }
    }));

    try {
      // Lazy shortening: get token immediately, shorten in background
      const result = await mintL00(
        {
          eoaId: eoa.id,
          deckSlug: eoa.assigned_deck_slug,
          utmMedium: "qr"
        },
        {
          lazy: true,
          onShortened: (shortUrl) => {
            // Update with short URL when ready
            setL00Tokens(prev => {
              const updated = {
                ...prev,
                [eoa.id]: { 
                  ...prev[eoa.id],
                  shortUrl,
                  shorteningInProgress: false
                }
              };
              
              // Update the dialog if it's showing this token
              setSelectedTokenForDisplay(prevDisplay => {
                if (prevDisplay && prevDisplay.token === updated[eoa.id].token) {
                  return { ...prevDisplay, shortUrl };
                }
                return prevDisplay;
              });
              
              return updated;
            });
            
            toast({
              title: "Short URL Ready",
              description: shortUrl,
            });
          }
        }
      );

      // Immediately update with token and full URL
      setL00Tokens(prev => ({
        ...prev,
        [eoa.id]: { 
          token: result.token, 
          url: result.full_url,
          shorteningInProgress: true // Still shortening in background
        }
      }));

      // Automatically open the TokenDisplay dialog
      setSelectedTokenForDisplay({
        token: result.token,
        url: result.full_url,
        eoaTitle: eoa.title
      });

      toast({
        title: "L00 Token Generated",
        description: `Token: ${result.token} (shortening URL...)`,
      });
    } catch (error: any) {
      setL00Tokens(prev => {
        const updated = { ...prev };
        delete updated[eoa.id];
        return updated;
      });
      
      toast({
        title: "Error Generating Token",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingL00(null);
    }
  };

  const handleGenerateAllL00 = async () => {
    // Filter out already minted and validate requirements for ALL rows
    const readyToMint = eoas.filter(eoa => {
      const alreadyMinted = !!l00Tokens[eoa.id];
      const hasRequirements = !!eoa.mobilize_code && !!eoa.assigned_deck_slug;
      return !alreadyMinted && hasRequirements;
    });

    if (readyToMint.length === 0) {
      toast({
        title: "No Tokens to Generate",
        description: "All rows are either already minted or missing required fields (Mobilize Code, Deck)",
        variant: "destructive",
      });
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const urlsToShorten: { eoaId: string; fullUrl: string }[] = [];

    // Step 1: Mint all tokens (fast, no shortening)
    toast({
      title: "Generating Tokens...",
      description: `Processing ${readyToMint.length} tokens`,
    });

    for (const eoa of readyToMint) {
      try {
        const result = await mintL00(
          {
            eoaId: eoa.id,
            deckSlug: eoa.assigned_deck_slug!,
            utmMedium: "qr"
          },
          { lazy: false } // Don't shorten yet, batch it later
        );

        setL00Tokens(prev => ({
          ...prev,
          [eoa.id]: { 
            token: result.token, 
            url: result.full_url,
            shorteningInProgress: true
          }
        }));

        urlsToShorten.push({ eoaId: eoa.id, fullUrl: result.full_url });
        successCount++;
      } catch (error: any) {
        console.error(`Failed to mint L00 for ${eoa.title}:`, error);
        errorCount++;
      }
    }

    // Step 2: Batch shorten all URLs in parallel
    if (urlsToShorten.length > 0) {
      toast({
        title: "Shortening URLs...",
        description: `Processing ${urlsToShorten.length} URLs in parallel`,
      });

      const fullUrls = urlsToShorten.map(item => item.fullUrl);
      const shortUrlMap = await shortenUrlsBatch(fullUrls);

      // Update state with short URLs
      setL00Tokens(prev => {
        const updated = { ...prev };
        urlsToShorten.forEach(({ eoaId, fullUrl }) => {
          if (updated[eoaId]) {
            updated[eoaId].shortUrl = shortUrlMap.get(fullUrl);
            updated[eoaId].shorteningInProgress = false;
          }
        });
        return updated;
      });
    }

    toast({
      title: "Bulk Generation Complete",
      description: `Generated ${successCount} tokens${errorCount > 0 ? `, ${errorCount} failed` : ""}`,
    });

    clearSelection();
  };

  const handleBulkGenerateL00 = async () => {
    const selectedEoas = eoas.filter(eoa => selectedRowsSet.has(eoa.id));
    
    // Filter out already minted and validate requirements
    const readyToMint = selectedEoas.filter(eoa => {
      const alreadyMinted = !!l00Tokens[eoa.id];
      const hasRequirements = !!eoa.mobilize_code && !!eoa.assigned_deck_slug;
      return !alreadyMinted && hasRequirements;
    });

    if (readyToMint.length === 0) {
      toast({
        title: "No Tokens to Generate",
        description: "Selected rows are either already minted or missing required fields (Mobilize Code, Deck)",
        variant: "destructive",
      });
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const urlsToShorten: { eoaId: string; fullUrl: string }[] = [];

    // Step 1: Mint all tokens (fast, no shortening)
    toast({
      title: "Generating Tokens...",
      description: `Processing ${readyToMint.length} tokens`,
    });

    for (const eoa of readyToMint) {
      try {
        const result = await mintL00(
          {
            eoaId: eoa.id,
            deckSlug: eoa.assigned_deck_slug!,
            utmMedium: "qr"
          },
          { lazy: false } // Don't shorten yet, batch it later
        );

        setL00Tokens(prev => ({
          ...prev,
          [eoa.id]: { 
            token: result.token, 
            url: result.full_url,
            shorteningInProgress: true
          }
        }));

        urlsToShorten.push({ eoaId: eoa.id, fullUrl: result.full_url });
        successCount++;
      } catch (error: any) {
        console.error(`Failed to mint L00 for ${eoa.title}:`, error);
        errorCount++;
      }
    }

    // Step 2: Batch shorten all URLs in parallel
    if (urlsToShorten.length > 0) {
      toast({
        title: "Shortening URLs...",
        description: `Processing ${urlsToShorten.length} URLs in parallel`,
      });

      const fullUrls = urlsToShorten.map(item => item.fullUrl);
      const shortUrlMap = await shortenUrlsBatch(fullUrls);

      // Update state with short URLs
      setL00Tokens(prev => {
        const updated = { ...prev };
        urlsToShorten.forEach(({ eoaId, fullUrl }) => {
          if (updated[eoaId]) {
            updated[eoaId].shortUrl = shortUrlMap.get(fullUrl);
            updated[eoaId].shorteningInProgress = false;
          }
        });
        return updated;
      });

      const shortUrlCount = shortUrlMap.size;
      toast({
        title: "Bulk Generation Complete",
        description: `✅ ${successCount} tokens generated\n🔗 ${shortUrlCount} URLs shortened${errorCount > 0 ? `\n❌ ${errorCount} failed` : ''}`,
      });
    }

    if (errorCount > 0 && successCount === 0) {
      toast({
        title: "Bulk Generation Failed",
        description: `Failed to generate ${errorCount} token${errorCount !== 1 ? 's' : ''}`,
        variant: "destructive",
      });
    }
  };

  const handleCopyUrl = (url: string, eoaId: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(eoaId);
    toast({
      title: "URL Copied",
      description: "L00 URL copied to clipboard",
    });
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleDownloadQR = (eoaId: string, title: string) => {
    const tokenData = l00Tokens[eoaId];
    if (!tokenData) return;

    // Generate 4"x4" @ 600 DPI = 2400x2400px for high-quality printing
    const qrSize = 2400;
    const canvas = document.createElement("canvas");
    canvas.width = qrSize;
    canvas.height = qrSize;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) return;

    // Create a temporary container for high-res QR generation
    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.left = "-9999px";
    document.body.appendChild(tempContainer);

    // Dynamically import and render QR at high resolution
    import("qrcode").then((QRCode) => {
      QRCode.toCanvas(canvas, tokenData.url, {
        width: qrSize,
        margin: 1,
        errorCorrectionLevel: "H",
        color: {
          dark: "#000000",
          light: "#FFFFFF"
        }
      }, (error) => {
        document.body.removeChild(tempContainer);
        
        if (error) {
          toast({
            title: "Error",
            description: "Failed to generate QR code",
            variant: "destructive"
          });
          return;
        }

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `L00-${title.replace(/[^a-z0-9]/gi, '-')}-4x4-600dpi.png`;
            a.click();
            URL.revokeObjectURL(url);
            
            toast({
              title: "QR Code Downloaded",
              description: "4\"×4\" @ 600 DPI (2400×2400px)",
            });
          }
        }, "image/png");
      });
    });
  };

  // Define columns for TanStack Table
  const columns: ColumnDef<EventAction>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={`Select ${row.original.title}`}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "mobilize_code",
      header: "Mobilize Code",
      cell: ({ row }) => row.original.mobilize_code || "—",
    },
    {
      accessorKey: "utm_id",
      header: "utm_id",
    },
    {
      accessorKey: "title",
      header: "Event/Action Name",
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
    },
    {
      accessorKey: "site_name",
      header: "Site Name",
      cell: ({ row }) => row.original.site_name || "—",
    },
    {
      accessorKey: "city",
      header: "City",
      cell: ({ row }) => row.original.city || "—",
    },
    {
      accessorKey: "state",
      header: "State",
      cell: ({ row }) => row.original.state || "—",
    },
    {
      accessorKey: "zip_code",
      header: "Zip Code",
      cell: ({ row }) => row.original.zip_code || "—",
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <span className="capitalize">{row.original.type}</span>,
    },
    {
      accessorKey: "start_date",
      header: "Start Date/Time",
      cell: ({ row }) => {
        const firstView = getFirstViewTime(row.original);
        return firstView ? formatDateTime(firstView) : "—";
      },
    },
    {
      accessorKey: "end_date",
      header: "End Date/Time",
      cell: ({ row }) => formatDateTime(row.original.end_date),
    },
    {
      accessorKey: "timezone",
      header: "Timezone",
      cell: ({ row }) => formatTimezone(row.original.timezone),
    },
    {
      accessorKey: "assigned_deck_slug",
      header: "Assigned Deck",
      cell: ({ row }) => row.original.assigned_deck_slug || "—",
    },
    {
      id: "slides",
      header: "Slides",
      cell: ({ row }) => {
        const eoa = row.original;
        if (!eoa.assigned_deck_slug) return <span className="text-muted-foreground">—</span>;
        
        const slides = deckSlides[eoa.assigned_deck_slug] || [];
        
        if (slides.length === 0) {
          return <span className="text-muted-foreground">No Slide</span>;
        }
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary">
                  {slides.length} slide{slides.length !== 1 ? 's' : ''}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  {slides.map(slide => (
                    <div key={slide.id} className="py-0.5">
                      Position {slide.position}: {slide.type}
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
      enableSorting: false,
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const readiness = getMintReadiness(row.original);
        const Icon = readiness.icon;
        return (
          <Badge variant="outline" className={readiness.className}>
            <Icon className="h-3 w-3 mr-1" />
            {readiness.label}
          </Badge>
        );
      },
      enableSorting: false,
    },
    {
      id: "l00_token",
      accessorKey: "l00_token",
      header: "L00 Token",
      cell: ({ row }) => {
        const eoa = row.original;
        return l00Tokens[eoa.id] ? (
          <div className="flex items-center gap-2">
            {l00Tokens[eoa.id].shorteningInProgress ? (
              <Badge variant="secondary" className="animate-pulse">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Shortening...
              </Badge>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const tokenData = l00Tokens[eoa.id];
                    const urlToUse = tokenData.shortUrl || tokenData.url;
                    handleCopyUrl(urlToUse, eoa.id);
                  }}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  {l00Tokens[eoa.id].shortUrl ? "Short URL" : "URL"}
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedTokenForDisplay({ 
                          token: l00Tokens[eoa.id].token, 
                          url: l00Tokens[eoa.id].url,
                          shortUrl: l00Tokens[eoa.id].shortUrl,
                          eoaTitle: eoa.title 
                        })}
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Display and copy QR code</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </div>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateL00(eoa)}
                    disabled={generatingL00 === eoa.id || !eoa.assigned_deck_slug || !eoa.mobilize_code}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    {generatingL00 === eoa.id ? "Generating..." : "Generate L00 Token"}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {!eoa.assigned_deck_slug || !eoa.mobilize_code 
                  ? `Missing: ${[!eoa.mobilize_code && "Mobilize Code", !eoa.assigned_deck_slug && "Deck"].filter(Boolean).join(", ")}`
                  : "Generate L00 token with QR code and shortened URL"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
      enableSorting: false,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const eoa = row.original;
        return (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedEoa(eoa);
                setPayloadDialogOpen(true);
              }}
              title="View Payload"
            >
              <FileJson className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingEoa(eoa);
                setDialogOpen(true);
              }}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteEoa(eoa.id)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => duplicateEoa(eoa)}
              title="Duplicate with blank utm_id"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" disabled title="Kit feature coming soon">
              <Package className="h-4 w-4 opacity-50" />
            </Button>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];

  const table = useReactTable({
    data: eoas,
    columns,
    state: {
      sorting,
      rowSelection,
      columnVisibility,
    },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  });

  const applyBulkUpdate = async () => {
    // If all fields are empty, mint L00 tokens instead
    if (!bulkDeckSlug && !bulkUtmId && !bulkStartDate && !bulkEndDate) {
      await handleBulkGenerateL00();
      return;
    }

    const updates: { id: string; data: Record<string, string | null> }[] = [];
    
    selectedRowsSet.forEach(id => {
      const updateData: Record<string, string | null> = {};
      if (bulkDeckSlug) updateData.assigned_deck_slug = bulkDeckSlug;
      if (bulkUtmId) updateData.utm_id = bulkUtmId;
      // Store as floating local time (same wall-clock everywhere)
      if (bulkStartDate) updateData.start_date = `${bulkStartDate}:00.000Z`;
      if (bulkEndDate) updateData.end_date = `${bulkEndDate}:00.000Z`;
      
      if (Object.keys(updateData).length > 0) {
        updates.push({ id, data: updateData });
      }
    });

    if (updates.length === 0) {
      toast({
        variant: "destructive",
        title: "No changes",
        description: "Please provide values to update"
      });
      return;
    }

    try {
      for (const update of updates) {
        const { error } = await supabase
          .from("events_actions")
          .update(update.data)
          .eq("id", update.id);
        
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Updated ${updates.length} event(s)/action(s)`
      });

      clearSelection();
      fetchEoas();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update: " + error.message
      });
    }
  };

  const handleBulkDeckAssignment = async () => {
    if (!bulkDeckInput.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Deck Name",
        description: "Please enter a deck name"
      });
      return;
    }

    try {
      const updates = Array.from(selectedRowsSet).map(id => 
        supabase
          .from("events_actions")
          .update({ assigned_deck_slug: bulkDeckInput.trim() })
          .eq("id", id)
      );

      await Promise.all(updates);

      // If template selected, add it as a viral slide to the deck
      if (selectedTemplate) {
        const { data: slideData } = await supabase
          .from("slide_items")
          .insert({
            deck_slug: bulkDeckInput.trim(),
            type: 'interactive',
            content_url: '',
            position: 999,
            template_id: selectedTemplate
          })
          .select()
          .single();

        if (slideData) {
          toast({
            title: "Success",
            description: `Deck and interactive template assigned to ${selectedRowsSet.size} EoA(s)`
          });
        }
      } else {
        toast({
          title: "Success",
          description: `Assigned deck "${bulkDeckInput}" to ${selectedRowsSet.size} EoA(s)`
        });
      }

      setBulkDeckDialogOpen(false);
      setBulkDeckInput("");
      setSelectedTemplate("");
      clearSelection();
      fetchEoas();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to assign deck: " + error.message
      });
    }
  };

  const formatTimezone = (timezone: string | null) => {
    if (!timezone || timezone === "TBD") return "TBD";
    
    // Map common timezone names to their short forms
    const timezoneMap: Record<string, string> = {
      "America/New_York": "ET",
      "America/Chicago": "CT",
      "America/Denver": "MT",
      "America/Los_Angeles": "PT",
      "America/Phoenix": "MST",
      "America/Anchorage": "AKT",
      "Pacific/Honolulu": "HST",
      "America/Detroit": "ET",
      "America/Indianapolis": "ET",
      "America/Kentucky/Louisville": "ET",
      "America/Kentucky/Monticello": "ET",
      "America/Indiana/Indianapolis": "ET",
      "America/Indiana/Knox": "CT",
      "America/Indiana/Marengo": "ET",
      "America/Indiana/Petersburg": "ET",
      "America/Indiana/Tell_City": "CT",
      "America/Indiana/Vevay": "ET",
      "America/Indiana/Vincennes": "ET",
      "America/Indiana/Winamac": "ET",
    };
    
    return timezoneMap[timezone] || timezone;
  };

  const getMintReadiness = (eoa: EventAction) => {
    const tokenData = l00Tokens[eoa.id];
    const isMinted = !!tokenData;
    
    if (isMinted) {
      return { status: "minted", label: "Minted", icon: Lock, className: "bg-muted text-muted-foreground" };
    }
    
    const missing = [];
    if (!eoa.mobilize_code) missing.push("Mobilize Code");
    if (!eoa.assigned_deck_slug) missing.push("Deck");
    
    return { 
      status: "needs-minting", 
      label: missing.length > 0 ? `Missing: ${missing.join(", ")}` : "Needs Minting", 
      icon: AlertCircle, 
      className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200" 
    };
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>;
  }
  if (!campaign) {
    return null;
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="w-full px-6 py-4">
        </div>
      </header>

      <main className="w-full px-6 py-8">
        <Card className={cn("border-primary", selectedRowsSet.size === 0 ? "mb-2" : "mb-4")}>
          <CardContent className="pt-4">
            <div className="flex items-start gap-4">
              <div className="flex flex-col gap-1 items-start">
                <Button 
                  variant="outline" 
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  disabled={selectedRowsSet.size === 0}
                  className="justify-start"
                >
                  {showBulkActions ? "Hide" : "Select rows to show"} bulk actions
                </Button>
                <span className="text-sm text-muted-foreground">
                  # Selected: {selectedRowsSet.size}
                </span>
              </div>

              {selectedRowsSet.size > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    <X className="h-4 w-4 mr-1" />
                    Clear Selection
                  </Button>
                </div>
              )}
            </div>

            {selectedRowsSet.size > 0 && (
              <div className="space-y-4 border-t pt-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="bulk-deck">Assign Deck</Label>
                    <Input
                      id="bulk-deck"
                      placeholder="Deck slug (optional)"
                      value={bulkDeckSlug}
                      onChange={(e) => setBulkDeckSlug(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bulk-utm">Assign UTM ID</Label>
                    <Input
                      id="bulk-utm"
                      placeholder="UTM ID (optional)"
                      value={bulkUtmId}
                      onChange={(e) => setBulkUtmId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bulk-start">Start Date/Time</Label>
                    <Input
                      id="bulk-start"
                      type="datetime-local"
                      value={bulkStartDate}
                      onChange={(e) => setBulkStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bulk-end">End Date/Time</Label>
                    <Input
                      id="bulk-end"
                      type="datetime-local"
                      value={bulkEndDate}
                      onChange={(e) => setBulkEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Leave all fields empty to mint L00 tokens for selected rows
                </p>
                <div className="flex gap-3 mt-3">
                  <Button
                    variant="outline"
                    onClick={selectedRowsSet.size > 0 ? handleBulkGenerateL00 : handleGenerateAllL00}
                    className="flex-1"
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    Mint L00 ({selectedRowsSet.size})
                  </Button>
                  <Button onClick={applyBulkUpdate} className="flex-1">
                    {!bulkDeckSlug && !bulkUtmId && !bulkStartDate && !bulkEndDate
                      ? `Mint L00 for ${selectedRowsSet.size} Selected`
                      : `Apply to ${selectedRowsSet.size} Selected`}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center mb-2">
              <CardTitle>
                Event/Actions for {campaign.title}
              </CardTitle>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Columns className="mr-2 h-4 w-4" />
                      Columns
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
                    {table
                      .getAllColumns()
                      .filter((column) => column.getCanHide())
                      .map((column) => {
                        return (
                          <DropdownMenuCheckboxItem
                            key={column.id}
                            checked={column.getIsVisible()}
                            onCheckedChange={(value) => column.toggleVisibility(!!value)}
                          >
                            {column.id === "mobilize_code" && "Mobilize Code"}
                            {column.id === "utm_id" && "utm_id"}
                            {column.id === "title" && "Event/Action Name"}
                            {column.id === "site_name" && "Site Name"}
                            {column.id === "city" && "City"}
                            {column.id === "state" && "State"}
                            {column.id === "zip_code" && "Zip Code"}
                            {column.id === "type" && "Type"}
                            {column.id === "start_date" && "Start Date/Time"}
                            {column.id === "end_date" && "End Date/Time"}
                            {column.id === "timezone" && "Timezone"}
                            {column.id === "assigned_deck_slug" && "Assigned Deck"}
                            {column.id === "status" && "Status"}
                            {column.id === "l00_token" && "L00 Token"}
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" onClick={() => setQrDefaultsDialogOpen(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  QR Code Defaults
                </Button>
                <Button variant="outline" onClick={() => setVisualizePayloadDialogOpen(true)}>
                  <FileJson className="mr-2 h-4 w-4" />
                  Visualize Generic Payload
                </Button>
              </div>
            </div>
            <div>
              <Button onClick={() => {
                setEditingEoa(null);
                setDialogOpen(true);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Event/Action
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {eoas.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No events or actions yet. Click "Add Event/Action" to create one.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className={header.id === "select" ? "w-12" : ""}>
                          {header.isPlaceholder ? null : (
                            <div
                              {...{
                                className: header.column.getCanSort()
                                  ? "cursor-pointer select-none flex items-center"
                                  : "",
                                onClick: header.column.getToggleSortingHandler(),
                              }}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              {header.column.getCanSort() && (
                                <span className="ml-2">
                                  {header.column.getIsSorted() === "asc" ? (
                                    <ArrowUp className="h-4 w-4" />
                                  ) : header.column.getIsSorted() === "desc" ? (
                                    <ArrowDown className="h-4 w-4" />
                                  ) : (
                                    <ArrowUpDown className="h-4 w-4" />
                                  )}
                                </span>
                              )}
                            </div>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={row.getIsSelected() ? "bg-yellow-100 dark:bg-yellow-900/30" : ""}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEoa ? "Edit Event/Action" : `Create Event/Action for Campaign: ${campaign?.title || ""}`}
            </DialogTitle>
            <DialogDescription>
              {editingEoa ? "Update the event or action details below." : "Add a new event or action to this campaign."}
            </DialogDescription>
          </DialogHeader>
          <EoaForm campaignId={campaign.id} eoaId={editingEoa?.id} initialData={editingEoa ? {
          mobilize_id: editingEoa.mobilize_id || "",
          mobilize_code: editingEoa.mobilize_code || "",
          title: editingEoa.title,
          site_name: editingEoa.site_name || "",
          city: editingEoa.city || "",
          state: editingEoa.state || "",
          zip_code: editingEoa.zip_code || "",
          type: editingEoa.type,
          start_date: editingEoa.start_date || "",
          end_date: editingEoa.end_date || "",
          timezone: editingEoa.timezone || "TBD",
          assigned_deck_slug: editingEoa.assigned_deck_slug || "",
          description: editingEoa.description || "",
          utm_id: editingEoa.utm_id
        } : undefined} onSuccess={async () => {
          // Check if this eoa had a token before saving
          const hadToken = editingEoa ? !!l00Tokens[editingEoa.id] : false;
          
          setDialogOpen(false);
          setEditingEoa(null);
          
          // Refresh data
          await fetchEoas();
          await fetchExistingTokens();
          
          // Check if token was invalidated
          if (hadToken && editingEoa && !l00Tokens[editingEoa.id]) {
            toast({
              title: "Token Invalidated",
              description: "Critical fields changed. You'll need to re-mint the L00 token.",
              variant: "default",
            });
          }
        }} onCancel={() => {
          setDialogOpen(false);
          setEditingEoa(null);
        }} />
        </DialogContent>
      </Dialog>

      <Dialog open={payloadDialogOpen} onOpenChange={setPayloadDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Payload Structure for: {selectedEoa?.mobilize_code || "{mobilize_code}"} - {campaign.title} {selectedEoa?.city || ""}
            </DialogTitle>
            <DialogDescription>
              Comparison of L00, L01, and L02 payload structures with known values filled in
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2">#</TableHead>
                <TableHead className="py-2">Item</TableHead>
                <TableHead className="py-2">L00 Payload</TableHead>
                <TableHead className="py-2">L01 Payload</TableHead>
                <TableHead className="py-2">L02 Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium py-1.5">1</TableCell>
                <TableCell className="font-medium py-1.5">domain name/</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{domain name}/"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{domain name}/"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{domain name}/"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">2</TableCell>
                <TableCell className="font-medium py-1.5">deck-assignment</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{selectedEoa?.assigned_deck_slug || "{deck-assignment}"}/</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{selectedEoa?.assigned_deck_slug || "{deck-assignment}"}/</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{selectedEoa?.assigned_deck_slug || "{deck-assignment}"}/</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">3</TableCell>
                <TableCell className="font-medium py-1.5">utm_campaign=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{campaign.code}&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{campaign.code}&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{campaign.code}&</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">4</TableCell>
                <TableCell className="font-medium py-1.5">utm_id=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{selectedEoa?.utm_id || "{utm_id}"}&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{selectedEoa?.utm_id || "{utm_id}"}&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{selectedEoa?.utm_id || "{utm_id}"}&</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">5</TableCell>
                <TableCell className="font-medium py-1.5">utm_content=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">
                  {selectedEoa?.mobilize_code && selectedEoa?.utm_id 
                    ? `${selectedEoa.mobilize_code}-${selectedEoa.utm_id}` 
                    : "{mobilize_code}-{utm_id}"}&
                </TableCell>
                <TableCell className="font-mono text-sm py-1.5">
                  {selectedEoa?.mobilize_code && selectedEoa?.utm_id 
                    ? `${selectedEoa.mobilize_code}-${selectedEoa.utm_id}` 
                    : "{mobilize_code}-{utm_id}"}&
                </TableCell>
                <TableCell className="font-mono text-sm py-1.5">
                  {selectedEoa?.mobilize_code && selectedEoa?.utm_id 
                    ? `${selectedEoa.mobilize_code}-${selectedEoa.utm_id}` 
                    : "{mobilize_code}-{utm_id}"}&
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">6</TableCell>
                <TableCell className="font-medium py-1.5">utm_source=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">l00&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">l01&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">l02&</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">7</TableCell>
                <TableCell className="font-medium py-1.5">utm_medium=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">qr&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{'email&', 'sms&', {social media (e.g., 'fb&')}}"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{'email&', 'sms&', {social media (e.g., 'fb&')}}"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">8</TableCell>
                <TableCell className="font-medium py-1.5">v_lvl=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">00&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">01&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">02&</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">9</TableCell>
                <TableCell className="font-medium py-1.5">t=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">l00-{selectedEoa?.mobilize_code || "{mobilize_code}"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{101 AUTO-MINT}"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{102 AUTO-MINT}"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">10</TableCell>
                <TableCell className="font-medium py-1.5">p=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">null</TableCell>
                <TableCell className="font-mono text-sm py-1.5">l00-{selectedEoa?.mobilize_code || "{mobilize_code}"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{101 AUTO-MINT}"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">11</TableCell>
                <TableCell className="font-medium py-1.5">m=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">null</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{em,sms,sm}"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{em,sms,sm}"}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <Dialog open={visualizePayloadDialogOpen} onOpenChange={setVisualizePayloadDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Generic Payload Visualization</DialogTitle>
            <DialogDescription>
              Comparison of L00 and L01 payload structures
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2">#</TableHead>
                <TableHead className="py-2">Item</TableHead>
                <TableHead className="py-2">L00 Payload</TableHead>
                <TableHead className="py-2">L01 Payload</TableHead>
                <TableHead className="py-2">L02 Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium py-1.5">1</TableCell>
                <TableCell className="font-medium py-1.5">domain name/</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{domain name}/"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{domain name}/"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{domain name}/"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">2</TableCell>
                <TableCell className="font-medium py-1.5">deck-assignment</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{deck-assignment}/"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{deck-assignment}/"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{deck-assignment}/"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">3</TableCell>
                <TableCell className="font-medium py-1.5">utm_campaign=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{campaign.code}&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{campaign.code}&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{campaign.code}&</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">4</TableCell>
                <TableCell className="font-medium py-1.5">utm_id=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{Mobilize event code}&"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{Mobilize event code}&"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{Mobilize event code}&"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">5</TableCell>
                <TableCell className="font-medium py-1.5">utm_content=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{mobilize_code}-{utm_id}&"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{mobilize_code}-{utm_id}&"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{mobilize_code}-{utm_id}&"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">6</TableCell>
                <TableCell className="font-medium py-1.5">utm_source=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">l00&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">l01&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">l02&</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">7</TableCell>
                <TableCell className="font-medium py-1.5">utm_medium=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">qr&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{'email&', 'sms&', {social media (e.g., 'fb&')}}"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{'email&', 'sms&', {social media (e.g., 'fb&')}}"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">8</TableCell>
                <TableCell className="font-medium py-1.5">v_lvl=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">00&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">01&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">02&</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">9</TableCell>
                <TableCell className="font-medium py-1.5">t=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"l00-{mobilize_code}"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{101 AUTO-MINT}"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{102 AUTO-MINT}"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">10</TableCell>
                <TableCell className="font-medium py-1.5">p=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">null</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"l00-{mobilize_code}"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{101 AUTO-MINT}"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">11</TableCell>
                <TableCell className="font-medium py-1.5">m=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">null</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{em,sms,sm}"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{em,sms,sm}"}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeckDialogOpen} onOpenChange={setBulkDeckDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Assign Deck</DialogTitle>
            <DialogDescription>
              Assign a deck to all {selectedRowsSet.size} selected EoA{selectedRowsSet.size !== 1 ? 's' : ''}. Optionally add an interactive template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-deck-select">Select Deck</Label>
              <Select value={bulkDeckInput} onValueChange={setBulkDeckInput}>
                <SelectTrigger id="bulk-deck-select" className="w-full">
                  <SelectValue placeholder="Choose a deck..." />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {availableDecks.length === 0 ? (
                    <SelectItem value="no-decks" disabled>No decks available</SelectItem>
                  ) : (
                    availableDecks.map(deck => (
                      <SelectItem key={deck} value={deck}>
                        {deck}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-select">Add Interactive Template (Optional)</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger id="template-select" className="w-full">
                  <SelectValue placeholder="None - deck only" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="">None</SelectItem>
                  {availableTemplates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Templates will be added as viral slides to the deck. Changes to templates cascade automatically.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBulkDeckDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkDeckAssignment} disabled={!bulkDeckInput}>
              Assign to {selectedRowsSet.size} EoA{selectedRowsSet.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TokenDisplay
        open={!!selectedTokenForDisplay}
        onOpenChange={(open) => !open && setSelectedTokenForDisplay(null)}
        token={selectedTokenForDisplay?.token || ""}
        fullUrl={selectedTokenForDisplay?.url || ""}
        shortUrl={selectedTokenForDisplay?.shortUrl}
        eoaTitle={selectedTokenForDisplay?.eoaTitle || ""}
      />

      <QrDefaultsDialog
        open={qrDefaultsDialogOpen}
        onOpenChange={setQrDefaultsDialogOpen}
      />
    </div>
  );
}