import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DataTemplateEditor } from "@/components/DataTemplateEditor";
import { Hotspot } from "@/types/viralTemplates";
import { BarChart3 } from "lucide-react";

interface DataTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    hotspots: Hotspot[];
    imageUrl: string;
    name: string;
    slug: string;
    description?: string;
  }) => Promise<void>;
  mode: "create" | "edit";
  initialData?: {
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
  const handleSave = async (data: {
    hotspots: Hotspot[];
    imageUrl: string;
    name: string;
    slug: string;
    description?: string;
  }) => {
    await onSave(data);
    onOpenChange(false);
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
        
        <div className="flex-1 min-h-0 overflow-hidden">
          <DataTemplateEditor
            initialHotspots={initialData?.hotspots}
            initialImageUrl={initialData?.imageUrl}
            templateName={initialData?.name}
            templateSlug={initialData?.slug}
            templateDescription={initialData?.description}
            onSave={handleSave}
            onCancel={() => onOpenChange(false)}
            mode={mode}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
