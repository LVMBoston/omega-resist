import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Plus, X, Wand2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Tone = "urgent" | "informative" | "hopeful" | "defiant";
export type BriefFieldKey = "what" | "why" | "when" | "where" | "who" | "ask";

export interface CampaignBrief {
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
  campaignTitle: string;
  onTitleChange: (next: string) => void;
  brief: CampaignBrief;
  onBriefChange: (next: CampaignBrief) => void;
  description: string;
  onDescriptionChange: (next: string) => void;
}

const FIELD_META: Record<BriefFieldKey, { label: string; helper: string; placeholder: string }> = {
  what: {
    label: "What is happening?",
    helper: "One concrete sentence describing the event or action.",
    placeholder: "e.g. A nationwide day of action against unlawful detentions on June 14.",
  },
  why: {
    label: "Why does it matter?",
    helper: "The stakes — who is affected and what's at risk.",
    placeholder: "e.g. Detentions have tripled in 6 months. Silence normalizes them.",
  },
  when: {
    label: "When?",
    helper: "Date/time, or 'ongoing' / 'nationwide'.",
    placeholder: "e.g. Saturday June 14, 2pm local time",
  },
  where: {
    label: "Where?",
    helper: "Locations or scope.",
    placeholder: "e.g. 200+ cities across all 50 states",
  },
  who: {
    label: "Who is the ask for?",
    helper: "The audience you want to reach.",
    placeholder: "e.g. Anyone within driving distance of a host city",
  },
  ask: {
    label: "The ask",
    helper: "The concrete call to action.",
    placeholder: "e.g. Find your nearest rally and RSVP to bring 2 friends.",
  },
};

const MAX_LIST_ITEMS = 5;

export default function CampaignBriefWizard({
  campaignTitle,
  onTitleChange,
  brief,
  onBriefChange,
  description,
  onDescriptionChange,
}: Props) {
  const { toast } = useToast();
  const [busyField, setBusyField] = useState<string | null>(null);

  const setField = (k: BriefFieldKey, v: string) => onBriefChange({ ...brief, [k]: v });

  const callBrief = async (payload: any): Promise<string | null> => {
    const { data, error } = await supabase.functions.invoke("draft-campaign-brief", { body: payload });
    if (error) {
      const status = (error as any).context?.status;
      const serverMsg = (error as any).context?.body?.error || (error as any).message;
      let message = serverMsg || "Couldn't draft. Try again.";
      if (status === 429) message = "Too many requests — wait a moment and try again.";
      else if (status === 402) message = "AI credits exhausted. Add credits in workspace settings.";
      else if (!status) message = `Request blocked before reaching server (${serverMsg || "network/CORS"}).`;
      toast({ variant: "destructive", title: "Generation failed", description: message });
      return null;
    }
    return (data as any)?.text ?? null;
  };

  const suggestField = async (f: BriefFieldKey) => {
    setBusyField(`field:${f}`);
    try {
      const text = await callBrief({ mode: "suggest_field", field: f, campaignTitle, brief });
      if (text) setField(f, text);
    } finally {
      setBusyField(null);
    }
  };

  const synthesizeDescription = async () => {
    setBusyField("description");
    try {
      const text = await callBrief({ mode: "synthesize_description", campaignTitle, brief });
      if (text) onDescriptionChange(text);
    } finally {
      setBusyField(null);
    }
  };

  const suggestTitle = async () => {
    setBusyField("title");
    try {
      const text = await callBrief({ mode: "suggest_title", campaignTitle, brief });
      if (text) onTitleChange(text);
    } finally {
      setBusyField(null);
    }
  };

  const renderSuggestBtn = (key: string, onClick: () => void, label = "Suggest") => {
    const busy = busyField === key;
    return (
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={busyField !== null} onClick={onClick}>
        {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
        {busy ? "Drafting…" : label}
      </Button>
    );
  };

  const renderField = (k: BriefFieldKey) => {
    const meta = FIELD_META[k];
    return (
      <div className="rounded-md border border-border bg-card p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <Label className="text-sm font-medium">{meta.label}</Label>
            <p className="text-[11px] text-muted-foreground">{meta.helper}</p>
          </div>
          {renderSuggestBtn(`field:${k}`, () => suggestField(k))}
        </div>
        <Textarea
          value={brief[k] || ""}
          onChange={(e) => setField(k, e.target.value)}
          placeholder={meta.placeholder}
          rows={2}
        />
      </div>
    );
  };

  const renderList = (
    key: "key_facts" | "do_not_say",
    label: string,
    helper: string,
    placeholder: string,
  ) => {
    const items = brief[key] || [];
    const update = (next: string[]) => onBriefChange({ ...brief, [key]: next });
    return (
      <div className="rounded-md border border-border bg-card p-3 space-y-2">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-[11px] text-muted-foreground">{helper} (up to {MAX_LIST_ITEMS})</p>
        </div>
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                update(next);
              }}
              placeholder={placeholder}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => update(items.filter((_, j) => j !== i))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {items.length < MAX_LIST_ITEMS && (
          <Button type="button" variant="outline" size="sm" onClick={() => update([...items, ""])}>
            <Plus className="mr-1 h-3 w-3" /> Add
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-muted/30 p-3 flex items-start gap-3">
        <Wand2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground">
          Fill in what you know. Use <span className="font-medium">Suggest</span> on any field to have AI draft it from
          the other answers. Everything you enter feeds into AI message drafts, narratives, and reports.
        </div>
      </div>

      {(["what", "why", "when", "where", "who", "ask"] as BriefFieldKey[]).map((k) => (
        <div key={k}>{renderField(k)}</div>
      ))}

      {renderList(
        "key_facts",
        "Key facts AI must include",
        "Numbers, names, dates that should always show up.",
        "e.g. Over 3,000 detentions since January",
      )}

      {renderList(
        "do_not_say",
        "Things AI must NOT say",
        "Framings or phrases to avoid.",
        "e.g. Don't use the word 'protest' — use 'rally'",
      )}

      <div className="rounded-md border border-border bg-card p-3">
        <Label className="text-sm font-medium">Default tone for AI drafts</Label>
        <p className="text-[11px] text-muted-foreground mb-2">Used as the starting tone for all message drafts on this campaign.</p>
        <Select value={brief.tone || "informative"} onValueChange={(v) => onBriefChange({ ...brief, tone: v as Tone })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="informative">Informative</SelectItem>
            <SelectItem value="hopeful">Hopeful</SelectItem>
            <SelectItem value="defiant">Defiant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Campaign description</Label>
            <p className="text-[11px] text-muted-foreground">
              Synthesized from the brief above. Used by message drafts, narratives, and reports. Edit freely.
            </p>
          </div>
          <div className="flex gap-1">
            {renderSuggestBtn("description", synthesizeDescription, description ? "Regenerate" : "Synthesize")}
          </div>
        </div>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Click Synthesize to draft from the brief, or type your own description."
          rows={4}
        />
        <div className="flex justify-end">
          {renderSuggestBtn("title", suggestTitle, "Suggest a better name")}
        </div>
      </div>
    </div>
  );
}
