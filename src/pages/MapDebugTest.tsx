import { useState, useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Copy,
  Smartphone,
  Monitor,
  Globe,
  Box,
  MapPin
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface LogEntry {
  timestamp: number;
  type: "success" | "error" | "info" | "warning";
  message: string;
}

export default function MapDebugTest() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [webglInfo, setWebglInfo] = useState<any>(null);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [containerInfo, setContainerInfo] = useState<any>(null);
  const [mapStatus, setMapStatus] = useState<any>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = (type: LogEntry["type"], message: string) => {
    const entry: LogEntry = {
      timestamp: Date.now(),
      type,
      message,
    };
    setLogs((prev) => [...prev, entry]);
    
    // Auto-scroll to bottom
    setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  const getDeviceInfo = () => {
    addLog("info", "=== DEVICE DETECTION ===");
    
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
    const isChrome = /Chrome/.test(ua);
    const isMobile = /Mobile/.test(ua);
    
    const info = {
      platform: isIOS ? "iOS" : isAndroid ? "Android" : "Desktop",
      browser: isSafari ? "Safari" : isChrome ? "Chrome" : "Other",
      userAgent: ua,
      isTouchDevice: 'ontouchstart' in window,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      pixelRatio: window.devicePixelRatio,
      orientation: window.screen.orientation?.type || "unknown",
      isMobile
    };
    
    setDeviceInfo(info);
    addLog("success", `Platform: ${info.platform}`);
    addLog("success", `Browser: ${info.browser}`);
    addLog("success", `Screen: ${info.screenWidth}×${info.screenHeight} @${info.pixelRatio}x`);
    addLog("success", `Touch: ${info.isTouchDevice ? "✅" : "❌"}`);
    
    return info;
  };

  const testWebGL = () => {
    addLog("info", "=== WEBGL DIAGNOSTICS ===");
    
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
      const gl2 = canvas.getContext("webgl2");
      
      if (!gl) {
        addLog("error", "WebGL 1.0: ❌ NOT SUPPORTED");
        setWebglInfo({ supported: false, error: "WebGL not available" });
        return;
      }

      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "Unknown";
      const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : "Unknown";
      
      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      const maxViewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      
      const info = {
        webgl1: !!gl,
        webgl2: !!gl2,
        renderer,
        vendor,
        maxTextureSize: maxTextureSize || 0,
        maxViewportDims: maxViewportDims || [0, 0],
        extensions: gl.getSupportedExtensions()?.length || 0,
        supported: true
      };
      
      setWebglInfo(info);
      addLog("success", `WebGL 1.0: ✅ Supported`);
      addLog("success", `WebGL 2.0: ${gl2 ? "✅" : "❌"}`);
      addLog("info", `Renderer: ${renderer}`);
      addLog("info", `Vendor: ${vendor}`);
      addLog("info", `Max Texture Size: ${maxTextureSize || 'Unknown'}`);
      addLog("info", `Max Viewport: ${maxViewportDims ? `${maxViewportDims[0]}×${maxViewportDims[1]}` : 'Unknown'}`);
      addLog("success", `Extensions: ${info.extensions} available`);
      
    } catch (err: any) {
      addLog("error", `WebGL Error: ${err.message}`);
      setWebglInfo({ supported: false, error: err.message });
    }
  };

  const testTokenFetch = async () => {
    addLog("info", "=== TOKEN FETCH TEST ===");
    const startTime = Date.now();
    
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      
      const duration = Date.now() - startTime;
      
      if (error) throw error;
      
      if (data?.token) {
        setTokenInfo({ 
          success: true, 
          token: data.token.substring(0, 20) + "...",
          duration,
          source: "Edge Function"
        });
        addLog("success", `✅ Token fetched in ${duration}ms`);
        addLog("info", `Token: ${data.token.substring(0, 20)}...`);
        addLog("success", `Source: Edge Function`);
        return data.token;
      } else {
        throw new Error("No token in response");
      }
    } catch (err: any) {
      const duration = Date.now() - startTime;
      
      // Try localStorage fallback
      const savedToken = localStorage.getItem("mapbox_token");
      if (savedToken) {
        setTokenInfo({ 
          success: true, 
          token: savedToken.substring(0, 20) + "...",
          duration,
          source: "LocalStorage (Fallback)"
        });
        addLog("warning", `Edge function failed after ${duration}ms`);
        addLog("success", `✅ Using localStorage token`);
        return savedToken;
      }
      
      addLog("error", `❌ Token fetch failed: ${err.message}`);
      setTokenInfo({ success: false, error: err.message, duration });
      return null;
    }
  };

  const testContainer = () => {
    addLog("info", "=== CONTAINER CHECK ===");
    
    if (!mapContainer.current) {
      addLog("error", "❌ Container element not found");
      setContainerInfo({ found: false });
      return false;
    }
    
    const rect = mapContainer.current.getBoundingClientRect();
    const styles = window.getComputedStyle(mapContainer.current);
    
    const info = {
      found: true,
      width: rect.width,
      height: rect.height,
      visible: styles.display !== "none" && styles.visibility !== "hidden",
      display: styles.display,
      position: styles.position
    };
    
    setContainerInfo(info);
    addLog("success", `✅ Container found`);
    addLog("info", `Size: ${info.width}×${info.height}px`);
    addLog("success", `Visible: ${info.visible ? "✅" : "❌"}`);
    addLog("info", `Display: ${info.display}`);
    
    return true;
  };

  const testMapInit = async () => {
    addLog("info", "=== MAP INITIALIZATION ===");
    const initStart = Date.now();
    
    // Clean up existing map
    if (map.current) {
      map.current.remove();
      map.current = null;
    }
    
    const token = await testTokenFetch();
    if (!token) {
      addLog("error", "❌ Cannot initialize without token");
      return;
    }
    
    if (!testContainer()) {
      addLog("error", "❌ Cannot initialize without valid container");
      return;
    }
    
    try {
      addLog("info", `[${Date.now() - initStart}ms] Setting access token...`);
      mapboxgl.accessToken = token;
      
      addLog("info", `[${Date.now() - initStart}ms] Creating map instance...`);
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/light-v11",
        zoom: 1,
        center: [0, 20],
        projection: "mercator" as any,
        // iOS-specific compatibility options
        preserveDrawingBuffer: true,
        failIfMajorPerformanceCaveat: false,
        antialias: false,
      });
      
      addLog("info", `[${Date.now() - initStart}ms] Map constructor completed`);
      
      // Add event listeners
      map.current.on("load", () => {
        const loadTime = Date.now() - initStart;
        addLog("success", `[${loadTime}ms] ✅ Map loaded successfully`);
        setMapStatus({ 
          initialized: true, 
          loadTime,
          status: "SUCCESS" 
        });
      });
      
      map.current.on("error", (e) => {
        addLog("error", `❌ Map error: ${e.error?.message || "Unknown error"}`);
        setMapStatus({ 
          initialized: false, 
          error: e.error?.message,
          status: "ERROR" 
        });
      });
      
      map.current.on("style.load", () => {
        addLog("info", `[${Date.now() - initStart}ms] Style loaded`);
      });
      
      map.current.on("webglcontextlost", () => {
        addLog("error", "❌ WebGL context lost!");
      });
      
      map.current.on("webglcontextrestored", () => {
        addLog("success", "✅ WebGL context restored");
      });
      
      // Add controls
      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        "top-right"
      );
      
      addLog("info", `[${Date.now() - initStart}ms] Controls added`);
      
    } catch (err: any) {
      const errorTime = Date.now() - initStart;
      addLog("error", `❌ [${errorTime}ms] Initialization failed: ${err.message}`);
      setMapStatus({ 
        initialized: false, 
        error: err.message,
        status: "FAILED" 
      });
    }
  };

  const runFullDiagnostics = async () => {
    setLogs([]);
    setDeviceInfo(null);
    setWebglInfo(null);
    setTokenInfo(null);
    setContainerInfo(null);
    setMapStatus(null);
    
    addLog("info", "════════════════════════════════════════");
    addLog("info", "     MAP DEBUG TEST HARNESS");
    addLog("info", "════════════════════════════════════════");
    
    getDeviceInfo();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testWebGL();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testTokenFetch();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testContainer();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testMapInit();
  };

  const copyLogsToClipboard = () => {
    const logText = logs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      return `[${time}] ${log.type.toUpperCase()}: ${log.message}`;
    }).join("\n");
    
    navigator.clipboard.writeText(logText);
    toast({
      title: "Logs copied",
      description: "All diagnostic logs copied to clipboard",
    });
  };

  const StatusIcon = ({ status }: { status: boolean | undefined }) => {
    if (status === undefined) return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    return status ? 
      <CheckCircle2 className="w-4 h-4 text-green-500" /> : 
      <XCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Map Debug Test Harness</h1>
        <p className="text-muted-foreground">
          Comprehensive diagnostics for iOS and cross-platform map debugging
        </p>
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={runFullDiagnostics} size="lg">
          Run Full Diagnostics
        </Button>
        <Button onClick={getDeviceInfo} variant="outline">
          <Smartphone className="w-4 h-4 mr-2" />
          Device Info
        </Button>
        <Button onClick={testWebGL} variant="outline">
          <Box className="w-4 h-4 mr-2" />
          Test WebGL
        </Button>
        <Button onClick={testTokenFetch} variant="outline">
          <Globe className="w-4 h-4 mr-2" />
          Test Token
        </Button>
        <Button onClick={testContainer} variant="outline">
          <Monitor className="w-4 h-4 mr-2" />
          Test Container
        </Button>
        <Button onClick={testMapInit} variant="outline">
          <MapPin className="w-4 h-4 mr-2" />
          Init Map
        </Button>
        <Button onClick={copyLogsToClipboard} variant="secondary">
          <Copy className="w-4 h-4 mr-2" />
          Copy Logs
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Cards */}
        <div className="space-y-4">
          {/* Device Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Device Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {deviceInfo ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Platform</span>
                    <Badge variant="outline">{deviceInfo.platform}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Browser</span>
                    <Badge variant="outline">{deviceInfo.browser}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Screen</span>
                    <span className="text-sm">{deviceInfo.screenWidth}×{deviceInfo.screenHeight} @{deviceInfo.pixelRatio}x</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Touch</span>
                    <StatusIcon status={deviceInfo.isTouchDevice} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Run diagnostics to see device info</p>
              )}
            </CardContent>
          </Card>

          {/* WebGL Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="w-5 h-5" />
                WebGL Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {webglInfo ? (
                webglInfo.supported ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">WebGL 1.0</span>
                      <StatusIcon status={webglInfo.webgl1} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">WebGL 2.0</span>
                      <StatusIcon status={webglInfo.webgl2} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Renderer</span>
                      <span className="text-sm font-mono text-right">{webglInfo.renderer}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Max Texture</span>
                      <span className="text-sm">{webglInfo.maxTextureSize}px</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Extensions</span>
                      <Badge variant="secondary">{webglInfo.extensions}</Badge>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-red-500">❌ {webglInfo.error}</p>
                )
              ) : (
                <p className="text-sm text-muted-foreground">Run diagnostics to test WebGL</p>
              )}
            </CardContent>
          </Card>

          {/* Token Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Token Fetch
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tokenInfo ? (
                tokenInfo.success ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <StatusIcon status={true} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Duration</span>
                      <Badge variant="secondary">{tokenInfo.duration}ms</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Source</span>
                      <span className="text-sm">{tokenInfo.source}</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-xs text-muted-foreground">Token:</span>
                      <code className="text-xs block mt-1 p-2 bg-muted rounded">{tokenInfo.token}</code>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-red-500">❌ {tokenInfo.error}</p>
                )
              ) : (
                <p className="text-sm text-muted-foreground">Run diagnostics to test token fetch</p>
              )}
            </CardContent>
          </Card>

          {/* Container Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Container Check
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {containerInfo ? (
                containerInfo.found ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Element Found</span>
                      <StatusIcon status={true} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Size</span>
                      <span className="text-sm">{containerInfo.width}×{containerInfo.height}px</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Visible</span>
                      <StatusIcon status={containerInfo.visible} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Display</span>
                      <code className="text-xs">{containerInfo.display}</code>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-red-500">❌ Container not found</p>
                )
              ) : (
                <p className="text-sm text-muted-foreground">Run diagnostics to check container</p>
              )}
            </CardContent>
          </Card>

          {/* Map Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Map Initialization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mapStatus ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={mapStatus.status === "SUCCESS" ? "default" : "destructive"}>
                      {mapStatus.status}
                    </Badge>
                  </div>
                  {mapStatus.loadTime && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Load Time</span>
                      <Badge variant="secondary">{mapStatus.loadTime}ms</Badge>
                    </div>
                  )}
                  {mapStatus.error && (
                    <p className="text-sm text-red-500">❌ {mapStatus.error}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Run diagnostics to test map initialization</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Log Display */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Diagnostic Log</CardTitle>
              <CardDescription>Real-time test output and debugging information</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] w-full rounded border bg-muted/30 p-4">
                <div ref={logContainerRef} className="space-y-1 font-mono text-xs">
                  {logs.length === 0 ? (
                    <p className="text-muted-foreground">No logs yet. Run diagnostics to see output.</p>
                  ) : (
                    logs.map((log, idx) => (
                      <div 
                        key={idx} 
                        className={`${
                          log.type === "success" ? "text-green-600" :
                          log.type === "error" ? "text-red-600" :
                          log.type === "warning" ? "text-yellow-600" :
                          "text-foreground"
                        }`}
                      >
                        [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Map Container */}
      <Card>
        <CardHeader>
          <CardTitle>Map Test Container</CardTitle>
          <CardDescription>The map will render here during initialization tests</CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            ref={mapContainer} 
            className="w-full rounded-lg border bg-muted/30"
            style={{ height: '400px', minHeight: '400px' }}
          />
        </CardContent>
      </Card>
    </div>
  );
}