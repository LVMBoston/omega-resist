import { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Camera, Loader2, CheckCircle, AlertCircle, ExternalLink, MapPin } from "lucide-react";
import { MapHotspotRenderer } from "@/components/MapHotspotRenderer";
import { MapConfig } from "@/types/viralTemplates";

interface CaptureResult {
  imagePath: string;
  publicUrl: string;
  fileSize: number;
  originalSize: number;
  compressionRatio: number;
}

interface TestMarker {
  zipCode: string;
  latitude: number;
  longitude: number;
}

interface MapCaptureTestSectionProps {
  campaignCode: string;
  onCaptureComplete?: (result: CaptureResult) => void;
}

const DEFAULT_MAP_CONFIG: MapConfig = {
  mapStyle: 'channel_colors',
  showClustering: false,
  savedBounds: {
    north: 49.5,
    south: 24.5,
    east: -66.5,
    west: -125,
  },
};

export function MapCaptureTestSection({ campaignCode, onCaptureComplete }: MapCaptureTestSectionProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  const [mapReady, setMapReady] = useState(false);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Test marker state
  const [zipInput, setZipInput] = useState("");
  const [testMarkers, setTestMarkers] = useState<TestMarker[]>([]);
  const [zipError, setZipError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // Wait for tiles to load after map is ready
  useEffect(() => {
    if (mapReady) {
      setTilesLoaded(false);
      // Give tiles time to load (CartoDB tiles typically load fast)
      const timer = setTimeout(() => {
        setTilesLoaded(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [mapReady, campaignCode]);

  const handleMapReady = () => {
    setMapReady(true);
  };

  // Look up ZIP code and add marker
  const handleAddMarker = async () => {
    if (!zipInput.trim()) return;
    
    const zip = zipInput.trim();
    if (!/^\d{5}$/.test(zip)) {
      setZipError("Please enter a 5-digit ZIP code");
      return;
    }
    
    // Check if already added
    if (testMarkers.some(m => m.zipCode === zip)) {
      setZipError("This ZIP code is already on the map");
      return;
    }
    
    setLookingUp(true);
    setZipError(null);
    
    try {
      const { data, error } = await supabase
        .from("zip_codes")
        .select("latitude, longitude")
        .eq("zip_code", zip)
        .maybeSingle();
      
      if (error) throw error;
      
      if (!data) {
        setZipError(`ZIP code ${zip} not found in database`);
        return;
      }
      
      setTestMarkers(prev => [...prev, {
        zipCode: zip,
        latitude: data.latitude,
        longitude: data.longitude,
      }]);
      setZipInput("");
    } catch (err) {
      console.error("ZIP lookup failed:", err);
      setZipError("Failed to look up ZIP code");
    } finally {
      setLookingUp(false);
    }
  };

  const handleRemoveMarker = (zip: string) => {
    setTestMarkers(prev => prev.filter(m => m.zipCode !== zip));
  };

  const captureMap = async () => {
    if (!mapContainerRef.current) {
      setError("Map container not found");
      return;
    }

    setCapturing(true);
    setError(null);
    setCaptureResult(null);
    setCaptureProgress(10);

    try {
      // Step 1: Capture the map as canvas
      setCaptureProgress(20);
      const canvas = await html2canvas(mapContainerRef.current, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        scale: 2, // Higher resolution
        logging: false,
      });

      setCaptureProgress(40);

      // Step 2: Convert canvas to blob
      const originalBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to convert canvas to blob"));
        }, "image/png", 0.95);
      });

      const originalSize = originalBlob.size;
      console.log(`[MapCaptureTest] Original size: ${(originalSize / 1024).toFixed(1)} KB`);

      setCaptureProgress(55);

      // Step 3: Compress the image (preserve dimensions)
      const compressedBlob = await imageCompression(
        new File([originalBlob], "capture.png", { type: "image/png" }),
        {
          maxSizeMB: 0.5, // Target max 500KB
          useWebWorker: true,
          fileType: "image/webp", // WebP for better compression
          preserveExif: false,
          // No maxWidthOrHeight - preserve original 1600x1000 (800x500 * scale 2)
        }
      );

      console.log(`[MapCaptureTest] Compressed size: ${(compressedBlob.size / 1024).toFixed(1)} KB (${((1 - compressedBlob.size / originalSize) * 100).toFixed(0)}% reduction)`);

      setCaptureProgress(70);

      // Step 4: Upload to Supabase storage
      const timestamp = Date.now();
      const filename = `capture-${campaignCode}-${timestamp}.webp`;
      const storagePath = `test-captures/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from("slide-snapshots")
        .upload(storagePath, compressedBlob, {
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setCaptureProgress(90);

      // Step 5: Get public URL
      const { data: urlData } = supabase.storage
        .from("slide-snapshots")
        .getPublicUrl(storagePath);

      setCaptureProgress(100);

      const result: CaptureResult = {
        imagePath: storagePath,
        publicUrl: urlData.publicUrl,
        fileSize: compressedBlob.size,
        originalSize,
        compressionRatio: 1 - (compressedBlob.size / originalSize),
      };

      setCaptureResult(result);
      onCaptureComplete?.(result);

    } catch (err) {
      console.error("Map capture failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCapturing(false);
      setCaptureProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (!campaignCode) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please select a campaign above to test map capture.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Map Preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Map Preview
          </CardTitle>
          <CardDescription>
            Campaign: <strong>{campaignCode}</strong>
            {!mapReady && " • Initializing map..."}
            {mapReady && !tilesLoaded && " • Loading tiles..."}
            {tilesLoaded && " • Ready to capture"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            ref={mapContainerRef}
            className="relative border border-border rounded-lg overflow-hidden bg-muted"
            style={{ width: "800px", height: "500px" }}
          >
            <MapHotspotRenderer
              campaignCode={campaignCode}
              config={DEFAULT_MAP_CONFIG}
              width={800}
              height={500}
              isEditorMode={false}
              onMapReady={handleMapReady}
            />
            
            {/* Test markers overlay - green squares for ZIP codes */}
            {testMarkers.length > 0 && (
              <div className="absolute inset-0 z-[1000] pointer-events-none">
                {testMarkers.map((marker) => {
                  // Convert lat/lng to pixel position within the map bounds
                  const bounds = DEFAULT_MAP_CONFIG.savedBounds!;
                  const latRange = bounds.north - bounds.south;
                  const lngRange = bounds.east - bounds.west;
                  
                  // Calculate percentage position
                  const xPercent = ((marker.longitude - bounds.west) / lngRange) * 100;
                  const yPercent = ((bounds.north - marker.latitude) / latRange) * 100;
                  
                  console.log(`[MapCaptureTest] Marker ${marker.zipCode}: lat=${marker.latitude}, lng=${marker.longitude} -> x=${xPercent.toFixed(1)}%, y=${yPercent.toFixed(1)}%`);
                  
                  // Only show if within bounds
                  if (xPercent < 0 || xPercent > 100 || yPercent < 0 || yPercent > 100) {
                    console.log(`[MapCaptureTest] Marker ${marker.zipCode} is outside bounds, skipping`);
                    return null;
                  }
                  
                  return (
                    <div
                      key={marker.zipCode}
                      className="absolute"
                      style={{
                        left: `${xPercent}%`,
                        top: `${yPercent}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <div 
                        className="w-6 h-6 bg-green-500 border-2 border-white shadow-lg"
                        style={{ boxShadow: "0 0 10px rgba(0,255,0,0.8)" }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Loading overlay */}
            {(!mapReady || !tilesLoaded) && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {!mapReady ? "Initializing map..." : "Loading tiles..."}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ZIP Code Test Input */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Test Markers
          </CardTitle>
          <CardDescription>
            Add green square markers by ZIP code to simulate map updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={zipInput}
              onChange={(e) => {
                setZipInput(e.target.value);
                setZipError(null);
              }}
              placeholder="Enter 5-digit ZIP code"
              maxLength={5}
              className="w-40"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddMarker();
              }}
            />
            <Button 
              onClick={handleAddMarker} 
              disabled={lookingUp || !zipInput.trim()}
              variant="outline"
              className="gap-2"
            >
              {lookingUp ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              Add Marker
            </Button>
          </div>
          
          {zipError && (
            <p className="text-sm text-destructive">{zipError}</p>
          )}
          
          {testMarkers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {testMarkers.map((m) => (
                <div
                  key={m.zipCode}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-sm"
                >
                  <div className="w-2.5 h-2.5 bg-green-500" />
                  {m.zipCode}
                  <button
                    onClick={() => handleRemoveMarker(m.zipCode)}
                    className="ml-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Capture Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Button
              onClick={captureMap}
              disabled={!tilesLoaded || capturing}
              className="gap-2"
            >
              {capturing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Capturing...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  Capture Map
                </>
              )}
            </Button>
            
            {capturing && (
              <div className="flex-1 max-w-xs">
                <Progress value={captureProgress} className="h-2" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Capture Result */}
      {captureResult && (
        <Card className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              Capture Successful
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Result Details */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Storage Path:</span>
                <p className="font-mono text-xs break-all">{captureResult.imagePath}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Original Size:</span>
                <p className="text-muted-foreground">{formatFileSize(captureResult.originalSize)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Compressed Size:</span>
                <p className="font-semibold text-green-600">{formatFileSize(captureResult.fileSize)}</p>
                <p className="text-xs text-green-600">({(captureResult.compressionRatio * 100).toFixed(0)}% smaller)</p>
              </div>
              <div>
                <span className="text-muted-foreground">Public URL:</span>
                <a 
                  href={captureResult.publicUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline text-xs"
                >
                  Open in new tab <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Captured Image Preview */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Captured Image:</p>
              <div className="border border-border rounded-lg overflow-hidden bg-white">
                <img 
                  src={captureResult.publicUrl} 
                  alt="Captured map"
                  className="max-w-full h-auto"
                  style={{ maxHeight: "400px" }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
