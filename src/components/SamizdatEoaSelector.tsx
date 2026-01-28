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

interface FirstViewResult {
  eoa_id: string;
  mobilize_code: string | null;
  first_view_at: string | null;
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

  // Once EoAs are loaded, fetch first view dates using optimized database function
  useEffect(() => {
    const fetchFirstViewDates = async () => {
      if (!eoas?.length) {
        setFirstViewDates({});
        return;
      }

      const eoaIds = eoas.map(e => e.id);
      const results: Record<string, string> = {};

      // Single RPC call to get first view dates - all work done server-side
      const { data, error } = await supabase.rpc("get_first_view_by_eoa_ids", {
        eoa_ids: eoaIds,
      });

      if (error) {
        console.error("Error fetching first view dates:", error);
        setFirstViewDates({});
        return;
      }

      const firstViewResults = data as FirstViewResult[];

      // Group by mobilize_code and find earliest first view per group
      const mobilizeCodeFirstView = new Map<string, string>();
      
      firstViewResults.forEach((result) => {
        if (!result.first_view_at) return;

        if (result.mobilize_code) {
          const existing = mobilizeCodeFirstView.get(result.mobilize_code);
          if (!existing || new Date(result.first_view_at) < new Date(existing)) {
            mobilizeCodeFirstView.set(result.mobilize_code, result.first_view_at);
          }
        } else {
          // EoA without mobilize_code uses its own key
          results[`eoa_${result.eoa_id}`] = result.first_view_at;
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
