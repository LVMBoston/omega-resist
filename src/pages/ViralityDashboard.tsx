import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getViralCoefficient,
  getConversionFunnel,
  getAmplificationByLevel,
  getEngagementByLevel,
  getViralCycleTime,
  getTopPerformingContent,
} from "@/lib/virality/analytics";
import { MetricCard } from "@/components/virality/MetricCard";
import { ViralCoefficientChart } from "@/components/virality/ViralCoefficientChart";
import { ConversionFunnelChart } from "@/components/virality/ConversionFunnelChart";
import { AmplificationChart } from "@/components/virality/AmplificationChart";
import { EngagementByLevelChart } from "@/components/virality/EngagementByLevelChart";
import { ContentPerformanceTable } from "@/components/virality/ContentPerformanceTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export default function ViralityDashboard() {
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");

  // Fetch campaigns
  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, code, title")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Set initial campaign
  if (!selectedCampaign && campaigns && campaigns.length > 0) {
    setSelectedCampaign(campaigns[0].code);
  }

  // Fetch analytics data
  const { data: viralCoefficient, isLoading: vcLoading } = useQuery({
    queryKey: ["viralCoefficient", selectedCampaign],
    queryFn: () => getViralCoefficient(selectedCampaign),
    enabled: !!selectedCampaign,
  });

  const { data: funnelData, isLoading: funnelLoading } = useQuery({
    queryKey: ["conversionFunnel", selectedCampaign],
    queryFn: () => getConversionFunnel(selectedCampaign),
    enabled: !!selectedCampaign,
  });

  const { data: amplificationData, isLoading: ampLoading } = useQuery({
    queryKey: ["amplification", selectedCampaign],
    queryFn: () => getAmplificationByLevel(selectedCampaign),
    enabled: !!selectedCampaign,
  });

  const { data: engagementData, isLoading: engLoading } = useQuery({
    queryKey: ["engagement", selectedCampaign],
    queryFn: () => getEngagementByLevel(selectedCampaign),
    enabled: !!selectedCampaign,
  });

  const { data: cycleTimeData } = useQuery({
    queryKey: ["cycleTime", selectedCampaign],
    queryFn: () => getViralCycleTime(selectedCampaign),
    enabled: !!selectedCampaign,
  });

  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: ["contentPerformance", selectedCampaign],
    queryFn: () => getTopPerformingContent(selectedCampaign),
    enabled: !!selectedCampaign,
  });

  const isLoading =
    campaignsLoading || vcLoading || funnelLoading || ampLoading || engLoading || contentLoading;

  if (campaignsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const avgCycleTime =
    cycleTimeData && cycleTimeData.length > 0
      ? cycleTimeData.reduce((sum, ct) => sum + ct.avg_hours, 0) / cycleTimeData.length
      : 0;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold">Virality Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            GA4-style metrics for measuring viral growth and engagement
          </p>

          {/* Campaign Selector */}
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select campaign" />
            </SelectTrigger>
            <SelectContent>
              {campaigns?.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.code}>
                  {campaign.title} ({campaign.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <>
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Viral Coefficient"
                value={viralCoefficient?.k_factor.toFixed(3) || "0"}
                description="Average new users per existing user"
                status={
                  (viralCoefficient?.k_factor || 0) >= 1
                    ? "good"
                    : (viralCoefficient?.k_factor || 0) >= 0.7
                    ? "warning"
                    : "bad"
                }
              />
              <MetricCard
                title="Share Rate"
                value={(funnelData?.view_to_share_rate || 0).toFixed(1)}
                format="percentage"
                description="Percentage of viewers who share"
                status={
                  (funnelData?.view_to_share_rate || 0) >= 10
                    ? "good"
                    : (funnelData?.view_to_share_rate || 0) >= 5
                    ? "warning"
                    : "neutral"
                }
              />
              <MetricCard
                title="Avg Cycle Time"
                value={avgCycleTime.toFixed(1)}
                format="time"
                description="Average time between sharing levels"
              />
              <MetricCard
                title="Total Reach"
                value={viralCoefficient?.unique_tokens || 0}
                description="Unique tokens created"
              />
            </div>

            {/* Tabbed Content */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="funnel">Funnel</TabsTrigger>
                <TabsTrigger value="levels">Levels</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {viralCoefficient && (
                    <ViralCoefficientChart kFactor={viralCoefficient.k_factor} />
                  )}
                  {amplificationData && <AmplificationChart data={amplificationData} />}
                </div>
              </TabsContent>

              <TabsContent value="funnel" className="space-y-4">
                {funnelData && <ConversionFunnelChart data={funnelData} />}
              </TabsContent>

              <TabsContent value="levels" className="space-y-4">
                {engagementData && <EngagementByLevelChart data={engagementData} />}
              </TabsContent>

              <TabsContent value="content" className="space-y-4">
                {contentData && <ContentPerformanceTable data={contentData} />}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
