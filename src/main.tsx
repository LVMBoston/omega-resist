// Force rebuild - 2025-10-25T19:25:00Z
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { traceLog, dumpPreviousTrace, clearTrace } from "./lib/crashTrace";

// ---- Crash tracing (temporary) ----
if (typeof window !== "undefined") {
  // Replay whatever the *previous* life of this tab logged, then clear.
  dumpPreviousTrace();
  clearTrace();

  traceLog("boot", {
    href: location.href,
    referrer: document.referrer,
    visibility: document.visibilityState,
  });

  window.addEventListener("error", (e) => {
    traceLog("error", {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    traceLog("rejection", {
      reason: e.reason,
      stack: (e.reason as { stack?: string } | undefined)?.stack,
    });
  });

  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args: Parameters<typeof origPush>) {
    traceLog("nav.push", String(args[2]), new Error("nav-trace").stack);
    return origPush.apply(this, args);
  };
  history.replaceState = function (...args: Parameters<typeof origReplace>) {
    traceLog("nav.replace", String(args[2]), new Error("nav-trace").stack);
    return origReplace.apply(this, args);
  };

  // Intercept anything that would force a full reload.
  const origReload = location.reload.bind(location);
  location.reload = ((...args: unknown[]) => {
    traceLog("loc.reload", new Error("reload-trace").stack);
    return (origReload as (...a: unknown[]) => void)(...args);
  }) as typeof location.reload;

  const origAssign = location.assign.bind(location);
  location.assign = ((url: string | URL) => {
    traceLog("loc.assign", String(url), new Error("assign-trace").stack);
    return origAssign(url);
  }) as typeof location.assign;

  const origLocReplace = location.replace.bind(location);
  location.replace = ((url: string | URL) => {
    traceLog("loc.replace", String(url), new Error("locreplace-trace").stack);
    return origLocReplace(url);
  }) as typeof location.replace;

  // Try to detect href= writes (best-effort; may not work in all browsers)
  try {
    const proto = Object.getPrototypeOf(location);
    const desc = Object.getOwnPropertyDescriptor(proto, "href");
    if (desc?.set) {
      const origHrefSet = desc.set;
      Object.defineProperty(location, "href", {
        configurable: true,
        get: desc.get,
        set(v: string) {
          traceLog("loc.href=", String(v), new Error("href-trace").stack);
          origHrefSet.call(location, v);
        },
      });
    }
  } catch (e) {
    traceLog("href-patch-failed", String(e));
  }

  window.addEventListener("beforeunload", () => {
    traceLog("beforeunload", location.href);
  });

  window.addEventListener("pagehide", (e) => {
    traceLog("pagehide", { persisted: e.persisted, href: location.href });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
