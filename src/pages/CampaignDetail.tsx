import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import CampaignEoaManager from "./CampaignEoaManager";
import CampaignDashboard from "./CampaignDashboard";
import CampaignChapters from "@/components/CampaignChapters";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface CampaignStats {
  realDataRows: number;
  simDataRows: number;
  l0Count: number;
  l1Count: number;
  l2Count: number;
  l3Count: number;
  l3PlusCount: number;
  earliestActive: string | null;
  latestActive: string | null;
}

export default function CampaignDetail() {
  const { campaignId } = useParams();
  const [activeView, setActiveView] = useState<"events" | "config" | "chapters">("events");

  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ["campaign-detail", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });

  const { data: eoaCount } = useQuery({
    queryKey: ["campaign-eoa-count", campaignId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("events_actions")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId!);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!campaignId,
  });

  const { data: stats } = useQuery({
    queryKey: ["campaign-detail-stats", campaign?.code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_campaign_stats", {
        campaign_codes: [campaign!.code],
      });
      if (error) throw error;
      if (!data || data.length === 0) return null;
      const row = data[0];
      return {
        realDataRows: row.real_data_rows,
        simDataRows: row.sim_data_rows,
        l0Count: row.l0_count,
        l1Count: row.l1_count,
        l2Count: row.l2_count,
        l3Count: row.l3_count,
        l3PlusCount: row.l3_plus_count,
        earliestActive: row.earliest_active,
        latestActive: row.latest_active,
      } as CampaignStats;
    },
    enabled: !!campaign?.code,
  });

  const formatDateWithTime = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  };

  if (campaignLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/campaign-config">Campaign Orchestration</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{campaign?.title || "Campaign"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Campaign summary card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{campaign?.title || "Campaign"}</CardTitle>
                <CardDescription>utm_campaign: {campaign?.code}</CardDescription>
              </div>
              <Badge variant="outline" className="text-sm">
                {eoaCount ?? 0} EoA{eoaCount !== 1 ? "s" : ""}
              </Badge>
            </div>
            {campaign?.description && (
              <p className="text-sm text-muted-foreground mt-2">{campaign.description}</p>
            )}
          </CardHeader>
          {stats && (
            <CardContent>
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Data Rows: Real / Sim</p>
                    <p className="font-semibold text-lg">
                      {`${stats.realDataRows.toLocaleString()} / ${stats.simDataRows.toLocaleString()}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Viral Depth: L0 / L1 / L2 / L3+</p>
                    <p className="font-semibold text-lg">
                      {`${stats.l0Count.toLocaleString()} / ${stats.l1Count.toLocaleString()} / ${stats.l2Count.toLocaleString()} / ${stats.l3PlusCount.toLocaleString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="text-muted-foreground">Earliest Active</p>
                    <p className="font-medium">{formatDateWithTime(stats.earliestActive)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Latest Active</p>
                    <p className="font-medium">{formatDateWithTime(stats.latestActive)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Navigation tabs */}
        <div className="flex items-center gap-2 mb-6">
          <Link to="/campaign-config">
            <Button variant="outline" size="default">
              Campaign Orchestration
            </Button>
          </Link>
          <Button
            variant={activeView === "events" ? "default" : "outline"}
            onClick={() => setActiveView("events")}
          >
            Manage Events/Actions
          </Button>
          <Button
            variant={activeView === "chapters" ? "default" : "outline"}
            onClick={() => setActiveView("chapters")}
          >
            Chapters
          </Button>
          <Button
            variant={activeView === "config" ? "default" : "outline"}
            onClick={() => setActiveView("config")}
          >
            Campaign Config
          </Button>
        </div>

        {activeView === "events" && <CampaignEoaManager />}
        {activeView === "chapters" && campaignId && <CampaignChapters campaignId={campaignId} />}
        {activeView === "config" && <CampaignDashboard campaignId={campaignId} />}
      </main>
    </div>
  );
}
