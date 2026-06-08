import DOMPurify from "dompurify";

/**
 * Shared sanitization + helpers for the manual-entry rich text feature.
 *
 * We constrain the allowed HTML to a small subset that both the live React
 * renderer and the server-side snapshot renderer can faithfully reproduce.
 */

export const MANUAL_HTML_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "span",
];

export const MANUAL_HTML_ALLOWED_ATTRS = ["style", "class"];

/** Auto-fit configuration. Same constants on client and server. */
export const AUTO_FIT_MAX_SCALE = 1.0;
export const AUTO_FIT_MIN_SCALE = 0.4;
export const AUTO_FIT_STEP = 0.05;

export function sanitizeManualHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: MANUAL_HTML_ALLOWED_TAGS,
    ALLOWED_ATTR: MANUAL_HTML_ALLOWED_ATTRS,
    // Style attr is restricted to text-align via post-process below.
  });
}

/** Convert legacy plain-text manual labels to a simple HTML doc. */
export function plainTextToManualHtml(text: string): string {
  if (!text) return "";
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs
    .map((p) => {
      const lines = p.split("\n");
      const inner = lines
        .map((l) => escapeHtml(l))
        .join("<br>");
      return `<p>${inner}</p>`;
    })
    .join("");
}

/** Extract plain text from sanitized manual HTML (for back-compat manualLabel). */
export function manualHtmlToPlainText(html: string): string {
  if (!html) return "";
  if (typeof document === "undefined") {
    // Fallback (SSR / test): strip tags naively.
    return html.replace(/<br\s*\/?>(?!\s*<)/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .trim();
  }
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  // Convert <br> and </p> boundaries to newlines.
  tmp.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  const paragraphs = Array.from(tmp.querySelectorAll("p, li"))
    .map((el) => (el.textContent || "").trim())
    .filter(Boolean);
  if (paragraphs.length > 0) return paragraphs.join("\n\n");
  return (tmp.textContent || "").trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Heuristic: does this hotspot have actual rich content? */
export function hasManualHtmlContent(html: string | undefined | null): boolean {
  if (!html) return false;
  const stripped = html.replace(/<[^>]+>/g, "").trim();
  return stripped.length > 0;
}
