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
  const activeTab = searchParams.get("tab") || "manage-events";

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
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-2">
            Manage events/actions for: {campaign?.title || "Campaign"}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <Link to="/campaign-config">
            <Button variant="outline" size="default">
              Campaign Orchestration
            </Button>
          </Link>
          
          <div className="flex-1">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <div className="flex flex-col gap-2">
                <span className="text-lg font-semibold text-destructive">Manage Events/Actions</span>
                <TabsList className="w-fit">
                  <TabsTrigger value="manage-events">Manage events</TabsTrigger>
                  <TabsTrigger value="manage-actions">Manage actions</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="manage-events" className="mt-6">
                <CampaignEoaManager />
              </TabsContent>

              <TabsContent value="manage-actions" className="mt-6">
                <div className="text-center py-8 text-muted-foreground">
                  Manage actions content coming soon
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <Button variant="outline" size="default" className="text-muted-foreground">
            Campaign Config
          </Button>
        </div>
      </main>
    </div>
  );
}
