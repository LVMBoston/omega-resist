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
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/campaign-config">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Campaigns
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">Campaign Details</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="events">Event Manager</TabsTrigger>
            <TabsTrigger value="config">Campaign Config</TabsTrigger>
          </TabsList>

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
