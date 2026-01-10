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

  // Once EoAs are loaded, fetch first view dates per mobilize_code
  useEffect(() => {
    const fetchFirstViewDates = async () => {
      if (!eoas?.length) {
        setFirstViewDates({});
        return;
      }

      // Group EoAs by mobilize_code
      const mobilizeCodes = [...new Set(eoas.map(e => e.mobilize_code).filter(Boolean))] as string[];
      const eoaIdsWithoutCode = eoas.filter(e => !e.mobilize_code).map(e => e.id);

      const results: Record<string, string> = {};

      // For EoAs with mobilize_code, find first view across all EoAs sharing that code
      if (mobilizeCodes.length > 0) {
        // Get all EoA IDs that share these mobilize_codes (not just selected ones)
        const { data: allEoasWithCodes } = await supabase
          .from("events_actions")
          .select("id, mobilize_code")
          .in("mobilize_code", mobilizeCodes);

        if (allEoasWithCodes?.length) {
          // Get all tokens for these EoAs
          const eoaIdsByCode: Record<string, string[]> = {};
          allEoasWithCodes.forEach(eoa => {
            if (eoa.mobilize_code) {
              if (!eoaIdsByCode[eoa.mobilize_code]) {
                eoaIdsByCode[eoa.mobilize_code] = [];
              }
              eoaIdsByCode[eoa.mobilize_code].push(eoa.id);
            }
          });

          // For each mobilize_code group, find the earliest view event
          for (const code of mobilizeCodes) {
            const eoaIdsForCode = eoaIdsByCode[code] || [];
            if (eoaIdsForCode.length === 0) continue;

            // Get tokens for these EoAs
            const { data: tokens } = await supabase
              .from("tokens")
              .select("token")
              .in("eoa_id", eoaIdsForCode)
              .eq("is_simulated", false);

            if (!tokens?.length) continue;

            const tokenList = tokens.map(t => t.token);

            // Find earliest view event
            const { data: events } = await supabase
              .from("url_events")
              .select("occurred_at")
              .in("token", tokenList)
              .eq("event_type", "view")
              .eq("is_simulated", false)
              .order("occurred_at", { ascending: true })
              .limit(1);

            if (events?.length) {
              results[code] = events[0].occurred_at;
            }
          }
        }
      }

      // For EoAs without mobilize_code, find first view for each individually
      for (const eoaId of eoaIdsWithoutCode) {
        const { data: tokens } = await supabase
          .from("tokens")
          .select("token")
          .eq("eoa_id", eoaId)
          .eq("is_simulated", false);

        if (!tokens?.length) continue;

        const tokenList = tokens.map(t => t.token);

        const { data: events } = await supabase
          .from("url_events")
          .select("occurred_at")
          .in("token", tokenList)
          .eq("event_type", "view")
          .eq("is_simulated", false)
          .order("occurred_at", { ascending: true })
          .limit(1);

        if (events?.length) {
          // Use eoa_id as key for EoAs without mobilize_code
          results[`eoa_${eoaId}`] = events[0].occurred_at;
        }
      }

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
