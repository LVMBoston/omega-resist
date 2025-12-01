import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const ShortUrlRedirect = () => {
  console.log("🔀 ShortUrlRedirect component mounted");
  
  const { code } = useParams<{ code: string }>();
  console.log("🔑 Short code from URL:", code);
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("🔄 Redirect useEffect running");
    
    const redirect = async () => {
      if (!code) {
        console.log("❌ No short code provided");
        setError("No redirect code provided");
        return;
      }

      console.log("📞 Calling track_redirect with code:", code);

      try {
        // Call the track_redirect function - it returns a text string directly in data
        const { data, error } = await supabase.rpc("track_redirect", {
          _short_code: code,
        });

        console.log("📥 track_redirect response:", { data, error });

        if (error) {
          console.error("❌ RPC error:", error);
          setError("Short URL not found");
          return;
        }

        if (!data) {
          console.error("❌ No URL returned for code:", code);
          setError("Short URL not found");
          return;
        }

        console.log("✅ Redirecting to:", data);
        
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
