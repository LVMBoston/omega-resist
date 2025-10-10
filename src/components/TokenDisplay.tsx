import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  eoaTitle: string;
}

export function TokenDisplay({ open, onOpenChange, token, fullUrl, eoaTitle }: TokenDisplayProps) {
  const [showQRDialog, setShowQRDialog] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const downloadQR = async () => {
    try {
      const svg = document.getElementById('qr-code-svg');
      if (!svg) {
        toast.error("QR code not found");
        return;
      }
      
      // Get SVG data
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      // Create image from SVG
      const img = new Image();
      
      img.onload = () => {
        // Create high-res canvas: 1200x1200 for 2" at 600 DPI
        const canvas = document.createElement('canvas');
        const size = 1200;
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          toast.error("Failed to create canvas");
          return;
        }
        
        // Fill white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        
        // Draw QR code scaled to full canvas size
        ctx.imageSmoothingEnabled = false; // Keep sharp edges for QR code
        ctx.drawImage(img, 0, 0, size, size);
        
        // Convert to PNG and download
        canvas.toBlob((blob) => {
          if (blob) {
            const downloadUrl = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.download = `qr-${token}.png`;
            downloadLink.href = downloadUrl;
            downloadLink.click();
            
            // Cleanup
            URL.revokeObjectURL(downloadUrl);
            URL.revokeObjectURL(url);
            
            toast.success("QR code downloaded (1200×1200px for 2\"×2\" printing)");
          }
        }, 'image/png');
      };
      
      img.onerror = () => {
        toast.error("Failed to load QR code image");
        URL.revokeObjectURL(url);
      };
      
      img.src = url;
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error("Failed to download QR code");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Full URL:</p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(fullUrl, "URL")}
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
            <p className="text-xs bg-muted p-3 rounded break-all">{fullUrl}</p>
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
                <div className="flex justify-center p-8 bg-white rounded">
                  <QRCodeSVG
                    id="qr-code-svg"
                    value={fullUrl}
                    size={384}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadQR}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
