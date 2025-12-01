import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MapPin, Wifi } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function GeoipTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsResult, setGpsResult] = useState<any>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

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

  const testGPS = async () => {
    setGpsLoading(true);
    setGpsError(null);
    setGpsResult(null);
    
    console.log("📍 GPS TEST: Requesting location permission...");
    
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by this browser");
      setGpsLoading(false);
      return;
    }

    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          console.log("📍 GPS TEST: Permission granted! Position:", position);
          
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          // Find nearest zip code using Haversine distance formula
          console.log("📍 GPS TEST: Looking up nearest zip code...");
          
          try {
            // Query zip_codes table to find closest match
            const { data: zipCodes, error: zipError } = await supabase
              .from('zip_codes')
              .select('zip_code, city, state_name, latitude, longitude')
              .limit(1000); // Get subset to search through
            
            if (zipError) {
              console.error("📍 GPS TEST: Error fetching zip codes:", zipError);
            }
            
            let nearestZip = null;
            let minDistance = Infinity;
            
            if (zipCodes) {
              // Calculate distance to each zip code using Haversine formula
              zipCodes.forEach((zip: any) => {
                const R = 6371; // Earth's radius in km
                const dLat = (zip.latitude - lat) * Math.PI / 180;
                const dLng = (zip.longitude - lng) * Math.PI / 180;
                const a = 
                  Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat * Math.PI / 180) * Math.cos(zip.latitude * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const distance = R * c; // Distance in km
                
                if (distance < minDistance) {
                  minDistance = distance;
                  nearestZip = {
                    zip_code: zip.zip_code,
                    city: zip.city,
                    state: zip.state_name,
                    distance_km: distance.toFixed(2)
                  };
                }
              });
            }
            
            const gpsData = {
              latitude: lat,
              longitude: lng,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: new Date(position.timestamp).toISOString(),
              permission: "granted",
              nearest_zip: nearestZip
            };
            
            console.log("📍 GPS TEST: Success! Data:", gpsData);
            setGpsResult(gpsData);
            setGpsLoading(false);
          } catch (err) {
            console.error("📍 GPS TEST: Error looking up zip:", err);
            // Still show GPS data even if zip lookup fails
            const gpsData = {
              latitude: lat,
              longitude: lng,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: new Date(position.timestamp).toISOString(),
              permission: "granted",
              nearest_zip: null,
              zip_lookup_error: err instanceof Error ? err.message : String(err)
            };
            setGpsResult(gpsData);
            setGpsLoading(false);
          }
        },
        (error) => {
          console.error("📍 GPS TEST: Error:", error);
          
          let errorMessage = "";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Permission denied - User denied the request for Geolocation";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Position unavailable - Location information is unavailable";
              break;
            case error.TIMEOUT:
              errorMessage = "Timeout - The request to get user location timed out";
              break;
            default:
              errorMessage = "Unknown error occurred";
          }
          
          setGpsError(`${errorMessage}\n\nCode: ${error.code}\nMessage: ${error.message}`);
          setGpsLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } catch (err) {
      console.error("📍 GPS TEST: Exception caught:", err);
      setGpsError(err instanceof Error ? err.message : String(err));
      setGpsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 space-y-6">
      {/* IP-based Geolocation Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5" />
            IP-Based Geolocation Test
          </CardTitle>
          <CardDescription>
            Test the geoip edge function that uses your IP address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={testGeoip} 
            disabled={loading}
            className="w-full"
          >
            {loading ? "Testing IP Location..." : "Test IP-Based Location"}
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
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Response Data</CardTitle>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                    IP
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* GPS Location Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            GPS Location Test
          </CardTitle>
          <CardDescription>
            Request GPS permission and get precise coordinates from your device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-[1fr_auto] gap-4 items-start">
            <div className="space-y-4">
              <Button 
                onClick={testGPS} 
                disabled={gpsLoading}
                className="w-full"
                variant="secondary"
              >
                {gpsLoading ? "Requesting GPS Permission..." : "Test GPS Permission"}
              </Button>
            </div>
            
            <Card className="bg-background border-2">
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <QRCodeSVG 
                  value={window.location.href}
                  size={128}
                  level="M"
                  includeMargin={true}
                />
                <p className="text-xs text-center text-muted-foreground max-w-[140px]">
                  Scan to test GPS on your phone
                </p>
              </CardContent>
            </Card>
          </div>

          {gpsError && (
            <Alert variant="destructive">
              <AlertDescription>
                <pre className="text-xs overflow-auto">{gpsError}</pre>
              </AlertDescription>
            </Alert>
          )}

          {gpsResult && (
            <>
              <Card className="bg-muted">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">GPS Data</CardTitle>
                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                      GPS
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(gpsResult, null, 2)}
                  </pre>
                </CardContent>
              </Card>
              
              {gpsResult.nearest_zip && result && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-sm">IP vs GPS Comparison</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                            IP
                          </Badge>
                          <span className="text-xs text-muted-foreground">Network-based</span>
                        </div>
                        <div className="text-sm space-y-1">
                          <div><strong>Zip:</strong> {result.zip_code || 'N/A'}</div>
                          <div><strong>City:</strong> {result.city || 'N/A'}</div>
                          <div><strong>State:</strong> {result.region || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">
                            Lat: {result.latitude?.toFixed(4)}<br/>
                            Lng: {result.longitude?.toFixed(4)}
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                            GPS
                          </Badge>
                          <span className="text-xs text-muted-foreground">Satellite-based</span>
                        </div>
                        <div className="text-sm space-y-1">
                          <div><strong>Zip:</strong> {gpsResult.nearest_zip.zip_code}</div>
                          <div><strong>City:</strong> {gpsResult.nearest_zip.city}</div>
                          <div><strong>State:</strong> {gpsResult.nearest_zip.state}</div>
                          <div className="text-xs text-muted-foreground">
                            Lat: {gpsResult.latitude.toFixed(4)}<br/>
                            Lng: {gpsResult.longitude.toFixed(4)}<br/>
                            Distance: {gpsResult.nearest_zip.distance_km} km
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t">
                      <div className="text-xs text-muted-foreground">
                        <strong>Match:</strong> {result.zip_code === gpsResult.nearest_zip.zip_code ? 
                          '✅ Zip codes match!' : 
                          '⚠️ Different zip codes - GPS is more precise'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <Card className="bg-muted">
            <CardHeader>
              <CardTitle className="text-sm">GPS Test Instructions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>1. Click "Test GPS Permission" button</p>
              <p>2. Allow location access when prompted by your browser</p>
              <p>3. Wait a few seconds for GPS to acquire your position</p>
              <p>4. View accuracy and coordinates above</p>
              <p className="text-muted-foreground mt-4">
                Note: GPS requires HTTPS and works best on mobile devices. 
                Desktop browsers may fall back to WiFi-based location.
              </p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Combined Instructions */}
      <Card className="bg-muted">
        <CardHeader>
          <CardTitle className="text-sm">About Location Sources</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div>
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 mb-2">IP</Badge>
            <p>IP-based location uses your internet connection to estimate your location. 
               Accuracy: typically within a few kilometers. Works on all devices.</p>
          </div>
          <div className="mt-4">
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 mb-2">GPS</Badge>
            <p>GPS uses satellite positioning for precise location. 
               Accuracy: typically within 5-50 meters. Best on mobile devices with location services enabled.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
