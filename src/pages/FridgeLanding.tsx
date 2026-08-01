import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Mail, MessageSquare, Loader2 } from "lucide-react";
import { buildSmsComposerUrl } from "@/lib/openComposer";

interface TokenInfo {
  deckSlug: string;
  campaignCode: string | null;
  campaignTitle: string | null;
  level: number;
  shareUrl: string;
}

/**
 * Landing page for REFRIG QR scans (`/fridge/:token`).
 *
 * Offers three options:
 *   1. View — open the deck directly
 *   2. Email — open the user's mail composer pre-filled with the share link
 *   3. Text  — open the user's SMS composer pre-filled with the share link
 *
 * The token itself is opaque; lineage (root/parent/level) is resolved
 * server-side via the existing `tokens` row.
 */
export default function FridgeLanding() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError("Missing token in URL.");
        return;
      }
      try {
        // Log the scan (best-effort; non-blocking)
        void supabase.rpc("log_event", {
          _token: token,
          _event_type: "refrig_scanned",
        });

        const { data: row, error: rowErr } = await supabase
          .from("tokens")
          .select("deck_slug, utm_campaign, level, full_url")
          .eq("token", token)
          .maybeSingle();

        if (cancelled) return;
        if (rowErr || !row) {
          setError("This share link could not be found.");
          return;
        }

        let campaignTitle: string | null = null;
        if (row.utm_campaign) {
          const { data: campaign } = await supabase
            .from("campaigns")
            .select("title")
            .eq("code", row.utm_campaign)
            .maybeSingle();
          campaignTitle = campaign?.title ?? null;
        }

        const shareUrl =
          row.full_url ?? `${window.location.origin}/deck/${row.deck_slug}?t=${token}`;

        setInfo({
          deckSlug: row.deck_slug,
          campaignCode: row.utm_campaign,
          campaignTitle,
          level: row.level ?? 0,
          shareUrl,
        });
      } catch (e) {
        console.error("[FridgeLanding] lookup failed:", e);
        if (!cancelled) setError("Something went wrong loading this link.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Link unavailable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <Link to="/" className="text-primary underline mt-4 inline-block">
              Go home
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const title = info.campaignTitle ?? info.deckSlug;
  const subject = `Check this out: ${title}`;
  const body = `I thought you'd want to see this:\n\n${info.shareUrl}\n`;
  const smsBody = `Thought you'd want to see this: ${info.shareUrl}`;

  const mailHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const smsHref = buildSmsComposerUrl(smsBody);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-background to-muted">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{title}</CardTitle>
          {info.campaignTitle && (
            <p className="text-sm text-muted-foreground mt-1">{info.deckSlug}</p>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild size="lg" className="w-full justify-start">
            <a href={info.shareUrl}>
              <Eye className="mr-3 h-5 w-5" />
              View the deck
            </a>
          </Button>
          <Button asChild size="lg" variant="secondary" className="w-full justify-start">
            <a href={mailHref}>
              <Mail className="mr-3 h-5 w-5" />
              Share by Email
            </a>
          </Button>
          <Button asChild size="lg" variant="secondary" className="w-full justify-start">
            <a href={smsHref}>
              <MessageSquare className="mr-3 h-5 w-5" />
              Share by Text
            </a>
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-4">
            Level L{String(info.level).padStart(2, "0")} · shared from a printed sheet
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
