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
      console.log("📍 Supabase Anon Key:", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.substring(0, 20) + "...");
      
      // Test 1: Try with supabase client
      console.log("Test 1: Using Supabase client invoke");
      const { data, error: invokeError } = await supabase.functions.invoke('geoip', {
        method: 'GET'
      });

      if (invokeError) {
        console.error("❌ Invoke error:", invokeError);
        
        // Test 2: Try with direct fetch
        console.log("Test 2: Trying direct fetch");
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geoip`;
        console.log("Fetching:", url);
        
        const fetchResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log("Fetch status:", fetchResponse.status);
        const fetchData = await fetchResponse.json();
        console.log("Fetch data:", fetchData);
        
        setResult({
          method: 'fetch',
          status: fetchResponse.status,
          data: fetchData
        });
      } else {
        console.log("✅ Success:", data);
        setResult({
          method: 'supabase-client',
          data
        });
      }
    } catch (err: any) {
      console.error("❌ Catch error:", err);
      setError({
        name: err?.name || 'Unknown',
        message: err?.message || 'Unknown error',
        stack: err?.stack,
        context: err?.context
      });
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
