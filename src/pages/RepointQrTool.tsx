import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Search, ChevronDown, ChevronRight, Check, AlertTriangle, Copy } from "lucide-react";

/* ── types ── */
interface ShortenedUrl {
  id: string;
  short_code: string;
  full_url: string;
  clicks: number;
  created_at: string;
}

interface Campaign {
  id: string;
  code: string;
  title: string;
}

interface Eoa {
  id: string;
  title: string;
  mobilize_code: string | null;
  utm_id: string;
  assigned_deck_slug: string | null;
  campaign_id: string;
}

interface Deck {
  slug: string;
}

interface TokenInfo {
  token: string;
  level: number;
  minted_at: string;
  eoa_id: string;
  deck_slug: string;
}

/* ── helpers ── */
function parseFullUrl(url: string) {
  try {
    const u = new URL(url);
    const deck = u.pathname.replace("/deck/", "");
    const campaign = u.searchParams.get("utm_campaign") ?? "";
    const utmId = u.searchParams.get("utm_id") ?? "";
    const token = u.searchParams.get("t") ?? "";
    return { deck, campaign, utmId, token };
  } catch {
    return { deck: "", campaign: "", utmId: "", token: "" };
  }
}

function buildFullUrl(
  deckSlug: string,
  campaignCode: string,
  utmId: string,
  mobilizeCode: string,
) {
  const utmContent = `${mobilizeCode}-${utmId}`;
  const token = `l00-${mobilizeCode}-${utmId}`;
  return (
    `https://omega-resist.lovable.app/deck/${deckSlug}` +
    `?utm_campaign=${campaignCode}` +
    `&utm_id=${utmId}` +
    `&utm_source=L00` +
    `&utm_medium=qr` +
    `&utm_content=${utmContent}` +
    `&t=${token}` +
    `&v_lvl=00`
  );
}

/* ── component ── */
export default function RepointQrTool() {
  const [urls, setUrls] = useState<ShortenedUrl[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [eoas, setEoas] = useState<Eoa[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);

  // re-point wizard state
  const [shortCodeInput, setShortCodeInput] = useState("");
  const [selectedUrl, setSelectedUrl] = useState<ShortenedUrl | null>(null);
  const [selCampaignId, setSelCampaignId] = useState("");
  const [selEoaId, setSelEoaId] = useState("");
  const [deckOverride, setDeckOverride] = useState("");
  const [utmIdOverride, setUtmIdOverride] = useState("");
  const [resetClicks, setResetClicks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // collapsible table
  const [tableOpen, setTableOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState("");

  // re-mint wizard state
  const [rmCampaignId, setRmCampaignId] = useState("");
  const [rmEoaId, setRmEoaId] = useState("");
  const [rmNewDeck, setRmNewDeck] = useState("");
  const [rmTokens, setRmTokens] = useState<TokenInfo[]>([]);
  const [rmLoadingTokens, setRmLoadingTokens] = useState(false);
  const [rmConfirmText, setRmConfirmText] = useState("");
  const [rmShowConfirm, setRmShowConfirm] = useState(false);
  const [rmSaving, setRmSaving] = useState(false);
  const [rmResult, setRmResult] = useState<{ token: string; fullUrl: string; shortUrl?: string } | null>(null);
  const [rmShortenUrl, setRmShortenUrl] = useState(true);

  /* ── data loading ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [urlRes, campRes, eoaRes, deckRes] = await Promise.all([
        supabase.from("shortened_urls").select("*").order("created_at", { ascending: false }),
        supabase.from("campaigns").select("id,code,title").order("title"),
        supabase.from("events_actions").select("id,title,mobilize_code,utm_id,assigned_deck_slug,campaign_id"),
        supabase.from("decks").select("slug").order("slug"),
      ]);
      if (urlRes.data) setUrls(urlRes.data);
      if (campRes.data) setCampaigns(campRes.data);
      if (eoaRes.data) setEoas(eoaRes.data as Eoa[]);
      if (deckRes.data) setDecks(deckRes.data);
      setLoading(false);
    })();
  }, []);

  // ===== RE-POINT DERIVED =====
  const matchingUrls = useMemo(() => {
    if (!shortCodeInput.trim()) return [];
    const s = shortCodeInput.toLowerCase().replace(/^\/s\//, "").replace(/^\/r\//, "");
    return urls.filter((u) => u.short_code.toLowerCase().includes(s)).slice(0, 8);
  }, [urls, shortCodeInput]);

  const filteredEoas = useMemo(
    () => (selCampaignId ? eoas.filter((e) => e.campaign_id === selCampaignId) : []),
    [eoas, selCampaignId],
  );

  const selectedEoa = useMemo(
    () => eoas.find((e) => e.id === selEoaId) ?? null,
    [eoas, selEoaId],
  );

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selCampaignId) ?? null,
    [campaigns, selCampaignId],
  );

  const previewUrl = useMemo(() => {
    if (!selectedCampaign || !selectedEoa) return "";
    return buildFullUrl(
      deckOverride || selectedEoa.assigned_deck_slug || "",
      selectedCampaign.code,
      utmIdOverride || selectedEoa.utm_id,
      selectedEoa.mobilize_code || "",
    );
  }, [selectedCampaign, selectedEoa, deckOverride, utmIdOverride]);

  const tableFiltered = useMemo(() => {
    if (!tableSearch) return urls;
    const s = tableSearch.toLowerCase();
    return urls.filter((u) => {
      const p = parseFullUrl(u.full_url);
      return (
        u.short_code.toLowerCase().includes(s) ||
        p.deck.toLowerCase().includes(s) ||
        p.campaign.toLowerCase().includes(s)
      );
    });
  }, [urls, tableSearch]);

  // ===== RE-MINT DERIVED =====
  const rmFilteredEoas = useMemo(
    () => (rmCampaignId ? eoas.filter((e) => e.campaign_id === rmCampaignId) : []),
    [eoas, rmCampaignId],
  );

  const rmSelectedEoa = useMemo(
    () => eoas.find((e) => e.id === rmEoaId) ?? null,
    [eoas, rmEoaId],
  );

  const rmSelectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === rmCampaignId) ?? null,
    [campaigns, rmCampaignId],
  );

  const rmL00Token = useMemo(
    () => rmTokens.find((t) => t.level === 0 && !t.token.includes(":")) ?? null,
    [rmTokens],
  );

  const rmChildTokenCount = useMemo(
    () => rmTokens.filter((t) => t.level > 0).length,
    [rmTokens],
  );

  const rmInstanceCount = useMemo(
    () => rmTokens.filter((t) => t.level === 0 && t.token.includes(":")).length,
    [rmTokens],
  );

  // Fetch tokens when EoA changes in re-mint tab
  useEffect(() => {
    if (!rmEoaId) {
      setRmTokens([]);
      return;
    }
    (async () => {
      setRmLoadingTokens(true);
      const { data } = await supabase
        .from("tokens")
        .select("token,level,minted_at,eoa_id,deck_slug")
        .eq("eoa_id", rmEoaId)
        .is("deleted_at", null);
      setRmTokens((data as TokenInfo[]) ?? []);
      setRmLoadingTokens(false);
    })();
  }, [rmEoaId]);

  /* ── select short code ── */
  function selectShortCode(row: ShortenedUrl) {
    setSelectedUrl(row);
    setShortCodeInput(row.short_code);
    setShowDropdown(false);
    setResetClicks(false);

    const parsed = parseFullUrl(row.full_url);
    const matchCamp = campaigns.find((c) => c.code === parsed.campaign);
    if (matchCamp) {
      setSelCampaignId(matchCamp.id);
      const matchEoa = eoas.find(
        (e) => e.campaign_id === matchCamp.id && e.utm_id === parsed.utmId,
      );
      if (matchEoa) {
        setSelEoaId(matchEoa.id);
        setDeckOverride(matchEoa.assigned_deck_slug ?? parsed.deck);
        setUtmIdOverride(matchEoa.utm_id);
      } else {
        setSelEoaId("");
        setDeckOverride(parsed.deck);
        setUtmIdOverride(parsed.utmId);
      }
    } else {
      setSelCampaignId("");
      setSelEoaId("");
      setDeckOverride(parsed.deck);
      setUtmIdOverride(parsed.utmId);
    }
  }

  /* ── re-point save ── */
  async function handleSave() {
    if (!selectedUrl || !previewUrl) return;
    setSaving(true);
    const oldUrl = selectedUrl.full_url;

    const updates: Record<string, unknown> = { full_url: previewUrl };
    if (resetClicks) updates.clicks = 0;

    const { error } = await supabase
      .from("shortened_urls")
      .update(updates)
      .eq("id", selectedUrl.id);

    setSaving(false);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }

    setUrls((prev) =>
      prev.map((u) =>
        u.id === selectedUrl.id
          ? { ...u, full_url: previewUrl, clicks: resetClicks ? 0 : u.clicks }
          : u,
      ),
    );

    toast({
      title: "Short code re-pointed ✓",
      description: `/s/${selectedUrl.short_code} → ${selectedCampaign?.title} / ${selectedEoa?.title}`,
    });
    console.log("[repoint]", { short_code: selectedUrl.short_code, oldUrl, newUrl: previewUrl });

    setSelectedUrl(null);
    setShortCodeInput("");
    setSelCampaignId("");
    setSelEoaId("");
    setDeckOverride("");
    setUtmIdOverride("");
    setResetClicks(false);
  }

  function resetRepointWizard() {
    setSelectedUrl(null);
    setShortCodeInput("");
    setSelCampaignId("");
    setSelEoaId("");
    setDeckOverride("");
    setUtmIdOverride("");
    setResetClicks(false);
  }

  /* ── re-mint save ── */
  async function handleRemint() {
    if (!rmSelectedEoa || !rmNewDeck || !rmSelectedCampaign) return;
    setRmSaving(true);
    setRmResult(null);

    try {
      // Step 1: Update assigned_deck_slug (trigger deletes tokens)
      const { error: updateError } = await supabase
        .from("events_actions")
        .update({ assigned_deck_slug: rmNewDeck })
        .eq("id", rmSelectedEoa.id);

      if (updateError) throw updateError;

      // Step 2: Mint new L00 token
      const { data: mintData, error: mintError } = await supabase.rpc("mint_l00", {
        _eoa_id: rmSelectedEoa.id,
        _deck_slug: rmNewDeck,
      });

      if (mintError) throw mintError;
      if (!mintData || mintData.length === 0) throw new Error("mint_l00 returned no data");

      const newToken = mintData[0].token;
      const newFullUrl = mintData[0].full_url;
      let shortUrl: string | undefined;

      // Step 3: Optionally shorten URL
      if (rmShortenUrl) {
        const { data: shortenData } = await supabase.rpc("shorten_url", {
          _full_url: newFullUrl,
        });
        if (shortenData && shortenData.length > 0) {
          shortUrl = shortenData[0].short_url;
        }
      }

      setRmResult({ token: newToken, fullUrl: newFullUrl, shortUrl });

      // Update local EoA state
      setEoas((prev) =>
        prev.map((e) =>
          e.id === rmSelectedEoa.id ? { ...e, assigned_deck_slug: rmNewDeck } : e,
        ),
      );

      // Refresh tokens for this EoA
      const { data: newTokens } = await supabase
        .from("tokens")
        .select("token,level,minted_at,eoa_id,deck_slug")
        .eq("eoa_id", rmSelectedEoa.id)
        .is("deleted_at", null);
      setRmTokens((newTokens as TokenInfo[]) ?? []);

      toast({
        title: "Re-mint successful ✓",
        description: `New L00 token minted for deck "${rmNewDeck}"`,
      });
    } catch (err: any) {
      toast({
        title: "Re-mint failed",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRmSaving(false);
      setRmShowConfirm(false);
      setRmConfirmText("");
    }
  }

  function resetRemintWizard() {
    setRmCampaignId("");
    setRmEoaId("");
    setRmNewDeck("");
    setRmTokens([]);
    setRmConfirmText("");
    setRmResult(null);
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  }

  const repointStep = !selectedUrl ? 1 : !selCampaignId ? 2 : !selEoaId ? 3 : 4;

  /* ── render ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">QR & Token Tools</h1>

      <Tabs defaultValue="repoint" className="space-y-4">
        <TabsList>
          <TabsTrigger value="repoint">Re-point QR</TabsTrigger>
          <TabsTrigger value="remint">Re-Mint EoA</TabsTrigger>
        </TabsList>

        {/* ===== RE-POINT TAB ===== */}
        <TabsContent value="repoint" className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Update the destination URL of existing short codes without minting new tokens.
          </p>

          <div className="border rounded-lg p-6 space-y-6 bg-card">
            {/* Step indicators */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {[
                { n: 1, label: "Short Code" },
                { n: 2, label: "Campaign" },
                { n: 3, label: "Event/Action" },
                { n: 4, label: "Confirm" },
              ].map(({ n, label }, i) => (
                <div key={n} className="flex items-center gap-2">
                  {i > 0 && <span className="text-muted-foreground/40">→</span>}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      repointStep === n
                        ? "bg-primary text-primary-foreground"
                        : repointStep > n
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {repointStep > n ? <Check className="h-3 w-3" /> : n}
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Step 1: Short Code */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Step 1: Enter or search for the short code</Label>
              <div className="relative max-w-md">
                <div className="flex items-center">
                  <span className="text-sm text-muted-foreground font-mono mr-1">/s/</span>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Paste or search short code…"
                      value={shortCodeInput}
                      onChange={(e) => {
                        setShortCodeInput(e.target.value);
                        setShowDropdown(true);
                        const clean = e.target.value.toLowerCase().replace(/^\/s\//, "").replace(/^\/r\//, "");
                        const exact = urls.find((u) => u.short_code.toLowerCase() === clean);
                        if (exact) {
                          selectShortCode(exact);
                        } else {
                          setSelectedUrl(null);
                        }
                      }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                      className="pl-9 font-mono"
                    />
                    {showDropdown && shortCodeInput && !selectedUrl && matchingUrls.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-auto">
                        {matchingUrls.map((row) => {
                          const p = parseFullUrl(row.full_url);
                          return (
                            <button
                              key={row.id}
                              className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between items-center"
                              onMouseDown={(e) => { e.preventDefault(); selectShortCode(row); }}
                            >
                              <span className="font-mono">/s/{row.short_code}</span>
                              <span className="text-xs text-muted-foreground truncate ml-3">
                                {p.campaign || "—"} · {p.deck || "—"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {selectedUrl && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Current destination:</p>
                    <p className="text-xs font-mono bg-muted p-2 rounded break-all">{selectedUrl.full_url}</p>
                    <p className="text-xs text-muted-foreground">{selectedUrl.clicks} clicks</p>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Campaign */}
            {selectedUrl && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Step 2: Select the target campaign</Label>
                <div className="max-w-md">
                  <Select
                    value={selCampaignId}
                    onValueChange={(v) => {
                      setSelCampaignId(v);
                      setSelEoaId("");
                      setDeckOverride("");
                      setUtmIdOverride("");
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select campaign…" /></SelectTrigger>
                    <SelectContent>
                      {campaigns.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.title} ({c.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 3: EoA */}
            {selectedUrl && selCampaignId && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Step 3: Select the Event/Action</Label>
                <div className="max-w-md">
                  <Select
                    value={selEoaId}
                    onValueChange={(v) => {
                      setSelEoaId(v);
                      const eoa = eoas.find((e) => e.id === v);
                      if (eoa) {
                        setDeckOverride(eoa.assigned_deck_slug ?? "");
                        setUtmIdOverride(eoa.utm_id);
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select Event/Action…" /></SelectTrigger>
                    <SelectContent>
                      {filteredEoas.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.title} ({e.mobilize_code ?? "no code"}) — {e.assigned_deck_slug ?? "no deck"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 4: Overrides + Preview + Confirm */}
            {selectedUrl && selCampaignId && selEoaId && (
              <div className="space-y-4 border-t pt-4">
                <Label className="text-sm font-medium">Step 4: Review & Confirm</Label>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div className="space-y-1">
                    <Label className="text-xs">Deck slug</Label>
                    <Input value={deckOverride} onChange={(e) => setDeckOverride(e.target.value)} className="font-mono text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">UTM ID override</Label>
                    <Input value={utmIdOverride} onChange={(e) => setUtmIdOverride(e.target.value)} className="font-mono text-sm" />
                  </div>
                </div>
                {previewUrl && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">New destination</Label>
                    <p className="text-xs font-mono bg-muted p-2 rounded break-all">{previewUrl}</p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Checkbox id="reset-clicks" checked={resetClicks} onCheckedChange={(v) => setResetClicks(v === true)} />
                  <Label htmlFor="reset-clicks" className="text-sm">Reset click count to 0</Label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetRepointWizard}>Start Over</Button>
                  <Button onClick={handleSave} disabled={saving || !previewUrl}>
                    {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Confirm Re-point
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Collapsible reference table */}
          <Collapsible open={tableOpen} onOpenChange={setTableOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="text-sm text-muted-foreground gap-1">
                {tableOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                All shortened URLs ({urls.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 mt-2">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Filter table…" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="border rounded-lg overflow-auto max-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Short Code</TableHead>
                      <TableHead>Deck</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>UTM ID</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableFiltered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No shortened URLs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      tableFiltered.map((row) => {
                        const p = parseFullUrl(row.full_url);
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono">/s/{row.short_code}</TableCell>
                            <TableCell>{p.deck || "—"}</TableCell>
                            <TableCell>{p.campaign || "—"}</TableCell>
                            <TableCell>{p.utmId || "—"}</TableCell>
                            <TableCell className="text-right">{row.clicks}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => selectShortCode(row)}>Use</Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>

        {/* ===== RE-MINT TAB ===== */}
        <TabsContent value="remint" className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Change an EoA's assigned deck and re-mint the L00 token. <strong>Warning:</strong> this deletes all existing tokens for the EoA.
          </p>

          <div className="border rounded-lg p-6 space-y-6 bg-card">
            {/* Step 1: Campaign */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Step 1: Select Campaign</Label>
              <div className="max-w-md">
                <Select
                  value={rmCampaignId}
                  onValueChange={(v) => {
                    setRmCampaignId(v);
                    setRmEoaId("");
                    setRmNewDeck("");
                    setRmResult(null);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select campaign…" /></SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title} ({c.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Step 2: EoA */}
            {rmCampaignId && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Step 2: Select Event/Action</Label>
                <div className="max-w-md">
                  <Select
                    value={rmEoaId}
                    onValueChange={(v) => {
                      setRmEoaId(v);
                      setRmNewDeck("");
                      setRmResult(null);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select Event/Action…" /></SelectTrigger>
                    <SelectContent>
                      {rmFilteredEoas.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.title} ({e.mobilize_code ?? "no code"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Current status */}
                {rmSelectedEoa && (
                  <div className="max-w-lg space-y-2 mt-3 p-3 bg-muted rounded-lg">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-muted-foreground">Mobilize Code:</span>
                      <span className="font-mono">{rmSelectedEoa.mobilize_code || "—"}</span>
                      <span className="text-muted-foreground">UTM ID:</span>
                      <span className="font-mono">{rmSelectedEoa.utm_id}</span>
                      <span className="text-muted-foreground">Current Deck:</span>
                      <span className="font-mono">{rmSelectedEoa.assigned_deck_slug || "none"}</span>
                    </div>
                    {rmLoadingTokens ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading tokens…
                      </div>
                    ) : (
                      <div className="text-sm space-y-1">
                        {rmL00Token ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">L00 Token:</span>
                            <span className="font-mono text-xs">{rmL00Token.token}</span>
                            <span className="text-xs text-muted-foreground">
                              (minted {new Date(rmL00Token.minted_at).toLocaleDateString()})
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No L00 token minted</span>
                        )}
                        {rmInstanceCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {rmInstanceCount} L00 instance(s)
                          </span>
                        )}
                        {rmChildTokenCount > 0 && (
                          <span className="text-xs text-destructive font-medium">
                            ⚠ {rmChildTokenCount} child token(s) (L01–L03) will be permanently deleted
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: New Deck */}
            {rmSelectedEoa && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Step 3: Select New Deck</Label>
                <div className="max-w-md">
                  <Select value={rmNewDeck} onValueChange={setRmNewDeck}>
                    <SelectTrigger><SelectValue placeholder="Select deck…" /></SelectTrigger>
                    <SelectContent>
                      {decks.map((d) => (
                        <SelectItem key={d.slug} value={d.slug}>
                          {d.slug}
                          {d.slug === rmSelectedEoa.assigned_deck_slug && " (current)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {rmNewDeck && rmNewDeck === rmSelectedEoa.assigned_deck_slug && (
                  <p className="text-xs text-muted-foreground">
                    Same deck as current assignment — this will still delete and re-mint tokens.
                  </p>
                )}
              </div>
            )}

            {/* Step 4: Confirm */}
            {rmNewDeck && rmSelectedEoa && (
              <div className="space-y-4 border-t pt-4">
                <Label className="text-sm font-medium">Step 4: Confirm Re-Mint</Label>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rm-shorten"
                    checked={rmShortenUrl}
                    onCheckedChange={(v) => setRmShortenUrl(v === true)}
                  />
                  <Label htmlFor="rm-shorten" className="text-sm">Generate short URL for new token</Label>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetRemintWizard}>Start Over</Button>
                  <Button
                    variant="destructive"
                    onClick={() => setRmShowConfirm(true)}
                    disabled={rmSaving}
                  >
                    {rmSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Re-Mint Token
                  </Button>
                </div>
              </div>
            )}

            {/* Result */}
            {rmResult && (
              <div className="border rounded-lg p-4 bg-primary/5 space-y-3">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" /> Re-Mint Complete
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Token:</span>
                    <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{rmResult.token}</code>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyToClipboard(rmResult.token, "Token")}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Full URL:</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => copyToClipboard(rmResult.fullUrl, "Full URL")}>
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>
                  {rmResult.shortUrl && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Short URL:</span>
                      <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{rmResult.shortUrl}</code>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyToClipboard(rmResult.shortUrl!, "Short URL")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== RE-MINT CONFIRMATION DIALOG ===== */}
      <AlertDialog open={rmShowConfirm} onOpenChange={setRmShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Re-Mint
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will change <strong>{rmSelectedEoa?.title}</strong>'s deck from{" "}
                  <code className="font-mono text-xs">{rmSelectedEoa?.assigned_deck_slug || "none"}</code> to{" "}
                  <code className="font-mono text-xs">{rmNewDeck}</code>.
                </p>
                <p className="text-destructive font-medium">
                  All existing tokens ({rmTokens.length}) will be permanently deleted, including{" "}
                  {rmChildTokenCount} child token(s) and {rmInstanceCount} L00 instance(s).
                  This action cannot be undone.
                </p>
                {rmTokens.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">Type <strong>RE-MINT</strong> to confirm:</Label>
                    <Input
                      value={rmConfirmText}
                      onChange={(e) => setRmConfirmText(e.target.value)}
                      placeholder="RE-MINT"
                      className="font-mono"
                    />
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRmConfirmText("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemint}
              disabled={rmTokens.length > 0 && rmConfirmText !== "RE-MINT"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rmSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Re-Mint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
