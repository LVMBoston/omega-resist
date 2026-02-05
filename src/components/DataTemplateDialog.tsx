import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DataTemplateEditor } from "@/components/DataTemplateEditor";
import { Hotspot } from "@/types/viralTemplates";
import { BarChart3 } from "lucide-react";
import { useRef, useEffect } from "react";

interface DataTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    hotspots: Hotspot[];
    imageUrl: string;
    name: string;
    slug: string;
    description?: string;
  }) => Promise<string | void>;
  mode: "create" | "edit";
  initialData?: {
    id?: string;
    hotspots?: Hotspot[];
    imageUrl?: string;
    name?: string;
    slug?: string;
    description?: string;
  };
}

export function DataTemplateDialog({
  open,
  onOpenChange,
  onSave,
  mode,
  initialData,
}: DataTemplateDialogProps) {
  // Use a stable session key that only changes when the dialog OPENS (not when ID is assigned)
  // This prevents remounting when the ID is assigned on first save
  const sessionKeyRef = useRef<string>("");
  const wasOpenRef = useRef(false);
  
  useEffect(() => {
    // Only generate a new key when transitioning from closed to open
    if (open && !wasOpenRef.current) {
      sessionKeyRef.current = initialData?.id || `new-${Date.now()}`;
    }
    wasOpenRef.current = open;
  }, [open]); // Remove initialData?.id from deps - we only care about open transitions

  const handleSave = async (data: {
    hotspots: Hotspot[];
    imageUrl: string;
    name: string;
    slug: string;
    description?: string;
  }): Promise<string | void> => {
    const result = await onSave(data);
    // Don't close the dialog - let the user continue editing
    return result;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[90vw] sm:max-w-[90vw] p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b border-border bg-green-50 dark:bg-green-950/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-600 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <SheetTitle className="text-green-900 dark:text-green-100">
                {mode === "edit" ? "Edit Data Template" : "Create Data Template"}
              </SheetTitle>
              <SheetDescription className="text-green-700 dark:text-green-300">
                Configure live metrics hotspots for real-time campaign data display
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>
        
        <div className="flex-1 min-h-0 overflow-y-auto">
          {open && (
            <DataTemplateEditor
              key={sessionKeyRef.current}
              initialHotspots={initialData?.hotspots}
              initialImageUrl={initialData?.imageUrl}
              templateName={initialData?.name}
              templateSlug={initialData?.slug}
              templateDescription={initialData?.description}
              templateId={initialData?.id}
              onSave={handleSave}
              onCancel={() => onOpenChange(false)}
              mode={mode}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
