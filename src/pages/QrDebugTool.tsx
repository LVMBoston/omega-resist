import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Download, Upload, Link2 } from "lucide-react";
import { toast } from "sonner";
import QRCode from 'qrcode';
import { supabase } from "@/integrations/supabase/client";

export default function QrDebugTool() {
  const [url, setUrl] = useState("https://example.com");
  const [size, setSize] = useState(512);
  const [labelAbove, setLabelAbove] = useState("");
  const [labelBelow, setLabelBelow] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [shortenedUrl, setShortenedUrl] = useState("");
  const [isShortening, setIsShortening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateQR = async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;

      await QRCode.toCanvas(canvas, url, {
        width: size,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // If logo exists, add it to center
      if (logo) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const logoImg = new Image();
          logoImg.onload = () => {
            const logoSize = size * 0.2; // 20% of QR size
            const x = (size - logoSize) / 2;
            const y = (size - logoSize) / 2;
            
            // Draw white background circle for logo
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, logoSize / 2 + 5, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.drawImage(logoImg, x, y, logoSize, logoSize);
            setQrDataUrl(canvas.toDataURL('image/png'));
          };
          logoImg.src = logo;
        }
      } else {
        setQrDataUrl(canvas.toDataURL('image/png'));
      }

      toast.success("QR code generated");
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error("Failed to generate QR code");
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogo(event.target?.result as string);
        toast.success("Logo uploaded");
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadQR = () => {
    if (!qrDataUrl) {
      toast.error("Generate QR code first");
      return;
    }

    // Create final canvas with labels
    const finalCanvas = document.createElement('canvas');
    const padding = 20;
    const labelHeight = 40;
    const hasLabelAbove = labelAbove.trim() !== "";
    const hasLabelBelow = labelBelow.trim() !== "";
    
    const topPadding = hasLabelAbove ? labelHeight + padding : padding;
    const bottomPadding = hasLabelBelow ? labelHeight + padding : padding;
    
    finalCanvas.width = size + (padding * 2);
    finalCanvas.height = size + topPadding + bottomPadding;
    
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) {
      toast.error("Failed to create canvas");
      return;
    }

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    // Draw label above
    if (hasLabelAbove) {
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(labelAbove, finalCanvas.width / 2, labelHeight / 2 + 10);
    }

    // Draw QR code
    const qrImg = new Image();
    qrImg.onload = () => {
      ctx.drawImage(qrImg, padding, topPadding, size, size);

      // Draw label below
      if (hasLabelBelow) {
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(labelBelow, finalCanvas.width / 2, finalCanvas.height - bottomPadding + labelHeight / 2);
      }

      // Download
      finalCanvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `qr-${size}x${size}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
          toast.success("QR code downloaded");
        }
      }, 'image/png');
    };
    qrImg.src = qrDataUrl;
  };

  const handleShortenUrl = async () => {
    if (!url) {
      toast.error("Please enter a URL first");
      return;
    }

    setIsShortening(true);
    try {
      const { data, error } = await supabase.rpc("shorten_url", {
        _full_url: url,
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const shortUrl = data[0].short_url;
        setShortenedUrl(shortUrl);
        toast.success("URL shortened and copied to clipboard!");
        navigator.clipboard.writeText(shortUrl);
      }
    } catch (error) {
      console.error("Error shortening URL:", error);
      toast.error("Failed to shorten URL");
    } finally {
      setIsShortening(false);
    }
  };

  const handleUseShortUrl = () => {
    if (shortenedUrl) {
      setUrl(shortenedUrl);
      setShortenedUrl("");
      toast.success("Now using short URL");
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">QR Code Debug Tool</h1>
          <p className="text-muted-foreground">Test QR code generation with size, logo, and label controls</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Controls */}
          <Card className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="url">URL to Encode</Label>
              <Textarea
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleShortenUrl}
                  disabled={isShortening}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  {isShortening ? "Shortening..." : "Shorten URL (Better Scannability)"}
                </Button>
              </div>
              {shortenedUrl && (
                <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-md">
                  <code className="text-sm flex-1 truncate font-mono">{shortenedUrl}</code>
                  <Button
                    onClick={handleUseShortUrl}
                    size="sm"
                    variant="default"
                  >
                    Use This
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="size">QR Code Size: {size}px</Label>
              <Slider
                id="size"
                min={256}
                max={4800}
                step={128}
                value={[size]}
                onValueChange={(values) => setSize(values[0])}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSize(256)}
                >
                  Tiny (0.6")
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSize(512)}
                >
                  Standard (1.5")
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSize(640)}
                >
                  Large (2")
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSize(1200)}
                >
                  Print (2" @ 600 DPI)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSize(4800)}
                >
                  Large Print (8" @ 600 DPI)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Presets optimized for common pamphlet sizes
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="labelAbove">Label Above QR Code</Label>
              <Input
                id="labelAbove"
                value={labelAbove}
                onChange={(e) => setLabelAbove(e.target.value)}
                placeholder="Optional label above"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="labelBelow">Label Below QR Code</Label>
              <Input
                id="labelBelow"
                value={labelBelow}
                onChange={(e) => setLabelBelow(e.target.value)}
                placeholder="Optional label below"
              />
            </div>

            <div className="space-y-2">
              <Label>Logo (centered on QR code)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Logo
                </Button>
                {logo && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setLogo(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                      toast.success("Logo removed");
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
              {logo && (
                <div className="mt-2">
                  <img src={logo} alt="Logo preview" className="h-16 w-16 object-contain border rounded" />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={generateQR} className="flex-1">
                Generate QR Code
              </Button>
              <Button
                onClick={downloadQR}
                variant="outline"
                disabled={!qrDataUrl}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Download PNG
              </Button>
            </div>
          </Card>

          {/* Preview */}
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Preview</h2>
              <div className="flex items-center justify-center bg-muted rounded-lg p-8 min-h-[400px]">
                {qrDataUrl ? (
                  <div className="text-center space-y-4">
                    {labelAbove && (
                      <p className="font-bold text-lg">{labelAbove}</p>
                    )}
                    <img
                      src={qrDataUrl}
                      alt="QR Code"
                      className="max-w-full h-auto border-4 border-background rounded"
                      style={{ maxWidth: size > 512 ? '512px' : `${size}px` }}
                    />
                    {labelBelow && (
                      <p className="font-bold text-lg">{labelBelow}</p>
                    )}
                    <div className="text-sm text-muted-foreground">
                      {size}×{size}px
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Click "Generate QR Code" to see preview</p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Scanability Tips */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">QR Code Scanability Tips</h2>
          <ul className="space-y-2 text-sm">
            <li>🚀 <strong className="text-primary">URL Shortening (Critical!):</strong> Shortened URLs create simpler QR codes with fewer modules, enabling reliable scanning at 0.6"×0.6" (256px) - perfect for compact pamphlets!</li>
            <li>✅ <strong>Tiny size (0.6"):</strong> 256px works great with shortened URLs (tested with Bitly)</li>
            <li>✅ <strong>Standard size (1.5"):</strong> 512px for reliable scanning at arm's length</li>
            <li>✅ <strong>Large size (2"):</strong> 640px for high visibility on pamphlets</li>
            <li>✅ <strong>Print quality:</strong> 1200px recommended for 2"×2" prints at 600 DPI</li>
            <li>✅ <strong>Error correction:</strong> Using level 'H' (30% recovery) allows for logo placement</li>
            <li>✅ <strong>Logo size:</strong> Keep logos under 20% of QR code size to maintain scanability</li>
            <li>✅ <strong>Contrast:</strong> High contrast (black on white) scans best</li>
            <li>✅ <strong>Testing:</strong> Always test with multiple devices and lighting conditions</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
