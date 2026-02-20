import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Search, RotateCcw } from "lucide-react";

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
  const [search, setSearch] = useState("");

  // dialog state
  const [selected, setSelected] = useState<ShortenedUrl | null>(null);
  const [selCampaignId, setSelCampaignId] = useState("");
  const [selEoaId, setSelEoaId] = useState("");
  const [deckOverride, setDeckOverride] = useState("");
  const [utmIdOverride, setUtmIdOverride] = useState("");
  const [resetClicks, setResetClicks] = useState(false);
  const [saving, setSaving] = useState(false);

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
  const filtered = useMemo(() => {
    if (!search) return urls;
    const s = search.toLowerCase();
    return urls.filter((u) => {
      const p = parseFullUrl(u.full_url);
      return (
        u.short_code.toLowerCase().includes(s) ||
        p.deck.toLowerCase().includes(s) ||
        p.campaign.toLowerCase().includes(s)
      );
    });
  }, [urls, search]);

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

  /* ── open dialog ── */
  function openRepoint(row: ShortenedUrl) {
    const parsed = parseFullUrl(row.full_url);
    setSelected(row);
    setResetClicks(false);
    setSaving(false);

    // try to pre-select campaign & eoa from current URL
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
    if (!selected || !previewUrl) return;
    setSaving(true);
    const oldUrl = selected.full_url;

    const updates: Record<string, unknown> = { full_url: previewUrl };
    if (resetClicks) updates.clicks = 0;

    const { error } = await supabase
      .from("shortened_urls")
      .update(updates)
      .eq("id", selected.id);

    setSaving(false);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }

    // refresh local state
    setUrls((prev) =>
      prev.map((u) =>
        u.id === selected.id
          ? { ...u, full_url: previewUrl, clicks: resetClicks ? 0 : u.clicks }
          : u,
      ),
    );
    setSelected(null);

    toast({
      title: "Short code re-pointed",
      description: `${selected.short_code}: URL updated${resetClicks ? " (clicks reset)" : ""}`,
    });

    console.log("[repoint]", { short_code: selected.short_code, oldUrl, newUrl: previewUrl });
  }

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

      {/* search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by short code, deck, or campaign…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* table */}
      <div className="border rounded-lg overflow-auto">
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
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No shortened URLs found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => {
                const p = parseFullUrl(row.full_url);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">{row.short_code}</TableCell>
                    <TableCell>{p.deck || "—"}</TableCell>
                    <TableCell>{p.campaign || "—"}</TableCell>
                    <TableCell>{p.utmId || "—"}</TableCell>
                    <TableCell className="text-right">{row.clicks}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openRepoint(row)}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Re-point
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* re-point dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Re-point: <span className="font-mono">{selected?.short_code}</span></DialogTitle>
            <DialogDescription>
              Change the destination URL for this short code. Printed cards using <span className="font-mono">/s/{selected?.short_code}</span> will redirect to the new URL.
            </DialogDescription>
          </DialogHeader>

          {/* current destination */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Current destination</Label>
            <p className="text-xs font-mono bg-muted p-2 rounded break-all">{selected?.full_url}</p>
          </div>

          {/* campaign selector */}
          <div className="space-y-1">
            <Label>Campaign</Label>
            <Select
              value={selCampaignId}
              onValueChange={(v) => {
                setSelCampaignId(v);
                setSelEoaId("");
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

          {/* eoa selector */}
          <div className="space-y-1">
            <Label>Event / Action</Label>
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
              disabled={!selCampaignId}
            >
              <SelectTrigger><SelectValue placeholder={selCampaignId ? "Select EoA…" : "Select campaign first"} /></SelectTrigger>
              <SelectContent>
                {filteredEoas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.title} ({e.mobilize_code ?? "no code"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* overrides */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Deck slug</Label>
              <Input value={deckOverride} onChange={(e) => setDeckOverride(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>UTM ID override</Label>
              <Input value={utmIdOverride} onChange={(e) => setUtmIdOverride(e.target.value)} />
            </div>
          </div>

          {/* preview */}
          {previewUrl && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">New destination preview</Label>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !previewUrl}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirm Re-point
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
