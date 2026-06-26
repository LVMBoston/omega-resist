/**
 * Helpers for applying the per-campaign "Official start" cutoff
 * (`campaigns.official_start_at`) to client-side event lists.
 *
 * Events whose `occurred_at` is before the cutoff are bucketed as
 * "pre-launch / test" and excluded from headline reporting. When the
 * cutoff is null/undefined the behavior is a no-op (legacy default:
 * start = first real event).
 *
 * IMPORTANT: never delete or rewrite events. Filtering is purely at read time.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HasOccurredAt = { occurred_at?: string | null } | Record<string, any>;

const occurredAt = (e: any): number => {
  const v = e?.occurred_at ?? e?.occurredAt;
  if (!v) return Number.NaN;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : Number.NaN;
};

const cutoffMs = (officialStartAt: string | null | undefined): number | null => {
  if (!officialStartAt) return null;
  const t = new Date(officialStartAt).getTime();
  return Number.isFinite(t) ? t : null;
};

/** Returns true when the event should be counted in headline reporting. */
export function isHeadlineEvent(event: any, officialStartAt: string | null | undefined): boolean {
  const cutoff = cutoffMs(officialStartAt);
  if (cutoff == null) return true;
  const t = occurredAt(event);
  if (!Number.isFinite(t)) return true; // fail-open: keep events with bad timestamps
  return t >= cutoff;
}

/** Filter an array of events down to headline events. */
export function applyOfficialStartFilter<T extends HasOccurredAt>(
  events: T[] | null | undefined,
  officialStartAt: string | null | undefined
): T[] {
  if (!events) return [];
  const cutoff = cutoffMs(officialStartAt);
  if (cutoff == null) return events;
  return events.filter((e) => {
    const t = occurredAt(e);
    return !Number.isFinite(t) || t >= cutoff;
  });
}

/** Split events into { headline, preLaunch } buckets. */
export function splitEvents<T extends HasOccurredAt>(
  events: T[] | null | undefined,
  officialStartAt: string | null | undefined
): { headline: T[]; preLaunch: T[] } {
  if (!events) return { headline: [], preLaunch: [] };
  const cutoff = cutoffMs(officialStartAt);
  if (cutoff == null) return { headline: events, preLaunch: [] };
  const headline: T[] = [];
  const preLaunch: T[] = [];
  for (const e of events) {
    const t = occurredAt(e);
    if (!Number.isFinite(t) || t >= cutoff) headline.push(e);
    else preLaunch.push(e);
  }
  return { headline, preLaunch };
}

/** Format the cutoff as a short local-time label, e.g. "Jun 24, 2026 12:00 AM". */
export function formatOfficialStart(officialStartAt: string | null | undefined): string | null {
  if (!officialStartAt) return null;
  const d = new Date(officialStartAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Fetch a campaign's `official_start_at` by id or by code. Cached via react-query.
 */
export function useOfficialStart(opts: { campaignId?: string | null; campaignCode?: string | null }) {
  const { campaignId, campaignCode } = opts;
  const key = ["official-start", campaignId ?? null, campaignCode ?? null];
  return useQuery({
    queryKey: key,
    enabled: !!(campaignId || campaignCode),
    queryFn: async (): Promise<string | null> => {
      let q = supabase.from("campaigns").select("official_start_at").limit(1);
      if (campaignId) q = q.eq("id", campaignId);
      else if (campaignCode) q = q.eq("code", campaignCode);
      const { data, error } = await q.maybeSingle();
      if (error) {
        console.warn("[officialStart] lookup failed:", error.message);
        return null;
      }
      return (data?.official_start_at as string | null) ?? null;
    },
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });
}
