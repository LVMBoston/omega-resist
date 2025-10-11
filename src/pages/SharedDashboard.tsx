import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Activity } from "lucide-react";
import { MetricCard } from "@/components/virality/MetricCard";
import { ViralCoefficientChart } from "@/components/virality/ViralCoefficientChart";
import { ConversionFunnelChart } from "@/components/virality/ConversionFunnelChart";
import { AmplificationChart } from "@/components/virality/AmplificationChart";
import { EngagementByLevelChart } from "@/components/virality/EngagementByLevelChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import {
  getViralCoefficient,
  getConversionFunnel,
  getAmplificationByLevel,
  getEngagementByLevel,
  getViralCycleTime,
} from "@/lib/virality/analytics";

export default function SharedDashboard() {
  const { shareCode } = useParams();
  const [loading, setLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaignTitle, setCampaignTitle] = useState<string>("");

  useEffect(() => {
    validateShare();
  }, [shareCode]);

  const validateShare = async () => {
    if (!shareCode) {
      setLoading(false);
      return;
    }

    try {
      // Validate share code
      const { data: share, error } = await supabase
        .from("dashboard_shares")
        .select(`
          campaign_id,
          is_active,
          expires_at,
          campaigns(title)
        `)
        .eq("share_code", shareCode)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (error || !share) {
        setIsValid(false);
        setLoading(false);
        return;
      }

      // Track view
      await supabase.rpc("increment_share_view", { share_code: shareCode });

      setCampaignId(share.campaign_id);
      setCampaignTitle(share.campaigns?.title || "Campaign");
      setIsValid(true);
    } catch (error) {
      console.error("Error validating share:", error);
      setIsValid(false);
    } finally {
      setLoading(false);
    }
  };

  const { data: viralCoeffData } = useQuery({
    queryKey: ["shared-viralCoeff", campaignId],
    queryFn: () => getViralCoefficient(campaignId!),
    enabled: isValid && !!campaignId,
  });

  const { data: funnelData } = useQuery({
    queryKey: ["shared-conversionFunnel", campaignId],
    queryFn: () => getConversionFunnel(campaignId!),
    enabled: isValid && !!campaignId,
  });

  const { data: amplificationData } = useQuery({
    queryKey: ["shared-amplification", campaignId],
    queryFn: () => getAmplificationByLevel(campaignId!),
    enabled: isValid && !!campaignId,
  });

  const { data: engagementData } = useQuery({
    queryKey: ["shared-engagement", campaignId],
    queryFn: () => getEngagementByLevel(campaignId!),
    enabled: isValid && !!campaignId,
  });

  const { data: cycleTimeData } = useQuery({
    queryKey: ["shared-cycleTime", campaignId],
    queryFn: () => getViralCycleTime(campaignId!),
    enabled: isValid && !!campaignId,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isValid || !campaignId) {
    return <Navigate to="/404" replace />;
  }

  const avgCycleTime = cycleTimeData?.avg_hours ? `${cycleTimeData.avg_hours.toFixed(1)}h` : "N/A";
  const viralCoeff = viralCoeffData?.[0]?.viral_coefficient || 0;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="w-8 h-8" />
            {campaignTitle} - Analytics Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Read-only view • Shared via secure link
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <MetricCard
            title="Viral Coefficient"
            value={viralCoeff}
            format="number"
            status={viralCoeff > 1 ? "good" : "warning"}
          />
          <MetricCard
            title="Avg Cycle Time"
            value={avgCycleTime}
            format="text"
            status="neutral"
          />
          <MetricCard
            title="Campaign Status"
            value="Active"
            format="text"
            status="good"
          />
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="funnel">Funnel</TabsTrigger>
            <TabsTrigger value="levels">Levels</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {viralCoeffData && <ViralCoefficientChart data={viralCoeffData} />}
          </TabsContent>

          <TabsContent value="funnel">
            {funnelData && <ConversionFunnelChart data={funnelData} />}
          </TabsContent>

          <TabsContent value="levels" className="space-y-6">
            {amplificationData && <AmplificationChart data={amplificationData} />}
            {engagementData && <EngagementByLevelChart data={engagementData} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}