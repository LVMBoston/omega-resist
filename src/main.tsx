// Force rebuild - 2025-10-25T19:25:00Z
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ---- Crash tracing (temporary) ----
if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => {
    // eslint-disable-next-line no-console
    console.error("[GLOBAL ERROR]", {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    // eslint-disable-next-line no-console
    console.error("[UNHANDLED REJECTION]", {
      reason: e.reason,
      stack: (e.reason as any)?.stack,
    });
  });

  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args: Parameters<typeof origPush>) {
    // eslint-disable-next-line no-console
    console.warn("[NAV pushState]", args[2], new Error("nav-trace").stack);
    return origPush.apply(this, args);
  };
  history.replaceState = function (...args: Parameters<typeof origReplace>) {
    // eslint-disable-next-line no-console
    console.warn("[NAV replaceState]", args[2], new Error("nav-trace").stack);
    return origReplace.apply(this, args);
  };

  window.addEventListener("beforeunload", () => {
    // eslint-disable-next-line no-console
    console.warn("[BEFOREUNLOAD]", location.href);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
