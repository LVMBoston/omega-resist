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
    mobilize_code?: string;
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
  const [fetchingMobilize, setFetchingMobilize] = useState(false);
  
  // Helper to convert ISO timestamp to datetime-local format
  const toDatetimeLocal = (isoString: string | undefined) => {
    if (!isoString) return "";
    // Remove timezone info and milliseconds for datetime-local input
    return isoString.slice(0, 16);
  };

  const [formData, setFormData] = useState({
    mobilize_code: initialData?.mobilize_code || initialData?.mobilize_id || "",
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
    
    // Load last utm_id for this campaign if not editing
    if (!initialData?.utm_id) {
      const savedUtmId = localStorage.getItem(`eoa_last_utm_${campaignId}`);
      if (savedUtmId) {
        setFormData(prev => ({ ...prev, utm_id: savedUtmId }));
      }
    }
  }, [campaignId]);

  const fetchDecks = async () => {
    const { data } = await supabase.from("decks").select("slug").order("slug");
    setDecks(data || []);
  };

  const fetchFromMobilize = async () => {
    if (!formData.mobilize_code) {
      toast({
        variant: "destructive",
        title: "Event Code Required",
        description: "Please enter an Event Code (Mobilize event ID) first",
      });
      return;
    }

    setFetchingMobilize(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-mobilize-event', {
        body: { mobilizeCode: formData.mobilize_code }
      });

      if (error) throw error;

      if (data && !data.error) {
        setFormData(prev => ({
          ...prev,
          title: data.title || prev.title,
          site_name: data.site_name || prev.site_name,
          city: data.city || prev.city,
          state: data.state || prev.state,
          zip_code: data.zip_code || prev.zip_code,
          type: data.type || prev.type,
          start_date: data.start_date ? toDatetimeLocal(data.start_date) : prev.start_date,
          end_date: data.end_date ? toDatetimeLocal(data.end_date) : prev.end_date,
          timezone: data.timezone || prev.timezone,
          description: data.description || prev.description,
        }));

        toast({
          title: "Success",
          description: "Event data fetched from Mobilize.us",
        });
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error fetching from Mobilize:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to fetch event from Mobilize.us",
      });
    } finally {
      setFetchingMobilize(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.utm_id || !formData.mobilize_code) {
      toast({
        variant: "destructive",
        title: "Missing required fields",
        description: "Title, UTM ID, and Event Code are required",
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
          <Label>Event Code <span className="text-destructive">*</span></Label>
          <div className="flex gap-2">
            <Input
              value={formData.mobilize_code}
              onChange={(e) => setFormData({ ...formData, mobilize_code: e.target.value })}
              placeholder="Enter Mobilize event ID"
              className="flex-1"
            />
            <Button
              type="button"
              onClick={fetchFromMobilize}
              disabled={fetchingMobilize || !formData.mobilize_code}
              variant="outline"
              size="sm"
            >
              {fetchingMobilize ? "Fetching..." : "Fetch"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Enter Mobilize event ID and click "Fetch" to auto-populate fields
          </p>
        </div>
        <div>
          <Label>UTM ID <span className="text-destructive">*</span></Label>
          <Input
            value={formData.utm_id}
            onChange={(e) => {
              const value = e.target.value.toLowerCase();
              setFormData({ ...formData, utm_id: value });
              // Save to localStorage for this campaign
              if (value.trim()) {
                localStorage.setItem(`eoa_last_utm_${campaignId}`, value);
              }
            }}
            placeholder="e.g., rally-a1"
            maxLength={8}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Max 8 chars, lowercase, use '-' or '_'. utm_content: {formData.mobilize_code || "{code}"}-{formData.utm_id || "{utm_id}"}
          </p>
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
