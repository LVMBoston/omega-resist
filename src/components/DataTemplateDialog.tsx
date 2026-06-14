import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DataTemplateEditor } from "@/components/DataTemplateEditor";
import { Hotspot } from "@/types/viralTemplates";
import { BarChart3, Layers } from "lucide-react";
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
  onSaveAs?: (data: {
    hotspots: Hotspot[];
    imageUrl: string;
    name: string;
    slug: string;
    description?: string;
  }) => Promise<void>;
  mode: "create" | "edit";
  isHybrid?: boolean;
  lockedHotspots?: Hotspot[];
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
  onSaveAs,
  mode,
  isHybrid = false,
  lockedHotspots,
  initialData,
}: DataTemplateDialogProps) {
  const sessionKeyRef = useRef<string>("");
  const wasOpenRef = useRef(false);
  
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      sessionKeyRef.current = initialData?.id || `new-${Date.now()}`;
    }
    wasOpenRef.current = open;
  }, [open]);

  const handleSave = async (data: {
    hotspots: Hotspot[];
    imageUrl: string;
    name: string;
    slug: string;
    description?: string;
  }): Promise<string | void> => {
    const result = await onSave(data);
    return result;
  };

  const Icon = isHybrid ? Layers : BarChart3;
  const accentBg = isHybrid ? "bg-purple-50 dark:bg-purple-950/30" : "bg-green-50 dark:bg-green-950/30";
  const iconBg = isHybrid ? "bg-purple-600" : "bg-green-600";
  const titleColor = isHybrid ? "text-purple-900 dark:text-purple-100" : "text-green-900 dark:text-green-100";
  const descColor = isHybrid ? "text-purple-700 dark:text-purple-300" : "text-green-700 dark:text-green-300";
  const titleText = isHybrid
    ? (mode === "edit" ? "Edit Hybrid Template" : "Create Hybrid Template")
    : (mode === "edit" ? "Edit Data Template" : "Create Data Template");
  const descText = isHybrid
    ? "Add live metrics alongside existing share buttons"
    : "Configure live metrics hotspots for real-time campaign data display";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[90vw] sm:max-w-[90vw] p-0 flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <SheetHeader className={`px-6 py-4 border-b border-border ${accentBg}`}>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg ${iconBg} flex items-center justify-center`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <SheetTitle className={titleColor}>{titleText}</SheetTitle>
              <SheetDescription className={descColor}>{descText}</SheetDescription>
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
              lockedHotspots={lockedHotspots}
              onSave={handleSave}
              onSaveAs={onSaveAs}
              onCancel={() => onOpenChange(false)}
              mode={mode}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
