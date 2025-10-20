import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import CampaignDashboard from "./CampaignDashboard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function CampaignDetail() {
  const { campaignId } = useParams();

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
            Campaign Config: {campaign?.title || "Campaign"}
          </h1>
        </div>

        <div className="mb-6">
          <Link to="/campaign-config">
            <Button variant="outline" size="default">
              Campaign Orchestration
            </Button>
          </Link>
        </div>

        <CampaignDashboard campaignId={campaignId} />
      </main>
    </div>
  );
}
