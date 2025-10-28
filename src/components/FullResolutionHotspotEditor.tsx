import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Card, CardContent } from "./ui/card";
import { Trash2, X, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaWhatsapp } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { BsShare, BsShareFill } from "react-icons/bs";
import mailIcon from "@/assets/mail-icon.png";
import textIcon from "@/assets/text-icon.svg";
import { detectOverlaps, getAllIntersections } from "@/lib/hotspotValidation";

interface IconPreset {
  id: string;
  label: string;
  type: "sms" | "email" | "social";
  icon?: React.ComponentType<{ className?: string; size?: number }>; // React icon component (optional)
  imageUrl?: string; // Custom image URL (optional)
  width: number; // percentage
  height: number; // percentage
}

interface Hotspot {
  id: string;
  iconId: string;
  type: "sms" | "email" | "social";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  labelPosition?: "top" | "bottom";
}

// Icon catalog organized by category with variants
const ICON_PRESETS: IconPreset[] = [
  // SMS variants - using custom iOS icon
  { id: "sms-ios", label: "Text Message", type: "sms", imageUrl: textIcon, width: 5, height: 4 },
  
  // Email variants - using custom iOS icon
  { id: "email-ios", label: "Email", type: "email", imageUrl: mailIcon, width: 5, height: 4 },
  
  // Social variants
  { id: "social-facebook", label: "Facebook", type: "social", icon: FaFacebookF, width: 5, height: 4 },
  { id: "social-instagram", label: "Instagram", type: "social", icon: FaInstagram, width: 5, height: 4 },
  { id: "social-twitter", label: "X (Twitter)", type: "social", icon: FaXTwitter, width: 5, height: 4 },
  { id: "social-linkedin", label: "LinkedIn", type: "social", icon: FaLinkedinIn, width: 5, height: 4 },
  { id: "social-whatsapp", label: "WhatsApp", type: "social", icon: FaWhatsapp, width: 5, height: 4 },
  { id: "social-share", label: "Share", type: "social", icon: BsShare, width: 5, height: 4 },
  { id: "social-share-filled", label: "Share Filled", type: "social", icon: BsShareFill, width: 5, height: 4 },
];

type IconCategory = "sms" | "email" | "social";

interface FullResolutionHotspotEditorProps {
  imageUrl: string;
  initialHotspots?: Hotspot[];
  onSave: (hotspots: Hotspot[]) => void;
}

export const FullResolutionHotspotEditor = ({
  imageUrl,
  initialHotspots = [],
  onSave,
}: FullResolutionHotspotEditorProps) => {
  const [hotspots, setHotspots] = useState<Hotspot[]>(initialHotspots);
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<IconCategory | null>(null);
  const [selectedIconPreset, setSelectedIconPreset] = useState<IconPreset | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const { toast } = useToast();

  // Detect overlaps in real-time
  const overlaps = useMemo(() => detectOverlaps(hotspots), [hotspots]);
  const intersections = useMemo(() => getAllIntersections(hotspots), [hotspots]);
  const overlapCount = overlaps.size;

  const categoryImages: Record<IconCategory, string> = {
    sms: textIcon,
    email: mailIcon,
    social: "" // Will use icon component for social
  };

  const categoryIcons: Record<IconCategory, React.ComponentType<{ className?: string }> | null> = {
    sms: null,
    email: null,
    social: BsShare
  };

  const categoryLabels: Record<IconCategory, string> = {
    sms: "SMS/Text",
    email: "Email",
    social: "Social Share"
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isPlacing || !selectedIconPreset || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newHotspot: Hotspot = {
      id: `hotspot-${Date.now()}`,
      iconId: selectedIconPreset.id,
      type: selectedIconPreset.type,
      label: selectedIconPreset.label,
      x: Math.max(0, Math.min(100 - selectedIconPreset.width, x)),
      y: Math.max(0, Math.min(100 - selectedIconPreset.height, y)),
      width: selectedIconPreset.width,
      height: selectedIconPreset.height,
      labelPosition: "bottom",
    };

    const updatedHotspots = [...hotspots, newHotspot];
    setHotspots(updatedHotspots);
    onSave(updatedHotspots);
    setSelectedHotspot(newHotspot.id);
    setIsPlacing(false);
    toast({
      title: "Hotspot added",
      description: `${selectedIconPreset.label} placed`,
    });
  };

  const updateHotspot = (id: string, updates: Partial<Hotspot>) => {
    const updatedHotspots = hotspots.map((h) => (h.id === id ? { ...h, ...updates } : h));
    setHotspots(updatedHotspots);
    onSave(updatedHotspots);
  };

  const deleteHotspot = (id: string) => {
    const updatedHotspots = hotspots.filter((h) => h.id !== id);
    setHotspots(updatedHotspots);
    onSave(updatedHotspots);
    if (selectedHotspot === id) setSelectedHotspot(null);
  };

  const handleMouseDown = (e: React.MouseEvent, hotspot: Hotspot) => {
    if (isPlacing) return;
    e.stopPropagation();
    
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const hotspotX = (hotspot.x / 100) * rect.width;
    const hotspotY = (hotspot.y / 100) * rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setIsDragging(hotspot.id);
    setDragOffset({
      x: mouseX - hotspotX,
      y: mouseY - hotspotY
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - dragOffset.x;
    const mouseY = e.clientY - rect.top - dragOffset.y;
    
    const x = (mouseX / rect.width) * 100;
    const y = (mouseY / rect.height) * 100;
    
    const hotspot = hotspots.find(h => h.id === isDragging);
    if (!hotspot) return;
    
    // Constrain to image bounds
    const constrainedX = Math.max(0, Math.min(100 - hotspot.width, x));
    const constrainedY = Math.max(0, Math.min(100 - hotspot.height, y));
    
    updateHotspot(isDragging, { x: constrainedX, y: constrainedY });
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  // Keyboard controls for fine-tuning position when dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const hotspot = hotspots.find(h => h.id === isDragging);
      if (!hotspot) return;

      let newX = hotspot.x;
      let newY = hotspot.y;
      const step = 0.5; // Move by 0.5% per keypress

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          newY = Math.max(0, hotspot.y - step);
          break;
        case "ArrowDown":
          e.preventDefault();
          newY = Math.min(100 - hotspot.height, hotspot.y + step);
          break;
        case "ArrowLeft":
          e.preventDefault();
          newX = Math.max(0, hotspot.x - step);
          break;
        case "ArrowRight":
          e.preventDefault();
          newX = Math.min(100 - hotspot.width, hotspot.x + step);
          break;
        case " ":
          e.preventDefault();
          setIsDragging(null);
          return;
      }

      if (newX !== hotspot.x || newY !== hotspot.y) {
        updateHotspot(isDragging, { x: newX, y: newY });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDragging, hotspots]);

  const selectedHotspotData = hotspots.find((h) => h.id === selectedHotspot);

  return (
    <div className="space-y-4">
      {overlapCount > 0 && (
        <div className="bg-red-100 dark:bg-red-950/50 border-2 border-red-500 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-red-900 dark:text-red-100">
              {overlapCount} Hotspot Overlap{overlapCount > 1 ? 's' : ''} Detected
            </h4>
            <p className="text-sm text-red-800 dark:text-red-200 mt-1">
              Overlapping hotspots cause ambiguous click behavior. Please reposition them so they don't touch.
            </p>
          </div>
        </div>
      )}
      <Card>
        <CardContent className="p-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Full Resolution Hotspot Editor</h3>
            <p className="text-sm text-muted-foreground">
              Click to place hotspots, then drag them to reposition. Use arrow keys for fine control and space to release. Changes auto-save when you submit the template.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  {!selectedCategory ? "1. Select Category" : `2. Choose ${categoryLabels[selectedCategory]} Icon`}
                </h4>
                {selectedCategory && (
                  <Button 
                    onClick={() => {
                      setSelectedCategory(null);
                      setSelectedIconPreset(null);
                      setIsPlacing(false);
                    }} 
                    variant="ghost" 
                    size="sm"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                )}
              </div>
              
              {!selectedCategory ? (
                // Step 1: Category selection
                <div className="grid grid-cols-3 gap-3">
                  {(["sms", "email", "social"] as IconCategory[]).map((category) => {
                    const CategoryIcon = categoryIcons[category];
                    const categoryImageUrl = categoryImages[category];
                    return (
                      <Button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        variant="outline"
                        className="flex flex-col items-center gap-2 h-auto py-4"
                      >
                        {categoryImageUrl ? (
                          <img src={categoryImageUrl} alt={categoryLabels[category]} className="w-8 h-8 object-contain" />
                        ) : CategoryIcon ? (
                          <CategoryIcon className="w-8 h-8" />
                        ) : null}
                        <span className="text-sm font-medium">{categoryLabels[category]}</span>
                      </Button>
                    );
                  })}
                </div>
              ) : (
                // Step 2: Icon variant selection
                <div className="grid grid-cols-2 gap-2">
                  {ICON_PRESETS.filter(p => p.type === selectedCategory).map((preset) => {
                    const PresetIcon = preset.icon;
                    return (
                      <Button
                        key={preset.id}
                        onClick={() => {
                          setSelectedIconPreset(preset);
                          setIsPlacing(true);
                        }}
                        variant={selectedIconPreset?.id === preset.id ? "default" : "outline"}
                        className="flex flex-col items-center gap-2 h-auto py-3"
                      >
                        {preset.imageUrl ? (
                          <img src={preset.imageUrl} alt={preset.label} className="w-8 h-8 object-contain" />
                        ) : PresetIcon ? (
                          <PresetIcon className="w-8 h-8" />
                        ) : null}
                        <span className="text-xs">{preset.label}</span>
                      </Button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t">
                <div className="text-sm text-muted-foreground flex-1">
                  {isPlacing && selectedIconPreset 
                    ? `Click on image to place "${selectedIconPreset.label}"` 
                    : selectedCategory
                    ? "Select an icon variant above"
                    : "Start by selecting a category"}
                </div>
                
                <Button onClick={() => {
                  setHotspots([]);
                  onSave([]);
                }} variant="outline" size="sm">
                  <X className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <div 
                  className="relative border rounded-lg overflow-hidden bg-muted"
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Hotspot editor"
                    className={isPlacing ? "w-full cursor-crosshair" : "w-full"}
                    onClick={handleImageClick}
                  />
                  {/* Render intersection overlays */}
                  {intersections.map((intersection, idx) => (
                    <div
                      key={`intersection-${idx}`}
                      className="absolute bg-red-500/30 border-2 border-red-500 pointer-events-none animate-pulse"
                      style={{
                        left: `${intersection.x}%`,
                        top: `${intersection.y}%`,
                        width: `${intersection.width}%`,
                        height: `${intersection.height}%`,
                      }}
                    />
                  ))}
                  {hotspots.map((hotspot) => {
                    const preset = ICON_PRESETS.find(p => p.id === hotspot.iconId);
                    const HotspotIcon = preset?.icon;
                    const hotspotImageUrl = preset?.imageUrl;
                    const hasOverlap = overlaps.has(hotspot.id);
                    const overlapPartners = overlaps.get(hotspot.id) || [];
                    
                    return (
                      <div
                        key={hotspot.id}
                        className={`absolute transition-all flex items-center justify-center ${
                          hasOverlap
                            ? "ring-4 ring-red-500 animate-pulse rounded-lg"
                            : selectedHotspot === hotspot.id
                            ? "ring-2 ring-yellow-400 rounded-lg"
                            : ""
                        } ${isDragging === hotspot.id ? "cursor-grabbing" : "cursor-grab"}`}
                        style={{
                          left: `${hotspot.x}%`,
                          top: `${hotspot.y}%`,
                          width: `${hotspot.width}%`,
                          height: `${hotspot.height}%`,
                        }}
                        onMouseDown={(e) => handleMouseDown(e, hotspot)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isDragging) setSelectedHotspot(hotspot.id);
                        }}
                      >
                        {hotspotImageUrl ? (
                          <img src={hotspotImageUrl} alt={hotspot.label} className="w-full h-full object-contain drop-shadow-lg" />
                        ) : HotspotIcon ? (
                          <HotspotIcon className="w-full h-full drop-shadow-lg" />
                        ) : null}
                        {hasOverlap && (
                          <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg z-10">
                            ⚠
                          </div>
                        )}
                        <div 
                          className={`absolute left-1/2 -translate-x-1/2 px-3 py-1.5 text-xs font-bold whitespace-nowrap pointer-events-none rounded-md shadow-lg ${
                            hotspot.labelPosition === "top" ? "-top-8" : "-bottom-8"
                          } ${
                            hasOverlap
                              ? "bg-red-500 text-white ring-2 ring-red-500/50"
                              : selectedHotspot === hotspot.id 
                              ? "bg-yellow-400 text-black ring-2 ring-yellow-400/50" 
                              : "bg-black/80 text-white"
                          }`}
                        >
                          {hotspot.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Hotspots ({hotspots.length})</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {hotspots.map((hotspot) => {
                      const preset = ICON_PRESETS.find(p => p.id === hotspot.iconId);
                      const ListIcon = preset?.icon;
                      const listImageUrl = preset?.imageUrl;
                      return (
                        <Card
                          key={hotspot.id}
                          className={`cursor-pointer transition-colors ${
                            overlaps.has(hotspot.id)
                              ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                              : selectedHotspot === hotspot.id 
                              ? "border-primary" 
                              : ""
                          }`}
                          onClick={() => setSelectedHotspot(hotspot.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm flex-1">
                                <div className="font-medium flex items-center gap-2">
                                  {overlaps.has(hotspot.id) && (
                                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                                  )}
                                  {listImageUrl ? (
                                    <img src={listImageUrl} alt={hotspot.label} className="w-4 h-4 object-contain" />
                                  ) : ListIcon ? (
                                    <ListIcon className="w-4 h-4" />
                                  ) : null}
                                   <span>{hotspot.label}</span>
                                 </div>
                              </div>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteHotspot(hotspot.id);
                                }}
                                variant="ghost"
                                size="sm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {selectedHotspotData && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <h4 className="font-semibold">Resize Icon</h4>

                      <div>
                        <Label>Icon Size</Label>
                        <div className="flex items-center gap-4 pt-2">
                          <Slider
                            value={[selectedHotspotData.width]}
                            onValueChange={(vals) => {
                              const newSize = vals[0];
                              const aspectRatio = selectedHotspotData.height / selectedHotspotData.width;
                              updateHotspot(selectedHotspotData.id, {
                                width: newSize,
                                height: newSize * aspectRatio
                              });
                            }}
                            min={5}
                            max={50}
                            step={1}
                            className="flex-1"
                          />
                          <span className="text-sm font-medium w-12 text-right">{selectedHotspotData.width.toFixed(0)}%</span>
                        </div>
                      </div>

                      <div>
                        <Label>Label</Label>
                        <Input
                          value={selectedHotspotData.label}
                          onChange={(e) =>
                            updateHotspot(selectedHotspotData.id, { label: e.target.value })
                          }
                          maxLength={10}
                        />
                      </div>

                      <div>
                        <Label>Label Position</Label>
                        <RadioGroup
                          value={selectedHotspotData.labelPosition || "bottom"}
                          onValueChange={(value: "top" | "bottom") =>
                            updateHotspot(selectedHotspotData.id, { labelPosition: value })
                          }
                          className="flex flex-col gap-2 pt-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="top" id="top" />
                            <Label htmlFor="top" className="font-normal cursor-pointer">Top Center</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="bottom" id="bottom" />
                            <Label htmlFor="bottom" className="font-normal cursor-pointer">Bottom Center</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
