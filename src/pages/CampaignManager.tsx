import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, ArrowLeft, Pencil } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
interface Campaign {
  id: string;
  code: string;
  title: string;
  description: string | null;
  created_at: string;
}

interface EventAction {
  id: string;
  campaign_id: string;
  type: string;
  start_date: string | null;
  end_date: string | null;
}

interface CampaignStats {
  activeEvents: number;
  activeActions: number;
  earliestActive: string | null;
  latestActive: string | null;
  totalEventsActions: number;
}

interface Placement {
  id: string;
  code: string;
  name: string;
  description: string | null;
  context: string | null;
}

const codeSchema = z.string()
  .min(1, "Code is required")
  .regex(/^[a-z0-9_-]+$/, "Code must contain only lowercase letters, numbers, hyphens, and underscores");

export default function CampaignManager() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [eoas, setEoas] = useState<EventAction[]>([]);
  const [campaignStats, setCampaignStats] = useState<Map<string, CampaignStats>>(new Map());
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const { userRole } = useAuth();
  const { toast } = useToast();

  // Campaign form state
  const [campaignForm, setCampaignForm] = useState({
    code: "",
    title: "",
    description: "",
  });

  // Placement form state
  const [placementForm, setPlacementForm] = useState({
    code: "",
    name: "",
    description: "",
    context: "",
  });

  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [placementDialogOpen, setPlacementDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [codeError, setCodeError] = useState<string>("");
  const [placementCodeError, setPlacementCodeError] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (campaigns.length > 0 || eoas.length > 0) {
      calculateCampaignStats();
    }
  }, [campaigns, eoas]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchCampaigns(), fetchEoas(), fetchPlacements()]);
    setLoading(false);
  };

  const fetchCampaigns = async () => {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch campaigns: " + error.message,
      });
    } else {
      setCampaigns(data || []);
    }
  };

  const fetchEoas = async () => {
    const { data, error } = await supabase
      .from("events_actions")
      .select("id, campaign_id, type, start_date, end_date")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch events/actions: " + error.message,
      });
    } else {
      setEoas(data || []);
    }
  };

  const calculateCampaignStats = () => {
    const stats = new Map<string, CampaignStats>();
    const now = new Date();
    
    campaigns.forEach((campaign) => {
      const campaignEoas = eoas.filter((e) => e.campaign_id === campaign.id);
      
      const activeEoas = campaignEoas.filter((eoa) => {
        if (!eoa.end_date) return true;
        const endDate = new Date(eoa.end_date);
        const cutoffDate = new Date(endDate);
        cutoffDate.setDate(cutoffDate.getDate() + 14);
        return now <= cutoffDate;
      });

      const activeEvents = activeEoas.filter((e) => e.type === "event").length;
      const activeActions = activeEoas.filter((e) => e.type === "action").length;
      
      const activeDates = activeEoas
        .map((e) => e.start_date)
        .filter((d): d is string => d !== null)
        .sort();
      
      stats.set(campaign.id, {
        activeEvents,
        activeActions,
        earliestActive: activeDates[0] || null,
        latestActive: activeDates[activeDates.length - 1] || null,
        totalEventsActions: campaignEoas.length,
      });
    });
    
    setCampaignStats(stats);
  };

  const fetchPlacements = async () => {
    const { data, error } = await supabase
      .from("placements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch placements: " + error.message,
      });
    } else {
      setPlacements(data || []);
    }
  };

  const createCampaign = async () => {
    if (!campaignForm.code || !campaignForm.title) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Code and title are required",
      });
      return;
    }

    const codeValidation = codeSchema.safeParse(campaignForm.code);
    if (!codeValidation.success) {
      toast({
        variant: "destructive",
        title: "Invalid code",
        description: codeValidation.error.errors[0].message,
      });
      return;
    }

    const { error } = await supabase.from("campaigns").insert([campaignForm]);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create campaign: " + error.message,
      });
    } else {
      toast({
        title: "Success",
        description: "Campaign created successfully",
      });
      setCampaignForm({ code: "", title: "", description: "" });
      setCampaignDialogOpen(false);
      fetchCampaigns();
      fetchEoas();
    }
  };

  const updateCampaign = async () => {
    if (!editingCampaign) return;
    
    if (!campaignForm.code || !campaignForm.title) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Code and title are required",
      });
      return;
    }

    const codeValidation = codeSchema.safeParse(campaignForm.code);
    if (!codeValidation.success) {
      toast({
        variant: "destructive",
        title: "Invalid code",
        description: codeValidation.error.errors[0].message,
      });
      return;
    }

    const { error } = await supabase
      .from("campaigns")
      .update(campaignForm)
      .eq("id", editingCampaign.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update campaign: " + error.message,
      });
    } else {
      toast({
        title: "Success",
        description: "Campaign updated successfully",
      });
      setCampaignForm({ code: "", title: "", description: "" });
      setEditingCampaign(null);
      setCampaignDialogOpen(false);
      fetchCampaigns();
      fetchEoas();
    }
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setCampaignForm({
      code: campaign.code,
      title: campaign.title,
      description: campaign.description || "",
    });
    setCampaignDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setCampaignDialogOpen(open);
    if (!open) {
      setEditingCampaign(null);
      setCampaignForm({ code: "", title: "", description: "" });
      setCodeError("");
    }
  };

  const handleCodeChange = (value: string) => {
    setCampaignForm({ ...campaignForm, code: value });
    const validation = codeSchema.safeParse(value);
    if (!validation.success && value) {
      setCodeError(validation.error.errors[0].message);
    } else {
      setCodeError("");
    }
  };

  const handlePlacementCodeChange = (value: string) => {
    setPlacementForm({ ...placementForm, code: value });
    const validation = codeSchema.safeParse(value);
    if (!validation.success && value) {
      setPlacementCodeError(validation.error.errors[0].message);
    } else {
      setPlacementCodeError("");
    }
  };

  const createPlacement = async () => {
    if (!placementForm.code || !placementForm.name) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Code and name are required",
      });
      return;
    }

    const codeValidation = codeSchema.safeParse(placementForm.code);
    if (!codeValidation.success) {
      toast({
        variant: "destructive",
        title: "Invalid code",
        description: codeValidation.error.errors[0].message,
      });
      return;
    }

    const { error } = await supabase.from("placements").insert([placementForm]);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create placement: " + error.message,
      });
    } else {
      toast({
        title: "Success",
        description: "Placement created successfully",
      });
      setPlacementForm({ code: "", name: "", description: "", context: "" });
      setPlacementDialogOpen(false);
      fetchPlacements();
    }
  };

  const deleteCampaign = async (id: string) => {
    const { error } = await supabase.from("campaigns").delete().eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete campaign: " + error.message,
      });
    } else {
      toast({
        title: "Success",
        description: "Campaign deleted",
      });
      fetchCampaigns();
      fetchEoas();
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Campaign Manager</h1>
              <p className="text-muted-foreground">
                Manage campaigns, events, actions, and placements
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="campaigns" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="placements">Placements</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Campaigns</h2>
              <Dialog open={campaignDialogOpen} onOpenChange={handleDialogClose}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Campaign
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingCampaign ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
                    <DialogDescription>
                      {editingCampaign 
                        ? "Update the campaign details." 
                        : "Add a new campaign to organize your events and actions."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Code *</Label>
                      <Input
                        value={campaignForm.code}
                        onChange={(e) => handleCodeChange(e.target.value)}
                        placeholder="e.g., 2024-election"
                        className={codeError ? "border-destructive" : ""}
                      />
                      {codeError && (
                        <p className="text-sm text-destructive mt-1">{codeError}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Only lowercase letters, numbers, hyphens, and underscores
                      </p>
                    </div>
                    <div>
                      <Label>Title *</Label>
                      <Input
                        value={campaignForm.title}
                        onChange={(e) =>
                          setCampaignForm({ ...campaignForm, title: e.target.value })
                        }
                        placeholder="e.g., 2024 Election Campaign"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={campaignForm.description}
                        onChange={(e) =>
                          setCampaignForm({ ...campaignForm, description: e.target.value })
                        }
                        placeholder="Optional description..."
                      />
                    </div>
                    <Button 
                      onClick={editingCampaign ? updateCampaign : createCampaign} 
                      className="w-full"
                    >
                      {editingCampaign ? "Update Campaign" : "Create Campaign"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((campaign) => {
                const stats = campaignStats.get(campaign.id);

                return (
                  <Card
                    key={campaign.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle>{campaign.title}</CardTitle>
                          <CardDescription>utm_campaign: {campaign.code}</CardDescription>
                          {campaign.description && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {campaign.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCampaign(campaign);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCampaign(campaign.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Active Events</p>
                          <p className="font-semibold text-lg">{stats?.activeEvents || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">UTM ID</p>
                          <p className="font-semibold text-lg">{campaign.code}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Active Actions</p>
                          <p className="font-semibold text-lg">{stats?.activeActions || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground"># of Events/Actions</p>
                          <p className="font-semibold text-lg">{stats?.totalEventsActions || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Earliest Active</p>
                          <p className="font-medium">{formatDate(stats?.earliestActive || null)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Latest Active</p>
                          <p className="font-medium">{formatDate(stats?.latestActive || null)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="placements" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Placements</h2>
              <Dialog open={placementDialogOpen} onOpenChange={setPlacementDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Placement
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Placement</DialogTitle>
                    <DialogDescription>
                      Add a new placement location for your materials.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Code *</Label>
                      <Input
                        value={placementForm.code}
                        onChange={(e) => handlePlacementCodeChange(e.target.value)}
                        placeholder="e.g., FLYER-01"
                        className={placementCodeError ? "border-destructive" : ""}
                      />
                      {placementCodeError && (
                        <p className="text-sm text-destructive mt-1">{placementCodeError}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Only lowercase letters, numbers, hyphens, and underscores
                      </p>
                    </div>
                    <div>
                      <Label>Name *</Label>
                      <Input
                        value={placementForm.name}
                        onChange={(e) =>
                          setPlacementForm({ ...placementForm, name: e.target.value })
                        }
                        placeholder="e.g., Main Street Flyer"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={placementForm.description}
                        onChange={(e) =>
                          setPlacementForm({
                            ...placementForm,
                            description: e.target.value,
                          })
                        }
                        placeholder="Optional description..."
                      />
                    </div>
                    <div>
                      <Label>Context</Label>
                      <Input
                        value={placementForm.context}
                        onChange={(e) =>
                          setPlacementForm({
                            ...placementForm,
                            context: e.target.value,
                          })
                        }
                        placeholder="e.g., Downtown area"
                      />
                    </div>
                    <Button onClick={createPlacement} className="w-full">
                      Create Placement
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {placements.map((placement) => (
                <Card key={placement.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{placement.name}</CardTitle>
                        <CardDescription>
                          Code: {placement.code}
                          {placement.context && ` | Context: ${placement.context}`}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  {placement.description && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {placement.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
