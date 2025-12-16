import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPin } from "lucide-react";
import { format } from "date-fns";

interface SamizdatEoaSelectorProps {
  campaignId: string;
  onEoaChange?: (eoaId: string | null) => void;
}

interface EoaOption {
  id: string;
  title: string;
  start_date: string;
}

const SamizdatEoaSelector = ({ campaignId, onEoaChange }: SamizdatEoaSelectorProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEoaId = searchParams.get("eoa");

  // Query EoAs for this campaign where start_date IS NOT NULL
  const { data: eoas, isLoading } = useQuery({
    queryKey: ["samizdat-eoas", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];

      const { data, error } = await supabase
        .from("events_actions")
        .select("id, title, start_date")
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

  // Auto-select first EoA if none selected or selection is invalid
  useEffect(() => {
    if (!eoas?.length) return;

    const isValidSelection = selectedEoaId && eoas.some((e) => e.id === selectedEoaId);

    if (!isValidSelection) {
      // Default to first EoA
      const firstEoaId = eoas[0].id;
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.set("eoa", firstEoaId);
        return newParams;
      });
      onEoaChange?.(firstEoaId);
    } else {
      onEoaChange?.(selectedEoaId);
    }
  }, [eoas, selectedEoaId, setSearchParams, onEoaChange]);

  const handleEoaChange = (value: string) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("eoa", value);
      return newParams;
    });
    onEoaChange?.(value);
  };

  const formatStartDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy h:mm a");
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
        <Select value={selectedEoaId || ""} onValueChange={handleEoaChange}>
          <SelectTrigger className="w-full max-w-md">
            <SelectValue placeholder="Select an EoA" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            {eoas.map((eoa) => (
              <SelectItem key={eoa.id} value={eoa.id}>
                {eoa.title} (Starts {formatStartDate(eoa.start_date)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
};

export default SamizdatEoaSelector;
