import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Image, RefreshCw, Clock, CheckCircle, AlertCircle, ExternalLink, Eye } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CampaignSnapshotSettingsProps {
  campaignId: string;
  campaignCode: string;
  campaignTitle?: string;
}

interface StatsTemplate {
  id: string;
  name: string | null;
  slug: string;
  cached_snapshot_path: string | null;
  snapshot_rendered_at: string | null;
}

interface TemplateContext {
  templateId: string;
  deckSlug: string;
  mobilizeCode: string;
  sampleToken: string | null;
  deckPosition: number | null;
}

const INTERVAL_OPTIONS = [
  { value: "1", label: "1 minute" },
  { value: "2", label: "2 minutes" },
  { value: "5", label: "5 minutes" },
  { value: "10", label: "10 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function SnapshotStatusBadge({ renderedAt, intervalMinutes }: { renderedAt: string | null; intervalMinutes: number }) {
  if (!renderedAt) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <AlertCircle className="w-3 h-3 mr-1" />
        Not rendered
      </Badge>
    );
  }

  const renderedDate = new Date(renderedAt);
  const now = new Date();
  const ageMinutes = (now.getTime() - renderedDate.getTime()) / (1000 * 60);
  
  const isFresh = ageMinutes < intervalMinutes;
  const isStale = ageMinutes >= intervalMinutes && ageMinutes < intervalMinutes * 2.5;
  
  if (isFresh) {
    return (
      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle className="w-3 h-3 mr-1" />
        {formatDistanceToNow(renderedDate, { addSuffix: true })}
      </Badge>
    );
  }
  
  if (isStale) {
    return (
      <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        <Clock className="w-3 h-3 mr-1" />
        {formatDistanceToNow(renderedDate, { addSuffix: true })}
      </Badge>
    );
  }
  
  return (
    <Badge variant="destructive">
      <AlertCircle className="w-3 h-3 mr-1" />
      {formatDistanceToNow(renderedDate, { addSuffix: true })}
    </Badge>
  );
}

function TemplateDiagnostics({ templateId, campaignCode, campaignTitle, context, template, renderedAt }: { templateId: string; campaignCode: string; campaignTitle?: string; context: TemplateContext | undefined; template: StatsTemplate; renderedAt: string | null }) {
  const pngUrl = `${SUPABASE_URL}/storage/v1/object/public/slide-snapshots/${templateId}/snapshot-${campaignCode}.svg`;
  const [previewOpen, setPreviewOpen] = useState(false);
  const displayName = campaignTitle || campaignCode;
  const templateLabel = template.name || template.slug || "Not Linked";
  const deckSlideLabel = context
    ? `${context.deckSlug}${context.deckPosition != null ? ` / Slide ${context.deckPosition}` : ""}`
    : "—";
  const lastSavedLabel = renderedAt
    ? `${new Date(renderedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })} (local time)`
    : "Never";

  const metaLines = (
    <div className="text-xs space-y-0.5">
      <p><span className="font-semibold">Campaign:</span> {displayName}</p>
      <p><span className="font-semibold">Deck:</span> {deckSlideLabel}</p>
      <p><span className="font-semibold">Linked to template:</span> {templateLabel}</p>
      <p><span className="font-semibold">Last saved:</span> {lastSavedLabel}</p>
    </div>
  );

  return (
    <div className="mt-2 space-y-2 text-xs text-muted-foreground border-t pt-2">
      {metaLines}
      {context && (
        <p><span className="font-medium">viralToken:</span> {context.sampleToken ?? "none found"}</p>
      )}
      {!context && (
        <p className="italic">No deck linkage found for this campaign</p>
      )}
      <p className="inline-flex items-center gap-3 flex-wrap">
        <span className="font-medium">Snapshot:</span>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="text-primary hover:underline inline-flex items-center gap-1"
        >
          <Eye className="w-3 h-3" /> Preview
        </button>
        <a
          href={pngUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="text-primary hover:underline inline-flex items-center gap-1"
        >
          Download <ExternalLink className="w-3 h-3" />
        </a>
      </p>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Snapshot preview — {displayName}</DialogTitle>
          </DialogHeader>
          <div className="pb-2 border-b">{metaLines}</div>
          <div className="w-full overflow-auto bg-muted/30 rounded-md">
            {/* Rendered via <img> so Supabase's Content-Disposition: attachment and sandbox CSP on public SVGs don't apply */}
            <img
              src={pngUrl}
              alt={`Snapshot for ${displayName}`}
              className="w-full h-auto block"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CampaignSnapshotSettings({ campaignId, campaignCode, campaignTitle }: CampaignSnapshotSettingsProps) {
  const queryClient = useQueryClient();
  const [renderingTemplates, setRenderingTemplates] = useState<Set<string>>(new Set());

  // Fetch campaign settings
  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ["campaign-snapshot-settings", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, snapshot_enabled, snapshot_interval_minutes")
        .eq("id", campaignId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch stats_page + hybrid templates (both render via the SSR pipeline)
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["stats-templates-for-campaign"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("viral_slide_configs")
        .select("id, name, slug, cached_snapshot_path, snapshot_rendered_at")
        .in("template_type", ["stats_page", "hybrid"])
        .order("name");

      if (error) throw error;
      return data as StatsTemplate[];
    },
  });

  // Fetch per-campaign snapshot file ages from storage
  const { data: snapshotAges } = useQuery({
    queryKey: ["snapshot-file-ages", campaignCode, templates.map(t => t.id)],
    queryFn: async (): Promise<Record<string, string | null>> => {
      if (templates.length === 0) return {};
      const ages: Record<string, string | null> = {};
      
      await Promise.all(templates.map(async (template) => {
        const { data: files } = await supabase.storage
          .from("slide-snapshots")
          .list(template.id, { search: `snapshot-${campaignCode}.svg` });
        
        const file = files?.find(f => f.name === `snapshot-${campaignCode}.svg`);
        ages[template.id] = file?.updated_at ?? null;
      }));
      
      return ages;
    },
    enabled: templates.length > 0,
    staleTime: 30000,
  });

  // Fetch per-template campaign context (deck linkage + sample token)
  const { data: templateContexts } = useQuery({
    queryKey: ["template-campaign-context", campaignCode, templates.map(t => t.id)],
    queryFn: async (): Promise<Record<string, TemplateContext>> => {
      if (templates.length === 0) return {};

      const templateIds = templates.map(t => t.id);

      // Get slide_items for these templates to find deck_slugs.
      // Exclude skip_deploy slides — they are not part of the deployed deck
      // and must not appear in the SSR list.
      const { data: slideItems, error: siErr } = await supabase
        .from("slide_items")
        .select("template_id, deck_slug, position")
        .in("template_id", templateIds)
        .eq("skip_deploy", false);
      if (siErr) throw siErr;
      if (!slideItems || slideItems.length === 0) return {};

      // Build template -> [{deck_slug, position}] map (a template can be in multiple decks)
      const templateDeckMap: Record<string, { deckSlug: string; position: number }[]> = {};
      for (const si of slideItems) {
        if (si.template_id) {
          if (!templateDeckMap[si.template_id]) templateDeckMap[si.template_id] = [];
          if (!templateDeckMap[si.template_id].some(d => d.deckSlug === si.deck_slug)) {
            templateDeckMap[si.template_id].push({ deckSlug: si.deck_slug, position: si.position });
          }
        }
      }

      const deckSlugs = [...new Set(Object.values(templateDeckMap).flat().map(d => d.deckSlug))];

      // Get events_actions for these deck_slugs filtered by this campaign
      const { data: eoas, error: eoaErr } = await supabase
        .from("events_actions")
        .select("assigned_deck_slug, mobilize_code, campaign_id")
        .in("assigned_deck_slug", deckSlugs)
        .eq("campaign_id", campaignId);
      if (eoaErr) throw eoaErr;

      // Build deck_slug -> mobilize_code map
      const deckMobilizeMap: Record<string, string> = {};
      for (const eoa of eoas || []) {
        if (eoa.assigned_deck_slug && eoa.mobilize_code) {
          deckMobilizeMap[eoa.assigned_deck_slug] = eoa.mobilize_code;
        }
      }

      // Collect all resolved mobilize_codes for token lookup
      const allMobilizeCodes = [...new Set(Object.values(deckMobilizeMap))];

      // Get sample L00 tokens keyed by mobilize_code (token pattern: l00-{mobilize_code}-...)
      const mobilizeTokenMap: Record<string, string> = {};
      if (allMobilizeCodes.length > 0) {
        const { data: tokens, error: tokErr } = await supabase
          .from("tokens")
          .select("token")
          .eq("utm_campaign", campaignCode)
          .eq("level", 0)
          .is("deleted_at", null)
          .limit(50);
        if (tokErr) throw tokErr;

        for (const t of tokens || []) {
          const match = t.token.match(/^l00-([^-]+)-/);
          if (match) {
            const mc = match[1];
            if (!mobilizeTokenMap[mc]) mobilizeTokenMap[mc] = t.token;
          }
        }
      }

      // Fallback: any campaign token if mobilize-specific lookup fails
      let fallbackToken: string | null = null;
      if (Object.keys(mobilizeTokenMap).length === 0) {
        const { data: fb } = await supabase
          .from("tokens")
          .select("token")
          .eq("utm_campaign", campaignCode)
          .eq("level", 0)
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle();
        fallbackToken = fb?.token ?? null;
      }

      // Assemble per-template context
      const result: Record<string, TemplateContext> = {};
      for (const templateId of templateIds) {
        const decksForTemplate = templateDeckMap[templateId];
        if (!decksForTemplate) continue;
        // Find the first deck that has a matching EoA for this campaign
        for (const { deckSlug, position } of decksForTemplate) {
          const mobilizeCode = deckMobilizeMap[deckSlug];
          if (mobilizeCode) {
            result[templateId] = {
              templateId,
              deckSlug,
              mobilizeCode,
              sampleToken: mobilizeTokenMap[mobilizeCode] ?? fallbackToken,
              deckPosition: position,
            };
            break;
          }
        }
      }
      return result;
    },
    enabled: templates.length > 0,
    staleTime: 30000,
  });

  // Update campaign settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: { snapshot_enabled?: boolean; snapshot_interval_minutes?: number }) => {
      const { error } = await supabase
        .from("campaigns")
        .update(updates)
        .eq("id", campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-snapshot-settings", campaignId] });
      toast.success("Settings updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Render snapshot mutation
  const renderSnapshotMutation = useMutation({
    mutationFn: async (templateId: string) => {
      setRenderingTemplates(prev => new Set(prev).add(templateId));
      
      const response = await supabase.functions.invoke("render-stats-snapshot", {
        body: { template_id: templateId, campaign_code: campaignCode },
      });
      
      if (response.error) {
        throw new Error(response.error.message || "Render failed");
      }
      
      return response.data;
    },
    onSuccess: (data, templateId) => {
      setRenderingTemplates(prev => {
        const next = new Set(prev);
        next.delete(templateId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["stats-templates-for-campaign"] });
      queryClient.invalidateQueries({ queryKey: ["snapshot-file-ages"] });
      toast.success("Snapshot rendered successfully");
    },
    onError: (error: Error, templateId) => {
      setRenderingTemplates(prev => {
        const next = new Set(prev);
        next.delete(templateId);
        return next;
      });
      toast.error(`Render failed: ${error.message}`);
    },
  });

  // Render all templates: include any template that is either wired into a deck
  // for this campaign OR already has a snapshot file for this campaign in storage
  // (so orphan / previously-deployed snapshots stay current too).
  const handleRenderAll = async () => {
    const toRender = templates.filter(t =>
      Boolean(templateContexts?.[t.id]) || Boolean(snapshotAges?.[t.id])
    );
    for (const template of toRender) {
      await renderSnapshotMutation.mutateAsync(template.id);
    }
  };

  if (campaignLoading || templatesLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const snapshotEnabled = campaign?.snapshot_enabled ?? false;
  const intervalMinutes = campaign?.snapshot_interval_minutes ?? 2;

  // Only show templates actually linked to this campaign's decks, ordered by deck position
  const campaignTemplates = templateContexts
    ? templates
        .filter(t => templateContexts[t.id])
        .sort((a, b) => (templateContexts[a.id]?.deckPosition ?? 0) - (templateContexts[b.id]?.deckPosition ?? 0))
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-5 h-5" />
          Server-Side Rendering
        </CardTitle>
        <CardDescription>
          Pre-render stats pages as static images for reliable display on mobile devices and for faster loading.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="snapshot-enabled" className="text-base">Enable Server Rendering</Label>
            <p className="text-sm text-muted-foreground">
              When enabled, viewers see pre-rendered static images instead of live data.
            </p>
          </div>
          <Switch
            id="snapshot-enabled"
            checked={snapshotEnabled}
            onCheckedChange={(checked) => updateSettingsMutation.mutate({ snapshot_enabled: checked })}
          />
        </div>

        {/* Interval Selector */}
        <div className="space-y-2">
          <Label htmlFor="snapshot-interval">Refresh Interval</Label>
          <Select
            value={String(intervalMinutes)}
            onValueChange={(value) => updateSettingsMutation.mutate({ snapshot_interval_minutes: parseInt(value) })}
          >
            <SelectTrigger id="snapshot-interval" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVAL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            How often snapshots should be refreshed to show updated metrics.
          </p>
        </div>

        {/* Templates List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Data Templates</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRenderAll}
              disabled={campaignTemplates.length === 0 || renderingTemplates.size > 0}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Render All
            </Button>
          </div>

          {campaignTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No data templates linked to this campaign's decks.
            </p>
          ) : (
            <div className="space-y-2">
              {campaignTemplates.map((template) => (
                <div
                  key={template.id}
                  className="p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">
                        {templateContexts?.[template.id]?.deckPosition != null
                          ? `Slide ${templateContexts[template.id].deckPosition}`
                          : (template.name || template.slug)}
                      </p>
                      <SnapshotStatusBadge
                        renderedAt={snapshotAges?.[template.id] ?? null}
                        intervalMinutes={intervalMinutes}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => renderSnapshotMutation.mutate(template.id)}
                      disabled={renderingTemplates.has(template.id)}
                    >
                      {renderingTemplates.has(template.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span className="ml-1">Render</span>
                    </Button>
                  </div>
                  <TemplateDiagnostics
                    templateId={template.id}
                    campaignCode={campaignCode}
                    campaignTitle={campaignTitle}
                    context={templateContexts?.[template.id]}
                    template={template}
                    renderedAt={snapshotAges?.[template.id] ?? template.snapshot_rendered_at ?? null}
                  />

                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
