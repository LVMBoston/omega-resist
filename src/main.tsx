// Force rebuild - 2025-10-25T19:25:00Z
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global crash trackers — surface anything that would otherwise vanish
// when the page bounces away unexpectedly.
window.addEventListener("error", (e) => {
  // eslint-disable-next-line no-console
  console.error("[GLOBAL ERROR]", e.message, e.error?.stack || "(no stack)", "at", e.filename, e.lineno);
});
window.addEventListener("unhandledrejection", (e) => {
  // eslint-disable-next-line no-console
  console.error("[UNHANDLED REJECTION]", e.reason?.message || e.reason, e.reason?.stack || "(no stack)");
});

// Track every URL change with a stack trace so we can see WHO navigated away.
const origPush = history.pushState;
const origReplace = history.replaceState;
history.pushState = function (...args) {
  // eslint-disable-next-line no-console
  console.warn("[NAV pushState]", args[2], "\n", new Error().stack);
  return origPush.apply(this, args as Parameters<typeof history.pushState>);
};
history.replaceState = function (...args) {
  // eslint-disable-next-line no-console
  console.warn("[NAV replaceState]", args[2], "\n", new Error().stack);
  return origReplace.apply(this, args as Parameters<typeof history.replaceState>);
};

createRoot(document.getElementById("root")!).render(<App />);
