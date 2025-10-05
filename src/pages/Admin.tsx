import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserCog, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface UserWithRole {
  user_id: string;
  email: string;
  role: "admin" | "manager" | "viewer" | null;
}

export default function Admin() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, userRole, signOut } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
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

  const updateUserRole = async (userId: string, newRole: "admin" | "manager" | "viewer") => {
    // Check if role exists
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingRole) {
      // Update existing role
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
      // Insert new role
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
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
                      <SelectContent className="bg-background">
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
      </div>
    </div>
  );
}
