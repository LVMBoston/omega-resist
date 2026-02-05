import { useRef, useState, useCallback, useEffect } from "react";
import { Hotspot, ChartConfig, MapConfig } from "@/types/viralTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Upload, Image as ImageIcon, Check, Loader2, Database, BarChart3, MapIcon, Camera, RefreshCw, Rocket } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { HotspotCalibrationControls } from "@/components/HotspotCalibrationControls";
import { ChartCalibrationControls } from "@/components/ChartCalibrationControls";
import { MapCalibrationControls } from "@/components/MapCalibrationControls";
import { DraggableHotspotOverlay } from "@/components/DraggableHotspotOverlay";
import { ChartHotspotRenderer } from "@/components/ChartHotspotRenderer";
import { MapControls } from "@/components/MapHotspotRenderer";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLiveMetrics } from "@/hooks/useLiveMetrics";
import { captureTemplateSnapshot } from "@/lib/snapshotCapture";
import { useTemplateCampaigns } from "@/hooks/useTemplateCampaigns";


// Default hotspot template for data templates (live_number)
const createDefaultHotspot = (index: number): Hotspot => ({
  id: `hotspot-${Date.now()}-${index}`,
  iconId: "live-number",
  type: "live_number",
  label: `Hotspot ${index + 1}`,
  x: 20 + (index % 4) * 15,
  y: 20 + Math.floor(index / 4) * 15,
  width: 14,
  height: 9,
  metricKey: "seeds",
  liveNumberStyle: {
    fontSize: "56px",
    fontWeight: "700",
    color: "#1a1a1a",
    backgroundColor: "#e8dcc8",
    textAlign: "center",
    fontFamily: "Calibri, sans-serif",
    padding: "4px",
  },
});

// Default chart hotspot
const createChartHotspot = (index: number): Hotspot => ({
  id: `chart-${Date.now()}-${index}`,
  iconId: "chart",
  type: "chart",
  label: `Chart ${index + 1}`,
  x: 20 + (index % 4) * 15,
  y: 50,
  width: 30,
  height: 20,
  chartConfig: {
    chartType: "stacked_bar",
    dataSource: "cumulative_opens_by_level",
    showXAxis: true,
    showYAxis: false,
  },
});

// Default map hotspot
const createMapHotspot = (index: number): Hotspot => ({
  id: `map-${Date.now()}-${index}`,
  iconId: "map",
  type: "map",
  label: `Map ${index + 1}`,
  x: 10,
  y: 10,
  width: 40,
  height: 40,
  mapConfig: {
    mapStyle: "channel_colors",
    showClustering: false, // Disabled by default for clearer positioning
  },
});

interface DataTemplateEditorProps {
  initialHotspots?: Hotspot[];
  initialImageUrl?: string;
  templateName?: string;
  templateDescription?: string;
  templateSlug?: string;
  templateId?: string;
  onSave: (data: {
    hotspots: Hotspot[];
    imageUrl: string;
    name: string;
    slug: string;
    description?: string;
  }) => Promise<string | void>;
  onCancel: () => void;
  mode: "create" | "edit";
}

export function DataTemplateEditor({
  initialHotspots = [],
  initialImageUrl = "",
  templateName = "",
  templateDescription = "",
  templateSlug = "",
  templateId,
  onSave,
  onCancel,
  mode,
}: DataTemplateEditorProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const captureContainerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isRefreshingServer, setIsRefreshingServer] = useState(false);
  const [savedTemplateId, setSavedTemplateId] = useState<string | undefined>(templateId);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lastSnapshotAt, setLastSnapshotAt] = useState<Date | null>(null);
  const [lastServerRefreshAt, setLastServerRefreshAt] = useState<Date | null>(null);

  // Form state
  const [name, setName] = useState(templateName);
  const [slug, setSlug] = useState(templateSlug);
  const [description, setDescription] = useState(templateDescription);
  const [imageUrl, setImageUrl] = useState(initialImageUrl);

  // Live metrics preview state
  const [campaignId, setCampaignId] = useState("");
  const [mobilizeId, setMobilizeId] = useState("");
  const { metricsMap, loading: metricsLoading, resolveMetrics } = useLiveMetrics();

  // Fetch campaigns for dropdown
  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, code, title")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Initialize with at least one hotspot if empty
  const [hotspots, setHotspots] = useState<Hotspot[]>(
    initialHotspots.length > 0 ? initialHotspots : [createDefaultHotspot(0)]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [currentMapBounds, setCurrentMapBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);
  const [mapControls, setMapControls] = useState<MapControls | null>(null);
  const [displayValues, setDisplayValues] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {};
    const defaultValues = ["142", "87", "1,234", "456", "321", "198", "73", "OMEGA PA", "Jan 15", "Jan 25", "9:00 AM", "2:45 PM"];
    (initialHotspots.length > 0 ? initialHotspots : [createDefaultHotspot(0)]).forEach((h, i) => {
      values[h.id] = defaultValues[i % defaultValues.length] || "0";
    });
    return values;
  });

  const activeHotspot = hotspots[activeIndex];

  // Resolve live metrics when campaign ID or mobilize ID changes
  useEffect(() => {
    if (campaignId.trim()) {
      resolveMetrics(campaignId.trim(), mobilizeId.trim() || undefined);
    }
  }, [campaignId, mobilizeId, resolveMetrics]);

  // Update display values when metrics are resolved
  useEffect(() => {
    console.log("[DataTemplateEditor] metricsMap updated:", Object.keys(metricsMap).length, "keys", metricsMap);
    if (Object.keys(metricsMap).length > 0) {
      setDisplayValues((prev) => {
        const updated = { ...prev };
        hotspots.forEach((h) => {
          if (h.metricKey && metricsMap[h.metricKey] !== undefined) {
            console.log(`[DataTemplateEditor] Hotspot ${h.id}: metricKey=${h.metricKey} -> value=${metricsMap[h.metricKey]}`);
            updated[h.id] = String(metricsMap[h.metricKey]);
          }
        });
        return updated;
      });
    }
  }, [metricsMap, hotspots]);

  // Auto-save function
  const performAutoSave = useCallback(async (hotspotsToSave: Hotspot[]) => {
    // Only auto-save if we have the minimum required fields
    if (!name.trim() || !slug.trim() || !imageUrl) {
      return;
    }
    
    setIsAutoSaving(true);
    try {
      const result = await onSave({
        hotspots: hotspotsToSave,
        imageUrl,
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
      });
      
      // If this was a create and we got an ID back, store it
      if (result && !savedTemplateId) {
        setSavedTemplateId(result);
      }
      
      setLastSavedAt(new Date());
      toast.success("Auto-saved", { duration: 1500 });
    } catch (error: any) {
      console.error("Auto-save failed:", error);
      toast.error(`Auto-save failed: ${error.message}`, { duration: 3000 });
    } finally {
      setIsAutoSaving(false);
    }
  }, [name, slug, imageUrl, description, onSave, savedTemplateId]);

  // Update a hotspot by index
  const updateHotspot = useCallback((index: number, updates: Partial<Hotspot>) => {
    setHotspots((prev) =>
      prev.map((h, i) => (i === index ? { ...h, ...updates } : h))
    );
  }, []);

  // Add a new live_number hotspot, inheriting style from the active hotspot
  const addHotspot = useCallback(() => {
    const newIndex = hotspots.length;
    const baseHotspot = createDefaultHotspot(newIndex);

    // Inherit styling and dimensions from the active hotspot if one exists and is a live_number
    if (activeHotspot && activeHotspot.type === "live_number") {
      baseHotspot.width = activeHotspot.width;
      baseHotspot.height = activeHotspot.height;
      if (activeHotspot.liveNumberStyle) {
        baseHotspot.liveNumberStyle = { ...activeHotspot.liveNumberStyle };
      }
    }

    const newHotspots = [...hotspots, baseHotspot];
    setHotspots(newHotspots);
    setDisplayValues((prev) => ({ ...prev, [baseHotspot.id]: "0" }));
    setActiveIndex(newIndex);
  }, [hotspots, activeHotspot]);

  // Add a new chart hotspot
  const addChartHotspot = useCallback(() => {
    const newIndex = hotspots.length;
    const chartHotspot = createChartHotspot(newIndex);

    const newHotspots = [...hotspots, chartHotspot];
    setHotspots(newHotspots);
    setActiveIndex(newIndex);
  }, [hotspots]);

  // Add a new map hotspot
  const addMapHotspot = useCallback(() => {
    const newIndex = hotspots.length;
    const mapHotspot = createMapHotspot(newIndex);

    const newHotspots = [...hotspots, mapHotspot];
    setHotspots(newHotspots);
    setActiveIndex(newIndex);
  }, [hotspots]);

  // Remove the active hotspot
  const removeHotspot = useCallback(() => {
    if (hotspots.length <= 1) {
      toast.error("Cannot remove the last hotspot");
      return;
    }
    const removedId = hotspots[activeIndex].id;
    setHotspots((prev) => prev.filter((_, i) => i !== activeIndex));
    setDisplayValues((prev) => {
      const { [removedId]: _, ...rest } = prev;
      return rest;
    });
    setActiveIndex((prev) => Math.max(0, prev - 1));
  }, [hotspots, activeIndex]);

  // Update display value for active hotspot
  const updateDisplayValue = useCallback(
    (value: string) => {
      if (activeHotspot) {
        setDisplayValues((prev) => ({ ...prev, [activeHotspot.id]: value }));
      }
    },
    [activeHotspot]
  );

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `interactive-templates/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("slides")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("slides").getPublicUrl(filePath);

      setImageUrl(publicUrl);
      setImageLoaded(false);
      
      // Auto-generate slug from filename if empty
      if (!slug) {
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        setSlug(baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
      }
      if (!name) {
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        setName(baseName);
      }

      toast.success("Image uploaded successfully");
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (!slug.trim()) {
      toast.error("Template slug is required");
      return;
    }
    if (!imageUrl) {
      toast.error("Please upload an image");
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        hotspots,
        imageUrl,
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
      });
    } catch (error: any) {
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle save and capture snapshot
  const handleSaveAndCapture = async () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (!slug.trim()) {
      toast.error("Template slug is required");
      return;
    }
    if (!imageUrl) {
      toast.error("Please upload an image");
      return;
    }
    if (!captureContainerRef.current) {
      toast.error("Cannot capture: image container not ready");
      return;
    }

    setIsSaving(true);
    try {
      // First save the template to get/confirm the ID
      const result = await onSave({
        hotspots,
        imageUrl,
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
      });
      
      const templateIdToUse = result || savedTemplateId;
      if (!templateIdToUse) {
        throw new Error("No template ID available for snapshot");
      }
      
      if (result && !savedTemplateId) {
        setSavedTemplateId(result);
      }
      
      setLastSavedAt(new Date());
      
      // Now capture the snapshot
      setIsCapturing(true);
      
      // Add capture mode class to adjust vertical alignment for html2canvas
      captureContainerRef.current.classList.add("capture-mode");
      
      toast.info("Capturing snapshot...", { duration: 2000 });
      
      const captureResult = await captureTemplateSnapshot(
        templateIdToUse,
        captureContainerRef.current,
        campaignId || undefined
      );
      
      setLastSnapshotAt(new Date(captureResult.timestamp));
      toast.success("Template saved and snapshot captured!", { duration: 3000 });
      
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    } finally {
      // Remove capture mode class
      if (captureContainerRef.current) {
        captureContainerRef.current.classList.remove("capture-mode");
      }
      setIsSaving(false);
      setIsCapturing(false);
    }
  };

  // Handle server-side snapshot refresh (calls edge function)
  // Includes retry logic for iPad Safari which can drop the first request
  const handleServerRefresh = async () => {
    const templateIdToUse = savedTemplateId || templateId;
    if (!templateIdToUse) {
      toast.error("Please save the template first before refreshing server snapshot");
      return;
    }
    if (!campaignId) {
      toast.error("Please select a campaign to refresh server snapshot");
      return;
    }

    setIsRefreshingServer(true);
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Server Refresh] Attempt ${attempt}/${maxRetries}...`);
        
        const { data, error } = await supabase.functions.invoke("render-stats-snapshot", {
          body: {
            template_id: templateIdToUse,
            campaign_code: campaignId,
          },
        });

        if (error) throw error;

        setLastServerRefreshAt(new Date());
        toast.success(`Server snapshot refreshed! ${data.hotspots_rendered} hotspots rendered.`, { duration: 4000 });
        console.log("[Server Refresh] Public URL:", data.public_url);
        setIsRefreshingServer(false);
        return; // Success - exit the function
        
      } catch (err: any) {
        console.error(`[Server Refresh] Attempt ${attempt} failed:`, err);
        lastError = err;
        
        if (attempt < maxRetries) {
          toast.info(`Retrying... (attempt ${attempt + 1}/${maxRetries})`, { duration: 1500 });
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
      }
    }

    // All retries exhausted
    setIsRefreshingServer(false);
    toast.error(`Server refresh failed: ${lastError?.message || "Unknown error"}`);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b border-border bg-muted/30">
        <div className="space-y-1">
          <Label htmlFor="template-name" className="text-sm">
            Template Name *
          </Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Stats Page v1"
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="template-slug" className="text-sm">
            Template ID *
          </Label>
          <Input
            id="template-slug"
            value={slug}
            onChange={(e) =>
              setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))
            }
            placeholder="e.g., stats-page-v1"
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="template-description" className="text-sm">
            Description
          </Label>
          <Textarea
            id="template-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
            className="h-9 min-h-[36px] resize-none"
            rows={1}
          />
        </div>
      </div>

      {/* Live Data Preview Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b border-border bg-green-50/50 dark:bg-green-950/20">
        <div className="space-y-1">
          <Label htmlFor="campaign-id" className="text-sm flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-green-600" />
            Campaign
          </Label>
          <div className="flex gap-2">
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger className="h-9 bg-background flex-1">
                <SelectValue placeholder="Select a campaign..." />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.code}>
                    {campaign.title} ({campaign.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3"
              onClick={() => {
                if (campaignId.trim()) {
                  resolveMetrics(campaignId.trim(), mobilizeId.trim() || undefined);
                  toast.success("Metrics refreshed", { duration: 1500 });
                } else {
                  toast.error("Select a campaign first");
                }
              }}
              disabled={metricsLoading || !campaignId}
              title="Refresh metrics (including current time)"
            >
              <RefreshCw className={`w-4 h-4 ${metricsLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="mobilize-id" className="text-sm flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-green-600" />
            Mobilize ID (for Start Date/Time)
            {metricsLoading && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
          </Label>
          <Input
            id="mobilize-id"
            value={mobilizeId}
            onChange={(e) => setMobilizeId(e.target.value)}
            placeholder="e.g., 12345"
            className="h-9"
          />
        </div>
        <div className="flex items-end">
          <p className="text-xs text-muted-foreground">
            Click <RefreshCw className="w-3 h-3 inline" /> to update time-based metrics
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Image Upload / Preview */}
        <div className="flex-1 flex items-start justify-center p-4 bg-black/95 min-h-[400px] overflow-auto">
          {imageUrl ? (
            <div ref={captureContainerRef} className="relative max-w-4xl w-full">
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Template slide"
                className="w-full h-auto rounded-lg shadow-2xl"
                onLoad={() => setImageLoaded(true)}
              />

              {imageLoaded && (
                <DraggableHotspotOverlay
                  hotspots={hotspots}
                  activeIndex={activeIndex}
                  imageRef={imageRef}
                  displayValues={displayValues}
                  onUpdateHotspot={updateHotspot}
                  onSelectHotspot={setActiveIndex}
                  campaignCode={campaignId}
                  onMapBoundsChange={setCurrentMapBounds}
                  onMapControlsReady={setMapControls}
                />
              )}

              {/* Replace Image Button - hidden during capture */}
              <div className="absolute top-2 right-2 capture-hide">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                    disabled={isUploading}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1 pointer-events-none"
                  >
                    <Upload className="w-4 h-4" />
                    Replace
                  </Button>
                </label>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <ImageIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Upload a background image to start
              </p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                  disabled={isUploading}
                />
                <Button
                  variant="outline"
                  className="gap-2 pointer-events-none"
                  disabled={isUploading}
                >
                  <Upload className="w-4 h-4" />
                  {isUploading ? "Uploading..." : "Upload Image"}
                </Button>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Controls Panel */}
      <div className="bg-background border-t border-border p-4 space-y-4">
        {/* Hotspot Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">
            Hotspots:
          </span>
          {hotspots.map((h, i) => (
            <Button
              key={h.id}
              variant={i === activeIndex ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveIndex(i)}
              className="min-w-[40px]"
            >
              {i + 1}
              {h.metricKey && (
                <span className="ml-1 text-xs opacity-70">
                  ({h.metricKey})
                </span>
              )}
            </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addHotspot}
              className="gap-1 border-green-500 text-green-600 hover:bg-green-50"
            >
              <Plus className="w-4 h-4" />
              Number
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addChartHotspot}
              className="gap-1 border-blue-500 text-blue-600 hover:bg-blue-50"
            >
              <BarChart3 className="w-4 h-4" />
              Chart
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addMapHotspot}
              className="gap-1 border-purple-500 text-purple-600 hover:bg-purple-50"
            >
              <MapIcon className="w-4 h-4" />
              Map
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={removeHotspot}
              disabled={hotspots.length <= 1}
              className="gap-1 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </Button>
          </div>

        {/* Active Hotspot Controls - different controls for different types */}
        {activeHotspot && imageUrl && activeHotspot.type === "live_number" && (
          <HotspotCalibrationControls
            hotspot={activeHotspot}
            displayValue={displayValues[activeHotspot.id] || "0"}
            onUpdate={(updates) => updateHotspot(activeIndex, updates)}
            onDisplayValueChange={updateDisplayValue}
          />
        )}
        
        {activeHotspot && imageUrl && activeHotspot.type === "chart" && (
          <ChartCalibrationControls
            hotspot={activeHotspot}
            onUpdate={(updates) => updateHotspot(activeIndex, updates)}
          />
        )}

        {activeHotspot && imageUrl && activeHotspot.type === "map" && (
          <MapCalibrationControls
            hotspot={activeHotspot}
            onUpdate={(updates) => updateHotspot(activeIndex, updates)}
            currentBounds={currentMapBounds}
            onZoomIn={mapControls?.zoomIn}
            onZoomOut={mapControls?.zoomOut}
          />
        )}

        {/* Footer Buttons */}
        <div className="flex justify-between items-center gap-2 pt-2 border-t border-border">
          {/* Save status indicator */}
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {isAutoSaving ? (
              <span className="text-amber-600 flex items-center gap-1">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </span>
            ) : isCapturing ? (
              <span className="text-blue-600 flex items-center gap-1">
                <Loader2 className="w-4 h-4 animate-spin" /> Capturing...
              </span>
            ) : lastSnapshotAt ? (
              <span className="text-blue-600 flex items-center gap-1">
                <Camera className="w-4 h-4" /> Snapshot: {lastSnapshotAt.toLocaleTimeString()}
              </span>
            ) : lastSavedAt ? (
              <span className="text-green-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> Saved
              </span>
            ) : null}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || isAutoSaving || isCapturing || !imageUrl || !name || !slug}
              variant="outline"
            >
              {isSaving && !isCapturing
                ? "Saving..."
                : savedTemplateId || mode === "edit"
                ? "Update Template"
                : "Create Template"}
            </Button>
            <Button
              onClick={handleSaveAndCapture}
              disabled={isSaving || isAutoSaving || isCapturing || isRefreshingServer || !imageUrl || !name || !slug}
              className="bg-blue-600 hover:bg-blue-700 gap-1"
            >
              <Camera className="w-4 h-4" />
              {isCapturing
                ? "Capturing..."
                : "Save & Capture"}
            </Button>
            <Button
              onClick={handleServerRefresh}
              disabled={isSaving || isAutoSaving || isCapturing || isRefreshingServer || !savedTemplateId || !campaignId}
              variant="outline"
              className="gap-1 border-orange-500 text-orange-600 hover:bg-orange-50"
              title="Call server-side edge function to regenerate snapshot with live metrics"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshingServer ? "animate-spin" : ""}`} />
              {isRefreshingServer ? "Refreshing..." : "Server Refresh"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
