import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

interface GeoLocationData {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  zip_code: string | null;
}

export function GeoipDebugPanel() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [geoData, setGeoData] = useState<GeoLocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  const testGeoipFunction = async () => {
    setLoading(true);
    setStatus("idle");
    setError(null);
    setGeoData(null);
    setResponseTime(null);

    const startTime = performance.now();

    try {
      console.log("📍 Testing geoip edge function...");

      const { data, error: functionError } = await supabase.functions.invoke('geoip');

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      setResponseTime(duration);

      if (functionError) {
        console.error("📍 Geoip function error:", functionError);
        setStatus("error");
        setError(functionError.message || "Unknown error");
        return;
      }

      console.log("📍 Geolocation data received:", data);

      setGeoData({
        latitude: data.latitude,
        longitude: data.longitude,
        city: data.city,
        region: data.region,
        country: data.country,
        country_code: data.country_code,
        zip_code: data.zip_code
      });

      setStatus("success");
    } catch (err) {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      setResponseTime(duration);

      console.error("📍 Failed to fetch geolocation:", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Geolocation Debug Tool
        </CardTitle>
        <CardDescription>
          Test the geoip edge function to troubleshoot geolocation capture
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button 
            onClick={testGeoipFunction} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Test Geolocation
              </>
            )}
          </Button>

          {status !== "idle" && (
            <Badge variant={status === "success" ? "default" : "destructive"}>
              {status === "success" ? (
                <><CheckCircle2 className="w-3 h-3 mr-1" /> Success</>
              ) : (
                <><XCircle className="w-3 h-3 mr-1" /> Error</>
              )}
            </Badge>
          )}

          {responseTime !== null && (
            <Badge variant="outline">
              {responseTime}ms
            </Badge>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {geoData && status === "success" && (
          <div className="space-y-3">
            <Alert>
              <AlertDescription>
                <strong>✅ Geolocation captured successfully</strong>
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border bg-card p-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Latitude</div>
                <div className="text-lg font-mono">
                  {geoData.latitude !== null ? geoData.latitude.toFixed(4) : "null"}
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-muted-foreground">Longitude</div>
                <div className="text-lg font-mono">
                  {geoData.longitude !== null ? geoData.longitude.toFixed(4) : "null"}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">City</div>
                <div className="text-lg">
                  {geoData.city || <span className="text-muted-foreground italic">null</span>}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Region</div>
                <div className="text-lg">
                  {geoData.region || <span className="text-muted-foreground italic">null</span>}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Country</div>
                <div className="text-lg">
                  {geoData.country || <span className="text-muted-foreground italic">null</span>}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Country Code</div>
                <div className="text-lg font-mono">
                  {geoData.country_code || <span className="text-muted-foreground italic">null</span>}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Zip Code</div>
                <div className="text-lg font-mono">
                  {geoData.zip_code || <span className="text-muted-foreground italic">null</span>}
                </div>
              </div>
            </div>

            {geoData.latitude && geoData.longitude && (
              <div className="text-sm text-muted-foreground">
                <a 
                  href={`https://www.google.com/maps?q=${geoData.latitude},${geoData.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  View on Google Maps →
                </a>
              </div>
            )}
          </div>
        )}

        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>How this works:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Calls the <code className="text-xs bg-muted px-1 py-0.5 rounded">geoip</code> edge function</li>
            <li>Edge function uses ipapi.co to get your location from IP address</li>
            <li>Same function used by <code className="text-xs bg-muted px-1 py-0.5 rounded">logEvent()</code> when logging URL events</li>
            <li>Local IPs (127.0.0.1, localhost) will return null values</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
