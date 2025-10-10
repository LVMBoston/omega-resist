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
      // Create a canvas with proper 2"x2" at 600 DPI dimensions
      const canvas = document.createElement('canvas');
      const size = 1200; // 2 inches × 600 DPI
      canvas.width = size;
      canvas.height = size;
      
      // Generate QR code directly to canvas
      await QRCode.toCanvas(canvas, fullUrl, {
        width: size,
        margin: 4,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      // Convert canvas to data URL and download
      const url = canvas.toDataURL('image/png');
      const downloadLink = document.createElement("a");
      downloadLink.download = `qr-${token}.png`;
      downloadLink.href = url;
      downloadLink.click();
      
      toast.success("QR code downloaded (2\"×2\" at 600 DPI)");
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
