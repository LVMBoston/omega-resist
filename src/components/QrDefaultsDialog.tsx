import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/hooks/useSettings";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface QrDefaultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SIZE_PRESETS = {
  small: { size: 255, fontSize: 12, padding: 25, name: "Small (255x255)" },
  medium: { size: 512, fontSize: 24, padding: 50, name: "Medium (512x512)" },
  large: { size: 1000, fontSize: 48, padding: 100, name: "Large (1000x1000)" },
};

export function QrDefaultsDialog({ open, onOpenChange }: QrDefaultsDialogProps) {
  const { settings, isLoading, updateSetting, getSetting } = useSettings("qr_defaults");
  
  const [sizePreset, setSizePreset] = useState<"small" | "medium" | "large">("medium");
  const [topCaption, setTopCaption] = useState("");
  const [bottomCaption, setBottomCaption] = useState("{eoa_title}");
  const [borderWidth, setBorderWidth] = useState(20);
  const [borderColor, setBorderColor] = useState("#000000");
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [textColor, setTextColor] = useState("#000000");
  const [padding, setPadding] = useState(100);
  const [logoSizePercent, setLogoSizePercent] = useState(20);

  useEffect(() => {
    if (!isLoading && settings) {
      const sizePresetSetting = getSetting?.("qr_defaults", "size_preset");
      const topCaptionSetting = getSetting?.("qr_defaults", "top_caption");
      const bottomCaptionSetting = getSetting?.("qr_defaults", "bottom_caption");
      const borderWidthSetting = getSetting?.("qr_defaults", "border_width");
      const borderColorSetting = getSetting?.("qr_defaults", "border_color");
      const backgroundColorSetting = getSetting?.("qr_defaults", "background_color");
      const textColorSetting = getSetting?.("qr_defaults", "text_color");
      const paddingSetting = getSetting?.("qr_defaults", "padding");
      const logoSizeSetting = getSetting?.("qr_defaults", "logo_size_percent");

      if (sizePresetSetting?.value?.selected) setSizePreset(sizePresetSetting.value.selected);
      if (topCaptionSetting?.value?.text !== undefined) setTopCaption(topCaptionSetting.value.text);
      if (bottomCaptionSetting?.value?.text) setBottomCaption(bottomCaptionSetting.value.text);
      if (borderWidthSetting?.value?.value) setBorderWidth(borderWidthSetting.value.value);
      if (borderColorSetting?.value?.value) setBorderColor(borderColorSetting.value.value);
      if (backgroundColorSetting?.value?.value) setBackgroundColor(backgroundColorSetting.value.value);
      if (textColorSetting?.value?.value) setTextColor(textColorSetting.value.value);
      if (paddingSetting?.value?.value) setPadding(paddingSetting.value.value);
      if (logoSizeSetting?.value?.value) setLogoSizePercent(logoSizeSetting.value.value);
    }
  }, [settings, isLoading, getSetting]);

  const handleSave = () => {
    const updates = [
      { key: "size_preset", value: { selected: sizePreset } },
      { key: "top_caption", value: { text: topCaption } },
      { key: "bottom_caption", value: { text: bottomCaption } },
      { key: "border_width", value: { value: borderWidth } },
      { key: "border_color", value: { value: borderColor } },
      { key: "background_color", value: { value: backgroundColor } },
      { key: "text_color", value: { value: textColor } },
      { key: "padding", value: { value: padding } },
      { key: "logo_size_percent", value: { value: logoSizePercent } },
    ];

    updates.forEach((update) => {
      const setting = getSetting?.("qr_defaults", update.key);
      if (setting) {
        updateSetting?.({ id: setting.id, value: update.value });
      }
    });

    toast.success("QR code defaults saved successfully");
  };

  const currentPreset = SIZE_PRESETS[sizePreset];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>QR Code Defaults</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="size" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="size">Size & Layout</TabsTrigger>
            <TabsTrigger value="captions">Captions</TabsTrigger>
            <TabsTrigger value="styling">Styling</TabsTrigger>
          </TabsList>

          <TabsContent value="size" className="space-y-4">
            <div className="space-y-2">
              <Label>Size Preset</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(SIZE_PRESETS) as [keyof typeof SIZE_PRESETS, typeof SIZE_PRESETS.small][]).map(([key, preset]) => (
                  <Button
                    key={key}
                    variant={sizePreset === key ? "default" : "outline"}
                    onClick={() => {
                      setSizePreset(key);
                      setPadding(preset.padding);
                    }}
                    className="flex flex-col h-auto py-3"
                  >
                    <span className="font-semibold">{preset.name}</span>
                    <span className="text-xs opacity-70">Font: {preset.fontSize}px</span>
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Current: {currentPreset.size}×{currentPreset.size}px, Font: {currentPreset.fontSize}px
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="padding">Padding (px)</Label>
              <Input
                id="padding"
                type="number"
                value={padding}
                onChange={(e) => setPadding(Number(e.target.value))}
                min={0}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoSize">Logo Size (% of QR code)</Label>
              <Input
                id="logoSize"
                type="number"
                value={logoSizePercent}
                onChange={(e) => setLogoSizePercent(Number(e.target.value))}
                min={5}
                max={40}
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 15-25%. Higher values may affect QR code scannability.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="captions" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topCaption">Top Caption</Label>
              <Input
                id="topCaption"
                value={topCaption}
                onChange={(e) => setTopCaption(e.target.value)}
                placeholder="Leave empty for no top caption"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bottomCaption">Bottom Caption</Label>
              <Input
                id="bottomCaption"
                value={bottomCaption}
                onChange={(e) => setBottomCaption(e.target.value)}
                placeholder="Use {eoa_title} as placeholder"
              />
              <p className="text-xs text-muted-foreground">
                Use {"{eoa_title}"} to automatically insert the Event/Action title
              </p>
            </div>
          </TabsContent>

          <TabsContent value="styling" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="borderWidth">Border Width (px)</Label>
                <Input
                  id="borderWidth"
                  type="number"
                  value={borderWidth}
                  onChange={(e) => setBorderWidth(Number(e.target.value))}
                  min={0}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="borderColor">Border Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="borderColor"
                    type="color"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="w-20 h-10 p-1"
                  />
                  <Input
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    placeholder="#000000"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="backgroundColor">Background Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="backgroundColor"
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-20 h-10 p-1"
                  />
                  <Input
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="textColor">Text Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="textColor"
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-20 h-10 p-1"
                  />
                  <Input
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    placeholder="#000000"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Defaults
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
