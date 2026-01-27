import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Image, RefreshCw, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface CampaignSnapshotSettingsProps {
  campaignId: string;
  campaignCode: string;
}

interface StatsTemplate {
  id: string;
  name: string | null;
  slug: string;
  cached_snapshot_path: string | null;
  snapshot_rendered_at: string | null;
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
  
  // Green if < interval, Yellow if < 2x interval, Red if > 2x interval
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

export function CampaignSnapshotSettings({ campaignId, campaignCode }: CampaignSnapshotSettingsProps) {
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

  // Fetch stats_page templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["stats-templates-for-campaign"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("viral_slide_configs")
        .select("id, name, slug, cached_snapshot_path, snapshot_rendered_at")
        .eq("template_type", "stats_page")
        .order("name");
      if (error) throw error;
      return data as StatsTemplate[];
    },
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

  // Render all templates
  const handleRenderAll = async () => {
    for (const template of templates) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-5 h-5" />
          Server-Side Rendering
        </CardTitle>
        <CardDescription>
          Pre-render stats pages as static images for reliable display on iOS and faster loading.
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
              disabled={templates.length === 0 || renderingTemplates.size > 0}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Render All
            </Button>
          </div>

          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No data templates found. Create one in the Interactive Templates section.
            </p>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{template.name || template.slug}</p>
                    <SnapshotStatusBadge
                      renderedAt={template.snapshot_rendered_at}
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
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
