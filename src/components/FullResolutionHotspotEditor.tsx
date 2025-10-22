import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent } from "./ui/card";
import { Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface IconPreset {
  id: string;
  label: string;
  type: "sms" | "email" | "social";
  icon: string; // emoji or symbol for preview
  width: number; // percentage
  height: number; // percentage
}

interface Hotspot {
  id: string;
  iconId: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Icon catalog with pre-defined dimensions
const ICON_PRESETS: IconPreset[] = [
  { id: "sms", label: "SMS/Text", type: "sms", icon: "💬", width: 14, height: 9 },
  { id: "email", label: "Email", type: "email", icon: "📧", width: 14, height: 9 },
  { id: "whatsapp", label: "WhatsApp", type: "social", icon: "📱", width: 14, height: 9 },
  { id: "facebook", label: "Facebook", type: "social", icon: "👤", width: 14, height: 9 },
  { id: "twitter", label: "Twitter/X", type: "social", icon: "🐦", width: 14, height: 9 },
  { id: "instagram", label: "Instagram", type: "social", icon: "📷", width: 14, height: 9 },
  { id: "linkedin", label: "LinkedIn", type: "social", icon: "💼", width: 14, height: 9 },
  { id: "share", label: "Share", type: "social", icon: "↗️", width: 14, height: 9 },
];

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
  const [selectedIconPreset, setSelectedIconPreset] = useState<IconPreset>(ICON_PRESETS[0]);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const { toast } = useToast();

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isPlacing || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newHotspot: Hotspot = {
      id: `hotspot-${Date.now()}`,
      iconId: selectedIconPreset.id,
      label: selectedIconPreset.label,
      x: Math.max(0, Math.min(100 - selectedIconPreset.width, x)),
      y: Math.max(0, Math.min(100 - selectedIconPreset.height, y)),
      width: selectedIconPreset.width,
      height: selectedIconPreset.height,
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


  const selectedHotspotData = hotspots.find((h) => h.id === selectedHotspot);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Full Resolution Hotspot Editor</h3>
            <p className="text-sm text-muted-foreground">
              Click to place hotspots, then drag them to reposition. Changes auto-save when you submit the template.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">Select Icon:</h4>
                {isPlacing && (
                  <Button onClick={() => setIsPlacing(false)} variant="ghost" size="sm">
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                )}
              </div>
              
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {ICON_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    onClick={() => {
                      setSelectedIconPreset(preset);
                      setIsPlacing(true);
                    }}
                    variant={isPlacing && selectedIconPreset.id === preset.id ? "default" : "outline"}
                    className="flex-shrink-0 flex flex-col items-center gap-1 h-auto py-3 px-4"
                    size="sm"
                  >
                    <span className="text-2xl">{preset.icon}</span>
                    <span className="text-xs whitespace-nowrap">{preset.label}</span>
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">
                  {isPlacing ? `Click on image to place ${selectedIconPreset.label}` : "Select an icon above to start placing"}
                </div>
                
                <Button onClick={() => {
                  setHotspots([]);
                  onSave([]);
                }} variant="outline" size="sm" className="ml-auto">
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
                  {hotspots.map((hotspot) => (
                    <div
                      key={hotspot.id}
                      className={`absolute border-4 transition-all ${
                        selectedHotspot === hotspot.id
                          ? "border-yellow-400 bg-yellow-400/30 shadow-lg ring-2 ring-yellow-400"
                          : "border-blue-500 bg-blue-500/10 opacity-50"
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
                      <div className={`absolute -top-7 left-0 border rounded px-2 py-1 text-xs font-semibold whitespace-nowrap pointer-events-none ${
                        selectedHotspot === hotspot.id 
                          ? "bg-yellow-400 text-black" 
                          : "bg-background text-muted-foreground"
                      }`}>
                        {hotspot.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Hotspots ({hotspots.length})</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {hotspots.map((hotspot) => (
                      <Card
                        key={hotspot.id}
                        className={`cursor-pointer transition-colors ${
                          selectedHotspot === hotspot.id ? "border-primary" : ""
                        }`}
                        onClick={() => setSelectedHotspot(hotspot.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm">
                              <div className="font-medium flex items-center gap-2">
                                <span>{ICON_PRESETS.find(p => p.id === hotspot.iconId)?.icon || "📍"}</span>
                                <span>{hotspot.label}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {hotspot.x.toFixed(1)}%, {hotspot.y.toFixed(1)}%
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
                    ))}
                  </div>
                </div>

                {selectedHotspotData && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <h4 className="font-semibold">Edit Hotspot</h4>

                      <div>
                        <Label>Label</Label>
                        <Input
                          value={selectedHotspotData.label}
                          onChange={(e) =>
                            updateHotspot(selectedHotspotData.id, { label: e.target.value })
                          }
                        />
                      </div>

                      <div>
                        <Label>Icon Type</Label>
                        <Select
                          value={selectedHotspotData.iconId}
                          onValueChange={(value: string) =>
                            {
                              const preset = ICON_PRESETS.find(p => p.id === value);
                              if (preset) {
                                updateHotspot(selectedHotspotData.id, { 
                                  iconId: value,
                                  label: preset.label,
                                  width: preset.width,
                                  height: preset.height
                                });
                              }
                            }
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            {ICON_PRESETS.map((preset) => (
                              <SelectItem key={preset.id} value={preset.id}>
                                <span className="flex items-center gap-2">
                                  <span>{preset.icon}</span>
                                  <span>{preset.label}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>X (%)</Label>
                          <Input
                            type="number"
                            value={selectedHotspotData.x.toFixed(1)}
                            onChange={(e) =>
                              updateHotspot(selectedHotspotData.id, {
                                x: parseFloat(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Y (%)</Label>
                          <Input
                            type="number"
                            value={selectedHotspotData.y.toFixed(1)}
                            onChange={(e) =>
                              updateHotspot(selectedHotspotData.id, {
                                y: parseFloat(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Width (%)</Label>
                          <Input
                            type="number"
                            value={selectedHotspotData.width.toFixed(1)}
                            onChange={(e) =>
                              updateHotspot(selectedHotspotData.id, {
                                width: parseFloat(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Height (%)</Label>
                          <Input
                            type="number"
                            value={selectedHotspotData.height.toFixed(1)}
                            onChange={(e) =>
                              updateHotspot(selectedHotspotData.id, {
                                height: parseFloat(e.target.value),
                              })
                            }
                          />
                        </div>
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
