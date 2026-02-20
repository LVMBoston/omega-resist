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
import { Loader2, Search, ChevronDown, ChevronRight, Check } from "lucide-react";

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
  const [loading, setLoading] = useState(true);

  // wizard state
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

  /* ── data loading ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [urlRes, campRes, eoaRes] = await Promise.all([
        supabase.from("shortened_urls").select("*").order("created_at", { ascending: false }),
        supabase.from("campaigns").select("id,code,title").order("title"),
        supabase.from("events_actions").select("id,title,mobilize_code,utm_id,assigned_deck_slug,campaign_id"),
      ]);
      if (urlRes.data) setUrls(urlRes.data);
      if (campRes.data) setCampaigns(campRes.data);
      if (eoaRes.data) setEoas(eoaRes.data as Eoa[]);
      setLoading(false);
    })();
  }, []);

  /* ── derived ── */
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

  /* ── select short code ── */
  function selectShortCode(row: ShortenedUrl) {
    setSelectedUrl(row);
    setShortCodeInput(row.short_code);
    setShowDropdown(false);
    setResetClicks(false);

    // pre-select campaign & eoa from current URL
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

  /* ── save ── */
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

    // reset wizard
    setSelectedUrl(null);
    setShortCodeInput("");
    setSelCampaignId("");
    setSelEoaId("");
    setDeckOverride("");
    setUtmIdOverride("");
    setResetClicks(false);
  }

  /* ── reset wizard ── */
  function resetWizard() {
    setSelectedUrl(null);
    setShortCodeInput("");
    setSelCampaignId("");
    setSelEoaId("");
    setDeckOverride("");
    setUtmIdOverride("");
    setResetClicks(false);
  }

  /* ── current step ── */
  const currentStep = !selectedUrl ? 1 : !selCampaignId ? 2 : !selEoaId ? 3 : 4;

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
      <h1 className="text-2xl font-bold">Re-point QR Codes</h1>
      <p className="text-muted-foreground text-sm">
        Update the destination URL of existing short codes without minting new tokens.
      </p>

      {/* ── WIZARD ── */}
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
                  currentStep === n
                    ? "bg-primary text-primary-foreground"
                    : currentStep > n
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > n ? <Check className="h-3 w-3" /> : n}
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Short Code */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Step 1: Enter or search for the short code
          </Label>
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
                    // check for exact match
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
                {/* autocomplete dropdown */}
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
            <Label className="text-sm font-medium">
              Step 2: Select the target campaign
            </Label>
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
            <Label className="text-sm font-medium">
              Step 3: Select the Event/Action
            </Label>
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
                      {e.title} ({e.mobilize_code ?? "no code"})
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

            {/* overrides */}
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

            {/* preview */}
            {previewUrl && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">New destination</Label>
                <p className="text-xs font-mono bg-muted p-2 rounded break-all">{previewUrl}</p>
              </div>
            )}

            {/* reset clicks */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="reset-clicks"
                checked={resetClicks}
                onCheckedChange={(v) => setResetClicks(v === true)}
              />
              <Label htmlFor="reset-clicks" className="text-sm">Reset click count to 0</Label>
            </div>

            {/* action buttons */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetWizard}>Start Over</Button>
              <Button onClick={handleSave} disabled={saving || !previewUrl}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Confirm Re-point
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── COLLAPSIBLE REFERENCE TABLE ── */}
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
            <Input
              placeholder="Filter table…"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="pl-9"
            />
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => selectShortCode(row)}
                          >
                            Use
                          </Button>
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
    </div>
  );
}
