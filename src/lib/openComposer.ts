export interface PreparedComposerLaunch {
  open: (url: string) => boolean;
  cancel: () => void;
}

function isIOSDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** iOS Messages uses `&body=` when no recipient is supplied. */
export function buildSmsComposerUrl(body: string): string {
  const separator = isIOSDevice() ? "&" : "?";
  return `sms:${separator}body=${encodeURIComponent(body)}`;
}

/**
 * Reserve an iOS browsing context while the original tap is still active.
 * The share token can then be minted asynchronously without Safari rejecting
 * the eventual mailto:/sms: handoff as an unsolicited navigation.
 */
export function prepareComposerLaunch(): PreparedComposerLaunch {
  let reservedWindow: Window | null = null;

  if (isIOSDevice()) {
    try {
      reservedWindow = window.open("about:blank", "_blank");
    } catch {
      reservedWindow = null;
    }
  }

  return {
    open: (url: string) => {
      if (reservedWindow && !reservedWindow.closed) {
        try {
          reservedWindow.location.href = url;
          reservedWindow = null;
          return true;
        } catch {
          reservedWindow.close();
          reservedWindow = null;
        }
      }
      return openComposer(url);
    },
    cancel: () => {
      if (reservedWindow && !reservedWindow.closed) reservedWindow.close();
      reservedWindow = null;
    },
  };
}

/** Opens an external-scheme URL immediately from a user interaction. */
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
