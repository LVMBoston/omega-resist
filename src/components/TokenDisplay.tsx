import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Download, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useState } from "react";
import QRCode from 'qrcode';

interface TokenDisplayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  fullUrl: string;
  shortUrl?: string;
  eoaTitle: string;
}

export function TokenDisplay({ open, onOpenChange, token, fullUrl, shortUrl, eoaTitle }: TokenDisplayProps) {
  const [showQRDialog, setShowQRDialog] = useState(true);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const generateDecoratedQRCanvas = async (urlForQr: string): Promise<HTMLCanvasElement> => {
    const qrSize = 1000;
    const padding = 100;
    const borderWidth = 20;
    const fontSize = 48;
    const textHeight = 120;
    const totalSize = qrSize + (padding * 2) + textHeight;
    
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
    
    // Create final canvas with border and text
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = totalSize;
    finalCanvas.height = totalSize;
    const ctx = finalCanvas.getContext('2d')!;
    
    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, totalSize, totalSize);
    
    // Draw border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(borderWidth / 2, borderWidth / 2, totalSize - borderWidth, totalSize - borderWidth);
    
    // Draw QR code
    ctx.drawImage(qrCanvas, padding, padding, qrSize, qrSize);
    
    // Draw text at bottom (single line, no wrapping)
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textY = padding + qrSize + (textHeight / 2);
    ctx.fillText(eoaTitle, totalSize / 2, textY);
    
    return finalCanvas;
  };

  const copyQRToClipboard = async () => {
    try {
      const urlForQr = shortUrl || fullUrl;
      const canvas = await generateDecoratedQRCanvas(urlForQr);
      
      canvas.toBlob(async (blob) => {
        if (blob) {
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
        } else {
          toast.error("Failed to create QR code image");
        }
      }, 'image/png');
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
                  <div className="inline-block p-4 border-4 border-black bg-white">
                    <QRCodeSVG
                      id="qr-code-svg"
                      value={shortUrl || fullUrl}
                      size={300}
                      level="H"
                      includeMargin={true}
                    />
                    <div className="text-center mt-3 font-bold text-sm text-black">
                      {eoaTitle}
                    </div>
                  </div>
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
