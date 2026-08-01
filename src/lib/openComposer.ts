/**
 * Opens a `mailto:` / `sms:` (or any external-scheme) URL reliably.
 *
 * Why this exists: when the deck runs inside an iframe (Lovable preview,
 * embeds, in-app browsers), assigning `window.location.href` or clicking a
 * synthetic <a> can be silently blocked by the frame sandbox, so the mail /
 * message composer never appears. We try, in order:
 *   1. navigate the top-level window (escapes the iframe),
 *   2. `window.open(url, "_top")` / `_blank`,
 *   3. plain same-frame navigation.
 *
 * Returns `false` when every attempt threw, so callers can surface a
 * tappable fallback link to the user.
 */
export function openComposer(url: string): boolean {
  const inIframe = (() => {
    try {
      return window.top !== window.self;
    } catch {
      return true;
    }
  })();

  if (inIframe) {
    // Same-origin parent: navigating the top window works directly.
    try {
      if (window.top) {
        window.top.location.href = url;
        return true;
      }
    } catch {
      /* cross-origin parent — fall through */
    }
    // Cross-origin parent: ask the browser to handle it outside this frame.
    try {
      const w = window.open(url, "_top");
      if (w !== null) return true;
    } catch {
      /* ignore */
    }
    try {
      const w = window.open(url, "_blank");
      if (w !== null) return true;
    } catch {
      /* ignore */
    }
  }

  try {
    window.location.href = url;
    return true;
  } catch {
    return false;
  }
}
