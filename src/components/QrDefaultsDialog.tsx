import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettings } from "@/hooks/useSettings";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ExternalLink, ImageIcon } from "lucide-react";

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
  const navigate = useNavigate();
  
  const [sizePreset, setSizePreset] = useState<"small" | "medium" | "large">("medium");
  const [topCaption, setTopCaption] = useState("");
  const [bottomCaption, setBottomCaption] = useState("{eoa_title}");
  const [padding, setPadding] = useState(100);
  const [logoSizePercent, setLogoSizePercent] = useState(20);

  useEffect(() => {
    if (!isLoading && settings) {
      const sizePresetSetting = getSetting?.("qr_defaults", "size_preset");
      const topCaptionSetting = getSetting?.("qr_defaults", "top_caption");
      const bottomCaptionSetting = getSetting?.("qr_defaults", "bottom_caption");
      const paddingSetting = getSetting?.("qr_defaults", "padding");
      const logoSizeSetting = getSetting?.("qr_defaults", "logo_size_percent");

      if (sizePresetSetting?.value?.selected) setSizePreset(sizePresetSetting.value.selected);
      if (topCaptionSetting?.value?.text !== undefined) setTopCaption(topCaptionSetting.value.text);
      if (bottomCaptionSetting?.value?.text) setBottomCaption(bottomCaptionSetting.value.text);
      if (paddingSetting?.value?.value) setPadding(paddingSetting.value.value);
      if (logoSizeSetting?.value?.value) setLogoSizePercent(logoSizeSetting.value.value);
    }
  }, [settings, isLoading, getSetting]);

  const handleSave = () => {
    const updates = [
      { key: "size_preset", value: { selected: sizePreset } },
      { key: "top_caption", value: { text: topCaption } },
      { key: "bottom_caption", value: { text: bottomCaption } },
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

  const handleNavigateToSettings = () => {
    onOpenChange(false);
    navigate("/settings");
    // Small delay to ensure navigation completes before trying to switch tabs
    setTimeout(() => {
      const brandingTab = document.querySelector('[value="branding"]') as HTMLElement;
      brandingTab?.click();
    }, 100);
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
            <TabsTrigger value="branding">Branding</TabsTrigger>
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

          <TabsContent value="branding" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Logo Management
                </CardTitle>
                <CardDescription>
                  Upload and manage logos that appear on your QR codes. Logos are managed in the Settings page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted/30">
                  <p className="text-sm mb-4">
                    To upload logos and set a default logo for QR codes, go to the Branding section in Settings.
                  </p>
                  <Button onClick={handleNavigateToSettings} className="w-full">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Branding Settings
                  </Button>
                </div>
                
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Note on QR Code Styling:</p>
                  <p>
                    QR code colors and borders are kept at default values (black border, white background, black text) 
                    to ensure maximum scannability. Custom colors may reduce scan reliability.
                  </p>
                </div>
              </CardContent>
            </Card>
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
