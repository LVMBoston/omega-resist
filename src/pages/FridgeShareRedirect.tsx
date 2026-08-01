import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { openComposer } from "@/lib/openComposer";
import { buildSmsComposerUrl } from "@/lib/openComposer";

/**
 * Auto-share redirector hit from the fridge-sheet Text/Email QRs.
 *
 *   /fx/:token?a=sms   → opens sms: composer pre-filled from campaign template
 *   /fx/:token?a=em    → opens mailto: composer pre-filled from campaign template
 *
 * The `:token` is a pre-minted child token with the intended `utm_medium`
 * already set at print time. When someone scans the printed QR we:
 *   1. Look up the token → EoA → campaign so we can pull the correct
 *      messaging template (L00 vs L01 voice).
 *   2. Fire the sms:/mailto: composer with the token's full deck URL.
 *   3. Show a short "Opening..." card so the user has something to see if
 *      the composer is slow to appear (iOS especially).
 */
export default function FridgeShareRedirect() {
  const { token } = useParams<{ token: string }>();
  const [search] = useSearchParams();
  const action = (search.get("a") || "").toLowerCase(); // "sms" | "em"
  const [status, setStatus] = useState<"loading" | "opened" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [composerUrl, setComposerUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token || (action !== "sms" && action !== "em")) {
        setErrorMsg("This link is missing information needed to open a share.");
        setStatus("error");
        return;
      }
      try {
        void supabase.rpc("log_event", {
          _token: token,
          _event_type: action === "sms" ? "refrig_text_scanned" : "refrig_email_scanned",
        });

        const { data: row, error: rowErr } = await supabase
          .from("tokens")
          .select("full_url, deck_slug, eoa_id, level")
          .eq("token", token)
          .maybeSingle();
        if (rowErr || !row) {
          setErrorMsg("This share link could not be found.");
          setStatus("error");
          return;
        }

        const shareUrl =
          row.full_url ??
          `${window.location.origin}/deck/${row.deck_slug}?t=${token}`;

        // Resolve EoA → campaign → template
        let campaignId: string | null = null;
        let mobilizeCode: string | null = null;
        let city: string | null = null;
        let state: string | null = null;
        let siteName: string | null = null;
        if (row.eoa_id) {
          const { data: eoa } = await supabase
            .from("events_actions")
            .select("campaign_id, mobilize_code, city, state, site_name")
            .eq("id", row.eoa_id)
            .maybeSingle();
          if (eoa) {
            campaignId = eoa.campaign_id;
            mobilizeCode = eoa.mobilize_code;
            city = eoa.city;
            state = eoa.state;
            siteName = eoa.site_name;
          }
        }

        const templateKey =
          (row.level ?? 0) === 0 ? "l00_template" : "l01_template";
        const category = action === "sms" ? "sms" : "email";

        let template: any = null;
        if (campaignId) {
          const { data } = await supabase.rpc("resolve_message_template", {
            p_campaign_id: campaignId,
            p_mobilize_code: mobilizeCode,
            p_category: category,
            p_key: templateKey,
          });
          template = data;
        }
        if (!template) {
          const { data } = await supabase
            .from("settings")
            .select("value")
            .eq("category", category)
            .eq("key", templateKey)
            .maybeSingle();
          template = data?.value;
        }

        const subGeo = (t: string) =>
          t
            .replace(/\{\{city\}\}/g, city || "")
            .replace(/\{\{state\}\}/g, state || "")
            .replace(/\{\{site_name\}\}/g, siteName || "");

        let composer: string;
        if (action === "sms") {
          const body = template?.body
            ? subGeo(template.body.replace("{{link}}", shareUrl))
            : `Thought you'd want to see this: ${shareUrl}`;
          composer = buildSmsComposerUrl(body);
        } else {
          const subject = template?.subject
            ? subGeo(template.subject)
            : "Check this out";
          const body = template?.body
            ? subGeo(template.body.replace("{{link}}", shareUrl))
            : `I thought you'd want to see this:\n\n${shareUrl}\n`;
          composer = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }

        if (cancelled) return;
        setComposerUrl(composer);
        setStatus("opened");
        // Trigger the composer.
        openComposer(composer);
      } catch (e) {
        console.error("[FridgeShareRedirect] failed:", e);
        if (!cancelled) {
          setErrorMsg("Something went wrong opening this share.");
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, action]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md text-center">
          <p className="text-muted-foreground">{errorMsg}</p>
          <Link to="/" className="text-primary underline mt-4 inline-block">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-lg font-medium">
          {composerUrl
            ? `Open your ${action === "sms" ? "text message" : "email"}`
            : `Preparing your ${action === "sms" ? "text message" : "email"}…`}
        </p>
      {composerUrl && (
        <a
          href={composerUrl}
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-6 font-medium text-primary-foreground"
        >
          Tap to open
        </a>
      )}
    </div>
  );
}
