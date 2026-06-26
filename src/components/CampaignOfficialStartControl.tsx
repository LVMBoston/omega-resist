import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Clock } from "lucide-react";

interface Props {
  campaignId: string;
  officialStartAt: string | null | undefined;
}

/**
 * Lets an admin set an optional "Official start" date/time on the campaign.
 * Events before this moment are bucketed as pre-launch/test and excluded from
 * headline metrics, the map, narratives, and snapshots. Leaving it empty keeps
 * today's behavior (start = first real event).
 */
export default function CampaignOfficialStartControl({ campaignId, officialStartAt }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [value, setValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Convert ISO -> datetime-local string (YYYY-MM-DDTHH:mm) in viewer's local tz
  useEffect(() => {
    if (!officialStartAt) {
      setValue("");
      return;
    }
    const d = new Date(officialStartAt);
    if (isNaN(d.getTime())) {
      setValue("");
      return;
    }
    const pad = (n: number) => n.toString().padStart(2, "0");
    setValue(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }, [officialStartAt]);

  const save = async (next: string | null) => {
    setSaving(true);
    const payload = next ? new Date(next).toISOString() : null;
    const { error } = await supabase
      .from("campaigns")
      .update({ official_start_at: payload })
      .eq("id", campaignId);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Could not save", description: error.message });
      return;
    }
    toast({
      title: next ? "Official start set" : "Official start cleared",
      description: next
        ? "Events before this time are now treated as pre-launch / test."
        : "Reporting will use the first event as the start (default).",
    });
    qc.invalidateQueries({ queryKey: ["campaign-detail", campaignId] });
    qc.invalidateQueries({ queryKey: ["campaign-detail-stats"] });
  };

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-dashed p-3 bg-muted/30">
      <div className="max-w-[280px]">
        <Label className="text-xs flex items-center gap-1">
          <Clock className="h-3 w-3" /> Official start (optional)
        </Label>
        <Input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Events before this time are bucketed as <strong>pre-launch / test</strong> and excluded
          from headline metrics, the map, narratives, and snapshots. Leave empty to start reporting
          from the first event.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => save(value || null)} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setValue("");
            save(null);
          }}
          disabled={saving || !officialStartAt}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
