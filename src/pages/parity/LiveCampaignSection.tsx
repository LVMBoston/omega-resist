/**
 * §5 Live Campaign — Parity Harness real-data mode.
 *
 * Loads a real campaign + slide and renders side-by-side:
 *   LEFT:  <HybridSlide/> (the editor / viewer code path)
 *   RIGHT: an <img> of the freshly-rendered SVG from render-stats-snapshot
 *
 * Optional 50% overlay toggle places the SSR output on top of the editor
 * output at half opacity so you can eyeball pixel drift.
 *
 * Read-only: no schema changes, no new APIs.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HybridSlide } from "@/components/HybridSlide";
import { Loader2, RefreshCw } from "lucide-react";

interface Campaign {
  id: string;
  code: string;
  title: string;
}

interface SlideRow {
  id: string;
  position: number | null;
  deck_slug: string;
  template_id: string | null;
  content_url: string | null;
  hotspots: unknown;
}

const BOX_W = 360;
const BOX_H = 640;

export function LiveCampaignSection() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState<string>("");
  const [deckSlugs, setDeckSlugs] = useState<string[]>([]);
  const [deckSlug, setDeckSlug] = useState<string>("");
  const [slides, setSlides] = useState<SlideRow[]>([]);
  const [slideId, setSlideId] = useState<string>("");
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(false);
  const [loadingSlides, setLoadingSlides] = useState(false);

  // 1. Load campaigns the user can see (RLS scoped).
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, code, title")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        console.error("[parity] load campaigns failed", error);
        return;
      }
      setCampaigns(data || []);
    })();
  }, []);

  // 2. When a campaign is picked, find its deck slugs via events_actions.
  useEffect(() => {
    if (!campaignId) {
      setDeckSlugs([]);
      setDeckSlug("");
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("events_actions")
        .select("assigned_deck_slug")
        .eq("campaign_id", campaignId);
      if (error) {
        console.error("[parity] load EoAs failed", error);
        return;
      }
      const uniq = Array.from(
        new Set(
          (data || [])
            .map((r) => (r as { assigned_deck_slug: string | null }).assigned_deck_slug)
            .filter((s): s is string => !!s),
        ),
      );
      setDeckSlugs(uniq);
      setDeckSlug(uniq[0] || "");
    })();
  }, [campaignId]);

  // 3. When a deck is picked, load its slides + template configs.
  useEffect(() => {
    if (!deckSlug) {
      setSlides([]);
      setSlideId("");
      return;
    }
    setLoadingSlides(true);
    (async () => {
      const { data: items, error } = await supabase
        .from("slide_items")
        .select("id, position, deck_slug, template_id, content_url")
        .eq("deck_slug", deckSlug)
        .order("position", { ascending: true });
      if (error) {
        console.error("[parity] load slides failed", error);
        setLoadingSlides(false);
        return;
      }
      // Pull hotspots from the linked viral_slide_configs row for each slide.
      const templateIds = Array.from(
        new Set((items || []).map((s) => s.template_id).filter((t): t is string => !!t)),
      );
      let hotspotsByTpl = new Map<string, unknown>();
      if (templateIds.length > 0) {
        const { data: tpls, error: tplErr } = await supabase
          .from("viral_slide_configs")
          .select("id, hotspots")
          .in("id", templateIds);
        if (tplErr) console.error("[parity] load templates failed", tplErr);
        hotspotsByTpl = new Map((tpls || []).map((t) => [t.id, (t as { hotspots: unknown }).hotspots]));
      }
      const merged: SlideRow[] = (items || []).map((s) => ({
        id: s.id,
        position: s.position,
        deck_slug: s.deck_slug,
        template_id: s.template_id,
        content_url: s.content_url,
        hotspots: s.template_id ? hotspotsByTpl.get(s.template_id) ?? [] : [],
      }));
      setSlides(merged);
      setSlideId(merged[0]?.id || "");
      setLoadingSlides(false);
    })();
  }, [deckSlug]);

  const selectedSlide = useMemo(
    () => slides.find((s) => s.id === slideId) || null,
    [slides, slideId],
  );
  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === campaignId) || null,
    [campaigns, campaignId],
  );

  // Reset snapshot when selection changes.
  useEffect(() => {
    setSnapshotUrl(null);
    setRenderError(null);
  }, [slideId, campaignId]);

  const handleRender = async () => {
    if (!selectedSlide?.template_id || !selectedCampaign?.code) return;
    setRendering(true);
    setRenderError(null);
    try {
      const res = await supabase.functions.invoke("render-stats-snapshot", {
        body: {
          template_id: selectedSlide.template_id,
          campaign_code: selectedCampaign.code,
        },
      });
      if (res.error) throw new Error(res.error.message || "Render failed");
      const url = (res.data as { snapshot_url?: string } | null)?.snapshot_url;
      if (!url) throw new Error("No snapshot_url returned");
      setSnapshotUrl(`${url}?v=${Date.now()}`);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : String(err));
    } finally {
      setRendering(false);
    }
  };

  const hotspots = Array.isArray(selectedSlide?.hotspots) ? (selectedSlide!.hotspots as never[]) : [];

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>§5 Live Campaign (real data)</h2>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <label style={lbl}>
          Campaign:
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} style={sel}>
            <option value="">— pick a campaign —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.code} · {c.title}</option>
            ))}
          </select>
        </label>

        {deckSlugs.length > 1 && (
          <label style={lbl}>
            Deck:
            <select value={deckSlug} onChange={(e) => setDeckSlug(e.target.value)} style={sel}>
              {deckSlugs.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}

        <label style={lbl}>
          Slide:
          <select value={slideId} onChange={(e) => setSlideId(e.target.value)} style={sel} disabled={!slides.length}>
            {slides.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.position ?? "?"} · {s.template_id ? s.template_id.slice(0, 8) : "no template"}
              </option>
            ))}
          </select>
        </label>

        <button onClick={handleRender} disabled={!selectedSlide?.template_id || rendering} style={btn}>
          {rendering ? <Loader2 className="inline w-3 h-3 animate-spin" /> : <RefreshCw className="inline w-3 h-3" />}{" "}
          {snapshotUrl ? "Re-render SSR" : "Render SSR"}
        </button>

        <label style={{ ...lbl, gap: 4 }}>
          <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
          Overlay SSR @ 50%
        </label>
      </div>

      {renderError && (
        <div style={{ color: "#ff8a8a", marginBottom: 12, fontSize: 12 }}>
          Render error: {renderError}
        </div>
      )}

      {loadingSlides && <div style={{ opacity: 0.7 }}>Loading slides…</div>}

      {selectedSlide && selectedCampaign && (
        <div style={{ display: "grid", gridTemplateColumns: `${BOX_W}px ${BOX_W}px`, gap: 24, alignItems: "start" }}>
          {/* LEFT — editor / HybridSlide */}
          <div>
            <div style={{ fontSize: 11, marginBottom: 4, opacity: 0.7 }}>
              EDITOR (HybridSlide) · campaign {selectedCampaign.code}
            </div>
            <div style={{ width: BOX_W, height: BOX_H, background: "#000", outline: "1px dashed #888", position: "relative" }}>
              <HybridSlide
                imageUrl={selectedSlide.content_url || ""}
                hotspots={hotspots}
                deckSlug={selectedSlide.deck_slug}
                viralToken={null}
                templateId={selectedSlide.template_id || undefined}
              />
              {overlay && snapshotUrl && (
                <img
                  src={snapshotUrl}
                  alt="SSR overlay"
                  style={{
                    position: "absolute", inset: 0,
                    width: "100%", height: "100%",
                    objectFit: "contain", opacity: 0.5, pointerEvents: "none",
                  }}
                />
              )}
            </div>
          </div>

          {/* RIGHT — SSR snapshot */}
          <div>
            <div style={{ fontSize: 11, marginBottom: 4, opacity: 0.7 }}>
              SSR (render-stats-snapshot){snapshotUrl ? "" : " — click Render to fetch"}
            </div>
            <div style={{ width: BOX_W, height: BOX_H, background: "#000", outline: "1px dashed #888", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {snapshotUrl ? (
                <img src={snapshotUrl} alt="SSR snapshot" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              ) : (
                <span style={{ opacity: 0.5, fontSize: 12 }}>(not rendered yet)</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 };
const sel: React.CSSProperties = {
  padding: "4px 8px", fontSize: 12, background: "#3b3b3b", color: "#fff",
  border: "1px solid #555", borderRadius: 4,
};
const btn: React.CSSProperties = {
  padding: "5px 12px", fontSize: 12, borderRadius: 4,
  border: "1px solid #555", background: "#5b8def", color: "#fff", cursor: "pointer",
};
