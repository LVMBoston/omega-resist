import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Deck {
  slug: string;
}

interface EoaFormProps {
  campaignId: string;
  eoaId?: string;
  initialData?: {
    mobilize_id?: string;
    title: string;
    site_name?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    type: string;
    start_date?: string;
    end_date?: string;
    timezone?: string;
    assigned_deck_slug?: string;
    description?: string;
    utm_id: string;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

export default function EoaForm({ campaignId, eoaId, initialData, onSuccess, onCancel }: EoaFormProps) {
  const { toast } = useToast();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  
  // Helper to convert ISO timestamp to datetime-local format
  const toDatetimeLocal = (isoString: string | undefined) => {
    if (!isoString) return "";
    // Remove timezone info and milliseconds for datetime-local input
    return isoString.slice(0, 16);
  };

  const [formData, setFormData] = useState({
    mobilize_id: initialData?.mobilize_id || "",
    title: initialData?.title || "",
    site_name: initialData?.site_name || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    zip_code: initialData?.zip_code || "",
    type: initialData?.type || "event",
    start_date: toDatetimeLocal(initialData?.start_date),
    end_date: toDatetimeLocal(initialData?.end_date),
    timezone: initialData?.timezone || "TBD",
    assigned_deck_slug: initialData?.assigned_deck_slug || "none",
    description: initialData?.description || "",
    utm_id: initialData?.utm_id || "",
  });

  useEffect(() => {
    fetchDecks();
  }, []);

  const fetchDecks = async () => {
    const { data } = await supabase.from("decks").select("slug").order("slug");
    setDecks(data || []);
  };

  const handleImportFromMobilize = async () => {
    if (!formData.mobilize_id) {
      toast({
        variant: "destructive",
        title: "Missing Mobilize Code",
        description: "Please enter a 6-digit Mobilize event ID",
      });
      return;
    }

    if (!/^\d{6}$/.test(formData.mobilize_id)) {
      toast({
        variant: "destructive",
        title: "Invalid Mobilize Code",
        description: "Mobilize event ID must be exactly 6 digits",
      });
      return;
    }

    setImportLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('parse-mobilize-event', {
        body: { eventId: formData.mobilize_id }
      });

      if (error) throw error;

      // Auto-fill form fields with imported data
      // dateTime and dateTimeEnd are already in the correct format (YYYY-MM-DDTHH:mm) for datetime-local inputs
      console.log('Imported event data:', data);
      setFormData({
        ...formData,
        title: data.eventName || formData.title,
        site_name: data.siteName || formData.site_name,
        city: data.city || formData.city,
        state: data.state || formData.state,
        zip_code: data.zipCode || formData.zip_code,
        start_date: data.dateTime || formData.start_date,
        end_date: data.dateTimeEnd || formData.end_date,
        timezone: data.timezone || formData.timezone,
        description: data.eventSponsor ? `Sponsored by ${data.eventSponsor}` : formData.description,
      });

      toast({
        title: "Import Successful",
        description: `Imported event data from Mobilize.us (source: ${data.source})`,
      });
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message || "Failed to import event data from Mobilize.us",
      });
    } finally {
      setImportLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.utm_id) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Title and UTM ID are required",
      });
      return;
    }

    if (formData.type === "action" && !formData.end_date) {
      toast({
        variant: "destructive",
        title: "Missing End Date",
        description: "Actions must have an end date",
      });
      return;
    }

    setLoading(true);

    // Convert datetime-local format back to ISO timestamp
    const payload = {
      ...formData,
      start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
      end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
      assigned_deck_slug: formData.assigned_deck_slug === "none" ? null : formData.assigned_deck_slug,
      campaign_id: campaignId,
    };

    let error;
    if (eoaId) {
      ({ error } = await supabase.from("events_actions").update(payload).eq("id", eoaId));
    } else {
      ({ error } = await supabase.from("events_actions").insert([payload]));
    }

    setLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${eoaId ? "update" : "create"} event/action: ${error.message}`,
      });
    } else {
      toast({
        title: "Success",
        description: `Event/Action ${eoaId ? "updated" : "created"} successfully`,
      });
      onSuccess();
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Mobilize Code</Label>
          <div className="flex gap-2">
            <Input
              value={formData.mobilize_id}
              onChange={(e) => setFormData({ ...formData, mobilize_id: e.target.value })}
              placeholder="e.g., 837854"
              maxLength={6}
            />
            <Button 
              type="button"
              variant="outline" 
              onClick={handleImportFromMobilize}
              disabled={importLoading || !formData.mobilize_id}
            >
              {importLoading ? "Importing..." : "Import"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">6-digit Mobilize event ID</p>
        </div>
        <div>
          <Label>UTM ID *</Label>
          <Input
            value={formData.utm_id}
            onChange={(e) => setFormData({ ...formData, utm_id: e.target.value })}
            placeholder="e.g., rally-001"
          />
        </div>
      </div>

      <div>
        <Label>Event/Action Name *</Label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Town Hall Rally"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Site Name</Label>
          <Input
            value={formData.site_name}
            onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
            placeholder="e.g., Community Center"
          />
        </div>
        <div>
          <Label>City</Label>
          <Input
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="e.g., Falmouth"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>State</Label>
          <Input
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            placeholder="e.g., MA"
            maxLength={2}
          />
        </div>
        <div>
          <Label>Zip Code</Label>
          <Input
            value={formData.zip_code}
            onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
            placeholder="e.g., 02540"
          />
        </div>
        <div>
          <Label>Timezone</Label>
          <Input
            value={formData.timezone}
            onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            placeholder="e.g., America/New_York"
          />
        </div>
      </div>

      <div>
        <Label>Type</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => setFormData({ ...formData, type: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="event">Event</SelectItem>
            <SelectItem value="action">Action</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Start Date/Time</Label>
          <Input
            type="datetime-local"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
          />
        </div>
        <div>
          <Label>End Date/Time {formData.type === "action" && "*"}</Label>
          <Input
            type="datetime-local"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label>Assigned Deck</Label>
        <Select
          value={formData.assigned_deck_slug}
          onValueChange={(value) => setFormData({ ...formData, assigned_deck_slug: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a deck..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {decks.map((deck) => (
              <SelectItem key={deck.slug} value={deck.slug}>
                {deck.slug}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description..."
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={loading} className="flex-1">
          {loading ? "Saving..." : eoaId ? "Update" : "Create"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
