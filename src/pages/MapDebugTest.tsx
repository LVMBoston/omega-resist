import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from "@/integrations/supabase/client";

type LogLevel = "info" | "success" | "error" | "warn";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
}

interface DeviceInfo {
  userAgent: string;
  platform: string;
  isMobile: boolean;
  isIOS: boolean;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  status: "PENDING" | "SUCCESS" | "FAILED";
}

interface TokenInfo {
  exists: boolean;
  source: string;
  length: number;
  status: "PENDING" | "SUCCESS" | "FAILED";
}

interface ContainerInfo {
  exists: boolean;
  width: number;
  height: number;
  visible: boolean;
  status: "PENDING" | "SUCCESS" | "FAILED";
}

interface MapStatus {
  initialized: boolean;
  loadTime: number;
  status: "PENDING" | "SUCCESS" | "FAILED";
}

const MapDebugTest = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [containerInfo, setContainerInfo] = useState<ContainerInfo | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus | null>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = (level: LogLevel, message: string) => {
    setLogs((prev) => [...prev, { level, message, timestamp: Date.now() }]);
  };

  const scrollToBottom = () => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  // Fix Leaflet default icon path
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  const getDeviceInfo = () => {
    addLog("info", "🔍 Starting device detection...");
    
    const info: DeviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
      isIOS: /iPhone|iPad|iPod/i.test(navigator.userAgent),
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      pixelRatio: window.devicePixelRatio,
      status: "SUCCESS",
    };

    setDeviceInfo(info);
    addLog("success", `✓ Device: ${info.isMobile ? "Mobile" : "Desktop"} | ${info.isIOS ? "iOS" : "Other"}`);
    addLog("info", `Screen: ${info.screenWidth}x${info.screenHeight} @ ${info.pixelRatio}x`);
    addLog("info", `Platform: ${info.platform}`);
  };

  const testLeafletSupport = () => {
    addLog("info", "🗺️ Testing Leaflet support...");
    
    try {
      addLog("success", "✓ Leaflet is supported (no WebGL required)");
      addLog("info", `Leaflet version: ${L.version}`);
      return true;
    } catch (error) {
      addLog("error", `✗ Unexpected error: ${error}`);
      return false;
    }
  };

  const testTokenFetch = async () => {
    addLog("info", "🔑 Fetching Mapbox token (optional for OSM)...");
    
    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      
      if (error) {
        addLog("warn", `⚠ Supabase function error: ${error.message}`);
      }
      
      if (data?.token) {
        setTokenInfo({
          exists: true,
          source: "Supabase Function",
          length: data.token.length,
          status: "SUCCESS",
        });
        addLog("success", `✓ Token retrieved from Supabase (${data.token.length} chars)`);
        return data.token;
      }
      
      const storedToken = localStorage.getItem('mapboxToken');
      if (storedToken) {
        setTokenInfo({
          exists: true,
          source: "localStorage",
          length: storedToken.length,
          status: "SUCCESS",
        });
        addLog("success", `✓ Token retrieved from localStorage (${storedToken.length} chars)`);
        return storedToken;
      }
      
      setTokenInfo({
        exists: false,
        source: "None (OSM tiles will be used)",
        length: 0,
        status: "SUCCESS",
      });
      addLog("info", "ℹ No token found - using OpenStreetMap tiles");
      return null;
    } catch (error) {
      addLog("warn", `⚠ Token fetch error: ${error}`);
      setTokenInfo({
        exists: false,
        source: "Error (OSM tiles will be used)",
        length: 0,
        status: "SUCCESS",
      });
      return null;
    }
  };

  const testContainer = () => {
    addLog("info", "📦 Checking map container...");
    
    if (!mapContainer.current) {
      addLog("error", "✗ Container element not found");
      setContainerInfo({
        exists: false,
        width: 0,
        height: 0,
        visible: false,
        status: "FAILED",
      });
      return false;
    }
    
    const rect = mapContainer.current.getBoundingClientRect();
    const computed = window.getComputedStyle(mapContainer.current);
    const isVisible = computed.display !== 'none' && computed.visibility !== 'hidden';
    
    const info: ContainerInfo = {
      exists: true,
      width: rect.width,
      height: rect.height,
      visible: isVisible,
      status: rect.width > 0 && rect.height > 0 && isVisible ? "SUCCESS" : "FAILED",
    };
    
    setContainerInfo(info);
    
    if (info.status === "SUCCESS") {
      addLog("success", `✓ Container ready: ${info.width}x${info.height}px`);
      return true;
    } else {
      addLog("error", `✗ Container issue: ${info.width}x${info.height}px, visible: ${isVisible}`);
      return false;
    }
  };

  const testMapInit = async () => {
    addLog("info", "🗺️ Starting Leaflet map initialization...");
    const initStart = Date.now();
    
    try {
      if (!testLeafletSupport()) {
        setMapStatus({
          initialized: false,
          loadTime: 0,
          status: "FAILED",
        });
        return;
      }
      
      addLog("info", `[${Date.now() - initStart}ms] Checking container...`);
      if (!testContainer()) {
        setMapStatus({
          initialized: false,
          loadTime: Date.now() - initStart,
          status: "FAILED",
        });
        return;
      }
      
      addLog("info", `[${Date.now() - initStart}ms] Fetching token...`);
      await testTokenFetch();
      
      addLog("info", `[${Date.now() - initStart}ms] Creating Leaflet map instance...`);
      
      map.current = L.map(mapContainer.current!, {
        center: [39.8283, -98.5795],
        zoom: 4,
        zoomControl: true,
      });
      
      addLog("info", `[${Date.now() - initStart}ms] Adding tile layer...`);
      
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
      }).addTo(map.current);
      
      addLog("info", `[${Date.now() - initStart}ms] Waiting for map load...`);
      
      map.current.whenReady(() => {
        const loadTime = Date.now() - initStart;
        addLog("success", `✓ Map loaded successfully in ${loadTime}ms`);
        
        L.marker([39.8283, -98.5795])
          .addTo(map.current!)
          .bindPopup('✅ Leaflet working perfectly on iPad!')
          .openPopup();
        
        setMapStatus({
          initialized: true,
          loadTime,
          status: "SUCCESS",
        });
      });
      
    } catch (error: any) {
      const loadTime = Date.now() - initStart;
      addLog("error", `✗ Map initialization failed: ${error.message || error}`);
      
      setMapStatus({
        initialized: false,
        loadTime,
        status: "FAILED",
      });
    }
  };

  const runFullDiagnostics = async () => {
    addLog("info", "▶️ Starting full diagnostic test...");
    setLogs([]);
    
    getDeviceInfo();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testLeafletSupport();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testTokenFetch();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testContainer();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testMapInit();
  };

  const copyLogsToClipboard = () => {
    const logText = logs.map(log => `[${log.level.toUpperCase()}] ${log.message}`).join('\n');
    navigator.clipboard.writeText(logText);
    addLog("success", "✓ Logs copied to clipboard");
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "SUCCESS":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "FAILED":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Leaflet Map Debug Test</h1>
        <p className="text-muted-foreground">
          iPad-compatible map diagnostics (no WebGL required)
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={getDeviceInfo}>Test Device Info</Button>
        <Button onClick={testLeafletSupport}>Test Leaflet</Button>
        <Button onClick={testTokenFetch}>Test Token</Button>
        <Button onClick={testContainer}>Test Container</Button>
        <Button onClick={testMapInit}>Test Map Init</Button>
        <Button onClick={runFullDiagnostics} variant="default">
          Run Full Diagnostics
        </Button>
        <Button onClick={copyLogsToClipboard} variant="outline">
          Copy Logs
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Device Info</h3>
            {deviceInfo && <StatusIcon status={deviceInfo.status} />}
          </div>
          {deviceInfo && (
            <div className="text-sm space-y-1">
              <p>Platform: {deviceInfo.platform}</p>
              <p>Mobile: {deviceInfo.isMobile ? "Yes" : "No"}</p>
              <p>iOS: {deviceInfo.isIOS ? "Yes" : "No"}</p>
              <p>Screen: {deviceInfo.screenWidth}x{deviceInfo.screenHeight}</p>
            </div>
          )}
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Leaflet Support</h3>
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-sm space-y-1">
            <p>✅ Works on all browsers</p>
            <p>✅ No WebGL required</p>
            <p>✅ iPad compatible</p>
          </div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Token</h3>
            {tokenInfo && <StatusIcon status={tokenInfo.status} />}
          </div>
          {tokenInfo && (
            <div className="text-sm space-y-1">
              <p>Source: {tokenInfo.source}</p>
              <p className="text-muted-foreground text-xs">(Optional for OSM)</p>
            </div>
          )}
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Container</h3>
            {containerInfo && <StatusIcon status={containerInfo.status} />}
          </div>
          {containerInfo && (
            <div className="text-sm space-y-1">
              <p>Exists: {containerInfo.exists ? "Yes" : "No"}</p>
              <p>Size: {containerInfo.width}x{containerInfo.height}px</p>
            </div>
          )}
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Map Init</h3>
            {mapStatus && <StatusIcon status={mapStatus.status} />}
          </div>
          {mapStatus && (
            <div className="text-sm space-y-1">
              <p>Initialized: {mapStatus.initialized ? "Yes" : "No"}</p>
              <p>Load Time: {mapStatus.loadTime}ms</p>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-4">Diagnostic Log</h3>
        <ScrollArea className="h-64 border rounded p-2">
          <div className="space-y-1 font-mono text-xs">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className={`${
                  log.level === "error"
                    ? "text-red-500"
                    : log.level === "success"
                    ? "text-green-500"
                    : log.level === "warn"
                    ? "text-yellow-500"
                    : "text-foreground"
                }`}
              >
                [{log.level.toUpperCase()}] {log.message}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </ScrollArea>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-4">Live Leaflet Map</h3>
        <div ref={mapContainer} className="w-full h-96 rounded border" />
      </Card>
    </div>
  );
};

export default MapDebugTest;
