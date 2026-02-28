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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

interface ChapterFormProps {
  campaignId: string;
  /** Resolved fallback placeholders for messaging fields */
  messagingPlaceholders?: {
    emailL00?: string;
    emailL01?: string;
    smsL00?: string;
    smsL01?: string;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ChapterForm({
  campaignId,
  messagingPlaceholders,
  onSuccess,
  onCancel,
}: ChapterFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetchingMobilize, setFetchingMobilize] = useState(false);
  const [messagingOpen, setMessagingOpen] = useState(false);
  const [decks, setDecks] = useState<{ slug: string }[]>([]);

  const [formData, setFormData] = useState({
    mobilize_code: "",
    title: "",
    site_name: "",
    city: "",
    state: "",
    zip_code: "",
    timezone: "TBD",
    type: "event",
    end_date: "",
    assigned_deck_slug: "none",
    description: "",
    utm_id: "",
  });

  const [overrides, setOverrides] = useState({
    emailL00: "",
    emailL01: "",
    smsL00: "",
    smsL01: "",
  });

  useEffect(() => {
    const fetchDecks = async () => {
      const { data } = await supabase.from("decks").select("slug").order("slug");
      setDecks(data || []);
    };
    fetchDecks();

    // Load last utm_id for this campaign
    const savedUtmId = localStorage.getItem(`eoa_last_utm_${campaignId}`);
    if (savedUtmId) {
      setFormData((prev) => ({ ...prev, utm_id: savedUtmId }));
    }
  }, [campaignId]);

  const fetchFromMobilize = async () => {
    if (!formData.mobilize_code) {
      toast({ variant: "destructive", title: "Event Code Required", description: "Please enter a Mobilize event ID first" });
      return;
    }
    setFetchingMobilize(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-mobilize-event`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ mobilizeCode: formData.mobilize_code }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data && !data.error) {
        const toDatetimeLocal = (iso: string | undefined) => {
          if (!iso) return "";
          return iso.replace(/:\d{2}\.\d{3}Z$/, "").replace(/:\d{2}Z$/, "").slice(0, 16);
        };
        setFormData((prev) => ({
          ...prev,
          title: data.title || prev.title,
          site_name: data.site_name || prev.site_name,
          city: data.city || prev.city,
          state: data.state || prev.state,
          zip_code: data.zip_code || prev.zip_code,
          type: data.type || prev.type,
          end_date: data.end_date ? toDatetimeLocal(data.end_date) : prev.end_date,
          timezone: data.timezone || prev.timezone,
          description: data.description || prev.description,
        }));
        toast({ title: "Success", description: "Event data fetched from Mobilize.us" });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to fetch event" });
    } finally {
      setFetchingMobilize(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.mobilize_code || !formData.title || !formData.utm_id) {
      toast({ variant: "destructive", title: "Missing required fields", description: "Event Code, Title, and UTM ID are required" });
      return;
    }
    setLoading(true);
    try {
      // 1. Insert the EoA row
      const { error: eoaError } = await supabase.from("events_actions").insert([{
        campaign_id: campaignId,
        mobilize_code: formData.mobilize_code,
        title: formData.title,
        site_name: formData.site_name || null,
        city: formData.city || null,
        state: formData.state || null,
        zip_code: formData.zip_code || null,
        timezone: formData.timezone,
        type: formData.type,
        start_date: null,
        end_date: formData.end_date ? `${formData.end_date}:00.000Z` : null,
        assigned_deck_slug: formData.assigned_deck_slug === "none" ? null : formData.assigned_deck_slug,
        description: formData.description || null,
        utm_id: formData.utm_id,
        utm_content: `${formData.mobilize_code}-${formData.utm_id}`,
      }]);
      if (eoaError) throw eoaError;

      // 2. Upsert any messaging overrides
      const overrideRows: { campaign_id: string; mobilize_code: string; category: string; key: string; value: any }[] = [];
      if (overrides.emailL00.trim()) overrideRows.push({ campaign_id: campaignId, mobilize_code: formData.mobilize_code, category: "email", key: "l00_template", value: { ...JSON.parse('{"subject":"","body":""}'), body: overrides.emailL00 } });
      if (overrides.emailL01.trim()) overrideRows.push({ campaign_id: campaignId, mobilize_code: formData.mobilize_code, category: "email", key: "l01_template", value: { subject: "", body: overrides.emailL01 } });
      if (overrides.smsL00.trim()) overrideRows.push({ campaign_id: campaignId, mobilize_code: formData.mobilize_code, category: "sms", key: "l00_template", value: { body: overrides.smsL00 } });
      if (overrides.smsL01.trim()) overrideRows.push({ campaign_id: campaignId, mobilize_code: formData.mobilize_code, category: "sms", key: "l01_template", value: { body: overrides.smsL01 } });

      if (overrideRows.length > 0) {
        const { error: overrideError } = await supabase
          .from("campaign_message_overrides")
          .upsert(overrideRows, { onConflict: "campaign_id,mobilize_code,category,key" });
        if (overrideError) {
          console.error("Override upsert error:", overrideError);
          // Non-fatal: EoA was created successfully
          toast({ variant: "destructive", title: "Warning", description: "Chapter created but messaging overrides failed to save" });
        }
      }

      // Save utm_id for next time
      if (formData.utm_id.trim()) {
        localStorage.setItem(`eoa_last_utm_${campaignId}`, formData.utm_id);
      }

      toast({ title: "Success", description: "Chapter created successfully" });
      onSuccess();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      {/* Identity Fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Event Code <span className="text-destructive">*</span></Label>
          <div className="flex gap-2">
            <Input
              value={formData.mobilize_code}
              onChange={(e) => setFormData({ ...formData, mobilize_code: e.target.value })}
              placeholder="Mobilize ID or code"
              className="flex-1"
            />
            <Button
              type="button"
              onClick={fetchFromMobilize}
              disabled={fetchingMobilize || !formData.mobilize_code || formData.mobilize_code.toLowerCase().startsWith("z")}
              variant="outline"
              size="sm"
            >
              {fetchingMobilize ? "Fetching..." : "Fetch"}
            </Button>
          </div>
        </div>
        <div>
          <Label>UTM ID <span className="text-destructive">*</span></Label>
          <Input
            value={formData.utm_id}
            onChange={(e) => {
              const value = e.target.value.toLowerCase();
              setFormData({ ...formData, utm_id: value });
              if (value.trim()) localStorage.setItem(`eoa_last_utm_${campaignId}`, value);
            }}
            placeholder="e.g., rally-a1"
            maxLength={8}
          />
        </div>
      </div>

      <div>
        <Label>Title <span className="text-destructive">*</span></Label>
        <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g., Town Hall Rally" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Site Name</Label>
          <Input value={formData.site_name} onChange={(e) => setFormData({ ...formData, site_name: e.target.value })} placeholder="e.g., Community Center" />
        </div>
        <div>
          <Label>City</Label>
          <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="e.g., Falmouth" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>State</Label>
          <Input value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} placeholder="e.g., MA" maxLength={2} />
        </div>
        <div>
          <Label>Zip Code</Label>
          <Input value={formData.zip_code} onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })} placeholder="e.g., 02540" />
        </div>
        <div>
          <Label>Timezone</Label>
          <Input value={formData.timezone} onChange={(e) => setFormData({ ...formData, timezone: e.target.value })} placeholder="America/New_York" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Type</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="event">Event</SelectItem>
              <SelectItem value="action">Action</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>End Date/Time</Label>
          <Input type="datetime-local" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
        </div>
      </div>

      <div>
        <Label>Assigned Deck</Label>
        <Select value={formData.assigned_deck_slug} onValueChange={(value) => setFormData({ ...formData, assigned_deck_slug: value })}>
          <SelectTrigger><SelectValue placeholder="Select a deck..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {decks.map((d) => <SelectItem key={d.slug} value={d.slug}>{d.slug}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Optional description..." />
      </div>

      {/* Messaging Overrides (collapsible) */}
      <Collapsible open={messagingOpen} onOpenChange={setMessagingOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
            {messagingOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Messaging Overrides (optional)
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">Leave blank to inherit from campaign or global defaults. Use {"{{link}}"} for the share URL, {"{{city}}"}, {"{{state}}"}, {"{{site_name}}"} for geographic placeholders.</p>
          <div>
            <Label className="text-xs">SMS L00 Template</Label>
            <Textarea value={overrides.smsL00} onChange={(e) => setOverrides({ ...overrides, smsL00: e.target.value })} placeholder={messagingPlaceholders?.smsL00 || "Inherited from campaign/global"} rows={2} />
          </div>
          <div>
            <Label className="text-xs">SMS L01 Template</Label>
            <Textarea value={overrides.smsL01} onChange={(e) => setOverrides({ ...overrides, smsL01: e.target.value })} placeholder={messagingPlaceholders?.smsL01 || "Inherited from campaign/global"} rows={2} />
          </div>
          <div>
            <Label className="text-xs">Email L00 Body</Label>
            <Textarea value={overrides.emailL00} onChange={(e) => setOverrides({ ...overrides, emailL00: e.target.value })} placeholder={messagingPlaceholders?.emailL00 || "Inherited from campaign/global"} rows={2} />
          </div>
          <div>
            <Label className="text-xs">Email L01 Body</Label>
            <Textarea value={overrides.emailL01} onChange={(e) => setOverrides({ ...overrides, emailL01: e.target.value })} placeholder={messagingPlaceholders?.emailL01 || "Inherited from campaign/global"} rows={2} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSubmit} disabled={loading} className="flex-1">
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Create Chapter"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
