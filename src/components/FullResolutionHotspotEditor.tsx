import { useState, useRef, useEffect, useMemo } from "react";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Card, CardContent } from "./ui/card";
import { Trash2, X, AlertTriangle, ExternalLink, MailPlus, ChevronUp, ChevronDown, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { fetchOEmbed, type OEmbedResult } from "@/lib/oEmbedValidation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaWhatsapp } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { BsShare, BsShareFill } from "react-icons/bs";
import mailIcon from "@/assets/mail-icon.png";
import textIcon from "@/assets/text-icon.png";
import playButtonIcon from "@/assets/play-button.png";
import shareIcon from "@/assets/share-icon.png";
import emailLinksIcon from "@/assets/email-links-icon.png";
import externalLinkIcon from "@/assets/external-link-icon.png";
import { detectOverlaps, getAllIntersections, detectOutOfBounds, getMaxSize } from "@/lib/hotspotValidation";

interface IconPreset {
  id: string;
  label: string;
  type: "sms" | "email" | "social" | "external_link" | "email_links" | "video" | "vimeo" | "youtube";
  icon?: React.ComponentType<{ className?: string; size?: number }>; // React icon component (optional)
  imageUrl?: string; // Custom image URL (optional)
  width: number; // percentage
  height: number; // percentage
}

interface Hotspot {
  id: string;
  iconId: string;
  type: "sms" | "email" | "social" | "external_link" | "email_links" | "video" | "vimeo" | "youtube";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  labelPosition?: "top" | "bottom";
  url?: string;
  appStoreUrl?: string;
  playStoreUrl?: string;
  fallbackUrl?: string;
  emailLinksSubject?: string;
  emailLinksShowLabels?: boolean;
  isTransparent?: boolean;
}

// Simple placeholder base64 PNG for social icons (blue circle)
const SOCIAL_PLACEHOLDER = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAABfUlEQVR4nO2ZS0oDQRCGP0VBBBHx8QBevIKP3bgQb+BKvYKPjSfwAl5A8AaCiuJCEQVRdOFGUXThQvGBiA+UCQyEQCadma6e7pkfPoiZTPd8+auqe7ohhBBCCCFqAuiANaAHnIAr4BF4BT6Bk+z1O2CdzAfmgDYwd60twAngFFgGGsBU9mg659aBQ2A3u84BcJJdO8haQLPwDu1lXx5jCdgBHoDxD5onwHb2vLj4SHfkvt6sUYK+M4pjDVgs+zv1Y9nuBVguSjhLaLvJNEtYbxbYqphIp2IinZyEbdJgL2f9vsC6/Rz1+znq93PU7+eo389Rv5+jfj9H/X6O+v0c9fs56vdz1O/nqN/PUb+fo34/R/1+jvr9HPX7Oer3c9Tv56jfz1G/n6N+P0f9fo76/Rz1B5PIKMd4lLB+lGM8Slg/yjEeJawf5RiPEtaPcoxHCetHOcajhPWjHONRwvpRjvEoYf0ox3iUsH6UYzxKWD/KMR4lrB8FcA2sAlP/PRwhhBBCCBGYL+R5m3PWztpYAAAAAElFTkSuQmCC";

// Icon catalog organized by category with variants
const ICON_PRESETS: IconPreset[] = [
  // SMS variants - using custom iOS icon (real PNG)
  { id: "sms-ios", label: "Text Message", type: "sms", imageUrl: textIcon, width: 5, height: 4 },
  
  // Email variants - using custom iOS icon (real PNG)
  { id: "email-ios", label: "Email", type: "email", imageUrl: mailIcon, width: 5, height: 4 },
  
  // Social variants - placeholder PNGs (replace when real icons provided)
  { id: "social-facebook", label: "Facebook (placeholder)", type: "social", imageUrl: SOCIAL_PLACEHOLDER, width: 5, height: 4 },
  { id: "social-instagram", label: "Instagram (placeholder)", type: "social", imageUrl: SOCIAL_PLACEHOLDER, width: 5, height: 4 },
  { id: "social-twitter", label: "X/Twitter (placeholder)", type: "social", imageUrl: SOCIAL_PLACEHOLDER, width: 5, height: 4 },
  { id: "social-linkedin", label: "LinkedIn (placeholder)", type: "social", imageUrl: SOCIAL_PLACEHOLDER, width: 5, height: 4 },
  { id: "social-whatsapp", label: "WhatsApp (placeholder)", type: "social", imageUrl: SOCIAL_PLACEHOLDER, width: 5, height: 4 },
  { id: "social-share", label: "Share (placeholder)", type: "social", imageUrl: SOCIAL_PLACEHOLDER, width: 5, height: 4 },
  { id: "social-share-filled", label: "Share Filled (placeholder)", type: "social", imageUrl: SOCIAL_PLACEHOLDER, width: 5, height: 4 },
  
  // External link variants
  { id: "link-icon", label: "External Link", type: "external_link", imageUrl: externalLinkIcon, width: 5, height: 4 },
  
  
  // Email links variant
  { id: "email-links", label: "Email Links", type: "email_links", icon: MailPlus as any, width: 8, height: 8 },

  // Video variant (auto-detects YouTube or Vimeo from URL)
  { id: "video", label: "Video", type: "video", imageUrl: playButtonIcon, width: 5, height: 4 },
];

type IconCategory = "sms" | "email" | "social" | "external_link" | "email_links" | "video";

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
  const [oEmbedResult, setOEmbedResult] = useState<OEmbedResult | null>(null);
  const [oEmbedLoading, setOEmbedLoading] = useState(false);
  const [oEmbedError, setOEmbedError] = useState<string | null>(null);

  // Selected hotspot data for oEmbed
  const selectedHotspotData = hotspots.find((h) => h.id === selectedHotspot);

  // Debounced oEmbed validation for video URLs
  useEffect(() => {
    if (!selectedHotspotData) return;
    if (selectedHotspotData.type !== "video" && selectedHotspotData.type !== "vimeo" && selectedHotspotData.type !== "youtube") {
      setOEmbedResult(null);
      setOEmbedError(null);
      setOEmbedLoading(false);
      return;
    }
    const url = selectedHotspotData.url;
    if (!url || url.length < 10) {
      setOEmbedResult(null);
      setOEmbedError(null);
      setOEmbedLoading(false);
      return;
    }
    setOEmbedLoading(true);
    setOEmbedError(null);
    const timer = setTimeout(async () => {
      const result = await fetchOEmbed(url);
      if (result) {
        setOEmbedResult(result);
        setOEmbedError(null);
      } else {
        setOEmbedResult(null);
        setOEmbedError("Could not validate this URL — check that it's a valid YouTube or Vimeo link");
      }
      setOEmbedLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [selectedHotspotData?.url, selectedHotspotData?.type, selectedHotspotData?.id]);

  const overlaps = useMemo(() => detectOverlaps(hotspots), [hotspots]);
  const intersections = useMemo(() => getAllIntersections(hotspots), [hotspots]);
  const overlapCount = overlaps.size;
  const outOfBoundsIds = useMemo(() => detectOutOfBounds(hotspots), [hotspots]);
  const outOfBoundsCount = outOfBoundsIds.length;

  const categoryImages: Record<IconCategory, string> = {
    sms: textIcon,
    email: mailIcon,
    social: shareIcon,
    external_link: externalLinkIcon,
    email_links: emailLinksIcon,
    video: playButtonIcon,
  };

  const categoryIcons: Record<IconCategory, React.ComponentType<{ className?: string }> | null> = {
    sms: null,
    email: null,
    social: null,
    external_link: null,
    email_links: null,
    video: null,
  };

  const categoryLabels: Record<IconCategory, string> = {
    sms: "SMS",
    email: "Email",
    social: "Social",
    external_link: "Link",
    email_links: "Email Links",
    video: "Video",
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isPlacing || !selectedIconPreset || !imageRef.current) return;

    // Check if a hotspot of this type already exists (allow multiple external_link and app_download)
    const allowMultiple = ['external_link', 'video', 'vimeo', 'youtube'];
    if (!allowMultiple.includes(selectedIconPreset.type)) {
      const existingTypeHotspot = hotspots.find(h => h.type === selectedIconPreset.type);
      if (existingTypeHotspot) {
        toast({
          title: "Duplicate hotspot type",
          description: `A ${selectedIconPreset.type} hotspot already exists. Please remove it first before adding another.`,
          variant: "destructive",
        });
        setIsPlacing(false);
        return;
      }
    }

    const labelPadding = 2; // 2% padding for labels (reduced from 4%)
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Auto-number label for types that allow multiples
    const allowMultipleTypes = ['external_link'];
    let label = selectedIconPreset.label;
    if (allowMultipleTypes.includes(selectedIconPreset.type)) {
      const existingCount = hotspots.filter(h => h.type === selectedIconPreset.type).length;
      if (existingCount > 0) {
        label = `${selectedIconPreset.label} ${existingCount + 1}`;
      }
    }

    const newHotspot: Hotspot = {
      id: `hotspot-${Date.now()}`,
      iconId: selectedIconPreset.id,
      type: selectedIconPreset.type,
      label,
      x: Math.max(0, Math.min(100 - selectedIconPreset.width, x)),
      y: Math.max(labelPadding, Math.min(100 - labelPadding - selectedIconPreset.height, y)),
      width: selectedIconPreset.width,
      height: selectedIconPreset.height,
      labelPosition: "bottom",
      ...(selectedIconPreset.type === "external_link" && { url: "" }),
      ...(selectedIconPreset.type === "video" && { url: "" }),
      ...(selectedIconPreset.type === "email_links" && { emailLinksSubject: "", emailLinksShowLabels: false }),
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
    
    const labelPadding = 2; // 2% padding for labels (reduced from 4%)
    const rect = imageRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - dragOffset.x;
    const mouseY = e.clientY - rect.top - dragOffset.y;
    
    const x = (mouseX / rect.width) * 100;
    const y = (mouseY / rect.height) * 100;
    
    const hotspot = hotspots.find(h => h.id === isDragging);
    if (!hotspot) return;
    
    // Constrain to image bounds with label padding
    const constrainedX = Math.max(0, Math.min(100 - hotspot.width, x));
    const constrainedY = Math.max(labelPadding, Math.min(100 - labelPadding - hotspot.height, y));
    
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

  // selectedHotspotData is declared above (line 115) for oEmbed + render use

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
      {outOfBoundsCount > 0 && (
        <div className="bg-orange-100 dark:bg-orange-950/50 border-2 border-orange-500 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-orange-900 dark:text-orange-100">
              {outOfBoundsCount} Hotspot{outOfBoundsCount > 1 ? 's' : ''} Out of Bounds
            </h4>
            <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
              Hotspots extend beyond the image boundaries. Please resize or reposition them to fit within the image.
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
                <div className="grid grid-cols-6 gap-2">
                  {(["sms", "email", "social", "external_link", "email_links", "vimeo", "youtube"] as IconCategory[]).map((category) => {
                    const CategoryIcon = categoryIcons[category];
                    const categoryImageUrl = categoryImages[category];
                    return (
                      <Button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        variant="outline"
                        className="flex flex-col items-center gap-1.5 h-auto py-3 px-2"
                      >
                        {categoryImageUrl ? (
                          <img src={categoryImageUrl} alt={categoryLabels[category]} className="w-6 h-6 object-contain" />
                        ) : CategoryIcon ? (
                          <CategoryIcon className="w-6 h-6" />
                        ) : null}
                        <span className="text-xs font-medium text-center leading-tight">{categoryLabels[category]}</span>
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
                    const isOutOfBounds = outOfBoundsIds.includes(hotspot.id);
                    const overlapPartners = overlaps.get(hotspot.id) || [];
                    
                    return (
                      <div
                        key={hotspot.id}
                        className={`absolute transition-all flex items-center justify-center ${
                          hasOverlap
                            ? "ring-4 ring-red-500 animate-pulse rounded-lg"
                            : isOutOfBounds
                            ? "ring-4 ring-orange-500 animate-pulse rounded-lg"
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
                        {hotspot.isTransparent ? (
                          <div className="w-full h-full border-2 border-dashed border-muted-foreground/40 rounded flex items-center justify-center">
                            <EyeOff className="w-1/3 h-1/3 text-muted-foreground/40" />
                          </div>
                        ) : hotspotImageUrl ? (
                          <img src={hotspotImageUrl} alt={hotspot.label} className="w-full h-full object-contain drop-shadow-lg" />
                        ) : HotspotIcon ? (
                          <HotspotIcon className="w-full h-full drop-shadow-lg" />
                        ) : null}
                        {(hasOverlap || isOutOfBounds) && (
                          <div className={`absolute -top-2 -right-2 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg z-10 ${
                            hasOverlap ? "bg-red-500" : "bg-orange-500"
                          } text-white`}>
                            ⚠
                          </div>
                        )}
                        {hotspot.label && hotspot.label.trim().length > 0 && hotspot.type !== 'external_link' && hotspot.type !== 'vimeo' && hotspot.type !== 'youtube' && (
                        <div 
                          className={`absolute left-1/2 -translate-x-1/2 px-3 py-1.5 text-xs font-bold whitespace-nowrap pointer-events-none rounded-md shadow-lg ${
                            hotspot.labelPosition === "top" ? "-top-8" : "-bottom-8"
                          } ${
                            hasOverlap
                              ? "bg-red-500 text-white ring-2 ring-red-500/50"
                              : isOutOfBounds
                              ? "bg-orange-500 text-white ring-2 ring-orange-500/50"
                              : selectedHotspot === hotspot.id 
                              ? "bg-yellow-400 text-black ring-2 ring-yellow-400/50" 
                              : "bg-black/80 text-white"
                          }`}
                        >
                          {hotspot.label}
                        </div>
                        )}
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
                      const isOutOfBounds = outOfBoundsIds.includes(hotspot.id);
                      return (
                        <Card
                          key={hotspot.id}
                          className={`cursor-pointer transition-colors ${
                            overlaps.has(hotspot.id)
                              ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                              : isOutOfBounds
                              ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
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
                                  {isOutOfBounds && (
                                    <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
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
                    <CardContent className="p-3 space-y-2">
                      {/* Position controls - active when not dragging */}
                      <div className={`${isDragging ? 'opacity-40 pointer-events-none' : ''}`}>
                        <h4 className="font-semibold text-sm mb-1">Position</h4>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <Label className="text-xs w-4">X</Label>
                            <span className="text-xs font-medium w-12">{Math.round(selectedHotspotData.x)}%</span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                className="h-4 w-6 p-0 flex items-center justify-center hover:bg-muted rounded"
                                tabIndex={-1}
                                onClick={() => {
                                  const newX = Math.min(100 - selectedHotspotData.width, selectedHotspotData.x + 0.5);
                                  updateHotspot(selectedHotspotData.id, { x: newX });
                                }}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                className="h-4 w-6 p-0 flex items-center justify-center hover:bg-muted rounded"
                                tabIndex={-1}
                                onClick={() => {
                                  const newX = Math.max(0, selectedHotspotData.x - 0.5);
                                  updateHotspot(selectedHotspotData.id, { x: newX });
                                }}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs w-4">Y</Label>
                            <span className="text-xs font-medium w-12">{Math.round(selectedHotspotData.y)}%</span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                className="h-4 w-6 p-0 flex items-center justify-center hover:bg-muted rounded"
                                tabIndex={-1}
                                onClick={() => {
                                  const newY = Math.min(100 - selectedHotspotData.height, selectedHotspotData.y + 0.5);
                                  updateHotspot(selectedHotspotData.id, { y: newY });
                                }}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                className="h-4 w-6 p-0 flex items-center justify-center hover:bg-muted rounded"
                                tabIndex={-1}
                                onClick={() => {
                                  const newY = Math.max(0, selectedHotspotData.y - 0.5);
                                  updateHotspot(selectedHotspotData.id, { y: newY });
                                }}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <h4 className="font-semibold text-sm">Resize</h4>

                      {/* Transparent overlay toggle */}
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <Label className="text-sm">Transparent overlay</Label>
                          <p className="text-xs text-muted-foreground">Hide icon — use when slide image already has a visual element.</p>
                        </div>
                        <Switch
                          checked={selectedHotspotData.isTransparent || false}
                          onCheckedChange={(checked) =>
                            updateHotspot(selectedHotspotData.id, { isTransparent: checked } as any)
                          }
                        />
                      </div>

                      <div>
                        <Label>Icon Size</Label>
                        <div className="flex items-center gap-2 pt-2">
                          <span className="text-sm font-medium w-12">{selectedHotspotData.width.toFixed(0)}%</span>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              className="h-5 w-7 p-0 flex items-center justify-center hover:bg-muted rounded"
                              tabIndex={-1}
                              onClick={() => {
                                const newSize = Math.min(100, selectedHotspotData.width + 1);
                                const aspectRatio = selectedHotspotData.height / selectedHotspotData.width;
                                const newHeight = newSize * aspectRatio;
                                const maxSizeConstraints = getMaxSize(selectedHotspotData.x, selectedHotspotData.y, aspectRatio);
                                updateHotspot(selectedHotspotData.id, {
                                  width: Math.min(newSize, maxSizeConstraints.maxWidth),
                                  height: Math.min(newHeight, maxSizeConstraints.maxHeight),
                                });
                              }}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              className="h-5 w-7 p-0 flex items-center justify-center hover:bg-muted rounded"
                              tabIndex={-1}
                              onClick={() => {
                                const newSize = Math.max(5, selectedHotspotData.width - 1);
                                const aspectRatio = selectedHotspotData.height / selectedHotspotData.width;
                                const newHeight = newSize * aspectRatio;
                                updateHotspot(selectedHotspotData.id, {
                                  width: newSize,
                                  height: newHeight,
                                });
                              }}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {selectedHotspotData.type !== 'email_links' && (
                      <div>
                        <div className="flex items-center gap-1">
                          <Label>Label</Label>
                          {selectedHotspotData.type === 'external_link' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-muted-foreground cursor-help text-xs">ⓘ</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-[200px] text-xs">If present, this label will appear in the bundled email message.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <Input
                          value={selectedHotspotData.label}
                          onChange={(e) =>
                            updateHotspot(selectedHotspotData.id, { label: e.target.value })
                          }
                          maxLength={15}
                        />
                      </div>
                      )}

                      {(selectedHotspotData.type === "external_link" || selectedHotspotData.type === "video" || selectedHotspotData.type === "vimeo" || selectedHotspotData.type === "youtube") && (
                        <div className="space-y-2">
                          <Label>{selectedHotspotData.type === "video" || selectedHotspotData.type === "vimeo" || selectedHotspotData.type === "youtube" ? "Video URL" : "URL"}</Label>
                          <Input
                            value={selectedHotspotData.url || ""}
                            onChange={(e) =>
                              updateHotspot(selectedHotspotData.id, { url: e.target.value })
                            }
                            placeholder={selectedHotspotData.type === "video" || selectedHotspotData.type === "vimeo" || selectedHotspotData.type === "youtube" ? "https://youtube.com/watch?v=... or https://vimeo.com/..." : "https://example.com"}
                            type="url"
                          />

                          {/* oEmbed preview for video types */}
                          {(selectedHotspotData.type === "video" || selectedHotspotData.type === "vimeo" || selectedHotspotData.type === "youtube") && selectedHotspotData.url && (
                            <div className="mt-2">
                              {oEmbedLoading && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Validating…
                                </div>
                              )}
                              {oEmbedError && !oEmbedLoading && (
                                <p className="text-sm text-destructive py-1">{oEmbedError}</p>
                              )}
                              {oEmbedResult && !oEmbedLoading && (
                                <div className="flex items-start gap-3 rounded-md border border-border bg-muted/50 p-2">
                                  {oEmbedResult.thumbnailUrl && (
                                    <img
                                      src={oEmbedResult.thumbnailUrl}
                                      alt={oEmbedResult.title}
                                      className="w-[120px] rounded object-cover flex-shrink-0"
                                    />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium leading-tight truncate">{oEmbedResult.title}</p>
                                    <span className="inline-block mt-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                      {oEmbedResult.provider}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}



                      {selectedHotspotData.type === "email_links" && (
                        <div className="space-y-3">
                          <div>
                            <Label>Email Subject</Label>
                            <Input
                              value={(selectedHotspotData as any).emailLinksSubject || ""}
                              onChange={(e) =>
                                updateHotspot(selectedHotspotData.id, { emailLinksSubject: e.target.value } as any)
                              }
                              placeholder="Resources for Action"
                            />
                          </div>
                        </div>
                      )}

                      {(selectedHotspotData.type === 'external_link' || selectedHotspotData.type === 'vimeo' || selectedHotspotData.type === 'youtube') && selectedHotspotData.url && (
                        <div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full mb-4 flex items-center gap-2"
                            onClick={() => {
                              window.open(selectedHotspotData.url, "_blank");
                              toast({
                                title: "Test URL Launched",
                                description: `Opening ${selectedHotspotData.url}`,
                              });
                            }}
                          >
                            {(selectedHotspotData.type === 'vimeo' || selectedHotspotData.type === 'youtube') && oEmbedResult ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <ExternalLink className="w-4 h-4" />
                            )}
                            Test URL
                          </Button>
                        </div>
                      )}

                      {selectedHotspotData.type !== 'external_link' && selectedHotspotData.type !== 'email_links' && selectedHotspotData.type !== 'vimeo' && (
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
                      )}
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

// ============================================
// THUMBNAIL GENERATION FUNCTIONS
// ============================================

/**
 * Generates a thumbnail image by compositing the base image with hotspot icons
 */
export const generateThumbnail = async (
  baseImageUrl: string,
  hotspots: Hotspot[],
  clearSelection?: () => void
): Promise<Blob> => {
  // Clear any selection before generating thumbnail
  if (clearSelection) {
    clearSelection();
    // Small delay to ensure UI updates
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Failed to get canvas context'));

    const baseImg = new Image();
    baseImg.crossOrigin = 'anonymous';
    
    baseImg.onload = async () => {
      // Set canvas to match image dimensions
      canvas.width = baseImg.width;
      canvas.height = baseImg.height;
      
      // Draw base image
      ctx.drawImage(baseImg, 0, 0);
      
      // Draw each hotspot icon and label
      for (const hotspot of hotspots) {
        // Skip transparent hotspots — they have no visible icon
        if (hotspot.isTransparent) continue;
        const iconPreset = ICON_PRESETS.find(p => p.id === hotspot.iconId);
        if (!iconPreset?.imageUrl) continue;
        
        const iconImg = new Image();
        iconImg.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolveIcon, rejectIcon) => {
          iconImg.onload = () => {
            const x = (hotspot.x / 100) * canvas.width;
            const y = (hotspot.y / 100) * canvas.height;
            const width = (hotspot.width / 100) * canvas.width;
            const height = (hotspot.height / 100) * canvas.height;
            
            // Draw icon
            ctx.drawImage(iconImg, x, y, width, height);
            
            // Draw label (skip for external_link — label is email metadata only)
            if (hotspot.type !== 'external_link') {
            const fontSize = Math.max(14, width * 0.15);
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Measure text for background
            const text = hotspot.label;
            const metrics = ctx.measureText(text);
            const textWidth = metrics.width;
            const textHeight = fontSize * 1.4;
            const padding = 8;
            
            // Calculate label position
            const labelX = x + width / 2;
            const labelY = hotspot.labelPosition === 'top' 
              ? y - textHeight / 2 - padding 
              : y + height + textHeight / 2 + padding;
            
            // Draw background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.roundRect(
              labelX - textWidth / 2 - padding,
              labelY - textHeight / 2,
              textWidth + padding * 2,
              textHeight,
              6
            );
            ctx.fill();
            
            // Draw text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, labelX, labelY);
            }
            
            resolveIcon();
          };
          iconImg.onerror = () => rejectIcon(new Error(`Failed to load icon: ${hotspot.iconId}`));
          iconImg.src = iconPreset.imageUrl;
        }).catch(err => console.warn('Icon load failed:', err));
      }
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create thumbnail blob'));
      }, 'image/png');
    };
    
    baseImg.onerror = () => reject(new Error('Failed to load base image'));
    baseImg.src = baseImageUrl;
  });
};

/**
 * Uploads a thumbnail blob to Supabase Storage
 */
export const uploadThumbnail = async (
  blob: Blob,
  templateSlug: string
): Promise<string> => {
  const fileName = `${templateSlug}-thumbnail-${Date.now()}.png`;
  const filePath = `interactive-templates/thumbnails/${fileName}`;
  
  const { error: uploadError } = await supabase.storage
    .from('slides')
    .upload(filePath, blob, {
      contentType: 'image/png',
      upsert: true,
    });
  
  if (uploadError) throw uploadError;
  
  const { data: { publicUrl } } = supabase.storage
    .from('slides')
    .getPublicUrl(filePath);
  
  return publicUrl;
};

/**
 * Combined function: generates and uploads thumbnail in one call
 */
export const generateAndUploadThumbnail = async (
  imageUrl: string,
  hotspots: Hotspot[],
  templateSlug: string,
  clearSelection?: () => void
): Promise<string> => {
  const thumbnailBlob = await generateThumbnail(imageUrl, hotspots, clearSelection);
  const thumbnailUrl = await uploadThumbnail(thumbnailBlob, templateSlug);
  return thumbnailUrl;
};
