import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { formatFloatingLocalTime } from "@/lib/dateUtils";

interface SamizdatEoaSelectorProps {
  campaignId: string;
  onEoaChange?: (eoaIds: string[]) => void;
}

interface EoaOption {
  id: string;
  utm_id: string;
  mobilize_code: string | null;
  timezone: string | null;
}

interface FirstViewByMobilizeCode {
  mobilize_code: string;
  first_view_at: string;
}

const SamizdatEoaSelector = ({ campaignId, onEoaChange }: SamizdatEoaSelectorProps) => {
  const [selectedEoaIds, setSelectedEoaIds] = useState<string[]>([]);
  const [firstViewDates, setFirstViewDates] = useState<Record<string, string>>({});

  // Query EoAs for this campaign (no longer filtering by start_date)
  const { data: eoas, isLoading: isLoadingEoas } = useQuery({
    queryKey: ["samizdat-eoas", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];

      const { data, error } = await supabase
        .from("events_actions")
        .select("id, utm_id, mobilize_code, timezone")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching EoAs:", error);
        return [];
      }

      return data as EoaOption[];
    },
    enabled: !!campaignId,
  });

  // Once EoAs are loaded, fetch first view dates - OPTIMIZED: single batched query
  useEffect(() => {
    const fetchFirstViewDates = async () => {
      if (!eoas?.length) {
        setFirstViewDates({});
        return;
      }

      const eoaIds = eoas.map(e => e.id);
      const results: Record<string, string> = {};

      // OPTIMIZED: Fetch all tokens for all EoAs in ONE query
      const { data: allTokens, error: tokensError } = await supabase
        .from("tokens")
        .select("token, eoa_id")
        .in("eoa_id", eoaIds)
        .eq("is_simulated", false);

      if (tokensError || !allTokens?.length) {
        console.log("No tokens found for EoAs");
        setFirstViewDates({});
        return;
      }

      // Build token -> eoa_id mapping
      const tokenToEoaId = new Map<string, string>();
      allTokens.forEach(t => tokenToEoaId.set(t.token, t.eoa_id));
      const allTokenList = allTokens.map(t => t.token);

      // OPTIMIZED: Fetch first view for ALL tokens in ONE query, grouped by token
      // We get all view events ordered by time, then pick earliest per eoa_id
      const { data: allEvents, error: eventsError } = await supabase
        .from("url_events")
        .select("token, occurred_at")
        .in("token", allTokenList)
        .eq("event_type", "view")
        .eq("is_simulated", false)
        .order("occurred_at", { ascending: true });

      if (eventsError || !allEvents?.length) {
        console.log("No view events found");
        setFirstViewDates({});
        return;
      }

      // Build eoa_id -> first_view mapping (first occurrence wins due to sort order)
      const eoaFirstView = new Map<string, string>();
      allEvents.forEach(event => {
        const eoaId = tokenToEoaId.get(event.token);
        if (eoaId && !eoaFirstView.has(eoaId)) {
          eoaFirstView.set(eoaId, event.occurred_at);
        }
      });

      // Group EoAs by mobilize_code and find earliest first view per group
      const mobilizeCodeFirstView = new Map<string, string>();
      eoas.forEach(eoa => {
        const firstView = eoaFirstView.get(eoa.id);
        if (!firstView) return;

        if (eoa.mobilize_code) {
          const existing = mobilizeCodeFirstView.get(eoa.mobilize_code);
          if (!existing || new Date(firstView) < new Date(existing)) {
            mobilizeCodeFirstView.set(eoa.mobilize_code, firstView);
          }
        } else {
          // EoA without mobilize_code uses its own key
          results[`eoa_${eoa.id}`] = firstView;
        }
      });

      // Add mobilize_code group results
      mobilizeCodeFirstView.forEach((firstView, code) => {
        results[code] = firstView;
      });

      setFirstViewDates(results);
    };

    fetchFirstViewDates();
  }, [eoas]);

  // Helper to get first view date for an EoA
  const getFirstViewForEoa = (eoa: EoaOption): string | null => {
    if (eoa.mobilize_code) {
      return firstViewDates[eoa.mobilize_code] || null;
    }
    return firstViewDates[`eoa_${eoa.id}`] || null;
  };

  // All EoAs are now "active" - we show them all and display their first view status
  // EoAs with mobilize_code inherit the group's first view even if they individually have no views
  const activeEoas = eoas || [];

  // Select all EoAs by default when data loads
  useEffect(() => {
    if (activeEoas.length > 0) {
      const allIds = activeEoas.map((e) => e.id);
      setSelectedEoaIds(allIds);
      onEoaChange?.(allIds);
    }
  }, [activeEoas.length, onEoaChange]);

  const toggleEoa = (eoaId: string) => {
    setSelectedEoaIds((prev) => {
      const newSelection = prev.includes(eoaId)
        ? prev.filter((id) => id !== eoaId)
        : [...prev, eoaId];
      onEoaChange?.(newSelection);
      return newSelection;
    });
  };

  const formatFirstView = (dateString: string) => {
    return formatFloatingLocalTime(dateString);
  };

  const isLoading = isLoadingEoas || (eoas?.length && Object.keys(firstViewDates).length === 0);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading EoAs...
      </div>
    );
  }

  // Empty state - no EoAs at all
  if (!activeEoas.length) {
    return (
      <p className="text-muted-foreground text-sm py-2">
        No EoAs found for this campaign.
      </p>
    );
  }

  return (
    <div className="space-y-3 py-2">
      {activeEoas.map((eoa) => {
        const firstView = getFirstViewForEoa(eoa);
        return (
          <div key={eoa.id} className="flex items-center space-x-3">
            <Checkbox
              id={eoa.id}
              checked={selectedEoaIds.includes(eoa.id)}
              onCheckedChange={() => toggleEoa(eoa.id)}
            />
            <label
              htmlFor={eoa.id}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {eoa.utm_id}{" "}
              <span className="text-muted-foreground">
                (First open: {firstView ? formatFirstView(firstView) : "No opens yet"})
              </span>
            </label>
          </div>
        );
      })}
    </div>
  );
};

export default SamizdatEoaSelector;
