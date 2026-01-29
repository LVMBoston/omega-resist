import { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Camera, Loader2, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { MapHotspotRenderer } from "@/components/MapHotspotRenderer";
import { MapConfig } from "@/types/viralTemplates";

interface CaptureResult {
  imagePath: string;
  publicUrl: string;
  fileSize: number;
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

      setCaptureProgress(50);

      // Step 2: Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to convert canvas to blob"));
        }, "image/png", 0.95);
      });

      setCaptureProgress(70);

      // Step 3: Upload to Supabase storage
      const timestamp = Date.now();
      const filename = `capture-${campaignCode}-${timestamp}.png`;
      const storagePath = `test-captures/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from("slide-snapshots")
        .upload(storagePath, blob, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setCaptureProgress(90);

      // Step 4: Get public URL
      const { data: urlData } = supabase.storage
        .from("slide-snapshots")
        .getPublicUrl(storagePath);

      setCaptureProgress(100);

      const result: CaptureResult = {
        imagePath: storagePath,
        publicUrl: urlData.publicUrl,
        fileSize: blob.size,
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
            style={{ width: "800px", height: "500px", maxWidth: "100%" }}
          >
            <MapHotspotRenderer
              campaignCode={campaignCode}
              config={DEFAULT_MAP_CONFIG}
              width={800}
              height={500}
              isEditorMode={false}
              onMapReady={handleMapReady}
            />
            
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Storage Path:</span>
                <p className="font-mono text-xs break-all">{captureResult.imagePath}</p>
              </div>
              <div>
                <span className="text-muted-foreground">File Size:</span>
                <p className="font-semibold">{formatFileSize(captureResult.fileSize)}</p>
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
