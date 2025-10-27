import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import CampaignEoaManager from "./CampaignEoaManager";
import CampaignDashboard from "./CampaignDashboard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export default function CampaignDetail() {
  const { campaignId } = useParams();
  const [activeView, setActiveView] = useState<"events" | "config">("events");

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

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-2">
            Create Event/Action for Campaign: {campaign?.title || "Campaign"}
          </h1>
        </div>

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
            variant={activeView === "config" ? "default" : "outline"}
            onClick={() => setActiveView("config")}
          >
            Campaign Config
          </Button>
        </div>

        {activeView === "events" && <CampaignEoaManager />}
        {activeView === "config" && <CampaignDashboard campaignId={campaignId} />}
      </main>
    </div>
  );
}
