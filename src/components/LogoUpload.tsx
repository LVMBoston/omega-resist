import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoUploadProps {
  logoNumber: 1 | 2 | 3;
  currentUrl: string | null;
  isDefault: boolean;
  onUpload: (url: string) => void;
  onDelete: () => void;
  onSelectDefault: () => void;
}

export function LogoUpload({
  logoNumber,
  currentUrl,
  isDefault,
  onUpload,
  onDelete,
  onSelectDefault,
}: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG, etc.)",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `logo-${logoNumber}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from("branding")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("branding").getPublicUrl(filePath);

      onUpload(publicUrl);

      toast({
        title: "Success",
        description: "Logo uploaded successfully",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUrl) return;

    try {
      // Extract file path from URL
      const urlParts = currentUrl.split("/branding/");
      if (urlParts.length < 2) throw new Error("Invalid URL format");
      
      const filePath = urlParts[1];

      const { error } = await supabase.storage
        .from("branding")
        .remove([filePath]);

      if (error) throw error;

      onDelete();

      toast({
        title: "Success",
        description: "Logo deleted successfully",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message,
      });
    }
  };

  return (
    <Card className={cn("relative", isDefault && "ring-2 ring-primary")}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <Label className="text-lg font-semibold">Logo {logoNumber}</Label>
          {isDefault && (
            <div className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
              <Check className="w-3 h-3" />
              Default
            </div>
          )}
        </div>

        {currentUrl ? (
          <div className="space-y-4">
            <div className="relative bg-muted rounded-lg p-4 flex items-center justify-center min-h-[200px]">
              <img
                src={currentUrl}
                alt={`Logo ${logoNumber}`}
                className="max-h-[180px] max-w-full object-contain"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDelete}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Remove
              </Button>
              {!isDefault && currentUrl && (
                <Button
                  variant="default"
                  onClick={onSelectDefault}
                  className="flex-1"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Set as Default
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center bg-muted/50">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                Upload a logo image (PNG, JPG, max 5MB)
              </p>
              <Input
                id={`logo-${logoNumber}`}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              <Label
                htmlFor={`logo-${logoNumber}`}
                className="cursor-pointer"
              >
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => document.getElementById(`logo-${logoNumber}`)?.click()}
                >
                  {uploading ? "Uploading..." : "Choose File"}
                </Button>
              </Label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
