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
