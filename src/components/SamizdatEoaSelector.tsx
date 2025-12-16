import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, MapPin } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";

interface SamizdatEoaSelectorProps {
  campaignId: string;
  onEoaChange?: (eoaIds: string[]) => void;
}

interface EoaOption {
  id: string;
  utm_id: string;
  start_date: string;
  timezone: string | null;
}

const SamizdatEoaSelector = ({ campaignId, onEoaChange }: SamizdatEoaSelectorProps) => {
  const [selectedEoaIds, setSelectedEoaIds] = useState<string[]>([]);

  // Query EoAs for this campaign where start_date IS NOT NULL
  const { data: eoas, isLoading } = useQuery({
    queryKey: ["samizdat-eoas", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];

      const { data, error } = await supabase
        .from("events_actions")
        .select("id, utm_id, start_date, timezone")
        .eq("campaign_id", campaignId)
        .not("start_date", "is", null)
        .order("start_date", { ascending: false });

      if (error) {
        console.error("Error fetching EoAs:", error);
        return [];
      }

      return data as EoaOption[];
    },
    enabled: !!campaignId,
  });

  // Select all EoAs by default when data loads
  useEffect(() => {
    if (eoas?.length) {
      const allIds = eoas.map((e) => e.id);
      setSelectedEoaIds(allIds);
      onEoaChange?.(allIds);
    }
  }, [eoas, onEoaChange]);

  const toggleEoa = (eoaId: string) => {
    setSelectedEoaIds((prev) => {
      const newSelection = prev.includes(eoaId)
        ? prev.filter((id) => id !== eoaId)
        : [...prev, eoaId];
      onEoaChange?.(newSelection);
      return newSelection;
    });
  };

  const formatStartDate = (dateString: string, timezone: string | null) => {
    try {
      const tz = timezone || "America/New_York";
      return formatInTimeZone(new Date(dateString), tz, "MMM d, yyyy h:mm a");
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Event or Action
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading EoAs...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state - no EoAs with start_date
  if (!eoas?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Event or Action
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No active EoAs found. Add a start date to an EoA to view Mode 1 Spark.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4" />
          Event or Action
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {eoas.map((eoa) => (
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
                {eoa.utm_id} <span className="text-muted-foreground">(Starts {formatStartDate(eoa.start_date, eoa.timezone)})</span>
              </label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SamizdatEoaSelector;
