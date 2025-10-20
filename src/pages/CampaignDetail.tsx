import { useParams, useSearchParams, Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import CampaignEoaManager from "./CampaignEoaManager";
import CampaignDashboard from "./CampaignDashboard";

export default function CampaignDetail() {
  const { campaignId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "events";

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
          <h1 className="text-4xl font-bold mb-2">Campaign Details</h1>
          <p className="text-xl text-muted-foreground">Manage Events or Actions for: Campaign</p>
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
