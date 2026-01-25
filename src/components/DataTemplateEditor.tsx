import { useRef, useState, useCallback } from "react";
import { Hotspot } from "@/types/viralTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Upload, Image as ImageIcon } from "lucide-react";
import { HotspotCalibrationControls } from "@/components/HotspotCalibrationControls";
import { DraggableHotspotOverlay } from "@/components/DraggableHotspotOverlay";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Default hotspot template for data templates
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

interface DataTemplateEditorProps {
  initialHotspots?: Hotspot[];
  initialImageUrl?: string;
  templateName?: string;
  templateDescription?: string;
  templateSlug?: string;
  onSave: (data: {
    hotspots: Hotspot[];
    imageUrl: string;
    name: string;
    slug: string;
    description?: string;
  }) => Promise<void>;
  onCancel: () => void;
  mode: "create" | "edit";
}

export function DataTemplateEditor({
  initialHotspots = [],
  initialImageUrl = "",
  templateName = "",
  templateDescription = "",
  templateSlug = "",
  onSave,
  onCancel,
  mode,
}: DataTemplateEditorProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form state
  const [name, setName] = useState(templateName);
  const [slug, setSlug] = useState(templateSlug);
  const [description, setDescription] = useState(templateDescription);
  const [imageUrl, setImageUrl] = useState(initialImageUrl);

  // Initialize with at least one hotspot if empty
  const [hotspots, setHotspots] = useState<Hotspot[]>(
    initialHotspots.length > 0 ? initialHotspots : [createDefaultHotspot(0)]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [displayValues, setDisplayValues] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {};
    const defaultValues = ["142", "87", "1,234", "456", "321", "198", "73", "OMEGA PA", "Jan 15", "Jan 25", "9:00 AM", "2:45 PM"];
    (initialHotspots.length > 0 ? initialHotspots : [createDefaultHotspot(0)]).forEach((h, i) => {
      values[h.id] = defaultValues[i % defaultValues.length] || "0";
    });
    return values;
  });

  const activeHotspot = hotspots[activeIndex];

  // Update a hotspot by index
  const updateHotspot = useCallback((index: number, updates: Partial<Hotspot>) => {
    setHotspots((prev) =>
      prev.map((h, i) => (i === index ? { ...h, ...updates } : h))
    );
  }, []);

  // Add a new hotspot, inheriting style from the active hotspot
  const addHotspot = useCallback(() => {
    const newIndex = hotspots.length;
    const baseHotspot = createDefaultHotspot(newIndex);

    // Inherit styling and dimensions from the active hotspot if one exists
    if (activeHotspot) {
      baseHotspot.width = activeHotspot.width;
      baseHotspot.height = activeHotspot.height;
      if (activeHotspot.liveNumberStyle) {
        baseHotspot.liveNumberStyle = { ...activeHotspot.liveNumberStyle };
      }
    }

    setHotspots((prev) => [...prev, baseHotspot]);
    setDisplayValues((prev) => ({ ...prev, [baseHotspot.id]: "0" }));
    setActiveIndex(newIndex);
  }, [hotspots.length, activeHotspot]);

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
            Slug (unique ID) *
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Image Upload / Preview */}
        <div className="flex-1 flex items-center justify-center p-4 bg-black/95 min-h-[400px] overflow-auto">
          {imageUrl ? (
            <div className="relative max-w-4xl w-full">
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
                />
              )}

              {/* Replace Image Button */}
              <div className="absolute top-2 right-2">
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
            Add
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

        {/* Active Hotspot Controls */}
        {activeHotspot && imageUrl && (
          <HotspotCalibrationControls
            hotspot={activeHotspot}
            displayValue={displayValues[activeHotspot.id] || "0"}
            onUpdate={(updates) => updateHotspot(activeIndex, updates)}
            onDisplayValueChange={updateDisplayValue}
          />
        )}

        {/* Footer Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !imageUrl || !name || !slug}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSaving
              ? "Saving..."
              : mode === "edit"
              ? "Update Template"
              : "Create Template"}
          </Button>
        </div>
      </div>
    </div>
  );
}
