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
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Plus, RotateCcw, Save, Loader2, Copy } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import ChapterForm from "@/components/ChapterForm";

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

  // Global defaults for placeholders
  const [globalDefaults, setGlobalDefaults] = useState<OverrideValues>({ ...EMPTY_OVERRIDES });

  useEffect(() => {
    fetchData();
  }, [campaignId]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchChapters(), fetchOverrides(), fetchGlobalDefaults()]);
    setLoading(false);
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
      setChapters(Array.from(groups.values()));
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
              {renderOverrideFields(campaignOverrides, (field, value) => setCampaignOverrides((prev) => ({ ...prev, [field]: value })), (field) => getPlaceholder(field))}
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
                    {renderOverrideFields(
                      ovr,
                      (field, value) => setChapterOverrides((prev) => ({
                        ...prev,
                        [chapter.mobilize_code]: { ...(prev[chapter.mobilize_code] || { ...EMPTY_OVERRIDES }), [field]: value },
                      })),
                      (field) => getPlaceholder(field, chapter.mobilize_code)
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

function renderOverrideFields(
  values: OverrideValues,
  onChange: (field: keyof OverrideValues, value: string) => void,
  getPlaceholder: (field: keyof OverrideValues) => string
) {
  return (
    <>
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">SMS L00 Template</Label>
          <CopyButton text={values.smsL00 || getPlaceholder("smsL00")} />
        </div>
        <Textarea value={values.smsL00} onChange={(e) => onChange("smsL00", e.target.value)} placeholder={getPlaceholder("smsL00")} rows={2} />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">SMS L01 Template</Label>
          <CopyButton text={values.smsL01 || getPlaceholder("smsL01")} />
        </div>
        <Textarea value={values.smsL01} onChange={(e) => onChange("smsL01", e.target.value)} placeholder={getPlaceholder("smsL01")} rows={2} />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Email L00 Subject</Label>
          <CopyButton text={values.emailL00Subject || getPlaceholder("emailL00Subject")} />
        </div>
        <Input value={values.emailL00Subject} onChange={(e) => onChange("emailL00Subject", e.target.value)} placeholder={getPlaceholder("emailL00Subject")} />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Email L00 Body</Label>
          <CopyButton text={values.emailL00 || getPlaceholder("emailL00")} />
        </div>
        <Textarea value={values.emailL00} onChange={(e) => onChange("emailL00", e.target.value)} placeholder={getPlaceholder("emailL00")} rows={4} className="whitespace-pre-wrap" />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Email L01 Subject</Label>
          <CopyButton text={values.emailL01Subject || getPlaceholder("emailL01Subject")} />
        </div>
        <Input value={values.emailL01Subject} onChange={(e) => onChange("emailL01Subject", e.target.value)} placeholder={getPlaceholder("emailL01Subject")} />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Email L01 Body</Label>
          <CopyButton text={values.emailL01 || getPlaceholder("emailL01")} />
        </div>
        <Textarea value={values.emailL01} onChange={(e) => onChange("emailL01", e.target.value)} placeholder={getPlaceholder("emailL01")} rows={4} className="whitespace-pre-wrap" />
      </div>
    </>
  );
}
