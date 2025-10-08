import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit2, ArrowLeft, Package, Eye } from "lucide-react";
import EoaForm from "@/components/EoaForm";

interface Campaign {
  id: string;
  code: string;
  title: string;
}

interface EventAction {
  id: string;
  campaign_id: string;
  mobilize_id: string | null;
  utm_id: string;
  title: string;
  site_name: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  type: string;
  start_date: string | null;
  end_date: string | null;
  timezone: string | null;
  assigned_deck_slug: string | null;
  description: string | null;
}

export default function CampaignEoaManager() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const { toast } = useToast();
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [eoas, setEoas] = useState<EventAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEoa, setEditingEoa] = useState<EventAction | null>(null);
  const [payloadDialogOpen, setPayloadDialogOpen] = useState(false);

  useEffect(() => {
    if (campaignId) {
      fetchData();
    }
  }, [campaignId]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchCampaign(), fetchEoas()]);
    setLoading(false);
  };

  const fetchCampaign = async () => {
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, code, title")
      .eq("id", campaignId)
      .single();

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch campaign: " + error.message,
      });
      navigate("/campaigns");
    } else {
      setCampaign(data);
    }
  };

  const fetchEoas = async () => {
    const { data, error } = await supabase
      .from("events_actions")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("start_date", { ascending: true });

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

  const deleteEoa = async (id: string) => {
    const { error } = await supabase.from("events_actions").delete().eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete event/action: " + error.message,
      });
    } else {
      toast({
        title: "Success",
        description: "Event/Action deleted",
      });
      fetchEoas();
    }
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/campaigns">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Campaigns
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{campaign.title}</h1>
              <p className="text-muted-foreground">Campaign Code: {campaign.code}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                Event/Actions for {campaign.code}
              </CardTitle>
              <Button
                onClick={() => {
                  setEditingEoa(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Event/Action
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {eoas.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No events or actions yet. Click "Add Event/Action" to create one.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mobilize Code</TableHead>
                    <TableHead>Event/Action Name</TableHead>
                    <TableHead>Site Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Zip Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Start Date/Time</TableHead>
                    <TableHead>End Date/Time</TableHead>
                    <TableHead>Timezone</TableHead>
                    <TableHead>Assigned Deck</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eoas.map((eoa) => (
                    <TableRow key={eoa.id}>
                      <TableCell>{eoa.mobilize_id || "—"}</TableCell>
                      <TableCell className="font-medium">{eoa.title}</TableCell>
                      <TableCell>{eoa.site_name || "—"}</TableCell>
                      <TableCell>{eoa.city || "—"}</TableCell>
                      <TableCell>{eoa.state || "—"}</TableCell>
                      <TableCell>{eoa.zip_code || "—"}</TableCell>
                      <TableCell className="capitalize">{eoa.type}</TableCell>
                      <TableCell>{formatDateTime(eoa.start_date)}</TableCell>
                      <TableCell>{formatDateTime(eoa.end_date)}</TableCell>
                      <TableCell>{eoa.timezone || "TBD"}</TableCell>
                      <TableCell>{eoa.assigned_deck_slug || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPayloadDialogOpen(true)}
                            title="View Generic Payload"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingEoa(eoa);
                              setDialogOpen(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteEoa(eoa.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            title="Kit feature coming soon"
                          >
                            <Package className="h-4 w-4 opacity-50" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEoa ? "Edit Event/Action" : "Create Event/Action"}
            </DialogTitle>
            <DialogDescription>
              {editingEoa
                ? "Update the event or action details below."
                : "Add a new event or action to this campaign."}
            </DialogDescription>
          </DialogHeader>
          <EoaForm
            campaignId={campaign.id}
            eoaId={editingEoa?.id}
            initialData={editingEoa ? {
              mobilize_id: editingEoa.mobilize_id || "",
              title: editingEoa.title,
              site_name: editingEoa.site_name || "",
              city: editingEoa.city || "",
              state: editingEoa.state || "",
              zip_code: editingEoa.zip_code || "",
              type: editingEoa.type,
              start_date: editingEoa.start_date || "",
              end_date: editingEoa.end_date || "",
              timezone: editingEoa.timezone || "TBD",
              assigned_deck_slug: editingEoa.assigned_deck_slug || "",
              description: editingEoa.description || "",
              utm_id: editingEoa.utm_id,
            } : undefined}
            onSuccess={() => {
              setDialogOpen(false);
              setEditingEoa(null);
              fetchEoas();
            }}
            onCancel={() => {
              setDialogOpen(false);
              setEditingEoa(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={payloadDialogOpen} onOpenChange={setPayloadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generic Payload Structure</DialogTitle>
            <DialogDescription>
              URL structure with known values filled in and placeholders in braces
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 font-mono text-sm bg-muted p-4 rounded-lg">
            <div className="text-primary">
              {"{domain name}"}/{"{deck-assignment}"}?
            </div>
            <div className="text-muted-foreground">
              utm_campaign={campaign.code}&
            </div>
            <div className="text-muted-foreground">
              utm_id={"{utm_id}"}&
            </div>
            <div className="text-muted-foreground">
              utm_source={"{utm_source}"}&
            </div>
            <div className="text-muted-foreground">
              utm_medium={"{utm_medium}"}&
            </div>
            <div className="text-muted-foreground">
              utm_content={"{utm_content}"}&
            </div>
            <div className="text-muted-foreground">
              token={"{token}"}&
            </div>
            <div className="text-muted-foreground">
              level={"{level}"}&
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
