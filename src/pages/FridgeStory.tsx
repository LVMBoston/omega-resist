import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { computeCampaignStoryInputs } from "@/shared/render/campaignStoryInputs";
import { formatCampaignStory } from "@/shared/render/campaignStory";

/**
 * Mobile "Display Status" landing hit from the fridge-sheet Story QR.
 *
 *   /fs/:token
 *
 * Resolves the token → campaign, computes the same Campaign Story
 * metrics used by the deck editor and the SSR snapshot, and renders
 * the formatted narrative in a mobile-friendly single column.
 */
export default function FridgeStory() {
  const { token } = useParams<{ token: string }>();
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState<string | null>(null);
  const [campaignTitle, setCampaignTitle] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError("Missing token in URL.");
        return;
      }
      try {
        // Log the scan (non-blocking)
        void supabase.rpc("log_event", {
          _token: token,
          _event_type: "refrig_story_scanned",
        });

        const { data: row, error: rowErr } = await supabase
          .from("tokens")
          .select("utm_campaign")
          .eq("token", token)
          .maybeSingle();
        if (rowErr || !row?.utm_campaign) {
          setError("This link is not tied to an active campaign.");
          return;
        }

        const { data: campaign } = await supabase
          .from("campaigns")
          .select("id, title")
          .eq("code", row.utm_campaign)
          .maybeSingle();
        if (!campaign?.id) {
          setError("Campaign not found.");
          return;
        }
        if (cancelled) return;
        setCampaignTitle(campaign.title || row.utm_campaign);

        const inputs = await computeCampaignStoryInputs(supabase, {
          campaignCode: row.utm_campaign,
          campaignId: campaign.id,
          dataSource: "real",
        });
        if (cancelled) return;

        const text = formatCampaignStory({
          ...inputs,
          activeAnchorMs: new Date(inputs.campaignActiveAnchor).getTime(),
          nowMs: Date.now(),
          includeTitle: false,
        });
        setStory(text);
      } catch (e) {
        console.error("[FridgeStory] failed:", e);
        if (!cancelled) setError("Something went wrong loading the report.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md text-center">
          <p className="text-muted-foreground">{error}</p>
          <Link to="/" className="text-primary underline mt-4 inline-block">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-5 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-primary mb-6">
          Campaign: {campaignTitle}
        </h1>
        <pre className="whitespace-pre-wrap font-sans text-base leading-relaxed">
          {story.replace(/__TITLE__.*?__TITLE__\n?/g, "")}
        </pre>
      </div>
    </div>
  );
}
