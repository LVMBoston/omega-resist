// Human-readable chart titles shared by the in-app chart renderer.
// Mirrored in supabase/functions/_shared/render/chartData.ts for SSR parity.

const BUCKET_WORD: Record<string, string> = {
  day: "day",
  week: "week",
  month: "month",
};

const SOURCE_TITLES: Record<string, string> = {
  cumulative_opens_by_level: "Cumulative opens by level",
  opens_per_period: "Opens per {bucket}",
  shares_per_period: "Shares per {bucket}",
  unique_viewers_per_period: "Unique viewers per {bucket}",
  new_l00_seeds_per_period: "New seeds per {bucket}",
};

export function chartSeriesTitle(dataSource?: string, timeBucket?: string): string {
  const template = SOURCE_TITLES[dataSource || "cumulative_opens_by_level"] || "Chart";
  const bucket = BUCKET_WORD[timeBucket || "week"] || "period";
  return template.replace("{bucket}", bucket);
}
