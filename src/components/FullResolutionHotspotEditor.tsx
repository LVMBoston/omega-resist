import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent } from "./ui/card";
import { Trash2, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Hotspot {
  id: string;
  type: "sms" | "email" | "social";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  const [newHotspotType, setNewHotspotType] = useState<"sms" | "email" | "social">("sms");
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
      type: newHotspotType,
      label: newHotspotType.charAt(0).toUpperCase() + newHotspotType.slice(1),
      x: Math.max(0, Math.min(90, x)),
      y: Math.max(0, Math.min(90, y)),
      width: 16,
      height: 10,
    };

    const updatedHotspots = [...hotspots, newHotspot];
    setHotspots(updatedHotspots);
    onSave(updatedHotspots);
    setSelectedHotspot(newHotspot.id);
    setIsPlacing(false);
    toast({
      title: "Hotspot added",
      description: `${newHotspotType} hotspot placed`,
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
            <div className="flex items-center gap-4">
              <Select
                value={newHotspotType}
                onValueChange={(value: "sms" | "email" | "social") => setNewHotspotType(value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={() => setIsPlacing(true)}
                variant={isPlacing ? "default" : "outline"}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                {isPlacing ? "Click to place hotspot" : "Add Hotspot"}
              </Button>

              {isPlacing && (
                <Button onClick={() => setIsPlacing(false)} variant="ghost" size="sm">
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              )}

              <Button onClick={() => {
                setHotspots([]);
                onSave([]);
              }} variant="outline" size="sm">
                <X className="w-4 h-4 mr-2" />
                Clear All
              </Button>
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
                              <div className="font-medium">{hotspot.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {hotspot.type} | {hotspot.x.toFixed(1)}%, {hotspot.y.toFixed(1)}%
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
                        <Label>Type</Label>
                        <Select
                          value={selectedHotspotData.type}
                          onValueChange={(value: "sms" | "email" | "social") =>
                            updateHotspot(selectedHotspotData.id, { type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sms">SMS</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="social">Social</SelectItem>
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
