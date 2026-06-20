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

type Tone = "urgent" | "informative" | "hopeful" | "defiant";

interface Brief {
  what?: string;
  why?: string;
  when?: string;
  where?: string;
  who?: string;
  ask?: string;
  key_facts?: string[];
  do_not_say?: string[];
  tone?: Tone;
}

interface Props {
  campaignId: string;
  campaignTitle: string;
  description: string | null;
  existingBrief: Brief | null;
}

const FIELD_LABELS: Array<[keyof Brief, string]> = [
  ["what", "What is happening?"],
  ["why", "Why does it matter?"],
  ["when", "When?"],
  ["where", "Where?"],
  ["who", "Who is the ask for?"],
  ["ask", "The ask"],
];

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
              AI extracted this from the campaign description. Review, then Save to overwrite the
              current brief — or Cancel to discard.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4 py-2">
              {FIELD_LABELS.map(([key, label]) => {
                const v = (draft[key] as string) || "";
                return (
                  <div key={key}>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {label}
                    </div>
                    <div className="text-sm whitespace-pre-wrap mt-1">
                      {v || <span className="italic text-muted-foreground">(not in description)</span>}
                    </div>
                  </div>
                );
              })}

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Key facts AI must include
                </div>
                {draft.key_facts && draft.key_facts.length > 0 ? (
                  <ul className="text-sm list-disc pl-5 mt-1">
                    {draft.key_facts.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm italic text-muted-foreground mt-1">(none)</div>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Things AI must NOT say
                </div>
                {draft.do_not_say && draft.do_not_say.length > 0 ? (
                  <ul className="text-sm list-disc pl-5 mt-1">
                    {draft.do_not_say.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm italic text-muted-foreground mt-1">(none)</div>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Tone
                </div>
                <div className="text-sm mt-1 capitalize">{draft.tone || "informative"}</div>
              </div>
            </div>
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
