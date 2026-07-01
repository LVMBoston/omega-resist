import { describe, it, expect, vi } from "vitest";
import { computeCampaignStoryInputs } from "./campaignStoryInputs";

/**
 * Regression test for the "sprout count drift" bug (editor said 16,
 * SSR said 31 for the same campaign at the same instant).
 *
 * Guarantee: sproutCount === DISTINCT L00 parent tokens with children.
 * NOT the total number of L01+ tokens (that's "shares").
 */
describe("computeCampaignStoryInputs — sprout definition", () => {
  it("counts sprouts as DISTINCT parent tokens, not total L01+ shares", async () => {
    // 3 L00 seeds ("A","B","C"). Two of them (A,B) each have 2 children →
    // 4 total L01+ shares but only 2 distinct parents.  Expect sproutCount=2.
    const sproutRows = [
      { token: "a1", parent_token: "A" },
      { token: "a2", parent_token: "A" }, // duplicate parent
      { token: "b1", parent_token: "B" },
      { token: "b2", parent_token: "B" }, // duplicate parent
    ];
    const levelRows = [
      { level: 0 }, { level: 0 }, { level: 0 }, // 3 seeds
      { level: 1 }, { level: 1 }, { level: 1 }, { level: 1 }, // 4 shares
    ];

    const supabase = mockSupabase({
      campaign: { id: "c1", title: "T", created_at: "2026-01-01T00:00:00Z", official_start_at: null },
      levelRows,
      sproutRows,
    });

    const result = await computeCampaignStoryInputs(supabase, {
      campaignCode: "test",
      campaignId: "c1",
    });

    expect(result.seedCount).toBe(3);
    // The key assertion — this would have been 4 under the old SSR logic.
    expect(result.sproutCount).toBe(2);
  });
});

/** Minimal query-builder stub that satisfies the shape used by the module. */
function mockSupabase(fixtures: {
  campaign: any;
  levelRows: any[];
  sproutRows: any[];
}) {
  const builder = (table: string) => {
    // Track the columns requested via .select to route the response.
    let selectedCols = "";
    const chain: any = {
      select(cols: string) {
        selectedCols = cols;
        return chain;
      },
      eq: () => chain,
      gt: () => chain,
      gte: () => chain,
      is: () => chain,
      neq: () => chain,
      not: () => chain,
      order: () => chain,
      limit: () => Promise.resolve({ data: [], error: null }),
      single: () => Promise.resolve({ data: fixtures.campaign, error: null }),
      maybeSingle: () => Promise.resolve({ data: fixtures.campaign, error: null }),
      then(resolve: (v: any) => void) {
        if (table === "tokens" && selectedCols === "level") {
          return resolve({ data: fixtures.levelRows, error: null });
        }
        if (table === "tokens" && selectedCols.includes("parent_token")) {
          return resolve({ data: fixtures.sproutRows, error: null });
        }
        if (table === "url_events" && selectedCols.includes("count")) {
          return resolve({ count: 0, error: null });
        }
        return resolve({ data: [], count: 0, error: null });
      },
    };
    return chain;
  };
  return { from: vi.fn(builder) };
}
