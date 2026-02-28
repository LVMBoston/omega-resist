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
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Loader2, Check, SkipForward } from "lucide-react";
import ChapterForm from "@/components/ChapterForm";

const codeSchema = z
  .string()
  .min(1, "Code is required")
  .regex(/^[a-z0-9_-]+$/, "Only lowercase a-z, 0-9, hyphens, underscores");

interface CampaignWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (campaignId: string) => void;
}

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

      // Insert campaign
      const { data: newCampaign, error: campError } = await supabase
        .from("campaigns")
        .insert({ code, title, description: description || null, campaign_type: "samizdat" })
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
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
              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!canAdvanceStep1}>
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
              <div>
                <Label className="text-xs">SMS L00 Template</Label>
                <Textarea
                  value={overrides.smsL00}
                  onChange={(e) => setOverrides({ ...overrides, smsL00: e.target.value })}
                  placeholder={globalDefaults.smsL00 || "Global default"}
                  rows={3}
                />
              </div>
              <div>
                <Label className="text-xs">SMS L01 Template</Label>
                <Textarea
                  value={overrides.smsL01}
                  onChange={(e) => setOverrides({ ...overrides, smsL01: e.target.value })}
                  placeholder={globalDefaults.smsL01 || "Global default"}
                  rows={3}
                />
              </div>
              <div>
                <Label className="text-xs">Email L00 Body</Label>
                <Textarea
                  value={overrides.emailL00}
                  onChange={(e) => setOverrides({ ...overrides, emailL00: e.target.value })}
                  placeholder={globalDefaults.emailL00 || "Global default"}
                  rows={3}
                />
              </div>
              <div>
                <Label className="text-xs">Email L01 Body</Label>
                <Textarea
                  value={overrides.emailL01}
                  onChange={(e) => setOverrides({ ...overrides, emailL01: e.target.value })}
                  placeholder={globalDefaults.emailL01 || "Global default"}
                  rows={3}
                />
              </div>
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
    </Dialog>
  );
}
