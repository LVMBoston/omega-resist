import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const ShortUrlRedirect = () => {
  const { code } = useParams<{ code: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const redirect = async () => {
      if (!code) {
        setError("No redirect code provided");
        return;
      }

      try {
        // Call the track_redirect function to get full URL and increment clicks
        const { data, error: rpcError } = await supabase.rpc("track_redirect", {
          _short_code: code,
        });

        if (rpcError || !data) {
          setError("Short URL not found");
          console.error("Redirect error:", rpcError);
          return;
        }

        // Redirect to the full URL
        window.location.href = data;
      } catch (err) {
        console.error("Redirect error:", err);
        setError("Failed to redirect");
      }
    };

    redirect();
  }, [code]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Redirect Error
          </h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
};

export default ShortUrlRedirect;
