import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TemplateCampaign {
  id: string;
  code: string;
  title: string;
  snapshot_enabled: boolean | null;
}

/**
 * Hook to fetch all campaigns that use a specific template.
 * Traverses: viral_slide_configs -> slide_items -> events_actions -> campaigns
 */
export function useTemplateCampaigns(templateId: string | undefined) {
  return useQuery({
    queryKey: ["template-campaigns", templateId],
    queryFn: async (): Promise<TemplateCampaign[]> => {
      if (!templateId) return [];

      // First get all deck_slugs that use this template
      const { data: slideItems, error: slideError } = await supabase
        .from("slide_items")
        .select("deck_slug")
        .eq("template_id", templateId);

      if (slideError) throw slideError;
      if (!slideItems || slideItems.length === 0) return [];

      const deckSlugs = [...new Set(slideItems.map((s) => s.deck_slug))];

      // Now get all events_actions with these deck_slugs
      const { data: eoaItems, error: eoaError } = await supabase
        .from("events_actions")
        .select("campaign_id")
        .in("assigned_deck_slug", deckSlugs);

      if (eoaError) throw eoaError;
      if (!eoaItems || eoaItems.length === 0) return [];

      const campaignIds = [...new Set(eoaItems.map((e) => e.campaign_id))];

      // Finally get the campaign details
      const { data: campaigns, error: campaignError } = await supabase
        .from("campaigns")
        .select("id, code, title, snapshot_enabled")
        .in("id", campaignIds)
        .order("display_order", { ascending: true });

      if (campaignError) throw campaignError;
      return campaigns || [];
    },
    enabled: !!templateId,
    staleTime: 30000, // 30 seconds
  });
}
