import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  utm_content: string | null;
}
export default function CampaignEoaManager() {
  const {
    campaignId
  } = useParams();
  const navigate = useNavigate();
  const {
    userRole
  } = useAuth();
  const {
    toast
  } = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [eoas, setEoas] = useState<EventAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEoa, setEditingEoa] = useState<EventAction | null>(null);
  const [payloadDialogOpen, setPayloadDialogOpen] = useState(false);
  const [visualizePayloadDialogOpen, setVisualizePayloadDialogOpen] = useState(false);
  const [selectedEoa, setSelectedEoa] = useState<EventAction | null>(null);
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
    const {
      data,
      error
    } = await supabase.from("campaigns").select("id, code, title").eq("id", campaignId).single();
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch campaign: " + error.message
      });
      navigate("/campaigns");
    } else {
      setCampaign(data);
    }
  };
  const fetchEoas = async () => {
    const {
      data,
      error
    } = await supabase.from("events_actions").select("*").eq("campaign_id", campaignId).order("start_date", {
      ascending: true
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch events/actions: " + error.message
      });
    } else {
      setEoas(data || []);
    }
  };
  const deleteEoa = async (id: string) => {
    const {
      error
    } = await supabase.from("events_actions").delete().eq("id", id);
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete event/action: " + error.message
      });
    } else {
      toast({
        title: "Success",
        description: "Event/Action deleted"
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
      minute: "2-digit"
    });
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>;
  }
  if (!campaign) {
    return null;
  }
  return <div className="min-h-screen bg-background">
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
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setVisualizePayloadDialogOpen(true)}>
                  Visualize Generic Payload
                </Button>
                <Button onClick={() => {
                setEditingEoa(null);
                setDialogOpen(true);
              }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Event/Action
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {eoas.length === 0 ? <p className="text-center text-muted-foreground py-8">
                No events or actions yet. Click "Add Event/Action" to create one.
              </p> : <Table>
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
                  {eoas.map(eoa => <TableRow key={eoa.id}>
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
                          <Button variant="ghost" size="sm" onClick={() => {
                      setSelectedEoa(eoa);
                      setPayloadDialogOpen(true);
                    }} title="View Payload">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                      setEditingEoa(eoa);
                      setDialogOpen(true);
                    }}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteEoa(eoa.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" disabled title="Kit feature coming soon">
                            <Package className="h-4 w-4 opacity-50" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>}
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
              {editingEoa ? "Update the event or action details below." : "Add a new event or action to this campaign."}
            </DialogDescription>
          </DialogHeader>
          <EoaForm campaignId={campaign.id} eoaId={editingEoa?.id} initialData={editingEoa ? {
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
          utm_id: editingEoa.utm_id
        } : undefined} onSuccess={() => {
          setDialogOpen(false);
          setEditingEoa(null);
          fetchEoas();
        }} onCancel={() => {
          setDialogOpen(false);
          setEditingEoa(null);
        }} />
        </DialogContent>
      </Dialog>

      <Dialog open={payloadDialogOpen} onOpenChange={setPayloadDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Payload Structure for {selectedEoa?.title}</DialogTitle>
            <DialogDescription>
              L00 and L01 payload comparison with known values filled in
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2">Item</TableHead>
                <TableHead className="py-2">L00 Payload</TableHead>
                <TableHead className="py-2">L01 Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium py-1.5">domain name/</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{domain name}/"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{domain name}/"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">deck-assignment</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{selectedEoa?.assigned_deck_slug || "{deck-assignment}"}/</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{selectedEoa?.assigned_deck_slug || "{deck-assignment}"}/</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">utm_campaign=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{campaign.code}&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{campaign.code}&</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">utm_id=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{selectedEoa?.utm_id || "{utm_id}"}&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{selectedEoa?.utm_id || "{utm_id}"}&</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">utm_content=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{selectedEoa?.utm_content || `{poster, handout, em}-${selectedEoa?.mobilize_id || "{Mobilize ID}"}`}&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{selectedEoa?.utm_content || `{poster, handout, em}-${selectedEoa?.mobilize_id || "{Mobilize ID}"}`}&</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">utm_source=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">l00&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">l01&</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">utm_medium=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">qr&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{'email&', 'SMS&', {social media (e.g., 'fb&')}}"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">v_lvl=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">00&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">01&</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">t=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">l00-{selectedEoa?.mobilize_id || "{Mobilize ID}"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"l01-{AUTO-MINT}"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">p=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">null</TableCell>
                <TableCell className="font-mono text-sm py-1.5">l00-{selectedEoa?.mobilize_id || "{Mobilize ID}"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">m=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">null</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{em,sms,sm}"}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <Dialog open={visualizePayloadDialogOpen} onOpenChange={setVisualizePayloadDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Generic Payload Visualization</DialogTitle>
            <DialogDescription>
              Comparison of L00 and L01 payload structures
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2">#</TableHead>
                <TableHead className="py-2">Item</TableHead>
                <TableHead className="py-2">L00 Payload</TableHead>
                <TableHead className="py-2">L01 Payload</TableHead>
                <TableHead className="py-2">L02 Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium py-1.5">1</TableCell>
                <TableCell className="font-medium py-1.5">domain name/</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{domain name}/"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{domain name}/"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{domain name}/"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">2</TableCell>
                <TableCell className="font-medium py-1.5">deck-assignment</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{deck-assignment}/"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{deck-assignment}/"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{deck-assignment}/"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">3</TableCell>
                <TableCell className="font-medium py-1.5">utm_campaign=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{campaign.code}&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{campaign.code}&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{campaign.code}&</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">4</TableCell>
                <TableCell className="font-medium py-1.5">utm_id=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{Mobilize event code}&"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{Mobilize event code}&"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{Mobilize event code}&"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">5</TableCell>
                <TableCell className="font-medium py-1.5">utm_content=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{poster, handout, em}-{Mobilize ID}&"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{poster, handout, em}-{Mobilize ID}&"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{poster, handout, em}-{Mobilize ID}&"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">6</TableCell>
                <TableCell className="font-medium py-1.5">utm_source=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">l00&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">l01&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">l02&</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">7</TableCell>
                <TableCell className="font-medium py-1.5">utm_medium=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">qr&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{'email&', 'SMS&', {social media (e.g., 'fb&')}}"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{'email&', 'SMS&', {social media (e.g., 'fb&')}}"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">8</TableCell>
                <TableCell className="font-medium py-1.5">v_lvl=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">00&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">01&</TableCell>
                <TableCell className="font-mono text-sm py-1.5">02&</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">9</TableCell>
                <TableCell className="font-medium py-1.5">t=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"l00-{Mobilize ID}"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"l01-{101 AUTO-MINT}"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"l02-{AUTO-MINT}"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">10</TableCell>
                <TableCell className="font-medium py-1.5">p=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">null</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"l00-{Mobilize ID}"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"l01-{Mobilize ID}"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium py-1.5">11</TableCell>
                <TableCell className="font-medium py-1.5">m=</TableCell>
                <TableCell className="font-mono text-sm py-1.5">null</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{em,sms,sm}"}</TableCell>
                <TableCell className="font-mono text-sm py-1.5">{"{em,sms,sm}"}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>;
}