import { describe, it, expect, vi } from "vitest";
import { computeCampaignStoryInputs } from "./campaignStoryInputs";

/**
 * Regression tests for the campaign-story metric layer.
 *
 * - Sprout count = distinct L00 parent tokens with children (not total shares).
 * - Two-lane metrics (2026-07-08): orphans excluded from both lanes;
 *   perHopConversion starts at 1→2 (never 0→1).
 */
describe("computeCampaignStoryInputs — sprout definition", () => {
  it("counts sprouts as DISTINCT parent tokens, not total L01+ shares", async () => {
    const sproutRows = [
      { token: "a1", parent_token: "A" },
      { token: "a2", parent_token: "A" },
      { token: "b1", parent_token: "B" },
      { token: "b2", parent_token: "B" },
    ];
    const levelRows = [
      { level: 0 }, { level: 0 }, { level: 0 },
      { level: 1 }, { level: 1 }, { level: 1 }, { level: 1 },
    ];

    const supabase = mockSupabase({
      campaign: { id: "c1", title: "T", created_at: "2026-01-01T00:00:00Z", official_start_at: null },
      levelRows,
      sproutRows,
      lineageRows: [],
    });

    const result = await computeCampaignStoryInputs(supabase, {
      campaignCode: "test",
      campaignId: "c1",
    });

    expect(result.seedCount).toBe(3);
    expect(result.sproutCount).toBe(2);
  });
});

describe("computeCampaignStoryInputs — two-lane metrics", () => {
  it("excludes orphans from both lanes and reports them separately", async () => {
    // Base L00 templates start with 'l00-'; instances have ':xxxxxx' suffix.
    // Orphans: parent_token IS NULL and NOT l00-shaped (legacy detached L1s).
    const lineageRows = [
      { token: "l00-a",          parent_token: null,    true_depth: 0, is_seed: true },   // base template
      { token: "l00-a:aaaaaa",   parent_token: "l00-a", true_depth: 0, is_seed: false },  // instance
      { token: "l00-a:bbbbbb",   parent_token: "l00-a", true_depth: 0, is_seed: false },  // instance
      { token: "share1",         parent_token: "l00-a:aaaaaa", true_depth: 1, is_seed: false },
      { token: "share2",         parent_token: "share1", true_depth: 2, is_seed: false },
      { token: "orphan1",        parent_token: null,    true_depth: 0, is_seed: true },   // ORPHAN
      { token: "orphan2",        parent_token: null,    true_depth: 0, is_seed: true },   // ORPHAN
    ];
    const supabase = mockSupabase({
      campaign: { id: "c1", title: "T", created_at: "2026-01-01T00:00:00Z", official_start_at: null },
      levelRows: [],
      sproutRows: [],
      lineageRows,
    });

    const result = await computeCampaignStoryInputs(supabase, {
      campaignCode: "test",
      campaignId: "c1",
    });

    expect(result.orphanCount).toBe(2);
    expect(result.broadcastOpens).toBe(3);  // 1 base + 2 instances, orphans excluded
    expect(result.chainViewers).toBe(2);    // share1 + share2

    // Per-hop conversion starts at 1→2, never 0→1.
    expect(result.perHopConversion.some((r) => r.from === 0)).toBe(false);
    expect(result.perHopConversion.find((r) => r.from === 1 && r.to === 2)).toEqual({
      from: 1, to: 2, fromCount: 1, toCount: 1, rate: 1,
    });
  });
});

describe("computeCampaignStoryInputs — pagination", () => {
  it("pages through token_lineage past 1000 rows using range()", async () => {
    // Build 2350 lineage rows split across 3 pages (1000 / 1000 / 350).
    const rows: any[] = [];
    for (let i = 0; i < 2350; i++) {
      rows.push({
        token: `l00-p:${i.toString().padStart(6, "0")}`,
        parent_token: "l00-p",
        true_depth: 0,
        is_seed: false,
      });
    }
    // Add the base template row so orphans stay at 0.
    rows.unshift({ token: "l00-p", parent_token: null, true_depth: 0, is_seed: true });

    const rangeCalls: [number, number][] = [];
    const supabase = mockSupabasePaginated({
      campaign: { id: "c1", title: "T", created_at: "2026-01-01T00:00:00Z", official_start_at: null },
      lineageRows: rows,
      rangeCalls,
    });

    const result = await computeCampaignStoryInputs(supabase, {
      campaignCode: "test",
      campaignId: "c1",
    });

    // 3 page calls: (0,999), (1000,1999), (2000,2999).
    expect(rangeCalls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    // All 2351 non-orphan rows landed in Lane A.
    expect(result.broadcastOpens).toBe(2351);
    expect(result.orphanCount).toBe(0);
  });
});

/** Paginated stub — slices lineageRows by the requested range window. */
function mockSupabasePaginated(fixtures: {
  campaign: any;
  lineageRows: any[];
  rangeCalls: [number, number][];
}) {
  const builder = (table: string) => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      gt: () => chain,
      gte: () => chain,
      is: () => chain,
      neq: () => chain,
      not: () => chain,
      order: () => chain,
      limit: () => Promise.resolve({ data: [], error: null }),
      single: () => Promise.resolve({ data: fixtures.campaign, error: null }),
      maybeSingle: () => Promise.resolve({ data: fixtures.campaign, error: null }),
      range: (from: number, to: number) => {
        if (table === "token_lineage") {
          fixtures.rangeCalls.push([from, to]);
          return Promise.resolve({
            data: fixtures.lineageRows.slice(from, to + 1),
            error: null,
          });
        }
        return Promise.resolve({ data: [], error: null });
      },
      then(resolve: (v: any) => void) {
        if (table === "url_events") return resolve({ data: [], count: 0, error: null });
        return resolve({ data: [], count: 0, error: null });
      },
    };
    return chain;
  };
  return { from: vi.fn(builder) };
}

/** Minimal query-builder stub that satisfies the shape used by the module. */
function mockSupabase(fixtures: {
  campaign: any;
  levelRows: any[];
  sproutRows: any[];
  lineageRows: any[];
}) {
  const builder = (table: string) => {
    let selectedCols = "";
    const chain: any = {
      select(cols: string) {
        selectedCols = cols;
        return chain;
      },
      eq: () => chain,
      in: () => chain,
      gt: () => chain,
      gte: () => chain,
      is: () => chain,
      neq: () => chain,
      not: () => chain,
      order: () => chain,
      range: () => Promise.resolve({
        data: table === "token_lineage" ? fixtures.lineageRows : [],
        error: null,
      }),
      limit: () => Promise.resolve({ data: [], error: null }),
      single: () => Promise.resolve({ data: fixtures.campaign, error: null }),
      maybeSingle: () => Promise.resolve({ data: fixtures.campaign, error: null }),
      then(resolve: (v: any) => void) {
        if (table === "token_lineage") {
          return resolve({ data: fixtures.lineageRows, error: null });
        }
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
