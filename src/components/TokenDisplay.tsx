import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";
import QRCode from 'qrcode';
import { useSettings } from "@/hooks/useSettings";

interface TokenDisplayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  fullUrl: string;
  shortUrl?: string;
  eoaTitle: string;
  campaignName?: string;
}

export function TokenDisplay({ open, onOpenChange, token, fullUrl, shortUrl, eoaTitle }: TokenDisplayProps) {
  const [showQRDialog, setShowQRDialog] = useState(true);
  const { getSetting, isLoading } = useSettings();
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Generate display QR code when dialog opens
  useEffect(() => {
    const generateQR = async () => {
      if (!showQRDialog || !displayCanvasRef.current || (!shortUrl && !fullUrl)) {
        return;
      }

      try {
        const urlForQr = shortUrl || fullUrl;
        console.log('🎨 Starting QR generation for:', urlForQr);
        
        const canvas = await generateDecoratedQRCanvas(urlForQr);
        
        if (displayCanvasRef.current && canvas) {
          const ctx = displayCanvasRef.current.getContext('2d');
          if (ctx) {
            displayCanvasRef.current.width = canvas.width;
            displayCanvasRef.current.height = canvas.height;
            ctx.drawImage(canvas, 0, 0);
            console.log('✅ QR code rendered successfully');
          }
        }
      } catch (error) {
        console.error('❌ Error generating QR code:', error);
        toast.error("Failed to generate QR code");
      }
    };

    // Add a small delay to ensure settings are loaded
    const timer = setTimeout(generateQR, 100);
    return () => clearTimeout(timer);
  }, [showQRDialog, shortUrl, fullUrl, eoaTitle]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const generateDecoratedQRCanvas = async (urlForQr: string): Promise<HTMLCanvasElement> => {
    // Get QR defaults from settings
    const sizePresetSetting = getSetting?.("qr_defaults", "size_preset");
    const topCaptionSetting = getSetting?.("qr_defaults", "top_caption");
    const bottomCaptionSetting = getSetting?.("qr_defaults", "bottom_caption");
    const borderWidthSetting = getSetting?.("qr_defaults", "border_width");
    const borderColorSetting = getSetting?.("qr_defaults", "border_color");
    const backgroundColorSetting = getSetting?.("qr_defaults", "background_color");
    const textColorSetting = getSetting?.("qr_defaults", "text_color");
    const paddingSetting = getSetting?.("qr_defaults", "padding");
    const logoSizeSetting = getSetting?.("qr_defaults", "logo_size_percent");

    // Size presets
    const SIZE_PRESETS = {
      small: { size: 255, fontSize: 12, padding: 25 },
      medium: { size: 512, fontSize: 24, padding: 50 },
      large: { size: 1000, fontSize: 48, padding: 100 },
    };

    const sizePreset = sizePresetSetting?.value?.selected || "medium";
    const preset = SIZE_PRESETS[sizePreset as keyof typeof SIZE_PRESETS];
    
    const qrSize = preset.size;
    const fontSize = preset.fontSize;
    const padding = paddingSetting?.value?.value ?? preset.padding;
    const borderWidth = borderWidthSetting?.value?.value ?? 20;
    const borderColor = borderColorSetting?.value?.value ?? "#000000";
    const backgroundColor = backgroundColorSetting?.value?.value ?? "#FFFFFF";
    const textColor = textColorSetting?.value?.value ?? "#000000";
    const logoSizePercent = logoSizeSetting?.value?.value ?? 20;
    
    const topCaptionText = topCaptionSetting?.value?.text || "";
    let bottomCaptionText = bottomCaptionSetting?.value?.text || "{eoa_title}";
    bottomCaptionText = bottomCaptionText.replace("{eoa_title}", eoaTitle);
    
    const lineHeight = fontSize * 1.25;
    const maxTextWidth = qrSize * 0.8;
    
    // Create QR code canvas
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, urlForQr, {
      width: qrSize,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    // Get default logo
    const defaultLogoSetting = getSetting?.("branding", "default_logo");
    const selectedLogoNum = defaultLogoSetting?.value?.selected;
    
    let logoUrl = null;
    
    if (selectedLogoNum) {
      const logoKey = `logo_${selectedLogoNum}`;
      const logoSetting = getSetting?.("branding", logoKey);
      logoUrl = logoSetting?.value?.url;
    }
    
    // Create temporary canvas to measure text
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.font = `bold ${fontSize}px Arial, sans-serif`;
    
    // Word wrap function
    const wrapText = (text: string, maxWidth: number): string[] => {
      if (!text) return [];
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = words[0];

      for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i];
        const metrics = tempCtx.measureText(testLine);
        if (metrics.width > maxWidth) {
          lines.push(currentLine);
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine);
      return lines;
    };
    
    const topCaptionLines = wrapText(topCaptionText, maxTextWidth);
    const bottomCaptionLines = wrapText(bottomCaptionText, maxTextWidth);
    
    const topCaptionHeight = topCaptionLines.length > 0 ? topCaptionLines.length * lineHeight + 20 : 0;
    const bottomCaptionHeight = bottomCaptionLines.length > 0 ? bottomCaptionLines.length * lineHeight + 20 : 0;
    const totalSize = qrSize + (padding * 2) + topCaptionHeight + bottomCaptionHeight;
    
    // Create final canvas with border and text
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = totalSize;
    finalCanvas.height = totalSize;
    const ctx = finalCanvas.getContext('2d')!;
    
    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, totalSize, totalSize);
    
    // Draw border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(borderWidth / 2, borderWidth / 2, totalSize - borderWidth, totalSize - borderWidth);
    
    // Draw top caption
    if (topCaptionLines.length > 0) {
      ctx.fillStyle = textColor;
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const topTextStartY = padding;
      topCaptionLines.forEach((line, index) => {
        const y = topTextStartY + (index * lineHeight) + (lineHeight / 2);
        ctx.fillText(line, totalSize / 2, y);
      });
    }
    
    // Draw QR code
    const qrY = padding + topCaptionHeight;
    ctx.drawImage(qrCanvas, padding, qrY, qrSize, qrSize);
    
    // Draw logo in center if available
    if (logoUrl) {
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve;
          logoImg.onerror = reject;
          logoImg.src = logoUrl;
        });
        
        // Logo size as percentage of QR code size with white background
        const logoSize = qrSize * (logoSizePercent / 100);
        const logoX = padding + (qrSize - logoSize) / 2;
        const logoY = qrY + (qrSize - logoSize) / 2;
        const logoPadding = 10;
        
        // Draw white background for logo
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(logoX - logoPadding, logoY - logoPadding, logoSize + logoPadding * 2, logoSize + logoPadding * 2);
        
        // Draw logo
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
      } catch (error) {
        console.warn('Failed to load logo for QR code:', error);
      }
    }
    
    // Draw bottom caption
    if (bottomCaptionLines.length > 0) {
      ctx.fillStyle = textColor;
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const bottomTextStartY = qrY + qrSize + 20;
      bottomCaptionLines.forEach((line, index) => {
        const y = bottomTextStartY + (index * lineHeight) + (lineHeight / 2);
        ctx.fillText(line, totalSize / 2, y);
      });
    }
    
    return finalCanvas;
  };

  const copyQRToClipboard = async () => {
    try {
      const urlForQr = shortUrl || fullUrl;
      const canvas = await generateDecoratedQRCanvas(urlForQr);
      
      // Convert canvas to blob using Promise to stay in user gesture context
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });
      
      if (!blob) {
        toast.error("Failed to create QR code image");
        return;
      }
      
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob
          })
        ]);
        toast.success("QR code copied to clipboard!");
      } catch (clipboardError) {
        console.error('Clipboard error:', clipboardError);
        toast.error("Failed to copy to clipboard. Try downloading instead.");
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error("Failed to copy QR code");
    }
  };

  const downloadQR = async () => {
    try {
      const urlForQr = shortUrl || fullUrl;
      const canvas = await generateDecoratedQRCanvas(urlForQr);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const downloadLink = document.createElement('a');
          downloadLink.download = `qr-${token}.png`;
          downloadLink.href = url;
          downloadLink.click();
          URL.revokeObjectURL(url);
          
          toast.success("QR code downloaded with border and label");
        } else {
          toast.error("Failed to create QR code image");
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error("Failed to download QR code");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>L00 Token Generated</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Event/Action:</p>
            <p className="font-medium">{eoaTitle}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Token:</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(token, "Token")}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
            <p className="text-sm bg-muted p-3 rounded font-mono">{token}</p>
          </div>

          {/* Short URL Section (Emphasized) */}
          {shortUrl && (
            <div className="space-y-2 p-4 border-2 border-primary rounded-lg bg-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="default">Recommended</Badge>
                  <p className="text-sm font-semibold">Short URL:</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => copyToClipboard(shortUrl, "Short URL")}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(shortUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </Button>
                </div>
              </div>
              <p className="text-sm bg-white dark:bg-muted p-3 rounded font-mono border">
                {shortUrl}
              </p>
              <p className="text-xs text-muted-foreground">
                ✓ Cleaner QR codes • Easier to share • Same tracking
              </p>
            </div>
          )}

          {/* Full URL Section (De-emphasized when short URL exists) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                Full URL {shortUrl && "(for reference)"}:
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(fullUrl, "Full URL")}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(fullUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open
                </Button>
              </div>
            </div>
            <p className="text-xs bg-muted p-3 rounded font-mono break-all">{fullUrl}</p>
          </div>

          <div className="space-y-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowQRDialog(!showQRDialog)}
              className="w-full"
            >
              {showQRDialog ? (
                <>
                  <ChevronUp className="h-5 w-5 mr-2" />
                  Hide QR Code
                </>
              ) : (
                <>
                  <ChevronDown className="h-5 w-5 mr-2" />
                  Show Scannable QR Code
                </>
              )}
            </Button>
            
            {showQRDialog && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                {shortUrl && (
                  <p className="text-xs text-center text-muted-foreground">
                    ✓ QR code uses shortened URL for optimal scanning
                  </p>
                )}
                <div className="flex justify-center p-8 bg-white dark:bg-muted rounded">
                  <canvas 
                    ref={displayCanvasRef}
                    className="max-w-full h-auto"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={copyQRToClipboard}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Image
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadQR}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
