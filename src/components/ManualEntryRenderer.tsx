import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CSSProperties } from "react";
import {
  AUTO_FIT_MAX_SCALE,
  AUTO_FIT_MIN_SCALE,
  AUTO_FIT_STEP,
  sanitizeManualHtml,
} from "@/lib/manualEntryHtml";

interface ManualEntryRendererProps {
  html: string;
  width: number;
  height: number;
  baseFontSize: number;
  color: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontWeight?: string | number;
  /** Vertical alignment of the content within the box. Defaults to "top". */
  verticalAlign?: "top" | "middle" | "bottom";
  /** When true, disable auto-fit (rare; defaults to enabled). */
  noAutoFit?: boolean;
}

/**
 * Renders sanitized manual-entry HTML inside a fixed-size box.
 *
 * Runs an auto-fit loop: starts at AUTO_FIT_MAX_SCALE and steps the font size
 * down by AUTO_FIT_STEP until the content fits within the container, or the
 * AUTO_FIT_MIN_SCALE floor is reached (after which the bottom is clipped).
 *
 * Uses the same constants as the server-side snapshot renderer so the chosen
 * scale matches within one step.
 */
export function ManualEntryRenderer({
  html,
  width,
  height,
  baseFontSize,
  color,
  backgroundColor,
  fontFamily,
  fontWeight,
  verticalAlign = "top",
  noAutoFit,
}: ManualEntryRendererProps) {
  const safeHtml = sanitizeManualHtml(html);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(AUTO_FIT_MAX_SCALE);

  useLayoutEffect(() => {
    if (noAutoFit) {
      setScale(AUTO_FIT_MAX_SCALE);
      return;
    }
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container) return;

    let next = AUTO_FIT_MAX_SCALE;
    // Apply scale via inline style, measure, shrink, repeat.
    // We poke the DOM directly inside the loop to avoid React re-renders per step.
    const apply = (s: number) => {
      content.style.fontSize = `${baseFontSize * s}px`;
    };
    apply(next);
    let guard = 0;
    while (
      (content.scrollHeight > container.clientHeight ||
        content.scrollWidth > container.clientWidth) &&
      next > AUTO_FIT_MIN_SCALE + 1e-6 &&
      guard < 40
    ) {
      next = Math.max(AUTO_FIT_MIN_SCALE, next - AUTO_FIT_STEP);
      apply(next);
      guard++;
    }
    setScale(next);
  }, [safeHtml, width, height, baseFontSize, noAutoFit]);

  // NOTE: We intentionally do NOT apply fontWeight or fontStyle to the wrapper.
  // The Live Number style is typically bold/italic, which would override the
  // editor's <strong>/<em> intent and make every paragraph look bold-italic.
  // Rich-text formatting is driven entirely by the sanitized HTML.
  void fontWeight;
  const wrapperStyle: CSSProperties = {
    width: `${width}px`,
    height: `${height}px`,
    overflow: "hidden",
    backgroundColor: backgroundColor || "transparent",
    color,
    fontFamily: fontFamily || "system-ui, -apple-system, sans-serif",
    fontWeight: 400,
    fontStyle: "normal",
    pointerEvents: "none",
  };

  const contentStyle: CSSProperties = {
    fontSize: `${baseFontSize * scale}px`,
    lineHeight: 1.25,
    padding: "8px 10px",
    wordBreak: "break-word",
  };

  return (
    <div ref={containerRef} style={wrapperStyle} className="manual-entry-box">
      <style>{`
        .manual-entry-box ul { list-style: disc; padding-left: 1.4em; margin: 0; }
        .manual-entry-box ol { list-style: decimal; padding-left: 1.6em; margin: 0; }
        .manual-entry-box li { margin: 0; }
        .manual-entry-box p { margin: 0 0 0.4em 0; }
        .manual-entry-box p:last-child { margin-bottom: 0; }
      `}</style>
      <div
        ref={contentRef}
        style={contentStyle}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </div>
  );
}
