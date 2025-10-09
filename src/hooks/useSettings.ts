import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Setting {
  id: string;
  category: string;
  key: string;
  value: any;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export function useSettings(category?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings", category],
    queryFn: async () => {
      let query = supabase.from("settings").select("*");
      
      if (category) {
        query = query.eq("category", category);
      }
      
      const { data, error } = await query.order("category").order("key");
      
      if (error) throw error;
      return data as Setting[];
    },
  });

  const updateSetting = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: any }) => {
      const { data, error } = await supabase
        .from("settings")
        .update({ value })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({
        title: "Success",
        description: "Setting updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update setting: ${error.message}`,
      });
    },
  });

  const getSetting = (category: string, key: string) => {
    return settings?.find((s) => s.category === category && s.key === key);
  };

  return {
    settings,
    isLoading,
    updateSetting: updateSetting.mutate,
    getSetting,
  };
}
