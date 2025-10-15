import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit2, ArrowLeft, Package, Eye, X, ArrowUpDown, ArrowUp, ArrowDown, QrCode, Download, Copy, Check, CheckCircle2, AlertCircle, Lock } from "lucide-react";
import EoaForm from "@/components/EoaForm";
import { QRCodeSVG } from "qrcode.react";
import { mintL00 } from "@/lib/virality/mint";
import { shortenUrlsBatch } from "@/lib/virality/shortener";
import { TokenDisplay } from "@/components/TokenDisplay";
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
  const [selectedEoa, setSelectedEoa] = useState<EventAction | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkDeckSlug, setBulkDeckSlug] = useState("");
  const [bulkUtmId, setBulkUtmId] = useState("");
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [generatingL00, setGeneratingL00] = useState<string | null>(null);
  const [l00Tokens, setL00Tokens] = useState<Record<string, { token: string; url: string; shortUrl?: string; shorteningInProgress?: boolean }>>({});
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [selectedTokenForDisplay, setSelectedTokenForDisplay] = useState<{
    token: string;
    url: string;
    shortUrl?: string;
    eoaTitle: string;
  } | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  useEffect(() => {
    if (campaignId) {
      fetchData();
    }
  }, [campaignId]);
  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchCampaign(), fetchEoas(), fetchExistingTokens()]);
    setLoading(false);
  };

  const fetchExistingTokens = async () => {
    const { data, error } = await supabase
      .from("tokens")
      .select("eoa_id, token, full_url")
      .eq("level", 0);

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
    }
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
  const formatDateTime = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  };

  const toggleRowSelection = (id: string) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedRows(newSelection);
  };

  const toggleAllRows = () => {
    if (selectedRows.size === eoas.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(eoas.map(e => e.id)));
    }
  };

  const clearSelection = () => {
    setSelectedRows(new Set());
    setShowBulkActions(false);
    setBulkDeckSlug("");
    setBulkUtmId("");
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

  const handleBulkGenerateL00 = async () => {
    const selectedEoas = eoas.filter(eoa => selectedRows.has(eoa.id));
    
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

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  const sortedEoas = [...eoas].sort((a, b) => {
    if (!sortColumn) return 0;

    const aValue = a[sortColumn as keyof typeof a];
    const bValue = b[sortColumn as keyof typeof b];

    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const applyBulkUpdate = async () => {
    const updates: { id: string; data: Partial<EventAction> }[] = [];
    
    selectedRows.forEach(id => {
      const updateData: Partial<EventAction> = {};
      if (bulkDeckSlug) updateData.assigned_deck_slug = bulkDeckSlug;
      if (bulkUtmId) updateData.utm_id = bulkUtmId;
      
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
    const hasMobilizeCode = !!eoa.mobilize_code;
    const hasDeck = !!eoa.assigned_deck_slug;
    const isMinted = !!l00Tokens[eoa.id];
    
    if (isMinted) {
      return { status: "minted", label: "Minted", icon: Lock, className: "bg-muted text-muted-foreground" };
    }
    
    if (hasMobilizeCode && hasDeck) {
      return { status: "ready", label: "Ready to Mint", icon: CheckCircle2, className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200" };
    }
    
    const missing = [];
    if (!hasMobilizeCode) missing.push("Mobilize Code");
    if (!hasDeck) missing.push("Deck");
    
    return { 
      status: "incomplete", 
      label: `Missing: ${missing.join(", ")}`, 
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
  return <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="w-full px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/campaigns">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Campaigns
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{campaign.title}</h1>
              <p className="text-muted-foreground">Campaign Code: {campaign.code}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-8">
        {selectedRows.size > 0 && (
          <Card className="mb-4 border-primary">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{selectedRows.size} selected</span>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setShowBulkActions(!showBulkActions)}
                >
                  {showBulkActions ? "Hide" : "Show"} Bulk Actions
                </Button>
              </div>

              {showBulkActions && (
                <div className="space-y-4 border-t pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bulk-deck">Assign Deck Slug</Label>
                      <Input
                        id="bulk-deck"
                        placeholder="e.g., deck-2024-q4"
                        value={bulkDeckSlug}
                        onChange={(e) => setBulkDeckSlug(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bulk-utm">Set UTM ID</Label>
                      <Input
                        id="bulk-utm"
                        placeholder="e.g., event-123"
                        value={bulkUtmId}
                        onChange={(e) => setBulkUtmId(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={applyBulkUpdate} className="w-full">
                    Apply to {selectedRows.size} Selected
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                Event/Actions for {campaign.code}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setVisualizePayloadDialogOpen(true)}>
                  Visualize Generic Payload
                </Button>
                <Button onClick={() => {
                setEditingEoa(null);
                setDialogOpen(true);
              }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Event/Action
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {eoas.length === 0 ? <p className="text-center text-muted-foreground py-8">
                No events or actions yet. Click "Add Event/Action" to create one.
              </p> : <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedRows.size === eoas.length}
                        onCheckedChange={toggleAllRows}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("mobilize_code")}
                        className="h-auto p-0 hover:bg-transparent font-medium"
                      >
                        Mobilize Code
                        {getSortIcon("mobilize_code")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("utm_id")}
                        className="h-auto p-0 hover:bg-transparent font-medium"
                      >
                        utm_id
                        {getSortIcon("utm_id")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("title")}
                        className="h-auto p-0 hover:bg-transparent font-medium"
                      >
                        Event/Action Name
                        {getSortIcon("title")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("site_name")}
                        className="h-auto p-0 hover:bg-transparent font-medium"
                      >
                        Site Name
                        {getSortIcon("site_name")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("city")}
                        className="h-auto p-0 hover:bg-transparent font-medium"
                      >
                        City
                        {getSortIcon("city")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("state")}
                        className="h-auto p-0 hover:bg-transparent font-medium"
                      >
                        State
                        {getSortIcon("state")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("zip_code")}
                        className="h-auto p-0 hover:bg-transparent font-medium"
                      >
                        Zip Code
                        {getSortIcon("zip_code")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("type")}
                        className="h-auto p-0 hover:bg-transparent font-medium"
                      >
                        Type
                        {getSortIcon("type")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("start_date")}
                        className="h-auto p-0 hover:bg-transparent font-medium"
                      >
                        Start Date/Time
                        {getSortIcon("start_date")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("end_date")}
                        className="h-auto p-0 hover:bg-transparent font-medium"
                      >
                        End Date/Time
                        {getSortIcon("end_date")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("timezone")}
                        className="h-auto p-0 hover:bg-transparent font-medium"
                      >
                        Timezone
                        {getSortIcon("timezone")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort("assigned_deck_slug")}
                        className="h-auto p-0 hover:bg-transparent font-medium"
                      >
                        Assigned Deck
                        {getSortIcon("assigned_deck_slug")}
                      </Button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        <span>L00 Token</span>
                        {selectedRows.size > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleBulkGenerateL00}
                            className="h-7 text-xs"
                          >
                            <QrCode className="h-3 w-3 mr-1" />
                            Generate Selected ({selectedRows.size})
                          </Button>
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEoas.map(eoa => <TableRow key={eoa.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRows.has(eoa.id)}
                          onCheckedChange={() => toggleRowSelection(eoa.id)}
                          aria-label={`Select ${eoa.title}`}
                        />
                      </TableCell>
                      <TableCell>{eoa.mobilize_code || "—"}</TableCell>
                      <TableCell>{eoa.utm_id}</TableCell>
                      <TableCell className="font-medium">{eoa.title}</TableCell>
                      <TableCell>{eoa.site_name || "—"}</TableCell>
                      <TableCell>{eoa.city || "—"}</TableCell>
                      <TableCell>{eoa.state || "—"}</TableCell>
                      <TableCell>{eoa.zip_code || "—"}</TableCell>
                      <TableCell className="capitalize">{eoa.type}</TableCell>
                      <TableCell>{formatDateTime(eoa.start_date)}</TableCell>
                      <TableCell>{formatDateTime(eoa.end_date)}</TableCell>
                      <TableCell>{formatTimezone(eoa.timezone)}</TableCell>
                      <TableCell>{eoa.assigned_deck_slug || "—"}</TableCell>
                      <TableCell>
                        {(() => {
                          const readiness = getMintReadiness(eoa);
                          const Icon = readiness.icon;
                          return (
                            <Badge variant="outline" className={readiness.className}>
                              <Icon className="h-3 w-3 mr-1" />
                              {readiness.label}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {l00Tokens[eoa.id] ? (
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
                                {l00Tokens[eoa.id].shortUrl && (
                                  <Badge variant="outline" className="text-xs">
                                    Shortened
                                  </Badge>
                                )}
                              </>
                            )}
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
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateL00(eoa)}
                            disabled={generatingL00 === eoa.id || !eoa.assigned_deck_slug}
                          >
                            <QrCode className="h-4 w-4 mr-2" />
                            {generatingL00 === eoa.id ? "Generating..." : "Generate L00"}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => {
                      setSelectedEoa(eoa);
                      setPayloadDialogOpen(true);
                    }} title="View Payload">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                      setEditingEoa(eoa);
                      setDialogOpen(true);
                    }}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteEoa(eoa.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" disabled title="Kit feature coming soon">
                            <Package className="h-4 w-4 opacity-50" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>}
          </CardContent>
        </Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEoa ? "Edit Event/Action" : "Create Event/Action"}
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

      <TokenDisplay
        open={!!selectedTokenForDisplay}
        onOpenChange={(open) => !open && setSelectedTokenForDisplay(null)}
        token={selectedTokenForDisplay?.token || ""}
        fullUrl={selectedTokenForDisplay?.url || ""}
        shortUrl={selectedTokenForDisplay?.shortUrl}
        eoaTitle={selectedTokenForDisplay?.eoaTitle || ""}
      />
    </div>;
}