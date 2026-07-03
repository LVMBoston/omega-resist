import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Printer } from "lucide-react";
import { composeRefrigSheetPng } from "@/lib/refrigSheet";
import { mintShare } from "@/lib/virality/mint";

/**
 * Mobile "Print Sheet" landing hit from the fridge-sheet Print QR.
 *
 *   /fp/:token
 *
 * Regenerates the same 3-QR fridge sheet (with freshly-minted child
 * tokens off the print token so downstream scans stay attributed) and
 * auto-invokes the browser's print dialog, which routes to the user's
 * default printer. Works on desktop and iOS Safari (AirPrint).
 */
export default function FridgePrint() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>("");
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      if (!token) {
        setError("Missing token in URL.");
        setStatus("error");
        return;
      }
      try {
        void supabase.rpc("log_event", {
          _token: token,
          _event_type: "refrig_print_scanned",
        });

        const { data: row } = await supabase
          .from("tokens")
          .select("utm_campaign")
          .eq("token", token)
          .maybeSingle();

        let campaignTitle = "Campaign";
        if (row?.utm_campaign) {
          const { data: campaign } = await supabase
            .from("campaigns")
            .select("title")
            .eq("code", row.utm_campaign)
            .maybeSingle();
          if (campaign?.title) campaignTitle = campaign.title;
        }

        // Mint fresh child tokens off the print token so each printed
        // copy tracks its own lineage.
        const [storyMint, smsMint, emailMint] = await Promise.all([
          mintShare({ parentToken: token, utmMedium: "refrig" }),
          mintShare({ parentToken: token, utmMedium: "sms" }),
          mintShare({ parentToken: token, utmMedium: "em" }),
        ]);

        const origin = window.location.origin;
        const blob = await composeRefrigSheetPng({
          campaignTitle,
          qrs: [
            { url: `${origin}/fs/${storyMint.token}`, label: "Display Status" },
            { url: `${origin}/fx/${smsMint.token}?a=sms`, label: "Text Deck" },
            { url: `${origin}/fx/${emailMint.token}?a=em`, label: "Email Deck" },
          ],
        });

        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImgUrl(objectUrl);
        setStatus("ready");

        // Wait for the image to render, then fire print.
        setTimeout(() => {
          if (!cancelled) window.print();
        }, 600);
      } catch (e) {
        console.error("[FridgePrint] failed:", e);
        if (!cancelled) {
          setError("Something went wrong preparing the sheet.");
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token]);

  if (status === "error") {
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-4">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .print-sheet { width: 100vw; max-width: 100%; }
        }
      `}</style>

      {status === "loading" && (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Preparing sheet for printing…</p>
        </div>
      )}

      {status === "ready" && imgUrl && (
        <>
          <div className="no-print w-full max-w-2xl text-center mb-4 mt-2">
            <p className="text-sm text-muted-foreground mb-3">
              If the print dialog didn't open, tap the button below.
            </p>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground font-medium hover:opacity-90"
            >
              <Printer className="h-4 w-4" />
              Print sheet
            </button>
          </div>
          <img
            src={imgUrl}
            alt="Fridge sheet"
            className="print-sheet w-full max-w-3xl border rounded shadow"
          />
        </>
      )}
    </div>
  );
}
