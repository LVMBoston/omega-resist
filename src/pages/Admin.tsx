import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserCog, LogOut, Trash2, Database, Share2, Copy, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { GeoipDebugPanel } from "@/components/GeoipDebugPanel";

interface UserWithRole {
  user_id: string;
  email: string;
  role: "admin" | "manager" | "viewer" | null;
}

interface DashboardShare {
  id: string;
  share_code: string;
  campaign_id: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  view_count: number;
  campaigns?: {
    title: string;
  };
}

export default function Admin() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [shares, setShares] = useState<DashboardShare[]>([]);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; value: string } | null>(null);
  const [newShare, setNewShare] = useState({ campaign_id: "", expires_days: "90" });
  const { user, userRole, signOut } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchShares();
    fetchCampaigns();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    
    // Get all roles with user emails
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch roles: " + rolesError.message,
      });
      setLoading(false);
      return;
    }

    // Get current user data to show email
    const currentUserEmail = user?.email || "Unknown";
    
    // Map users with their roles
    const combinedUsers = rolesData?.map(r => ({
      user_id: r.user_id,
      email: r.user_id === user?.id ? currentUserEmail : "User " + r.user_id.slice(0, 8),
      role: r.role,
    })) || [];

    setUsers(combinedUsers);
    setLoading(false);
  };

  const fetchCampaigns = async () => {
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, title")
      .order("title");
    
    if (!error && data) {
      setCampaigns(data);
    }
  };

  const fetchShares = async () => {
    const { data, error } = await supabase
      .from("dashboard_shares")
      .select(`
        *,
        campaigns!fk_dashboard_shares_campaign(title)
      `)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setShares(data as any);
    }
  };

  const updateUserRole = async (userId: string, newRole: "admin" | "manager" | "viewer") => {
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingRole) {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update role: " + error.message,
        });
        return;
      }
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole });

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to assign role: " + error.message,
        });
        return;
      }
    }

    toast({
      title: "Success",
      description: `Role updated to ${newRole}`,
    });

    fetchUsers();
  };

  const handleDeleteData = async () => {
    if (!deleteTarget) return;

    const { type, value } = deleteTarget;
    let error;

    if (type === "time") {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(value));
      
      const { error: e1 } = await supabase
        .from("url_events")
        .update({ deleted_at: new Date().toISOString() })
        .lt("occurred_at", cutoffDate.toISOString())
        .is("deleted_at", null);
      
      const { error: e2 } = await supabase
        .from("tokens")
        .update({ deleted_at: new Date().toISOString() })
        .lt("minted_at", cutoffDate.toISOString())
        .is("deleted_at", null);
      
      error = e1 || e2;
    } else if (type === "source") {
      const isSimulated = value === "simulated";
      
      const { error: e1 } = await supabase
        .from("url_events")
        .update({ deleted_at: new Date().toISOString() })
        .eq("is_simulated", isSimulated)
        .is("deleted_at", null);
      
      const { error: e2 } = await supabase
        .from("tokens")
        .update({ deleted_at: new Date().toISOString() })
        .eq("is_simulated", isSimulated)
        .is("deleted_at", null);
      
      error = e1 || e2;
    } else if (type === "campaign") {
      // Get tokens for this campaign
      const { data: tokenIds } = await supabase
        .from("tokens")
        .select("token")
        .eq("events_actions.campaign_id", value)
        .is("deleted_at", null);
      
      if (tokenIds && tokenIds.length > 0) {
        const tokens = tokenIds.map(t => t.token);
        
        const { error: e1 } = await supabase
          .from("url_events")
          .update({ deleted_at: new Date().toISOString() })
          .in("token", tokens)
          .is("deleted_at", null);
        
        const { error: e2 } = await supabase
          .from("tokens")
          .update({ deleted_at: new Date().toISOString() })
          .in("token", tokens)
          .is("deleted_at", null);
        
        error = e1 || e2;
      }
    }

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete data: " + error.message,
      });
    } else {
      toast({
        title: "Success",
        description: "Data marked for deletion (90-day retention)",
      });
    }

    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const createShare = async () => {
    if (!newShare.campaign_id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a campaign",
      });
      return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(newShare.expires_days));

    const { data: shareCode, error: codeError } = await supabase
      .rpc("generate_share_code");

    if (codeError || !shareCode) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate share code",
      });
      return;
    }

    const { error } = await supabase
      .from("dashboard_shares")
      .insert({
        share_code: shareCode,
        campaign_id: newShare.campaign_id,
        created_by: user?.id,
        expires_at: expiresAt.toISOString(),
      });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create share: " + error.message,
      });
      return;
    }

    toast({
      title: "Success",
      description: "Shareable link created",
    });

    setNewShare({ campaign_id: "", expires_days: "90" });
    fetchShares();
  };

  const toggleShareActive = async (shareId: string, currentActive: boolean) => {
    const { error } = await supabase
      .from("dashboard_shares")
      .update({ is_active: !currentActive })
      .eq("id", shareId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update share status",
      });
      return;
    }

    toast({
      title: "Success",
      description: `Share ${!currentActive ? "activated" : "deactivated"}`,
    });

    fetchShares();
  };

  const copyShareLink = (shareCode: string) => {
    const url = `${window.location.origin}/shared-dashboard/${shareCode}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied",
      description: "Share link copied to clipboard",
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
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <UserCog className="w-8 h-8" />
              Admin Panel
            </h1>
            <p className="text-muted-foreground mt-1">
              Logged in as: {user?.email} 
              {userRole && <Badge className="ml-2">{userRole}</Badge>}
            </p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-4">
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="data">Data Management</TabsTrigger>
            <TabsTrigger value="shares">Dashboard Shares</TabsTrigger>
            <TabsTrigger value="debug">Debug Tools</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Role Management</CardTitle>
                <CardDescription>
                  Assign roles to users. Only admins can access this page.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map((u) => (
                    <div
                      key={u.user_id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{u.email}</p>
                        <p className="text-sm text-muted-foreground">
                          {u.user_id === user?.id && "(You)"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.role && <Badge variant="outline">{u.role}</Badge>}
                        <Select
                          value={u.role || "none"}
                          onValueChange={(value) => {
                            if (value !== "none") {
                              updateUserRole(u.user_id, value as "admin" | "manager" | "viewer");
                            }
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Set role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No role</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data">
            <Card>
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>
                  Soft delete data with 90-day retention. Deleted data can be recovered within this period.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-2">Delete by Time Range</h3>
                    <p className="text-sm text-muted-foreground mb-3">Remove events older than specified days</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDeleteTarget({ type: "time", value: "30" });
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Older than 30 days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDeleteTarget({ type: "time", value: "60" });
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Older than 60 days
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDeleteTarget({ type: "time", value: "90" });
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Older than 90 days
                      </Button>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-2">Delete by Data Source</h3>
                    <p className="text-sm text-muted-foreground mb-3">Remove all events from a specific source</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDeleteTarget({ type: "source", value: "simulated" });
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Simulated Data
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDeleteTarget({ type: "source", value: "real" });
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Real Data
                      </Button>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-2">Delete by Campaign</h3>
                    <p className="text-sm text-muted-foreground mb-3">Remove all data for a specific campaign</p>
                    <Select
                      onValueChange={(value) => {
                        setDeleteTarget({ type: "campaign", value });
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select campaign to delete..." />
                      </SelectTrigger>
                      <SelectContent>
                        {campaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shares">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Create Shareable Link</CardTitle>
                  <CardDescription>
                    Generate read-only dashboard links for chapter leads
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Campaign</label>
                    <Select value={newShare.campaign_id} onValueChange={(v) => setNewShare({ ...newShare, campaign_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select campaign" />
                      </SelectTrigger>
                      <SelectContent>
                        {campaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Expires In (Days)</label>
                    <Select value={newShare.expires_days} onValueChange={(v) => setNewShare({ ...newShare, expires_days: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 Days</SelectItem>
                        <SelectItem value="60">60 Days</SelectItem>
                        <SelectItem value="90">90 Days</SelectItem>
                        <SelectItem value="180">180 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={createShare}>
                    <Share2 className="w-4 h-4 mr-2" />
                    Create Share Link
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active Shares</CardTitle>
                  <CardDescription>Manage existing shareable dashboard links</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {shares.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No shares created yet
                      </p>
                    ) : (
                      shares.map((share) => (
                        <div key={share.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{share.campaigns?.title || "Unknown Campaign"}</p>
                              <p className="text-sm text-muted-foreground">
                                Created: {format(new Date(share.created_at), "PPp")}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Expires: {format(new Date(share.expires_at), "PPp")}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Views: {share.view_count}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant={share.is_active ? "default" : "secondary"}>
                                  {share.is_active ? "Active" : "Inactive"}
                                </Badge>
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  {share.share_code}
                                </code>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyShareLink(share.share_code)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`/shared-dashboard/${share.share_code}`, "_blank")}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleShareActive(share.id, share.is_active)}
                              >
                                {share.is_active ? "Deactivate" : "Activate"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="debug">
            <GeoipDebugPanel />
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Data Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              This will soft-delete the data. It can be recovered within 90 days. After 90 days, the data will be permanently removed.
              {deleteTarget && (
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <strong>Target:</strong>{" "}
                  {deleteTarget.type === "time" && `Events older than ${deleteTarget.value} days`}
                  {deleteTarget.type === "source" && `All ${deleteTarget.value} data`}
                  {deleteTarget.type === "campaign" && `Campaign: ${campaigns.find(c => c.id === deleteTarget.value)?.title}`}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteData}>
              Confirm Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
