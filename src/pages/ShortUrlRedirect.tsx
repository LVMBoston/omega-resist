import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/virality/mint";
import { Loader2 } from "lucide-react";

const ShortUrlRedirect = () => {
  console.log("🔀 ShortUrlRedirect component mounted");
  
  const { code } = useParams<{ code: string }>();
  console.log("🔑 Short code from URL:", code);
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("🔀🔀🔀 ShortUrlRedirect useEffect running - START");
    
    const redirect = async () => {
      if (!code) {
        console.log("❌ No short code provided");
        setError("No redirect code provided");
        return;
      }

      console.log("🔀 Calling track_redirect with code:", code);

      try {
        // Get full URL
        const { data: urlData, error: fetchError } = await supabase
          .from("shortened_urls")
          .select("full_url, clicks")
          .eq("short_code", code)
          .single();

        if (fetchError || !urlData) {
          console.error("❌ Short URL not found:", fetchError);
          setError("Short URL not found");
          return;
        }

        // Increment click count
        await supabase
          .from("shortened_urls")
          .update({ clicks: (urlData.clicks || 0) + 1 })
          .eq("short_code", code);

        // Extract token from URL to log event with geolocation
        const url = new URL(urlData.full_url);
        const token = url.searchParams.get("t");

        if (token) {
          console.log("🔀🔀 BEFORE logEvent - Token found:", token);
          
          try {
            // Log event with geolocation (this will call the geoip edge function)
            await logEvent({
              token,
              eventType: "view",
              utmSnapshot: Object.fromEntries(url.searchParams.entries()),
            });
            
            console.log("🔀🔀 AFTER logEvent - Success");
          } catch (logError) {
            console.error("🔀🔀 logEvent FAILED:", logError);
            // Continue with redirect even if logging fails
          }
        } else {
          console.log("🔀🔀 NO TOKEN found in URL:", urlData.full_url);
        }

        console.log("🔀🔀 About to redirect to:", urlData.full_url);
        
        // Redirect to the full URL
        window.location.href = urlData.full_url;
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
