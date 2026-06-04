import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Loader2, SkipForward, Sparkles } from "lucide-react";
import ChapterForm from "@/components/ChapterForm";
import CampaignBriefWizard, { type CampaignBrief, type Tone as BriefTone } from "@/components/CampaignBriefWizard";

const codeSchema = z
  .string()
  .min(1, "Code is required")
  .regex(/^[a-z0-9_-]+$/, "Only lowercase a-z, 0-9, hyphens, underscores");

interface CampaignWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (campaignId: string) => void;
}

type FieldKey = "smsL00" | "smsL01" | "emailL00" | "emailL01";
type Tone = "urgent" | "informative" | "hopeful" | "defiant";

const FIELD_META: Record<FieldKey, { channel: "sms" | "email"; level: "l00" | "l01"; label: string }> = {
  smsL00: { channel: "sms", level: "l00", label: "SMS L00 Template" },
  smsL01: { channel: "sms", level: "l01", label: "SMS L01 Template" },
  emailL00: { channel: "email", level: "l00", label: "Email L00 Body" },
  emailL01: { channel: "email", level: "l01", label: "Email L01 Body" },
};

export default function CampaignWizard({ open, onOpenChange, onSuccess }: CampaignWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);

  // Step 1: Identity
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [codeError, setCodeError] = useState("");

  // Step 2: Campaign-level messaging overrides
  const [overrides, setOverrides] = useState({
    emailL00: "",
    emailL01: "",
    smsL00: "",
    smsL01: "",
  });

  // AI drafting state
  const [tone, setTone] = useState<Tone>("informative");
  const [generatingField, setGeneratingField] = useState<FieldKey | null>(null);
  const [pendingOverwrite, setPendingOverwrite] = useState<FieldKey | null>(null);

  // Structured campaign brief
  const [brief, setBrief] = useState<CampaignBrief>({ tone: "informative" });

  // Global defaults for placeholders
  const [globalDefaults, setGlobalDefaults] = useState({
    emailL00: "",
    emailL01: "",
    smsL00: "",
    smsL01: "",
  });

  useEffect(() => {
    if (open) {
      // Reset state
      setStep(1);
      setCode("");
      setTitle("");
      setDescription("");
      setCodeError("");
      setOverrides({ emailL00: "", emailL01: "", smsL00: "", smsL01: "" });
      setCreatedCampaignId(null);
      setCreating(false);
      setTone("informative");
      setBrief({ tone: "informative" });
      setGeneratingField(null);
      setPendingOverwrite(null);
      fetchGlobalDefaults();
    }
  }, [open]);

  const fetchGlobalDefaults = async () => {
    const { data } = await supabase
      .from("settings")
      .select("category, key, value")
      .in("category", ["email", "sms"])
      .in("key", ["l00_template", "l01_template"]);

    if (data) {
      const defaults = { emailL00: "", emailL01: "", smsL00: "", smsL01: "" };
      for (const row of data) {
        const val = row.value as any;
        const body = val?.body || "";
        if (row.category === "email" && row.key === "l00_template") defaults.emailL00 = body;
        if (row.category === "email" && row.key === "l01_template") defaults.emailL01 = body;
        if (row.category === "sms" && row.key === "l00_template") defaults.smsL00 = body;
        if (row.category === "sms" && row.key === "l01_template") defaults.smsL01 = body;
      }
      setGlobalDefaults(defaults);
    }
  };

  const handleCodeChange = (value: string) => {
    setCode(value);
    if (value) {
      const result = codeSchema.safeParse(value);
      setCodeError(result.success ? "" : result.error.errors[0].message);
    } else {
      setCodeError("");
    }
  };

  const canAdvanceStep1 = code.trim() && title.trim() && !codeError;
  const canGenerate = title.trim().length > 0 && description.trim().length > 0;

  const runGenerate = async (field: FieldKey) => {
    setGeneratingField(field);
    try {
      const meta = FIELD_META[field];
      const { data, error } = await supabase.functions.invoke("draft-campaign-message", {
        body: {
          campaignTitle: title,
          campaignDescription: description,
          tone,
          channel: meta.channel,
          level: meta.level,
          brief,
        },
      });

      if (error) {
        // Supabase wraps non-2xx into error; try to read status from context
        const ctx = (error as any).context;
        const status = ctx?.status;
        let message = "Couldn't generate message. Please try again.";
        if (status === 429) message = "Too many requests — please wait a moment and try again.";
        else if (status === 402) message = "AI credits exhausted. Add credits in workspace settings.";
        toast({ variant: "destructive", title: "Generation failed", description: message });
        return;
      }

      const text = (data as any)?.text as string | undefined;
      if (!text) {
        toast({ variant: "destructive", title: "Generation failed", description: "Empty response. Please try again." });
        return;
      }

      setOverrides((prev) => ({ ...prev, [field]: text }));
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: e?.message || "Unexpected error. Please try again.",
      });
    } finally {
      setGeneratingField(null);
    }
  };

  const handleGenerateClick = (field: FieldKey) => {
    if (overrides[field].trim().length > 0) {
      setPendingOverwrite(field);
      return;
    }
    runGenerate(field);
  };

  const renderGenerateButton = (field: FieldKey) => {
    const isBusy = generatingField === field;
    const disabled = !canGenerate || generatingField !== null;
    const btn = (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={disabled}
        onClick={() => handleGenerateClick(field)}
      >
        {isBusy ? (
          <>
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="mr-1 h-3 w-3" />
            Generate
          </>
        )}
      </Button>
    );
    if (canGenerate) return btn;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild><span>{btn}</span></TooltipTrigger>
          <TooltipContent>Add a campaign name and description in Step 1 first.</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const handleFinish = async (addChapter: boolean) => {
    if (addChapter) {
      // Will be handled by ChapterForm's onSuccess
      return;
    }
    await createCampaign();
  };

  const createCampaign = async (): Promise<string | null> => {
    setCreating(true);
    try {
      // Check for duplicate code
      const { data: existing } = await supabase
        .from("campaigns")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (existing) {
        setCodeError("A campaign with this code already exists");
        setStep(1);
        setCreating(false);
        return null;
      }

      // Only include brief if user entered any data
      const hasBriefData = Object.entries(brief).some(([k, v]) => {
        if (k === "tone") return false; // tone alone doesn't count
        if (Array.isArray(v)) return v.some((x) => x && x.trim());
        return typeof v === "string" && v.trim().length > 0;
      });
      const briefPayload = hasBriefData ? brief : null;

      // Insert campaign
      const { data: newCampaign, error: campError } = await supabase
        .from("campaigns")
        .insert({ code, title, description: description || null, campaign_type: "samizdat", brief: briefPayload as any })
        .select()
        .single();
      if (campError) throw campError;

      const campaignId = newCampaign.id;

      // Insert campaign-level messaging overrides
      const overrideRows: any[] = [];
      if (overrides.smsL00.trim()) overrideRows.push({ campaign_id: campaignId, mobilize_code: null, category: "sms", key: "l00_template", value: { body: overrides.smsL00 } });
      if (overrides.smsL01.trim()) overrideRows.push({ campaign_id: campaignId, mobilize_code: null, category: "sms", key: "l01_template", value: { body: overrides.smsL01 } });
      if (overrides.emailL00.trim()) overrideRows.push({ campaign_id: campaignId, mobilize_code: null, category: "email", key: "l00_template", value: { subject: "", body: overrides.emailL00 } });
      if (overrides.emailL01.trim()) overrideRows.push({ campaign_id: campaignId, mobilize_code: null, category: "email", key: "l01_template", value: { subject: "", body: overrides.emailL01 } });

      if (overrideRows.length > 0) {
        const { error: overrideError } = await supabase.from("campaign_message_overrides").insert(overrideRows);
        if (overrideError) console.error("Override insert error:", overrideError);
      }

      setCreatedCampaignId(campaignId);
      return campaignId;
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return null;
    } finally {
      setCreating(false);
    }
  };

  const handleSkipStep3 = async () => {
    if (!createdCampaignId) {
      const id = await createCampaign();
      if (id) {
        toast({ title: "Success", description: "Campaign created successfully" });
        onSuccess(id);
        onOpenChange(false);
      }
    } else {
      toast({ title: "Success", description: "Campaign created successfully" });
      onSuccess(createdCampaignId);
      onOpenChange(false);
    }
  };

  const handleAdvanceToStep3 = async () => {
    // Create campaign now so ChapterForm can reference its ID
    if (!createdCampaignId) {
      const id = await createCampaign();
      if (id) {
        setStep(3);
      }
    } else {
      setStep(3);
    }
  };

  const handleChapterSuccess = () => {
    toast({ title: "Success", description: "Campaign and first chapter created" });
    onSuccess(createdCampaignId!);
    onOpenChange(false);
  };

  const stepLabels = ["Identity", "Messaging", "First Chapter"];

  const renderField = (field: FieldKey) => {
    const meta = FIELD_META[field];
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs">{meta.label}</Label>
          {renderGenerateButton(field)}
        </div>
        <Textarea
          value={overrides[field]}
          onChange={(e) => setOverrides({ ...overrides, [field]: e.target.value })}
          placeholder={globalDefaults[field] || "Global default"}
          rows={3}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Campaign — Step {step} of 3</DialogTitle>
          <DialogDescription>{stepLabels[step - 1]}</DialogDescription>
        </DialogHeader>

        <Progress value={(step / 3) * 100} className="h-1" />

        <div className="flex-1 overflow-y-auto py-4">
          {/* Step 1: Identity */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Campaign Name <span className="text-destructive">*</span></Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., No Kings Nationwide Protests" />
              </div>
              <div>
                <Label>Campaign Code <span className="text-destructive">*</span></Label>
                <Input
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="e.g., no-kings"
                  className={codeError ? "border-destructive" : ""}
                />
                {codeError && <p className="text-sm text-destructive mt-1">{codeError}</p>}
                <p className="text-xs text-muted-foreground mt-1">Only lowercase a-z, 0-9, "-", "_". Cannot be changed once tokens exist.</p>
              </div>
              <div className="space-y-2">
                <Label>Campaign Brief & Description</Label>
                <p className="text-xs text-muted-foreground">
                  Build a structured brief. Each field has an AI <span className="font-medium">Suggest</span> button. The brief feeds AI message drafts, narratives, and reports.
                </p>
                <CampaignBriefWizard
                  campaignTitle={title}
                  onTitleChange={setTitle}
                  brief={brief}
                  onBriefChange={setBrief}
                  description={description}
                  onDescriptionChange={setDescription}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    // Use brief.tone as default for messaging step
                    if (brief.tone) setTone(brief.tone as Tone);
                    setStep(2);
                  }}
                  disabled={!canAdvanceStep1}
                >
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Campaign-level Messaging */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Optionally override the global message templates for this campaign. Leave blank to use global defaults. Use {"{{link}}"} for the share URL, {"{{city}}"}, {"{{state}}"}, {"{{site_name}}"} for geographic placeholders.
              </p>

              {/* Tone selector */}
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs">AI tone for generated drafts</Label>
                  <p className="text-[11px] text-muted-foreground">Applies when you click Generate next to any field.</p>
                </div>
                <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="informative">Informative</SelectItem>
                    <SelectItem value="hopeful">Hopeful</SelectItem>
                    <SelectItem value="defiant">Defiant</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {renderField("smsL00")}
              {renderField("smsL01")}
              {renderField("emailL00")}
              {renderField("emailL01")}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleAdvanceToStep3} disabled={creating}>
                    {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SkipForward className="mr-2 h-4 w-4" />}
                    Skip to Finish
                  </Button>
                  <Button onClick={handleAdvanceToStep3} disabled={creating}>
                    {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <>Next <ArrowRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Add First Chapter */}
          {step === 3 && createdCampaignId && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add your first chapter now, or skip and add chapters later from the Campaign Detail page.
              </p>
              <ChapterForm
                campaignId={createdCampaignId}
                messagingPlaceholders={{
                  smsL00: overrides.smsL00 || globalDefaults.smsL00,
                  smsL01: overrides.smsL01 || globalDefaults.smsL01,
                  emailL00: overrides.emailL00 || globalDefaults.emailL00,
                  emailL01: overrides.emailL01 || globalDefaults.emailL01,
                }}
                onSuccess={handleChapterSuccess}
                onCancel={handleSkipStep3}
              />
            </div>
          )}

          {step === 3 && !createdCampaignId && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </DialogContent>

      {/* Overwrite confirmation */}
      <AlertDialog
        open={pendingOverwrite !== null}
        onOpenChange={(o) => { if (!o) setPendingOverwrite(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This field already has content. Generating will replace it with a new AI draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const f = pendingOverwrite;
                setPendingOverwrite(null);
                if (f) runGenerate(f);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
