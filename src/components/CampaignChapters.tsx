import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Plus, RotateCcw, Save, Loader2, Copy, Sparkles, Lock, Unlock } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import ChapterForm from "@/components/ChapterForm";

type GenField = "smsL00" | "smsL01" | "emailL00" | "emailL01";
type Tone = "urgent" | "informative" | "hopeful" | "defiant";
const GEN_FIELD_META: Record<GenField, { channel: "sms" | "email"; level: "l00" | "l01" }> = {
  smsL00: { channel: "sms", level: "l00" },
  smsL01: { channel: "sms", level: "l01" },
  emailL00: { channel: "email", level: "l00" },
  emailL01: { channel: "email", level: "l01" },
};
const GEN_FIELD_LABELS: Record<GenField, string> = {
  smsL00: "SMS L00",
  smsL01: "SMS L01",
  emailL00: "Email L00",
  emailL01: "Email L01",
};
const ALL_GEN_FIELDS: GenField[] = ["smsL00", "smsL01", "emailL00", "emailL01"];

interface CampaignChaptersProps {
  campaignId: string;
}

interface ChapterGroup {
  mobilize_code: string;
  city: string | null;
  state: string | null;
  site_name: string | null;
  eoaCount: number;
}

interface OverrideValues {
  emailL00: string;
  emailL01: string;
  emailL00Subject: string;
  emailL01Subject: string;
  smsL00: string;
  smsL01: string;
}

const EMPTY_OVERRIDES: OverrideValues = { emailL00: "", emailL01: "", emailL00Subject: "", emailL01Subject: "", smsL00: "", smsL01: "" };

export default function CampaignChapters({ campaignId }: CampaignChaptersProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<ChapterGroup[]>([]);
  const [addChapterOpen, setAddChapterOpen] = useState(false);

  // Campaign-level overrides
  const [campaignOverrides, setCampaignOverrides] = useState<OverrideValues>({ ...EMPTY_OVERRIDES });
  const [campaignOverridesOriginal, setCampaignOverridesOriginal] = useState<OverrideValues>({ ...EMPTY_OVERRIDES });
  const [campaignOverridesOpen, setCampaignOverridesOpen] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);

  // Chapter-level overrides
  const [chapterOverrides, setChapterOverrides] = useState<Record<string, OverrideValues>>({});
  const [chapterOverridesOriginal, setChapterOverridesOriginal] = useState<Record<string, OverrideValues>>({});
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [savingChapter, setSavingChapter] = useState<string | null>(null);

  // Campaign info (for AI generation prompt context)
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");

  // AI generation
  const [tone, setTone] = useState<Tone>("informative");
  const [generatingField, setGeneratingField] = useState<string | null>(null);
  const [pendingOverwrite, setPendingOverwrite] = useState<{ scope: string | null; field: GenField } | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState<string | null>(null); // scope key while bulk running
  const [pendingBulkOverwrite, setPendingBulkOverwrite] = useState<{ scope: string | null; fieldsToOverwrite: GenField[] } | null>(null);
  const [pendingBulkGenerate, setPendingBulkGenerate] = useState<{
    scope: string | null;
    toGenerate: GenField[];
    toOverwrite: GenField[];
    locked: GenField[];
  } | null>(null);


  // Per-field locks (client-side, persisted in localStorage). Key format: `${scope|"campaign"}:${field}`
  const lockStorageKey = `campaign-message-locks:${campaignId}`;
  const [lockedFields, setLockedFields] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`campaign-message-locks:${campaignId}`);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  const persistLocks = (next: Set<string>) => {
    try { localStorage.setItem(lockStorageKey, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
  };
  const lockKey = (scope: string | null, field: GenField) => `${scope ?? "campaign"}:${field}`;
  const isLocked = (scope: string | null, field: GenField) => lockedFields.has(lockKey(scope, field));
  const toggleLock = (scope: string | null, field: GenField) => {
    setLockedFields((prev) => {
      const next = new Set(prev);
      const k = lockKey(scope, field);
      if (next.has(k)) next.delete(k); else next.add(k);
      persistLocks(next);
      return next;
    });
  };

  // Global defaults for placeholders
  const [globalDefaults, setGlobalDefaults] = useState<OverrideValues>({ ...EMPTY_OVERRIDES });

  useEffect(() => {
    fetchData();
  }, [campaignId]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchChapters(), fetchOverrides(), fetchGlobalDefaults(), fetchCampaignInfo()]);
    setLoading(false);
  };

  const [campaignBrief, setCampaignBrief] = useState<any>(null);

  const fetchCampaignInfo = async () => {
    const { data } = await supabase
      .from("campaigns")
      .select("title, description, brief")
      .eq("id", campaignId)
      .single();
    if (data) {
      setCampaignTitle(data.title || "");
      setCampaignDescription(data.description || "");
      setCampaignBrief((data as any).brief || null);
    }
  };

  const canGenerate = campaignTitle.trim().length > 0 && campaignDescription.trim().length > 0;

  const runGenerate = async (scope: string | null, field: GenField) => {
    const key = `${scope ?? "campaign"}:${field}`;
    setGeneratingField(key);
    try {
      const meta = GEN_FIELD_META[field];
      const { data, error } = await supabase.functions.invoke("draft-campaign-message", {
        body: {
          campaignTitle,
          campaignDescription,
          tone,
          channel: meta.channel,
          level: meta.level,
          brief: campaignBrief || undefined,
        },
      });
      if (error) {
        const status = (error as any).context?.status;
        const serverMsg = (error as any).context?.body?.error || (error as any).message;
        let message = serverMsg || "Couldn't generate message. Please try again.";
        if (status === 429) message = "Too many requests — please wait a moment and try again.";
        else if (status === 402) message = "AI credits exhausted. Add credits in workspace settings.";
        else if (!status) message = `Request blocked before reaching server (${serverMsg || "network/CORS"}). Try a hard refresh.`;
        console.error("[draft-campaign-message] error", { status, error });
        toast({ variant: "destructive", title: "Generation failed", description: message });
        return;
      }
      const text = (data as any)?.text as string | undefined;
      if (!text) {
        toast({ variant: "destructive", title: "Generation failed", description: "Empty response. Please try again." });
        return;
      }
      if (scope === null) {
        setCampaignOverrides((prev) => ({ ...prev, [field]: text }));
      } else {
        setChapterOverrides((prev) => ({
          ...prev,
          [scope]: { ...(prev[scope] || { ...EMPTY_OVERRIDES }), [field]: text },
        }));
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Generation failed", description: e?.message || "Unexpected error." });
    } finally {
      setGeneratingField(null);
    }
  };

  const handleGenerateClick = (scope: string | null, field: GenField, currentValue: string) => {
    if (isLocked(scope, field)) {
      toast({ title: "Field is locked", description: "Unlock this field before regenerating it." });
      return;
    }
    if (currentValue.trim().length > 0) {
      setPendingOverwrite({ scope, field });
      return;
    }
    runGenerate(scope, field);
  };

  const ALL_GEN_FIELDS: GenField[] = ["smsL00", "smsL01", "emailL00", "emailL01"];

  const runBulkGenerate = async (scope: string | null, fields: GenField[]) => {
    const scopeKey = scope ?? "campaign";
    setBulkGenerating(scopeKey);
    sonnerToast(`Generating ${fields.length} message draft${fields.length === 1 ? "" : "s"}…`);
    try {
      for (const field of fields) {
        await runGenerate(scope, field);
      }
      sonnerToast.success(`Confirmed: ${fields.length} message draft${fields.length === 1 ? "" : "s"} generated.`);
    } finally {
      setBulkGenerating(null);
    }
  };

  const handleBulkGenerateClick = (scope: string | null) => {
    const current = scope === null ? campaignOverrides : (chapterOverrides[scope] || { ...EMPTY_OVERRIDES });
    const unlockedFields = ALL_GEN_FIELDS.filter((f) => !isLocked(scope, f));
    const lockedList = ALL_GEN_FIELDS.filter((f) => isLocked(scope, f));
    if (unlockedFields.length === 0) {
      toast({ title: "All fields locked", description: "Unlock at least one field to generate." });
      return;
    }
    const toOverwrite = unlockedFields.filter((f) => (current[f] || "").trim().length > 0);
    setPendingBulkGenerate({ scope, toGenerate: unlockedFields, toOverwrite, locked: lockedList });
  };


  const fetchChapters = async () => {
    const { data: eoas } = await supabase
      .from("events_actions")
      .select("mobilize_code, city, state, site_name")
      .eq("campaign_id", campaignId)
      .not("mobilize_code", "is", null);

    if (eoas) {
      const groups = new Map<string, ChapterGroup>();
      for (const eoa of eoas) {
        if (!eoa.mobilize_code) continue;
        const existing = groups.get(eoa.mobilize_code);
        if (existing) {
          existing.eoaCount++;
        } else {
          groups.set(eoa.mobilize_code, {
            mobilize_code: eoa.mobilize_code,
            city: eoa.city,
            state: eoa.state,
            site_name: eoa.site_name,
            eoaCount: 1,
          });
        }
      }
      const chapterList = Array.from(groups.values());
      setChapters(chapterList);

      // Lock-by-default: any chapter scope without an entry in the persisted lock set
      // starts with all 4 fields locked. Campaign-level (scope=null) is NOT auto-locked.
      try {
        const raw = localStorage.getItem(lockStorageKey);
        const stored: string[] = raw ? JSON.parse(raw) : [];
        const storedSet = new Set(stored);
        const scopesSeen = new Set<string>();
        for (const k of stored) {
          const scope = k.split(":")[0];
          if (scope && scope !== "campaign") scopesSeen.add(scope);
        }
        let changed = false;
        for (const ch of chapterList) {
          if (!scopesSeen.has(ch.mobilize_code)) {
            for (const f of ALL_GEN_FIELDS) {
              storedSet.add(`${ch.mobilize_code}:${f}`);
            }
            changed = true;
          }
        }
        if (changed) {
          const next = Array.from(storedSet);
          localStorage.setItem(lockStorageKey, JSON.stringify(next));
          setLockedFields(new Set(next));
        }
      } catch { /* ignore */ }
    }
  };

  const fetchOverrides = async () => {
    const { data } = await supabase
      .from("campaign_message_overrides")
      .select("mobilize_code, category, key, value")
      .eq("campaign_id", campaignId);

    const campaignOvr: OverrideValues = { ...EMPTY_OVERRIDES };
    const chapterOvr: Record<string, OverrideValues> = {};

    if (data) {
      for (const row of data) {
        const body = (row.value as any)?.body || "";
        const subject = (row.value as any)?.subject || "";
        const target = row.mobilize_code === null ? campaignOvr : (chapterOvr[row.mobilize_code] ??= { ...EMPTY_OVERRIDES });
        if (row.category === "email" && row.key === "l00_template") { target.emailL00 = body; target.emailL00Subject = subject; }
        if (row.category === "email" && row.key === "l01_template") { target.emailL01 = body; target.emailL01Subject = subject; }
        if (row.category === "sms" && row.key === "l00_template") target.smsL00 = body;
        if (row.category === "sms" && row.key === "l01_template") target.smsL01 = body;
      }
    }

    setCampaignOverrides({ ...campaignOvr });
    setCampaignOverridesOriginal({ ...campaignOvr });
    setChapterOverrides({ ...chapterOvr });
    setChapterOverridesOriginal(JSON.parse(JSON.stringify(chapterOvr)));
  };

  const fetchGlobalDefaults = async () => {
    const { data } = await supabase
      .from("settings")
      .select("category, key, value")
      .in("category", ["email", "sms"])
      .in("key", ["l00_template", "l01_template"]);

    if (data) {
      const defaults: OverrideValues = { ...EMPTY_OVERRIDES };
      for (const row of data) {
        const body = (row.value as any)?.body || "";
        const subject = (row.value as any)?.subject || "";
        if (row.category === "email" && row.key === "l00_template") { defaults.emailL00 = body; defaults.emailL00Subject = subject; }
        if (row.category === "email" && row.key === "l01_template") { defaults.emailL01 = body; defaults.emailL01Subject = subject; }
        if (row.category === "sms" && row.key === "l00_template") defaults.smsL00 = body;
        if (row.category === "sms" && row.key === "l01_template") defaults.smsL01 = body;
      }
      setGlobalDefaults(defaults);
    }
  };

  const saveOverrides = async (mobilize_code: string | null, values: OverrideValues) => {
    const rows: any[] = [];
    const deleteConditions: { category: string; key: string }[] = [];

    const slots = [
      { field: "smsL00" as const, category: "sms", key: "l00_template" },
      { field: "smsL01" as const, category: "sms", key: "l01_template" },
      { field: "emailL00" as const, subjectField: "emailL00Subject" as const, category: "email", key: "l00_template" },
      { field: "emailL01" as const, subjectField: "emailL01Subject" as const, category: "email", key: "l01_template" },
    ];

    for (const slot of slots) {
      const bodyValue = values[slot.field].trim();
      const subjectValue = "subjectField" in slot ? values[slot.subjectField!].trim() : "";
      
      if (bodyValue || subjectValue) {
        const valueObj = slot.category === "email"
          ? { subject: subjectValue, body: bodyValue }
          : { body: bodyValue };
        rows.push({
          campaign_id: campaignId,
          mobilize_code,
          category: slot.category,
          key: slot.key,
          value: valueObj,
        });
      } else {
        deleteConditions.push({ category: slot.category, key: slot.key });
      }
    }

    // Delete empty ones
    for (const cond of deleteConditions) {
      let query = supabase
        .from("campaign_message_overrides")
        .delete()
        .eq("campaign_id", campaignId)
        .eq("category", cond.category)
        .eq("key", cond.key);
      if (mobilize_code === null) {
        query = query.is("mobilize_code", null);
      } else {
        query = query.eq("mobilize_code", mobilize_code);
      }
      await query;
    }

    // Upsert non-empty ones
    if (rows.length > 0) {
      for (const row of rows) {
        let delQuery = supabase
          .from("campaign_message_overrides")
          .delete()
          .eq("campaign_id", campaignId)
          .eq("category", row.category)
          .eq("key", row.key);
        if (row.mobilize_code === null) {
          delQuery = delQuery.is("mobilize_code", null);
        } else {
          delQuery = delQuery.eq("mobilize_code", row.mobilize_code);
        }
        await delQuery;

        const { error } = await supabase.from("campaign_message_overrides").insert(row);
        if (error) throw error;
      }
    }
  };

  const handleSaveCampaignOverrides = async () => {
    setSavingCampaign(true);
    try {
      await saveOverrides(null, campaignOverrides);
      setCampaignOverridesOriginal({ ...campaignOverrides });
      toast({ title: "Saved", description: "Campaign-level messaging overrides saved" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleResetCampaignOverrides = async () => {
    setSavingCampaign(true);
    try {
      const empty: OverrideValues = { ...EMPTY_OVERRIDES };
      await saveOverrides(null, empty);
      setCampaignOverrides(empty);
      setCampaignOverridesOriginal(empty);
      toast({ title: "Reset", description: "Campaign-level overrides removed — global defaults will apply" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleSaveChapterOverrides = async (mobilize_code: string) => {
    setSavingChapter(mobilize_code);
    try {
      const values = chapterOverrides[mobilize_code] || { ...EMPTY_OVERRIDES };
      await saveOverrides(mobilize_code, values);
      setChapterOverridesOriginal((prev) => ({ ...prev, [mobilize_code]: { ...values } }));
      toast({ title: "Saved", description: `Messaging overrides saved for ${mobilize_code}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setSavingChapter(null);
    }
  };

  const handleResetChapterOverrides = async (mobilize_code: string) => {
    setSavingChapter(mobilize_code);
    try {
      const empty: OverrideValues = { ...EMPTY_OVERRIDES };
      await saveOverrides(mobilize_code, empty);
      setChapterOverrides((prev) => ({ ...prev, [mobilize_code]: empty }));
      setChapterOverridesOriginal((prev) => ({ ...prev, [mobilize_code]: { ...empty } }));
      toast({ title: "Reset", description: `Overrides removed for ${mobilize_code} — inherits campaign/global defaults` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setSavingChapter(null);
    }
  };

  const toggleChapter = (code: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const getPlaceholder = (field: keyof OverrideValues, mobilize_code?: string) => {
    if (mobilize_code) {
      return campaignOverrides[field] || globalDefaults[field] || "Inherited from global";
    }
    return globalDefaults[field] || "Global default";
  };

  const hasCampaignChanges = JSON.stringify(campaignOverrides) !== JSON.stringify(campaignOverridesOriginal);
  const hasAnyOverride = (v: OverrideValues) => v.emailL00 || v.emailL01 || v.emailL00Subject || v.emailL01Subject || v.smsL00 || v.smsL01;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Add Chapter button */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Chapters</h2>
        <Button onClick={() => setAddChapterOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Chapter
        </Button>
      </div>

      {/* Campaign-level overrides */}
      <Collapsible open={campaignOverridesOpen} onOpenChange={setCampaignOverridesOpen}>
        <Card>
          <CardHeader className="pb-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 p-0 h-auto">
                {campaignOverridesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <CardTitle className="text-base">Campaign-Level Messaging Overrides</CardTitle>
                {hasAnyOverride(campaignOverrides) && <Badge variant="secondary" className="ml-2">Custom</Badge>}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">These override global defaults for all chapters in this campaign unless a chapter has its own override.</p>
              <BulkGenerateBar
                scope={null}
                tone={tone}
                setTone={setTone}
                canGenerate={canGenerate}
                bulkGenerating={bulkGenerating === "campaign"}
                anyFieldGenerating={generatingField !== null}
                onBulkGenerate={() => handleBulkGenerateClick(null)}
                isLocked={(f) => isLocked(null, f)}
                onToggleLock={(f) => toggleLock(null, f)}
              />
              {renderOverrideFields(
                campaignOverrides,
                (field, value) => setCampaignOverrides((prev) => ({ ...prev, [field]: value })),
                (field) => getPlaceholder(field),
                { scope: null, onGenerate: handleGenerateClick, generatingField, canGenerate, isLocked: (f) => isLocked(null, f), onToggleLock: (f) => toggleLock(null, f) }
              )}

              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSaveCampaignOverrides} disabled={!hasCampaignChanges || savingCampaign}>
                  {savingCampaign ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />} Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleResetCampaignOverrides} disabled={(!hasAnyOverride(campaignOverridesOriginal) && !hasAnyOverride(campaignOverrides)) || savingCampaign}>
                  <RotateCcw className="mr-2 h-3 w-3" /> Reset to Default
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Chapter cards */}
      {chapters.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No chapters found. Chapters are auto-discovered from EoAs with a mobilize_code, or you can add one above.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {chapters.map((chapter) => {
            const isExpanded = expandedChapters.has(chapter.mobilize_code);
            const ovr = chapterOverrides[chapter.mobilize_code] || { ...EMPTY_OVERRIDES };
            const ovrOrig = chapterOverridesOriginal[chapter.mobilize_code] || { ...EMPTY_OVERRIDES };
            const hasChanges = JSON.stringify(ovr) !== JSON.stringify(ovrOrig);
            const locationParts = [chapter.city, chapter.state].filter(Boolean).join(", ");

            return (
              <Card key={chapter.mobilize_code}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" className="justify-start gap-2 p-0 h-auto" onClick={() => toggleChapter(chapter.mobilize_code)}>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="font-medium">{chapter.mobilize_code}</span>
                      {locationParts && <span className="text-muted-foreground text-sm">— {locationParts}</span>}
                    </Button>
                    <div className="flex items-center gap-2">
                      {hasAnyOverride(ovr) && <Badge variant="secondary">Custom</Badge>}
                      <Badge variant="outline">{chapter.eoaCount} EoA{chapter.eoaCount !== 1 ? "s" : ""}</Badge>
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="space-y-3">
                    <BulkGenerateBar
                      scope={chapter.mobilize_code}
                      tone={tone}
                      setTone={setTone}
                      canGenerate={canGenerate}
                      bulkGenerating={bulkGenerating === chapter.mobilize_code}
                      anyFieldGenerating={generatingField !== null}
                      onBulkGenerate={() => handleBulkGenerateClick(chapter.mobilize_code)}
                      isLocked={(f) => isLocked(chapter.mobilize_code, f)}
                      onToggleLock={(f) => toggleLock(chapter.mobilize_code, f)}
                    />
                    {renderOverrideFields(
                      ovr,
                      (field, value) => setChapterOverrides((prev) => ({
                        ...prev,
                        [chapter.mobilize_code]: { ...(prev[chapter.mobilize_code] || { ...EMPTY_OVERRIDES }), [field]: value },
                      })),
                      (field) => getPlaceholder(field, chapter.mobilize_code),
                      { scope: chapter.mobilize_code, onGenerate: handleGenerateClick, generatingField, canGenerate, isLocked: (f) => isLocked(chapter.mobilize_code, f), onToggleLock: (f) => toggleLock(chapter.mobilize_code, f) }
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={() => handleSaveChapterOverrides(chapter.mobilize_code)} disabled={!hasChanges || savingChapter === chapter.mobilize_code}>
                        {savingChapter === chapter.mobilize_code ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />} Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleResetChapterOverrides(chapter.mobilize_code)} disabled={(!hasAnyOverride(ovrOrig) && !hasAnyOverride(ovr)) || savingChapter === chapter.mobilize_code}>
                        <RotateCcw className="mr-2 h-3 w-3" /> Reset to Default
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Chapter Dialog */}
      <Dialog open={addChapterOpen} onOpenChange={setAddChapterOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Chapter</DialogTitle>
          </DialogHeader>
          <ChapterForm
            campaignId={campaignId}
            messagingPlaceholders={{
              smsL00: campaignOverrides.smsL00 || globalDefaults.smsL00,
              smsL01: campaignOverrides.smsL01 || globalDefaults.smsL01,
              emailL00: campaignOverrides.emailL00 || globalDefaults.emailL00,
              emailL01: campaignOverrides.emailL01 || globalDefaults.emailL01,
            }}
            onSuccess={() => {
              setAddChapterOpen(false);
              fetchData();
            }}
            onCancel={() => setAddChapterOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingOverwrite !== null} onOpenChange={(o) => { if (!o) setPendingOverwrite(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing draft?</AlertDialogTitle>
            <AlertDialogDescription>This will replace your current draft with a new AI-generated version.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingOverwrite(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const p = pendingOverwrite;
              setPendingOverwrite(null);
              if (p) runGenerate(p.scope, p.field);
            }}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingBulkGenerate !== null} onOpenChange={(o) => { if (!o) setPendingBulkGenerate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate {pendingBulkGenerate?.toGenerate.length ?? 0} message draft{(pendingBulkGenerate?.toGenerate.length ?? 0) === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>
                  Scope: <span className="font-medium">{pendingBulkGenerate?.scope === null ? "Campaign default" : pendingBulkGenerate?.scope}</span>
                </div>
                {pendingBulkGenerate && pendingBulkGenerate.toGenerate.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Will be written:</span>{" "}
                    {pendingBulkGenerate.toGenerate.map((f) => GEN_FIELD_LABELS[f]).join(", ")}
                  </div>
                )}
                {pendingBulkGenerate && pendingBulkGenerate.toOverwrite.length > 0 && (
                  <div className="text-amber-700 dark:text-amber-400">
                    Overwriting existing text in: {pendingBulkGenerate.toOverwrite.map((f) => GEN_FIELD_LABELS[f]).join(", ")}
                  </div>
                )}
                {pendingBulkGenerate && pendingBulkGenerate.locked.length > 0 && (
                  <div className="text-muted-foreground">
                    Skipped (locked): {pendingBulkGenerate.locked.map((f) => GEN_FIELD_LABELS[f]).join(", ")}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingBulkGenerate(null)} autoFocus>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const p = pendingBulkGenerate;
              setPendingBulkGenerate(null);
              if (p) runBulkGenerate(p.scope, p.toGenerate);
            }}>Generate {pendingBulkGenerate?.toGenerate.length ?? 0} draft{(pendingBulkGenerate?.toGenerate.length ?? 0) === 1 ? "" : "s"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}


function CopyButton({ text }: { text: string }) {
  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    sonnerToast.success("Copied to clipboard");
  };
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      onClick={handleCopy}
      disabled={!text}
      title="Copy to clipboard"
    >
      <Copy className="h-3.5 w-3.5" />
    </Button>
  );
}

interface GenProps {
  scope: string | null;
  onGenerate: (scope: string | null, field: GenField, currentValue: string) => void;
  generatingField: string | null;
  canGenerate: boolean;
  isLocked: (field: GenField) => boolean;
  onToggleLock: (field: GenField) => void;
}

function LockButton({ field, gen }: { field: GenField; gen?: GenProps }) {
  if (!gen) return null;
  const locked = gen.isLocked(field);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`h-7 w-7 shrink-0 ${locked ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
      onClick={() => gen.onToggleLock(field)}
      title={locked ? "Unlock — allow AI to regenerate this field" : "Lock — prevent AI from regenerating this field"}
      aria-pressed={locked}
    >
      {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
    </Button>
  );
}

function GenerateButton({ field, value, gen }: { field: GenField; value: string; gen?: GenProps }) {
  if (!gen) return null;
  const key = `${gen.scope ?? "campaign"}:${field}`;
  const isBusy = gen.generatingField === key;
  const locked = gen.isLocked(field);
  const disabled = !gen.canGenerate || gen.generatingField !== null || locked;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 px-2 text-xs"
      disabled={disabled}
      title={locked ? "Field is locked — unlock to regenerate" : (!gen.canGenerate ? "Add a campaign name and description first" : "Generate this message with AI")}
      onClick={() => gen.onGenerate(gen.scope, field, value)}
    >
      {isBusy ? (
        <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Generating…</>
      ) : (
        <><Sparkles className="mr-1 h-3 w-3" />Generate</>
      )}
    </Button>
  );
}

interface BulkGenerateBarProps {
  scope: string | null;
  tone: Tone;
  setTone: (t: Tone) => void;
  canGenerate: boolean;
  bulkGenerating: boolean;
  anyFieldGenerating: boolean;
  onBulkGenerate: () => void;
  isLocked: (field: GenField) => boolean;
  onToggleLock: (field: GenField) => void;
}

function BulkGenerateBar({ scope, tone, setTone, canGenerate, bulkGenerating, anyFieldGenerating, onBulkGenerate, isLocked, onToggleLock }: BulkGenerateBarProps) {
  const disabled = !canGenerate || anyFieldGenerating;
  const allLocked = ALL_GEN_FIELDS.every((f) => isLocked(f));
  const anyLocked = ALL_GEN_FIELDS.some((f) => isLocked(f));
  const handleBulkLock = () => {
    if (allLocked) {
      ALL_GEN_FIELDS.forEach((f) => onToggleLock(f));
    } else {
      ALL_GEN_FIELDS.forEach((f) => {
        if (!isLocked(f)) onToggleLock(f);
      });
    }
  };
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium">AI message drafting</span>
        <span className={`ml-1 inline-flex items-center gap-1 text-xs ${canGenerate ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
          <span className={`h-2 w-2 rounded-full ${canGenerate ? "bg-emerald-500" : "bg-amber-500"}`} />
          {canGenerate ? "Ready" : "Needs campaign description"}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-xs">Tone</Label>
        <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="informative">Informative</SelectItem>
            <SelectItem value="hopeful">Hopeful</SelectItem>
            <SelectItem value="defiant">Defiant</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`h-8 w-8 shrink-0 ${allLocked ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}
            onClick={handleBulkLock}
            title={allLocked ? "Unlock all 4 fields" : anyLocked ? "Lock remaining unlocked fields" : "Lock all 4 fields"}
            aria-pressed={allLocked}
          >
            {allLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onBulkGenerate}
            disabled={disabled || allLocked}
          >
            {bulkGenerating ? (
              <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Generating all 4…</>
            ) : (
              <><Sparkles className="mr-2 h-3 w-3" />Generate all 4 drafts</>
            )}
          </Button>
        </div>
      </div>
      {!canGenerate && (
        <p className="text-xs text-muted-foreground">
          Add a title and description to this campaign (Campaign Manager → edit campaign) to enable AI drafting.
        </p>
      )}
    </div>
  );
}

function renderOverrideFields(

  values: OverrideValues,
  onChange: (field: keyof OverrideValues, value: string) => void,
  getPlaceholder: (field: keyof OverrideValues) => string,
  gen?: GenProps
) {
  const bodyRow = (field: GenField, label: string) => (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-1">
          <GenerateButton field={field} value={values[field]} gen={gen} />
          <LockButton field={field} gen={gen} />

          <CopyButton text={values[field] || getPlaceholder(field)} />
        </div>
      </div>
      <Textarea value={values[field]} onChange={(e) => onChange(field, e.target.value)} placeholder={getPlaceholder(field)} rows={4} className="whitespace-pre-wrap" />
    </div>
  );
  return (
    <>
      {bodyRow("smsL00", "SMS L00 Template")}
      {bodyRow("smsL01", "SMS L01 Template")}
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Email L00 Subject</Label>
          <CopyButton text={values.emailL00Subject || getPlaceholder("emailL00Subject")} />
        </div>
        <Input value={values.emailL00Subject} onChange={(e) => onChange("emailL00Subject", e.target.value)} placeholder={getPlaceholder("emailL00Subject")} />
      </div>
      {bodyRow("emailL00", "Email L00 Body")}
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Email L01 Subject</Label>
          <CopyButton text={values.emailL01Subject || getPlaceholder("emailL01Subject")} />
        </div>
        <Input value={values.emailL01Subject} onChange={(e) => onChange("emailL01Subject", e.target.value)} placeholder={getPlaceholder("emailL01Subject")} />
      </div>
      {bodyRow("emailL01", "Email L01 Body")}
    </>
  );
}
