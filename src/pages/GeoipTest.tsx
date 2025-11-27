import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function GeoipTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testGeoip = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    console.log("🧪 TEST: Starting geoip test...");
    
    try {
      console.log("🧪 TEST: Calling supabase.functions.invoke('geoip')...");
      
      const { data, error: invokeError } = await supabase.functions.invoke('geoip');
      
      console.log("🧪 TEST: Response received:", { data, error: invokeError });
      
      if (invokeError) {
        console.error("🧪 TEST: Error from invoke:", invokeError);
        setError(JSON.stringify(invokeError, null, 2));
      } else {
        console.log("🧪 TEST: Success! Data:", data);
        setResult(data);
      }
    } catch (err) {
      console.error("🧪 TEST: Exception caught:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>Geoip Function Test Harness</CardTitle>
          <CardDescription>
            Test the geoip edge function directly and view the response
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={testGeoip} 
            disabled={loading}
            className="w-full"
          >
            {loading ? "Testing..." : "Test Geoip Function"}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                <pre className="text-xs overflow-auto">{error}</pre>
              </AlertDescription>
            </Alert>
          )}

          {result && (
            <Card className="bg-muted">
              <CardHeader>
                <CardTitle className="text-sm">Response Data</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          <Card className="bg-muted">
            <CardHeader>
              <CardTitle className="text-sm">Instructions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>1. Open browser console to see detailed logs</p>
              <p>2. Click "Test Geoip Function" button</p>
              <p>3. Check the console for 🧪 TEST logs</p>
              <p>4. View the response or error above</p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
