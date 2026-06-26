/**
 * Parity Harness for Manual-Entry Hotspots
 *
 * Renders side-by-side comparisons of:
 *   LEFT:  the live editor renderer (<ManualEntryRenderer/>)
 *   RIGHT: the exact SSR algorithm (renderManualHtml from the edge function)
 *
 * Use the case selector or ?case=NN to navigate. The user is the judge of
 * whether each pair is faithful.
 */
import { useMemo } from "react";
import type React from "react";
import { useSearchParams } from "react-router-dom";
import { ManualEntryRenderer } from "@/components/ManualEntryRenderer";
import {
  renderManualHtml,
  type RenderStyle,
} from "../../supabase/functions/_shared/render/manualHtml";
import { renderPlainTextSvg } from "../../supabase/functions/_shared/render/plainText";
import { splitCampaignStoryAtMidpoint } from "../../supabase/functions/_shared/render/campaignStorySplit";
import { LiveCampaignSection } from "./parity/LiveCampaignSection";

type Case = {
  id: string;
  section: string;
  label: string;
  html: string;
  // Hotspot box (CSS pixels in harness).
  width?: number;
  height?: number;
  baseFontSize?: number;
  verticalAlign?: "top" | "middle" | "bottom";
  bg?: string;
  color?: string;
};

const BOX_W = 460;
const BOX_H = 280;
const FS = 18;
const COLOR = "#111111";
const BG = "#f5ecd4";

// §2.1 Inline formatting
const CASES: Case[] = [
  {
    id: "2.1a",
    section: "2.1",
    label: "Plain paragraph, single line",
    html: "<p>The next page is a live map.</p>",
  },
  {
    id: "2.1b",
    section: "2.1",
    label: "Plain paragraph, multi-line (forces wrap)",
    html: "<p>The next page is a live map — zip code level, so no one is identifiable — showing where this deck has been opened. It updates whenever someone shares it.</p>",
  },
  {
    id: "2.1c",
    section: "2.1",
    label: "Bold-only paragraph",
    html: "<p><strong>And for you, it's proof: You're part of something bigger.</strong></p>",
  },
  {
    id: "2.1d",
    section: "2.1",
    label: "Italic-only paragraph",
    html: "<p><em>Every mark is a small, motivating signal telling the people who built it not to despair.</em></p>",
  },
  {
    id: "2.1e",
    section: "2.1",
    label: "Bold + italic combined",
    html: "<p><strong><em>Someone out there is listening.</em></strong></p>",
  },
  {
    id: "2.1f",
    section: "2.1",
    label: "Mixed inline mid-sentence",
    html: "<p>This is <strong>bold</strong> and this is <em>italic</em> and this is back to normal.</p>",
  },
  {
    id: "2.1g",
    section: "2.1",
    label: "Bold spanning a wrap boundary",
    html: "<p>Normal text leading up to <strong>a long bold phrase that will definitely need to wrap onto another visual line</strong> and then more normal text after.</p>",
  },
  {
    id: "2.1h",
    section: "2.1",
    label: "Italic spanning a wrap boundary",
    html: "<p>Normal text leading up to <em>a long italic phrase that will definitely need to wrap onto another visual line</em> and then more normal text after.</p>",
  },

  // ===== §2.2 Block structure =====
  { id: "2.2a", section: "2.2", label: "Single paragraph",
    html: "<p>Just one paragraph of text in the box.</p>" },
  { id: "2.2b", section: "2.2", label: "Two paragraphs separated by blank line",
    html: "<p>First paragraph stands alone.</p><p>Second paragraph after a gap.</p>" },
  { id: "2.2c", section: "2.2", label: "Unordered list (3 items)",
    html: "<ul><li>Print the deck</li><li>Hand it to someone</li><li>Watch the map fill in</li></ul>" },
  { id: "2.2d", section: "2.2", label: "Ordered list (3 items)",
    html: "<ol><li>Print the deck</li><li>Hand it to someone</li><li>Watch the map fill in</li></ol>" },
  { id: "2.2e", section: "2.2", label: "Mixed: paragraph + list + paragraph",
    html: "<p>Here is the plan:</p><ul><li>Print</li><li>Share</li></ul><p>That is all.</p>" },
  { id: "2.2f", section: "2.2", label: "List item that wraps to two lines",
    html: "<ul><li>This is a long list item that should definitely wrap to a second visual line within the box</li><li>Short one</li></ul>" },

  // ===== §2.3 Horizontal alignment =====
  { id: "2.3a", section: "2.3", label: "Left aligned (default)",
    html: '<p style="text-align:left">Left aligned paragraph in the box.</p>' },
  { id: "2.3b", section: "2.3", label: "Center aligned",
    html: '<p style="text-align:center">Center aligned paragraph in the box.</p>' },
  { id: "2.3c", section: "2.3", label: "Right aligned",
    html: '<p style="text-align:right">Right aligned paragraph in the box.</p>' },
  { id: "2.3d", section: "2.3", label: "Mixed alignment across paragraphs",
    html: '<p style="text-align:left">Left paragraph.</p><p style="text-align:center">Center paragraph.</p><p style="text-align:right">Right paragraph.</p>' },
  { id: "2.3e", section: "2.3", label: "Centered text that wraps",
    html: '<p style="text-align:center">A center-aligned line that is long enough to wrap onto a second line for testing.</p>' },

  // ===== §2.4 Vertical alignment =====
  { id: "2.4a", section: "2.4", label: "V-align top (short content)",
    html: "<p>Short content, top aligned.</p>", verticalAlign: "top" },
  { id: "2.4b", section: "2.4", label: "V-align middle (short content)",
    html: "<p>Short content, middle aligned.</p>", verticalAlign: "middle" },
  { id: "2.4c", section: "2.4", label: "V-align bottom (short content)",
    html: "<p>Short content, bottom aligned.</p>", verticalAlign: "bottom" },
  { id: "2.4d", section: "2.4", label: "V-align middle, content fills box",
    html: "<p>This paragraph is long enough that vertical alignment should have minimal visible effect because the content nearly fills the available vertical space inside the hotspot box for this test case.</p>",
    verticalAlign: "middle" },

  // ===== §2.5 Auto-shrink =====
  { id: "2.5a", section: "2.5", label: "Barely fits at 100%",
    html: "<p>Three short lines.</p><p>Three short lines.</p><p>Three short lines.</p>",
    baseFontSize: 18 },
  { id: "2.5b", section: "2.5", label: "Overflows ~20% (should step down)",
    html: "<p>Paragraph one with a moderate amount of text inside it.</p><p>Paragraph two with a moderate amount of text inside it.</p><p>Paragraph three with a moderate amount of text inside it.</p><p>Paragraph four with a moderate amount of text inside it.</p>",
    baseFontSize: 18 },
  { id: "2.5c", section: "2.5", label: "Massive overflow (hits 40% floor, clips)",
    html: "<p>" + "Lorem ipsum dolor sit amet consectetur adipiscing elit. ".repeat(40) + "</p>",
    baseFontSize: 24 },

  // ===== §2.6 Edge cases =====
  { id: "2.6a", section: "2.6", label: "Empty HTML", html: "" },
  { id: "2.6b", section: "2.6", label: "Single character", html: "<p>A</p>" },
  { id: "2.6c", section: "2.6", label: "Long unbreakable token",
    html: "<p>Supercalifragilisticexpialidociousandthensomeextracharacters</p>" },
  { id: "2.6d", section: "2.6", label: "Unicode + emoji",
    html: "<p>Café — “smart quotes” … 🎉 こんにちは</p>" },
  { id: "2.6e", section: "2.6", label: "Sanitizer: script tag is stripped",
    html: '<p>Hello <script>alert(1)</script>world.</p>' },
  { id: "2.6f", section: "2.6", label: "Whitespace only", html: "<p>   </p>" },

  // ===== §2.7 Geometry sensitivity =====
  { id: "2.7a", section: "2.7", label: "Tall narrow box (200×420)",
    html: "<p>A paragraph rendered into a tall narrow hotspot box.</p>",
    width: 200, height: 420 },
  { id: "2.7b", section: "2.7", label: "Short wide box (640×120)",
    html: "<p>A paragraph rendered into a short wide hotspot box.</p>",
    width: 640, height: 120 },
  { id: "2.7c", section: "2.7", label: "Small square (220×220)",
    html: "<p>Square box, small.</p>", width: 220, height: 220 },
  { id: "2.7d", section: "2.7", label: "Large square (520×520)",
    html: "<p>Square box, large.</p>", width: 520, height: 520 },

  // ===== §2.8 Stoddard regression — plain text, narrow boxes =====
  // Reproduces the three-tan-box layout from the user's 2026-06-24 report:
  // tall title box must wrap; short "Last updated" / "EDT note" boxes must
  // wrap rather than clip a single SVG line.
  { id: "2.8a", section: "2.8", label: "Title box: wraps to 2 lines",
    html: "<p><strong>Live Map of Stoddard &amp; Patti's European Adventure</strong></p><p>(updates every 10 minutes)</p>",
    width: 720, height: 260, baseFontSize: 28, verticalAlign: "top" },
  { id: "2.8b", section: "2.8", label: "Last updated label (narrow)",
    html: "<p>Last updated:</p>",
    width: 220, height: 70, baseFontSize: 24, verticalAlign: "middle" },
  { id: "2.8c", section: "2.8", label: "Timestamp value (must wrap)",
    html: "<p>Jun 24, 2026 2:10 PM UTC</p>",
    width: 380, height: 70, baseFontSize: 24, verticalAlign: "middle" },
  { id: "2.8d", section: "2.8", label: "EDT note (must wrap)",
    html: "<p>Note: EDT = UTC - 4 hours</p>",
    width: 320, height: 70, baseFontSize: 24, verticalAlign: "middle" },
];

// =====================================================================
// §3 Plain-text hotspots (live_number / label / plain story)
// Exercises the shared `renderPlainTextSvg` helper used by SSR — the
// same code path standard hotspots take in the snapshot pipeline.
// =====================================================================
type PlainCase = {
  id: string;
  label: string;
  text: string;
  width: number;
  height: number;
  fontSize: number;
  fontWeight?: string;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
};

const PLAIN_CASES: PlainCase[] = [
  { id: "3.1a", label: "Short centered metric (24pt)", text: "1,284", width: 280, height: 120, fontSize: 48, textAlign: "center", verticalAlign: "middle" },
  { id: "3.1b", label: "Label, left-aligned top", text: "Last updated:", width: 220, height: 70, fontSize: 24, textAlign: "left", verticalAlign: "top" },
  { id: "3.1c", label: "Long timestamp must wrap", text: "Jun 24, 2026 2:10 PM UTC", width: 220, height: 90, fontSize: 24, textAlign: "left", verticalAlign: "middle" },
  { id: "3.1d", label: "Right-aligned bottom", text: "Bottom right", width: 300, height: 100, fontSize: 22, textAlign: "right", verticalAlign: "bottom" },
  { id: "3.1e", label: "Multi-line via \\n", text: "Line A\nLine B\nLine C", width: 320, height: 200, fontSize: 22, textAlign: "center", verticalAlign: "middle" },
  { id: "3.1f", label: "Wrap into 3+ lines", text: "A center-aligned paragraph long enough to wrap onto multiple lines inside this narrow hotspot.", width: 260, height: 220, fontSize: 20, textAlign: "center", verticalAlign: "middle" },
  { id: "3.1g", label: "XML special chars", text: "A & B <c> \"quoted\"", width: 360, height: 80, fontSize: 22, textAlign: "left", verticalAlign: "middle" },
];

// §4 Campaign-story segment fixtures.
// Verifies the splitter pins the title block to `first`, pins "Date of this
// report:" to `second`, and balances the middle paragraphs by char count.
type StoryCase = { id: string; label: string; story: string };
const STORY_CASES: StoryCase[] = [
  {
    id: "4.1",
    label: "Typical story — title pinned left, footer pinned right",
    story:
      "__TITLE__Conservative Capture__TITLE__\n\n" +
      "It started with one seed on Tuesday morning at a coffee shop in Akron, Ohio.\n\n" +
      "Within six hours, the message had jumped to four states and crossed two time zones.\n\n" +
      "By the end of day one, 23 distinct zip codes had opened the deck.\n\n" +
      "Most shares happened by text — quick, personal, and hard to ignore.\n\n" +
      "Date of this report: Jun 26, 2026",
  },
  {
    id: "4.2",
    label: "Short story (one paragraph after title)",
    story:
      "__TITLE__A Quiet Start__TITLE__\n\n" +
      "Three seeds, one zip code, one share. That's the whole story so far.",
  },
  {
    id: "4.3",
    label: "No title, no footer — balanced split only",
    story:
      "The first viewer opened the deck at 2:14 PM.\n\n" +
      "Six minutes later they shared it with a friend.\n\n" +
      "That friend shared it with two more.\n\n" +
      "By dinner, the chain had reached level 4.",
  },
];

function StoryCasePair({ c }: { c: StoryCase }) {
  const W = 320;
  const H = 360;
  const FS = 14;
  const split = splitCampaignStoryAtMidpoint(c.story);
  const cases: { tag: string; text: string }[] = [
    { tag: "full", text: c.story },
    { tag: "first", text: split.first },
    { tag: "second", text: split.second },
  ];
  return (
    <div style={{ marginBottom: 32 }}>
      <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>
        <strong>{c.id}</strong> — {c.label}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(3, ${W}px)`, gap: 16, alignItems: "start" }}>
        {cases.map(({ tag, text }) => {
          const ssr = renderPlainTextSvg(
            text,
            { x: 0, y: 0, w: W, h: H },
            {
              fontSize: FS, fontWeight: "400", color: COLOR,
              textAlign: "left", verticalAlign: "top",
              fontFamily: FONT_STACK, paddingPx: 8, clipOverflow: false,
            },
            `story-${c.id}-${tag}`,
          );
          return (
            <div key={tag}>
              <div style={{ fontSize: 11, marginBottom: 4, opacity: 0.7 }}>
                {tag.toUpperCase()} · {text.length} chars
              </div>
              <div style={{ width: W, height: H, background: BG, outline: "1px dashed #888" }}>
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
                  dangerouslySetInnerHTML={{ __html: ssr }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlainCasePair({ c }: { c: PlainCase }) {
  const fw = c.fontWeight ?? "700";
  const ta = c.textAlign ?? "center";
  const va = c.verticalAlign ?? "middle";
  const ssr = renderPlainTextSvg(
    c.text,
    { x: 0, y: 0, w: c.width, h: c.height },
    {
      fontSize: c.fontSize,
      fontWeight: fw,
      color: COLOR,
      textAlign: ta,
      verticalAlign: va,
      fontFamily: FONT_STACK,
      paddingPx: 0,
      clipOverflow: false,
    },
    `pc-${c.id.replace(/\./g, "-")}`,
  );
  const flexAlign = va === "top" ? "flex-start" : va === "bottom" ? "flex-end" : "center";
  return (
    <div style={{ marginBottom: 32 }}>
      <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>
        <strong>{c.id}</strong> — {c.label} · {c.width}×{c.height} · {c.fontSize}pt · {ta}/{va}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: `${c.width}px ${c.width}px`, gap: 24, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 11, marginBottom: 4, opacity: 0.7 }}>EDITOR (CSS mirror)</div>
          <div style={{
            width: c.width, height: c.height, background: BG, outline: "1px dashed #888",
            display: "flex", alignItems: flexAlign, justifyContent: ta === "left" ? "flex-start" : ta === "right" ? "flex-end" : "center",
            padding: 0, overflow: "hidden",
          }}>
            <div style={{
              fontFamily: FONT_STACK, fontSize: c.fontSize, fontWeight: fw, color: COLOR,
              textAlign: ta, whiteSpace: "pre-wrap", lineHeight: 1.2, width: "100%",
            }}>{c.text}</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, marginBottom: 4, opacity: 0.7 }}>SSR (renderPlainTextSvg)</div>
          <div style={{ width: c.width, height: c.height, background: BG, outline: "1px dashed #888" }}>
            <svg width={c.width} height={c.height} viewBox={`0 0 ${c.width} ${c.height}`} xmlns="http://www.w3.org/2000/svg"
              dangerouslySetInnerHTML={{ __html: ssr }} />
          </div>
        </div>
      </div>
    </div>
  );
}

const FONT_STACK = "'Inter', -apple-system, system-ui, sans-serif";

function CasePair({ c }: { c: Case }) {
  const w = c.width ?? BOX_W;
  const h = c.height ?? BOX_H;
  const fs = c.baseFontSize ?? FS;
  const color = c.color ?? COLOR;
  const bg = c.bg ?? BG;
  const vAlign = c.verticalAlign ?? "top";
  const ssrStyle: RenderStyle = {
    baseFontSize: fs, color, align: "left", bg,
    verticalAlign: vAlign, fontFamily: FONT_STACK,
  };
  const ssrFragment = renderManualHtml(c.html, { x: 0, y: 0, w, h }, ssrStyle);
  return (
    <div style={{ marginBottom: 32 }}>
      <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>
        <strong>{c.id}</strong> — {c.label}
        {c.verticalAlign ? `  ·  v-align: ${c.verticalAlign}` : ""}
        {c.width ? `  ·  ${w}×${h}` : ""}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: `${w}px ${w}px`, gap: 24, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 11, marginBottom: 4, opacity: 0.7 }}>EDITOR (live React)</div>
          <div style={{ width: w, height: h, background: bg, outline: "1px dashed #888" }}>
            <ManualEntryRenderer
              html={c.html} width={w} height={h} baseFontSize={fs}
              color={color} backgroundColor={bg} fontFamily={FONT_STACK}
              verticalAlign={vAlign}
            />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, marginBottom: 4, opacity: 0.7 }}>SSR (snapshot algorithm)</div>
          <div style={{ width: w, height: h, outline: "1px dashed #888" }}>
            <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg"
              dangerouslySetInnerHTML={{ __html: ssrFragment }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ParityHarness() {
  const [params, setParams] = useSearchParams();
  const caseId = params.get("case") || CASES[0].id;
  const sectionFilter = params.get("section");
  const showAll = sectionFilter === "all";

  const visible = useMemo(() => {
    if (showAll) return CASES;
    if (sectionFilter) return CASES.filter((x) => x.section === sectionFilter);
    return CASES.filter((x) => x.id === caseId);
  }, [caseId, sectionFilter, showAll]);

  const sections = Array.from(new Set(CASES.map((c) => c.section)));
  const showPlain = sectionFilter === "3" || showAll;
  const showStory = sectionFilter === "4" || showAll;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", background: "#2b2b2b", minHeight: "100vh", color: "#eee" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" />
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Render Parity Harness</h1>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <button onClick={() => setParams({ section: "all" })} style={btnStyle(showAll)}>ALL</button>
        {sections.map((s) => (
          <button key={s} onClick={() => setParams({ section: s })} style={btnStyle(sectionFilter === s)}>§{s}</button>
        ))}
        <button onClick={() => setParams({ section: "3" })} style={btnStyle(sectionFilter === "3")}>§3 plain</button>
        <button onClick={() => setParams({ section: "4" })} style={btnStyle(sectionFilter === "4")}>§4 story split</button>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {CASES.map((x) => (
          <button key={x.id} onClick={() => setParams({ case: x.id })}
            style={btnStyle(!showAll && !sectionFilter && x.id === caseId, true)}>{x.id}</button>
        ))}
      </div>

      {!showPlain && !showStory && visible.map((c) => <CasePair key={c.id} c={c} />)}
      {showPlain && (
        <>
          <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 12 }}>§3 Plain-text hotspots</h2>
          {PLAIN_CASES.map((c) => <PlainCasePair key={c.id} c={c} />)}
        </>
      )}
      {showStory && (
        <>
          <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 12 }}>§4 Campaign-story segment split</h2>
          {STORY_CASES.map((s) => <StoryCasePair key={s.id} c={s} />)}
        </>
      )}
    </div>
  );
}

function btnStyle(active: boolean, small = false): React.CSSProperties {
  return {
    padding: small ? "3px 8px" : "5px 12px",
    fontSize: small ? 11 : 12,
    borderRadius: 4,
    border: "1px solid #555",
    background: active ? "#5b8def" : "#3b3b3b",
    color: "#fff",
    cursor: "pointer",
  };
}

export { CASES as PARITY_CASES };
