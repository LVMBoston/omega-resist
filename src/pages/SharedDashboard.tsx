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
      console.log("No share code provided");
      setLoading(false);
      return;
    }

    try {
      console.log("Validating share code:", shareCode);
      
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

      console.log("Share query result:", { share, error });

      if (error || !share) {
        console.error("Share validation failed:", error);
        setIsValid(false);
        setLoading(false);
        return;
      }

      // Track view - get current count first
      const { data: shareData } = await supabase
        .from("dashboard_shares")
        .select("view_count")
        .eq("share_code", shareCode)
        .single();

      if (shareData) {
        await supabase
          .from("dashboard_shares")
          .update({
            view_count: shareData.view_count + 1,
            last_viewed_at: new Date().toISOString(),
          })
          .eq("share_code", shareCode);
      }

      setCampaignId(share.campaign_id);
      setCampaignTitle((share as any).campaigns?.title || "Campaign");
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

  const avgCycleTime = cycleTimeData && cycleTimeData.length > 0
    ? cycleTimeData.reduce((sum, ct) => sum + ct.avg_hours, 0) / cycleTimeData.length
    : 0;
  const viralCoeff = viralCoeffData?.k_factor || 0;

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
            value={viralCoeff.toFixed(2)}
            status={viralCoeff > 1 ? "good" : "warning"}
          />
          <MetricCard
            title="Avg Cycle Time"
            value={avgCycleTime}
            format="time"
            status="neutral"
          />
          <MetricCard
            title="Campaign Status"
            value="Active"
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
            {viralCoeffData && <ViralCoefficientChart kFactor={viralCoeffData.k_factor} />}
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