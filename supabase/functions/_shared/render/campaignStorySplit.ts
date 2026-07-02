/**
 * Shared (editor + SSR) campaign story splitter.
 *
 * Splits a campaign_story narrative into two roughly-equal halves at the
 * paragraph boundary closest to the midpoint by character count.
 *
 * Rules:
 *  - The __TITLE__…__TITLE__ block (if present) is always pinned to `first`.
 *  - A trailing paragraph beginning with "Date of this report:" is always
 *    pinned to `second` so the footer stays in the right-hand column.
 *  - Remaining paragraphs are distributed so the split index minimizes the
 *    absolute character-count difference between the two halves.
 *  - Paragraphs are separated by a blank line ("\n\n") to preserve the
 *    existing campaign-story paragraph-gap rendering in both the editor
 *    and the SSR snapshot renderer.
 *
 * Pure logic only — no Supabase, DOM, or Deno-specific APIs.
 * See src/shared/render/README.md for parity rules.
 */
export type StorySegment = "full" | "first" | "second";

export function splitCampaignStoryAtMidpoint(story: string): {
  first: string;
  second: string;
} {
  const text = (story ?? "").trim();
  if (!text) return { first: "", second: "" };

  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  if (blocks.length === 0) return { first: "", second: "" };
  if (blocks.length === 1) return { first: blocks[0], second: "" };

  const titleBlocks: string[] = [];
  const footerBlocks: string[] = [];
  const middle: string[] = [];

  for (const b of blocks) {
    if (b.startsWith("__TITLE__") && b.endsWith("__TITLE__")) {
      titleBlocks.push(b);
    } else if (/^Date of this report:/i.test(b)) {
      footerBlocks.push(b);
    } else {
      middle.push(b);
    }
  }

  if (middle.length === 0) {
    return {
      first: [...titleBlocks, ...footerBlocks].join("\n\n"),
      second: "",
    };
  }

  const titleChars = titleBlocks.reduce((n, b) => n + b.length, 0);
  const footerChars = footerBlocks.reduce((n, b) => n + b.length, 0);
  const middleChars = middle.map((b) => b.length);
  const totalMiddle = middleChars.reduce((n, c) => n + c, 0);

  let bestIdx = 1;
  let bestDiff = Infinity;
  let runningLeft = 0;
  for (let i = 1; i < middle.length; i++) {
    runningLeft += middleChars[i - 1];
    const left = titleChars + runningLeft;
    const right = footerChars + (totalMiddle - runningLeft);
    const diff = Math.abs(left - right);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  const firstParts = [...titleBlocks, ...footerBlocks, ...middle.slice(0, bestIdx)];
  const secondParts = [...middle.slice(bestIdx)];

  return {
    first: firstParts.join("\n\n"),
    second: secondParts.join("\n\n"),
  };
}

export function applyStorySegment(
  story: string,
  segment: StorySegment | undefined,
): string {
  if (!segment || segment === "full") return story;
  const { first, second } = splitCampaignStoryAtMidpoint(story);
  return segment === "first" ? first : second;
}
