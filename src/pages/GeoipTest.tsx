import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const GeoipTest = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<any>(null);

  const testGeoip = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      console.log("🧪 Testing geoip function from browser...");
      console.log("📍 Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
      
      const { data, error: invokeError } = await supabase.functions.invoke('geoip', {
        method: 'GET'
      });

      if (invokeError) {
        console.error("❌ Invoke error:", invokeError);
        setError(invokeError);
      } else {
        console.log("✅ Success:", data);
        setResult(data);
      }
    } catch (err) {
      console.error("❌ Catch error:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-4">Geoip Function Test</h1>
        
        <Button onClick={testGeoip} disabled={loading}>
          {loading ? "Testing..." : "Test Geoip"}
        </Button>

        {result && (
          <div className="mt-4">
            <h2 className="font-semibold text-green-600">Success!</h2>
            <pre className="bg-muted p-4 rounded mt-2 overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        {error && (
          <div className="mt-4">
            <h2 className="font-semibold text-red-600">Error!</h2>
            <pre className="bg-muted p-4 rounded mt-2 overflow-auto">
              {JSON.stringify(error, null, 2)}
            </pre>
          </div>
        )}
      </Card>
    </div>
  );
};

export default GeoipTest;
