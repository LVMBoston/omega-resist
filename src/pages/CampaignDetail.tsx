import { useParams, useSearchParams, Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import CampaignEoaManager from "./CampaignEoaManager";
import CampaignDashboard from "./CampaignDashboard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function CampaignDetail() {
  const { campaignId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "events";

  const { data: campaign } = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("title")
        .eq("id", campaignId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-8">
        <Link to="/campaign-config">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Campaigns
          </Button>
        </Link>

        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-2">
            Manage events/actions for: {campaign?.title || "Campaign"}
          </h1>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="flex items-center gap-2">
            <Link to="/campaign-config">
              <Button variant="outline" size="default">
                Campaign Orchestration
              </Button>
            </Link>
            <TabsList>
              <TabsTrigger value="events">Event Manager</TabsTrigger>
              <TabsTrigger value="config">Campaign Config</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="events" className="mt-6">
            <CampaignEoaManager />
          </TabsContent>

          <TabsContent value="config" className="mt-6">
            <CampaignDashboard campaignId={campaignId} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
