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
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ManualEntryRenderer } from "@/components/ManualEntryRenderer";
import {
  renderManualHtml,
  type RenderStyle,
} from "../../supabase/functions/render-stats-snapshot/manualHtml";

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
];

export default function ParityHarness() {
  const [params, setParams] = useSearchParams();
  const caseId = params.get("case") || CASES[0].id;
  const c = useMemo(() => CASES.find((x) => x.id === caseId) || CASES[0], [caseId]);

  const w = c.width ?? BOX_W;
  const h = c.height ?? BOX_H;
  const fs = c.baseFontSize ?? FS;
  const color = c.color ?? COLOR;
  const bg = c.bg ?? BG;
  const vAlign = c.verticalAlign ?? "top";

  // Use Inter on both sides — the SSR's actual font — so wrap measurements
  // (now Inter-based pixel widths) match what the browser DOM measures.
  const FONT_STACK = "'Inter', -apple-system, system-ui, sans-serif";

  const ssrStyle: RenderStyle = {
    baseFontSize: fs,
    color,
    align: "left",
    bg,
    verticalAlign: vAlign,
    fontFamily: FONT_STACK,
  };
  const ssrFragment = renderManualHtml(c.html, { x: 0, y: 0, w, h }, ssrStyle);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", background: "#2b2b2b", minHeight: "100vh", color: "#eee" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"
      />
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Manual-Entry Parity Harness</h1>
      <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 16 }}>
        Section {c.section} · Case <strong>{c.id}</strong> — {c.label}
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {CASES.map((x) => (
          <button
            key={x.id}
            onClick={() => setParams({ case: x.id })}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              borderRadius: 4,
              border: "1px solid #555",
              background: x.id === c.id ? "#5b8def" : "#3b3b3b",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {x.id}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `${w}px ${w}px`, gap: 24, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>EDITOR (live React)</div>
          <div
            data-parity-side="editor"
            style={{ width: w, height: h, background: bg, outline: "1px dashed #888" }}
          >
            <ManualEntryRenderer
              html={c.html}
              width={w}
              height={h}
              baseFontSize={fs}
              color={color}
              backgroundColor={bg}
              fontFamily={FONT_STACK}
            />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.8 }}>SSR (snapshot algorithm)</div>
          <div data-parity-side="ssr" style={{ width: w, height: h, outline: "1px dashed #888" }}>
            <svg
              width={w}
              height={h}
              viewBox={`0 0 ${w} ${h}`}
              xmlns="http://www.w3.org/2000/svg"
              dangerouslySetInnerHTML={{ __html: ssrFragment }}
            />
          </div>
        </div>
      </div>

      <details style={{ marginTop: 24, fontSize: 12, opacity: 0.75 }}>
        <summary>Fixture HTML</summary>
        <pre style={{ background: "#1a1a1a", padding: 12, borderRadius: 4, overflow: "auto" }}>{c.html}</pre>
      </details>
    </div>
  );
}

export { CASES as PARITY_CASES };
