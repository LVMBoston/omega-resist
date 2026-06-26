// Deno copy of src/lib/campaignStorySplit.ts — keep in sync.
// Splits a campaign_story narrative at the paragraph boundary closest to
// the character-count midpoint so two side-by-side hotspots can render
// the full story in landscape layouts.

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
      first: titleBlocks.join("\n\n"),
      second: footerBlocks.join("\n\n"),
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

  const firstParts = [...titleBlocks, ...middle.slice(0, bestIdx)];
  const secondParts = [...middle.slice(bestIdx), ...footerBlocks];

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
