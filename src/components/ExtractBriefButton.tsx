import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import CampaignBriefWizard, { CampaignBrief } from "@/components/CampaignBriefWizard";

type Brief = CampaignBrief;

interface Props {
  campaignId: string;
  campaignTitle: string;
  description: string | null;
  existingBrief: Brief | null;
}

export default function ExtractBriefButton({
  campaignId,
  campaignTitle,
  description,
  existingBrief,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Brief | null>(null);
  const queryClient = useQueryClient();

  const hasBrief = !!existingBrief && Object.values(existingBrief).some((v) =>
    Array.isArray(v) ? v.length > 0 : !!v
  );

  const handleExtract = async () => {
    if (!description || !description.trim()) {
      toast.error("No description to extract from.");
      return;
    }
    if (hasBrief && !window.confirm("This will overwrite the existing brief after you click Save. Continue?")) {
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("draft-campaign-brief", {
        body: {
          mode: "extract_brief",
          campaignTitle,
          description,
        },
      });
      if (error) throw error;
      if (!data?.brief) throw new Error("AI returned no brief");
      setDraft(data.brief as Brief);
      setOpen(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to extract brief";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({ brief: draft as never })
        .eq("id", campaignId);
      if (error) throw error;
      toast.success("Brief saved.");
      setOpen(false);
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["campaign-detail", campaignId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save brief");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExtract}
        disabled={loading || !description?.trim()}
        className="mt-3"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4 mr-2" />
        )}
        {hasBrief ? "Re-extract brief from description (AI)" : "Extract brief from description (AI)"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proposed brief</DialogTitle>
            <DialogDescription>
              AI extracted this from the campaign description. Edit any field, then Save to overwrite
              the current brief — or Cancel to discard.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <CampaignBriefWizard
              campaignTitle={campaignTitle}
              onTitleChange={() => {}}
              brief={draft}
              onBriefChange={setDraft}
              description=""
              onDescriptionChange={() => {}}
              hideSynthesis
            />
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save brief
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
