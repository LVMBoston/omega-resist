import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DeckWithEoaCount {
  slug: string;
  eoaCount: number;
}

/**
 * Batch hook: fetches all deck slugs per template_id and EoA counts per deck.
 * Returns Record<templateId, DeckWithEoaCount[]>.
 */
export function useAllTemplateDecks(templateIds: string[]) {
  return useQuery({
    queryKey: ["all-template-decks", templateIds],
    queryFn: async (): Promise<Record<string, DeckWithEoaCount[]>> => {
      if (templateIds.length === 0) return {};

      // Step 1: Get all slide_items for these templates
      const { data: slideItems, error: slideError } = await supabase
        .from("slide_items")
        .select("template_id, deck_slug")
        .in("template_id", templateIds);

      if (slideError) throw slideError;
      if (!slideItems || slideItems.length === 0) return {};

      // Group deck_slugs by template_id
      const decksByTemplate: Record<string, Set<string>> = {};
      for (const item of slideItems) {
        if (!item.template_id) continue;
        if (!decksByTemplate[item.template_id]) {
          decksByTemplate[item.template_id] = new Set();
        }
        decksByTemplate[item.template_id].add(item.deck_slug);
      }

      // Collect all unique deck slugs
      const allSlugs = [...new Set(slideItems.map((s) => s.deck_slug))];

      // Step 2: Count EoAs per deck slug
      const { data: eoaRows, error: eoaError } = await supabase
        .from("events_actions")
        .select("assigned_deck_slug")
        .in("assigned_deck_slug", allSlugs);

      if (eoaError) throw eoaError;

      const eoaCounts: Record<string, number> = {};
      for (const row of eoaRows || []) {
        const slug = row.assigned_deck_slug;
        if (slug) {
          eoaCounts[slug] = (eoaCounts[slug] || 0) + 1;
        }
      }

      // Build result
      const result: Record<string, DeckWithEoaCount[]> = {};
      for (const [templateId, slugs] of Object.entries(decksByTemplate)) {
        result[templateId] = [...slugs].map((slug) => ({
          slug,
          eoaCount: eoaCounts[slug] || 0,
        }));
      }

      return result;
    },
    enabled: templateIds.length > 0,
    staleTime: 30000,
  });
}

/**
 * Batch hook: fetches campaign counts for all template IDs in one pass.
 * Traversal: slide_items.template_id → deck_slug → events_actions.assigned_deck_slug → campaign_id
 * Returns Record<templateId, campaignCount>.
 */
export function useAllTemplateCampaignCounts(templateIds: string[]) {
  return useQuery({
    queryKey: ["all-template-campaign-counts", templateIds],
    queryFn: async (): Promise<Record<string, number>> => {
      if (templateIds.length === 0) return {};

      // Step 1: Get deck_slugs per template
      const { data: slideItems, error: slideError } = await supabase
        .from("slide_items")
        .select("template_id, deck_slug")
        .in("template_id", templateIds);

      if (slideError) throw slideError;
      if (!slideItems || slideItems.length === 0) return {};

      // Group deck_slugs by template_id
      const decksByTemplate: Record<string, Set<string>> = {};
      for (const item of slideItems) {
        if (!item.template_id) continue;
        if (!decksByTemplate[item.template_id]) {
          decksByTemplate[item.template_id] = new Set();
        }
        decksByTemplate[item.template_id].add(item.deck_slug);
      }

      const allSlugs = [...new Set(slideItems.map((s) => s.deck_slug))];

      // Step 2: Get campaign_ids per deck_slug from events_actions
      const { data: eoas, error: eoaError } = await supabase
        .from("events_actions")
        .select("assigned_deck_slug, campaign_id")
        .in("assigned_deck_slug", allSlugs);

      if (eoaError) throw eoaError;
      if (!eoas || eoas.length === 0) return {};

      // Map deck_slug → Set<campaign_id>
      const campaignsByDeck: Record<string, Set<string>> = {};
      for (const eoa of eoas) {
        const slug = eoa.assigned_deck_slug;
        if (slug) {
          if (!campaignsByDeck[slug]) campaignsByDeck[slug] = new Set();
          campaignsByDeck[slug].add(eoa.campaign_id);
        }
      }

      // Build result: for each template, collect unique campaign IDs across its decks
      const result: Record<string, number> = {};
      for (const [templateId, slugs] of Object.entries(decksByTemplate)) {
        const campaignIds = new Set<string>();
        for (const slug of slugs) {
          const campaigns = campaignsByDeck[slug];
          if (campaigns) {
            campaigns.forEach((id) => campaignIds.add(id));
          }
        }
        result[templateId] = campaignIds.size;
      }

      return result;
    },
    enabled: templateIds.length > 0,
    staleTime: 30000,
  });
}
