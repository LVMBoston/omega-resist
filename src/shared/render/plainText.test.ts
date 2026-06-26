import { describe, it, expect } from "vitest";
import { renderPlainTextSvg } from "./plainText";

const baseStyle = {
  fontSize: 24,
  fontWeight: "700",
  color: "#111",
  textAlign: "center" as const,
  verticalAlign: "middle",
  fontFamily: "Inter, sans-serif",
  paddingPx: 0,
  clipOverflow: false,
};

describe("renderPlainTextSvg", () => {
  it("renders a single tspan for short text", () => {
    const out = renderPlainTextSvg("Hello", { x: 0, y: 0, w: 200, h: 80 }, baseStyle, "t1");
    const tspans = out.match(/<tspan/g) || [];
    expect(tspans.length).toBe(1);
    expect(out).toContain(">Hello<");
  });

  it("wraps long text into multiple tspans", () => {
    const out = renderPlainTextSvg(
      "This is a fairly long sentence that should wrap across multiple lines inside a narrow box.",
      { x: 0, y: 0, w: 200, h: 200 },
      baseStyle,
      "t2",
    );
    const tspans = out.match(/<tspan/g) || [];
    expect(tspans.length).toBeGreaterThan(1);
  });

  it("escapes XML special characters", () => {
    const out = renderPlainTextSvg("A & B <c>", { x: 0, y: 0, w: 300, h: 80 }, baseStyle, "t3");
    expect(out).toContain("A &amp; B &lt;c&gt;");
    expect(out).not.toContain("<c>");
  });

  it("honors textAlign=left with start anchor at left padding", () => {
    const out = renderPlainTextSvg(
      "Left",
      { x: 10, y: 0, w: 200, h: 80 },
      { ...baseStyle, textAlign: "left", paddingPx: 8 },
      "t4",
    );
    expect(out).toContain('text-anchor="start"');
    expect(out).toMatch(/<tspan x="18"/);
  });

  it("honors textAlign=right with end anchor at right padding", () => {
    const out = renderPlainTextSvg(
      "Right",
      { x: 0, y: 0, w: 200, h: 80 },
      { ...baseStyle, textAlign: "right", paddingPx: 8 },
      "t5",
    );
    expect(out).toContain('text-anchor="end"');
    expect(out).toMatch(/<tspan x="192"/);
  });

  it("wraps clip-path group when clipOverflow=true", () => {
    const out = renderPlainTextSvg("hi", { x: 0, y: 0, w: 100, h: 40 }, { ...baseStyle, clipOverflow: true }, "t6");
    expect(out).toContain("<defs>");
    expect(out).toContain('clip-path="url(#clip-t6)"');
    expect(out).toContain("</g>");
  });

  it("preserves explicit newlines in source text", () => {
    const out = renderPlainTextSvg("Line A\nLine B", { x: 0, y: 0, w: 400, h: 120 }, baseStyle, "t7");
    const tspans = out.match(/<tspan/g) || [];
    expect(tspans.length).toBe(2);
    expect(out).toContain(">Line A<");
    expect(out).toContain(">Line B<");
  });
});
