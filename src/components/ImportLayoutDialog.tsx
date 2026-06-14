import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import type { Hotspot } from "@/types/viralTemplates";
import {
  parseHotspotsJson,
  withFreshIds,
  rescaleHotspots,
  ratiosMatch,
  type ParsedLayout,
} from "@/lib/templateLayoutIO";

interface ImportLayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Target canvas aspect ratio, e.g. "9:16" */
  targetAspectRatio: string;
  onImport: (hotspots: Hotspot[], mode: "replace" | "append") => void;
}

type RescaleChoice = "fit" | "keep";

export function ImportLayoutDialog({
  open,
  onOpenChange,
  targetAspectRatio,
  onImport,
}: ImportLayoutDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedLayout | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [append, setAppend] = useState(false);
  const [rescaleChoice, setRescaleChoice] = useState<RescaleChoice>("fit");

  const reset = () => {
    setParsed(null);
    setFilename("");
    setAppend(false);
    setRescaleChoice("fit");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const data = parseHotspotsJson(text);
      setParsed(data);
      setFilename(file.name);
    } catch (err: any) {
      toast.error(err.message || "Could not read file");
      setParsed(null);
    }
  };

  const aspectMismatch = parsed
    ? !ratiosMatch(parsed.sourceAspectRatio, targetAspectRatio)
    : false;

  const handleApply = () => {
    if (!parsed) return;
    let hotspots = withFreshIds(parsed.hotspots);
    if (aspectMismatch && rescaleChoice === "fit") {
      hotspots = rescaleHotspots(hotspots, parsed.sourceAspectRatio, targetAspectRatio);
    }
    onImport(hotspots, append ? "append" : "replace");
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import hotspot layout</DialogTitle>
          <DialogDescription>
            Load a previously exported layout JSON file and apply it to this template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              {parsed ? "Choose a different file" : "Choose JSON file"}
            </Button>
            {filename && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {filename}
              </p>
            )}
          </div>

          {parsed && (
            <div className="rounded-md border border-border p-3 text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">Template:</span>{" "}
                {parsed.templateName || "(unnamed)"}
              </div>
              <div>
                <span className="text-muted-foreground">Hotspots:</span>{" "}
                {parsed.hotspots.length}
              </div>
              <div>
                <span className="text-muted-foreground">Source ratio:</span>{" "}
                {parsed.sourceAspectRatio || "unknown"}
                {aspectMismatch && (
                  <span className="ml-2 text-amber-600">
                    ≠ target {targetAspectRatio}
                  </span>
                )}
              </div>
            </div>
          )}

          {parsed && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="append-mode"
                checked={append}
                onCheckedChange={(v) => setAppend(Boolean(v))}
              />
              <Label htmlFor="append-mode" className="cursor-pointer text-sm">
                Append to existing hotspots (otherwise replace)
              </Label>
            </div>
          )}

          {parsed && aspectMismatch && (
            <div className="space-y-2">
              <Label className="text-sm">Aspect ratio mismatch</Label>
              <div className="space-y-1">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="rescale"
                    checked={rescaleChoice === "fit"}
                    onChange={() => setRescaleChoice("fit")}
                    className="mt-1"
                  />
                  <span>
                    <strong>Fit to target</strong> — rescale positions to fit the
                    new canvas (recommended).
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="rescale"
                    checked={rescaleChoice === "keep"}
                    onChange={() => setRescaleChoice("keep")}
                    className="mt-1"
                  />
                  <span>
                    <strong>Keep percentages as-is</strong> — some hotspots may
                    sit off-canvas.
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!parsed}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
