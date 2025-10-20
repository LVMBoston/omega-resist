import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  
  // New customization options
  const [errorCorrectionLevel, setErrorCorrectionLevel] = useState<'L' | 'M' | 'Q' | 'H'>('H');
  const [qrColor, setQrColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [borderThickness, setBorderThickness] = useState(0);
  const [cornerRadius, setCornerRadius] = useState(0);
  const [moduleShape, setModuleShape] = useState<'square' | 'rounded' | 'dots'>('square');
  const [splitForPrinting, setSplitForPrinting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateQR = async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;

      await QRCode.toCanvas(canvas, url, {
        width: size,
        margin: 2,
        errorCorrectionLevel: errorCorrectionLevel,
        color: {
          dark: qrColor,
          light: bgColor
        }
      });

      const ctx = canvas.getContext('2d');
      if (ctx && moduleShape !== 'square') {
        // Apply module shape effects
        applyModuleShape(canvas, ctx);
      }

      // If logo exists, add it to center
      if (logo) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const logoImg = new Image();
          logoImg.onload = () => {
            const maxLogoSize = size * 0.2; // 20% of QR size
            
            // Use natural dimensions for accurate aspect ratio
            const originalWidth = logoImg.naturalWidth || logoImg.width;
            const originalHeight = logoImg.naturalHeight || logoImg.height;
            const aspectRatio = originalWidth / originalHeight;
            
            // Calculate scaled dimensions while maintaining aspect ratio
            let logoWidth, logoHeight;
            
            if (aspectRatio > 1) {
              // Wider than tall
              logoWidth = maxLogoSize;
              logoHeight = maxLogoSize / aspectRatio;
            } else {
              // Taller than wide or square
              logoHeight = maxLogoSize;
              logoWidth = maxLogoSize * aspectRatio;
            }
            
            const x = (size - logoWidth) / 2;
            const y = (size - logoHeight) / 2;
            
            // Draw background (slightly larger than logo) in bg color
            const padding = 10;
            const bgWidth = logoWidth + padding * 2;
            const bgHeight = logoHeight + padding * 2;
            ctx.fillStyle = bgColor;
            ctx.fillRect(
              (size - bgWidth) / 2,
              (size - bgHeight) / 2,
              bgWidth,
              bgHeight
            );
            
            // Draw logo maintaining aspect ratio
            ctx.drawImage(logoImg, x, y, logoWidth, logoHeight);
            
            // Apply border and corner radius after everything
            applyBorderAndRadius(canvas, ctx);
          };
          logoImg.src = logo;
        }
      } else {
        // Apply border and corner radius
        const ctx = canvas.getContext('2d');
        if (ctx) {
          applyBorderAndRadius(canvas, ctx);
        }
      }

      toast.success("QR code generated");
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error("Failed to generate QR code");
    }
  };

  const applyModuleShape = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Create a new canvas for the shaped version
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    tempCtx.fillStyle = bgColor;
    tempCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Detect module size (approximate)
    const moduleSize = Math.max(2, Math.floor(canvas.width / 50));
    
    tempCtx.fillStyle = qrColor;
    
    // Scan and draw modules
    for (let y = 0; y < canvas.height; y += moduleSize) {
      for (let x = 0; x < canvas.width; x += moduleSize) {
        const i = (y * canvas.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Check if this pixel is dark (part of QR code)
        const isDark = (r + g + b) / 3 < 128;
        
        if (isDark) {
          if (moduleShape === 'rounded') {
            tempCtx.beginPath();
            const radius = moduleSize * 0.4;
            tempCtx.roundRect(x, y, moduleSize, moduleSize, radius);
            tempCtx.fill();
          } else if (moduleShape === 'dots') {
            tempCtx.beginPath();
            tempCtx.arc(x + moduleSize / 2, y + moduleSize / 2, moduleSize / 2, 0, Math.PI * 2);
            tempCtx.fill();
          }
        }
      }
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
  };

  const applyBorderAndRadius = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    if (borderThickness > 0 || cornerRadius > 0) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      
      // Copy current canvas to temp
      tempCtx.drawImage(canvas, 0, 0);
      
      // Clear main canvas and apply corner radius
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (cornerRadius > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(0, 0, canvas.width, canvas.height, cornerRadius);
        ctx.clip();
      }
      
      ctx.drawImage(tempCanvas, 0, 0);
      
      if (cornerRadius > 0) {
        ctx.restore();
      }
      
      // Draw border
      if (borderThickness > 0) {
        ctx.strokeStyle = qrColor;
        ctx.lineWidth = borderThickness;
        if (cornerRadius > 0) {
          ctx.beginPath();
          ctx.roundRect(borderThickness / 2, borderThickness / 2, 
                       canvas.width - borderThickness, canvas.height - borderThickness, cornerRadius);
          ctx.stroke();
        } else {
          ctx.strokeRect(borderThickness / 2, borderThickness / 2, 
                        canvas.width - borderThickness, canvas.height - borderThickness);
        }
      }
      
      setQrDataUrl(canvas.toDataURL('image/png'));
    } else {
      setQrDataUrl(canvas.toDataURL('image/png'));
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
    const fontSize = Math.max(24, Math.floor(size * 0.06)); // Scale font with QR size, min 24px
    const labelHeight = fontSize * 1.5; // Height scales with font size
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
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(labelAbove, finalCanvas.width / 2, labelHeight / 2 + fontSize / 3);
    }

    // Draw QR code
    const qrImg = new Image();
    qrImg.onload = () => {
      ctx.drawImage(qrImg, padding, topPadding, size, size);

      // Draw label below
      if (hasLabelBelow) {
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${fontSize}px Arial`;
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

  const downloadQuadrants = async () => {
    if (!qrDataUrl) {
      toast.error("Generate QR code first");
      return;
    }

    try {
      // Generate a QR code without quiet zone (margin: 0)
      const fullSize = 4800; // 8" @ 600 DPI
      const canvas = document.createElement('canvas');
      canvas.width = fullSize;
      canvas.height = fullSize;

      await QRCode.toCanvas(canvas, url, {
        width: fullSize,
        margin: 0, // No quiet zone
        errorCorrectionLevel: errorCorrectionLevel,
        color: {
          dark: qrColor,
          light: bgColor
        }
      });

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        toast.error("Failed to create canvas");
        return;
      }

      if (moduleShape !== 'square') {
        applyModuleShape(canvas, ctx);
      }

      // If logo exists, add it to center
      if (logo) {
        const logoImg = new Image();
        await new Promise((resolve) => {
          logoImg.onload = () => {
            const maxLogoSize = fullSize * 0.2;
            const originalWidth = logoImg.naturalWidth || logoImg.width;
            const originalHeight = logoImg.naturalHeight || logoImg.height;
            const aspectRatio = originalWidth / originalHeight;
            
            let logoWidth, logoHeight;
            if (aspectRatio > 1) {
              logoWidth = maxLogoSize;
              logoHeight = maxLogoSize / aspectRatio;
            } else {
              logoHeight = maxLogoSize;
              logoWidth = maxLogoSize * aspectRatio;
            }
            
            const x = (fullSize - logoWidth) / 2;
            const y = (fullSize - logoHeight) / 2;
            
            const padding = 40;
            const bgWidth = logoWidth + padding * 2;
            const bgHeight = logoHeight + padding * 2;
            ctx.fillStyle = bgColor;
            ctx.fillRect(
              (fullSize - bgWidth) / 2,
              (fullSize - bgHeight) / 2,
              bgWidth,
              bgHeight
            );
            
            ctx.drawImage(logoImg, x, y, logoWidth, logoHeight);
            resolve(null);
          };
          logoImg.src = logo;
        });
      }

      // Split into 4 quadrants and download each
      const quadrantSize = fullSize / 2;
      const quadrants = [
        { name: 'top-left', x: 0, y: 0 },
        { name: 'top-right', x: quadrantSize, y: 0 },
        { name: 'bottom-left', x: 0, y: quadrantSize },
        { name: 'bottom-right', x: quadrantSize, y: quadrantSize }
      ];

      for (const quadrant of quadrants) {
        const quadrantCanvas = document.createElement('canvas');
        quadrantCanvas.width = quadrantSize;
        quadrantCanvas.height = quadrantSize;
        const quadrantCtx = quadrantCanvas.getContext('2d');
        
        if (quadrantCtx) {
          quadrantCtx.drawImage(
            canvas,
            quadrant.x, quadrant.y, quadrantSize, quadrantSize,
            0, 0, quadrantSize, quadrantSize
          );

          // Download this quadrant
          await new Promise<void>((resolve) => {
            quadrantCanvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `qr-quadrant-${quadrant.name}.png`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
              }
              // Small delay between downloads
              setTimeout(resolve, 100);
            }, 'image/png');
          });
        }
      }

      toast.success("4 quadrants downloaded! Arrange as: top-left, top-right, bottom-left, bottom-right");
    } catch (error) {
      console.error('Error generating quadrants:', error);
      toast.error("Failed to generate quadrants");
    }
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
              <Label htmlFor="errorCorrection">Error Correction Level</Label>
              <Select value={errorCorrectionLevel} onValueChange={(value: 'L' | 'M' | 'Q' | 'H') => setErrorCorrectionLevel(value)}>
                <SelectTrigger id="errorCorrection">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Low (7% recovery)</SelectItem>
                  <SelectItem value="M">Medium (15% recovery)</SelectItem>
                  <SelectItem value="Q">Quartile (25% recovery)</SelectItem>
                  <SelectItem value="H">High (30% recovery) - Best for logos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qrColor">QR Code Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="qrColor"
                    type="color"
                    value={qrColor}
                    onChange={(e) => setQrColor(e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={qrColor}
                    onChange={(e) => setQrColor(e.target.value)}
                    className="flex-1"
                    placeholder="#000000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bgColor">Background Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="bgColor"
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="flex-1"
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="moduleShape">Module Shape</Label>
              <Select value={moduleShape} onValueChange={(value: 'square' | 'rounded' | 'dots') => setModuleShape(value)}>
                <SelectTrigger id="moduleShape">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Square (Standard)</SelectItem>
                  <SelectItem value="rounded">Rounded (Smooth edges)</SelectItem>
                  <SelectItem value="dots">Dots (Circular modules)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="borderThickness">Border Thickness: {borderThickness}px</Label>
              <Slider
                id="borderThickness"
                min={0}
                max={20}
                step={1}
                value={[borderThickness]}
                onValueChange={(values) => setBorderThickness(values[0])}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cornerRadius">Corner Radius: {cornerRadius}px</Label>
              <Slider
                id="cornerRadius"
                min={0}
                max={50}
                step={5}
                value={[cornerRadius]}
                onValueChange={(values) => setCornerRadius(values[0])}
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

            <div className="pt-2">
              <Button
                onClick={downloadQuadrants}
                variant="secondary"
                disabled={!qrDataUrl}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Download 4 Quadrants (for 12" poster assembly)
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Downloads 4 separate images without quiet zone - arrange them in a 2×2 grid for your 12"×12" poster
              </p>
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
            <li>🖨️ <strong className="text-primary">Large Poster Printing:</strong> Use the "Download 4 Quadrants" button to create a 12"×12" poster by printing and assembling four 6"×6" sections (each fits on 8.5" paper)</li>
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
